/**
 * Kenney Retro Fantasy Kit — modular buildings, camps, player structures.
 * Source: kenney_retro-fantasy-kit.zip (CC0)
 *
 * Prefab triple per piece:
 *   model  /models/kenney/retro-fantasy-kit/{slug}.glb
 *   icon   /icons/kenney/retro-fantasy/{slug}.png
 *   sprite same as icon
 *
 * CDN primary: assets.grudge-studio.com/models/kenney/retro-fantasy-kit/
 * Local fallback: public/ (Vercel SPA)
 *
 * SI: modular tile ~1 m · human 1.8 m yardstick. Fit height, never 100× giants.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const BASE =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) ||
  "/";

export const RETRO_FANTASY_GEN = "2026-08-08.1-kenney-retro-fantasy";
export const RETRO_CDN =
  "https://assets.grudge-studio.com/models/kenney/retro-fantasy-kit/";
export const RETRO_MODEL_DIR = `${BASE}models/kenney/retro-fantasy-kit/`;
export const RETRO_ICON_DIR = `${BASE}icons/kenney/retro-fantasy/`;
export const RETRO_CATALOG_URL = `${BASE}models/kenney/retro-fantasy-kit/catalog.json`;

/** Player snap-build palette (extend existing buildSnap — not a second system). */
export const PLAYER_BUILD_SLUGS = [
  "wall",
  "wall-door",
  "wall-window",
  "wall-half",
  "wood-floor",
  "floor",
  "fence-wood",
  "fence",
  "column",
  "structure",
  "structure-wall",
  "roof",
  "tower-base",
  "stairs-wood",
  "detail-crate",
  "barrels",
  "bricks",
];

/**
 * Settlement / camp modular layouts (local offsets metres).
 * kind: town | farm | camp
 */
export const SETTLEMENT_LAYOUTS = {
  town: [
    { slug: "structure", dx: 0, dz: 0, yaw: 0 },
    { slug: "roof", dx: 0, dz: 0, yaw: 0, dy: 3.0 },
    { slug: "tower-base", dx: 6, dz: -4, yaw: 0 },
    { slug: "wall", dx: -4, dz: 3, yaw: 0 },
    { slug: "wall-door", dx: 0, dz: 5, yaw: 0 },
    { slug: "wall-window", dx: 4, dz: 3, yaw: Math.PI / 2 },
    { slug: "fence-wood", dx: -8, dz: 0, yaw: Math.PI / 2 },
    { slug: "fence-wood", dx: 8, dz: 0, yaw: Math.PI / 2 },
    { slug: "detail-crate", dx: 2.5, dz: 2, yaw: 0.4 },
    { slug: "barrels", dx: -2.2, dz: 2.4, yaw: 0 },
  ],
  farm: [
    { slug: "structure-wall", dx: 0, dz: 0, yaw: 0 },
    { slug: "roof-side", dx: 0, dz: 0, yaw: 0, dy: 2.6 },
    { slug: "fence-wood", dx: -6, dz: 0, yaw: Math.PI / 2 },
    { slug: "fence-wood", dx: 6, dz: 0, yaw: Math.PI / 2 },
    { slug: "fence", dx: 0, dz: -6, yaw: 0 },
    { slug: "fence", dx: 0, dz: 6, yaw: 0 },
    { slug: "wood-floor", dx: 0, dz: 3, yaw: 0 },
    { slug: "detail-crate", dx: 1.5, dz: 1.2, yaw: 0.2 },
    { slug: "barrels", dx: -1.8, dz: 1.5, yaw: 0 },
  ],
  camp: [
    { slug: "structure-poles", dx: 0, dz: 0, yaw: 0 },
    { slug: "structure-wall", dx: 0, dz: 0, yaw: Math.PI / 4 },
    { slug: "fence-wood", dx: -5, dz: 0, yaw: Math.PI / 2 },
    { slug: "fence-wood", dx: 5, dz: 0, yaw: Math.PI / 2 },
    { slug: "fence", dx: 0, dz: -5, yaw: 0 },
    { slug: "fence", dx: 0, dz: 5, yaw: 0 },
    { slug: "tower-edge", dx: 4, dz: -4, yaw: 0 },
    { slug: "detail-crate", dx: 1.2, dz: 0.8, yaw: 0.5 },
    { slug: "detail-crate-small", dx: -1.4, dz: 1.1, yaw: -0.3 },
    { slug: "barrels", dx: -2, dz: -1.2, yaw: 0.1 },
    { slug: "detail-barrel", dx: 2.2, dz: -0.6, yaw: 0 },
  ],
};

