/**
 * 1 m snap build system — Kenney / SeedThree living-scene practice.
 * SI: grid step 1 m; place on ground sample; stylized placeholder + CDN kit hooks.
 *
 * Toggle: B · place: LMB while in build mode · rotate: R · cancel: Esc
 * Does not invent a second inventory — uses bag mats (t0_wood / t0_stone).
 */
import * as THREE from "three";
import { addItem, loadBag, saveBag } from "./inventory.js";
import { COLLIDER_LAYER } from "./mapLiteracy.js";

export const BUILD_GRID_M = 1;
export const BUILD_PIECES = [
  {
    id: "wall",
    name: "Wood Wall",
    cost: { id: "t0_wood", qty: 2 },
    size: [1, 2.4, 0.15],
    color: 0x6b4a2a,
  },
  {
    id: "floor",
    name: "Wood Floor",
    cost: { id: "t0_wood", qty: 1 },
    size: [1, 0.12, 1],
    color: 0x7a5a32,
  },
  {
    id: "stone_block",
    name: "Stone Block",
    cost: { id: "t0_stone", qty: 2 },
    size: [1, 1, 1],
    color: 0x6a6a66,
  },
  {
    id: "pillar",
    name: "Pillar",
    cost: { id: "t0_wood", qty: 1 },
    size: [0.35, 3, 0.35],
    color: 0x5a4030,
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

  function currentPiece() {
    return BUILD_PIECES[pieceIndex % BUILD_PIECES.length];
  }

  function rebuildGhost() {
    if (ghost) {
      root.remove(ghost);
      ghost.geometry?.dispose?.();
    }
    const p = currentPiece();
    ghost = new THREE.Mesh(
      new THREE.BoxGeometry(p.size[0], p.size[1], p.size[2]),
      ghostMat,
    );
    ghost.name = "build-ghost";
    ghost.visible = mode;
    root.add(ghost);
  }
  rebuildGhost();

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
    // place ~4 m ahead on ground
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
    const piece = currentPiece();
    const gy = groundY(p.x, p.z);
    ghost.position.set(p.x, gy + piece.size[1] * 0.5, p.z);
    ghost.rotation.y = yaw;
    ghost.visible = true;
  }

  function tryPlace() {
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

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(piece.size[0], piece.size[1], piece.size[2]),
      new THREE.MeshStandardMaterial({
        color: piece.color,
        roughness: 0.88,
        flatShading: true,
      }),
    );
    mesh.position.copy(ghost.position);
    mesh.rotation.y = yaw;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `build-${piece.id}-${placed.length}`;
    mesh.userData.worldKind = "building";
    mesh.userData.colliderLayer = COLLIDER_LAYER.SOLID;
    mesh.userData.buildPiece = piece.id;
    root.add(mesh);
    placed.push({
      id: mesh.name,
      pieceId: piece.id,
      x: mesh.position.x,
      y: mesh.position.y,
      z: mesh.position.z,
      yaw,
    });
    // Rapier static if available
    try {
      island.worldPhysics?.addStaticBox?.(
        mesh.position.x,
        mesh.position.y,
        mesh.position.z,
        piece.size[0] * 0.5,
        piece.size[1] * 0.5,
        piece.size[2] * 0.5,
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
        ? `Build ON · ${currentPiece().name} · LMB place · R rotate · [ ] piece · B off`
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
      pieceIndex = (pieceIndex + 1) % BUILD_PIECES.length;
      rebuildGhost();
      opts.flash?.(currentPiece().name, 0.6);
    }
    if (e.code === "BracketLeft") {
      pieceIndex = (pieceIndex + BUILD_PIECES.length - 1) % BUILD_PIECES.length;
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
