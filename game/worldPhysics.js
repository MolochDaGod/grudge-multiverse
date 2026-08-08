/**
 * Multiverse world physics — Rapier best practice
 * https://threejs.org/docs/#examples/en/physics/RapierPhysics
 *
 * Uses local @dimforge/rapier3d-compat (fleet SSOT), not Skypack CDN.
 * Static heightfields for seed terrain discs + optional rock cuboids.
 * Player controller remains three-mesh-bvh / existing path — this is world solids.
 */
import * as THREE from "three";

/**
 * @returns {Promise<{
 *   RAPIER: any,
 *   world: any,
 *   eventQueue: any,
 *   addHeightfieldFromMesh: Function,
 *   addStaticBox: Function,
 *   step: Function,
 *   dispose: Function,
 * } | null>}
 */
export async function createWorldPhysics(opts = {}) {
  let RAPIER;
  try {
    RAPIER = await import("@dimforge/rapier3d-compat");
    if (typeof RAPIER.init === "function") {
      await RAPIER.init();
    }
  } catch (e) {
    console.warn("[worldPhysics] rapier init failed", e);
    return null;
  }

  const gravity = opts.gravity || { x: 0, y: -9.81, z: 0 };
  const world = new RAPIER.World(gravity);
  const eventQueue = new RAPIER.EventQueue(true);
  const bodies = [];

  /**
   * Sample mesh Y grid → Rapier heightfield (SI).
   * @param {THREE.Mesh} mesh seed terrain plane
   * @param {{ nrows?: number, ncols?: number }} [hfOpts]
   */
  function addHeightfieldFromMesh(mesh, hfOpts = {}) {
    if (!mesh?.geometry) return null;
    const box = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    box.getSize(size);
    const nrows = hfOpts.nrows || 48;
    const ncols = hfOpts.ncols || 48;
    const heights = new Float32Array((nrows + 1) * (ncols + 1));
    const ray = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0);
    const origin = new THREE.Vector3();
    mesh.updateWorldMatrix(true, true);

    for (let j = 0; j <= nrows; j++) {
      for (let i = 0; i <= ncols; i++) {
        const u = i / ncols;
        const v = j / nrows;
        const x = box.min.x + u * size.x;
        const z = box.min.z + v * size.z;
        origin.set(x, box.max.y + 50, z);
        ray.set(origin, down);
        const hits = ray.intersectObject(mesh, true);
        const y = hits[0]?.point.y ?? box.min.y;
        heights[j * (ncols + 1) + i] = y;
      }
    }

    // Rapier heightfield: scale xz span; heights are absolute Y — shift so min is 0
    let minH = Infinity;
    let maxH = -Infinity;
    for (let k = 0; k < heights.length; k++) {
      minH = Math.min(minH, heights[k]);
      maxH = Math.max(maxH, heights[k]);
    }
    const rel = new Float32Array(heights.length);
    for (let k = 0; k < heights.length; k++) rel[k] = heights[k] - minH;

    const scale = new RAPIER.Vector3(size.x, 1, size.z);
    const desc = RAPIER.ColliderDesc.heightfield(nrows, ncols, rel, scale);
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
      box.min.x + size.x * 0.5,
      minH,
      box.min.z + size.z * 0.5,
    );
    const body = world.createRigidBody(bodyDesc);
    world.createCollider(desc, body);
    bodies.push(body);
    return body;
  }

  function addStaticBox(cx, cy, cz, hx, hy, hz) {
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(cx, cy, cz),
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, hy, hz),
      body,
    );
    bodies.push(body);
    return body;
  }

  /** Fixed 1/60 step (fleet Rapier SSOT). */
  function step(dt) {
    world.timestep = Math.min(0.05, dt || 1 / 60);
    world.step(eventQueue);
  }

  function dispose() {
    try {
      world.free();
    } catch {
      /* */
    }
  }

  console.info("[worldPhysics] Rapier world ready (local compat)");
  return {
    RAPIER,
    world,
    eventQueue,
    bodies,
    addHeightfieldFromMesh,
    addStaticBox,
    step,
    dispose,
  };
}

/**
 * Wire seed terrain meshes + buried rocks into Rapier.
 */
export async function mountWorldPhysics(island, opts = {}) {
  const phys = await createWorldPhysics(opts);
  if (!phys) return null;

  const terrains = island.seedTerrains?.meshes || [];
  for (const m of terrains) {
    try {
      phys.addHeightfieldFromMesh(m, { nrows: 40, ncols: 40 });
    } catch (e) {
      console.warn("[worldPhysics] heightfield", e);
    }
  }

  // Large buried rocks as approximate cuboids
  if (opts.harvestNodes) {
    for (const n of opts.harvestNodes) {
      if (n.kind !== "rock" || !n.valheimRock) continue;
      const h = n.siHeight || 20;
      const bury = n.buryFrac ?? 0.4;
      const exposed = h * (1 - bury);
      const p = n.position || n.object?.position;
      if (!p) continue;
      phys.addStaticBox(
        p.x,
        (n.groundY || p.y) + exposed * 0.35,
        p.z,
        h * 0.28,
        exposed * 0.4,
        h * 0.28,
      );
    }
  }

  island.worldPhysics = phys;
  return phys;
}
