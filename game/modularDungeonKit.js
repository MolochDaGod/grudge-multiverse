/**
 * Kenney Modular Dungeon Kit — asset loader + prefab triple.
 * Source: kenney_modular-dungeon-kit_1.0.zip (CC0)
 *
 * Prefab triple:
 *   model  /models/kenney/modular-dungeon-kit/{slug}.glb
 *   icon   /icons/kenney/modular-dungeon/{slug}.png
 *   sprite same as icon
 *
 * Local SPA first, CDN fallback when uploaded.
 * SI: modular tile 4 m · human 1.8 m · corridor clear ~3 m.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DUNGEON_GEN_VERSION, DUNGEON_TILE_M } from "./dungeonSeedGen.js";

const BASE =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) ||
  "/";

export const DUNGEON_KIT_GEN = DUNGEON_GEN_VERSION;
export const DUNGEON_CDN =
  "https://assets.grudge-studio.com/models/kenney/modular-dungeon-kit/";
export const DUNGEON_MODEL_DIR = `${BASE}models/kenney/modular-dungeon-kit/`;
export const DUNGEON_ICON_DIR = `${BASE}icons/kenney/modular-dungeon/`;
export const DUNGEON_CATALOG_URL = `${BASE}models/kenney/modular-dungeon-kit/catalog.json`;

/** @type {{ pieces: object[] } | null} */
let _catalog = null;
let _bySlug = new Map();
/** @type {Map<string, THREE.Object3D>} */
const _protoCache = new Map();
let _loader = null;

function getLoader() {
  if (!_loader) _loader = new GLTFLoader();
  return _loader;
}

export function dungeonModelUrl(slug) {
  const f = String(slug).endsWith(".glb") ? slug : `${slug}.glb`;
  return `${DUNGEON_MODEL_DIR}${f}`;
}

export function dungeonCdnUrl(slug) {
  const f = String(slug).endsWith(".glb") ? slug : `${slug}.glb`;
  return `${DUNGEON_CDN}${f}`;
}

export function dungeonIconUrl(slug) {
  const s = String(slug).replace(/\.glb$/, "");
  return `${DUNGEON_ICON_DIR}${s}.png`;
}

export function normalizePiece(p) {
  const slug = p.slug;
  return {
    ...p,
    id: p.id || `dungeon_${String(slug).replace(/-/g, "_")}`,
    name: p.name || slug,
    role: p.role || "prop",
    opening: !!p.opening,
    modelUrl: dungeonModelUrl(slug),
    cdnUrl: dungeonCdnUrl(slug),
    iconUrl: dungeonIconUrl(slug),
    prefabSprite: dungeonIconUrl(slug),
    targetHeightM: Number(p.targetHeightM) || 3.2,
    gridM: p.gridM || DUNGEON_TILE_M,
    kit: "kenney-modular-dungeon",
  };
}

export async function loadDungeonCatalog() {
  if (_catalog) return _catalog;
  try {
    const res = await fetch(DUNGEON_CATALOG_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _catalog = await res.json();
  } catch (e) {
    console.warn("[dungeonKit] catalog failed", e?.message || e);
    _catalog = { version: DUNGEON_KIT_GEN, pieces: [] };
  }
  _bySlug = new Map();
  for (const raw of _catalog.pieces || []) {
    const def = normalizePiece(raw);
    _bySlug.set(def.slug, def);
  }
  console.info(
    `[dungeonKit] ${DUNGEON_KIT_GEN} pieces=${_bySlug.size}`,
  );
  return _catalog;
}

export function getDungeonPiece(slug) {
  if (!slug) return null;
  const k = String(slug).replace(/\.glb$/, "");
  return _bySlug.get(k) || null;
}

export function allDungeonPrefabs() {
  return [..._bySlug.values()].map((d) => ({
    id: d.id,
    name: d.name,
    slug: d.slug,
    role: d.role,
    opening: d.opening,
    model: d.modelUrl,
    cdn: d.cdnUrl,
    icon: d.iconUrl,
    sprite: d.prefabSprite,
    targetHeightM: d.targetHeightM,
    gridM: d.gridM,
  }));
}

function prepMaterials(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      if (m.map) {
        m.map.colorSpace = THREE.SRGBColorSpace;
        m.map.flipY = false;
      }
      m.side = THREE.DoubleSide;
      m.needsUpdate = true;
    }
  });
}

