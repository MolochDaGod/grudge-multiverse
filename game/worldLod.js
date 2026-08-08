/**
 * Large-scale world LOD — distance bands for 5 km seed realms.
 * Best practice: do not simulate every NPC/raider every frame at multi-km range.
 *
 * Tiers (SI metres from player) — tuned for WORLD_SIZE 5000:
 *   near   0–150    full AI + full mesh
 *   mid    150–450  AI every 3 frames
 *   far    450–1200 visible only (no AI)
 *   cull   >1200    hidden
 */
import * as THREE from "three";

export const LOD_BANDS = {
  near: 150,
  mid: 450,
  far: 1200,
};

/**
 * Adaptive nav cell size for large maps (metres).
 * 5 km realm → 16–20 m cells (~250–312 per axis).
 */
export function adaptiveNavCellSize(landRadius, halfW) {
  const span = Math.max(landRadius || 0, halfW || 0) * 2;
  if (span >= 4500) return 20;
  if (span > 2500) return 16;
  if (span > 1400) return 12;
  if (span > 900) return 8;
  if (span > 500) return 6;
  return 5;
}

/**
 * Tag island meshes for render LOD: keep LOD0 terrain walkable, cull far props.
 */
export function applyMeshTerrainLod(root) {
  if (!root) return { terrain: 0, lod0: 0, lodFar: 0 };
  let terrain = 0;
  let lod0 = 0;
  let lodFar = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = true;
    const n = o.name || "";
    const kind = o.userData?.worldKind;
    if (kind === "terrain" || /Main_Large_Terrain|terrain|ground/i.test(n)) {
      terrain++;
      o.userData.renderLod = "always";
      // Terrain always draws (nav/ground depend on it visually)
      return;
    }
    if (/LOD0|_LOD0|lod0/i.test(n)) {
      lod0++;
      o.userData.renderLod = "near";
      return;
    }
    if (/LOD[12]|_LOD1|_LOD2/i.test(n)) {
      lodFar++;
      o.userData.renderLod = "far";
      // Higher LODs: only show when camera is distant (inverted later)
      return;
    }
    if (kind === "building") {
      o.userData.renderLod = "mid";
      return;
    }
    if (kind === "prop" || kind === "tree" || kind === "rock") {
      o.userData.renderLod = "near";
      return;
    }
    o.userData.renderLod = "mid";
  });
  console.info(
    `[worldLod] mesh tags terrain=${terrain} lod0=${lod0} lodFar=${lodFar}`,
  );
  return { terrain, lod0, lodFar };
}

/**
 * Per-frame / throttled: show/hide meshes by camera distance to island origin bands.
 * @param {THREE.Object3D} root
 * @param {THREE.Vector3} camPos
 */
export function updateMeshTerrainLod(root, camPos) {
  if (!root || !camPos) return;
  const dist = Math.hypot(camPos.x - root.position.x, camPos.z - root.position.z);
  root.traverse((o) => {
    if (!o.isMesh) return;
    const lod = o.userData?.renderLod;
    if (!lod || lod === "always") {
      o.visible = true;
      return;
    }
    if (lod === "near") {
      // Detail props: hide when camera far
      o.visible = dist < LOD_BANDS.far;
      return;
    }
    if (lod === "mid") {
      o.visible = dist < LOD_BANDS.far * 1.2;
      return;
    }
    if (lod === "far") {
      // Low-res LOD meshes: only when distant (save overdraw near)
      o.visible = dist >= LOD_BANDS.mid;
    }
  });
}

/**
 * Create LOD controller for realm actors (NPCs, raiders, animals, flags).
 */
export function createActorLod(actors) {
  let frame = 0;
  return {
    /**
     * @param {THREE.Vector3} playerPos
     * @param {(actor: object, step: boolean)=>void} [onActive] if step true, run AI
     */
    update(playerPos, onActive) {
      frame++;
      if (!playerPos || !actors) return;
      for (const a of actors) {
        if (!a.mesh) continue;
        if (a.alive === false) {
          a.mesh.visible = false;
          a.lod = "dead";
          continue;
        }
        const d = Math.hypot(
          playerPos.x - a.mesh.position.x,
          playerPos.z - a.mesh.position.z,
        );
        if (d > LOD_BANDS.far) {
          a.mesh.visible = false;
          a.lod = "cull";
          continue;
        }
        a.mesh.visible = true;
        if (d <= LOD_BANDS.near) {
          a.lod = "near";
          onActive?.(a, true);
        } else if (d <= LOD_BANDS.mid) {
          a.lod = "mid";
          // Update AI every 3rd frame
          onActive?.(a, frame % 3 === 0);
        } else {
          a.lod = "far";
          // No AI, just keep visible (flag/body)
          onActive?.(a, false);
        }
      }
    },
  };
}
