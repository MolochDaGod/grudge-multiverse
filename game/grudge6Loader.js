/**
 * Toon RTS character loader — modular race GLB + mesh_ids + atlas + Bip001 packs.
 * Loader SSOT: toonRtsGltfLoader (Draco+Meshopt). NEVER Mixamo person*.glb.
 */
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { getClass } from "./classes.js";
import { resolveRaceClass, resolveClassKit, loadSelection } from "./fleetGearPresets.js";
import { loadAnimPack } from "./animPackLoader.js";
import { AnimationDirector } from "./bip001Director.js";
import {
  deployGrudge6Model,
  stripPositionTracks,
  rematchClipTracks,
  reGroundAfterAnimSample,
  diagnoseCharacterLook,
} from "./characterDeploy.js";
import {
  assertAllowedKitUrl,
  logSSOT,
  resolveCharacterSource,
  assetUrlBust,
  kitUrlCandidates,
  isToonRtsKitUrl,
  GRUDGE6_SSOT_VERSION,
  HUMAN_HEIGHT_M,
  ANIMS_BAKED,
  CDN,
} from "./grudge6SSOT.js";
import { resolveAnimPackId } from "./drcAnimSsot.js";
import { loadToonRtsRaceTemplate } from "./toonRtsGltfLoader.js";

const textureLoader = new THREE.TextureLoader();
if (typeof textureLoader.setCrossOrigin === "function") {
  textureLoader.setCrossOrigin("anonymous");
}

const atlasCache = new Map();

async function loadTemplate(url) {
  return loadToonRtsRaceTemplate(url);
}

/** Load Toon RTS body atlas (sRGB, flipY false — FBX/GLB UV contract). */
async function loadAtlas(url) {
  if (!url) return null;
  const bust = assetUrlBust(url);
  if (atlasCache.has(bust)) return atlasCache.get(bust);
  try {
    const tex = await textureLoader.loadAsync(bust);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    atlasCache.set(bust, tex);
    return tex;
  } catch (e) {
    console.warn("[grudge6Loader] atlas load failed", bust, e?.message || e);
    return null;
  }
}

/**
 * Paint body atlas onto body/armor skinned meshes only.
 * NEVER splat race atlas onto weapons/shields (scrambles UVs → “fucked” kit).
 */
export function applyBodyAtlas(root, atlas) {
  if (!root || !atlas) return 0;
  let n = 0;
  root.traverse((o) => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    const name = o.name || "";
    if (/weapon|shield|quiver|bag|xtra|sword|bow|staff|axe/i.test(name)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      m.map = atlas;
      m.map.colorSpace = THREE.SRGBColorSpace;
      if (m.map) m.map.flipY = false;
      m.vertexColors = false;
      m.metalness = Math.min(m.metalness ?? 0.1, 0.2);
      m.roughness = Math.max(m.roughness ?? 0.75, 0.55);
      m.side = THREE.DoubleSide;
      m.needsUpdate = true;
      n++;
    }
  });
  return n;
}

/**
 * Toggle weapon / shield meshes from equipped item kind.
 * Hides all weapons first, then shows one mesh per family (prefer gear preset names).
 * @param {THREE.Object3D} model
 * @param {string} [_prefix]
 * @param {{ weapon?: string, offhand?: string, prefer?: string[] }} kinds
 */
export function applyEquipMeshes(model, _prefix, kinds = {}) {
  if (!model) return;
  const w = String(kinds.weapon || "sword").toLowerCase();
  const oh = String(kinds.offhand || "").toLowerCase();
  const prefer = new Set((kinds.prefer || []).map(String));

  /** @type {THREE.Object3D[]} */
  const weapons = [];
  model.traverse((o) => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    if (/weapon|sword|bow|staff|axe|quiver|shield/i.test(o.name || "")) {
      weapons.push(o);
      o.visible = false;
    }
  });

  const matchKind = (name, kind) => {
    const n = name.toLowerCase();
    if (kind === "bow" || kind === "longbow") return /bow|quiver/.test(n);
    if (kind === "staff" || kind === "magic") return /staff/.test(n);
    if (kind === "axe" || kind === "twohand") return /axe/.test(n);
    if (kind === "none" || kind === "unarmed") return false;
    // sword / melee default
    return /sword/.test(n) || /weapon_sword/.test(n);
  };

  const pick = (predicate) => {
    const list = weapons.filter((o) => predicate(o.name || ""));
    if (!list.length) return null;
    const preferred = list.find((o) => prefer.has(o.name));
    return preferred || list[0];
  };

  if (w !== "none" && w !== "unarmed") {
    const main = pick((n) => matchKind(n, w));
    if (main) main.visible = true;
    // Quiver with bows
    if (w === "bow" || w === "longbow") {
      const q = pick((n) => /quiver/i.test(n));
      if (q) q.visible = true;
    }
  }
  if (oh === "shield" || oh === "offhand" || w === "sword" || w === "sword_shield") {
    const sh = pick((n) => /shield/i.test(n));
    if (sh) sh.visible = true;
  }
}

