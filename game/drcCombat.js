/**
 * DRC combat for Multiverse — fleet input + Elden-like defense.
 * Numbers ported from gameopen @workspace/epicfight combat/fleet/constants
 * (CANONICAL_COMBAT). Do not invent alternate costs/windows.
 *
 * Input: C parry · X dodge · E block · Alt slide/MM dash · Space jump/double
 * Skills: F + 1–5 via SkillBar (unchanged)
 */
import * as THREE from "three";

/** @see gameopen/lib/epicfight/src/combat/fleet/constants.ts */
export const FLEET_STAMINA_COST = {
  jump: 8,
  doubleJump: 12,
  slide: 22,
  blockTap: 0,
  parryExtra: 0,
};

export const FLEET_DODGE = {
  duration: 0.72,
  iframeStart: 0.06,
  iframeEnd: 0.56,
  maxDistance: 4.9,
  minDistance: 0.5,
  staminaFrac: 0.4,
  lowStaminaRatio: 0.15,
  cooldown: 0.78,
  invuln: 0.55,
};

export const FLEET_SLIDE = {
  distance: 3.4,
  duration: 0.55,
  cooldown: 0.95,
  staminaCost: FLEET_STAMINA_COST.slide,
  hitRadius: 1.15,
  damage: 16,
};

export const FLEET_PARRY = {
  perfectWindow: 0.12,
  deflectWindow: 0.3,
  staminaCost: 18,
  invuln: 0.22,
  stunOnSuccess: 1.4,
  failStamDebt: 22,
};

export const FLEET_COMBAT_INPUT = {
  parry: "KeyC",
  dodge: "KeyX",
  slide: "AltLeft",
  block: "KeyE",
  jump: "Space",
};

export function planDodge(currentStamina, maxStamina) {
  const maxS = Math.max(1, maxStamina);
  const cur = Math.max(0, currentStamina);
  const ratio = cur / maxS;
  const cost = Math.min(cur, maxS * FLEET_DODGE.staminaFrac);
  const minD = FLEET_DODGE.minDistance;
  const maxD = FLEET_DODGE.maxDistance;
  let distance;
  let short = false;
  if (ratio < FLEET_DODGE.lowStaminaRatio) {
    distance = minD;
    short = true;
  } else {
    const t = (ratio - FLEET_DODGE.lowStaminaRatio) / (1 - FLEET_DODGE.lowStaminaRatio);
    const u = Math.max(0, Math.min(1, t));
    distance = minD + (maxD - minD) * u;
  }
  return { distance, cost, ratio, short };
}

/**
 * Multiverse host combat controller — stamina, dodge i-frames, parry, block, double jump.
 * Capsule motion via localPlayer._player; visual via grudge6 director.
 */
export class DrcCombatController {
  /**
   * @param {{
   *   getCapsule: () => THREE.Object3D | null,
   *   getCtrl: () => any,
   *   getDirector: () => any,
   *   getForward: () => THREE.Vector3,
   *   groundAt: (x:number,z:number)=>number,
   *   isWater?: (x:number,z:number)=>boolean,
   *   flash?: (msg:string, t?:number)=>void,
   *   onCombatEvent?: (ev:object)=>void,
   *   vfx?: { play?: Function },
   * }} host
   */
  constructor(host) {
    this.host = host;
    this.maxStamina = 100;
    this.stamina = 100;
    this.stamRegen = 22; // /s out of combat
    this.state = "idle"; // idle | dodge | parry | block | slide
    this.iframesUntil = 0;
    this.cd = { dodge: 0, parry: 0, slide: 0 };
    this.parryUntil = 0;
    this.blockHeld = false;
    this.dashRemain = 0;
    this.dashDir = new THREE.Vector3();
    this.dashSpeed = 0;
    this.jumpsUsed = 0;
    this._tmp = new THREE.Vector3();
    this._bound = false;
  }

  get invulnerable() {
    return performance.now() / 1000 < this.iframesUntil;
  }

  get blocking() {
    return this.blockHeld && this.state === "block";
  }

  get parrying() {
    return performance.now() / 1000 < this.parryUntil;
  }

  bind() {
    if (this._bound) return;
    this._bound = true;
    document.addEventListener("keydown", this._onKeyDown, true);
    document.addEventListener("keyup", this._onKeyUp, true);
  }

  unbind() {
    document.removeEventListener("keydown", this._onKeyDown, true);
    document.removeEventListener("keyup", this._onKeyUp, true);
    this._bound = false;
  }

  _typing(e) {
    const t = e.target;
    return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
  }

