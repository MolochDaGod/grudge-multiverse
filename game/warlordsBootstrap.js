/**
 * Multiverse Warlords mode — wires Bermuda island, grudge6 classes,
 * harvest, vendors, crafting, bosses, skill bar, main panel on I.
 */
import * as THREE from "three";
import { CLASSES, getClass } from "./classes.js";
import { loadBermudaIsland, makeGroundSampler } from "./island.js";
import { HarvestSystem } from "./harvest.js";
import { BossFight } from "./bosses.js";
import { loadGrudge6Class } from "./grudge6Loader.js";
import { SkillBar } from "./skills.js";
import { loadBag, saveBag, rollKillReward } from "./inventory.js";
import { QUICK_RECIPES, craft } from "./crafting.js";
import { VENDORS, buy } from "./vendors.js";

/**
 * Patch name overlay for class selection instead of mixamo cast.
 */
export function setupClassSelectUI() {
  const picker = document.getElementById("char-picker");
  if (!picker) return { classId: "warrior" };
  picker.innerHTML = "";
  picker.style.gridTemplateColumns = "repeat(2, 1fr)";
  let selected = localStorage.getItem("mv_class_id") || "warrior";
  CLASSES.forEach((c) => {
    const card = document.createElement("div");
    card.className = "char-card" + (c.id === selected ? " selected" : "");
    card.dataset.classId = c.id;
    card.innerHTML = `
      <div class="char-avatar" style="display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,#1a2030,#0d1018);color:#c8a84b;font-size:22px;font-weight:800;">
        ${c.label.slice(0, 1)}
      </div>
      <span class="char-name">${c.label}</span>`;
    card.title = c.blurb;
    card.addEventListener("click", () => {
      picker.querySelectorAll(".char-card").forEach((x) => x.classList.remove("selected"));
      card.classList.add("selected");
      selected = c.id;
      localStorage.setItem("mv_class_id", c.id);
    });
    picker.appendChild(card);
  });
  return {
    getClassId: () =>
      document.querySelector("#char-picker .char-card.selected")?.dataset?.classId || selected,
  };
}

/**
 * Build main panel tabs content for inventory / craft / vendors / players.
 */
export function enhanceMainPanel() {
  const tabs = document.getElementById("main-panel-tabs");
  if (!tabs) return;
  // Replace tabs: Players | Bag | Craft | Vendors | Areas
  tabs.innerHTML = `
    <button type="button" class="on" data-tab="players">Players</button>
    <button type="button" data-tab="bag">Bag</button>
    <button type="button" data-tab="craft">Craft</button>
    <button type="button" data-tab="vendors">Vendors</button>
    <button type="button" data-tab="areas">Enemy Areas</button>
  `;
  let bagPanel = document.getElementById("bag-panel");
  if (!bagPanel) {
    bagPanel = document.createElement("div");
    bagPanel.id = "bag-panel";
    bagPanel.style.cssText = "display:none;padding:12px 16px;overflow:auto;max-height:40vh;font-size:12px;color:#ccc;";
    document.getElementById("players-list")?.parentElement?.insertBefore(
      bagPanel,
      document.getElementById("main-panel-foot"),
    );
  }
  let craftPanel = document.getElementById("craft-panel");
  if (!craftPanel) {
    craftPanel = document.createElement("div");
    craftPanel.id = "craft-panel";
    craftPanel.style.cssText = bagPanel.style.cssText;
    bagPanel.after(craftPanel);
  }
  let vendorPanel = document.getElementById("vendor-panel");
  if (!vendorPanel) {
    vendorPanel = document.createElement("div");
    vendorPanel.id = "vendor-panel";
    vendorPanel.style.cssText = bagPanel.style.cssText;
    craftPanel.after(vendorPanel);
  }

  const show = (id) => {
    const map = {
      players: "players-list",
      areas: "areas-panel",
      bag: "bag-panel",
      craft: "craft-panel",
      vendors: "vendor-panel",
    };
    Object.values(map).forEach((pid) => {
      const el = document.getElementById(pid);
      if (el) el.style.display = "none";
    });
    const el = document.getElementById(map[id]);
    if (el) el.style.display = id === "players" || id === "areas" ? (id === "players" ? "block" : "block") : "block";
    if (id === "bag") renderBag();
    if (id === "craft") renderCraft();
    if (id === "vendors") renderVendors();
  };

  tabs.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      tabs.querySelectorAll("button").forEach((b) => b.classList.remove("on"));
      btn.classList.add("on");
      show(btn.dataset.tab);
    });
  });
}

export function renderBag() {
  const el = document.getElementById("bag-panel");
  if (!el) return;
  const bag = loadBag();
  el.innerHTML = `
    <div style="margin-bottom:8px;color:#c8a84b;font-weight:700">Level ${bag.level} · XP ${bag.xp} · Gold ${bag.gold}</div>
    <ul style="margin:0;padding-left:16px;line-height:1.6">
      ${bag.items.map((i) => `<li>${i.name}${i.qty && i.qty > 1 ? ` ×${i.qty}` : ""} <span style="color:#666">T${i.tier} ${i.slot}</span></li>`).join("") || "<li>Empty bag</li>"}
    </ul>
  `;
}

