/**
 * Railway remote avatar — full Toon RTS kit + Bip001 director (NO cylinders).
 *
 * Fail-closed: invisible until kit+anims green; never ships CapsuleGeometry peers.
 * Shared experience: same race/class/animPack/meshIds as snapshot from peer.
 */
import * as THREE from "three";
import { markHostile } from "./combatAim.js";
import { loadGrudge6Class } from "./grudge6Loader.js";

const _q = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, "YXZ");
const _wp = new THREE.Vector3();

/** Shared template cache key → avoid reloading same race for every peer */
const _hydrateInflight = new Map();

export class MvNetworkRemote {
  /**
   * @param {string} id
   * @param {THREE.Scene} scene
   * @param {{ name?: string, classId?: string, raceId?: string, animPack?: string, meshIds?: string[] }} [meta]
   */
  constructor(id, scene, meta = {}) {
    this.id = id;
    this.scene = scene;
    this.name = meta.name || "Player";
    this.classId = meta.classId || "warrior";
    this.raceId = meta.raceId || "western-kingdoms";
    this.animPack = meta.animPack || null;
    this.meshIds = meta.meshIds || null;
    this.hp = 100;
    this.maxHp = 100;
    this.dead = false;
    this.clip = "idle";
    this.combat = "idle";
    /** false until Toon + director ready */
    this.loaded = false;
    this.loadError = null;
    this.g6 = null;
    this.director = null;
    this.mixer = null;

    this.root = new THREE.Group();
    this.root.name = `mv-net-remote-${id}`;
    this.root.userData.playerId = id;
    this.root.userData.selectable = "hostile";
    this.root.visible = false; // fail-closed: never show empty/capsule

    this.targetPos = new THREE.Vector3(0, 0, 0);
    this.yaw = 0;
    this._label = null;
    this._buildLabel();
    this._loadGen = 0;

    scene.add(this.root);
    // Kick hydrate immediately
    this._hydrate();
  }

  _buildLabel() {
    try {
      const el = document.createElement("div");
      el.className = "mv-remote-name";
      el.textContent = `${this.name} · loading…`;
      el.style.cssText =
        "position:fixed;pointer-events:none;z-index:40;font:700 11px system-ui;color:#f0e6c8;text-shadow:0 1px 3px #000;transform:translate(-50%,-100%);white-space:nowrap";
      document.body.appendChild(el);
      this._label = el;
    } catch {
      this._label = null;
    }
  }

  _setLabel(text, color) {
    if (!this._label) return;
    this._label.textContent = text;
    if (color) this._label.style.color = color;
  }

  /**
   * Load real Toon RTS body. Never uses CapsuleGeometry.
   */
  async _hydrate() {
    const gen = ++this._loadGen;
    this.loaded = false;
    this.root.visible = false;
    this._setLabel(`${this.name} · loading Toon…`, "#c9a04e");

    try {
      const g6 = await loadGrudge6Class({
        classId: this.classId,
        raceId: this.raceId,
      });
      if (gen !== this._loadGen) {
        // Stale race/class change mid-load
        try {
          g6.root?.parent?.remove?.(g6.root);
        } catch {
          /* */
        }
        return;
      }

      if (g6.standIn || g6.source?.degraded || g6.integrity === "red" || !g6.director) {
        throw new Error(
          `remote integrity fail: standIn=${!!g6.standIn} grade=${g6.integrity} director=${!!g6.director}`,
        );
      }

      // Clear any previous visual
      while (this.root.children.length) {
        this.root.remove(this.root.children[0]);
      }

      this.g6 = g6;
      this.director = g6.director;
      this.mixer = g6.mixer;
      this.animPack = g6.animPack || this.animPack;

      // Attach model under remote root (root carries world feet)
      g6.root.position.set(0, 0, 0);
      g6.root.rotation.set(0, 0, 0);
      this.root.add(g6.root);

      // Optional mesh override from snapshot
      if (this.meshIds?.length && g6.applyLoadout) {
        try {
          // Prefer exact mesh list via applyExact if exposed
          g6.applyLoadout?.({});
        } catch {
          /* */
        }
      }

      markHostile(this.root, this.id, "hostile");
      this.root.userData.playerId = this.id;
      this.root.userData.raceId = this.raceId;
      this.root.userData.classId = this.classId;
      this.root.userData.animPack = this.animPack;
      this.root.userData.playMesh = "toon-rts";

      this.loaded = true;
      this.loadError = null;
      this.root.visible = true;
      this._setLabel(this.name, "#f0e6c8");
      console.info(
        `[mvRemote] ${this.id} Toon OK race=${this.raceId} class=${this.classId} pack=${this.animPack}`,
      );
    } catch (e) {
      this.loaded = false;
      this.loadError = String(e?.message || e);
      this.root.visible = false;
      this._setLabel(`${this.name} · LOAD FAIL`, "#ff6b6b");
      console.error("[mvRemote] FAIL-CLOSED no capsule fallback", this.id, e);
    }
  }

