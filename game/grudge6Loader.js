/**
 * Grudge6 kit loader — exact gear_presets mesh_ids + Bip001 director packs.
 * Deploy order from grudge-character-correctness (characterDeploy helpers).
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
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

let _loader = null;
function getLoader() {
  if (_loader) return _loader;
  _loader = new GLTFLoader();
  try {
    const draco = new DRACOLoader();
    draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    _loader.setDRACOLoader(draco);
  } catch {
    /* optional */
  }
  return _loader;
}

const templateCache = new Map();

async function loadTemplate(url) {
  if (templateCache.has(url)) return templateCache.get(url);
  window.setLoaderStatus?.(`Loading kit ${url.split("/").pop()}…`);
  const gltf = await getLoader().loadAsync(url);
  templateCache.set(url, gltf.scene);
  return gltf.scene;
}

function normId(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Catalog hide → show exact gear_presets mesh_ids only. */
export function applyExactMeshIds(root, visibleMeshes = []) {
  const exact = new Set(visibleMeshes.filter(Boolean));
  const fuzzy = new Set([...exact].map(normId));

  root.traverse((o) => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    o.visible = false;
  });

  const shown = new Set();
  root.traverse((o) => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    if (exact.has(o.name)) {
      o.visible = true;
      shown.add(o.name);
      return;
    }
    const n = normId(o.name);
    if (fuzzy.has(n)) {
      o.visible = true;
      shown.add(o.name);
    }
  });

  if (shown.size === 0) {
    console.warn("[grudge6Loader] no mesh_ids matched; body fallback", visibleMeshes);
    root.traverse((o) => {
      if (!o.isMesh && !o.isSkinnedMesh) return;
      if (/body|arms|legs|head|units_/i.test(o.name) && !/weapon|shield|bag|wood|quiver/i.test(o.name)) {
        o.visible = true;
      }
    });
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
  // Skills UI maps knight→warrior, unarmed→worge-ish
  const skillClass =
    classId === "knight" ? "warrior" : classId === "unarmed" ? "worge" : classId;
  const classDef = getClass(skillClass);
  const kit = race ? resolveRaceClass(race, classId) : resolveClassKit(classId);
  const kitUrl = kit.kitUrl || classDef.kitUrl;
  const animPack = kit.animPack || classDef.animPack || "sword_shield";
  const visibleMeshes = kit.visibleMeshes || [];

  let template;
  try {
    template = await loadTemplate(kitUrl);
  } catch (e) {
    console.warn("[grudge6Loader] CDN kit fail, capsule stand-in", e);
    return makeCapsuleStandIn(classDef, kit);
  }

  const model = SkeletonUtils.clone(template);
  // Force skeleton bind update after clone
  model.traverse((o) => {
    if (o.isSkinnedMesh && o.skeleton) {
      o.skeleton.pose();
      o.skeleton.update();
    }
  });

  const shownMeshes = applyExactMeshIds(model, visibleMeshes);

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
          m.map.flipY = false;
        }
        m.vertexColors = false;
        m.metalness = Math.min(m.metalness ?? 0.1, 0.25);
        m.roughness = Math.max(m.roughness ?? 0.7, 0.55);
        m.side = THREE.DoubleSide;
        m.needsUpdate = true;
      }
    }
  });

  // SSOT deploy: fit 1.8m → art-forward +π/2 → feet ground local y=0
  const diag = deployGrudge6Model(model, { groundY: 0 });
  if (!diag.ok) console.warn("[grudge6Loader] diagnose", diag);

  const root = new THREE.Group();
  root.name = `grudge6_${classDef.id}`;
  root.add(model);

  const mixer = new THREE.AnimationMixer(model);
  let director = null;
  let clips = {};

  try {
    window.setLoaderStatus?.(`Loading anim pack ${animPack}…`);
    clips = await loadAnimPack(animPack);
    // Rematch Bip001 bone names → strip hip/root position (kills hip-float)
    let bound = 0;
    for (const k of Object.keys(clips)) {
      if (!clips[k]) continue;
      clips[k] = stripPositionTracks(rematchClipTracks(clips[k], model));
      bound++;
    }
    const hasAny = Object.values(clips).some(Boolean);
    if (hasAny) {
      director = new AnimationDirector(mixer, clips);
      // Sample idle once then re-ground (kills residual hip float)
      mixer.update(1 / 30);
      reGroundAfterAnimSample(model, 0);
      const d2 = diagnoseCharacterLook(model, 0);
      console.info(
        `[grudge6Loader] ${classId} pack=${animPack} meshes=${shownMeshes.length} clips=${bound} h=${d2.height?.toFixed(2)} feet=${d2.feetMinY?.toFixed(3)}`,
        d2.ok ? "OK" : d2.errors,
      );
    } else {
      console.warn("[grudge6Loader] anim pack empty", animPack);
    }
  } catch (e) {
    console.warn("[grudge6Loader] anim pack load failed", animPack, e);
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
    raceId: kit.raceId,
    classId: kit.classId,
    visibleMeshes,
    shownMeshes,
    diagnose: diag,
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