/** Map bag item id → weapon kind for mesh swap. */
export function weaponKindFromItem(item) {
  if (!item) return "sword";
  const blob = `${item.id || ""} ${item.name || ""}`.toLowerCase();
  if (/bow|longbow|yew/.test(blob)) return "bow";
  if (/staff|wand|oak|arcane/.test(blob)) return "staff";
  if (/axe|worge/.test(blob)) return "axe";
  if (/unarmed|fist|glove/.test(blob)) return "none";
  return "sword";
}

function normId(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/^wk_|^brb_|^orc_|^elf_|^ud_|^dwf_/, "")
    .replace(/units_/g, "")
    .replace(/xtra_/g, "")
    .replace(/weapon_/g, "weapon")
    .replace(/shield_/g, "shield")
    .replace(/shoulderpads_/g, "shoulders")
    .replace(/[^a-z0-9]/g, "");
}

function meshMatchesId(meshName, meshId) {
  if (!meshName || !meshId) return false;
  if (meshName === meshId) return true;
  if (meshName.endsWith(meshId) || meshId.endsWith(meshName)) return true;
  const a = normId(meshName);
  const b = normId(meshId);
  return a === b || a.endsWith(b) || b.endsWith(a);
}

/** Catalog hide → show exact gear_presets mesh_ids only (fuzzy race/case tolerant). */
export function applyExactMeshIds(root, visibleMeshes = []) {
  const wanted = (visibleMeshes || []).filter(Boolean).map(String);

  /** @type {THREE.Object3D[]} */
  const meshes = [];
  root.traverse((o) => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    o.visible = false;
    meshes.push(o);
  });

  const shown = new Set();
  for (const id of wanted) {
    const hit = meshes.find((m) => meshMatchesId(m.name, id));
    if (hit) {
      hit.visible = true;
      shown.add(hit.name);
    }
  }

  if (shown.size === 0) {
    console.warn("[grudge6Loader] no mesh_ids matched; body A fallback", visibleMeshes);
    // Only ONE body/arms/legs/head A — never show all variants (exploded kit)
    for (const o of meshes) {
      const n = o.name || "";
      if (/weapon|shield|bag|wood|quiver/i.test(n)) continue;
      if (/Body_A|body_A|Units_Body_A/i.test(n)) o.visible = true;
      else if (/Arms_A|arms_A|Units_Arms_A/i.test(n)) o.visible = true;
      else if (/Legs_A|legs_A|Units_Legs_A/i.test(n)) o.visible = true;
      else if (/head_A|Head_A|Units_head_A/i.test(n)) o.visible = true;
    }
  }
  return [...shown];
}

/**
 * @param {string} [classIdOrOpts]
 * @param {string} [raceId]
 */
