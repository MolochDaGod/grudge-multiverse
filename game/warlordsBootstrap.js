/**
 * Multiverse Warlords — Bermuda island, grudge6 (deploy SSOT), harvest, combat soft-lock,
 * fleet VFX, static collider rebind, warlords HUD.
 */
import * as THREE from "three";
import { getClass } from "./classes.js";
import { loadBermudaIsland, makeGroundSampler } from "./island.js";
import { collectColliderMeshes, COLLIDER_LAYER } from "./mapLiteracy.js";
import { HarvestSystem } from "./harvest.js";
import { BossFight } from "./bosses.js";
import { loadGrudge6Class } from "./grudge6Loader.js";
import { SkillBar } from "./skills.js";
import {
  loadBag,
  rollKillReward,
  ensureStarterGear,
  loadLoadout,
  equippedWeaponDmg,
} from "./inventory.js";
import { QUICK_RECIPES, craft } from "./crafting.js";
import { VENDORS, buy } from "./vendors.js";
import { spawnVendorProp } from "./vendorProps.js";
import {
  openVendorShop,
  closeVendorShop,
  setVendorPrompt,
  isVendorShopOpen,
} from "./vendorShopUi.js";
import { FleetSkillVfx, vfxKindForSkill } from "./fleetVfx.js";
import {
  aim,
  bindCombatAim,
  resolveAimPoint,
  getPreferredHostile,
  refreshSelectedTargetPoint,
  resolveBodyYaw,
  syncFocusCrosshair,
  updateWorldReticle,
  markHostile,
} from "./combatAim.js";
import {
  mountWarlordsHud,
  refreshCombatFrame,
  setHarvestPrompt,
  syncHp,
  refreshCharacterIntegrityBadge,
} from "./warlordsHud.js";
import { setTightHudSkillBar } from "./drcTightHud.js";
import { startRagdollLite, updateRagdollLite, restoreRagdollLite } from "./ragdollLite.js";
import { setupRaceClassSelectUI } from "./raceClassSelect.js";
import { loadSelection } from "./fleetGearPresets.js";
import { ensureItemCatalog } from "./itemIcons.js";
import { reGroundAfterAnimSample } from "./characterDeploy.js";
import { LootField } from "./lootField.js";
import { refreshOpenTab } from "./mainPanel.js";
import { logDrcContract, DRC_MULTIVERSE } from "./drcContract.js";
import { DrcCombatController, DRC_COMBAT_LEGEND } from "./drcCombat.js";
import { refreshDrcTightHud } from "./drcTightHud.js";
import { ImpactFx, impactKindForSkill } from "./impactFx.js";
import {
  skillCombatMeta,
  resolveGapCloseDest,
  collectPvpTargets,
  clampPvpDmg,
} from "./mvPvp.js";
import {
  ensureMvUiTheme,
  mountGameMenu,
  bindTooltipDelegation,
  setGameCursor,
  cursorFromContext,
  showCastBar,
  actionIconForSkill,
} from "./mvUiTheme.js";

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

/**
 * DRC hotbar → baked mixer roles (same as Open Danger / weaponSkillPacks).
 * F = primary attack · Shift+1–4 = skill1–4 · Shift+5 soft skill5/combo.
 */
function skillAnimRole(skill) {
  if (!skill) return "attack";
  if (skill.key === "KeyF") return "attack";
  const m = {
    Digit1: "skill1",
    Digit2: "skill2",
    Digit3: "skill3",
    Digit4: "skill4",
    Digit5: "skill5",
  };
  return m[skill.key] || "attack";
}

/**
 * Rebuild PlayerController static BVH from island walkable + solid only.
 * NEVER pass the full GLB root — ~1500 meshes (leaves/props) hang mergeGeometries
 * and leave collider=null so update() early-exits (void / frozen).
 */
