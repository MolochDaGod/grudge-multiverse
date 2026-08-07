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
  // Rotation-only: drop .position / .scale (hip-float + head-at-origin killers)
  const tracks = clip.tracks.filter(
    (t) => !/\.position$|\.scale$/.test(t.name) && /\.quaternion$|\.rotation/.test(t.name),
  );
  if (!tracks.length) {
    const rotish = clip.tracks.filter((t) => !/\.position$|\.scale$/.test(t.name));
    return new THREE.AnimationClip(clip.name, clip.duration, rotish.length ? rotish : clip.tracks);
  }
  if (tracks.length === clip.tracks.length) return clip;
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

/** Core Bip001 bones a production Toon kit + idle clip must drive. */
export const CORE_BIP001_BONES = [
  "Bip001 Pelvis",
  "Bip001 Spine",
  "Bip001 Neck",
  "Bip001 Head",
  "Bip001 L UpperArm",
  "Bip001 R UpperArm",
  "Bip001 L Thigh",
  "Bip001 R Thigh",
];

/** Alnum-only bone key: "Bip001 L UpperArm" / "Bip001_L_UpperArm" → bip001lupperarm */
export function normalizeBoneKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/^mixamorig\d*:/i, "")
    .replace(/mixamorig[:_]?/gi, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Bone-only name lookup for Bip001 rematch.
 *
 * HARD (head-between-feet fix):
 *  - Index only Bone nodes (+ hand containers) — NEVER skinned meshes
 *  - Never bind tracks to mesh names like "WK_Units_head_A"
 *  - Drop tracks for bones that do not exist (Spine1/Spine2 on many Toon kits)
 */
export function buildBoneNameLookup(root) {
  const lookup = new Map();
  const actualByKey = new Map();

  root.traverse((node) => {
    const isBone = node.isBone === true || node.type === "Bone";
    const name = node.name || "";
    if (!name) return;
    if (
      !isBone &&
      !/bip001|mixamo|container|hand|pelvis|spine|hips/i.test(name)
    ) {
      return;
    }
    // Never treat skinned mesh body parts as anim targets
    if (!isBone && (node.isMesh || node.isSkinnedMesh)) return;

    lookup.set(name, name);
    const key = normalizeBoneKey(name);
    lookup.set(key, name);
    if (isBone) actualByKey.set(key, name);

    if (name.includes("_")) {
      const spaced = name.replace(/^Bip001_/, "Bip001 ").replace(/_/g, " ");
      lookup.set(spaced, name);
      lookup.set(normalizeBoneKey(spaced), name);
    }
    if (name.includes(" ")) {
      const underscored = name.replace(/ /g, "_");
      lookup.set(underscored, name);
      lookup.set(normalizeBoneKey(underscored), name);
    }
  });

  // Role aliases (clip may say Hips / LeftArm when kit is Bip001)
  const aliases = [
    ["bip001pelvis", "hips"],
    ["bip001spine", "spine"],
    ["bip001neck", "neck"],
    ["bip001head", "head"],
    ["bip001lupperarm", "leftarm"],
    ["bip001rupperarm", "rightarm"],
    ["bip001lforearm", "leftforearm"],
    ["bip001rforearm", "rightforearm"],
    ["bip001lhand", "lefthand"],
    ["bip001rhand", "righthand"],
    ["bip001lthigh", "leftupleg"],
    ["bip001rthigh", "rightupleg"],
    ["bip001lcalf", "leftleg"],
    ["bip001rcalf", "rightleg"],
    ["bip001lfoot", "leftfoot"],
    ["bip001rfoot", "rightfoot"],
    ["bip001lclavicle", "leftshoulder"],
    ["bip001rclavicle", "rightshoulder"],
  ];
  for (const [a, b] of aliases) {
    const boneA = actualByKey.get(a);
    const boneB = actualByKey.get(b);
    if (boneA) lookup.set(b, boneA);
    if (boneB) lookup.set(a, boneB);
  }

  return lookup;
}

/**
 * Rematch clip tracks → only bones present on root.
 * Drops missing bones (Spine1/2) and never rewrites onto mesh names.
 */
export function rematchClipTracks(clip, root) {
  if (!clip?.tracks?.length || !root) return clip;

  const lookup = buildBoneNameLookup(root);
  const tracks = [];
  let rewritten = 0;
  let dropped = 0;

  for (const track of clip.tracks) {
    if (/\.position$|\.scale$/.test(track.name)) {
      dropped++;
      continue;
    }

    let nodeName;
    let propSuffix;
    try {
      const parsed = THREE.PropertyBinding.parseTrackName(track.name);
      nodeName = parsed.nodeName;
      const dot = track.name.indexOf(".");
      propSuffix =
        dot >= 0
          ? track.name.slice(dot)
          : `.${parsed.propertyName || "quaternion"}`;
    } catch {
      const dot = track.name.lastIndexOf(".");
      if (dot < 0) {
        tracks.push(track);
        continue;
      }
      nodeName = track.name.slice(0, dot);
      propSuffix = track.name.slice(dot);
    }

    if (!nodeName) {
      tracks.push(track);
      continue;
    }

    // Refuse mesh-like node names (head-between-feet cause)
    if (/units_|weapon_|shield_|xtra_|body_|arms_|legs_|head_/i.test(nodeName)) {
      const asBone = lookup.get(nodeName) || lookup.get(normalizeBoneKey(nodeName));
      if (!asBone || /units_|weapon_/i.test(asBone)) {
        dropped++;
        continue;
      }
    }

    const resolved =
      lookup.get(nodeName) || lookup.get(normalizeBoneKey(nodeName)) || null;

    if (!resolved) {
      // Missing bone (Spine1 / Spine2 / fingers / props) — drop, do not invent
      dropped++;
      continue;
    }

    if (resolved === nodeName) {
      tracks.push(track);
      continue;
    }

    rewritten++;
    const Ctor = track.constructor;
    tracks.push(
      new Ctor(
        `${resolved}${propSuffix}`,
        track.times?.slice ? track.times.slice() : track.times,
        track.values?.slice ? track.values.slice() : track.values,
      ),
    );
  }

  if (rewritten || dropped) {
    console.info(
      `[characterDeploy] rematch "${clip.name}": keep=${tracks.length} rewrote=${rewritten} dropped=${dropped}`,
    );
  }

  if (!tracks.length) {
    console.warn(
      `[characterDeploy] rematch left 0 tracks for "${clip.name}" — clip unusable`,
    );
    // Return empty rotation clip rather than original (original may bind to meshes)
    return new THREE.AnimationClip(clip.name, clip.duration, []);
  }

  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

/**
 * Assert kit skeleton has core Bip001 bones (Toon RTS humanoid).
 * @returns {{ ok: boolean, found: string[], missing: string[] }}
 */
export function assertCoreBonesOnKit(root) {
  if (!root) return { ok: false, found: [], missing: CORE_BIP001_BONES.slice() };
  const lookup = buildBoneNameLookup(root);
  const found = [];
  const missing = [];
  for (const want of CORE_BIP001_BONES) {
    const hit = lookup.get(want) || lookup.get(normalizeBoneKey(want));
    if (hit) found.push(hit);
    else missing.push(want);
  }
  return { ok: missing.length === 0, found, missing };
}

/**
 * Assert a rematched clip drives enough core bones (rotation tracks).
 * @returns {{ ok: boolean, bound: string[], missing: string[], trackCount: number }}
 */
export function assertClipBindsCoreBones(clip, root) {
  const kit = assertCoreBonesOnKit(root);
  if (!clip?.tracks?.length) {
    return {
      ok: false,
      bound: [],
      missing: kit.found.slice(),
      trackCount: 0,
    };
  }
  const boundKeys = new Set();
  for (const t of clip.tracks) {
    const dot = t.name.lastIndexOf(".");
    if (dot < 0) continue;
    const node = t.name.slice(0, dot);
    boundKeys.add(normalizeBoneKey(node));
  }
  const bound = [];
  const missing = [];
  for (const want of CORE_BIP001_BONES) {
    const k = normalizeBoneKey(want);
    if (boundKeys.has(k) || [...boundKeys].some((b) => b.includes(k) || k.includes(b))) {
      bound.push(want);
    } else {
      // Spine may be only "Bip001 Spine" without Spine1 — require pelvis+limbs hard
      const soft = /spine|neck/i.test(want);
      if (soft && boundKeys.has("bip001spine")) {
        bound.push(want);
      } else {
        missing.push(want);
      }
    }
  }
  // Require pelvis + head + both arms + both legs (spine/neck soft if pelvis ok)
  const hardMissing = missing.filter(
    (m) => !/spine|neck/i.test(m) || m.includes("Pelvis") || m.includes("Head"),
  );
  const need = ["pelvis", "head", "lupperarm", "rupperarm", "lthigh", "rthigh"];
  const hasHard = need.every((n) =>
    [...boundKeys].some((b) => b.includes(n) || normalizeBoneKey(b).includes(n)),
  );
  return {
    ok: hasHard && hardMissing.length <= 2,
    bound,
    missing,
    trackCount: clip.tracks.length,
  };
}

/**
 * Snap skinned feet to a ground plane after an anim sample.
 *
 * CRITICAL: Box3 is world-space; root.position is local.
 * When the kit is parented under a world-placed SI root (island height ≠ 0),
 * grounding to world Y=0 sinks the hero by island altitude.
 *
 * - Unparented / deploy at origin: groundY is world Y (usually 0).
 * - Child of grudge6 root: groundY is **local** feet plane of the parent (usually 0).
 */
export function reGroundAfterAnimSample(root, groundY = 0) {
  if (!root) return;
  root.updateMatrixWorld(true);
  // Pose skeleton so skinned bounds match current clip
  root.traverse((o) => {
    if (o.isSkinnedMesh && o.skeleton) o.skeleton.update();
  });
  root.updateMatrixWorld(true);
  const box = bodyBox(root);
  if (!Number.isFinite(box.min.y)) return;

  let targetWorldY = groundY;
  if (root.parent) {
    // Feet on parent's local y=groundY plane (SI hero root sits on island ground)
    const parentOrigin = new THREE.Vector3();
    root.parent.getWorldPosition(parentOrigin);
    // Parent Y-rotation only → world Y of local ground plane ≈ parentWorldY + groundY * scaleY
    const sy = root.parent.scale?.y ?? 1;
    targetWorldY = parentOrigin.y + groundY * sy;
  }

  const dyWorld = targetWorldY - box.min.y;
  if (!Number.isFinite(dyWorld) || Math.abs(dyWorld) < 1e-5) return;

  // Apply as local Y delta (valid for Y-up hierarchy with no parent pitch/roll)
  if (root.parent) {
    const parent = root.parent;
    const scaleY = parent.scale?.y || 1;
    root.position.y += dyWorld / scaleY;
  } else {
    root.position.y += dyWorld;
  }
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
 * Full deploy (ObjectStore loadRaceKit parity for play):
 *   skeleton.update only → bone SI fit → face yaw 0 for Toon → feet ground.
 *
 * PURGED (do not reintroduce for Toon play):
 *   - pose() on every SkinnedMesh (1-joint head skins → head-at-feet)
 *   - facePlusZ default true (Toon play GLBs already +Z; π/2 = sideways)
 */
export function deployGrudge6Model(model, opts = {}) {
  if (!opts.skipPose) {
    // Widest body skeleton pose once only (never every mesh)
    let widest = null;
    model.traverse((o) => {
      if (o.isSkinnedMesh && o.skeleton) {
        if (!widest || o.skeleton.bones.length > widest.bones.length) widest = o.skeleton;
      }
    });
    if (widest) {
      widest.pose();
      widest.update();
    }
  }
  model.traverse((o) => {
    if (o.isSkinnedMesh && o.skeleton) o.skeleton.update();
  });
  model.updateMatrixWorld(true);

  const beforeH = measureHeight(model);
  fitToHuman(model, opts.targetH ?? HUMAN_HEIGHT_M);
  // Toon RTS play: facePlusZ false. FBX author path only: facePlusZ true.
  if (opts.facePlusZ === true) applyArtForwardPlusZ(model);
  else model.userData.artForwardSet = true; // mark as handled (yaw 0)
  groundFeetAndCenterXZ(model, opts.groundY ?? 0);
  const diag = diagnoseCharacterLook(model, opts.groundY ?? 0);
  diag.beforeHeight = beforeH;
  console.info(
    `[characterDeploy] before=${beforeH.toFixed(2)}m → after=${diag.height?.toFixed(2)}m ` +
      `factor×${(diag.scaleFactor ?? 1).toFixed(4)} feet=${diag.feetMinY?.toFixed(3)} ` +
      `facePlusZ=${opts.facePlusZ === true} ` +
      (diag.ok ? "OK" : diag.errors.join("; ")),
  );
  return diag;
}