export async function loadGrudge6Class(classIdOrOpts, raceId) {
  let classId = classIdOrOpts;
  let race = raceId;
  if (classIdOrOpts && typeof classIdOrOpts === "object") {
    classId = classIdOrOpts.classId;
    race = classIdOrOpts.raceId;
  }
  if (!classId || !race) {
    const sel = loadSelection();
    classId = classId || sel.classId;
    race = race || sel.raceId;
  }
  // Skills: knight/unarmed share warrior skill bar; worge keeps 2h bar
  const skillClass =
    classId === "knight" || classId === "unarmed"
      ? "warrior"
      : classId === "worge"
        ? "worge"
        : classId;
  const classDef = getClass(skillClass);
  // Always race+class SSOT for kit/atlas/mesh_ids (never Mixamo / never invent host)
  const kit = race ? resolveRaceClass(race, classId) : resolveClassKit(classId);
  const kitUrl = assertAllowedKitUrl(kit.kitUrl || classDef.kitUrl);
  const animPack = resolveAnimPackId(kit.animPack || classDef.animPack || "sword_shield");
  const visibleMeshes = kit.visibleMeshes || [];
  const source = resolveCharacterSource(kit.raceId || race, kit.classId || classId, {
    animPack,
    visibleMeshes,
    kitUrl,
    atlasUrl: kit.atlasUrl || classDef.atlasUrl,
  });
  logSSOT();
  console.info(
    `[grudge6Loader] SOURCE race=${source.raceId} class=${source.classId} kit=${source.kitUrl.split("/").pop()} atlas=${(source.atlasUrl || "").split("/").pop()} pack=${animPack} meshIds=${visibleMeshes.length}`,
  );

  let template;
  let loadedUrl = kitUrl;
  const candidates = kitUrlCandidates(kit.raceId || race);
  // Prefer SSOT primary; if caller forced a URL, try that first then candidates
  const tryUrls = [kitUrl, ...candidates.filter((u) => u !== kitUrl)];
  let lastErr = null;
  for (const url of tryUrls) {
    try {
      assertAllowedKitUrl(url);
      template = await loadTemplate(url);
      loadedUrl = url;
      if (!isToonRtsKitUrl(url)) {
        console.warn("[grudge6Loader] loaded FALLBACK kit (not Toon RTS ★)", url);
      }
      break;
    } catch (e) {
      lastErr = e;
      console.warn("[grudge6Loader] kit try failed", url, e?.message || e);
    }
  }
  if (!template) {
    console.error("[grudge6Loader] CDN kit FAIL — capsule is NOT production hero", kitUrl, lastErr);
    const cap = makeCapsuleStandIn(classDef, kit);
    cap.source = { ...source, degraded: true, error: String(lastErr?.message || lastErr) };
    return cap;
  }
  source.kitUrl = loadedUrl;
  source.playMesh = isToonRtsKitUrl(loadedUrl) ? "toon-rts" : "legacy-races";

  const model = SkeletonUtils.clone(template);
  // Force skeleton bind update after clone
  model.traverse((o) => {
    if (o.isSkinnedMesh && o.skeleton) {
      o.skeleton.pose();
      o.skeleton.update();
    }
  });

  // CRITICAL order (DRC / grudge-character-correctness):
  // 1) SI deploy while ALL body meshes still visible (scale measure)
  // 2) then mesh_ids hide/show gear
  // 3) then body-only atlas (never weapons)
  // Measuring after mesh_ids → sword-height / stretched / floating kits.
  const diag = deployGrudge6Model(model, { groundY: 0 });
  if (!diag.ok) console.warn("[grudge6Loader] diagnose", diag);
  else
    console.info(
      "[grudge6Loader] deploy OK",
      classId,
      `${diag.beforeHeight?.toFixed?.(2)}→${diag.height?.toFixed?.(2)}m`,
    );

  const shownMeshes = applyExactMeshIds(model, visibleMeshes);

  // Toon ★ keeps embeds — force race atlas only when body maps are missing
  let atlas = null;
  let embedMaps = 0;
  model.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    if (/weapon|shield|quiver|bag|xtra/i.test(o.name || "")) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (m?.map?.image) embedMaps++;
    }
  });
  if (embedMaps === 0 && kit.atlasUrl) {
    atlas = await loadAtlas(kit.atlasUrl);
    if (atlas) {
      const painted = applyBodyAtlas(model, atlas);
      console.info(
        "[grudge6Loader] atlas applied (embeds missing)",
        kit.atlasUrl.split("/").pop(),
        "mats",
        painted,
      );
    } else {
      console.warn("[grudge6Loader] atlas missing — kit may look untextured", kit.atlasUrl);
    }
  } else {
    console.info(
      `[grudge6Loader] keeping embedded maps (${embedMaps}) playMesh=${source.playMesh}`,
    );
  }

  model.traverse((o) => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    o.frustumCulled = true;
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m.map) {
          m.map.colorSpace = THREE.SRGBColorSpace;
          if (m.map.flipY !== false) m.map.flipY = false;
        }
        m.vertexColors = false;
        m.metalness = Math.min(m.metalness ?? 0.1, 0.25);
        m.roughness = Math.max(m.roughness ?? 0.7, 0.55);
        m.side = THREE.DoubleSide;
        m.needsUpdate = true;
      }
    }
  });

  // Re-ground after equip visibility (AABB can change)
  reGroundAfterAnimSample(model, 0);

  const root = new THREE.Group();
  root.name = `grudge6_${kit.raceId || classDef.id}_${kit.classId || classId}`;
  root.userData.siHuman = true;
  root.userData.deployHeightM = diag.height;
  root.userData.playMesh = source.playMesh;
  root.userData.characterSource = {
    ...source,
    heightM: diag.height,
    beforeHeightM: diag.beforeHeight,
    scaleFactor: diag.scaleFactor,
    shownMeshes,
    degraded: false,
  };
  root.add(model);

  const mixer = new THREE.AnimationMixer(model);
  let director = null;
  let clips = {};

  try {
    window.setLoaderStatus?.(`Loading anim pack ${animPack}…`);
    clips = await loadAnimPack(animPack);
    // Bone-only rematch + strip position (kills head-at-feet + hip-float)
    let bound = 0;
    let usable = 0;
    for (const k of Object.keys(clips)) {
      if (!clips[k]) continue;
      const rematched = rematchClipTracks(clips[k], model);
      clips[k] = stripPositionTracks(rematched);
      bound++;
      if (clips[k]?.tracks?.length >= 6) usable++;
      else if (clips[k]) {
        console.warn(
          `[grudge6Loader] clip "${k}" thin after rematch (${clips[k].tracks?.length || 0} tracks)`,
        );
      }
    }
    const hasAny = Object.values(clips).some((c) => c?.tracks?.length);
    if (hasAny && usable > 0) {
      director = new AnimationDirector(mixer, clips);
      // Sample idle once then re-ground (kills residual hip float)
      mixer.update(1 / 30);
      reGroundAfterAnimSample(model, 0);
      const d2 = diagnoseCharacterLook(model, 0);
      console.info(
        `[grudge6Loader] ${classId} pack=${animPack} playMesh=${source.playMesh} meshes=${shownMeshes.length} clips=${bound}/${usable} h=${d2.height?.toFixed(2)} feet=${d2.feetMinY?.toFixed(3)}`,
        d2.ok ? "OK" : d2.errors,
      );
    } else {
      console.error(
        `[grudge6Loader] anim pack EMPTY or unbindable pack=${animPack} bound=${bound} usable=${usable} — hero will T-pose`,
      );
    }
  } catch (e) {
    console.error("[grudge6Loader] anim pack load failed", animPack, e);
  }

  const finalSource = {
    ...source,
    heightM: diag.height,
    beforeHeightM: diag.beforeHeight,
    scaleFactor: diag.scaleFactor,
    shownMeshes,
    animPack,
    clipsLoaded: Object.keys(clips).filter((k) => clips[k] && !k.startsWith("_")),
    director: !!director,
    degraded: false,
    pipeline: isToonRtsKitUrl(loadedUrl) ? "toon_rts_glb" : "legacy_races_glb",
    loader: "toonRtsGltfLoader",
    kitUrl: loadedUrl,
    isToonRtsKit: isToonRtsKitUrl(loadedUrl),
    playMesh: isToonRtsKitUrl(loadedUrl) ? "toon-rts" : "legacy-races",
    artForward: !!model.userData?.artForwardSet || !!diag.artForward,
    ssotVersion: GRUDGE6_SSOT_VERSION,
    humanHeightM: HUMAN_HEIGHT_M,
    cdn: CDN,
    animsHost: ANIMS_BAKED,
  };
  root.userData.characterSource = finalSource;
  if (typeof window !== "undefined") {
    window.__mvCharacterSource = finalSource;
  }

  return {
    root,
    model,
    classDef,
    kit,
    mixer,
    director,
    clips,
    animPack,
    source: finalSource,
    raceId: kit.raceId,
    classId: kit.classId,
    visibleMeshes,
    shownMeshes,
    atlas,
    diagnose: diag,
    /** Re-apply weapon/shield meshes from equipped loadout */
    applyLoadout(loadout) {
      const wItem = loadout?.weapon;
      const ohItem = loadout?.offhand;
      // Prefer class gear mesh names, then item-driven family
      applyEquipMeshes(model, kit.prefix, {
        weapon: weaponKindFromItem(wItem) || animPack,
        offhand: ohItem ? "shield" : animPack === "sword_shield" ? "shield" : "",
        prefer: visibleMeshes,
      });
    },
  };
}

function makeCapsuleStandIn(classDef, kit) {
  const colors = { warrior: 0x4a6a9a, ranger: 0x3a7a4a, mage: 0x6a3a8a, worge: 0x8a3a2a };
  const root = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.32, 1.0, 6, 12),
    new THREE.MeshStandardMaterial({ color: colors[classDef.id] || 0x888888 }),
  );
  body.position.y = 0.9;
  root.add(body);
  const mixer = new THREE.AnimationMixer(root);
  return {
    root,
    model: body,
    classDef,
    kit: kit || resolveClassKit(classDef.id),
    mixer,
    director: null,
    clips: {},
    animPack: classDef.animPack,
    visibleMeshes: [],
    shownMeshes: [],
    standIn: true,
  };
}