export function rebindIslandStaticCollider(localPlayer, islandRoot) {
  const ctrl = localPlayer?._player;
  if (!ctrl?.buildStaticCollider || !islandRoot) {
    console.warn("[warlords] cannot rebind static collider");
    return false;
  }
  try {
    islandRoot.updateMatrixWorld(true);
    let meshes = collectColliderMeshes(
      islandRoot,
      [COLLIDER_LAYER.WALKABLE, COLLIDER_LAYER.SOLID],
      { maxMeshes: 420 },
    );
    // Fallback: name-based walk surfaces if tagging missed (should not happen after loadBermudaIsland)
    if (meshes.length < 2) {
      meshes = [];
      islandRoot.traverse((o) => {
        if (!o.isMesh || !o.visible || !o.geometry) return;
        if (/leave|leaf|plant_01|bush|flower|LOD[12]|WeaponBox|Table|Bed/i.test(o.name || "")) return;
        if (
          /Main_Large_Terrain|ground|Floor|road|Road|terrain|CementFactory|house|building|wall|fence|Hangar|island-safety/i.test(
            o.name || "",
          )
        ) {
          meshes.push(o);
        }
      });
      console.warn("[warlords] collider fallback name-filter", meshes.length);
    }
    if (!meshes.length) {
      console.error("[warlords] no collider meshes — keeping previous static collider");
      return false;
    }
    const walkN = meshes.filter(
      (m) => m.userData?.walkable || m.userData?.colliderLayer === COLLIDER_LAYER.WALKABLE,
    ).length;
    console.info(
      `[warlords] building static BVH from ${meshes.length} meshes (walkable~${walkN})`,
    );
    const ok = ctrl.buildStaticCollider(meshes);
    if (ok === false) {
      console.warn("[warlords] static collider rebuild failed — previous collider retained if any");
      return false;
    }
    console.info("[warlords] island static collider rebound OK", {
      meshes: meshes.length,
      hasCollider: !!ctrl.collider || !!ctrl.getCollider?.(),
    });
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

  logDrcContract();
  window.__mvDrc = DRC_MULTIVERSE;

  // Seed RTS starter gear into bag + loadout so Equipment / drops work immediately
  ensureStarterGear(classDef.starterGear);

  mountWarlordsHud();
  ensureMvUiTheme();
  bindTooltipDelegation(document.body);
  mountGameMenu({
    bag: () => window.dispatchEvent(new CustomEvent("mv-open-tab", { detail: { tab: "bag" } })),
    skills: () => window.dispatchEvent(new CustomEvent("mv-open-tab", { detail: { tab: "skills" } })),
    help: () => document.dispatchEvent(new KeyboardEvent("keydown", { code: "F1", bubbles: true })),
  });
  setGameCursor("combat");
  ensureItemCatalog().catch(() => {});
  window.setLoaderStatus?.("Loading Bermuda island…");
  flash?.("DRC · Toon RTS · Bermuda…", 1.2);

  // Map is SI metres (bermuda ~843×614 m, buildings ~5–10 m). Never squash to 120 m.
  // Characters on CDN measure ~12–22 m raw → deploy applies ONE uniform unit normalize to ~1.8 m.
  const island = await loadBermudaIsland(scene, { maxHarvest: 70 });
  const groundAt = island.sampleY || makeGroundSampler(island.root);
  const mapW = island.halfW * 2;
  console.info(
    `[warlords] MAP SI ≈ ${mapW.toFixed(0)} m across · hubR=${island.hubRadius?.toFixed?.(1)} · scale=${island.scale} · nav walkable=${island.nav?.cells?.filter?.((c) => c.walkable).length ?? "?"}`,
  );
  window.__mvMapMeta = {
    units: "si_metres",
    humanHeightM: 1.8,
    halfW: island.halfW,
    landRadius: island.landRadius,
    waterY: island.waterY,
    scale: island.scale,
    widthM: mapW,
    nav: island.nav
      ? {
          cellSize: island.nav.cellSize,
          walkable: island.nav.cells.filter((c) => c.walkable).length,
          total: island.nav.cells.length,
          waterY: island.nav.waterY,
          landRadius: island.nav.landRadius,
        }
      : null,
  };
  window.__mvNav = island.nav || null;
  window.__mvIsland = island;
  window.__mvWater = island.waterPhysics || null;

  // Start ON LAND — spawns already nav-picked; re-snap for safety
  let spawn = (island.spawns[Math.floor(Math.random() * island.spawns.length)] || island.spawns[0]).clone();
  if (island.nav?.snap) {
    const sn = island.nav.snap(spawn.x, spawn.z);
    spawn = new THREE.Vector3(sn.x, sn.y + 1.05, sn.z);
  } else {
    const gy = groundAt(spawn.x, spawn.z);
    spawn.y = (Number.isFinite(gy) ? gy : 0) + 1.15;
  }
  // Refuse water start
  if (island.nav?.isWaterWorld?.(spawn.x, spawn.z) || island.waterPhysics?.isInWater?.(spawn.x, spawn.z, spawn.y - 1)) {
    const land = island.nav?.pickLandSpawns?.(1, island.hubRadius)?.[0];
    if (land) spawn.set(land.x, land.y, land.z);
    else if (island.nav?.snap) {
      const sn = island.nav.snap(0, 0);
      spawn.set(sn.x, sn.y + 1.05, sn.z);
    }
  }
  const spawnGroundY = groundAt(spawn.x, spawn.z);
  console.info(
    `[warlords] LAND spawn xz=(${spawn.x.toFixed(1)},${spawn.z.toFixed(1)}) y=${spawn.y.toFixed(2)} ground=${Number.isFinite(spawnGroundY) ? spawnGroundY.toFixed(2) : "?"} walkable=${!!island.nav?.isWalkableWorld?.(spawn.x, spawn.z)}`,
  );

  // Drop temporary 40 m pad from multiplayer-gltf once real island is up
  if (ctx.tempGround) {
    try {
      ctx.tempGround.parent?.remove(ctx.tempGround);
      ctx.tempGround.geometry?.dispose?.();
      ctx.tempGround.material?.dispose?.();
    } catch {
      /* ignore */
    }
  }

  // Static collider rebind BEFORE placing player (walkable + solid BVH)
  const colliderOk = rebindIslandStaticCollider(localPlayer, island.root);
  if (!colliderOk) {
    console.error("[warlords] island collider missing — player may void; safety ground still on root");
    flash?.("Map colliders failed — safety ground only", 2.5);
  }

  // SI locomotion speeds (m/s) — controller scale 0.01 × cm-era numbers
  try {
    const host = localPlayer._player;
    if (host) {
      // walk ~3.2 m/s, sprint ~9.5 m/s after *3 shift
      if (typeof host.setPlayerSpeed === "function") host.setPlayerSpeed(320);
      else {
        host.playerSpeed = 3.2;
        host.curPlayerSpeed = 3.2;
      }
      host.playerFlySpeed = host.playerFlySpeed || 12;
      host.gravity = -28; // SI-ish fall when scale already applied; clamp if insane
      if (Math.abs(host.gravity) > 200) host.gravity = -28;
      if (Math.abs(host.gravity) < 5) host.gravity = -28;
    }
  } catch {
    /* ignore */
  }

  const capsule = localPlayer._player?.getPlayerCapsule?.();
  if (capsule) {
    const gy2 = groundAt(spawn.x, spawn.z);
    spawn.y = (Number.isFinite(gy2) ? gy2 : spawnGroundY || 0) + 1.15;
    island.waterPhysics?.constrainPosition?.(spawn, groundAt);
    capsule.position.copy(spawn);
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

  window.__mvCollider = {
    ok: colliderOk,
    at: Date.now(),
    spawn: spawn.toArray(),
    groundY: groundAt(spawn.x, spawn.z),
    walkable: !!island.nav?.isWalkableWorld?.(spawn.x, spawn.z),
    waterY: island.waterY,
    landRadius: island.landRadius,
  };

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
  const impacts = new ImpactFx(scene);
  window.__mvImpacts = impacts;
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

    // World attach — Toon RTS root at feet SI; never parent under Mixamo/proxy scale
    scene.add(g6.root);
    const feetY = (() => {
      const gy = groundAt(spawn.x, spawn.z);
      return Number.isFinite(gy) ? gy : 0;
    })();
    g6.root.position.set(spawn.x, feetY, spawn.z);
    g6.root.rotation.set(0, 0, 0);
    g6.root.scale.set(1, 1, 1);

    // Kill Mixamo/proxy mixer; Toon RTS uses AnimationDirector only
    try {
      if (host?.animation?.mixer) host.animation.mixer.timeScale = 0;
      if (host?.playerModel) host.playerModel.visible = false;
    } catch {
      /* ignore */
    }

    // TPS camera: look at chest of SI hero (~1.3 m above feet), orbit 4–10 m
    try {
      if (host?.cam) {
        host.cam.minDist = 3.2;
        host.cam.maxDist = 10.5;
        host.cam.originMaxDist = 10.5;
        host.cam.lookAtHeightRatio = 0.72;
        host.cam.overShoulderOffsetRatio = 0.1;
        host.cam.epsilon = 0.4;
        host.cam.zoomEnabled = true;
        host.isFirstPerson = false;
        host.enableOverShoulderView = true;
        host.cam.setOverShoulder(true);
        host.cam.setCamPos?.();
      }
      if (ctx.camera && capsule) {
        const lookY = feetY + 1.35;
        ctx.camera.position.set(spawn.x + 0.8, lookY + 1.2, spawn.z + 6.5);
        if (ctx.controls) {
          ctx.controls.target.set(spawn.x, lookY, spawn.z);
          ctx.controls.minDistance = 3.2;
          ctx.controls.maxDistance = 11;
          ctx.controls.enablePan = false;
          ctx.controls.update?.();
        }
        ctx.camera.lookAt(spawn.x, lookY, spawn.z);
      }
    } catch {
      /* ignore */
    }

    window.__mvClassLabel = g6.kit?.label || classDef.label;
    window.__mvClassId = classId;
    window.__mvRaceId = raceId;
    window.__mvCharacterSource = g6.source || g6.root?.userData?.characterSource || null;
    window.__mvCharMeta = {
      height: g6.diagnose?.height,
      beforeHeight: g6.diagnose?.beforeHeight,
      scaleFactor: g6.diagnose?.scaleFactor,
      feet: g6.diagnose?.feetMinY,
      animPack: g6.animPack,
      meshes: g6.shownMeshes?.length,
      kitUrl: g6.source?.kitUrl || g6.kit?.kitUrl,
      atlasUrl: g6.source?.atlasUrl || g6.kit?.atlasUrl,
      animsHost: g6.source?.animsHost,
      ssot: g6.source?.ssotVersion,
      degraded: !!g6.source?.degraded,
    };
    console.info(
      `[warlords] CHAR SOURCE ${raceId}/${classId} kit=${(g6.source?.kitUrl || "").split("/").pop()} ` +
        `atlas=${(g6.source?.atlasUrl || "").split("/").pop()} pack=${g6.animPack} ` +
        `h=${g6.diagnose?.height?.toFixed?.(2)}m meshIds=${g6.shownMeshes?.length} ` +
        `MAP≈${(island.halfW * 2).toFixed(0)}m | SI hero ~1.8m vs buildings ~5–10m`,
    );
    refreshCharacterIntegrityBadge(g6.source);
    const grade = g6.source?.integrity || g6.integrity || "red";
    if (grade === "red" || g6.source?.degraded || !g6.director) {
      flash?.(
        `CHAR FAIL (${grade}) — not production Toon RTS. See badge top-right.`,
        4.5,
      );
      console.error("[warlords] FAIL-CLOSED character", g6.source);
    } else if (grade === "yellow") {
      flash?.(`Toon RTS degraded · ${g6.source?.integrityReasons?.join(", ") || "?"}`, 2.5);
    } else {
      flash?.(
        `${g6.kit?.label || classDef.label} · ${g6.diagnose?.height?.toFixed?.(2) || "?"}m · ${g6.animPack} · OK`,
        1.4,
      );
    }
    // Full body/weapon/shield mesh_ids (Toon RTS modular build) — all options remain
    try {
      ensureStarterGear?.(classDef.starterGear);
      const lo = loadLoadout();
      const applied = g6.applyLoadout?.(lo);
      window.__mvShownMeshes = applied?.shown || g6.shownMeshes || [];
      window.__mvMeshLabels = applied?.labeled || g6.meshLabels || [];
      console.info(
        "[warlords] mesh equip",
        (window.__mvMeshLabels || []).map((m) => `${m.slot}:${m.label}`).join(" · "),
      );
    } catch (e) {
      console.warn("[warlords] loadout mesh apply", e);
    }
    refreshCombatFrame({ classLabel: window.__mvClassLabel });
    refreshCharacterIntegrityBadge(g6.source);

  } catch (e) {
    console.error("grudge6 load failed", e);
    flash?.("Character load crashed — check console", 3);
    refreshCharacterIntegrityBadge({
      degraded: true,
      playMesh: "none",
      director: false,
      coreBonesOk: false,
      coreClipOk: false,
      integrity: "red",
      integrityReasons: ["load_exception"],
    });
  }

  // Live equip from Main Panel → swap Toon weapon meshes
  const onLoadout = () => {
    try {
      const res = g6?.applyLoadout?.(loadLoadout());
      window.__mvShownMeshes = res?.shown || g6?.shownMeshes || [];
      window.__mvMeshLabels = res?.labeled || g6?.meshLabels || [];
      refreshCombatFrame({ classLabel: window.__mvClassLabel });
      try {
        refreshOpenTab();
      } catch {
        /* */
      }
      const names = (window.__mvMeshLabels || [])
        .filter((m) => m.category === "weapon" || m.category === "offhand" || m.slot === "body")
        .map((m) => m.label)
        .join(" · ");
      flash?.(names ? `Equipped · ${names}` : "Equipment updated", 0.6);
    } catch (e) {
      console.warn("[warlords] loadout apply", e);
    }
  };
  window.addEventListener("mv-loadout", onLoadout);
  window.addEventListener("mv-bag", () => {
    refreshCombatFrame();
    try {
      refreshOpenTab();
    } catch {
      /* panel may be closed */
    }
  });

  const loot = new LootField(scene, { flash, groundAt });

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
      // Rare gear drop sparkle near resource
      if (Math.random() < 0.12 && n.position) {
        const gearPool = [
          { id: "t0_scrap", name: "Scrap Ore", tier: 0, slot: "mat", qty: 1 },
          { id: "t1_sword", name: "Iron Sword", tier: 1, slot: "weapon", dmg: 18 },
          { id: "t1_leather", name: "Hardened Leather", tier: 1, slot: "armor", armor: 10 },
        ];
        const it = gearPool[Math.floor(Math.random() * gearPool.length)];
        loot.spawn(n.position.clone?.() || n.position, it);
      }
      try {
        refreshOpenTab();
      } catch {
        /* */
      }
    },
  });

  // World bosses — Mantis + Ash Ghast (projectiles) + Werelephant (real GLB)
  // Elden Ring-style: deterministic rotation, ground telegraphs, then hit
  const groundedPads = (island.bossPads || []).map((p) => {
    const pos = p.position.clone();
    pos.y = (groundAt(pos.x, pos.z) ?? 0) + 0.05;
    return {
      ...p,
      position: pos,
      defId: p.defId || "shadow_flame_mantis",
      name: p.name,
    };
  });
  window.setLoaderStatus?.("Loading bosses (Mantis · Ghast · Werelephant)…");
  const bosses = new BossFight(scene, groundedPads);
  await bosses.load();
  flash?.(
    `Bosses ready · ${bosses.bosses.map((b) => `${b.name} ${b.heightM?.toFixed?.(1) || "?"}m`).join(" · ")}`,
    1.8,
  );
  // Mark bosses hostile for soft-lock select
  for (const b of bosses.bosses || []) {
    if (b.root) markHostile(b.root, b.id, "boss");
  }

  // ── DRC fleet combat first (skills call gapCloseTo) ──
  const tmpFwd = new THREE.Vector3();
  const combat = new DrcCombatController({
    getCapsule: () => localPlayer._player?.getPlayerCapsule?.() || null,
    getCtrl: () => localPlayer._player,
    getDirector: () => g6?.director,
    getForward: () => {
      const c = ctx.camera;
      if (c) {
        c.getWorldDirection(tmpFwd);
        tmpFwd.y = 0;
        if (tmpFwd.lengthSq() > 1e-6) return tmpFwd.normalize();
      }
      tmpFwd.set(Math.sin(bodyYaw), 0, Math.cos(bodyYaw));
      return tmpFwd;
    },
    groundAt,
    isWater: (x, z) => !!island.nav?.isWaterWorld?.(x, z),
    flash,
    vfx,
    onCombatEvent: (ev) => {
      try {
        ctx.onCombatEvent?.(ev);
      } catch {
        /* */
      }
    },
  });
  combat.bind();
  window.__mvCombat = combat;
  window.__mvMaxStamina = combat.maxStamina;
  window.__mvStamina = combat.stamina;
  flash?.(DRC_COMBAT_LEGEND, 2.2);

  const skillBar = new SkillBar(classDef, () => loadBag().level || 1, {
    flash,
    onCast: (skill) => {
      const pos = capsule?.position;
      if (!pos) return;

      if (g6?.director) {
        const role = skillAnimRole(skill);
        g6.director.requestOneShot(role) || g6.director.requestOneShot("attack");
        // Re-ground kit **relative to SI root** (local y=0) — never world y=0
        // (that sunk heroes by island altitude after every skill).
        setTimeout(() => {
          if (g6?.model) reGroundAfterAnimSample(g6.model, 0);
        }, 90);
      }

      const cam = ctx.camera;
      const camFwd = new THREE.Vector3();
      cam?.getWorldDirection(camFwd);
      camFwd.y = 0;
      if (camFwd.lengthSq() < 1e-6) camFwd.set(0, 0, 1);
      camFwd.normalize();

      const feet = new THREE.Vector3(pos.x, groundAt(pos.x, pos.z) ?? pos.y - 1, pos.z);
      refreshSelectedTargetPoint();
      const aimPt = resolveAimPoint(feet, camFwd);
      const dir = aimPt.clone().sub(feet);
      dir.y = 0;
      if (dir.lengthSq() < 1e-6) dir.copy(camFwd);
      dir.normalize();

      const meta = skillCombatMeta(skill);
      const { range, aoeR, gapClose, isRanged, isAoe } = meta;
      const pref = getPreferredHostile();
      const prefMesh = pref?.mesh || null;
      const prefId = pref?.id || null;
      const prefPoint = pref?.point || null;

      // MM gap-close / weapon skill close (soft-lock preferred)
      if (gapClose > 0) {
        const dest = resolveGapCloseDest(pos, dir, skill, prefPoint);
        if (dest) {
          const blink = /blink/i.test(`${skill.id} ${skill.name}`);
          combat.gapCloseTo(dest, { blink, dist: gapClose, skillId: skill.id });
        }
      }

      const kind = vfxKindForSkill(skill);
      const color =
        classId === "mage"
          ? 0xc478ff
          : classId === "ranger"
            ? 0x7ec8ff
            : classId === "worge"
              ? 0xff6a3a
              : 0x9fe8ff;
      // AoE blast VFX at feet or soft-lock ground
      const vfxOrigin = isAoe && prefPoint
        ? new THREE.Vector3(prefPoint.x, groundAt(prefPoint.x, prefPoint.z) ?? feet.y, prefPoint.z)
        : feet.clone();
      vfx.play(kind, vfxOrigin, dir, color, { radius: aoeR || range, dist: gapClose });
      if (isAoe && kind !== "blast") {
        vfx.play("blast", vfxOrigin, dir, color, { radius: aoeR || 4 });
      }

      if ((skill.cd || 0) >= 6 || skill.kind?.includes("magic") || skill.kind?.includes("aoe")) {
        showCastBar(skill.name || "Skill", Math.min(900, (skill.cd || 1) * 90));
      }

      // Fan-out combat event for multiplayer VFX
      ctx.onCombatEvent?.({
        kind: "skill",
        skill: skill.id,
        name: skill.name,
        vfx: kind,
        aoeR: aoeR || 0,
        x: vfxOrigin.x,
        y: vfxOrigin.y,
        z: vfxOrigin.z,
        dx: dir.x,
        dz: dir.z,
        color,
      });

      const baseDmg = equippedWeaponDmg(14);
      const dmg = clampPvpDmg(baseDmg * (skill.dmgMul || 1));
      if (skill.dmgMul === 0 && !isAoe) {
        // pure buff — no damage pipeline
        flash?.(`${skill.name}`, 0.4);
        return;
      }
      const ikind = impactKindForSkill(skill);
      const hitRadius = aoeR > 0 ? aoeR : range;

      const applyBossHit = (b) => {
        const hitDmg = Math.floor(baseDmg * (skill.dmgMul || 1));
        if (hitDmg <= 0) return;
        const hitPos = b.root.position.clone().add(new THREE.Vector3(0, 1.2, 0));
        impacts.play(ikind === "hit" && hitDmg > 30 ? "crit" : ikind, hitPos, {
          radius: isAoe ? Math.max(2.2, aoeR * 0.55) : 1.4,
          yLift: 0.2,
        });
        try {
          const knock = hitPos.clone().sub(feet).setY(0.2).normalize().multiplyScalar(2.2);
          startRagdollLite(b.root, {
            impulse: knock,
            power: Math.min(1.4, 0.4 + hitDmg / 80),
            death: false,
            groundAt,
          });
        } catch {
          /* */
        }
        const res = bosses.hit(b.id, hitDmg, playerId);
        set?.(ref(db, `rooms/${roomId}/bosses/${b.id}`), bosses.serialize()[b.id]);
        window.__mvBossTarget = {
          name: b.name,
          hp: b.hp,
          maxHp: b.maxHp,
        };
        if (res.killed) {
          const reward = rollKillReward(true);
          flash?.(`${b.name} defeated! L${reward.level}`, 1.2);
          impacts.play("explode", hitPos, { radius: 2.6, color: 0xff8844 });
          try {
            startRagdollLite(b.root, {
              impulse: hitPos.clone().sub(feet).setY(0.8).normalize().multiplyScalar(4),
              power: 1.5,
              death: true,
              groundAt,
            });
          } catch {
            /* */
          }
          if (reward.dropped?.length) {
            loot.spawnMany(b.root.position.clone(), reward.dropped);
          }
          window.__mvBossTarget = null;
          if (aim.selectedTarget?.id === b.id) aim.selectedTarget = null;
          refreshCombatFrame();
        } else {
          flash?.(`${b.name} HP ${res.hp}`, 0.4);
          refreshCombatFrame();
        }
      };

      // Boss hits — soft-lock preferred, AoE radius, melee cone
      for (const b of bosses.bosses) {
        if (b.dead || !b.root) continue;
        const origin = isAoe ? vfxOrigin : pos;
        const d = b.root.position.distanceTo(origin);
        const isPref =
          (prefId && (b.id === prefId || b.root.userData?.id === prefId)) ||
          (prefMesh &&
            (b.root === prefMesh ||
              b.root.uuid === prefMesh.uuid ||
              prefMesh.parent === b.root));
        const maxR = isPref ? hitRadius * 1.35 : hitRadius;
        if (d > maxR) continue;
        if (!isAoe && !isRanged && !isPref) {
          const toB = b.root.position.clone().sub(pos);
          toB.y = 0;
          const len = toB.length();
          if (len > 1e-4 && toB.normalize().dot(dir) < 0.2) continue;
        }
        applyBossHit(b);
      }

      // PvP — remote players in range (friends blocked by host)
      try {
        const remotes = ctx.remotePlayers || window.__mvRemotePlayers;
        const netRemotes = window.__mvNetRemotes;
        const canDmg = ctx.canDamageTarget || window.__mvCanDamageTarget;
        const onPvpHit = ctx.onHitPlayer || window.__mvOnHitPlayer;
        const targets = collectPvpTargets(remotes, netRemotes);
        for (const t of targets) {
          if (canDmg && !canDmg(t.id)) continue;
          const origin = isAoe ? vfxOrigin : pos;
          const d = Math.hypot(t.pos.x - origin.x, t.pos.z - origin.z);
          const isPref = prefId && t.id === prefId;
          const maxR = isPref ? hitRadius * 1.35 : hitRadius;
          if (d > maxR) continue;
          if (dmg <= 0) continue;
          onPvpHit?.(t.id, dmg);
          ctx.onCombatEvent?.({
            kind: "pvp",
            targetId: t.id,
            dmg,
            skill: skill.id,
            x: t.pos.x,
            y: t.pos.y,
            z: t.pos.z,
          });
          impacts.play(ikind, t.pos.clone().add(new THREE.Vector3(0, 1.1, 0)), {
            radius: isAoe ? 2 : 1.1,
          });
        }
      } catch (e) {
        console.warn("[warlords] pvp skill hit", e);
      }
    },
  });
  skillBar.bind();
  // DRC tight HUD owns visual slots; feed skill CDs + cast
  setTightHudSkillBar(skillBar, classDef);

  // Soft-lock / focus input — free mouse only (no pointer-lock cursor loss)
  const canvas = ctx.renderer?.domElement || document.querySelector("canvas");
  let unbindAim = () => {};
  if (canvas && ctx.camera) {
    canvas.style.cursor = "crosshair";
    document.exitPointerLock?.();
    unbindAim = bindCombatAim(
      canvas,
      ctx.camera,
      () => {
        const list = [];
        for (const b of bosses.bosses || []) if (b.root && !b.dead) list.push(b.root);
        for (const n of island.harvestNodes || []) if (n.object && !n.broken) list.push(n.object);
        // Soft-lock PvP remotes (Firebase + Railway capsules)
        try {
          const remotes = ctx.remotePlayers || window.__mvRemotePlayers;
          if (remotes) {
            for (const rp of remotes.values()) {
              if (rp?._isDead) continue;
              if (rp.model) list.push(rp.model);
            }
          }
          const net = window.__mvNetRemotes;
          if (net) {
            for (const rp of net.values()) {
              if (rp?.dead || !rp.root) continue;
              list.push(rp.root);
            }
          }
        } catch {
          /* */
        }
        return list;
      },
      {
        onAttack: () => {
          const skills = classDef.skills || [];
          const f = skills.find((s) => s.key === "KeyF");
          if (f) skillBar.cast(f);
        },
        onFocusChange: (on) => flash?.(on ? "Focus ON · free mouse" : "Focus OFF", 0.5),
      },
    );
  }
  // Always show DOM crosshair in play (never hide with lock)
  if (crosshairEl) {
    crosshairEl.style.display = "block";
    crosshairEl.style.opacity = "0.95";
  }

  // Weapon / armor booths — real weaponvendor.glb (SI fit ~4.5 m)
  window.setLoaderStatus?.("Loading weapon vendor booth…");
  /** @type {Awaited<ReturnType<typeof spawnVendorProp>>[]} */
  const vendorProps = [];
  for (const v of island.vendorPads) {
    try {
      const prop = await spawnVendorProp(scene, v, groundAt);
      vendorProps.push(prop);
      v._mesh = prop.root;
      v._interactR = prop.interactRadius;
      v._kind = prop.kind;
      const label = document.createElement("div");
      label.className = "player-name-label";
      label.style.display = "block";
      label.textContent = v.label;
      document.body.appendChild(label);
      v._label = label;
    } catch (e) {
      console.warn("[vendor] spawn failed", v.id, e);
    }
  }
  flash?.(
    `Vendors ready · near booth E trades · elsewhere E = block`,
    1.4,
  );

  document.addEventListener("keydown", (e) => {
    if (e.code === "Escape" && isVendorShopOpen()) {
      closeVendorShop();
      return;
    }
    if (e.code !== "KeyE" || e.repeat) return;
    const cam = ctx.camera;
    if (!cam || !capsule) return;

    // 1) Vendor booth (very near) — trade; else combat block via DrcCombat
    for (const v of island.vendorPads) {
      if (!v._mesh) continue;
      const d = capsule.position.distanceTo(v._mesh.position);
      if (d <= (v._interactR || 2.8)) {
        window.__mvNearVendor = true;
        openVendorShop(v.id === "armor" ? "armor" : "weapon");
        flash?.(`${v.label} · shop open`, 0.6);
        return;
      }
    }

    // 2) Loot pickup
    const nearLoot = loot.pickNearest(capsule.position, 2.6);
    if (nearLoot) {
      loot.collect(nearLoot.id);
      return;
    }

    // 3) Harvest
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

  /** Next land spawn for death respawn — never hard-coded burnout SPAWN_POINTS. */
  const pickRespawn = () => {
    const pts = island.spawns || [];
    let p = null;
    if (pts.length) {
      const idx = Math.floor(Math.random() * pts.length);
      p = pts[idx].clone();
    } else {
      const land = island.nav?.pickLandSpawns?.(1, island.hubRadius)?.[0];
      if (land) p = new THREE.Vector3(land.x, land.y, land.z);
    }
    if (!p) {
      const sn = island.nav?.snap?.(0, 0);
      p = sn
        ? new THREE.Vector3(sn.x, sn.y + 1.15, sn.z)
        : new THREE.Vector3(0, 2, 0);
    }
    if (island.nav?.snap) {
      const sn = island.nav.snap(p.x, p.z);
      p.set(sn.x, sn.y + 1.15, sn.z);
    } else {
      const gy = groundAt(p.x, p.z);
      p.y = (Number.isFinite(gy) ? gy : 0) + 1.15;
    }
    island.waterPhysics?.constrainPosition?.(p, groundAt);
    return p;
  };

  /** Clear death ragdoll, combat state, re-enable director after respawn. */
  const onRespawn = () => {
    try {
      const root = g6?.model || g6?.root;
      if (root?.userData?.ragdollLite) restoreRagdollLite(root);
      if (g6?.root && g6.root !== root) delete g6.root.userData.ragdollLite;
      if (g6?.director) g6.director.enabled = true;
      if (combat) {
        combat.stamina = combat.maxStamina;
        combat.jumpsUsed = 0;
        combat.state = "idle";
        combat.blockHeld = false;
        combat.dashRemain = 0;
        combat.iframesUntil = 0;
        combat.parryUntil = 0;
      }
      const ctrl = localPlayer?._player;
      if (ctrl) {
        ctrl._jumpsUsed = 0;
        ctrl.playerVelocity?.set?.(0, 0, 0);
      }
      window.__mvStamina = combat?.stamina ?? 100;
      syncHp(window.__mvHp ?? 100, window.__mvMaxHp ?? 100);
      refreshCombatFrame();
    } catch (e) {
      console.warn("[warlords] onRespawn restore", e);
    }
  };

  window.__mvPickRespawn = pickRespawn;
  window.__mvOnRespawn = onRespawn;

  return {
    island,
    harvest,
    bosses,
    skillBar,
    combat,
    g6,
    loot,
    vfx,
    impacts,
    aim,
    classDef,
    groundAt,
    getClassState,
    unbindAim,
    pickRespawn,
    onRespawn,
    rebindCollider: () => rebindIslandStaticCollider(localPlayer, island.root),
    /** Boss / PvP damage through defense pipeline */
    resolveDamage(baseDmg, meta) {
      return combat.resolveIncomingHit(baseDmg, meta || {});
    },
    update(dt) {
      harvest.update();
      vfx.update(dt);
      if (capsule?.position) loot.update(dt, capsule.position);
      syncFocusCrosshair(crosshairEl);
      // Soft-lock track moving bosses (chest point stays live)
      if (aim.selectedTarget?.mesh) refreshSelectedTargetPoint();

      const pos = capsule?.position;
      const ctrl = localPlayer?._player;
      if (!pos) return;

      // Near vendor flag for E = trade vs block
      let nearV = false;
      for (const v of island.vendorPads || []) {
        if (!v._mesh) continue;
        if (pos.distanceTo(v._mesh.position) <= (v._interactR || 2.8)) {
          nearV = true;
          break;
        }
      }
      window.__mvNearVendor = nearV;

      // DRC combat tick (dodge travel, stam, water-aware dash)
      combat.update(dt, { nav: island.nav, waterPhysics: island.waterPhysics });
      impacts.update(dt);
      // Cursor from context (hostile / harvest / vendor)
      if (!this._curAcc) this._curAcc = 0;
      this._curAcc += dt;
      if (this._curAcc > 0.12) {
        this._curAcc = 0;
        try {
          cursorFromContext({
            classId,
            hostile: !!window.__mvBossTarget || !!aim.focusEnabled,
            harvest: !!document.querySelector?.(".mv-harvest-prompt") || false,
            vendor: !!window.__mvNearVendor,
            loot: false,
            busy: combat.state === "dodge" || combat.state === "slide",
          });
        } catch {
          /* */
        }
      }
      if (!this._stamAcc) this._stamAcc = 0;
      this._stamAcc += dt;
      if (this._stamAcc > 0.15) {
        this._stamAcc = 0;
        try {
          refreshDrcTightHud({ light: true });
        } catch {
          /* */
        }
      }

      // Feet IK / snap — same height field as nav (SI raycast)
      let groundY = groundAt(pos.x, pos.z) ?? 0;
      // Water layer physics — soft land clamp (no swim yet)
      if (island.waterPhysics?.constrainPosition?.(pos, groundAt)) {
        groundY = groundAt(pos.x, pos.z) ?? groundY;
        try {
          ctrl.playerVelocity.x *= 0.35;
          ctrl.playerVelocity.z *= 0.35;
          ctrl.playerVelocity.y = 0;
        } catch {
          /* ignore */
        }
      }
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

      // Vendor / loot / harvest proximity prompts (priority: vendor → loot → harvest)
      let nearVendor = null;
      for (const v of island.vendorPads) {
        if (!v._mesh) continue;
        const d = pos.distanceTo(v._mesh.position);
        if (d <= (v._interactR || 2.8)) {
          nearVendor = v;
          break;
        }
      }
      if (nearVendor) {
        setVendorPrompt(true, nearVendor.label || "Vendor");
        setHarvestPrompt(false);
      } else {
        setVendorPrompt(false);
        const nearLoot = loot.pickNearest(pos, 2.8);
        if (nearLoot) {
          setHarvestPrompt(true, nearLoot.item?.name || "loot", "loot");
        } else {
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
          setHarvestPrompt(!!nearHarvest, nearHarvest?.kind || "resource", "harvest");
        }
      }

      // Nearest living boss for HUD target strip
      let nearestBoss = null;
      let bossD = 22;
      for (const b of bosses.bosses || []) {
        if (b.dead || !b.root) continue;
        const d = b.root.position.distanceTo(pos);
        if (d < bossD) {
          bossD = d;
          nearestBoss = b;
        }
      }
      window.__mvBossTarget = nearestBoss
        ? { name: nearestBoss.name, hp: nearestBoss.hp, maxHp: nearestBoss.maxHp }
        : null;

      // Body yaw + traversal — use KEYS + velocity (Mixamo isMoving is dead when grudge6 skins)
      let moving = false;
      let dx = 0;
      let dz = 0;
      let sprinting = false;
      let speed01 = 0;
      try {
        const vel = ctrl?.getVelocity?.() || tmpVel.set(0, 0, 0);
        dx = vel.x;
        dz = vel.z;
        const spd = Math.hypot(dx, dz);
        const inp = ctrl?.input;
        const keys =
          !!(inp?.fwd || inp?.bkd || inp?.lft || inp?.rgt) ||
          (Math.abs(inp?.analogMoveX || 0) > 0.12 || Math.abs(inp?.analogMoveY || 0) > 0.12);
        sprinting = !!inp?.shift;
        moving = keys || spd > 0.08;
        // SI: walk ~3 m/s, sprint ~9 m/s
        const walkMax = Math.max(2.5, ctrl?.playerSpeed || 3.2);
        const sprintMax = walkMax * 3;
        const maxSpd = sprinting ? sprintMax : walkMax;
        speed01 = Math.min(1, spd / Math.max(0.4, maxSpd * 0.92));
        if (keys && speed01 < 0.2) speed01 = sprinting ? 0.95 : 0.4;
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
        // Feet on ground (Box3 feet Y) — same groundY as nav / water clamp
        g6.root.position.set(pos.x, groundY, pos.z);
        // Yaw only on SI root — art-forward +π/2 lives on child model (never overwrite)
        g6.root.rotation.set(0, bodyYaw, 0);
        // Keep Mixamo/proxy ghost hidden every frame (controller may re-show)
        try {
          if (ctrl?.playerModel) ctrl.playerModel.visible = false;
        } catch {
          /* */
        }

        if (g6.director) {
          g6.director.setGaitTarget(moving, sprinting, speed01);
          g6.director.update(dt);
          window.__mvTraversal = g6.director.getTraversalState?.() || {
            loco: g6.director.loco,
            speed01,
            sprinting,
            moving,
          };
        } else {
          g6.mixer?.update(dt);
        }

        // Periodic feet clamp if anim residual floats kit (parent-local, not world 0)
        if (!this._groundAcc) this._groundAcc = 0;
        this._groundAcc += dt;
        if (this._groundAcc > 0.5 && g6.model && !g6.root.userData?.ragdollLite) {
          this._groundAcc = 0;
          reGroundAfterAnimSample(g6.model, 0);
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

      // Boss AI: heightfield A* pathfinding + Elden telegraphs
      const attacks = bosses.update(dt, pos, island.nav || null);
      for (const a of attacks) {
        const res = combat.resolveIncomingHit(a.damage || 0, {
          boss: a.name,
          attack: a.attack || a.kind,
        });
        const impactAt = pos.clone().add(new THREE.Vector3(0, 1.1, 0));
        if (res.dmg > 0) {
          impacts.play(res.dmg > 40 ? "crit" : "hit", impactAt, { color: 0xff6644 });
          // Player hit-react flop (non-death)
          if (g6?.root && res.dmg > 18) {
            try {
              const fromBoss = impactAt
                .clone()
                .sub(a.pos || impactAt)
                .setY(0.3)
                .normalize()
                .multiplyScalar(-2.5);
              startRagdollLite(g6.root, {
                director: g6.director,
                impulse: fromBoss,
                power: Math.min(1.1, 0.35 + res.dmg / 60),
                death: false,
                groundAt,
              });
            } catch {
              /* */
            }
          }
          ctx.onBossHitLocal?.(res.dmg, a.name);
        } else if (res.kind === "perfect_parry" || res.kind === "parry") {
          impacts.play("parry", impactAt);
          window.__mvBossTelegraph = {
            boss: a.name,
            attack: res.kind === "perfect_parry" ? "PERFECT PARRY" : "Parried",
            t: performance.now(),
          };
          refreshCombatFrame();
        } else if (res.kind === "iframe") {
          impacts.play("hit", impactAt, { color: 0x88ccff, yLift: 0.5 });
          refreshCombatFrame();
        } else if (res.kind === "block") {
          impacts.play("shockwave", impactAt, { radius: 0.9, color: 0xaaccff });
          refreshCombatFrame();
        }
      }
      // Lite ragdoll tick after death flop
      if (g6?.root?.userData?.ragdollLite) {
        updateRagdollLite(g6.root.userData.ragdollLite, dt);
      }
      // Refresh HUD when boss telegraph changes
      if (window.__mvBossTelegraph || window.__mvBossTarget) {
        if (!this._hudAcc) this._hudAcc = 0;
        this._hudAcc += dt;
        if (this._hudAcc > 0.15) {
          this._hudAcc = 0;
          refreshCombatFrame();
        }
      }
    },
    onPlayerKillEnemy(isBoss) {
      return rollKillReward(!!isBoss);
    },
    /** Call when local HP changes so unit frame stays correct */
    syncPlayerHp(hp, maxHp = 100) {
      syncHp(hp, maxHp);
      // Death → lite Bip001 ragdoll (restore on respawn via beginRagdoll/restore)
      if (hp <= 0 && g6?.root && !g6.root.userData.ragdollLite) {
        const impulse = new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          0.35,
          (Math.random() - 0.5) * 2,
        );
        startRagdollLite(g6.model || g6.root, {
          director: g6.director,
          impulse,
        });
        // also mark outer root if model is nested
        if (g6.model && g6.root !== g6.model) {
          g6.root.userData.ragdollLite = g6.model.userData.ragdollLite;
        }
      } else if (hp > 0 && g6?.root?.userData?.ragdollLite) {
        restoreRagdollLite(g6.model || g6.root);
        if (g6.director) g6.director.enabled = true;
        delete g6.root.userData.ragdollLite;
      }
    },
  };
}
