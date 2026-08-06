/**
 * Attack impacts, explosions, elemental bursts — SI scale (human 1.8 m).
 * Complements fleetVfx; used for boss hits, parry sparks, skill impacts.
 * No second VFX engine — pure Three.js meshes + short-lived timers.
 */
import * as THREE from "three";

export class ImpactFx {
  constructor(scene) {
    this.scene = scene;
    /** @type {Array<{mesh:THREE.Object3D,t:number,life:number,kind:string,vel?:THREE.Vector3,scale?:number}>} */
    this.active = [];
  }

  /**
   * @param {'hit'|'crit'|'explode'|'fire'|'frost'|'arcane'|'shockwave'|'parry'|'blood'} kind
   * @param {THREE.Vector3} origin
   * @param {object} [opts]
   */
  play(kind, origin, opts = {}) {
    const o = origin.clone();
    o.y += opts.yLift ?? 1.0;
    switch (kind) {
      case "explode":
      case "fire":
        this._explosion(o, opts.color ?? 0xff6622, opts.radius ?? 1.8);
        break;
      case "frost":
        this._explosion(o, 0x7ec8ff, opts.radius ?? 1.4);
        this._ring(o, 0xaaddff, 1.2);
        break;
      case "arcane":
        this._explosion(o, 0xc478ff, opts.radius ?? 1.5);
        this._sparks(o, 0xe0a0ff, 10);
        break;
      case "shockwave":
        this._ring(o, opts.color ?? 0xffe08a, opts.radius ?? 2.4);
        break;
      case "parry":
        this._sparks(o, 0xffe066, 14);
        this._flash(o, 0xffffff, 0.35);
        break;
      case "crit":
        this._flash(o, 0xff4444, 0.55);
        this._sparks(o, 0xff8866, 12);
        break;
      case "blood":
        this._sparks(o, 0x8b1010, 8);
        break;
      case "hit":
      default:
        this._flash(o, opts.color ?? 0xffcc88, 0.4);
        this._sparks(o, opts.color ?? 0xffaa66, 6);
        break;
    }
  }

  _flash(origin, color, r) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(r * 0.35, 10, 10),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    mesh.position.copy(origin);
    this.scene.add(mesh);
    this.active.push({ mesh, t: 0, life: 0.22, kind: "flash", scale: 1 });
  }

  _explosion(origin, color, radius) {
    // Outer blast shell
    const outer = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 14, 14),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    );
    outer.position.copy(origin);
    this.scene.add(outer);
    this.active.push({ mesh: outer, t: 0, life: 0.45, kind: "explode", scale: radius / 0.25 });

    // Scorch ring on ground
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.15, 0.35, 28),
      new THREE.MeshBasicMaterial({
        color: 0x221100,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(origin.x, origin.y - 0.9, origin.z);
    this.scene.add(ring);
    this.active.push({ mesh: ring, t: 0, life: 0.7, kind: "scorch", scale: radius });

    this._sparks(origin, color, 16);
  }

  _ring(origin, color, radius) {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.4, 32),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(origin.x, origin.y - 0.85, origin.z);
    this.scene.add(mesh);
    this.active.push({ mesh, t: 0, life: 0.55, kind: "shockwave", scale: radius });
  }

  _sparks(origin, color, n) {
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.04 + Math.random() * 0.04, 6, 6),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }),
      );
      mesh.position.copy(origin);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        1 + Math.random() * 4,
        (Math.random() - 0.5) * 6,
      );
      this.scene.add(mesh);
      this.active.push({ mesh, t: 0, life: 0.35 + Math.random() * 0.25, kind: "spark", vel });
    }
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i];
      a.t += dt;
      const u = a.t / a.life;
      if (a.kind === "spark" && a.vel) {
        a.mesh.position.addScaledVector(a.vel, dt);
        a.vel.y -= 12 * dt;
        if (a.mesh.material) a.mesh.material.opacity = 1 - u;
      } else if (a.kind === "explode" || a.kind === "flash") {
        const s = 1 + u * (a.scale || 3);
        a.mesh.scale.setScalar(s);
        if (a.mesh.material) a.mesh.material.opacity = 0.9 * (1 - u);
      } else if (a.kind === "shockwave" || a.kind === "scorch" || a.kind === "nova") {
        const s = 1 + u * (a.scale || 4);
        a.mesh.scale.setScalar(s);
        if (a.mesh.material) a.mesh.material.opacity = 0.75 * (1 - u);
      }
      if (u >= 1) {
        this.scene.remove(a.mesh);
        a.mesh.geometry?.dispose?.();
        a.mesh.material?.dispose?.();
        this.active.splice(i, 1);
      }
    }
  }

  clear() {
    for (const a of this.active) {
      this.scene.remove(a.mesh);
      a.mesh.geometry?.dispose?.();
      a.mesh.material?.dispose?.();
    }
    this.active.length = 0;
  }
}

/** Map skill kind → elemental impact */
export function impactKindForSkill(skill) {
  const k = `${skill?.kind || ""} ${skill?.id || ""} ${skill?.name || ""}`.toLowerCase();
  if (/fire|meteor|flame|burn|nuke/.test(k)) return "fire";
  if (/frost|ice|nova|cold/.test(k)) return "frost";
  if (/arcane|magic|bolt|storm|blink/.test(k)) return "arcane";
  if (/aoe|cleave|execute|smash/.test(k)) return "shockwave";
  if (/ranged|arrow|shot/.test(k)) return "hit";
  return "hit";
}
