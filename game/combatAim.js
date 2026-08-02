/**
 * Soft-lock / focus targeting — cloned from grudge-combat-targeting skill.
 * LMB select · RMB toggle focus · body faces cam-forward in focus mode.
 * Not a new combat engine — input/aim state for Multiverse weapon skills.
 */
import * as THREE from "three";

/** @typedef {{ id: string, point: THREE.Vector3, mesh?: THREE.Object3D, kind?: string }} TargetRef */

export const aim = {
  focusEnabled: false,
  rmb: false,
  /** @type {TargetRef | null} */
  selectedTarget: null,
  /** @type {THREE.Vector3 | null} */
  groundPoint: null,
};

const _ray = new THREE.Raycaster();
const _mouse = new THREE.Vector2();
const _tmp = new THREE.Vector3();
const _tmp2 = new THREE.Vector3();

/**
 * @param {HTMLElement} canvas
 * @param {THREE.Camera} camera
 * @param {() => THREE.Object3D[]} getSelectables
 * @param {{ onAttack?: () => void, onFocusChange?: (on: boolean) => void }} [hooks]
 */
export function bindCombatAim(canvas, camera, getSelectables, hooks = {}) {
  const onPointerDown = (e) => {
    if (e.button === 0) {
      if (aim.focusEnabled) {
        hooks.onAttack?.();
      } else {
        pickTarget(e, camera, getSelectables());
      }
      return;
    }
    if (e.button === 2) {
      aim.focusEnabled = !aim.focusEnabled;
      aim.rmb = true;
      hooks.onFocusChange?.(aim.focusEnabled);
      // NEVER pointer-lock on Multiverse web/embed — browser hides cursor and
      // OrbitControls + lock fight each other. Free mouse + HUD crosshair always.
      try {
        document.exitPointerLock?.();
      } catch {
        /* ignore */
      }
    }
  };
  const onPointerUp = (e) => {
    if (e.button === 2) aim.rmb = false;
  };
  const onBlur = () => {
    aim.rmb = false;
  };
  const onContext = (e) => e.preventDefault();

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onBlur);
  canvas.addEventListener("contextmenu", onContext);

  return () => {
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("blur", onBlur);
    document.removeEventListener("visibilitychange", onBlur);
    canvas.removeEventListener("contextmenu", onContext);
  };
}

/**
 * @param {PointerEvent} e
 * @param {THREE.Camera} camera
 * @param {THREE.Object3D[]} selectables
 */
export function pickTarget(e, camera, selectables) {
  const el = e.target;
  const rect = (el?.getBoundingClientRect?.() || { left: 0, top: 0, width: innerWidth, height: innerHeight });
  _mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  _mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  _ray.setFromCamera(_mouse, camera);
  const hits = _ray.intersectObjects(selectables, true);
  for (const h of hits) {
    let o = h.object;
    while (o) {
      const sel = o.userData?.selectable;
      if (sel === "hostile" || sel === "boss" || sel === "node") {
        const point = h.point.clone();
        point.y += 1.1; // chest height soft aim
        aim.selectedTarget = {
          id: o.userData.id || o.name || o.uuid,
          point,
          mesh: o,
          kind: sel,
        };
        return aim.selectedTarget;
      }
      o = o.parent;
    }
  }
  aim.selectedTarget = null;
  return null;
}

/** Resolve aim point for skills / projectiles. */
export function resolveAimPoint(playerPos, camFwd) {
  if (aim.focusEnabled && aim.selectedTarget?.point) {
    return aim.selectedTarget.point.clone();
  }
  if (aim.selectedTarget?.point && !aim.focusEnabled) {
    return aim.selectedTarget.point.clone();
  }
  return _tmp.copy(playerPos).addScaledVector(camFwd, 8).setY(playerPos.y + 1.1).clone();
}

/**
 * Soft-lock facing: travel dir when free, cam-forward when focus/rmb.
 * @returns {number} target yaw (Y)
 */
export function resolveBodyYaw(opts) {
  const { moving, dx, dz, camYaw, focusEnabled, rmb } = opts;
  const faceTravel = moving && !focusEnabled && !rmb;
  if (faceTravel && (Math.abs(dx) > 1e-4 || Math.abs(dz) > 1e-4)) {
    return Math.atan2(dx, dz);
  }
  // camera-forward yaw (OrbitControls style: cam looks along -Z after yaw)
  return camYaw;
}

/**
 * Screen crosshair — ALWAYS visible in Multiverse play (DRC open.* rule).
 * Focus only changes color/size; never hide the reticle.
 */
export function syncFocusCrosshair(el) {
  if (!el) return;
  el.style.display = "block";
  el.style.opacity = "0.95";
  if (aim.focusEnabled) {
    el.classList.add("focus-on");
    el.style.borderColor = aim.selectedTarget ? "#ff6a6a" : "rgba(255, 180, 80, 0.95)";
    el.style.background = aim.selectedTarget ? "rgba(255,80,80,0.45)" : "rgba(255,208,120,0.95)";
  } else {
    el.classList.remove("focus-on");
    el.style.borderColor = "rgba(100, 180, 255, 0.75)";
    el.style.background = "rgba(255, 255, 255, 0.92)";
  }
}

/**
 * World ground reticle ahead of player / soft-lock lerp to target.
 * @param {THREE.Object3D} reticle
 */
export function updateWorldReticle(reticle, playerPos, camYaw, groundY = 0) {
  if (!reticle) return;
  reticle.visible = !!aim.focusEnabled;
  if (!aim.focusEnabled) return;
  const fx = Math.sin(camYaw);
  const fz = Math.cos(camYaw);
  let ax = playerPos.x + fx * 4;
  let az = playerPos.z + fz * 4;
  if (aim.selectedTarget?.point) {
    const t = aim.selectedTarget.point;
    ax = THREE.MathUtils.lerp(ax, t.x, 0.55);
    az = THREE.MathUtils.lerp(az, t.z, 0.55);
  }
  reticle.position.set(ax, groundY + 0.05, az);
}

export function markHostile(object3d, id, kind = "hostile") {
  if (!object3d) return;
  object3d.userData.selectable = kind;
  object3d.userData.id = id;
  object3d.traverse((c) => {
    c.userData.selectable = kind;
    c.userData.id = id;
  });
}
