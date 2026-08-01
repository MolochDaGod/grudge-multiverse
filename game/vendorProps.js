/**
 * Vendor location props — weapon vendor booth GLB + SI place + near-E interact.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

const BASE = import.meta.env.BASE_URL || "/";

const VENDOR_MESH = {
  weapon: {
    urls: [
      `${BASE}models/vendors/weaponvendor.glb`,
      `/models/vendors/weaponvendor.glb`,
    ],
    /** Target booth height (m) — human 1.8 yardstick, stall ~4.5 m */
    heightM: 4.5,
  },
  armor: {
    urls: [
      `${BASE}models/vendors/weaponvendor.glb`,
      `/models/vendors/weaponvendor.glb`,
    ],
    heightM: 4.2,
  },
};

let _loader = null;
function getLoader() {
  if (_loader) return _loader;
  _loader = new GLTFLoader();
  try {
    const d = new DRACOLoader();
    d.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    _loader.setDRACOLoader(d);
  } catch {
    /* */
  }
  return _loader;
}

function fitPropHeight(root, heightM) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  let h = size.y || 1;
  if (h > 40) {
    root.scale.multiplyScalar(0.01);
    root.updateMatrixWorld(true);
    box.setFromObject(root);
    box.getSize(size);
    h = size.y || 1;
  }
  if (h > 1e-4) {
    root.scale.multiplyScalar(heightM / h);
    root.updateMatrixWorld(true);
  }
  box.setFromObject(root);
  root.position.y -= box.min.y;
  root.updateMatrixWorld(true);
  return size.y * (root.scale.y || 1);
}

/**
 * Load vendor GLB at world position. Returns root group + interact radius.
 * @param {THREE.Scene} scene
 * @param {{ id: string, position: THREE.Vector3, label: string }} pad
 * @param {(x:number,z:number)=>number|null} groundAt
 */
export async function spawnVendorProp(scene, pad, groundAt) {
  const kind = pad.id === "armor" ? "armor" : "weapon";
  const conf = VENDOR_MESH[kind] || VENDOR_MESH.weapon;
  const root = new THREE.Group();
  root.name = `vendor_${pad.id}`;
  const gy = groundAt?.(pad.position.x, pad.position.z) ?? pad.position.y ?? 0;
  root.position.set(pad.position.x, gy, pad.position.z);

  let loaded = false;
  for (const url of conf.urls) {
    try {
      const gltf = await getLoader().loadAsync(url);
      const model = gltf.scene;
      model.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (m?.map) {
            m.map.colorSpace = THREE.SRGBColorSpace;
            m.map.flipY = false;
          }
          // SpecGloss fallback materials still render
          if (m) {
            m.side = THREE.DoubleSide;
            m.needsUpdate = true;
          }
        }
      });
      fitPropHeight(model, conf.heightM);
      root.add(model);
      loaded = true;
      console.info("[vendor] loaded", pad.id, url);
      break;
    } catch (e) {
      console.warn("[vendor] miss", url, e?.message || e);
    }
  }

  if (!loaded) {
    // Fallback stall
    const stall = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 2.2, 2.0),
      new THREE.MeshStandardMaterial({ color: kind === "armor" ? 0x4a6a9a : 0xc8a84b }),
    );
    stall.position.y = 1.1;
    stall.castShadow = true;
    root.add(stall);
  }

  // Interact ring
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 2.45, 32),
    new THREE.MeshBasicMaterial({
      color: 0x6ecbff,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  root.add(ring);

  scene.add(root);
  return {
    id: pad.id,
    label: pad.label,
    root,
    /** very near — tight interact */
    interactRadius: 2.8,
    kind,
  };
}
