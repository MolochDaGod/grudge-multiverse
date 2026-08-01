/**
 * Multiverse Warlords — Bermuda island, grudge6 (deploy SSOT), harvest, combat soft-lock,
 * fleet VFX, static collider rebind, warlords HUD.
 */
import * as THREE from "three";
import { getClass } from "./classes.js";
import { loadBermudaIsland, makeGroundSampler } from "./island.js";
import { HarvestSystem } from "./harvest.js";
import { BossFight } from "./bosses.js";
import { loadGrudge6Class } from "./grudge6Loader.js";
import { SkillBar } from "./skills.js";
import { loadBag, rollKillReward } from "./inventory.js";
import { QUICK_RECIPES, craft } from "./crafting.js";
import { VENDORS, buy } from "./vendors.js";
import { FleetSkillVfx, vfxKindForSkill } from "./fleetVfx.js";
import {
  aim,
  bindCombatAim,
  resolveAimPoint,
  resolveBodyYaw,
  syncFocusCrosshair,
  updateWorldReticle,
  markHostile,
} from "./combatAim.js";
import { mountWarlordsHud, refreshCombatFrame, setHarvestPrompt } from "./warlordsHud.js";
import { setupRaceClassSelectUI } from "./raceClassSelect.js";
import { loadSelection } from "./fleetGearPresets.js";
import { ensureItemCatalog } from "./itemIcons.js";
import { reGroundAfterAnimSample } from "./characterDeploy.js";

/** @deprecated use setupRaceClassSelectUI — race first, then class */
export function setupClassSelectUI() {
  return setupRaceClassSelectUI();
}

export { setupRaceClassSelectUI };

/** @deprecated use mountMainPanelShell from mainPanel.js (fleet main-panel layout). */
export function enhanceMainPanel() {
  // no-op — multiplayer-gltf mounts fleet main panel
}

export function renderBag() {
  const el = document.getElementById("bag-panel");
  if (!el) return;
  const bag = loadBag();
  el.innerHTML = `
    <div style="margin-bottom:8px;color:#c8a84b;font-weight:700">Level ${bag.level} · XP ${bag.xp} · Gold ${bag.gold}</div>
    <ul style="margin:0;padding-left:16px;line-height:1.6">
      ${
        bag.items
          .map(
            (i) =>
              `<li>${i.name}${i.qty && i.qty > 1 ? ` ×${i.qty}` : ""} <span style="color:#666">T${i.tier} ${i.slot}</span></li>`,
          )
          .join("") || "<li>Empty bag</li>"
      }
    </ul>
  `;
}

export function renderCraft() {
  const el = document.getElementById("craft-panel");
  if (!el) return;
  el.innerHTML =
    `<div style="color:#c8a84b;font-weight:700;margin-bottom:8px">Quick Crafting</div>` +
    QUICK_RECIPES.map(
      (r) =>
        `<button type="button" data-craft="${r.id}" style="display:block;width:100%;text-align:left;margin:4px 0;padding:8px;border-radius:6px;border:1px solid rgba(200,168,75,0.3);background:rgba(0,0,0,0.35);color:#ddd;cursor:pointer">
          <strong>${r.name}</strong><br/><span style="font-size:10px;color:#888">${Object.entries(r.costs)
            .map(([k, v]) => `${k}×${v}`)
            .join(", ")}</span>
        </button>`,
    ).join("");
  el.querySelectorAll("[data-craft]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const res = craft(btn.getAttribute("data-craft"));
      if (res.ok) {
        btn.style.borderColor = "#5fd48a";
        renderBag();
      } else {
        btn.style.borderColor = "#e85d5d";
        alert(res.error || "craft failed");
      }
    });
  });
}

