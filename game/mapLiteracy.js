/**
 * Map literacy SSOT — how Multiverse knows WHERE things are and WHICH layer
 * owns collider / nav / water / harvest.
 *
 * COORDINATES (SI metres after island.js SI normalize)
 *   - Origin: island XZ centered, feet at y≈0 after ground
 *   - +Y up, right-handed Three.js
 *   - Spawns / bosses / vendors: Vector3 world positions (not UV, not tiles)
 *
 * HOW WE KNOW WHAT IS WHERE
 *   1. Mesh name → classifyMeshName() → worldKind (terrain|tree|rock|building|prop)
 *   2. userData.layer + userData.colliderLayer + userData.walkable
 *   3. Spatial query: raycast down from (x, 500, z) → ground Y (makeGroundSampler)
 *   4. Navmesh grid: sample walkable cells from terrain height + slope + water ring
 *   5. Harvest/boss/vendor pads: authored arrays from loadBermudaIsland()
 *
 * COLLIDER LAYERS (physics / controller)
 *   walkable   — player capsule stands/slides (terrain, floors, safety ground)
 *   solid      — blocks capsule (buildings, large props, rocks used as walls)
 *   harvest    — selectable nodes, optional soft collision
 *   water      — non-walkable (or swim later); synthetic ring + deep plane
 *   trigger    — pads (boss/vendor/enemy zone) — no solid, gameplay only
 *   ignore     — foliage leaves, VFX, LODs not for physics
 *
 * THREE.js layers (bitmask) vs game collider layers
 *   - THREE.Layers: camera/render culling (0 default, 2 hitboxes in multiplayer)
 *   - colliderLayer: OUR semantic for buildStaticCollider / nav / AI
 *   Never confuse mesh.layers with colliderLayer.
 */

/** Semantic collider layers for Multiverse world. */
export const COLLIDER_LAYER = {
  WALKABLE: "walkable",
  SOLID: "solid",
  HARVEST: "harvest",
  WATER: "water",
  TRIGGER: "trigger",
  IGNORE: "ignore",
};

/** Map which worldKind gets which collider semantics. */
export function colliderLayerForKind(kind, meshName = "") {
  const n = String(meshName || "");
  // Never put foliage / LOD1–2 / interior clutter into the static BVH merge
  if (
    /leave|leaf|plant_01|grass(?!_ground)|bush|flower|particle|Broom_snakeweed|WeaponBox|Table|Bed|Cabinet|Palette|pipe/i.test(
      n,
    )
  ) {
    return COLLIDER_LAYER.IGNORE;
  }
  if (/LOD[12]/i.test(n) && !/LOD0/i.test(n)) {
    return COLLIDER_LAYER.IGNORE;
  }
  switch (kind) {
    case "terrain":
      return COLLIDER_LAYER.WALKABLE;
    case "building":
      return COLLIDER_LAYER.SOLID;
    case "tree":
    case "rock":
      return COLLIDER_LAYER.HARVEST;
    case "water":
      return COLLIDER_LAYER.WATER;
    case "prop":
      // Small props: ignore for nav; large named walls solid
      if (/wall|fence|tower|crate|barrel|rock_big|Container|Cargo|Sandbag|Hangar/i.test(n)) {
        return COLLIDER_LAYER.SOLID;
      }
      return COLLIDER_LAYER.IGNORE;
    default:
      return COLLIDER_LAYER.IGNORE;
  }
}

export function isWalkableCollider(layer) {
  return layer === COLLIDER_LAYER.WALKABLE;
}

export function isSolidCollider(layer) {
  return layer === COLLIDER_LAYER.SOLID || layer === COLLIDER_LAYER.HARVEST;
}

/**
 * Tag a mesh for production world tools (debug overlays, collider builders, nav).
 */
