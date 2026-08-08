/**
 * Expand Multiverse play space to seed world size (default 5 km × 5 km SI).
 * Bermuda GLB stays at hub; ocean + FBM pads + nav cover the full seed disc.
 *
 * Terrain practices: Simon infinite FBM (seedTerrain) · three.js Water · Rapier heightfields
 */
import * as THREE from "three";
import { buildNavGrid, COLLIDER_LAYER } from "./mapLiteracy.js";
import { adaptiveNavCellSize } from "./worldLod.js";
import {
  WORLD_SIZE_M,
  WORLD_HALF_M,
  WORLD_RADIUS_M,
  DEFAULT_LAND_RADIUS_M,
} from "./worldSeedGen.js";
import { mountSeedTerrains, sampleSeedTerrainHeight } from "./seedTerrain.js";

/**
 * After Bermuda load, expand water + rebuild nav for 5 km seed realm.
 * Optional `world` supplies faction island discs as walkable land.
 *
 * @param {object} island from loadBermudaIsland
 * @param {THREE.Scene} scene
 * @param {{ worldSizeM?: number, worldRadiusM?: number, world?: object, seed?: string }} [opts]
 */
export function expandIslandToSeedWorld(island, scene, opts = {}) {
  const worldSize = opts.worldSizeM || WORLD_SIZE_M;
  const worldHalf = worldSize / 2;
  const worldRadius = opts.worldRadiusM || DEFAULT_LAND_RADIUS_M || WORLD_RADIUS_M;
  const waterY = island.waterY ?? 0.25;
  // Preserve mesh island radius before we overwrite landRadius
  const meshLandR =
    island.meshLandRadius || island.landRadius || island.halfW * 0.85 || 400;

  // Faction island discs from seed (walkable pads)
  const landDiscs = [{ x: 0, z: 0, r: Math.max(meshLandR, island.hubRadius || 340) }];
  for (const z0 of opts.world?.zones || []) {
    if (z0.kind === "territory" && z0.x != null && z0.radius) {
      landDiscs.push({ x: z0.x, z: z0.z, r: z0.radius });
    }
  }
  // Hub always
  if (opts.world?.hubRadius) {
    landDiscs[0].r = Math.max(landDiscs[0].r, opts.world.hubRadius);
  }

  // Large ocean disc (5 km realm) — visual until three.js Water mounts
  if (island.waterGroup) {
    const waterSize = Math.max(worldRadius * 2.2, worldHalf * 1.05);
    island.waterGroup.traverse((o) => {
      if (!o.isMesh) return;
      if (o.name === "water-surface") {
        o.geometry?.dispose?.();
        o.geometry = new THREE.CircleGeometry(waterSize, 96);
      } else if (o.name === "water-deep") {
        o.geometry?.dispose?.();
        o.geometry = new THREE.PlaneGeometry(waterSize * 3, waterSize * 3);
      }
    });
  }

  const meshSample = island.sampleY;
  island.landDiscs = landDiscs;
  island.meshLandRadius = meshLandR;
  island.worldSizeM = worldSize;
  island.worldHalfM = worldHalf;
  island.worldRadiusM = worldRadius;

  // Simon-style FBM terrain meshes on faction discs (before nav bake)
  mountSeedTerrains(scene, island, {
    seed: opts.seed || opts.world?.seed || "VALHEIM42",
    world: opts.world,
  });

  // sampleY already composed by mountSeedTerrains; ensure hub mesh + FBM + sea
  const fbmSample = island.sampleY;
  const sampleY = (x, z) => {
    const d0 = Math.hypot(x, z);
    if (d0 <= meshLandR * 1.02 && meshSample) {
      try {
        const y = meshSample(x, z);
        if (Number.isFinite(y) && y > waterY + 0.2) return y;
      } catch {
        /* fall through */
      }
    }
    if (fbmSample && fbmSample !== meshSample) {
      try {
        const y = fbmSample(x, z);
        if (Number.isFinite(y)) return y;
      } catch {
        /* */
      }
    }
    // last resort dome
    for (const disc of landDiscs) {
      if (Math.hypot(x - disc.x, z - disc.z) <= disc.r) {
        return sampleSeedTerrainHeight(
          x,
          z,
          island.seedTerrains?.seedU32 || 1,
          disc,
          waterY,
        );
      }
    }
    return waterY;
  };

  const bounds = new THREE.Box3(
    new THREE.Vector3(-worldHalf, waterY - 20, -worldHalf),
    new THREE.Vector3(worldHalf, waterY + 120, worldHalf),
  );
  const cellSize = adaptiveNavCellSize(worldRadius, worldHalf);
  const nav = buildNavGrid(
    {
      bounds,
      halfW: worldHalf,
      hubRadius: landDiscs[0].r,
      meshLandRadius: meshLandR,
      scale: 1,
      waterY,
      landRadius: worldRadius,
      landDiscs,
    },
    sampleY,
    {
      cellSize,
      waterY,
      landRadius: worldRadius,
      landDiscs,
      // Rolling FBM hills — dy/m from adaptive formula in buildNavGrid
    },
  );

  island.sampleY = sampleY;
  island.nav = nav;
  island.landRadius = worldRadius;
  island.halfW = Math.max(island.halfW || 0, worldHalf);
  island.bounds = bounds;
  island.navCellSize = cellSize;
  island.units = "si_metres";
  island.seedWorld = true;
  island.landDiscs = landDiscs;
  island.meshLandRadius = meshLandR;

  // Rebuild spawns AFTER expanded nav (Bermuda-only spawns from load are stale)
  const hubR = island.hubRadius || landDiscs[0].r * 0.35 || 120;
  const landPts = nav.pickLandSpawns(16, hubR);
  island.spawns = landPts.map(
    (p) => new THREE.Vector3(p.x, p.y, p.z),
  );
  // Snap bosses/vendors onto post-expand nav if present
  for (const b of island.bossPads || []) {
    const sn = nav.snap(b.position.x, b.position.z);
    b.position.set(sn.x, sn.y + 0.1, sn.z);
  }
  for (const v of island.vendorPads || []) {
    const sn = nav.snap(v.position.x, v.position.z);
    v.position.set(sn.x, sn.y + 0.05, sn.z);
  }

  if (island.waterPhysics) {
    island.waterPhysics.landRadius = worldRadius;
    island.waterPhysics.surfaceY = waterY;
  }

  const walkN = nav.walkCount ?? nav.cells?.filter?.((c) => c.walkable).length ?? 0;
  const hubWalk = (nav.cells || []).filter(
    (c) => c.walkable && Math.hypot(c.x, c.z) <= meshLandR * 0.95,
  ).length;
  island.seedReady = {
    ok: walkN >= 80 && island.spawns.length >= 1 && hubWalk >= 20,
    walkable: walkN,
    hubWalkable: hubWalk,
    spawns: island.spawns.length,
    discs: landDiscs.length,
    fbmMeshes: island.seedTerrains?.meshes?.length || 0,
    navCell: cellSize,
    worldSizeM: worldSize,
    seed: opts.seed || opts.world?.seed || null,
  };

  console.info(
    `[worldSpace] 5×5 km seed ready=${island.seedReady.ok} walk=${walkN} hubWalk=${hubWalk} spawns=${island.spawns.length} size=${worldSize}m cell=${cellSize}m discs=${landDiscs.length} fbm=${island.seedReady.fbmMeshes}`,
  );

  return island;
}

