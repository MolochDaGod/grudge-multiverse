/**
 * Lightweight Railway remote avatar — capsule + nameplate + soft-lock selectable.
 * Used when Multiverse Railway has peers without Firebase Mixamo seats.
 * SI units; smooth lerp for 20 Hz snapshots.
 */
import * as THREE from "three";
import { markHostile } from "./combatAim.js";

const _q = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, "YXZ");

export class MvNetworkRemote {
  /**
   * @param {string} id
   * @param {THREE.Scene} scene
   * @param {{ name?: string, classId?: string, raceId?: string }} [meta]
   */
  constructor(id, scene, meta = {}) {
    this.id = id;
    this.scene = scene;
    this.name = meta.name || "Player";
    this.classId = meta.classId || "warrior";
    this.raceId = meta.raceId || "western-kingdoms";
    this.hp = 100;
    this.maxHp = 100;
    this.dead = false;
    this.clip = "idle";
    this.combat = "idle";
    this.loaded = true;

    this.root = new THREE.Group();
    this.root.name = `mv-net-remote-${id}`;
    this.root.userData.playerId = id;

    // SI capsule ~1.8 m human
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.32, 1.05, 6, 10),
      new THREE.MeshStandardMaterial({
        color: classColor(this.classId),
        roughness: 0.75,
        metalness: 0.1,
      }),
    );
    body.position.y = 0.85;
    body.castShadow = true;
    this.body = body;
    this.root.add(body);

    // Head marker for soft-lock aim
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xffe8c0 }),
    );
    head.position.y = 1.65;
    this.head = head;
    this.root.add(head);

    markHostile(this.root, id, "hostile");
    this.root.userData.playerId = id;
    this.root.userData.selectable = "hostile";

    this.targetPos = new THREE.Vector3(0, 0, 0);
    this.yaw = 0;
    this._label = null;
    this._buildLabel();

    scene.add(this.root);
  }

  _buildLabel() {
    try {
      const el = document.createElement("div");
      el.className = "mv-remote-name";
      el.textContent = this.name;
      el.style.cssText =
        "position:fixed;pointer-events:none;z-index:40;font:700 11px system-ui;color:#f0e6c8;text-shadow:0 1px 3px #000;transform:translate(-50%,-100%);white-space:nowrap";
      document.body.appendChild(el);
      this._label = el;
    } catch {
      this._label = null;
    }
  }

  /**
   * @param {{ px?:number, py?:number, pz?:number, ry?:number, name?:string, hp?:number, clip?:string, combat?:string, dead?:boolean, classId?:string }} s
   */
  applyState(s) {
    if (!s) return;
    if (typeof s.px === "number") {
      this.targetPos.set(s.px, s.py ?? this.targetPos.y, s.pz ?? 0);
    } else if (typeof s.x === "number") {
      this.targetPos.set(s.x, s.y ?? this.targetPos.y, s.z ?? 0);
    }
    if (typeof s.ry === "number") this.yaw = s.ry;
    if (s.name) {
      this.name = s.name;
      if (this._label) this._label.textContent = s.name;
    }
    if (typeof s.hp === "number") this.hp = s.hp;
    if (s.clip) this.clip = String(s.clip);
    if (s.combat) this.combat = String(s.combat);
    if (s.classId) this.classId = s.classId;
    if (s.dead && !this.dead) {
      this.dead = true;
      this.body.material.opacity = 0.35;
      this.body.material.transparent = true;
    } else if (s.dead === false && this.dead) {
      this.dead = false;
      this.body.material.opacity = 1;
      this.body.material.transparent = false;
    }
    // Subtle combat pose scale pulse
    const busy = this.combat && this.combat !== "idle";
    this.body.scale.setScalar(busy ? 1.04 : this.clip === "run" || this.clip === "sprint" ? 1.02 : 1);
  }

  /**
   * @param {number} dt
   * @param {THREE.Camera} [camera]
   */
  update(dt, camera) {
    const k = 1 - Math.exp(-14 * dt);
    this.root.position.lerp(this.targetPos, k);
    _e.set(0, this.yaw, 0);
    _q.setFromEuler(_e);
    this.root.quaternion.slerp(_q, k);

    if (this._label && camera) {
      const p = this.head.getWorldPosition(new THREE.Vector3());
      p.y += 0.25;
      p.project(camera);
      const x = (p.x * 0.5 + 0.5) * innerWidth;
      const y = (-p.y * 0.5 + 0.5) * innerHeight;
      const behind = p.z > 1;
      this._label.style.left = `${x}px`;
      this._label.style.top = `${y}px`;
      this._label.style.display = behind || this.dead ? "none" : "block";
    }
  }

  /** World position for soft-lock / PvP range. */
  getWorldPos() {
    return this.root.position.clone();
  }

  dispose() {
    this.scene.remove(this.root);
    this.root.traverse((c) => {
      c.geometry?.dispose?.();
      if (c.material) {
        if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose?.());
        else c.material.dispose?.();
      }
    });
    this._label?.remove?.();
    this._label = null;
  }
}

function classColor(classId) {
  switch (classId) {
    case "mage":
      return 0x8b5cf6;
    case "ranger":
      return 0x34d399;
    case "worge":
      return 0xef4444;
    case "warrior":
    default:
      return 0x60a5fa;
  }
}
