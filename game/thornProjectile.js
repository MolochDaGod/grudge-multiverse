/**
 * Red thorn projectiles for nature staffs.
 * Mesh: public/models/vfx/red_thorn.glb (from D:\Games\Models\red_thorn.glb)
 * Motion: form small → large + spin → launch at enemy (SI metres).
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { assetUrlBust } from "./grudge6SSOT.js";

const BASE =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) ||
  "/";

/** Prefer local SPA asset; CDN optional mirror later. */
export const RED_THORN_URLS = [
  BASE + "models/vfx/red_thorn.glb",
  "https://assets.grudge-studio.com/models/vfx/red_thorn.glb",
];

const TARGET_LENGTH_M = 0.85; // SI thorn length at full form

let _template = null;
let _loadPromise = null;

function getLoader() {
  const loader = new GLTFLoader();
  try {
    const draco = new DRACOLoader();
    draco.setDecoderPath(
      "https://www.gstatic.com/draco/versioned/decoders/1.5.7/",
    );
    loader.setDRACOLoader(draco);
  } catch {
    /* */
  }
  return loader;
}

/**
 * Vine / nature toon-ish materials on thorn mesh (keep maps if present).
 */
export function applyVineThornMaterials(root) {
  if (!root) return;
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.frustumCulled = false;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const next = mats.map((m) => {
      if (!m) return m;
      // Prefer toon look with vine greens + thorn red tips
      const col = m.color?.clone?.() || new THREE.Color(0x2d5a28);
      // Boost toward vine green if near-gray
      if (col.r > 0.4 && col.g > 0.4 && col.b > 0.4) {
        col.setHex(0x3a7a32);
      }
      // Red thorn accent
      if (m.name && /red|thorn|tip|spike/i.test(m.name)) {
        col.setHex(0xb02020);
      }
      const mat = new THREE.MeshStandardMaterial({
        color: col,
        map: m.map || null,
        roughness: 0.72,
        metalness: 0.05,
        emissive: new THREE.Color(0x1a4020),
        emissiveIntensity: 0.35,
        side: THREE.DoubleSide,
      });
      if (mat.map) {
        mat.map.colorSpace = THREE.SRGBColorSpace;
        mat.map.flipY = false;
      }
      // Vine stripe emissive pulse flag
      mat.userData.vine = true;
      return mat;
    });
    o.material = next.length === 1 ? next[0] : next;
  });
}

function normalizeThorn(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const len = Math.max(size.x, size.y, size.z, 0.01);
  const s = TARGET_LENGTH_M / len;
  root.scale.multiplyScalar(s);
  root.updateMatrixWorld(true);
  // Point +Z as flight direction (common export); adjust if needed
  return root;
}

export async function loadRedThornTemplate() {
  if (_template) return _template;
  if (_loadPromise) return _loadPromise;
  _loadPromise = (async () => {
    const loader = getLoader();
    let last;
    for (const url of RED_THORN_URLS) {
      try {
        const gltf = await loader.loadAsync(assetUrlBust(url));
        const root = gltf.scene.clone(true);
        applyVineThornMaterials(root);
        normalizeThorn(root);
        root.name = "red_thorn_template";
        _template = root;
        console.info("[thorn] loaded", url);
        return root;
      } catch (e) {
        last = e;
        console.warn("[thorn] load fail", url, e?.message || e);
      }
    }
    // Procedural vine-thorn fallback
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, TARGET_LENGTH_M, 7),
      new THREE.MeshStandardMaterial({
        color: 0x3a7a32,
        roughness: 0.7,
        emissive: 0x1a4020,
        emissiveIntensity: 0.4,
      }),
    );
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = TARGET_LENGTH_M * 0.5;
    g.add(shaft);
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.04, 0.22, 6),
      new THREE.MeshStandardMaterial({
        color: 0xb02020,
        emissive: 0x400808,
        emissiveIntensity: 0.5,
        roughness: 0.55,
      }),
    );
    tip.rotation.x = Math.PI / 2;
    tip.position.z = TARGET_LENGTH_M + 0.05;
    g.add(tip);
    // Vine coil
    const vine = new THREE.Mesh(
      new THREE.TorusGeometry(0.07, 0.015, 5, 12),
      new THREE.MeshStandardMaterial({
        color: 0x2a5a24,
        emissive: 0x0a2810,
        emissiveIntensity: 0.45,
      }),
    );
    vine.position.z = TARGET_LENGTH_M * 0.35;
    g.add(vine);
    applyVineThornMaterials(g);
    _template = g;
    console.warn("[thorn] using procedural fallback", last?.message || "");
    return g;
  })();
  return _loadPromise;
}

/**
 * Active thorn projectiles manager.
 */
