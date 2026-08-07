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
  assertCoreBonesOnKit,
  assertClipBindsCoreBones,
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
import {
  applyCharacterEquipment,
  applyLabeledMeshIds,
  catalogAndLabelMeshes,
  weaponFamilyFromItem,
} from "./meshEquip.js";
import { gradeCharacterSource } from "./characterIntegrity.js";

/** Production: Toon RTS ★ only. Debug: ?mvLegacyKit=1 allows races bake fallback. */
function allowLegacyKitFallback() {
  try {
    return (
      typeof location !== "undefined" &&
      /(?:^|[?&])mvLegacyKit=1(?:&|$)/.test(location.search || "")
    );
  } catch {
    return false;
  }
}

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
 * @deprecated prefer applyCharacterEquipment — kept for any external callers
 */
export function applyEquipMeshes(model, _prefix, kinds = {}) {
  if (!model) return;
  const fam = String(kinds.weapon || "sword").toLowerCase();
  const loadout = {
    weapon: fam === "none" || fam === "unarmed" ? { id: "unarmed", name: "Unarmed" } : { id: fam, name: fam },
    offhand: kinds.offhand ? { id: "shield", name: "Shield", slot: "shield" } : null,
  };
  applyCharacterEquipment(model, kinds.prefer || [], loadout);
}

/** Map bag item id → weapon kind for mesh swap. */
export function weaponKindFromItem(item) {
  return weaponFamilyFromItem(item) || "sword";
}