/**
 * Player-ready map gate — fail-closed if nav/spawn broken.
 * @param {object} island
 * @returns {{ ok: boolean, reasons: string[], seedReady: object }}
 */
export function assertMapSeedReady(island) {
  const reasons = [];
  const sr = island?.seedReady || {};
  if (!island?.nav) reasons.push("no_navmesh");
  if (!island?.sampleY) reasons.push("no_sampleY");
  if ((sr.walkable ?? 0) < 80) reasons.push(`walkable_low:${sr.walkable ?? 0}`);
  if ((sr.hubWalkable ?? 0) < 12) reasons.push(`hub_walkable_low:${sr.hubWalkable ?? 0}`);
  if (!(island?.spawns?.length > 0)) reasons.push("no_land_spawns");
  if (!island?.seedWorld) reasons.push("not_seed_world");
  if (island?.units !== "si_metres") reasons.push("units_not_si");
  return {
    ok: reasons.length === 0,
    reasons,
    seedReady: sr,
  };
}

/**
 * Place a walkable footing pad under a seed site (faction island / dock).
 * @returns {THREE.Mesh}
 */
export function addSettlementFooting(scene, x, z, radius, y, color = 0x3a4a3a) {
  const r = Math.max(8, radius || 20);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r * 1.05, 1.2, 24),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.9,
      metalness: 0.05,
    }),
  );
  mesh.position.set(x, y - 0.4, z);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.name = "seed-footing";
  mesh.userData.worldKind = "terrain";
  mesh.userData.colliderLayer = COLLIDER_LAYER.WALKABLE;
  mesh.userData.walkable = true;
  mesh.userData.seedFooting = true;
  scene.add(mesh);
  return mesh;
}

/**
 * Ground height for seed content: mesh if available, else footing/ocean.
 */
export function seedGroundAt(island, x, z, footingY = null) {
  const meshR = island.meshLandRadius || island.landRadius || 400;
  const d = Math.hypot(x, z);
  if (d <= meshR * 1.02 && island.sampleY) {
    try {
      const y = island.sampleY(x, z);
      if (Number.isFinite(y) && y > (island.waterY || 0) + 0.25) return y;
    } catch {
      /* */
    }
  }
  if (Number.isFinite(footingY)) return footingY;
  // Slight island rise above water for off-mesh pads
  return (island.waterY || 0) + 1.2;
}
