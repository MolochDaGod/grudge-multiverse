/**
 * Grudge6 kit loader — exact gear_presets mesh_ids + Bip001 AnimationDirector packs.
 * SSOT: fleetGearPresets (gameopen gearPresets.ts) · grudge6-modular-characters · combat-runtime
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { getClass } from "./classes.js";
import { resolveClassKit } from "./fleetGearPresets.js";
import { loadAnimPack } from "./animPackLoader.js";
import { AnimationDirector } from "./bip001Director.js";

const HUMAN_HEIGHT_M = 1.8;

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
  const gltf = await getLoader().loadAsync(url);
  templateCache.set(url, gltf.scene);
  return gltf.scene;
}

/** Normalize mesh id for fuzzy match (case + separators). */
function normId(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Catalog hide → show only exact gear_presets visibleMeshes.
 * Prefer exact name; fall back to case-insensitive / normalized id.
 */
export function applyExactMeshIds(root, visibleMeshes = []) {
  const exact = new Set(visibleMeshes.filter(Boolean));
  const fuzzy = new Set([...exact].map(normId));

  // First pass: hide all mesh/skinned (wardrobe catalog)
  root.traverse((o) => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    o.visible = false;
  });

  // Second: show exact matches
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

  // If nothing matched (bad kit / rename), restore body-like meshes so we never T-pose naked black
  if (shown.size === 0) {
    console.warn("[grudge6Loader] no mesh_ids matched; showing body-like fallback", visibleMeshes);
    root.traverse((o) => {
      if (!o.isMesh && !o.isSkinnedMesh) return;
      if (/body|arms|legs|head|units_/i.test(o.name) && !/weapon|shield|bag|wood|quiver/i.test(o.name)) {
        o.visible = true;
      }
    });
  }

  return [...shown];
}

function bodyBox(root) {
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

function fitSiHeight(root) {
  let box = bodyBox(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.y < 0.01) return;
  // Classic 100× unit fix
  if (size.y > 50) {
    root.scale.multiplyScalar(0.01);
    box = bodyBox(root);
    box.getSize(size);
  }
  const s = HUMAN_HEIGHT_M / size.y;
  root.scale.multiplyScalar(s);
  root.updateMatrixWorld(true);
  box = bodyBox(root);
  root.position.y -= box.min.y;
}

/**
 * @param {string} classId
 * @returns {Promise<{
 *   root: THREE.Group,
 *   model: THREE.Object3D,
 *   classDef: object,
 *   kit: object,
 *   mixer: THREE.AnimationMixer,
 *   director: AnimationDirector|null,
 *   animPack: string,
 *   visibleMeshes: string[],
 *   shownMeshes: string[],
 * }>}
 */
export async function loadGrudge6Class(classId) {
  const classDef = getClass(classId);
  const kit = resolveClassKit(classId);
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
  const shownMeshes = applyExactMeshIds(model, visibleMeshes);

  model.traverse((o) => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m.map) {
          m.map.colorSpace = THREE.SRGBColorSpace;
          // Toon RTS / FBX atlas path
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

  fitSiHeight(model);

  // Art-forward: Toon RTS kits face +X; controller walks +Z
  model.rotation.y = Math.PI / 2;

  const root = new THREE.Group();
  root.name = `grudge6_${classDef.id}`;
  root.add(model);

  const mixer = new THREE.AnimationMixer(model);
  let director = null;
  let clips = {};

  try {
    clips = await loadAnimPack(animPack);
    const hasAny = Object.values(clips).some(Boolean);
    if (hasAny) {
      director = new AnimationDirector(mixer, clips);
      console.info(
        `[grudge6Loader] ${classId} pack=${animPack} meshes=${shownMeshes.length}/${visibleMeshes.length}`,
        visibleMeshes,
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
    visibleMeshes,
    shownMeshes,
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
