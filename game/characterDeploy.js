/**
 * Character deploy helpers — cloned from grudge-character-correctness / characterDeploy SSOT.
 * Box3 feet ground · art-forward · pelvis XZ center. No reinvented pipeline.
 */
import * as THREE from "three";

export const HUMAN_HEIGHT_M = 1.8;

/** Visible skinned body only (ignore hidden wardrobe). */
export function bodyBox(root) {
  const box = new THREE.Box3();
  let any = false;
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isSkinnedMesh || !o.visible) return;
    if (!any) {
      box.setFromObject(o, true);
      any = true;
    } else box.expandByObject(o);
  });
  if (!any) box.setFromObject(root, true);
  return box;
}

export function fitToHuman(root, targetH = HUMAN_HEIGHT_M) {
  let box = bodyBox(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.y < 1e-4) return 1;
  if (size.y > 50) {
    root.scale.multiplyScalar(0.01);
    box = bodyBox(root);
    box.getSize(size);
  }
  const s = targetH / size.y;
  root.scale.multiplyScalar(s);
  return s;
}

/** Feet on groundY; optional center XZ on Bip001 Pelvis. */
export function groundFeetAndCenterXZ(root, groundY = 0) {
  root.updateMatrixWorld(true);
  let box = bodyBox(root);
  root.position.y += groundY - box.min.y;

  const pelvis =
    root.getObjectByName("Bip001 Pelvis") ||
    root.getObjectByName("Bip001") ||
    root.getObjectByName("mixamorig:Hips") ||
    root.getObjectByName("mixamorigHips");
  if (pelvis) {
    const wp = new THREE.Vector3();
    pelvis.getWorldPosition(wp);
    const parent = root.parent;
    if (parent) {
      const local = parent.worldToLocal(wp.clone());
      root.position.x -= local.x;
      root.position.z -= local.z;
    } else {
      root.position.x -= wp.x - root.position.x;
      root.position.z -= wp.z - root.position.z;
    }
  } else {
    const c = box.getCenter(new THREE.Vector3());
    root.position.x -= c.x - root.position.x;
    root.position.z -= c.z - root.position.z;
  }
  root.updateMatrixWorld(true);
  box = bodyBox(root);
  root.position.y += groundY - box.min.y;
}

/**
 * Toon RTS FBX art faces +X; controller walks +Z → yaw +π/2 once on model.
 * Idempotent via userData flag.
 */
export function applyArtForwardPlusZ(model) {
  if (!model || model.userData.artForwardSet) return;
  model.rotation.y = Math.PI / 2;
  model.userData.artForwardSet = true;
}

/** Strip position tracks from baked clips when binding to grounded kit. */
export function stripPositionTracks(clip) {
  if (!clip?.tracks) return clip;
  const tracks = clip.tracks.filter((t) => /\.quaternion$|\.rotation/.test(t.name));
  if (tracks.length === clip.tracks.length) return clip;
  return new THREE.AnimationClip(clip.name, clip.duration, tracks.length ? tracks : clip.tracks);
}

/**
 * After idle/attack sample: re-ground feet (kills hip-float from residual tracks).
 */
export function reGroundAfterAnimSample(root, groundY = 0) {
  root.updateMatrixWorld(true);
  const box = bodyBox(root);
  root.position.y += groundY - box.min.y;
}

/**
 * Diagnose look — returns { ok, errors, height, feetMinY }.
 */
export function diagnoseCharacterLook(root, groundY = 0) {
  const errors = [];
  const box = bodyBox(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const height = size.y;
  const feetMinY = box.min.y;
  if (height < 1.55 || height > 2.05) errors.push(`height ${height.toFixed(2)} not in 1.55–2.05`);
  if (Math.abs(feetMinY - groundY) > 0.12) errors.push(`feet minY ${feetMinY.toFixed(3)} off ground`);
  const pelvis = root.getObjectByName("Bip001 Pelvis") || root.getObjectByName("Bip001");
  if (!pelvis) errors.push("no Bip001 Pelvis");
  return { ok: errors.length === 0, errors, height, feetMinY };
}

/**
 * Full deploy order for Multiverse grudge6 kits.
 */
export function deployGrudge6Model(model, opts = {}) {
  fitToHuman(model, opts.targetH ?? HUMAN_HEIGHT_M);
  applyArtForwardPlusZ(model);
  groundFeetAndCenterXZ(model, opts.groundY ?? 0);
  return diagnoseCharacterLook(model, opts.groundY ?? 0);
}
