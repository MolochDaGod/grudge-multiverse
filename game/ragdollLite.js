/**
 * Lite death/hit ragdoll for grudge6 Bip001 — no second physics engine.
 * Freezes AnimationMixer; flops bones + root under impulse (explosion / heavy hit).
 * SI units. Optional groundAt for feet clamp. Reset via restoreRagdollLite.
 */
import * as THREE from "three";

const FLOP_BONES = [
  "Bip001 Pelvis",
  "Bip001 Spine",
  "Bip001 Spine1",
  "Bip001 Neck",
  "Bip001 Head",
  "Bip001 L UpperArm",
  "Bip001 R UpperArm",
  "Bip001 L Forearm",
  "Bip001 R Forearm",
  "Bip001 L Hand",
  "Bip001 R Hand",
  "Bip001 L Thigh",
  "Bip001 R Thigh",
  "Bip001 L Calf",
  "Bip001 R Calf",
  "Bip001 L Foot",
  "Bip001 R Foot",
];

/**
 * @param {THREE.Object3D} root grudge6 model root
 * @param {object} [opts]
 * @param {object} [opts.director] AnimationDirector — stopped on death
 * @param {THREE.Vector3} [opts.impulse] world-space knock (m/s scale)
 * @param {number} [opts.power] 0.5 light hit · 1 death · 1.6 explosion
 * @param {(x:number,z:number)=>number} [opts.groundAt] land Y sampler
 * @param {boolean} [opts.death] full flop if true
 */
export function startRagdollLite(root, opts = {}) {
  if (!root) return null;
  // Hit-react can re-trigger; death sticks until restore
  if (root.userData.ragdollLite?.death) return root.userData.ragdollLite;

  try {
    opts.director?.mixer?.stopAllAction?.();
    if (opts.director) {
      opts.director.enabled = false;
      opts.director.busy = false;
    }
  } catch {
    /* ignore */
  }

  const power = opts.power ?? (opts.death === false ? 0.55 : 1.15);
  const death = opts.death !== false;

  const bones = [];
  for (const name of FLOP_BONES) {
    const b =
      root.getObjectByName(name) ||
      root.getObjectByName(name.replace(/ /g, "_"));
    if (!b) continue;
    const arm = /Arm|Hand|Forearm/i.test(name) ? 1.35 : 1;
    const leg = /Thigh|Calf|Foot/i.test(name) ? 0.9 : 1;
    bones.push({
      bone: b,
      q0: b.quaternion.clone(),
      rx: (Math.random() - 0.5) * 1.4 * power * arm,
      ry: (Math.random() - 0.5) * 0.5 * power,
      rz: (Math.random() - 0.5) * 1.25 * power * leg,
    });
  }

  const impulse = opts.impulse?.clone?.() || new THREE.Vector3(
    (Math.random() - 0.5) * 2.2 * power,
    0.35 * power,
    (Math.random() - 0.5) * 2.2 * power,
  );
  impulse.y = Math.max(0.08, impulse.y);
  // Cap knock so we don't launch 100× (SI)
  if (impulse.length() > 8 * power) impulse.setLength(8 * power);

  const state = {
    root,
    bones,
    t: 0,
    life: death ? 1.35 : 0.55,
    done: false,
    death,
    impulse,
    groundAt: opts.groundAt || null,
    baseY: root.position.y,
    baseRotX: root.rotation.x,
    baseRotZ: root.rotation.z,
    power,
  };
  root.userData.ragdollLite = state;
  return state;
}

export function updateRagdollLite(state, dt) {
  if (!state || state.done) return;
  state.t += dt;
  const u = Math.min(1, state.t / state.life);
  const ease = u * u * (3 - 2 * u);
  const p = state.power || 1;

  // Root ballistic tip / fall (SI metres)
  state.root.position.x += state.impulse.x * dt * (1 - u * 0.85);
  state.root.position.z += state.impulse.z * dt * (1 - u * 0.85);
  const loft = Math.sin(u * Math.PI) * 0.22 * p * (1 - u);
  const drop = ease * (state.death ? 0.55 : 0.12) * p;
  let y = state.baseY + loft - drop;
  if (state.groundAt) {
    try {
      const gy = state.groundAt(state.root.position.x, state.root.position.z);
      if (Number.isFinite(gy)) y = Math.max(gy + 0.02, y);
    } catch {
      /* */
    }
  }
  state.root.position.y = y;
  state.root.rotation.x = state.baseRotX + ease * (state.death ? 1.25 : 0.35) * p;
  state.root.rotation.z = state.baseRotZ + ease * 0.4 * p * (state.impulse.x >= 0 ? 1 : -1);

  const e = new THREE.Euler();
  const q = new THREE.Quaternion();
  for (const b of state.bones) {
    e.set(b.rx * ease, b.ry * ease, b.rz * ease, "XYZ");
    q.setFromEuler(e);
    b.bone.quaternion.copy(b.q0).multiply(q);
  }

  if (u >= 1) {
    state.done = true;
    // Hit-react auto-restore after short flop
    if (!state.death && state.root) {
      setTimeout(() => {
        if (state.root?.userData?.ragdollLite === state) restoreRagdollLite(state.root);
      }, 40);
    }
  }
}

export function restoreRagdollLite(root) {
  const state = root?.userData?.ragdollLite;
  if (!state) return;
  for (const b of state.bones) {
    b.bone.quaternion.copy(b.q0);
  }
  root.rotation.x = state.baseRotX;
  root.rotation.z = state.baseRotZ;
  root.position.y = state.baseY;
  delete root.userData.ragdollLite;
}