export class ThornProjectileField {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.active = [];
    this._ready = loadRedThornTemplate().catch(() => null);
  }

  /**
   * Form at hand, grow+spin, then fly to target.
   * @param {THREE.Vector3} origin hand / cast
   * @param {THREE.Vector3} target impact point
   * @param {{ dmg?: number, speed?: number, formSec?: number, spin?: number, onHit?: Function, color?: number }} [opts]
   */
  async spawn(origin, target, opts = {}) {
    await this._ready;
    const tpl = _template;
    if (!tpl) return null;

    const mesh = tpl.clone(true);
    applyVineThornMaterials(mesh);
    mesh.position.copy(origin);
    mesh.scale.setScalar(0.08);
    this.scene.add(mesh);

    const to = target.clone().sub(origin);
    if (to.lengthSq() < 0.01) to.set(0, 0, 1);
    const dir = to.normalize();
    // Align mesh +Z to dir
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      dir,
    );
    mesh.quaternion.copy(quat);

    // Vine trail ribbon (simple points)
    const trailGeo = new THREE.BufferGeometry();
    const trailMax = 12;
    const trailPos = new Float32Array(trailMax * 3);
    trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
    const trail = new THREE.Line(
      trailGeo,
      new THREE.LineBasicMaterial({
        color: 0x4a9a40,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    );
    trail.frustumCulled = false;
    this.scene.add(trail);

    const proj = {
      mesh,
      trail,
      trailPos,
      trailMax,
      trailI: 0,
      t: 0,
      phase: "form", // form | fly | done
      formSec: opts.formSec ?? 0.38,
      spin: opts.spin ?? 14,
      speed: opts.speed ?? 26,
      dmg: opts.dmg ?? 12,
      origin: origin.clone(),
      target: target.clone(),
      dir,
      onHit: opts.onHit || null,
      hit: false,
      life: 2.8,
    };
    this.active.push(proj);
    return proj;
  }

  /**
   * @param {number} dt
   * @param {(proj: object) => void} [onImpact]
   */
  update(dt, onImpact) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.t += dt;
      if (p.t > p.life) {
        this._dispose(p);
        this.active.splice(i, 1);
        continue;
      }

      if (p.phase === "form") {
        const u = Math.min(1, p.t / p.formSec);
        // ease out grow
        const s = 0.08 + (1 - 0.08) * (1 - Math.pow(1 - u, 2.4));
        p.mesh.scale.setScalar(s);
        p.mesh.rotateZ(p.spin * dt * (0.5 + u));
        // pulse vine emissive
        p.mesh.traverse((o) => {
          if (o.isMesh && o.material?.emissiveIntensity != null) {
            o.material.emissiveIntensity = 0.25 + 0.45 * Math.sin(p.t * 18);
          }
        });
        if (u >= 1) {
          p.phase = "fly";
          p.flyT = 0;
          // re-aim at target (enemy may have moved)
          const d = p.target.clone().sub(p.mesh.position);
          if (d.lengthSq() > 0.01) {
            p.dir = d.normalize();
            p.mesh.quaternion.setFromUnitVectors(
              new THREE.Vector3(0, 0, 1),
              p.dir,
            );
          }
        }
        continue;
      }

      if (p.phase === "fly") {
        p.flyT = (p.flyT || 0) + dt;
        p.mesh.position.addScaledVector(p.dir, p.speed * dt);
        p.mesh.rotateZ(p.spin * 1.6 * dt);
        // trail
        const idx = (p.trailI % p.trailMax) * 3;
        p.trailPos[idx] = p.mesh.position.x;
        p.trailPos[idx + 1] = p.mesh.position.y;
        p.trailPos[idx + 2] = p.mesh.position.z;
        p.trailI++;
        p.trail.geometry.attributes.position.needsUpdate = true;

        const dist = p.mesh.position.distanceTo(p.target);
        if (!p.hit && (dist < 0.55 || p.flyT > 1.8)) {
          p.hit = true;
          p.phase = "done";
          onImpact?.(p);
          p.onHit?.(p);
          // vine burst
          const burst = new THREE.Mesh(
            new THREE.SphereGeometry(0.35, 10, 10),
            new THREE.MeshBasicMaterial({
              color: 0x5aaa40,
              transparent: true,
              opacity: 0.7,
              depthWrite: false,
            }),
          );
          burst.position.copy(p.mesh.position);
          this.scene.add(burst);
          this.active.push({
            mesh: burst,
            trail: null,
            t: 0,
            life: 0.28,
            phase: "burst",
            hit: true,
          });
          this._dispose(p);
          this.active.splice(i, 1);
        }
        continue;
      }

      if (p.phase === "burst") {
        const u = p.t / p.life;
        p.mesh.scale.setScalar(1 + u * 2.2);
        if (p.mesh.material) p.mesh.material.opacity = 0.7 * (1 - u);
        if (u >= 1) {
          this._dispose(p);
          this.active.splice(i, 1);
        }
      }
    }
  }

  _dispose(p) {
    if (p.mesh) {
      p.mesh.parent?.remove(p.mesh);
    }
    if (p.trail) {
      p.trail.parent?.remove(p.trail);
      p.trail.geometry?.dispose?.();
      p.trail.material?.dispose?.();
    }
  }

  dispose() {
    for (const p of this.active) this._dispose(p);
    this.active.length = 0;
  }
}

/** Nature staff weapon ids / families */
export function isNatureStaffWeapon(item) {
  if (!item) return false;
  const id = String(item.id || item.weaponId || "").toLowerCase();
  const name = String(item.name || "").toLowerCase();
  const fam = String(item.meshFamily || item.meshSlot || "").toLowerCase();
  return (
    /nature/.test(id) ||
    /nature/.test(name) ||
    id === "t0_nature_staff" ||
    id === "t1_nature_staff" ||
    (fam === "staff" && /nature|druid|vine|thorn|leaf|grove/.test(name + id))
  );
}
