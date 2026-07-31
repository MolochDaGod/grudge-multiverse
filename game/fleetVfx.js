/**
 * Fleet weapon skill VFX — slash / bolt / nova (Danger-style lightweight Three.js).
 * Pattern aligned with grudge-vfx / epicfight skill kinds.
 */
import * as THREE from "three";

export class FleetSkillVfx {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
  }

  /**
   * @param {'slash'|'bolt'|'nova'} kind
   * @param {THREE.Vector3} origin
   * @param {THREE.Vector3} [dir]
   * @param {number} [color]
   */
  play(kind, origin, dir = new THREE.Vector3(0, 0, 1), color) {
    if (kind === "slash") this.slash(origin, dir, color ?? 0x9fe8ff);
    else if (kind === "bolt") this.bolt(origin, dir, color ?? 0x7ec8ff);
    else if (kind === "nova") this.nova(origin, color ?? 0xc478ff);
    else this.slash(origin, dir, color ?? 0xffe08a);
  }

  slash(origin, dir, color) {
    const geo = new THREE.TorusGeometry(1.1, 0.06, 6, 24, Math.PI * 1.2);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(origin).add(new THREE.Vector3(0, 1.1, 0));
    const yaw = Math.atan2(dir.x, dir.z);
    mesh.rotation.set(0.4, yaw, 0.2);
    this.scene.add(mesh);
    this.active.push({ mesh, t: 0, life: 0.35, kind: "slash" });
  }

  bolt(origin, dir, color) {
    const geo = new THREE.SphereGeometry(0.12, 10, 10);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(origin).add(new THREE.Vector3(0, 1.2, 0));
    const d = dir.clone().normalize();
    this.scene.add(mesh);
    this.active.push({ mesh, t: 0, life: 0.55, kind: "bolt", vel: d.multiplyScalar(28) });
  }

  nova(origin, color) {
    const geo = new THREE.RingGeometry(0.2, 0.35, 32);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(origin).add(new THREE.Vector3(0, 0.15, 0));
    this.scene.add(mesh);
    this.active.push({ mesh, t: 0, life: 0.5, kind: "nova", scale: 1 });
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i];
      a.t += dt;
      const u = a.t / a.life;
      if (a.kind === "slash") {
        a.mesh.scale.setScalar(1 + u * 1.8);
        a.mesh.material.opacity = 0.9 * (1 - u);
      } else if (a.kind === "bolt") {
        a.mesh.position.addScaledVector(a.vel, dt);
        a.mesh.material.opacity = 1 - u;
      } else if (a.kind === "nova") {
        a.scale = 1 + u * 6;
        a.mesh.scale.setScalar(a.scale);
        a.mesh.material.opacity = 0.85 * (1 - u);
      }
      if (a.t >= a.life) {
        this.scene.remove(a.mesh);
        a.mesh.geometry?.dispose?.();
        a.mesh.material?.dispose?.();
        this.active.splice(i, 1);
      }
    }
  }
}

/** Map skill kind → VFX kind (fleet skill kinds). */
export function vfxKindForSkill(skill) {
  const k = skill?.kind || "";
  const id = skill?.id || "";
  // AoE / nova first
  if (k.includes("aoe") || k.includes("nova") || /nova|meteor|storm|rain|cleave|rampage/i.test(id)) {
    return "nova";
  }
  if (k === "buff" || k === "debuff" || k === "mobility") return "nova";
  if (k.includes("ranged") || k === "magic" || /bolt|shot|arrow/i.test(id)) return "bolt";
  return "slash";
}