  /**
   * @param {{
   *   px?:number, py?:number, pz?:number, x?:number, y?:number, z?:number,
   *   ry?:number, name?:string, hp?:number, clip?:string, combat?:string,
   *   dead?:boolean, classId?:string, raceId?:string, animPack?:string,
   *   meshIds?:string[], moving?:boolean, sprinting?:boolean
   * }} s
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
      if (this.loaded) this._setLabel(this.name, "#f0e6c8");
    }
    if (typeof s.hp === "number") this.hp = s.hp;
    if (s.clip) this.clip = String(s.clip);
    if (s.combat) this.combat = String(s.combat);
    if (typeof s.moving === "boolean") this.moving = s.moving;
    if (typeof s.sprinting === "boolean") this.sprinting = s.sprinting;

    // Identity change → re-hydrate Toon (no wrong body)
    let rekit = false;
    if (s.classId && s.classId !== this.classId) {
      this.classId = s.classId;
      rekit = true;
    }
    if (s.raceId && s.raceId !== this.raceId) {
      this.raceId = s.raceId;
      rekit = true;
    }
    if (s.animPack) this.animPack = s.animPack;
    if (Array.isArray(s.meshIds)) this.meshIds = s.meshIds;
    if (rekit) this._hydrate();

    if (s.dead && !this.dead) {
      this.dead = true;
      if (this.root) this.root.visible = this.loaded && false;
    } else if (s.dead === false && this.dead) {
      this.dead = false;
      this.root.visible = this.loaded;
    }

    // Drive gait from clip name (shared anim pack roles)
    if (this.director && this.loaded) {
      const clip = this.clip || "idle";
      const moving = !!this.moving || /walk|run|sprint/i.test(clip);
      const sprinting = !!this.sprinting || clip === "sprint";
      let speed01 = 0;
      if (clip === "walk") speed01 = 0.35;
      else if (clip === "run") speed01 = 0.7;
      else if (clip === "sprint") speed01 = 1;
      this.director.setGaitTarget(moving, sprinting, speed01);
      // One-shot combat roles
      if (/attack|skill/i.test(clip) || /attack|skill/i.test(this.combat)) {
        const role =
          this.director.has(clip) ? clip : this.director.has("attack") ? "attack" : null;
        if (role && !this.director.busyOverlay) {
          this.director.requestOneShot(role);
        }
      }
    }
  }

  /**
   * @param {number} dt
   * @param {THREE.Camera} [camera]
   */
  update(dt, camera) {
    if (!this.loaded) {
      // Still update label position from target so name is visible while loading
      if (this._label && camera) this._placeLabel(camera, this.targetPos);
      return;
    }

    const k = 1 - Math.exp(-14 * dt);
    this.root.position.lerp(this.targetPos, k);
    _e.set(0, this.yaw, 0);
    _q.setFromEuler(_e);
    this.root.quaternion.slerp(_q, k);

    if (this.director) this.director.update(dt);
    else if (this.mixer) this.mixer.update(dt);

    if (this._label && camera) {
      const headY = this.root.position.y + 1.85;
      _wp.set(this.root.position.x, headY, this.root.position.z);
      this._placeLabel(camera, _wp);
    }
  }

  _placeLabel(camera, worldPos) {
    const p = worldPos.clone ? worldPos.clone() : _wp.copy(worldPos);
    p.project(camera);
    const x = (p.x * 0.5 + 0.5) * innerWidth;
    const y = (-p.y * 0.5 + 0.5) * innerHeight;
    const behind = p.z > 1;
    this._label.style.left = `${x}px`;
    this._label.style.top = `${y}px`;
    this._label.style.display = behind || this.dead ? "none" : "block";
  }

  getWorldPos() {
    return this.root.position.clone();
  }

  dispose() {
    this._loadGen++;
    try {
      this.director?.dispose?.();
    } catch {
      /* */
    }
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
    this.g6 = null;
    this.director = null;
    this.mixer = null;
    this.loaded = false;
  }
}
