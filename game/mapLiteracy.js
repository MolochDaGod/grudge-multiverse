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
  if (/leave|leaf|plant_01|grass(?!_ground)|bush|flower|particle/i.test(n)) {
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
      if (/wall|fence|tower|crate|barrel|rock_big/i.test(n)) return COLLIDER_LAYER.SOLID;
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
 * Build a simple heightfield navmesh: regular XZ grid over island bounds.
 * Cell is walkable if ground Y is finite, slope gentle, and not in water ring.
 *
 * @param {object} island — return of loadBermudaIsland
 * @param {(x:number,z:number)=>number} sampleY — makeGroundSampler(island.root)
 * @param {{ cellSize?: number, maxSlope?: number }} opts
 */
export function buildNavGrid(island, sampleY, opts = {}) {
  const cellSize = opts.cellSize ?? 4; // metres — coarse for large Free Fire island
  const maxSlope = opts.maxSlope ?? 0.85; // dy/cell
  const box = island.bounds;
  const halfW = island.halfW;
  const waterR = halfW * 0.95;
  const minX = box.min.x;
  const maxX = box.max.x;
  const minZ = box.min.z;
  const maxZ = box.max.z;
  const cols = Math.max(8, Math.ceil((maxX - minX) / cellSize));
  const rows = Math.max(8, Math.ceil((maxZ - minZ) / cellSize));

  /** @type {{ x: number, z: number, y: number, walkable: boolean, i: number, j: number }[]} */
  const cells = [];
  /** @type {boolean[][]} */
  const walkable = [];

  for (let j = 0; j < rows; j++) {
    walkable[j] = [];
    for (let i = 0; i < cols; i++) {
      const x = minX + (i + 0.5) * cellSize;
      const z = minZ + (j + 0.5) * cellSize;
      const dist = Math.hypot(x, z);
      let y = 0;
      let ok = dist < waterR;
      if (ok) {
        try {
          y = sampleY(x, z);
        } catch {
          ok = false;
        }
        if (!Number.isFinite(y)) ok = false;
      }
      // Slope check vs west neighbor
      if (ok && i > 0 && walkable[j][i - 1]) {
        const prev = cells[cells.length - 1];
        if (prev && Math.abs(y - prev.y) > maxSlope * cellSize) ok = false;
      }
      walkable[j][i] = ok;
      cells.push({ x, z, y: ok ? y : 0, walkable: ok, i, j });
    }
  }

  const walkCount = cells.filter((c) => c.walkable).length;
  console.info(
    `[navmesh] grid ${cols}×${rows} cell=${cellSize}m walkable=${walkCount}/${cells.length} (~${((walkCount / cells.length) * 100).toFixed(0)}%)`,
  );

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
    /** Nearest walkable world position to (x,z) */
    snap(x, z) {
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
      return best
        ? { x: best.x, y: best.y + 0.05, z: best.z }
        : { x, y: sampleY(x, z) + 0.05, z };
    },
    isWalkableWorld(x, z) {
      const i = Math.floor((x - minX) / cellSize);
      const j = Math.floor((z - minZ) / cellSize);
      if (i < 0 || j < 0 || i >= cols || j >= rows) return false;
      return !!walkable[j]?.[i];
    },
  };
}

/**
 * Collect meshes by collider layer for static collider rebuild.
 */
export function collectColliderMeshes(root, wantLayers) {
  const want = new Set(wantLayers || [COLLIDER_LAYER.WALKABLE, COLLIDER_LAYER.SOLID]);
  const out = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const layer = o.userData.colliderLayer || COLLIDER_LAYER.IGNORE;
    if (want.has(layer) || (want.has(COLLIDER_LAYER.WALKABLE) && o.name === "island-safety-ground")) {
      out.push(o);
    }
  });
  return out;
}

/** Debug summary for agents / consoles. */
export function describeIslandLiteracy(island, nav) {
  return {
    halfW_m: island.halfW,
    hubRadius_m: island.hubRadius,
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
        }
      : null,
  };
}
