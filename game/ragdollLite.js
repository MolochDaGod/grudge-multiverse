/**
 * Lite death ragdoll for grudge6 Bip001 — no second physics engine.
 * Freezes AnimationMixer and flops major bones toward gravity over ~1.2s.
 * SI units. Reset via restoreRagdollLite when respawning.
 */
import * as THREE from "three";

const FLOP_BONES = [
  "Bip001 Pelvis",
  "Bip001 Spine",
  "Bip001 Neck",
  "Bip001 Head",
  "Bip001 L UpperArm",
  "Bip001 R UpperArm",
  "Bip001 L Forearm",
  "Bip001 R Forearm",
  "Bip001 L Thigh",
  "Bip001 R Thigh",
  "Bip001 L Calf",
  "Bip001 R Calf",
];

/**
 * @param {THREE.Object3D} root grudge6 model root
 * @param {object} [opts]
 * @param {object} [opts.director] AnimationDirector — stopped on death
 * @param {THREE.Vector3} [opts.impulse] world-space knock direction
 */
export function startRagdollLite(root, opts = {}) {
  if (!root || root.userData.ragdollLite) return root.userData.ragdollLite;

  try {
    opts.director?.mixer?.stopAllAction?.();
    if (opts.director) opts.director.enabled = false;
  } catch {
    /* ignore */
  }

  const bones = [];
  for (const name of FLOP_BONES) {
    const b =
      root.getObjectByName(name) ||
      root.getObjectByName(name.replace(/ /g, "_"));
    if (!b) continue;
    bones.push({
      bone: b,
      q0: b.quaternion.clone(),
      // random flop targets (radians) — small, SI human scale
      rx: (Math.random() - 0.5) * 1.2,
      ry: (Math.random() - 0.5) * 0.4,
      rz: (Math.random() - 0.5) * 1.1,
    });
  }

  const impulse = opts.impulse?.clone?.() || new THREE.Vector3(
    (Math.random() - 0.5) * 1.5,
    0.2,
    (Math.random() - 0.5) * 1.5,
  );
  impulse.y = Math.max(0.05, impulse.y);

  const state = {
    root,
    bones,
    t: 0,
    life: 1.25,
    done: false,
    impulse,
    baseY: root.position.y,
    baseRotX: root.rotation.x,
    baseRotZ: root.rotation.z,
  };
  root.userData.ragdollLite = state;
  return state;
}

export function updateRagdollLite(state, dt) {
  if (!state || state.done) return;
  state.t += dt;
  const u = Math.min(1, state.t / state.life);
  const ease = u * u * (3 - 2 * u);

  // Root tip / fall
  state.root.position.x += state.impulse.x * dt * (1 - u);
  state.root.position.z += state.impulse.z * dt * (1 - u);
  state.root.position.y = state.baseY + Math.sin(u * Math.PI) * 0.15 * (1 - u) - ease * 0.35;
  state.root.rotation.x = state.baseRotX + ease * 1.15;
  state.root.rotation.z = state.baseRotZ + ease * 0.35;

  const e = new THREE.Euler();
  const q = new THREE.Quaternion();
  for (const b of state.bones) {
    e.set(b.rx * ease, b.ry * ease, b.rz * ease, "XYZ");
    q.setFromEuler(e);
    b.bone.quaternion.copy(b.q0).multiply(q);
  }

  if (u >= 1) state.done = true;
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
