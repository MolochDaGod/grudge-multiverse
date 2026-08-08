/**
 * 1 m snap build system — Kenney Retro Fantasy modular pieces.
 * SI: grid step 1 m; place on ground sample; real GLB + textures (local / CDN).
 *
 * Toggle: B · place: LMB while in build mode · rotate: R · cancel: Esc
 * Does not invent a second inventory — uses bag mats (t0_wood / t0_stone).
 * Kit SSOT: game/retroFantasyKit.js · docs/KENNEY_RETRO_FANTASY_SSOT.md
 */
import * as THREE from "three";
import { loadBag, saveBag } from "./inventory.js";
import { COLLIDER_LAYER } from "./mapLiteracy.js";
import {
  loadRetroCatalog,
  buildSnapPiecesFromKit,
  createPieceInstance,
  RETRO_FANTASY_GEN,
} from "./retroFantasyKit.js";

export const BUILD_GRID_M = 1;

/** Static fallback until catalog loads (same ids as kit palette). */
export const BUILD_PIECES = [
  {
    id: "wall",
    slug: "wall",
    name: "Wall",
    cost: { id: "t0_wood", qty: 2 },
    size: [1, 2.4, 0.15],
    color: 0x6b4a2a,
    kit: "kenney-retro-fantasy",
  },
  {
    id: "wood-floor",
    slug: "wood-floor",
    name: "Wood Floor",
    cost: { id: "t0_wood", qty: 1 },
    size: [1, 0.12, 1],
    color: 0x7a5a32,
    kit: "kenney-retro-fantasy",
  },
  {
    id: "bricks",
    slug: "bricks",
    name: "Bricks",
    cost: { id: "t0_stone", qty: 2 },
    size: [1, 1, 1],
    color: 0x6a6a66,
    kit: "kenney-retro-fantasy",
  },
  {
    id: "column",
    slug: "column",
    name: "Column",
    cost: { id: "t0_wood", qty: 1 },
    size: [0.35, 3, 0.35],
    color: 0x5a4030,
    kit: "kenney-retro-fantasy",
  },
  {
    id: "fence-wood",
    slug: "fence-wood",
    name: "Fence Wood",
    cost: { id: "t0_wood", qty: 1 },
    size: [1, 1.1, 0.12],
    color: 0x6b4a2a,
    kit: "kenney-retro-fantasy",
  },
  {
    id: "structure",
    slug: "structure",
    name: "Structure",
    cost: { id: "t0_wood", qty: 3 },
    size: [2, 3.2, 2],
    color: 0x5a4030,
    kit: "kenney-retro-fantasy",
  },
  {
    id: "roof",
    slug: "roof",
    name: "Roof",
    cost: { id: "t0_wood", qty: 2 },
    size: [2, 1.8, 2],
    color: 0x8b3a2a,
    kit: "kenney-retro-fantasy",
  },
  {
    id: "tower-base",
    slug: "tower-base",
    name: "Tower Base",
    cost: { id: "t0_stone", qty: 4 },
    size: [2, 4, 2],
    color: 0x6a6a66,
    kit: "kenney-retro-fantasy",
  },
];

function snap(v, step = BUILD_GRID_M) {
  return Math.round(v / step) * step;
}

function hasCost(bag, cost) {
  const it = (bag.items || []).find((i) => i.id === cost.id);
  return (it?.qty || 0) >= cost.qty;
}

function spendCost(bag, cost) {
  const it = (bag.items || []).find((i) => i.id === cost.id);
  if (!it || it.qty < cost.qty) return false;
  it.qty -= cost.qty;
  if (it.qty <= 0) bag.items = bag.items.filter((i) => i.qty > 0);
  return true;
}

/**
 * @param {THREE.Scene} scene
 * @param {object} island
 * @param {(x:number,z:number)=>number|null} groundAt
 * @param {{ flash?: Function, getCamera?: Function, getPlayerPos?: Function }} opts
 */