export function renderCraft() {
  const el = document.getElementById("craft-panel");
  if (!el) return;
  el.innerHTML = `<div style="color:#c8a84b;font-weight:700;margin-bottom:8px">Quick Crafting</div>` +
    QUICK_RECIPES.map(
      (r) =>
        `<button type="button" data-craft="${r.id}" style="display:block;width:100%;text-align:left;margin:4px 0;padding:8px;border-radius:6px;border:1px solid rgba(200,168,75,0.3);background:rgba(0,0,0,0.35);color:#ddd;cursor:pointer">
          <strong>${r.name}</strong><br/><span style="font-size:10px;color:#888">${Object.entries(r.costs).map(([k, v]) => `${k}×${v}`).join(", ")}</span>
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
  el.innerHTML = `<div style="color:#c8a84b;margin-bottom:8px">Gold: ${bag.gold}</div>` +
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
 * Full warlords world attach after LocalPlayer exists.
 * @returns warlords context for multiplayer sync
 */
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
    onChildAdded,
    remove,
  } = ctx;

  const classId = localStorage.getItem("mv_class_id") || "warrior";
  const classDef = getClass(classId);

  // Island
  flash?.("Loading Bermuda island…", 1.2);
  const island = await loadBermudaIsland(scene, { targetWidth: 120, maxHarvest: 70 });
  const groundAt = makeGroundSampler(island.root);

  // Place player on island spawn
  const spawn = island.spawns[Math.floor(Math.random() * island.spawns.length)];
  const y = groundAt(spawn.x, spawn.z);
  if (y != null) spawn.y = y + 1.1;
  const capsule = localPlayer._player?.getPlayerCapsule?.();
  if (capsule) capsule.position.copy(spawn);

  // grudge6 visual
  let g6 = null;
  try {
    g6 = await loadGrudge6Class(classId);
    // Hide default mixamo mesh, attach grudge6
    const old = localPlayer.getPlayerModel?.();
    if (old) old.visible = false;
    // Parent to capsule / player root
    const attach =
      localPlayer._player?.getPlayerCapsule?.() ||
      localPlayer._player?.player ||
      localPlayer._sceneGroup;
    // Attach to controller root if available
    const host = localPlayer._player;
    if (host?.playerModel) {
      // offset feet
      g6.root.position.set(0, 0, 0);
      // Some controllers put model under a group
      try {
        host.playerModel.visible = false;
        host.playerModel.parent?.add(g6.root);
      } catch {
        scene.add(g6.root);
      }
    } else {
      scene.add(g6.root);
    }
  } catch (e) {
    console.warn("grudge6 load failed", e);
  }

  // Harvest
  const harvest = new HarvestSystem(scene, island.harvestNodes, {
    flash,
    onBreak: (n) => {
      set?.(ref(db, `rooms/${roomId}/harvest/${n.id}`), {
        hp: 0,
        broken: true,
        t: Date.now(),
        by: playerId,
      });
    },
  });

  // Bosses
  const bosses = new BossFight(scene, island.bossPads);

  // Skills
  const skillBar = new SkillBar(classDef, () => loadBag().level || 1, {
    flash,
    onCast: (skill) => {
      // Simple skill: damage nearest boss or ray harvest / attack pulse
      if (skill.kind?.includes("melee") || skill.kind === "magic" || skill.kind?.includes("ranged")) {
        const pos = capsule?.position;
        if (!pos) return;
        for (const b of bosses.bosses) {
          if (b.dead) continue;
          if (b.root.position.distanceTo(pos) < 5) {
            const dmg = Math.floor(14 * (skill.dmgMul || 1));
            const res = bosses.hit(b.id, dmg, playerId);
            set?.(ref(db, `rooms/${roomId}/bosses/${b.id}`), bosses.serialize()[b.id]);
            if (res.killed) {
              const reward = rollKillReward(true);
              flash?.(`${b.name} defeated! L${reward.level}`, 1.2);
            } else flash?.(`${b.name} HP ${res.hp}`, 0.4);
          }
        }
      }
    },
  });
  skillBar.bind();

  // Vendor markers
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

  // Harvest interact E
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
      // Near vendor?
      for (const v of island.vendorPads) {
        if (v._mesh && capsule.position.distanceTo(v._mesh.position) < 3) {
          flash?.(`${v.label}: open panel (I) → Vendors`, 1);
        }
      }
    }
  });

  // Firebase harvest + bosses
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

  enhanceMainPanel();

  // Sync class in player state helper
  const getClassState = () => ({
    classId,
    level: loadBag().level || 1,
    gear: classDef.starterGear,
  });

  return {
    island,
    harvest,
    bosses,
    skillBar,
    g6,
    classDef,
    groundAt,
    getClassState,
    update(dt) {
      harvest.update();
      const pos = capsule?.position;
      if (g6?.root && pos) {
        g6.root.position.set(pos.x, pos.y - 0.9, pos.z);
        // face camera yaw if available
        const q = capsule.getWorldQuaternion?.(new THREE.Quaternion());
        if (q) g6.root.quaternion.copy(q);
        g6.mixer?.update(dt);
      }
      // vendor labels
      if (ctx.camera && ctx.renderer) {
        for (const v of island.vendorPads) {
          if (!v._label || !v._mesh) continue;
          const sp = v._mesh.position.clone().project(ctx.camera);
          const x = (sp.x * 0.5 + 0.5) * window.innerWidth;
          const y = (-sp.y * 0.5 + 0.5) * window.innerHeight;
          v._label.style.transform = `translate(-50%,-100%) translate(${x}px,${y - 24}px)`;
          v._label.style.display = sp.z < 1 ? "block" : "none";
        }
      }
      if (pos) {
        const attacks = bosses.update(dt, pos);
        for (const a of attacks) {
          ctx.onBossHitLocal?.(a.damage, a.name);
        }
      }
    },
    onPlayerKillEnemy(isBoss) {
      return rollKillReward(!!isBoss);
    },
  };
}
