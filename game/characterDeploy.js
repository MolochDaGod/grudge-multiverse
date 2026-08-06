/**
 * Character deploy — grudge-character-correctness SSOT.
 *
 * Production grudge6 race GLBs on CDN still ship with modular mesh scales
 * (~2.6) so equipped height measures ~12–22 m, NOT 1.8 m SI.
 * Map (bermuda) is already SI metres (~843 m, buildings ~5–10 m).
 *
 * Rule: ONE uniform scale on the kit root so the hero is human-yardstick.
 * Never non-uniform stretch. Never race-special scale hacks. Orc uses same path.
 * Ground feet via Box3 min.y — never pelvis-as-feet.
 */
import * as THREE from "three";

export const HUMAN_HEIGHT_M = 1.8;
/** Accept band after unit normalize (all races, same path — orc is just tall in mesh). */
export const HEIGHT_BAND_MIN = 1.55;
export const HEIGHT_BAND_MAX = 2.15;

/**
 * Bone-driven structural AABB for modular grudge6 kits.
 * Unskinned SkinnedMesh geo is near origin — setFromObject under-measures
 * and produces wrong SI fit (exploded / tiny heroes). Prefer bones.
 */
export function measureBoneStructuralBBox(root) {
  if (!root) return null;
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (o.isSkinnedMesh && o.skeleton) o.skeleton.update();
  });
  const groups = [
    ["Bip001 Head", "Bip001_Head", "Head"],
    ["Bip001 HeadNub", "Bip001_HeadNub"],
    ["Bip001 Pelvis", "Bip001_Pelvis", "Pelvis"],
    ["Bip001 L Foot", "Bip001_L_Foot"],
    ["Bip001 R Foot", "Bip001_R_Foot"],
    ["Bip001 L Toe0", "Bip001_L_Toe0"],
    ["Bip001 R Toe0", "Bip001_R_Toe0"],
    ["Bip001 L Hand", "Bip001_L_Hand"],
    ["Bip001 R Hand", "Bip001_R_Hand"],
  ];
  const box = new THREE.Box3();
  let n = 0;
  const p = new THREE.Vector3();
  for (const names of groups) {
    let bone = null;
    for (const name of names) {
      bone = root.getObjectByName(name);
      if (bone) break;
    }
    if (!bone) continue;
    bone.getWorldPosition(p);
    if (!Number.isFinite(p.x + p.y + p.z)) continue;
    if (n === 0) {
      box.min.copy(p);
      box.max.copy(p);
    } else box.expandByPoint(p);
    n++;
  }
  if (n < 2) return null;
  const h = Math.max(box.max.y - box.min.y, 1e-4);
  const pad = Math.max(h * 0.1, 0.05);
  box.min.y -= pad * 0.55;
  box.max.y += pad * 0.45;
  return box;
}

/**
 * Skinned body AABB for height/feet.
 * @param {boolean} [visibleOnly=false] — NEVER use true for deploy scale (mesh_ids
 * hide most meshes first and would measure a sword as "height").
 */
export function bodyBox(root, visibleOnly = false) {
  // Prefer bone measure (correct for modular Toon RTS skinned kits)
  if (!visibleOnly) {
    const boneBox = measureBoneStructuralBBox(root);
    if (boneBox) return boneBox;
  }

  const box = new THREE.Box3();
  let any = false;
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    if (visibleOnly && !o.visible) return;
    // Skip pure weapon/shield parts when measuring human height
    if (!visibleOnly && /weapon|shield|quiver|bag|xtra/i.test(o.name || "")) return;
    const b = new THREE.Box3().setFromObject(o, true);
    if (b.isEmpty()) return;
    if (!any) {
      box.copy(b);
      any = true;
    } else box.union(b);
  });
  if (!any) {
    root.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      const b = new THREE.Box3().setFromObject(o, true);
      if (b.isEmpty()) return;
      if (!any) {
        box.copy(b);
        any = true;
      } else box.union(b);
    });
  }
  if (!any) box.setFromObject(root, true);
  return box;
}

export function measureHeight(root) {
  const size = new THREE.Vector3();
  bodyBox(root).getSize(size);
  return size.y;
}

/**
 * Uniform unit normalize only.
 * - Already SI (1.55–2.15 m): leave scale alone (baked as-is).
 * - Classic 100× (height 50–400): ×0.01 once, then residual fit if needed.
 * - Toon RTS leftover (~8–40 m from mesh.scale≈2.6): one uniform fit to target.
 * Never non-uniform. Same path for every race including orc.
 */