/** @type {{ pieces: object[] } | null} */
let _catalog = null;
let _bySlug = new Map();
let _byId = new Map();
/** @type {Map<string, THREE.Object3D>} */
const _protoCache = new Map();
let _loader = null;

function getLoader() {
  if (!_loader) _loader = new GLTFLoader();
  return _loader;
}

export function retroModelUrl(slug) {
  const f = String(slug).endsWith(".glb") ? slug : `${slug}.glb`;
  return `${RETRO_MODEL_DIR}${f}`;
}

export function retroCdnUrl(slug) {
  const f = String(slug).endsWith(".glb") ? slug : `${slug}.glb`;
  return `${RETRO_CDN}${f}`;
}

export function retroIconUrl(slug) {
  const s = String(slug).replace(/\.glb$/, "");
  return `${RETRO_ICON_DIR}${s}.png`;
}

export function normalizePiece(p) {
  const slug = p.slug;
  return {
    ...p,
    id: p.id || `build_${String(slug).replace(/-/g, "_")}`,
    name: p.name || slug,
    role: p.role || "prop",
    buildable: p.buildable !== false && p.role !== "nature" && p.role !== "water",
    modelUrl: retroModelUrl(slug),
    cdnUrl: retroCdnUrl(slug),
    iconUrl: retroIconUrl(slug),
    prefabSprite: retroIconUrl(slug),
    targetHeightM: Number(p.targetHeightM) || 1.5,
    cost: p.cost || { id: "t0_wood", qty: 1 },
    gridM: p.gridM || 1,
    kit: "kenney-retro-fantasy",
  };
}

