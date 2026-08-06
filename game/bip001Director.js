/**
 * AnimationDirector — vendored pattern from gameopen ummorpg/animationDirector.ts
 * (grudge6-combat-runtime SSOT). One director owns gait + overlay one-shots.
 */
import * as THREE from "three";

export class AnimationDirector {
  constructor(mixer, clips, opts = {}) {
    this.mixer = mixer;
    this.actions = new Map();
    this.loco = "idle";
    this.gait = 0;
    this.gaitTarget = 0;
    this.gaitRate = opts.gaitRate ?? 9;
    this.fade = opts.fade ?? 0.18;
    this.oneShot = null;
    this.oneShotEnd = 0;
    this.busy = false;

    for (const [name, clip] of Object.entries(clips)) {
      if (!clip) continue;
      const action = mixer.clipAction(clip);
      action.enabled = true;
      action.setEffectiveWeight(0);
      this.actions.set(name, action);
    }
    const idle = this.actions.get("idle");
    if (idle) {
      idle.setLoop(THREE.LoopRepeat, Infinity);
      idle.setEffectiveWeight(1);
      idle.play();
      this.loco = "idle";
    }
  }

  get busyOverlay() {
    return this.busy;
  }

  has(name) {
    return this.actions.has(name);
  }

  /**
   * Traversal gait target from controller (SI speed01 0–1 + keys).
   * DRC: idle ↔ walk ↔ run ↔ sprint (sprint is run clone @ 1.75×, never banned roll).
   */
  setGaitTarget(moving, sprinting = false, speed01 = 0) {
    if (!moving || speed01 < 0.04) {
      this.gaitTarget = 0;
      return;
    }
    if (sprinting || speed01 > 0.88) this.gaitTarget = 1;
    else if (speed01 > 0.48) this.gaitTarget = 0.72;
    else this.gaitTarget = 0.36;
  }

  locoFromGait(g) {
    if (g >= 0.9 && this.actions.has("sprint")) return "sprint";
    if (g >= 0.52 && this.actions.has("run")) return "run";
    if (g >= 0.1 && this.actions.has("walk")) return "walk";
    return "idle";
  }

  /** Debug: current traversal role for HUD / __mvTraversal */
  getTraversalState() {
    return {
      loco: this.loco,
      gait: +this.gait.toFixed(3),
      gaitTarget: +this.gaitTarget.toFixed(3),
      busy: this.busy,
      has: {
        idle: this.actions.has("idle"),
        walk: this.actions.has("walk"),
        run: this.actions.has("run"),
        sprint: this.actions.has("sprint"),
      },
    };
  }

  applyLocoWeights(fade) {
    if (this.busy) return;
    const role = this.locoFromGait(this.gait);
    if (role === this.loco) {
      this.applySprintRate(role);
      return;
    }
    const next = this.actions.get(role);
    const prev = this.actions.get(this.loco);
    if (!next) return;
    next.reset();
    next.setLoop(THREE.LoopRepeat, Infinity);
    next.setEffectiveWeight(1);
    next.fadeIn(fade);
    next.play();
    this.applySprintRate(role);
    if (prev && prev !== next) {
      prev.fadeOut(fade);
      prev.setEffectiveTimeScale(1);
    }
    this.loco = role;
  }

  applySprintRate(role) {
    const sprint = this.actions.get("sprint");
    if (sprint) {
      const mult = sprint.getClip()?.userData?.locoMult ?? 1.75;
      sprint.setEffectiveTimeScale(role === "sprint" ? mult : 1);
    }
  }

  requestOneShot(name, opts = {}) {
    if (this.busy && !opts.allowQueue) return 0;
    const action = this.actions.get(name);
    if (!action) return 0;
    const fade = opts.fade ?? 0.1;
    const ts = opts.timeScale ?? 1;
    for (const [n, a] of this.actions) {
      if (n === name) continue;
      if (n === "idle" || n === "walk" || n === "run" || n === "sprint") {
        a.setEffectiveWeight(Math.min(a.getEffectiveWeight(), 0.15));
      }
    }
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.setEffectiveWeight(1);
    action.setEffectiveTimeScale(ts);
    action.fadeIn(fade);
    action.play();
    this.oneShot = action;
    this.busy = true;
    const dur = action.getClip().duration / Math.max(0.05, ts);
    this.oneShotEnd = performance.now() / 1000 + dur;
    return dur;
  }

  update(dt) {
    const k = 1 - Math.exp(-this.gaitRate * dt);
    this.gait += (this.gaitTarget - this.gait) * k;
    this.applyLocoWeights(this.fade);
    if (this.busy && this.oneShot) {
      const now = performance.now() / 1000;
      if (now >= this.oneShotEnd || !this.oneShot.isRunning()) {
        this.oneShot.fadeOut(this.fade);
        this.oneShot = null;
        this.busy = false;
        const locoA = this.actions.get(this.loco);
        if (locoA) {
          locoA.setEffectiveWeight(1);
          locoA.fadeIn(this.fade);
          locoA.play();
        }
      }
    }
    this.mixer.update(dt);
  }

  dispose() {
    for (const a of this.actions.values()) {
      a.stop();
    }
    this.actions.clear();
    this.oneShot = null;
    this.busy = false;
  }
}
