/**
 * Character deploy helpers — grudge-character-correctness / characterDeploy SSOT.
 * Box3 feet ground · art-forward · pelvis XZ center · clip rematch.
 * Never use pelvis Y as feet. Never double art-forward yaw.
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
  // Unclamped unit decade (cm authored as m → ~180 "metres")
  if (size.y > 50) {
    root.scale.multiplyScalar(0.01);
    box = bodyBox(root);
    box.getSize(size);
  } else if (size.y < 0.05) {
    root.scale.multiplyScalar(100);
    box = bodyBox(root);
    box.getSize(size);
  }
  const s = targetH / size.y;
  root.scale.multiplyScalar(s);
  root.updateMatrixWorld(true);
  return s;
}

function findPelvis(root) {
  return (
    root.getObjectByName("Bip001 Pelvis") ||
    root.getObjectByName("Bip001_Pelvis") ||
    root.getObjectByName("Bip001") ||
    root.getObjectByName("mixamorig:Hips") ||
    root.getObjectByName("mixamorigHips") ||
    root.getObjectByName("Hips")
  );
}

/** Feet on groundY; center XZ on Bip001 Pelvis (NOT pelvis-as-feet). */
export function groundFeetAndCenterXZ(root, groundY = 0) {
  root.updateMatrixWorld(true);
  let box = bodyBox(root);
  root.position.y += groundY - box.min.y;

  const pelvis = findPelvis(root);
  if (pelvis) {
    const wp = new THREE.Vector3();
    pelvis.getWorldPosition(wp);
    const parent = root.parent;
    if (parent) {
      const local = parent.worldToLocal(wp.clone());
      root.position.x -= local.x;
      root.position.z -= local.z;
    } else {
      // Pelvis world offset from root origin → subtract once (no double-count)
      const ox = wp.x - root.position.x;
      const oz = wp.z - root.position.z;
      root.position.x -= ox;
      root.position.z -= oz;
    }
  } else {
    box = bodyBox(root);
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

/** Strip position (+scale) tracks from baked clips when binding to grounded kit. */
export function stripPositionTracks(clip) {
  if (!clip?.tracks) return clip;
  const tracks = clip.tracks.filter((t) => /\.quaternion$|\.rotation/.test(t.name));
  if (tracks.length === clip.tracks.length) return clip;
  return new THREE.AnimationClip(clip.name, clip.duration, tracks.length ? tracks : clip.tracks);
}

function normBone(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/mixamorig[:_]?/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Rematch clip track bone names to skeleton (spaces / underscores / mixamo).
 * Baked Bip001 clips use "Bip001 Pelvis.quaternion".
 */
export function rematchClipTracks(clip, root) {
  if (!clip?.tracks?.length || !root) return clip;
  const boneMap = new Map();
  root.traverse((o) => {
    if (o.isBone || o.type === "Bone" || o.name) {
      const n = normBone(o.name);
      if (n && !boneMap.has(n)) boneMap.set(n, o.name);
    }
  });
  // Prefer actual bones
  root.traverse((o) => {
    if (o.isBone) {
      const n = normBone(o.name);
      if (n) boneMap.set(n, o.name);
    }
  });

  let changed = false;
  const tracks = clip.tracks.map((t) => {
    const dot = t.name.lastIndexOf(".");
    if (dot < 0) return t;
    const bone = t.name.slice(0, dot);
    const prop = t.name.slice(dot + 1);
    const hit = boneMap.get(normBone(bone));
    if (!hit || hit === bone) return t;
    changed = true;
    const nt = t.clone();
    nt.name = `${hit}.${prop}`;
    return nt;
  });
  if (!changed) return clip;
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

/**
 * After idle/attack sample: re-ground feet (kills hip-float from residual tracks).
 */
export function reGroundAfterAnimSample(root, groundY = 0) {
  root.updateMatrixWorld(true);
  const box = bodyBox(root);
  if (!Number.isFinite(box.min.y)) return;
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
  const pelvis = findPelvis(root);
  if (!pelvis) errors.push("no Bip001 Pelvis");
  return { ok: errors.length === 0, errors, height, feetMinY, artForward: !!root.userData?.artForwardSet };
}

/**
 * Full deploy order for Multiverse grudge6 kits.
 */
export function deployGrudge6Model(model, opts = {}) {
  fitToHuman(model, opts.targetH ?? HUMAN_HEIGHT_M);
  if (opts.facePlusZ !== false) applyArtForwardPlusZ(model);
  groundFeetAndCenterXZ(model, opts.groundY ?? 0);
  return diagnoseCharacterLook(model, opts.groundY ?? 0);
}