/** Catalog hide → show exact gear_presets mesh_ids; label every mesh. */
export function applyExactMeshIds(root, visibleMeshes = []) {
  const { shown } = applyLabeledMeshIds(root, visibleMeshes);
  return shown;
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
  // Production: Toon RTS ★ only. Legacy races bake only with ?mvLegacyKit=1
  const legacyOk = allowLegacyKitFallback();
  let tryUrls = [kitUrl, ...candidates.filter((u) => u !== kitUrl)].filter((u) => {
    if (isToonRtsKitUrl(u)) return true;
    if (legacyOk) {
      console.warn("[grudge6Loader] mvLegacyKit=1 — allowing non-Toon URL", u);
      return true;
    }
    return false;
  });
  if (!tryUrls.length && isToonRtsKitUrl(kitUrl)) {
    tryUrls = [kitUrl];
  }
  let lastErr = null;
  for (const url of tryUrls) {
    try {
      assertAllowedKitUrl(url);
      if (!isToonRtsKitUrl(url) && !legacyOk) {
        throw new Error(`refuse non-Toon kit in production: ${url}`);
      }
      template = await loadTemplate(url);
      loadedUrl = url;
      if (!isToonRtsKitUrl(url)) {
        console.error("[grudge6Loader] LEGACY kit loaded (not production default)", url);
      }
      break;
    } catch (e) {
      lastErr = e;
      console.warn("[grudge6Loader] kit try failed", url, e?.message || e);
    }
  }
  if (!template) {
    console.error(
      "[grudge6Loader] FAIL-CLOSED: Toon RTS kit load failed — no playable production hero",
      kitUrl,
      lastErr,
    );
    const cap = makeCapsuleStandIn(classDef, kit);
    const failSource = {
      ...source,
      degraded: true,
      standIn: true,
      playMesh: "none",
      isToonRtsKit: false,
      director: false,
      coreBonesOk: false,
      coreClipOk: false,
      pipeline: "capsule",
      error: String(lastErr?.message || lastErr),
      integrity: "red",
      integrityReasons: ["toon_kit_load_failed"],
    };
    failSource.integrity = gradeCharacterSource(failSource).grade;
    cap.source = failSource;
    cap.root.userData.characterSource = failSource;
    if (typeof window !== "undefined") window.__mvCharacterSource = failSource;
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

  // Label every kit mesh (slot / category / display name) then show gear_presets only
  const labeledCatalog = catalogAndLabelMeshes(model);
  const { shown: shownMeshes, labeled: meshLabels } = applyLabeledMeshIds(model, visibleMeshes);
  console.info(
    `[grudge6Loader] mesh_ids ${shownMeshes.length}/${visibleMeshes.length} labeled=${labeledCatalog.length}`,
    meshLabels.map((m) => `${m.slot}:${m.label}`).join(", "),
  );

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
    meshLabels,
    meshCatalogCount: labeledCatalog.length,
    degraded: false,
  };
  root.userData.meshLabels = meshLabels;
  root.userData.shownMeshes = shownMeshes;
  root.add(model);

  // Fail-closed: kit must have core Bip001 bones before we bind clips
  const coreKit = assertCoreBonesOnKit(model);
  if (!coreKit.ok) {
    console.error(
      "[grudge6Loader] FAIL-CLOSED: kit missing core Bip001 bones",
      coreKit.missing,
    );
  }

  const mixer = new THREE.AnimationMixer(model);
  let director = null;
  let clips = {};
  let coreClip = { ok: false, bound: [], missing: ["(no probe clip)"], trackCount: 0 };

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
    // Assert idle (or walk) drives core bones
    const probe = clips.idle || clips.walk || clips.run;
    if (probe) {
      coreClip = assertClipBindsCoreBones(probe, model);
      if (!coreClip.ok) {
        console.error(
          "[grudge6Loader] FAIL-CLOSED: rematch did not bind core bones",
          coreClip.missing,
          "tracks",
          coreClip.trackCount,
        );
      }
    }
    const hasAny = Object.values(clips).some((c) => c?.tracks?.length);
    const canDirect =
      hasAny &&
      usable > 0 &&
      coreKit.ok &&
      coreClip.ok &&
      isToonRtsKitUrl(loadedUrl);
    if (canDirect) {
      director = new AnimationDirector(mixer, clips);
      mixer.update(1 / 30);
      reGroundAfterAnimSample(model, 0);
      const d2 = diagnoseCharacterLook(model, 0);
      console.info(
        `[grudge6Loader] ${classId} pack=${animPack} playMesh=toon-rts meshes=${shownMeshes.length} clips=${bound}/${usable} core=${coreClip.bound.length} h=${d2.height?.toFixed(2)} feet=${d2.feetMinY?.toFixed(3)}`,
        d2.ok ? "OK" : d2.errors,
      );
    } else {
      console.error(
        `[grudge6Loader] FAIL-CLOSED: no production director pack=${animPack} bound=${bound} usable=${usable} coreKit=${coreKit.ok} coreClip=${coreClip.ok} toon=${isToonRtsKitUrl(loadedUrl)}`,
      );
    }
  } catch (e) {
    console.error("[grudge6Loader] anim pack load failed", animPack, e);
  }

  const isToon = isToonRtsKitUrl(loadedUrl);
  const finalSource = {
    ...source,
    heightM: diag.height,
    beforeHeightM: diag.beforeHeight,
    scaleFactor: diag.scaleFactor,
    shownMeshes,
    animPack,
    clipsLoaded: Object.keys(clips).filter((k) => clips[k]?.tracks?.length),
    director: !!director,
    degraded: !director || !isToon || !coreKit.ok || !coreClip.ok,
    pipeline: isToon ? "toon_rts_glb" : "legacy_races_glb",
    loader: "toonRtsGltfLoader",
    kitUrl: loadedUrl,
    isToonRtsKit: isToon,
    playMesh: isToon ? "toon-rts" : "legacy-races",
    artForward: !!model.userData?.artForwardSet || !!diag.artForward,
    ssotVersion: GRUDGE6_SSOT_VERSION,
    humanHeightM: HUMAN_HEIGHT_M,
    cdn: CDN,
    animsHost: ANIMS_BAKED,
    coreBonesOk: coreKit.ok,
    coreBonesFound: coreKit.found,
    coreBonesMissing: coreKit.missing,
    coreClipOk: coreClip.ok,
    coreClipBound: coreClip.bound,
    coreClipMissing: coreClip.missing,
    coreClipTracks: coreClip.trackCount,
  };
  const grade = gradeCharacterSource(finalSource);
  finalSource.integrity = grade.grade;
  finalSource.integrityReasons = grade.reasons;
  finalSource.ok = grade.ok;

  if (grade.grade !== "green") {
    console.error(
      `[grudge6Loader] integrity=${grade.grade} reasons=`,
      grade.reasons,
    );
  } else {
    console.info(`[grudge6Loader] integrity=green Toon RTS production OK`);
  }

  root.userData.characterSource = finalSource;
  root.userData.integrity = grade.grade;
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
    integrity: grade.grade,
    raceId: kit.raceId,
    classId: kit.classId,
    visibleMeshes,
    shownMeshes,
    meshLabels,
    atlas,
    diagnose: diag,
    /**
     * Re-apply full body armor + weapon + shield from bag loadout.
     * Starts from class gear_presets mesh_ids, then overrides by equipped items.
     */
    applyLoadout(loadout) {
      const res = applyCharacterEquipment(model, visibleMeshes, loadout || {});
      this.shownMeshes = res.shown;
      this.meshLabels = res.labeled;
      root.userData.shownMeshes = res.shown;
      root.userData.meshLabels = res.labeled;
      reGroundAfterAnimSample(model, 0);
      console.info(
        "[grudge6Loader] loadout applied",
        res.labeled.map((m) => `${m.slot}=${m.label}`).join(" · "),
      );
      return res;
    },
    /** Live labeled catalog for main panel */
    getMeshReport() {
      return {
        shown: this.shownMeshes || [],
        labels: this.meshLabels || window.__mvMeshLabels || [],
        catalog: window.__mvMeshCatalog || [],
      };
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