/**
 * Fit module into tile footprint + height (SI). Ban 100×.
 */
export function fitDungeonModule(root, tileM = DUNGEON_TILE_M, heightM = 3.2) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  let h = size.y || 1;
  let w = Math.max(size.x, size.z) || 1;
  if (h > 40 || w > 40) {
    root.scale.multiplyScalar(0.01);
    root.updateMatrixWorld(true);
    box.setFromObject(root);
    box.getSize(size);
    h = size.y || 1;
    w = Math.max(size.x, size.z) || 1;
  }
  // Prefer fit to tile width (modular snap)
  const targetW = tileM * 0.98;
  const sW = targetW / Math.max(w, 1e-4);
  const sH = heightM / Math.max(h, 1e-4);
  // Use width-dominant scale so corridors align; clamp height extremes
  const s = Math.min(sW, sH * 1.35);
  root.scale.multiplyScalar(s);
  root.updateMatrixWorld(true);
  box.setFromObject(root);
  root.position.y -= box.min.y;
  // Center XZ on cell
  const cx = (box.min.x + box.max.x) * 0.5;
  const cz = (box.min.z + box.max.z) * 0.5;
  root.position.x -= cx;
  root.position.z -= cz;
  root.updateMatrixWorld(true);
  return root;
}

export async function loadDungeonPrototype(slug) {
  const key = String(slug).replace(/\.glb$/, "");
  if (_protoCache.has(key)) return _protoCache.get(key);
  await loadDungeonCatalog();
  const def = getDungeonPiece(key);
  const urls = [];
  if (def) urls.push(def.modelUrl, def.cdnUrl);
  else urls.push(dungeonModelUrl(key), dungeonCdnUrl(key));
  const tried = new Set();
  for (const url of urls) {
    if (!url || tried.has(url)) continue;
    tried.add(url);
    try {
      const gltf = await getLoader().loadAsync(url);
      const root = gltf.scene || gltf.scenes?.[0];
      if (!root) continue;
      prepMaterials(root);
      // Play gate animations if present (idle closed)
      if (gltf.animations?.length) {
        root.userData.animations = gltf.animations;
      }
      _protoCache.set(key, root);
      return root;
    } catch {
      /* next */
    }
  }
  console.warn("[dungeonKit] miss", key);
  return null;
}

/**
 * @returns {Promise<THREE.Group>}
 */
export async function createDungeonModule(slug, opts = {}) {
  const tileM = opts.tileM || DUNGEON_TILE_M;
  const def = getDungeonPiece(slug);
  const heightM = opts.heightM ?? def?.targetHeightM ?? 3.2;
  const g = new THREE.Group();
  g.name = `dungeon_${slug}`;
  g.userData.kit = "kenney-modular-dungeon";
  g.userData.slug = slug;
  g.userData.worldKind = "building";

  const proto = await loadDungeonPrototype(slug);
  if (proto) {
    const clone = proto.clone(true);
    fitDungeonModule(clone, tileM, heightM);
    g.add(clone);
  } else if (opts.fallbackBox !== false) {
    // Fail-closed modular placeholder (not capsule hero)
    const isFloor = def?.role === "floor";
    const mesh = new THREE.Mesh(
      isFloor
        ? new THREE.BoxGeometry(tileM * 0.95, 0.15, tileM * 0.95)
        : new THREE.BoxGeometry(tileM * 0.9, heightM, tileM * 0.9),
      new THREE.MeshStandardMaterial({
        color: def?.role === "room" ? 0x4a3a55 : 0x3a3a48,
        roughness: 0.9,
        flatShading: true,
      }),
    );
    mesh.position.y = isFloor ? 0.08 : heightM * 0.5;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
  }
  if (Number.isFinite(opts.yaw)) g.rotation.y = opts.yaw;
  return g;
}
