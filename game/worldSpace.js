/**
 * Expand Multiverse play space to seed world size (default 5 km × 5 km SI).
 * Bermuda GLB stays at hub; ocean + nav cover the full seed disc.
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

/**
 * After Bermuda load, expand water + rebuild nav for 5 km seed realm.
 * Optional `world` supplies faction island discs as walkable land.
 *
 * @param {object} island from loadBermudaIsland
 * @param {THREE.Scene} scene
 * @param {{ worldSizeM?: number, worldRadiusM?: number, world?: object }} [opts]
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

  // Large ocean disc (5 km realm)
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
  const inLandDisc = (x, z) => {
    for (const d of landDiscs) {
      if (Math.hypot(x - d.x, z - d.z) <= d.r) return d;
    }
    return null;
  };

  // Sample: Bermuda mesh on hub disc; raised pad on faction islands; else sea
  const sampleY = (x, z) => {
    const disc = inLandDisc(x, z);
    const d0 = Math.hypot(x, z);
    if (d0 <= meshLandR * 1.02 && meshSample) {
      try {
        const y = meshSample(x, z);
        if (Number.isFinite(y) && y > waterY + 0.2) return y;
      } catch {
        /* fall through */
      }
    }
    if (disc) {
      // Procedural island height (gentle dome)
      const t = 1 - Math.hypot(x - disc.x, z - disc.z) / Math.max(1, disc.r);
      return waterY + 1.0 + Math.max(0, t) * 8;
    }
    return waterY;
  };

  const bounds = new THREE.Box3(
    new THREE.Vector3(-worldHalf, waterY - 20, -worldHalf),
    new THREE.Vector3(worldHalf, waterY + 120, worldHalf),
  );
  const cellSize = adaptiveNavCellSize(worldRadius, worldHalf);
  // landRadius for grid: use worldRadius so cells exist across disc;
  // walkable via height > water (island domes + Bermuda)
  const nav = buildNavGrid(
    {
      bounds,
      halfW: worldHalf,
      hubRadius: landDiscs[0].r,
      scale: 1,
      waterY,
      landRadius: worldRadius,
    },
    sampleY,
    { cellSize, waterY, landRadius: worldRadius, maxSlope: 1.4 },
  );

  island.worldSizeM = worldSize;
  island.worldHalfM = worldHalf;
  island.worldRadiusM = worldRadius;
  island.meshLandRadius = meshLandR;
  island.sampleY = sampleY;
  island.nav = nav;
  island.landRadius = worldRadius;
  island.halfW = Math.max(island.halfW || 0, worldHalf);
  island.bounds = bounds;
  island.navCellSize = cellSize;
  island.units = "si_metres";
  island.seedWorld = true;
  island.landDiscs = landDiscs;

  if (island.waterPhysics) {
    island.waterPhysics.landRadius = worldRadius;
    island.waterPhysics.surfaceY = waterY;
  }

  console.info(
    `[worldSpace] 5×5 km seed size=${worldSize}m radius=${worldRadius}m navCell=${cellSize}m meshLandR=${meshLandR.toFixed(0)}m discs=${landDiscs.length}`,
  );

  return island;
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
