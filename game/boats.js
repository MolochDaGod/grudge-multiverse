/**
 * Multiverse boats + sailing (SI metres).
 *
 * - Seed places harbors/docks + boat slips on coast
 * - Procedural sailboat mesh (no missing CDN GLB required)
 * - E board / F disembark · WASD sail on water surface
 * - Sea nav uses waterMask from heightfield (not land walkable)
 *
 * Does not replace TI water.grudge-studio.com product — in-island coastal sailing.
 */
import * as THREE from "three";

export const BOAT_LOA_M = 8.5; // length overall
export const BOAT_BEAM_M = 2.6;
export const SAIL_SPEED = 9.5; // m/s full sail
export const SAIL_TURN = 1.35; // rad/s

/**
 * Build sea navigation helper from land nav grid (inverse walkable = sail).
 */
export function createSeaNav(nav, opts = {}) {
  const waterY = nav?.waterY ?? opts.waterY ?? 0.25;
  const landRadius = nav?.landRadius ?? opts.landRadius ?? 200;
  const cellSize = nav?.cellSize ?? 5;
  const cells = nav?.cells || [];
  const sailCells = cells.filter((c) => c.water || !c.walkable);
  // Prefer near-shore water (between landR*0.85 and landR*1.35)
  const coast = sailCells.filter((c) => {
    const d = Math.hypot(c.x, c.z);
    return d >= landRadius * 0.75 && d <= landRadius * 1.45;
  });

  const snapWater = (x, z) => {
    let best = null;
    let bestD = Infinity;
    const pool = coast.length ? coast : sailCells;
    for (const c of pool) {
      const d = (c.x - x) ** 2 + (c.z - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (best) return { x: best.x, y: waterY + 0.15, z: best.z };
    const d = Math.hypot(x, z) || 1;
    const r = Math.max(landRadius * 0.95, Math.min(landRadius * 1.2, d));
    return { x: (x / d) * r, y: waterY + 0.15, z: (z / d) * r };
  };

  const isSailable = (x, z) => {
    if (nav?.isWaterWorld?.(x, z)) return true;
    const d = Math.hypot(x, z);
    return d >= landRadius * 0.88 && d <= landRadius * 1.5;
  };

  return {
    waterY,
    landRadius,
    cellSize,
    snapWater,
    isSailable,
    /** Nearest coastal dock point for a harbor x,z */
    dockPoint(hx, hz) {
      // Push slightly seaward from harbor
      const d = Math.hypot(hx, hz) || 1;
      const nx = hx / d;
      const nz = hz / d;
      const r = landRadius * 0.98;
      return snapWater(nx * r, nz * r);
    },
  };
}

/** Procedural sailboat — SI LOA ~8.5 m. */
export function createSailboatMesh(color = 0xc4a574) {
  const root = new THREE.Group();
  root.name = "sailboat";

  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(BOAT_BEAM_M, 0.9, BOAT_LOA_M),
    new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.05 }),
  );
  hull.position.y = 0.35;
  hull.castShadow = true;
  root.add(hull);

  // Bow taper hint
  const bow = new THREE.Mesh(
    new THREE.ConeGeometry(BOAT_BEAM_M * 0.55, 2.2, 4),
    new THREE.MeshStandardMaterial({ color, roughness: 0.65 }),
  );
  bow.rotation.x = Math.PI / 2;
  bow.position.set(0, 0.4, BOAT_LOA_M * 0.45);
  root.add(bow);

  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 6.5, 6),
    new THREE.MeshStandardMaterial({ color: 0x5a4030 }),
  );
  mast.position.set(0, 3.5, -0.3);
  root.add(mast);

  const sail = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 4.5),
    new THREE.MeshStandardMaterial({
      color: 0xf0e8d8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
    }),
  );
  sail.position.set(0.15, 3.8, -0.3);
  sail.name = "sail-cloth";
  root.add(sail);

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(BOAT_BEAM_M * 0.85, 0.12, BOAT_LOA_M * 0.7),
    new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.8 }),
  );
  deck.position.y = 0.85;
  root.add(deck);

  root.userData.boat = true;
  root.userData.loa = BOAT_LOA_M;
  return root;
}

/**
 * Mount boats + docks from world document harbors.
 * @returns {object} boatSystem
 */