export async function loadRetroCatalog() {
  if (_catalog) return _catalog;
  try {
    const res = await fetch(RETRO_CATALOG_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _catalog = await res.json();
  } catch (e) {
    console.warn("[retroFantasy] catalog load failed", e?.message || e);
    _catalog = { version: RETRO_FANTASY_GEN, pieces: [] };
  }
  _bySlug = new Map();
  _byId = new Map();
  for (const raw of _catalog.pieces || []) {
    const def = normalizePiece(raw);
    _bySlug.set(def.slug, def);
    _byId.set(def.id, def);
  }
  console.info(
    `[retroFantasy] ${RETRO_FANTASY_GEN} pieces=${_bySlug.size} buildable=${allBuildPieces().length}`,
  );
  return _catalog;
}

export function getPiece(idOrSlug) {
  if (!idOrSlug) return null;
  const k = String(idOrSlug);
  return (
    _bySlug.get(k) ||
    _byId.get(k) ||
    _bySlug.get(k.replace(/^build_/, "").replace(/_/g, "-")) ||
    null
  );
}

export function allBuildPieces() {
  return [..._bySlug.values()].filter((p) => p.buildable);
}

export function allPrefabs() {
  return [..._bySlug.values()].map((d) => ({
    id: d.id,
    name: d.name,
    slug: d.slug,
    role: d.role,
    buildable: d.buildable,
    model: d.modelUrl,
    cdn: d.cdnUrl,
    icon: d.iconUrl,
    sprite: d.prefabSprite,
    targetHeightM: d.targetHeightM,
    cost: d.cost,
  }));
}

export function playerBuildPalette() {
  const out = [];
  for (const slug of PLAYER_BUILD_SLUGS) {
    const def = getPiece(slug);
    if (def) out.push(def);
  }
  return out;
}

/**
 * Fit Kenney modular piece to target height (SI). Strip 100× cm mistake.
 */
export function fitPieceHeight(root, heightM) {
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
  // Floors / flat: prefer natural XZ if nearly flat
  if (heightM < 0.35 && size.x > 0.1) {
    const targetW = 1.0;
    const s = targetW / Math.max(size.x, size.z, 1e-4);
    root.scale.multiplyScalar(s);
  } else if (h > 1e-4 && heightM > 0) {
    root.scale.multiplyScalar(heightM / h);
  }
  root.updateMatrixWorld(true);
  box.setFromObject(root);
  // plant feet at y=0 of local parent
  root.position.y -= box.min.y;
  root.updateMatrixWorld(true);
  return root;
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
 * Load a piece prototype (cached clone source).
 * Tries local SPA path first, then CDN.
 * @returns {Promise<THREE.Object3D|null>}
 */
export async function loadPiecePrototype(slug) {
  const key = String(slug).replace(/\.glb$/, "");
  if (_protoCache.has(key)) return _protoCache.get(key);

  await loadRetroCatalog();
  const def = getPiece(key);
  const urls = [];
  if (def) {
    urls.push(def.modelUrl, def.cdnUrl);
  } else {
    urls.push(retroModelUrl(key), retroCdnUrl(key));
  }
  // unique
  const tried = new Set();
  for (const url of urls) {
    if (!url || tried.has(url)) continue;
    tried.add(url);
    try {
      const gltf = await getLoader().loadAsync(url);
      const root = gltf.scene || gltf.scenes?.[0];
      if (!root) continue;
      prepMaterials(root);
      _protoCache.set(key, root);
      return root;
    } catch {
      /* try next */
    }
  }
  console.warn("[retroFantasy] miss", key);
  return null;
}

/**
 * Clone a fitted instance for world placement.
 * @returns {Promise<THREE.Group|null>}
 */
export async function createPieceInstance(slug, opts = {}) {
  const proto = await loadPiecePrototype(slug);
  const def = getPiece(slug);
  const g = new THREE.Group();
  g.name = `retro_${slug}`;
  g.userData.kit = "kenney-retro-fantasy";
  g.userData.slug = slug;
  g.userData.worldKind = "building";
  if (proto) {
    const clone = proto.clone(true);
    const h = opts.heightM ?? def?.targetHeightM ?? 1.5;
    fitPieceHeight(clone, h);
    g.add(clone);
  } else if (opts.fallbackBox !== false) {
    const h = opts.heightM ?? def?.targetHeightM ?? 1.5;
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(1, h, 0.2),
      new THREE.MeshStandardMaterial({
        color: 0x6b4a2a,
        roughness: 0.88,
        flatShading: true,
      }),
    );
    box.position.y = h * 0.5;
    box.castShadow = true;
    g.add(box);
  } else {
    return null;
  }
  if (Number.isFinite(opts.yaw)) g.rotation.y = opts.yaw;
  return g;
}

/**
 * Spawn modular settlement/camp buildings at (x,y,z).
 * @returns {Promise<THREE.Group>}
 */
export async function spawnSettlementModular(scene, settlement, groundAt) {
  await loadRetroCatalog();
  const kind = settlement.kind || "camp";
  const layout = SETTLEMENT_LAYOUTS[kind] || SETTLEMENT_LAYOUTS.camp;
  const root = new THREE.Group();
  root.name = `settlement_build_${settlement.id || kind}`;
  root.userData.settlementId = settlement.id;
  root.userData.kind = kind;
  root.userData.kit = "kenney-retro-fantasy";

  const cx = settlement.x || 0;
  const cz = settlement.z || 0;
  let gy = settlement.y;
  if (!Number.isFinite(gy)) {
    try {
      gy = groundAt?.(cx, cz);
    } catch {
      /* */
    }
  }
  if (!Number.isFinite(gy)) gy = 0;
  root.position.set(cx, gy, cz);

  const jobs = layout.map(async (piece, i) => {
    const inst = await createPieceInstance(piece.slug, {
      yaw: piece.yaw || 0,
      fallbackBox: true,
    });
    if (!inst) return;
    const lx = piece.dx || 0;
    const lz = piece.dz || 0;
    let localY = piece.dy || 0;
    // land snap offset pieces
    try {
      const wy = groundAt?.(cx + lx, cz + lz);
      if (Number.isFinite(wy)) localY += wy - gy;
    } catch {
      /* */
    }
    inst.position.set(lx, localY, lz);
    inst.userData.layoutIndex = i;
    root.add(inst);
  });
  await Promise.all(jobs);
  scene.add(root);
  return root;
}

/**
 * BUILD_PIECES-compatible entries for buildSnap.
 */
export function buildSnapPiecesFromKit() {
  const palette = playerBuildPalette();
  if (!palette.length) {
    // catalog not loaded — static fallback slugs
    return PLAYER_BUILD_SLUGS.map((slug) => ({
      id: slug,
      slug,
      name: slug.replace(/-/g, " "),
      cost: { id: "t0_wood", qty: slug.includes("tower") || slug === "bricks" ? 3 : 2 },
      size: [1, slug.includes("floor") ? 0.15 : 2.4, slug.includes("floor") ? 1 : 0.2],
      color: 0x6b4a2a,
      kit: "kenney-retro-fantasy",
    }));
  }
  return palette.map((def) => {
    const isFloor = def.role === "floor";
    const isFence = def.role === "fence";
    const h = def.targetHeightM || 2.4;
    return {
      id: def.slug,
      slug: def.slug,
      name: def.name,
      cost: def.cost || { id: "t0_wood", qty: 2 },
      size: isFloor
        ? [1, Math.max(0.1, h), 1]
        : isFence
          ? [1, h, 0.12]
          : [1, h, 0.2],
      color: def.role === "tower" ? 0x6a6a66 : 0x6b4a2a,
      kit: "kenney-retro-fantasy",
      modelUrl: def.modelUrl,
      iconUrl: def.iconUrl,
      targetHeightM: h,
      role: def.role,
    };
  });
}