export function fitToHuman(root, targetH = HUMAN_HEIGHT_M) {
  root.updateMatrixWorld(true);
  let h = measureHeight(root);
  if (h < 1e-4) return 1;

  let factor = 1;

  // Classic cm-as-m decade
  if (h > 50) {
    root.scale.multiplyScalar(0.01);
    root.updateMatrixWorld(true);
    h = measureHeight(root);
    factor *= 0.01;
  } else if (h < 0.05) {
    root.scale.multiplyScalar(100);
    root.updateMatrixWorld(true);
    h = measureHeight(root);
    factor *= 100;
  }

  // Already in human band — keep bake, no further scale
  if (h >= HEIGHT_BAND_MIN && h <= HEIGHT_BAND_MAX) {
    root.userData.deployScaleFactor = factor;
    root.userData.deployHeightM = h;
    return factor;
  }

  // One uniform residual fit (proportions unchanged)
  if (h > 1e-4) {
    const s = targetH / h;
    root.scale.multiplyScalar(s);
    factor *= s;
    root.updateMatrixWorld(true);
    h = measureHeight(root);
  }

  root.userData.deployScaleFactor = factor;
  root.userData.deployHeightM = h;
  return factor;
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
      // Shift root so pelvis world XZ → 0
      root.position.x -= wp.x;
      root.position.z -= wp.z;
    }
  }
  root.updateMatrixWorld(true);
  box = bodyBox(root);
  root.position.y += groundY - box.min.y;
}

/** Toon RTS art faces +X → local +Z once. */
export function applyArtForwardPlusZ(model) {
  if (!model || model.userData.artForwardSet) return;
  model.rotation.y = Math.PI / 2;
  model.userData.artForwardSet = true;
}

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

export function rematchClipTracks(clip, root) {
  if (!clip?.tracks?.length || !root) return clip;
  const boneMap = new Map();
  root.traverse((o) => {
    if (o.isBone) {
      const n = normBone(o.name);
      if (n) boneMap.set(n, o.name);
    }
  });
  if (boneMap.size === 0) {
    root.traverse((o) => {
      const n = normBone(o.name);
      if (n && !boneMap.has(n)) boneMap.set(n, o.name);
    });
  }

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

export function reGroundAfterAnimSample(root, groundY = 0) {
  root.updateMatrixWorld(true);
  const box = bodyBox(root);
  if (!Number.isFinite(box.min.y)) return;
  root.position.y += groundY - box.min.y;
}

export function diagnoseCharacterLook(root, groundY = 0) {
  const errors = [];
  const box = bodyBox(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const height = size.y;
  const feetMinY = box.min.y;
  if (height < HEIGHT_BAND_MIN || height > HEIGHT_BAND_MAX) {
    errors.push(`height ${height.toFixed(2)} not in ${HEIGHT_BAND_MIN}–${HEIGHT_BAND_MAX}`);
  }
  if (Math.abs(feetMinY - groundY) > 0.12) {
    errors.push(`feet minY ${feetMinY.toFixed(3)} off ground`);
  }
  if (!findPelvis(root)) errors.push("no Bip001 Pelvis");
  return {
    ok: errors.length === 0,
    errors,
    height,
    feetMinY,
    scaleFactor: root.userData.deployScaleFactor ?? 1,
    artForward: !!root.userData.artForwardSet,
  };
}

/**
 * Full deploy: pose skeletons → uniform unit normalize → art-forward → feet ground.
 * Same for WK / ELF / ORC / UD / BRB / DWF — no special orc path.
 */
export function deployGrudge6Model(model, opts = {}) {
  model.traverse((o) => {
    if (o.isSkinnedMesh && o.skeleton) {
      o.skeleton.pose();
      o.skeleton.update();
    }
  });
  model.updateMatrixWorld(true);

  const beforeH = measureHeight(model);
  fitToHuman(model, opts.targetH ?? HUMAN_HEIGHT_M);
  if (opts.facePlusZ !== false) applyArtForwardPlusZ(model);
  groundFeetAndCenterXZ(model, opts.groundY ?? 0);
  const diag = diagnoseCharacterLook(model, opts.groundY ?? 0);
  diag.beforeHeight = beforeH;
  console.info(
    `[characterDeploy] before=${beforeH.toFixed(2)}m → after=${diag.height?.toFixed(2)}m ` +
      `factor×${(diag.scaleFactor ?? 1).toFixed(4)} feet=${diag.feetMinY?.toFixed(3)} ` +
      (diag.ok ? "OK" : diag.errors.join("; ")),
  );
  return diag;
}