export function mountBoats(scene, island, world, groundAt) {
  const sea = createSeaNav(island.nav, {
    waterY: island.waterY,
    landRadius: island.landRadius,
  });
  const root = new THREE.Group();
  root.name = "boats_layer";
  scene.add(root);

  const harbors = (world?.harbors || world?.pois || []).filter(
    (p) => p.kind === "harbor" || p.kind === "dock",
  );
  // Fallback: place 4 coastal docks if seed has no harbors yet
  const docks = harbors.length
    ? harbors
    : [0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
        const r = (island.landRadius || 300) * 0.92;
        return {
          id: `dock-auto-${i}`,
          name: `Harbor ${i + 1}`,
          kind: "harbor",
          x: Math.cos(a) * r,
          z: Math.sin(a) * r,
          accent: "#4a90d9",
        };
      });

  /** @type {object[]} */
  const boats = [];
  /** @type {object[]} */
  const dockInteract = [];

  for (const h of docks) {
    const dock = sea.dockPoint(h.x, h.z);
    // Pier visual
    const pier = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 0.35, 14),
      new THREE.MeshStandardMaterial({ color: 0x6b5344, roughness: 0.85 }),
    );
    const ang = Math.atan2(dock.x, dock.z);
    pier.position.set(
      (h.x + dock.x) * 0.5,
      (island.waterY || 0) + 0.4,
      (h.z + dock.z) * 0.5,
    );
    pier.rotation.y = ang;
    pier.castShadow = true;
    root.add(pier);

    const flag = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1.2, 0.08),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(h.accent || "#4a90d9"),
        emissive: new THREE.Color(h.accent || "#4a90d9"),
        emissiveIntensity: 0.15,
      }),
    );
    flag.position.set(dock.x, (island.waterY || 0) + 2.2, dock.z);
    root.add(flag);

    const boatMesh = createSailboatMesh();
    boatMesh.position.set(dock.x, dock.y, dock.z);
    boatMesh.rotation.y = ang + Math.PI;
    root.add(boatMesh);

    const boat = {
      id: `boat-${h.id}`,
      harborId: h.id,
      mesh: boatMesh,
      home: { ...dock },
      yaw: boatMesh.rotation.y,
      speed: 0,
      occupied: false,
      sea,
    };
    boats.push(boat);

    dockInteract.push({
      kind: "boat",
      id: boat.id,
      label: `${h.name || "Harbor"} · board boat`,
      x: dock.x,
      z: dock.z,
      y: dock.y,
      radius: 5.5,
      boat,
      harbor: h,
    });
  }

  console.info(
    `[boats] harbors=${docks.length} boats=${boats.length} waterY=${sea.waterY.toFixed(2)} landR=${sea.landRadius.toFixed(0)}`,
  );

  return {
    root,
    sea,
    boats,
    dockInteract,
    active: null,
    /** Board nearest free boat */
    tryBoard(playerPos) {
      if (this.active) return null;
      let best = null;
      let bd = 6;
      for (const b of boats) {
        if (b.occupied) continue;
        const d = Math.hypot(playerPos.x - b.mesh.position.x, playerPos.z - b.mesh.position.z);
        if (d < bd) {
          bd = d;
          best = b;
        }
      }
      if (!best) return null;
      best.occupied = true;
      this.active = best;
      return best;
    },
    /** Disembark to nearest land */
    tryDisembark(nav, groundAt) {
      const b = this.active;
      if (!b) return null;
      const x = b.mesh.position.x;
      const z = b.mesh.position.z;
      // Walk inland a few metres
      const d = Math.hypot(x, z) || 1;
      const ix = (x / d) * Math.max(2, (nav?.landRadius || 200) * 0.88);
      const iz = (z / d) * Math.max(2, (nav?.landRadius || 200) * 0.88);
      const sn = nav?.snap?.(ix, iz) || {
        x: ix,
        y: (groundAt?.(ix, iz) ?? 0) + 1.1,
        z: iz,
      };
      b.occupied = false;
      // Leave boat at dock-ish water
      const w = this.sea.snapWater(x, z);
      b.mesh.position.set(w.x, w.y, w.z);
      this.active = null;
      return { x: sn.x, y: (sn.y ?? 0) + 1.05, z: sn.z };
    },
    /**
     * Sail update when boarded.
     * @param {{ fwd:boolean, bkd:boolean, lft:boolean, rgt:boolean }} input
     */
    updateSail(dt, input, playerCapsule) {
      const b = this.active;
      if (!b) return;
      const mesh = b.mesh;
      // Turn
      if (input.lft) b.yaw += SAIL_TURN * dt;
      if (input.rgt) b.yaw -= SAIL_TURN * dt;
      // Throttle
      let target = 0;
      if (input.fwd) target = SAIL_SPEED;
      if (input.bkd) target = -SAIL_SPEED * 0.35;
      b.speed += (target - b.speed) * Math.min(1, 2.2 * dt);

      const fx = Math.sin(b.yaw);
      const fz = Math.cos(b.yaw);
      let nx = mesh.position.x + fx * b.speed * dt;
      let nz = mesh.position.z + fz * b.speed * dt;

      // Stay on sailable water; bounce back if inland
      if (!this.sea.isSailable(nx, nz)) {
        const sn = this.sea.snapWater(nx, nz);
        nx = sn.x;
        nz = sn.z;
        b.speed *= 0.4;
      }
      const y = this.sea.waterY + 0.12 + Math.sin(performance.now() * 0.002) * 0.08;
      mesh.position.set(nx, y, nz);
      mesh.rotation.y = b.yaw;
      mesh.rotation.z = Math.sin(performance.now() * 0.0015) * 0.04;
      mesh.rotation.x = Math.sin(performance.now() * 0.0011) * 0.03;

      // Sail cloth billow
      const sail = mesh.getObjectByName("sail-cloth");
      if (sail) sail.rotation.y = Math.sin(performance.now() * 0.003) * 0.12;

      // Parent player capsule to boat deck
      if (playerCapsule) {
        playerCapsule.position.set(nx, y + 1.35, nz);
        if (playerCapsule.rotation) playerCapsule.rotation.y = b.yaw;
      }
    },
  };
}