  _onKeyDown = (e) => {
    if (e.repeat || this._typing(e)) return;
    const code = e.code;
    if (code === FLEET_COMBAT_INPUT.dodge) {
      e.preventDefault();
      this.tryDodge();
    } else if (code === FLEET_COMBAT_INPUT.parry) {
      e.preventDefault();
      this.tryParry();
    } else if (code === FLEET_COMBAT_INPUT.block) {
      // E also opens vendor — only block when not near vendor (host can override)
      if (window.__mvNearVendor) return;
      e.preventDefault();
      this.startBlock();
    } else if (code === "AltLeft" || code === "AltRight") {
      e.preventDefault();
      this.trySlideDash();
    } else if (code === "Space") {
      // Double jump handled after first jump consumes ground
      this.tryDoubleJump();
    }
  };

  _onKeyUp = (e) => {
    if (this._typing(e)) return;
    if (e.code === FLEET_COMBAT_INPUT.block) this.endBlock();
  };

  spend(n) {
    if (this.stamina < n) return false;
    this.stamina = Math.max(0, this.stamina - n);
    window.__mvStamina = this.stamina;
    window.__mvMaxStamina = this.maxStamina;
    return true;
  }

  tryDodge() {
    const now = performance.now() / 1000;
    if (now < this.cd.dodge) {
      this.host.flash?.("Dodge CD", 0.25);
      return false;
    }
    const plan = planDodge(this.stamina, this.maxStamina);
    if (!this.spend(plan.cost)) {
      this.host.flash?.("No stamina", 0.3);
      return false;
    }
    const cap = this.host.getCapsule?.();
    const dir = this.host.getForward?.() || new THREE.Vector3(0, 0, 1);
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
    dir.normalize();
    // Prefer keyboard strafe if moving
    const ctrl = this.host.getCtrl?.();
    if (ctrl?.input) {
      const ax = Number(ctrl.input.rgt) - Number(ctrl.input.lft);
      const az = Number(ctrl.input.fwd) - Number(ctrl.input.bkd);
      if (ax || az) {
        // camera-relative already applied in velocity; use flat velocity
        const v = ctrl.getVelocity?.();
        if (v && Math.hypot(v.x, v.z) > 0.05) {
          dir.set(v.x, 0, v.z).normalize();
        }
      }
    }
    this.dashDir.copy(dir);
    this.dashRemain = FLEET_DODGE.duration;
    this.dashSpeed = plan.distance / FLEET_DODGE.duration;
    this.state = "dodge";
    this.iframesUntil = now + FLEET_DODGE.invuln;
    this.cd.dodge = now + FLEET_DODGE.cooldown;
    this.host.getDirector?.()?.requestOneShot?.("skill2") ||
      this.host.getDirector?.()?.requestOneShot?.("attack");
    this.host.flash?.(plan.short ? "Short dodge" : "Dodge", 0.35);
    this.host.vfx?.play?.("slash", cap?.position?.clone?.(), dir, 0x88ccff);
    this.host.onCombatEvent?.({ kind: "dodge", dist: plan.distance });
    return true;
  }

  trySlideDash() {
    const now = performance.now() / 1000;
    if (now < this.cd.slide) return false;
    if (!this.spend(FLEET_SLIDE.staminaCost)) {
      this.host.flash?.("No stamina", 0.3);
      return false;
    }
    const dir = this.host.getForward?.() || new THREE.Vector3(0, 0, 1);
    dir.y = 0;
    dir.normalize();
    this.dashDir.copy(dir);
    this.dashRemain = FLEET_SLIDE.duration;
    this.dashSpeed = FLEET_SLIDE.distance / FLEET_SLIDE.duration;
    this.state = "slide";
    this.cd.slide = now + FLEET_SLIDE.cooldown;
    this.iframesUntil = now + 0.2;
    this.host.getDirector?.()?.requestOneShot?.("skill2");
    this.host.flash?.("Dash", 0.3);
    this.host.vfx?.play?.("slash", this.host.getCapsule?.()?.position?.clone?.(), dir, 0xffcc66);
    this.host.onCombatEvent?.({ kind: "slide", dist: FLEET_SLIDE.distance });
    return true;
  }

  tryParry() {
    const now = performance.now() / 1000;
    if (now < this.cd.parry) return false;
    if (!this.spend(FLEET_PARRY.staminaCost)) {
      this.host.flash?.("No stamina", 0.3);
      return false;
    }
    this.state = "parry";
    this.parryUntil = now + FLEET_PARRY.deflectWindow;
    this.iframesUntil = now + FLEET_PARRY.invuln;
    this.cd.parry = now + 0.85;
    this.host.getDirector?.()?.requestOneShot?.("skill1");
    this.host.flash?.("Parry window", 0.4);
    this.host.onCombatEvent?.({ kind: "parry" });
    return true;
  }

  startBlock() {
    this.blockHeld = true;
    this.state = "block";
    this.host.flash?.("Block", 0.2);
  }

  endBlock() {
    this.blockHeld = false;
    if (this.state === "block") this.state = "idle";
  }