export function renderVendors() {
  const el = document.getElementById("vendor-panel");
  if (!el) return;
  const bag = loadBag();
  el.innerHTML =
    `<div style="color:#c8a84b;margin-bottom:8px">Gold: ${bag.gold}</div>` +
    Object.entries(VENDORS)
      .map(
        ([key, v]) =>
          `<div style="margin:10px 0 6px;font-weight:700;color:#8ec0ff">${v.name}</div>` +
          v.stock
            .map(
              (s) =>
                `<button type="button" data-v="${key}" data-item="${s.id}" style="display:block;width:100%;text-align:left;margin:3px 0;padding:6px 8px;border-radius:6px;border:1px solid #333;background:#12161f;color:#ccc;cursor:pointer">
                  ${s.name} · <span style="color:#f4c542">${s.price}g</span> · T${s.tier}
                </button>`,
            )
            .join(""),
      )
      .join("");
  el.querySelectorAll("button[data-item]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const res = buy(btn.getAttribute("data-v"), btn.getAttribute("data-item"));
      if (res.ok) {
        renderVendors();
        renderBag();
      } else alert(res.error === "gold" ? "Not enough gold" : "Buy failed");
    });
  });
}

function skillAnimRole(skill) {
  if (!skill) return "attack";
  if (skill.key === "KeyF") return "attack";
  const m = { Digit1: "skill1", Digit2: "skill2", Digit3: "skill3", Digit4: "skill4", Digit5: "skill5" };
  return m[skill.key] || "attack";
}

export function rebindIslandStaticCollider(localPlayer, islandRoot) {
  const ctrl = localPlayer?._player;
  if (!ctrl?.buildStaticCollider || !islandRoot) {
    console.warn("[warlords] cannot rebind static collider");
    return false;
  }
  try {
    islandRoot.updateMatrixWorld(true);
    ctrl.buildStaticCollider(islandRoot);
    console.info("[warlords] island static collider rebound");
    return true;
  } catch (e) {
    console.warn("[warlords] static collider rebind failed", e);
    return false;
  }
}

/** Capsule origin → approximate feet Y offset for SI scale 0.01 controller. */
function capsuleFeetY(ctrl, capsule) {
  if (!ctrl || !capsule) return capsule?.position?.y ?? 0;
  const s = ctrl.playerModelConfig?.scale ?? 0.01;
  // rideHeight 40 * s + approx half-capsule below origin
  const ride = 40 * s;
  const r = 30 * s;
  const h = 180 * s;
  const colliderH = h - ride;
  const segment = Math.max(0.01, colliderH - 2 * r);
  // feet ≈ capsule.y - segment - r - ride  (geometry local bottom)
  return capsule.position.y - segment - r - ride * 0.25;
}

