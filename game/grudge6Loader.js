/**
 * Lightweight grudge6 kit loader for Multiverse (CDN race GLB + SI fit + gear hide/show).
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { getClass } from "./classes.js";

const HUMAN_HEIGHT_M = 1.8;

let _loader = null;
function getLoader() {
  if (_loader) return _loader;
  _loader = new GLTFLoader();
  try {
    const draco = new DRACOLoader();
    draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    _loader.setDRACOLoader(draco);
  } catch { /* ignore */ }
  return _loader;
}

const templateCache = new Map();

async function loadTemplate(url) {
  if (templateCache.has(url)) return templateCache.get(url);
  const gltf = await getLoader().loadAsync(url);
  templateCache.set(url, gltf.scene);
  return gltf.scene;
}

function meshKey(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/^wk_|^brb_|^orc_|^elf_|^ud_|^dwf_/, "")
    .replace(/units_/g, "")
    .replace(/xtra_/g, "")
    .replace(/weapon_/g, "weapon")
    .replace(/[^a-z0-9]/g, "");
}

function hideEquippable(root) {
  root.traverse((o) => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    const k = meshKey(o.name);
    // Keep only core if huge wardrobe — hide weapon-like extras by default
    if (/bag|wood|quiver|shield|sword|axe|bow|staff|spear|dagger|mace|hammer|pick/i.test(o.name)) {
      o.userData._equipSlot = true;
      o.visible = false;
    }
  });
}

function showByHints(root, hints = []) {
  const keys = hints.map(meshKey);
  root.traverse((o) => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    const k = meshKey(o.name);
    // Body parts always on if name matches body/arms/legs/head
    if (/body|arms|legs|head|shoulder/.test(k)) {
      o.visible = true;
      return;
    }
    if (keys.some((h) => k.includes(h) || h.includes(k))) {
      o.visible = true;
    }
  });
}

function fitSiHeight(root) {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.y < 0.01) return;
  // Fix classic 100×
  if (size.y > 50) {
    root.scale.multiplyScalar(0.01);
    box.setFromObject(root);
    box.getSize(size);
  }
  const s = HUMAN_HEIGHT_M / size.y;
  root.scale.multiplyScalar(s);
  box.setFromObject(root);
  root.position.y -= box.min.y;
}

/**
 * @param {string} classId
 * @returns {Promise<{ root: THREE.Group, model: THREE.Object3D, classDef: object, mixer: THREE.AnimationMixer }>}
 */
export async function loadGrudge6Class(classId) {
  const classDef = getClass(classId);
  let template;
  try {
    template = await loadTemplate(classDef.kitUrl);
  } catch (e) {
    console.warn("[grudge6Loader] CDN kit fail, using capsule stand-in", e);
    return makeCapsuleStandIn(classDef);
  }
  const model = SkeletonUtils.clone(template);
  hideEquippable(model);
  showByHints(model, classDef.meshHints);

  // Materials: ensure not pure black
  model.traverse((o) => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
        m.metalness = Math.min(m.metalness ?? 0.1, 0.25);
        m.roughness = Math.max(m.roughness ?? 0.7, 0.55);
        m.side = THREE.DoubleSide;
      }
    }
  });

  fitSiHeight(model);

  const root = new THREE.Group();
  root.name = `grudge6_${classDef.id}`;
  root.add(model);
  const mixer = new THREE.AnimationMixer(model);

  return { root, model, classDef, mixer };
}

function makeCapsuleStandIn(classDef) {
  const colors = { warrior: 0x4a6a9a, ranger: 0x3a7a4a, mage: 0x6a3a8a, worge: 0x8a3a2a };
  const root = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.32, 1.0, 6, 12),
    new THREE.MeshStandardMaterial({ color: colors[classDef.id] || 0x888888 }),
  );
  body.position.y = 0.9;
  root.add(body);
  const mixer = new THREE.AnimationMixer(root);
  return { root, model: body, classDef, mixer, standIn: true };
}