  tryDoubleJump() {
    const ctrl = this.host.getCtrl?.();
    if (!ctrl || ctrl.isFlying) return false;
    if (ctrl.playerIsOnGround) {
      this.jumpsUsed = 1; // ground jump counted by InputSystem
      return false;
    }
    if (this.jumpsUsed >= 2) return false;
    if (!this.spend(FLEET_STAMINA_COST.doubleJump)) return false;
    this.jumpsUsed = 2;
    ctrl.playerVelocity.y = Math.abs(ctrl.jumpHeight) * 0.92;
    ctrl.setOnGround?.(false);
    this.host.getDirector?.()?.requestOneShot?.("skill4");
    this.host.flash?.("Double jump", 0.3);
    this.host.onCombatEvent?.({ kind: "doubleJump" });
    return true;
  }

  /**
   * Incoming boss hit resolution — Elden-like: i-frames / perfect parry / block / full.
   * @returns {{ dmg: number, kind: string }}
   */
  resolveIncomingHit(baseDmg, meta = {}) {
    const now = performance.now() / 1000;
    if (this.invulnerable || this.state === "dodge") {
      this.host.flash?.("I-frame", 0.25);
      return { dmg: 0, kind: "iframe" };
    }
    if (this.parrying) {
      const age = this.parryUntil - now;
      const perfect = age > FLEET_PARRY.deflectWindow - FLEET_PARRY.perfectWindow;
      this.host.flash?.(perfect ? "PERFECT PARRY" : "Parry!", 0.6);
      this.host.vfx?.play?.("nova", this.host.getCapsule?.()?.position?.clone?.(), new THREE.Vector3(0, 1, 0), 0xffe066);
      this.host.onCombatEvent?.({ kind: "parrySuccess", perfect, boss: meta.boss });
      this.stamina = Math.min(this.maxStamina, this.stamina + 12);
      return { dmg: 0, kind: perfect ? "perfect_parry" : "parry" };
    }
    if (this.blocking) {
      const reduced = Math.floor(baseDmg * 0.35);
      this.spend(Math.min(this.stamina, 8 + baseDmg * 0.15));
      this.host.flash?.(`Block −${reduced}`, 0.35);
      this.host.onCombatEvent?.({ kind: "block", dmg: reduced });
      return { dmg: reduced, kind: "block" };
    }
    return { dmg: baseDmg, kind: "hit" };
  }

  /**
   * @param {number} dt
   * @param {{ waterPhysics?: any, nav?: any }} [world]
   */
  update(dt, world = {}) {
    const now = performance.now() / 1000;
    const cap = this.host.getCapsule?.();
    const ctrl = this.host.getCtrl?.();

    if (ctrl?.playerIsOnGround) this.jumpsUsed = 0;

    // Stamina regen when not dashing
    if (this.state === "idle" || this.state === "block") {
      const mul = this.blockHeld ? 0.35 : 1;
      this.stamina = Math.min(this.maxStamina, this.stamina + this.stamRegen * mul * dt);
    }
    window.__mvStamina = this.stamina;
    window.__mvMaxStamina = this.maxStamina;
    window.__mvCombatState = this.state;
    window.__mvIframes = this.invulnerable;

    // Dash / dodge travel
    if (this.dashRemain > 0 && cap) {
      const step = Math.min(dt, this.dashRemain);
      this.dashRemain -= step;
      const move = this.dashDir.clone().multiplyScalar(this.dashSpeed * step);
      let nx = cap.position.x + move.x;
      let nz = cap.position.z + move.z;
      // Water awareness — don't dash into sea
      if (world.nav?.isWaterWorld?.(nx, nz) || this.host.isWater?.(nx, nz)) {
        this.dashRemain = 0;
        this.state = "idle";
      } else {
        cap.position.x = nx;
        cap.position.z = nz;
        const gy = this.host.groundAt?.(nx, nz);
        if (Number.isFinite(gy)) {
          // keep capsule height band
          if (cap.position.y < gy + 0.5) cap.position.y = gy + 1.1;
        }
        if (ctrl?.playerVelocity) {
          ctrl.playerVelocity.x = this.dashDir.x * this.dashSpeed * 0.3;
          ctrl.playerVelocity.z = this.dashDir.z * this.dashSpeed * 0.3;
        }
      }
      if (this.dashRemain <= 0 && this.state !== "block" && this.state !== "parry") {
        this.state = "idle";
      }
    } else if (this.state === "parry" && now >= this.parryUntil) {
      this.state = this.blockHeld ? "block" : "idle";
    }
  }
}

/** HUD legend line for fleet combat keys */
export const DRC_COMBAT_LEGEND =
  "F attack · 1–5 skills · C parry · X dodge · E block · Alt dash · Space jump/double";