export function tagMeshWorld(o, kind) {
  if (!o || !o.isMesh) return;
  const layer = colliderLayerForKind(kind, o.name);
  o.userData.worldKind = kind;
  o.userData.layer = kind;
  o.userData.colliderLayer = layer;
  o.userData.walkable = layer === COLLIDER_LAYER.WALKABLE;
  o.userData.blocksNav = isSolidCollider(layer);
  o.userData.selectable =
    kind === "tree" || kind === "rock" ? "node" : o.userData.selectable || null;
}

/**
 * Estimate sea level (m) from shoreline ground samples (SI).
 * Uses lower percentile of ring heights near the map edge.
 */
export function estimateWaterline(sampleY, halfW) {
  const ys = [];
  const rings = [0.82, 0.88, 0.93];
  for (const fr of rings) {
    const r = halfW * fr;
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      try {
        const y = sampleY(Math.cos(a) * r, Math.sin(a) * r);
        if (Number.isFinite(y)) ys.push(y);
      } catch {
        /* ignore */
      }
    }
  }
  if (!ys.length) return 0.25;
  ys.sort((a, b) => a - b);
  // Low shoreline band ≈ water surface + beach
  const idx = Math.max(0, Math.floor(ys.length * 0.12));
  return Math.max(0.05, ys[idx]);
}

/**
 * Max land radius (m) where ground stays above water — SI metres.
 */
export function measureLandRadius(sampleY, halfW, waterY) {
  let maxR = halfW * 0.5;
  const step = Math.max(4, halfW * 0.025);
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    let lastGood = 0;
    for (let r = halfW * 0.25; r < halfW * 1.02; r += step) {
      let y = 0;
      try {
        y = sampleY(c * r, s * r);
      } catch {
        break;
      }
      if (!Number.isFinite(y) || y < waterY + 0.4) break;
      lastGood = r;
    }
    maxR = Math.max(maxR, lastGood);
  }
  return Math.max(halfW * 0.45, Math.min(halfW * 0.96, maxR));
}

/**
 * Heightfield navmesh over island bounds (SI metres).
 * Cell walkable only on LAND: inside landRadius, ground above water, gentle slope.
 *
 * @param {object} island — { bounds, halfW, hubRadius, scale, waterY?, landRadius? }
 * @param {(x:number,z:number)=>number} sampleY
 * @param {{ cellSize?: number, maxSlope?: number, waterY?: number, landRadius?: number }} opts
 */
