/**
 * Toon-friendly material helpers for Multiverse props / harvest / terrain accents.
 * Characters keep embedded Toon RTS textures; this is for world props that need
 * cel-readable look without PBR mud.
 */
import * as THREE from "three";

/**
 * Convert a mesh (or tree) to MeshToonMaterial keeping maps when present.
 * @param {THREE.Object3D} root
 * @param {{ color?: number, gradientSteps?: number }} [opts]
 */
export function applyToonLook(root, opts = {}) {
  if (!root) return 0;
  let n = 0;
  const steps = opts.gradientSteps || 4;
  // 1D gradient map for quantised lighting
  const canvas = document.createElement("canvas");
  canvas.width = steps;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  for (let i = 0; i < steps; i++) {
    const v = Math.floor((i / (steps - 1)) * 255);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(i, 0, 1, 1);
  }
  const grad = new THREE.CanvasTexture(canvas);
  grad.minFilter = THREE.NearestFilter;
  grad.magFilter = THREE.NearestFilter;
  grad.generateMipmaps = false;

  root.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh) return; // never touch hero skins here
    const src = o.material;
    if (!src || src.userData?.toonApplied) return;
    const mats = Array.isArray(src) ? src : [src];
    const next = mats.map((m) => {
      const col = opts.color != null ? new THREE.Color(opts.color) : m.color?.clone?.() || new THREE.Color(0x888888);
      const tm = new THREE.MeshToonMaterial({
        color: col,
        map: m.map || null,
        gradientMap: grad,
        transparent: !!m.transparent,
        opacity: m.opacity ?? 1,
        side: m.side ?? THREE.FrontSide,
        depthWrite: m.depthWrite !== false,
      });
      if (tm.map) {
        tm.map.colorSpace = THREE.SRGBColorSpace;
        tm.map.flipY = false;
      }
      tm.userData.toonApplied = true;
      n++;
      return tm;
    });
    o.material = next.length === 1 ? next[0] : next;
  });
  return n;
}

/** Ore vein colors (toon) by material id */
export const ORE_COLORS = {
  t0_stone: 0x6a6a66,
  t0_copper: 0xb87333,
  t1_tin: 0xa0b0b8,
  t1_iron: 0x5a5a62,
  t2_silver: 0xc0c8d0,
  t0_wood: 0x4a3420,
};

/**
 * Style a rock/ore harvest mesh for readable toon mining.
 */
export function styleMineableMesh(object, materialId = "t0_stone") {
  if (!object) return;
  const color = ORE_COLORS[materialId] || ORE_COLORS.t0_stone;
  applyToonLook(object, { color });
  object.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    o.userData.mineable = true;
    o.userData.materialId = materialId;
  });
}