export function mountBuildSnap(scene, island, groundAt, opts = {}) {
  const root = new THREE.Group();
  root.name = "build-snap";
  scene.add(root);

  /** @type {typeof BUILD_PIECES} */
  let pieces = BUILD_PIECES.slice();
  let mode = false;
  let pieceIndex = 0;
  let yaw = 0;
  const placed = [];

  const ghostMat = new THREE.MeshStandardMaterial({
    color: 0x4a9eff,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    roughness: 0.6,
  });
  let ghost = null;
  /** @type {THREE.Object3D|null} */
  let ghostMesh = null;

  function currentPiece() {
    return pieces[pieceIndex % pieces.length];
  }

  function rebuildGhost() {
    if (ghost) {
      root.remove(ghost);
      ghost.traverse?.((o) => {
        if (o.geometry) o.geometry.dispose?.();
      });
    }
    const p = currentPiece();
    ghost = new THREE.Group();
    ghost.name = "build-ghost";
    ghostMesh = new THREE.Mesh(
      new THREE.BoxGeometry(p.size[0], p.size[1], p.size[2]),
      ghostMat,
    );
    ghostMesh.position.y = p.size[1] * 0.5;
    ghost.add(ghostMesh);
    ghost.visible = mode;
    root.add(ghost);

    // Upgrade ghost to translucent kit clone when available
    const slug = p.slug || p.id;
    createPieceInstance(slug, { fallbackBox: false, heightM: p.targetHeightM || p.size[1] })
      .then((inst) => {
        if (!inst || !ghost || currentPiece().id !== p.id) return;
        ghost.clear();
        inst.traverse((o) => {
          if (!o.isMesh || !o.material) return;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          const cloned = mats.map((m) => {
            const c = m.clone();
            c.transparent = true;
            c.opacity = 0.5;
            c.depthWrite = false;
            return c;
          });
          o.material = cloned.length === 1 ? cloned[0] : cloned;
        });
        ghost.add(inst);
      })
      .catch(() => {});
  }
  rebuildGhost();

  // Async: load Kenney retro-fantasy palette
  loadRetroCatalog()
    .then(() => {
      const kitPieces = buildSnapPiecesFromKit();
      if (kitPieces.length) {
        pieces = kitPieces;
        pieceIndex = 0;
        rebuildGhost();
        console.info(
          `[buildSnap] ${RETRO_FANTASY_GEN} palette=${pieces.length} pieces`,
        );
      }
    })
    .catch((e) => console.warn("[buildSnap] kit load", e?.message || e));

  function groundY(x, z) {
    try {
      const g = groundAt?.(x, z);
      if (Number.isFinite(g)) return g;
    } catch {
      /* */
    }
    return island.waterY ?? 0.25;
  }

  function aimPoint() {
    const cam = opts.getCamera?.();
    const pos = opts.getPlayerPos?.();
    if (!cam) {
      if (!pos) return null;
      return new THREE.Vector3(pos.x + 2, groundY(pos.x + 2, pos.z), pos.z);
    }
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const origin = cam.position.clone();
    const t = 4 / Math.max(0.2, Math.hypot(dir.x, dir.z));
    const x = origin.x + dir.x * t;
    const z = origin.z + dir.z * t;
    return new THREE.Vector3(snap(x), 0, snap(z));
  }

  function updateGhost() {
    if (!mode || !ghost) return;
    const p = aimPoint();
    if (!p) return;
    const gy = groundY(p.x, p.z);
    // Plant feet on ground (GLB instances already footed at y=0)
    ghost.position.set(p.x, gy, p.z);
    ghost.rotation.y = yaw;
    ghost.visible = true;
  }

  async function tryPlace() {
    if (!mode || !ghost) return false;
    const piece = currentPiece();
    const bag = loadBag();
    if (!hasCost(bag, piece.cost)) {
      opts.flash?.(`Need ${piece.cost.qty}× ${piece.cost.id}`, 1.2);
      return false;
    }
    if (!spendCost(bag, piece.cost)) return false;
    saveBag(bag);
    window.dispatchEvent(new CustomEvent("mv-bag", { detail: bag }));

    const slug = piece.slug || piece.id;
    const gx = ghost.position.x;
    const gy = ghost.position.y;
    const gz = ghost.position.z;

    let mesh = await createPieceInstance(slug, {
      yaw,
      heightM: piece.targetHeightM || piece.size?.[1],
      fallbackBox: true,
    });
    if (!mesh) {
      mesh = new THREE.Mesh(
        new THREE.BoxGeometry(piece.size[0], piece.size[1], piece.size[2]),
        new THREE.MeshStandardMaterial({
          color: piece.color || 0x6b4a2a,
          roughness: 0.88,
          flatShading: true,
        }),
      );
      mesh.position.set(0, piece.size[1] * 0.5, 0);
      const wrap = new THREE.Group();
      wrap.add(mesh);
      mesh = wrap;
    }
    mesh.position.set(gx, gy, gz);
    mesh.rotation.y = yaw;
    mesh.name = `build-${piece.id}-${placed.length}`;
    mesh.userData.worldKind = "building";
    mesh.userData.colliderLayer = COLLIDER_LAYER.SOLID;
    mesh.userData.buildPiece = piece.id;
    mesh.userData.slug = slug;
    mesh.userData.kit = "kenney-retro-fantasy";
    root.add(mesh);
    placed.push({
      id: mesh.name,
      pieceId: piece.id,
      slug,
      x: gx,
      y: gy,
      z: gz,
      yaw,
    });
    try {
      island.worldPhysics?.addStaticBox?.(
        gx,
        gy + (piece.size?.[1] || 1) * 0.5,
        gz,
        (piece.size?.[0] || 1) * 0.5,
        (piece.size?.[1] || 1) * 0.5,
        (piece.size?.[2] || 1) * 0.5,
      );
    } catch {
      /* */
    }
    opts.flash?.(`Placed ${piece.name}`, 0.7);
    return true;
  }

  function setMode(on) {
    mode = !!on;
    if (ghost) ghost.visible = mode;
    opts.flash?.(
      mode
        ? `Build ON · ${currentPiece().name} · LMB place · R rotate · [ ] piece · B off · ${RETRO_FANTASY_GEN}`
        : "Build OFF",
      1.4,
    );
  }

  function onKey(e) {
    if (e.code === "KeyB" && !e.repeat) {
      setMode(!mode);
      e.preventDefault?.();
      return;
    }
    if (!mode) return;
    if (e.code === "KeyR" && !e.repeat) {
      yaw += Math.PI / 2;
      e.preventDefault?.();
    }
    if (e.code === "BracketRight") {
      pieceIndex = (pieceIndex + 1) % pieces.length;
      rebuildGhost();
      opts.flash?.(currentPiece().name, 0.6);
    }
    if (e.code === "BracketLeft") {
      pieceIndex = (pieceIndex + pieces.length - 1) % pieces.length;
      rebuildGhost();
      opts.flash?.(currentPiece().name, 0.6);
    }
    if (e.code === "Escape") setMode(false);
  }

  function onClick(e) {
    if (!mode || e.button !== 0) return;
    tryPlace();
  }

  window.addEventListener("keydown", onKey);
  window.addEventListener("mousedown", onClick);

  return {
    root,
    placed,
    getPieces: () => pieces,
    isMode: () => mode,
    setMode,
    update() {
      updateGhost();
    },
    dispose() {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    },
  };
}