export function buildNavGrid(island, sampleY, opts = {}) {
  const cellSize = opts.cellSize ?? 5; // metres — Bermuda ~800 m → ~160² cells
  const maxSlope = opts.maxSlope ?? 0.9; // dy per metre of cell
  const box = island.bounds;
  const halfW = island.halfW;
  const waterY =
    typeof opts.waterY === "number"
      ? opts.waterY
      : typeof island.waterY === "number"
        ? island.waterY
        : estimateWaterline(sampleY, halfW);
  const landRadius =
    typeof opts.landRadius === "number"
      ? opts.landRadius
      : typeof island.landRadius === "number"
        ? island.landRadius
        : measureLandRadius(sampleY, halfW, waterY);

  const minX = box.min.x;
  const maxX = box.max.x;
  const minZ = box.min.z;
  const maxZ = box.max.z;
  const cols = Math.max(8, Math.ceil((maxX - minX) / cellSize));
  const rows = Math.max(8, Math.ceil((maxZ - minZ) / cellSize));

  /** @type {{ x: number, z: number, y: number, walkable: boolean, water: boolean, i: number, j: number }[]} */
  const cells = [];
  /** @type {boolean[][]} */
  const walkable = [];
  /** @type {boolean[][]} */
  const waterMask = [];

  for (let j = 0; j < rows; j++) {
    walkable[j] = [];
    waterMask[j] = [];
    for (let i = 0; i < cols; i++) {
      const x = minX + (i + 0.5) * cellSize;
      const z = minZ + (j + 0.5) * cellSize;
      const dist = Math.hypot(x, z);
      let y = 0;
      let inWater = dist >= landRadius;
      let ok = !inWater;
      if (ok) {
        try {
          y = sampleY(x, z);
        } catch {
          ok = false;
        }
        if (!Number.isFinite(y)) ok = false;
        // Feet must sit clearly above sea level
        if (ok && y < waterY + 0.35) {
          ok = false;
          inWater = true;
        }
        // Reject void-ish safety flats far out with no real elevation band
        if (ok && y < waterY + 0.15) {
          ok = false;
          inWater = true;
        }
      }
      // Slope check vs west neighbor
      if (ok && i > 0 && walkable[j][i - 1]) {
        const prev = cells[cells.length - 1];
        if (prev && Math.abs(y - prev.y) > maxSlope * cellSize) ok = false;
      }
      // Slope vs south neighbor
      if (ok && j > 0 && walkable[j - 1]?.[i]) {
        const south = cells[(j - 1) * cols + i];
        if (south && Math.abs(y - south.y) > maxSlope * cellSize) ok = false;
      }
      walkable[j][i] = ok;
      waterMask[j][i] = inWater || !ok;
      cells.push({ x, z, y: ok ? y : waterY, walkable: ok, water: inWater || !ok, i, j });
    }
  }

  const walkCount = cells.filter((c) => c.walkable).length;
  console.info(
    `[navmesh] grid ${cols}×${rows} cell=${cellSize}m walkable=${walkCount}/${cells.length} (~${((walkCount / cells.length) * 100).toFixed(0)}%) waterY=${waterY.toFixed(2)} landR=${landRadius.toFixed(1)}m`,
  );

  const cellAt = (x, z) => {
    const i = Math.floor((x - minX) / cellSize);
    const j = Math.floor((z - minZ) / cellSize);
    if (i < 0 || j < 0 || i >= cols || j >= rows) return null;
    return cells[j * cols + i] || null;
  };

  const snap = (x, z) => {
    let best = null;
    let bestD = Infinity;
    for (const c of cells) {
      if (!c.walkable) continue;
      const d = (c.x - x) ** 2 + (c.z - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (best) return { x: best.x, y: best.y + 0.05, z: best.z, cell: best };
    let y = waterY + 1;
    try {
      y = sampleY(x, z) + 0.05;
    } catch {
      /* */
    }
    return { x, y, z };
  };

  /** 4-neighbor A* on walkable cells — returns world XZ path (SI). */
  const findPath = (sx, sz, gx, gz) => {
    const start = cellAt(sx, sz);
    const goal = cellAt(gx, gz);
    if (!start || !goal || !start.walkable || !goal.walkable) {
      const a = snap(sx, sz);
      const b = snap(gx, gz);
      return [a, b];
    }
    const key = (i, j) => j * cols + i;
    const open = [{ i: start.i, j: start.j, g: 0, f: 0 }];
    const came = new Map();
    const gScore = new Map([[key(start.i, start.j), 0]]);
    const h = (i, j) => Math.hypot(i - goal.i, j - goal.j);
    open[0].f = h(start.i, start.j);
    const closed = new Set();
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
    let guard = 0;
    while (open.length && guard++ < 50000) {
      open.sort((a, b) => a.f - b.f);
      const cur = open.shift();
      const ck = key(cur.i, cur.j);
      if (closed.has(ck)) continue;
      closed.add(ck);
      if (cur.i === goal.i && cur.j === goal.j) {
        const path = [];
        let k = ck;
        while (k !== undefined) {
          const c = cells[k];
          if (c) path.push({ x: c.x, y: c.y + 0.05, z: c.z });
          k = came.get(k);
        }
        path.reverse();
        return path.length ? path : [snap(gx, gz)];
      }
      for (const [di, dj] of dirs) {
        const ni = cur.i + di;
        const nj = cur.j + dj;
        if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
        if (!walkable[nj][ni]) continue;
        const nk = key(ni, nj);
        if (closed.has(nk)) continue;
        const step = di !== 0 && dj !== 0 ? 1.414 : 1;
        const tent = (gScore.get(ck) ?? Infinity) + step;
        if (tent >= (gScore.get(nk) ?? Infinity)) continue;
        came.set(nk, ck);
        gScore.set(nk, tent);
        open.push({ i: ni, j: nj, g: tent, f: tent + h(ni, nj) });
      }
    }
    return [snap(sx, sz), snap(gx, gz)];
  };

  /**
   * Prefer hub ring on solid land for player start (never water / void).
   * @returns {{ x:number, y:number, z:number }[]}
   */
  const pickLandSpawns = (count = 12, hubRadius = island.hubRadius || landRadius * 0.2) => {
    const ringMin = hubRadius * 1.15;
    const ringMax = Math.min(landRadius * 0.72, hubRadius * 2.4);
    /** @type {typeof cells} */
    const band = cells.filter((c) => {
      if (!c.walkable) return false;
      const d = Math.hypot(c.x, c.z);
      return d >= ringMin && d <= ringMax && c.y >= waterY + 0.45;
    });
    const pool = band.length >= count ? band : cells.filter((c) => c.walkable && c.y >= waterY + 0.45);
    if (!pool.length) {
      // Absolute fallback — origin snap
      const s = snap(0, 0);
      return Array.from({ length: count }, () => ({ x: s.x, y: s.y + 1.0, z: s.z }));
    }
    // Even angular spacing
    const out = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const tx = Math.cos(a) * ((ringMin + ringMax) * 0.5);
      const tz = Math.sin(a) * ((ringMin + ringMax) * 0.5);
      let best = pool[0];
      let bestD = Infinity;
      for (const c of pool) {
        const d = (c.x - tx) ** 2 + (c.z - tz) ** 2;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      out.push({ x: best.x, y: best.y + 1.05, z: best.z });
    }
    return out;
  };

  return {
    cellSize,
    cols,
    rows,
    minX,
    minZ,
    maxX,
    maxZ,
    cells,
    walkable,
    waterMask,
    waterY,
    landRadius,
    sampleY,
    cellAt,
    snap,
    findPath,
    pickLandSpawns,
    isWalkableWorld(x, z) {
      const c = cellAt(x, z);
      return !!(c && c.walkable);
    },
    isWaterWorld(x, z) {
      const c = cellAt(x, z);
      if (!c) return Math.hypot(x, z) >= landRadius;
      return !!c.water || !c.walkable;
    },
  };
}

/**
 * Water-layer physics helper (soft) — keeps capsule on land nav, not swimming (yet).
 * SI metres. Does not invent a second physics engine.
 */
export function createWaterPhysics(nav, opts = {}) {
  const waterY = nav?.waterY ?? opts.waterY ?? 0.25;
  const landRadius = nav?.landRadius ?? opts.landRadius ?? 100;
  const margin = opts.margin ?? 0.6;

  return {
    surfaceY: waterY,
    landRadius,
    /** True if feet would be in sea / non-walkable */
    isInWater(x, z, feetY) {
      if (nav?.isWaterWorld?.(x, z)) return true;
      if (Math.hypot(x, z) >= landRadius - margin) return true;
      if (Number.isFinite(feetY) && feetY < waterY + 0.2) return true;
      return false;
    },
    /**
     * Push world position back onto land nav if in water.
     * Mutates `pos` (THREE.Vector3-like {x,y,z}).
     * @returns {boolean} true if corrected
     */
    constrainPosition(pos, sampleY) {
      if (!pos) return false;
      const feetY = pos.y - 1.0;
      if (!this.isInWater(pos.x, pos.z, feetY) && nav?.isWalkableWorld?.(pos.x, pos.z)) {
        return false;
      }
      const sn = nav?.snap?.(pos.x, pos.z);
      if (sn) {
        pos.x = sn.x;
        pos.z = sn.z;
        pos.y = (sn.y ?? sampleY?.(sn.x, sn.z) ?? waterY) + 1.1;
        return true;
      }
      // Radial pull toward origin on land ring
      const d = Math.hypot(pos.x, pos.z) || 1;
      const r = Math.max(2, landRadius - margin * 3);
      pos.x = (pos.x / d) * r;
      pos.z = (pos.z / d) * r;
      const gy = sampleY?.(pos.x, pos.z);
      pos.y = (Number.isFinite(gy) ? gy : waterY) + 1.1;
      return true;
    },
  };
}

/**
 * Collect meshes by collider layer for static collider rebuild.
 * Prefer walkable terrain first; skip empty/invisible/no-geometry.
 *
 * @param {THREE.Object3D} root
 * @param {string[]} wantLayers
 * @param {{ maxMeshes?: number }} opts — cap merge size (Bermuda ~1500 meshes would OOM)
 */
export function collectColliderMeshes(root, wantLayers, opts = {}) {
  const want = new Set(wantLayers || [COLLIDER_LAYER.WALKABLE, COLLIDER_LAYER.SOLID]);
  const maxMeshes = opts.maxMeshes ?? 420;
  /** @type {THREE.Mesh[]} */
  const walkable = [];
  /** @type {THREE.Mesh[]} */
  const solid = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry) return;
    const layer =
      o.userData.colliderLayer ||
      (o.name === "island-safety-ground" ? COLLIDER_LAYER.WALKABLE : COLLIDER_LAYER.IGNORE);
    if (!want.has(layer)) return;
    // Skip degenerate
    const pos = o.geometry.attributes?.position;
    if (!pos || pos.count < 3) return;
    if (layer === COLLIDER_LAYER.WALKABLE || o.name === "island-safety-ground") walkable.push(o);
    else solid.push(o);
  });

  // Priority: Main_Large_Terrain / ground / roads / safety, then other walkable, then solids
  const score = (m) => {
    const n = m.name || "";
    if (n === "island-safety-ground") return 0;
    if (/Main_Large_Terrain/i.test(n)) return 1;
    if (/^ground|ground\.|Floor|CementFactory_ground|MainHighway|UnsurfacedRoad|airport_road/i.test(n)) return 2;
    if (m.userData?.walkable || m.userData?.colliderLayer === COLLIDER_LAYER.WALKABLE) return 3;
    if (/house|building|wall|fence|Hangar|Warehouse/i.test(n)) return 4;
    return 5;
  };
  walkable.sort((a, b) => score(a) - score(b));
  solid.sort((a, b) => score(a) - score(b));

  const out = walkable.concat(solid);
  if (out.length > maxMeshes) {
    // Keep all high-priority walkables, fill remainder with solids
    const keepW = walkable.slice(0, Math.min(walkable.length, Math.floor(maxMeshes * 0.55)));
    const keepS = solid.slice(0, maxMeshes - keepW.length);
    console.warn(
      `[mapLiteracy] collider mesh cap ${maxMeshes}: walkable ${keepW.length}/${walkable.length} solid ${keepS.length}/${solid.length}`,
    );
    return keepW.concat(keepS);
  }
  return out;
}

/** Debug summary for agents / consoles. */
export function describeIslandLiteracy(island, nav) {
  return {
    units: island.units || "si_metres",
    humanHeightM: island.humanHeightM ?? 1.8,
    halfW_m: island.halfW,
    hubRadius_m: island.hubRadius,
    landRadius_m: island.landRadius ?? nav?.landRadius,
    waterY_m: island.waterY ?? nav?.waterY,
    scale: island.scale,
    harvestNodes: island.harvestNodes?.length ?? 0,
    spawns: island.spawns?.length ?? 0,
    bosses: island.bossPads?.length ?? 0,
    vendors: island.vendorPads?.length ?? 0,
    bounds: island.bounds
      ? {
          min: island.bounds.min.toArray?.() || island.bounds.min,
          max: island.bounds.max.toArray?.() || island.bounds.max,
        }
      : null,
    nav: nav
      ? {
          cells: nav.cells.length,
          walkable: nav.cells.filter((c) => c.walkable).length,
          cellSize: nav.cellSize,
          waterY: nav.waterY,
          landRadius: nav.landRadius,
        }
      : null,
  };
}