export async function attachWarlordsWorld(ctx) {
  const {
    scene,
    localPlayer,
    flash,
    db,
    roomId,
    playerId,
    set,
    ref,
    onValue,
  } = ctx;

  const sel = loadSelection();
  const classId = sel.classId || "warrior";
  const raceId = sel.raceId || "western-kingdoms";
  const skillClass =
    classId === "knight" ? "warrior" : classId === "unarmed" ? "worge" : classId;
  const classDef = getClass(skillClass);

  mountWarlordsHud();
  ensureItemCatalog().catch(() => {});
  window.setLoaderStatus?.("Loading Bermuda island…");
  flash?.("Loading Bermuda island…", 1.2);

  // Preserve SI metres (bermuda already ~840 m). Do NOT pass targetWidth: 120 (dollhouse bug).
  const island = await loadBermudaIsland(scene, { maxHarvest: 70 });
  const groundAt = makeGroundSampler(island.root);

  // Place player on grass spawn outside hub
  const spawn = island.spawns[Math.floor(Math.random() * island.spawns.length)].clone();
  const gy = groundAt(spawn.x, spawn.z);
  spawn.y = (gy ?? 0) + 1.15;
  const capsule = localPlayer._player?.getPlayerCapsule?.();
  if (capsule) {
    capsule.position.copy(spawn);
    // Zero velocity so we don't punch through on first frame
    try {
      localPlayer._player.playerVelocity?.set(0, 0, 0);
    } catch {
      /* ignore */
    }
  }

  // Camera near spawn (third-person over shoulder)
  if (ctx.camera && ctx.controls) {
    ctx.camera.position.set(spawn.x + 4, spawn.y + 2.5, spawn.z + 6);
    ctx.controls.target.copy(spawn);
    ctx.controls.update?.();
  }

  // #5 static collider rebind
  rebindIslandStaticCollider(localPlayer, island.root);

  // Soft-lock world reticle
  const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.35, 0.48, 32),
    new THREE.MeshBasicMaterial({
      color: 0xe8c877,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  reticle.rotation.x = -Math.PI / 2;
  reticle.visible = false;
  scene.add(reticle);

  const vfx = new FleetSkillVfx(scene);
  const crosshairEl = document.getElementById("crosshair");

  // grudge6 character
  let g6 = null;
  let bodyYaw = 0;
  try {
    window.setLoaderStatus?.(`Loading ${raceId} · ${classId}…`);
    g6 = await loadGrudge6Class({ raceId, classId });
    const old = localPlayer.getPlayerModel?.();
    if (old) old.visible = false;

    const host = localPlayer._player;
    if (host?.playerModel) host.playerModel.visible = false;

    // World attach — SI independent of mixamo scale
    scene.add(g6.root);
    g6.root.position.set(spawn.x, gy ?? 0, spawn.z);

    try {
      if (host?.animation?.mixer) host.animation.mixer.timeScale = 0;
    } catch {
      /* ignore */
    }

    window.__mvClassLabel = g6.kit?.label || classDef.label;
    window.__mvClassId = classId;
    window.__mvRaceId = raceId;
    refreshCombatFrame({ classLabel: window.__mvClassLabel });
    flash?.(
      `${g6.kit?.label || classDef.label} · ${g6.animPack} · ${g6.shownMeshes?.length || 0} meshes · ${g6.diagnose?.height?.toFixed?.(2) || "?"}m`,
      1.4,
    );
  } catch (e) {
    console.warn("grudge6 load failed", e);
  }

  const harvest = new HarvestSystem(scene, island.harvestNodes, {
    flash,
    onBreak: (n) => {
      set?.(ref(db, `rooms/${roomId}/harvest/${n.id}`), {
        hp: 0,
        broken: true,
        t: Date.now(),
        by: playerId,
      });
      refreshCombatFrame();
    },
  });

  const bosses = new BossFight(scene, island.bossPads);
  // Mark bosses hostile for soft-lock select
  for (const b of bosses.bosses || []) {
    if (b.root) markHostile(b.root, b.id, "boss");
  }

  const skillBar = new SkillBar(classDef, () => loadBag().level || 1, {
    flash,
    onCast: (skill) => {
      const pos = capsule?.position;
      if (!pos) return;

      if (g6?.director) {
        const role = skillAnimRole(skill);
        g6.director.requestOneShot(role) || g6.director.requestOneShot("attack");
        // Re-ground after skill sample (hip-float kill from residual tracks)
        setTimeout(() => {
          if (g6?.model) reGroundAfterAnimSample(g6.model, 0);
        }, 80);
      }

      const cam = ctx.camera;
      const camFwd = new THREE.Vector3();
      cam?.getWorldDirection(camFwd);
      camFwd.y = 0;
      if (camFwd.lengthSq() < 1e-6) camFwd.set(0, 0, 1);
      camFwd.normalize();

      const feet = new THREE.Vector3(pos.x, groundAt(pos.x, pos.z) ?? pos.y - 1, pos.z);
      const aimPt = resolveAimPoint(feet, camFwd);
      const dir = aimPt.clone().sub(feet);
      dir.y = 0;
      if (dir.lengthSq() < 1e-6) dir.copy(camFwd);
      dir.normalize();

      const kind = vfxKindForSkill(skill);
      const color =
        classId === "mage"
          ? 0xc478ff
          : classId === "ranger"
            ? 0x7ec8ff
            : classId === "worge"
              ? 0xff6a3a
              : 0x9fe8ff;
      vfx.play(kind, feet.clone(), dir, color);

      // Range-gated damage (combat-runtime style)
      const range =
        skill.kind?.includes("ranged") || skill.kind === "magic"
          ? 22
          : skill.kind?.includes("aoe")
            ? 4.5
            : 2.8;
      for (const b of bosses.bosses) {
        if (b.dead) continue;
        const d = b.root.position.distanceTo(pos);
        if (d < range) {
          const dmg = Math.floor(14 * (skill.dmgMul || 1));
          const res = bosses.hit(b.id, dmg, playerId);
          set?.(ref(db, `rooms/${roomId}/bosses/${b.id}`), bosses.serialize()[b.id]);
          if (res.killed) {
            const reward = rollKillReward(true);
            flash?.(`${b.name} defeated! L${reward.level}`, 1.2);
          } else flash?.(`${b.name} HP ${res.hp}`, 0.4);
        }
      }
    },
  });
  skillBar.bind();

  // Soft-lock / focus input
  const canvas = ctx.renderer?.domElement || document.querySelector("canvas");
  let unbindAim = () => {};
  if (canvas && ctx.camera) {
    unbindAim = bindCombatAim(
      canvas,
      ctx.camera,
      () => {
        const list = [];
        for (const b of bosses.bosses || []) if (b.root && !b.dead) list.push(b.root);
        for (const n of island.harvestNodes || []) if (n.object && !n.broken) list.push(n.object);
        return list;
      },
      {
        onAttack: () => {
          const skills = classDef.skills || [];
          const f = skills.find((s) => s.key === "KeyF");
          if (f) skillBar.cast(f);
        },
        onFocusChange: (on) => flash?.(on ? "Focus ON · soft-lock" : "Focus OFF", 0.5),
      },
    );
  }

  for (const v of island.vendorPads) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.5, 1.6, 10),
      new THREE.MeshStandardMaterial({ color: v.id === "armor" ? 0x4a90d9 : 0xc8a84b }),
    );
    m.position.copy(v.position);
    m.position.y = (groundAt(v.position.x, v.position.z) ?? 0) + 0.8;
    scene.add(m);
    const label = document.createElement("div");
    label.className = "player-name-label";
    label.style.display = "block";
    label.textContent = v.label;
    document.body.appendChild(label);
    v._mesh = m;
    v._label = label;
  }

  document.addEventListener("keydown", (e) => {
    if (e.code !== "KeyE" || e.repeat) return;
    const cam = ctx.camera;
    if (!cam || !capsule) return;
    const origin = cam.position.clone();
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const node = harvest.pick(origin, dir, 5);
    if (node) {
      const res = harvest.hit(node.id, "any", 14);
      if (res.ok) {
        set?.(ref(db, `rooms/${roomId}/harvest/${node.id}`), {
          hp: node.hp,
          broken: node.broken,
          t: Date.now(),
        });
      }
    } else {
      for (const v of island.vendorPads) {
        if (v._mesh && capsule.position.distanceTo(v._mesh.position) < 3) {
          flash?.(`${v.label}: open panel (I) → Vendors`, 1);
        }
      }
    }
  });

  if (db && ref && onValue) {
    onValue(ref(db, `rooms/${roomId}/harvest`), (snap) => {
      const data = snap.val() || {};
      for (const [id, st] of Object.entries(data)) {
        harvest.applyRemoteState(id, st.hp, st.broken);
      }
    });
    onValue(ref(db, `rooms/${roomId}/bosses`), (snap) => {
      const data = snap.val() || {};
      for (const [id, st] of Object.entries(data)) bosses.applyRemote(id, st);
    });
  }

  const getClassState = () => ({
    raceId,
    classId,
    level: loadBag().level || 1,
    gear: classDef.starterGear,
    animPack: g6?.animPack,
    meshIds: g6?.visibleMeshes,
  });

  const tmpVel = new THREE.Vector3();
  const _euler = new THREE.Euler();

  return {
    island,
    harvest,
    bosses,
    skillBar,
    g6,
    vfx,
    aim,
    classDef,
    groundAt,
    getClassState,
    unbindAim,
    rebindCollider: () => rebindIslandStaticCollider(localPlayer, island.root),
    update(dt) {
      harvest.update();
      vfx.update(dt);
      syncFocusCrosshair(crosshairEl);

      const pos = capsule?.position;
      const ctrl = localPlayer?._player;
      if (!pos) return;

      // Feet IK / snap — raycast ground under player
      const groundY = groundAt(pos.x, pos.z) ?? 0;
      // Keep capsule from falling into void (safety)
      const feetEst = capsuleFeetY(ctrl, capsule);
      if (feetEst < groundY - 0.5 || pos.y < groundY - 2) {
        pos.y = groundY + 1.15;
        try {
          ctrl.playerVelocity.y = 0;
        } catch {
          /* ignore */
        }
      }

      // Harvest proximity prompt (desktop E) — no mobile UI
      let nearHarvest = null;
      let bestD = 3.2;
      if (harvest.nodes && typeof harvest.nodes.values === "function") {
        for (const n of harvest.nodes.values()) {
          if (n.broken || !n.position) continue;
          const d = Math.hypot(n.position.x - pos.x, n.position.z - pos.z);
          if (d < bestD) {
            bestD = d;
            nearHarvest = n;
          }
        }
      }
      setHarvestPrompt(!!nearHarvest, nearHarvest?.kind || "resource");

      // Body yaw: soft-lock / travel
      let moving = false;
      let dx = 0;
      let dz = 0;
      try {
        const vel = ctrl?.getVelocity?.() || tmpVel.set(0, 0, 0);
        dx = vel.x;
        dz = vel.z;
        moving = Math.hypot(dx, dz) > 0.05 || !!localPlayer.isMoving;
      } catch {
        moving = !!localPlayer.isMoving;
      }

      let camYaw = 0;
      if (ctx.camera) {
        ctx.camera.getWorldDirection(tmpVel);
        camYaw = Math.atan2(tmpVel.x, tmpVel.z);
      }

      const targetYaw = resolveBodyYaw({
        moving,
        dx,
        dz,
        camYaw,
        focusEnabled: aim.focusEnabled,
        rmb: aim.rmb,
      });
      // Smooth yaw
      let dy = targetYaw - bodyYaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      bodyYaw += dy * Math.min(1, 12 * dt);

      updateWorldReticle(reticle, pos, bodyYaw, groundY);

      if (g6?.root) {
        // Feet on ground (Box3-style feet Y) — model local feet at 0
        g6.root.position.set(pos.x, groundY, pos.z);
        // Yaw only — never copy full capsule quaternion (kills sideways/roll)
        g6.root.rotation.set(0, bodyYaw, 0);

        if (g6.director && ctrl) {
          let speed01 = 0;
          let sprinting = false;
          try {
            const vel = ctrl.getVelocity?.() || tmpVel.set(0, 0, 0);
            tmpVel.set(vel.x, 0, vel.z);
            const spd = tmpVel.length();
            const maxSpd = Math.max(0.01, (ctrl.curPlayerSpeed || ctrl.playerSpeed || 1) * 0.9);
            speed01 = Math.min(1, spd / maxSpd);
            sprinting = !!ctrl.input?.shift || speed01 > 0.85;
          } catch {
            /* ignore */
          }
          g6.director.setGaitTarget(moving, sprinting, speed01);
          g6.director.update(dt);
        } else {
          g6.mixer?.update(dt);
        }
      }

      if (ctx.camera) {
        for (const v of island.vendorPads) {
          if (!v._label || !v._mesh) continue;
          const sp = v._mesh.position.clone().project(ctx.camera);
          const x = (sp.x * 0.5 + 0.5) * window.innerWidth;
          const y = (-sp.y * 0.5 + 0.5) * window.innerHeight;
          v._label.style.transform = `translate(-50%,-100%) translate(${x}px,${y - 24}px)`;
          v._label.style.display = sp.z < 1 ? "block" : "none";
        }
      }

      const attacks = bosses.update(dt, pos);
      for (const a of attacks) {
        ctx.onBossHitLocal?.(a.damage, a.name);
      }
    },
    onPlayerKillEnemy(isBoss) {
      return rollKillReward(!!isBoss);
    },
  };
}
