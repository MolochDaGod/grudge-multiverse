/**
 * Toon RTS production GLB loader — ONLY fleet race kits from assets CDN.
 *
 * ★ Primary:  asset-packs/toon-rts-characters/glb/characters/{human|elf|orc|…}.glb
 * Fallback:   models/grudge6/races/{PREFIX}_Characters.glb
 *
 * NEVER Mixamo person*.glb, Meshy, arena hosts, or bare un-asserted URLs.
 * Caller must SkeletonUtils.clone (not scene.clone on SkinnedMesh).
 */
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {
  assertAllowedKitUrl,
  assetUrlBust,
  CDN,
  GRUDGE6_SSOT_VERSION,
  isToonRtsKitUrl,
} from "./grudge6SSOT.js";

let _loader = null;
const _templateCache = new Map();

/** Draco + Meshopt production loader (grudge6-full-stack). */
export function getToonRtsGltfLoader() {
  if (_loader) return _loader;
  _loader = new GLTFLoader();
  try {
    const draco = new DRACOLoader();
    draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    _loader.setDRACOLoader(draco);
  } catch (e) {
    console.warn("[toonRtsLoader] DRACO optional fail", e?.message || e);
  }
  try {
    _loader.setMeshoptDecoder(MeshoptDecoder);
  } catch (e) {
    console.warn("[toonRtsLoader] Meshopt optional fail", e?.message || e);
  }
  return _loader;
}

/** Accept Toon ★ or legacy races Characters.glb (not Mixamo / metaverse). */
export function isAllowedToonRaceUrl(url) {
  const u = String(url || "").split("?")[0];
  if (isToonRtsKitUrl(u)) return true;
  return /\/models\/grudge6\/races\/[A-Z]+_Characters\.glb$/i.test(u);
}

/**
 * Load race kit template scene. Prefer Toon RTS ★ URL from grudge6SSOT.kitGlb.
 * @param {string} kitUrl
 * @returns {Promise<import('three').Object3D>}
 */
export async function loadToonRtsRaceTemplate(kitUrl) {
  const raw = assertAllowedKitUrl(kitUrl);
  if (!isAllowedToonRaceUrl(raw)) {
    throw new Error(`[toonRtsLoader] REFUSED non-race kit URL: ${raw}`);
  }
  const url = assetUrlBust(raw);
  if (_templateCache.has(url)) return _templateCache.get(url);

  const label = raw.split("/").pop();
  window.setLoaderStatus?.(`Toon RTS ${label}…`);
  const loader = getToonRtsGltfLoader();
  const gltf = await loader.loadAsync(url);
  const scene = gltf.scene;
  scene.userData.toonRts = isToonRtsKitUrl(raw);
  scene.userData.kitUrl = raw;
  scene.userData.ssotVersion = GRUDGE6_SSOT_VERSION;
  scene.userData.cdn = CDN;
  scene.userData.pipeline = isToonRtsKitUrl(raw) ? "toon_rts_glb" : "legacy_races_glb";
  scene.traverse((o) => {
    if (o.isSkinnedMesh && o.skeleton) {
      o.skeleton.pose();
      o.skeleton.update();
      o.frustumCulled = true;
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  _templateCache.set(url, scene);
  console.info(
    `[toonRtsLoader] ${label} pipeline=${scene.userData.pipeline} ssot=${GRUDGE6_SSOT_VERSION}`,
  );
  return scene;
}

export function clearToonRtsTemplateCache() {
  _templateCache.clear();
}
