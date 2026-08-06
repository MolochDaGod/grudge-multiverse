/**
 * Multiverse Main Panel — fleet SSOT layout from
 * https://info.grudge-studio.com/main-panel.html
 *
 * Structure: top bar · left combat stats · center tabs + paperdoll · right inv grid · foot hotbar
 * Tabs: Equipment · Skills · Crafting · Server  (Quests → Server social)
 * Data: Multiverse bag / loadout / class skills only — no invented item DB.
 */
import { getClass } from "./classes.js";
import {
  loadBag,
  countMat,
  loadLoadout,
  equipItem,
  unequipSlot,
} from "./inventory.js";
import { QUICK_RECIPES, craft } from "./crafting.js";
import { VENDORS, buy } from "./vendors.js";
import { ensureItemCatalog, iconHtml, skillIconUrl, itemIconUrl } from "./itemIcons.js";
import { racePortraitUrl } from "./selectIcons.js";
import { unlockedSkills } from "./classes.js";

ensureItemCatalog().catch(() => {});

export const CRAFTING_SUITE_URL = "https://grudge-crafting.puter.site/";
export const MAIN_PANEL_SSOT = "https://info.grudge-studio.com/main-panel.html";

const INV_SLOTS = 42;
const ARMOR_SLOTS = ["Helm", "Shoulder", "Chest", "Hands", "Feet", "Relic"];
const WEAPON_SLOTS = ["Mainhand", "Offhand"];
const JEWELRY_SLOTS = ["Ring", "Necklace"];
const LEFT_SLOTS = ARMOR_SLOTS;
const RIGHT_SLOTS = [...WEAPON_SLOTS, ...JEWELRY_SLOTS];
const SLOT_ICONS = {
  Helm: "🪖",
  Shoulder: "🛡",
  Chest: "🎽",
  Hands: "🧤",
  Feet: "🥾",
  Relic: "🔮",
  Mainhand: "⚔",
  Offhand: "🛡",
  Ring: "💍",
  Necklace: "📿",
};
const TIER_COLORS = {
  0: "#8b7355",
  1: "#a8a8a8",
  2: "#4a9eff",
  3: "#9d4dff",
};

/** @type {import('./mainPanel.js').SocialApi | null} */
let socialApi = null;
let activeTab = "equipment";

/**
 * @typedef {{
 *   getLocal: () => { id: string, name: string, kills: number, deaths: number, hp: number },
 *   getRemotes: () => { id: string, name: string, kills: number, deaths: number, hp: number|string }[],
 *   getRelation: (id: string) => string,
 *   requestFriend: (id: string) => void,
 *   declareEnemy: (id: string) => void,
 *   unfriend: (id: string) => void,
 *   acceptFriend?: (id: string) => void,
 *   declineFriend?: (id: string) => void,
 *   roomLabel?: () => string,
 * }} SocialApi
 */

export function setMainPanelSocialApi(api) {
  socialApi = api;
}

function classDef() {
  const id = localStorage.getItem("mv_class_id") || window.__mvClassId || "warrior";
  const mapped = id === "knight" ? "warrior" : id === "unarmed" ? "worge" : id;
  return getClass(mapped) || getClass("warrior");
}

/** Map Multiverse loadout → paperdoll slots */
function paperdollMap() {
  const lo = loadLoadout();
  return {
    Mainhand: lo.weapon || null,
    Offhand: lo.offhand || null,
    Chest: lo.armor || null,
  };
}

function loadoutKeyForPaper(slotName) {
  if (slotName === "Mainhand") return "weapon";
  if (slotName === "Offhand") return "offhand";
  if (slotName === "Chest") return "armor";
  return null;
}

function computeStats() {
  const bag = loadBag();
  const lo = loadLoadout();
  const dmg = lo.weapon?.dmg || 12;
  const def = (lo.armor?.armor || 0) + (lo.offhand?.armor || 0);
  const hp = window.__mvMaxHp ?? 100;
  return {
    health: hp,
    mana: 100,
    stamina: window.__mvMaxStamina ?? 100,
    damage: dmg,
    defense: def,
    speed: 1.0,
    crit: Math.min(25, 5 + (bag.level || 1)),
    block: lo.offhand ? 15 : 0,
    level: bag.level || 1,
    gold: bag.gold || 0,
    xp: bag.xp || 0,
  };
}

export function mountMainPanelShell() {
  const card = document.getElementById("main-panel-card");
  if (!card) return;

  card.innerHTML = `
    <div class="mp-app">
      <header class="mp-top-bar">
        <div class="mp-logo">
          <h1>Grudge Multiverse</h1>
          <a class="mp-ssot-link" href="${MAIN_PANEL_SSOT}" target="_blank" rel="noopener" title="Fleet main panel SSOT">SSOT ↗</a>
        </div>
        <div class="mp-player-info">
          <span class="mp-name" id="mp-player-name">Hero</span>
          <span class="mp-class" id="mp-player-class">Lv.1</span>
          <div class="mp-xp-bar"><div class="mp-xp-fill" id="mp-xp-fill"></div></div>
          <button type="button" id="main-panel-close" aria-label="Close">Close · I</button>
        </div>
      </header>
      <div class="mp-main-body">
        <aside class="mp-left-col" id="mp-left-col"></aside>
        <main class="mp-center-col">
          <nav class="mp-tab-strip" id="main-panel-tabs" role="tablist">
            <button type="button" class="mp-tab-btn on" data-tab="equipment">Equipment</button>
            <button type="button" class="mp-tab-btn" data-tab="skills">Skills</button>
            <button type="button" class="mp-tab-btn" data-tab="crafting">Crafting</button>
            <button type="button" class="mp-tab-btn" data-tab="server">Server</button>
          </nav>
          <div class="mp-content-area" id="mp-body"></div>
        </main>
        <aside class="mp-right-col">
          <div class="mp-inv-header">
            <h3>Inventory</h3>
            <div class="mp-inv-meta">
              <span class="mp-inv-count" id="mp-inv-count">0/${INV_SLOTS}</span>
              <span class="mp-gold-display" id="mp-gold-display">0 Gold</span>
            </div>
          </div>
          <div class="mp-inv-grid" id="mp-inv-grid"></div>
        </aside>
      </div>
      <footer class="mp-hotbar" id="mp-hotbar"></footer>
    </div>
  `;

  if (!document.getElementById("friend-request-toast")) {
    const toast = document.createElement("div");
    toast.id = "friend-request-toast";
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }

  ensureFleetPanelStyles();

  const tabs = document.getElementById("main-panel-tabs");
  tabs?.querySelectorAll("button[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      tabs.querySelectorAll("button").forEach((b) => b.classList.remove("on"));
      btn.classList.add("on");
      activeTab = btn.dataset.tab || "equipment";
      renderMainPanelTab(activeTab);
    });
  });

  document.getElementById("main-panel-close")?.addEventListener("click", () => {
    window.__mvCloseMainPanel?.();
  });
}

export function renderMainPanelTab(tab = "equipment") {
  activeTab = tab;
  const tabs = document.getElementById("main-panel-tabs");
  tabs?.querySelectorAll("button[data-tab]").forEach((b) => {
    b.classList.toggle("on", b.dataset.tab === tab);
  });

  refreshChrome();
  renderLeftCol();
  renderInvGrid();
  renderHotbar();

  const body = document.getElementById("mp-body");
  if (!body) return;

  if (tab === "equipment") {
    body.innerHTML = renderEquipmentPanel();
    wireEquipment(body);
  } else if (tab === "skills") {
    body.innerHTML = renderSkills();
  } else if (tab === "crafting") {
    body.innerHTML = renderCrafting();
    wireCrafting(body);
  } else {
    body.innerHTML = renderServer();
    wireServer(body);
  }
}

function refreshChrome() {
  const bag = loadBag();
  const c = classDef();
  const name = window.__mvPlayerName || "Hero";
  const nameEl = document.getElementById("mp-player-name");
  const classEl = document.getElementById("mp-player-class");
  const xpFill = document.getElementById("mp-xp-fill");
  const gold = document.getElementById("mp-gold-display");
  const invCount = document.getElementById("mp-inv-count");
  if (nameEl) nameEl.textContent = name;
  if (classEl) classEl.textContent = `Lv.${bag.level || 1} ${c?.label || ""}`;
  if (xpFill) xpFill.style.width = `${(bag.xp || 0) % 100}%`;
  if (gold) gold.textContent = `${bag.gold || 0} Gold`;
  if (invCount) invCount.textContent = `${(bag.items || []).length}/${INV_SLOTS}`;
}

function renderLeftCol() {
  const col = document.getElementById("mp-left-col");
  if (!col) return;
  const s = computeStats();
  const lo = loadLoadout();
  const filled = [lo.weapon, lo.offhand, lo.armor].filter(Boolean).length;
  col.innerHTML = `
    <div class="mp-section-title">Combat Stats</div>
    <div class="mp-stat-row"><span class="k">Health</span><span class="v">${s.health}</span></div>
    <div class="mp-stat-row"><span class="k">Mana</span><span class="v">${s.mana}</span></div>
    <div class="mp-stat-row"><span class="k">Stamina</span><span class="v">${s.stamina}</span></div>
    <div class="mp-stat-row"><span class="k">Damage</span><span class="v positive">${s.damage}</span></div>
    <div class="mp-stat-row"><span class="k">Crit %</span><span class="v">${s.crit}%</span></div>
    <div class="mp-stat-row"><span class="k">Defense</span><span class="v">${s.defense}</span></div>
    <div class="mp-stat-row"><span class="k">Block %</span><span class="v">${s.block}%</span></div>
    <div class="mp-stat-row"><span class="k">Speed</span><span class="v">${s.speed.toFixed(1)}</span></div>
    <div class="mp-section-title" style="margin-top:16px">Hero</div>
    <div class="mp-stat-row"><span class="k">Level</span><span class="v">${s.level}</span></div>
    <div class="mp-stat-row"><span class="k">XP</span><span class="v">${s.xp}</span></div>
    <div class="mp-stat-row"><span class="k">Gold</span><span class="v positive">${s.gold}</span></div>
    <div class="mp-section-title" style="margin-top:16px">Equipped</div>
    <div style="font-size:10px;color:var(--mp-dim,#666)">${filled} / 3 mesh slots</div>
    <div class="mp-section-title" style="margin-top:16px">Vendors</div>
    <p class="mp-hint" style="font-size:10px;margin:0">Hub vendors · buy in Crafting or click inventory empty cells after purchase</p>
    ${Object.entries(VENDORS)
      .map(
        ([key, v]) =>
          `<div class="mp-vendor-mini">
            <div class="mp-vendor-name">${escape(v.name)}</div>
            ${v.stock
              .slice(0, 3)
              .map(
                (it) =>
                  `<button type="button" class="mp-buy" data-v="${key}" data-item="${escape(it.id)}">${escape(it.name)} · ${it.price}g</button>`,
              )
              .join("")}
          </div>`,
      )
      .join("")}
  `;
  col.querySelectorAll(".mp-buy").forEach((btn) => {
    btn.addEventListener("click", () => {
      const res = buy(btn.getAttribute("data-v"), btn.getAttribute("data-item"));
      if (res.ok) {
        window.dispatchEvent(new CustomEvent("mv-bag"));
        renderMainPanelTab(activeTab);
      } else {
        alert(res.error === "gold" ? "Not enough gold" : "Buy failed");
      }
    });
  });
}

function renderInvGrid() {
  const grid = document.getElementById("mp-inv-grid");
  if (!grid) return;
  const bag = loadBag();
  const items = bag.items || [];
  let html = "";
  for (let i = 0; i < INV_SLOTS; i++) {
    const it = items[i];
    if (it) {
      const tier = typeof it.tier === "number" ? it.tier : 0;
      const tc = TIER_COLORS[tier] || TIER_COLORS[0];
      const url = itemIconUrl(it.id || it.name);
      const canEquip = ["weapon", "armor", "shield"].includes(it.slot);
      html += `<div class="mp-inv-cell has-item ${canEquip ? "can-equip" : ""}" data-item-id="${escape(it.id)}" data-slot="${escape(it.slot || "")}" style="border-color:${tc}" title="${escape(it.name)}${canEquip ? " · click to equip" : ""}">
        <img src="${escape(url)}" alt="" onerror="this.style.display='none'" />
        <span class="mp-inv-tier" style="background:${tc}">T${tier}</span>
        ${it.qty > 1 ? `<span class="mp-inv-stack">${it.qty}</span>` : ""}
      </div>`;
    } else {
      html += `<div class="mp-inv-cell"></div>`;
    }
  }
  grid.innerHTML = html;
  grid.querySelectorAll(".mp-inv-cell.can-equip").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-item-id");
      const res = equipItem(id);
      if (res.ok) {
        window.dispatchEvent(new CustomEvent("mv-loadout", { detail: res.loadout }));
        renderMainPanelTab("equipment");
      }
    });
  });
}

function renderHotbar() {
  const bar = document.getElementById("mp-hotbar");
  if (!bar) return;
  const c = classDef();
  const bag = loadBag();
  const skills = unlockedSkills(c, bag.level || 1);
  const cells = [];
  for (let i = 0; i < 6; i++) {
    const s = skills[i];
    if (!s) {
      cells.push(`<div class="mp-hb-slot"><span class="key">${i === 0 ? "F" : i}</span></div>`);
      continue;
    }
    const key = s.key === "KeyF" ? "F" : String(s.key || "").replace("Digit", "");
    const ic = skillIconUrl(s, c.id);
    cells.push(`<div class="mp-hb-slot skill" title="${escape(s.name)}">
      <span class="key">${key}</span>
      ${ic ? `<img src="${escape(ic)}" alt="" onerror="this.style.display='none'" />` : `<span class="hb-letter">${escape((s.name || "?").slice(0, 2))}</span>`}
    </div>`);
  }
  cells.push(`<div class="mp-hb-divider"></div>`);
  const lo = loadLoadout();
  for (const [label, item] of [
    ["1", lo.weapon],
    ["2", lo.offhand],
    ["3", lo.armor],
  ]) {
    if (item) {
      const url = itemIconUrl(item.id || item.name);
      cells.push(`<div class="mp-hb-slot consumable" title="${escape(item.name)}">
        <span class="key">${label}</span>
        <img src="${escape(url)}" alt="" onerror="this.style.display='none'" />
      </div>`);
    } else {
      cells.push(`<div class="mp-hb-slot"><span class="key">${label}</span></div>`);
    }
  }
  bar.innerHTML = cells.join("");
}

function renderEquipmentPanel() {
  const s = computeStats();
  const c = classDef();
  const raceId = window.__mvRaceId || "western-kingdoms";
  const portrait = racePortraitUrl(raceId);
  const doll = paperdollMap();
  const classLabel = window.__mvClassLabel || c.label;

  return `
    <div class="mp-section-title" style="text-align:center;border-left:0;padding-left:0">Grudge Warlord</div>
    <div class="mp-eq-subtitle">${escape(classLabel)} · paperdoll</div>
    <div class="mp-eq-panel">
      <div class="mp-eq-col">
        ${LEFT_SLOTS.map((slot) => renderPaperSlot(slot, doll)).join("")}
      </div>
      <div class="mp-eq-center">
        <div class="mp-silhouette">
          <img src="${escape(portrait)}" alt="" onerror="this.parentElement.innerHTML='⚔️'" />
        </div>
        <div class="mp-eq-race">${escape(raceId)}</div>
      </div>
      <div class="mp-eq-col">
        ${RIGHT_SLOTS.map((slot) => renderPaperSlot(slot, doll)).join("")}
      </div>
    </div>
    <div class="mp-eq-summary">
      <div class="mp-eq-sum"><div class="val">${s.damage}</div><div class="lbl">Damage</div></div>
      <div class="mp-eq-sum"><div class="val">${s.defense}</div><div class="lbl">Defense</div></div>
      <div class="mp-eq-sum"><div class="val">${s.health}</div><div class="lbl">Health</div></div>
      <div class="mp-eq-sum"><div class="val">${s.crit}%</div><div class="lbl">Crit</div></div>
      <div class="mp-eq-sum"><div class="val">${s.block}%</div><div class="lbl">Block</div></div>
      <div class="mp-eq-sum"><div class="val">${s.speed.toFixed(1)}</div><div class="lbl">Speed</div></div>
    </div>
    <div class="mp-section-title" style="margin-top:14px;font-size:11px">Equipped meshes</div>
    ${renderMeshStrip(doll)}
    <p class="mp-hint" style="text-align:center;margin-top:10px">
      Unity-style paperdoll · bag on the right · click slot to unequip · click bag gear to equip ·
      <a href="https://info.grudge-studio.com/GRUDGE_Item_Database.html" target="_blank" rel="noopener">Item DB ↗</a>
    </p>
  `;
}

function renderPaperSlot(slotName, doll) {
  const item = doll[slotName] || null;
  const isEq = !!item;
  const tier = item?.tier ?? 0;
  const tc = TIER_COLORS[tier] || "#3a2a1a";
  const loKey = loadoutKeyForPaper(slotName);
  const icon = item
    ? `<img class="slot-icon" src="${escape(itemIconUrl(item.id || item.name))}" alt="" onerror="this.style.display='none'" />`
    : `<span class="slot-placeholder">${SLOT_ICONS[slotName] || "◻"}</span>`;
  const tierBadge = item
    ? `<span class="slot-tier" style="background:${tc};color:#000">T${tier}</span>`
    : "";
  const uneq = isEq && loKey ? `data-unequip="${loKey}"` : "";
  return `<div class="mp-eq-slot ${isEq ? "equipped" : ""} ${loKey ? "interactive" : "locked-slot"}"
      data-slot="${escape(slotName)}" ${uneq}
      style="${isEq ? `border-color:${tc}` : ""}"
      title="${isEq ? escape(item.name) + (loKey ? " · click unequip" : "") : slotName + (loKey ? " (empty)" : " (not used yet)")}">
    ${tierBadge}
    ${icon}
    <span class="slot-label">${escape(slotName)}</span>
  </div>`;
}

function renderMeshStrip(doll) {
  const chips = [];
  for (const [slot, item] of Object.entries(doll)) {
    if (!item) continue;
    chips.push(`<div class="mp-mesh-chip">
      <img src="${escape(itemIconUrl(item.id || item.name))}" alt="" onerror="this.style.display='none'" />
      <div>
        <div class="chip-slot">${escape(slot)}</div>
        <div class="chip-name">${escape(item.name)}</div>
      </div>
    </div>`);
  }
  if (!chips.length) {
    return `<div class="mp-mesh-strip"><div class="mp-mesh-empty">No mesh gear equipped — equip from inventory (right)</div></div>`;
  }
  return `<div class="mp-mesh-strip">${chips.join("")}</div>`;
}

function wireEquipment(root) {
  root.querySelectorAll("[data-unequip]").forEach((el) => {
    el.addEventListener("click", () => {
      const key = el.getAttribute("data-unequip");
      if (!key) return;
      unequipSlot(key);
      renderMainPanelTab("equipment");
    });
  });
}

function renderSkills() {
  const c = classDef();
  const bag = loadBag();
  const level = bag.level || 1;
  return `
    <div class="mp-section-title">${escape(c.label)} skills · L${level}</div>
    <p class="mp-hint">F = basic · 1–5 = weapon skills · hotbar under panel + DRC tight HUD in play</p>
    <div class="mp-wst-action-bar">
      ${(c.skills || [])
        .map((s) => {
          const locked = level < (s.level || 1);
          const key = s.key === "KeyF" ? "F" : String(s.key || "").replace("Digit", "");
          const ic = skillIconUrl(s, c.id);
          return `<div class="mp-action-slot-wrap ${locked ? "locked" : ""}">
            <div class="slot-label-above">${escape(s.name)}</div>
            <div class="mp-action-slot">
              ${ic ? `<img src="${escape(ic)}" alt="" onerror="this.style.display='none'" />` : `<span class="slot-empty">?</span>`}
            </div>
            <div class="slot-key">${key}</div>
            <div class="slot-skill-meta">${s.kind} · CD ${s.cd}s${locked ? ` · L${s.level}` : ""}</div>
          </div>`;
        })
        .join("")}
    </div>
  `;
}

function renderCrafting() {
  const bag = loadBag();
  return `
    <div class="mp-section-title">Quick craft (local bag)</div>
    <p class="mp-hint">Mats from harvest (E). Costs use bag ids (t0_wood, t0_stone, …).</p>
    <div class="mp-craft-list">
      ${QUICK_RECIPES.map((r) => {
        const lines = Object.entries(r.costs).map(([mat, n]) => {
          const have = countMat(bag, mat);
          const ok = have >= n;
          return `<span class="${ok ? "ok" : "bad"}">${mat} ${have}/${n}</span>`;
        });
        const ready = Object.entries(r.costs).every(([mat, n]) => countMat(bag, mat) >= n);
        return `<button type="button" class="mp-craft-btn ${ready ? "ready" : "disabled"}" data-craft="${r.id}" ${ready ? "" : "disabled"}>
          <strong>${escape(r.name)}</strong>
          <span class="mp-craft-costs">${lines.join(" · ")}</span>
          <span class="mp-craft-out">→ ${escape(r.result.name)}</span>
        </button>`;
      }).join("")}
    </div>
    <div class="mp-section-title" style="margin-top:16px">Full crafting suite</div>
    <div class="mp-craft-embed-wrap">
      <div class="mp-craft-embed-bar">
        <span>Puter suite (fleet SSOT)</span>
        <a href="${CRAFTING_SUITE_URL}" target="_blank" rel="noopener">Open ↗</a>
      </div>
      <iframe class="mp-craft-iframe" src="${CRAFTING_SUITE_URL}" title="Grudge Crafting" loading="lazy"></iframe>
    </div>
  `;
}

function wireCrafting(root) {
  root.querySelectorAll("[data-craft]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const res = craft(btn.getAttribute("data-craft"));
      if (res.ok) {
        window.dispatchEvent(new CustomEvent("mv-bag"));
        renderMainPanelTab("crafting");
      } else {
        alert(res.error || "Need more materials");
      }
    });
  });
}

function renderServer() {
  if (!socialApi) {
    return `<div class="mp-section-title">Server</div><p class="mp-hint">Roster loading…</p>`;
  }
  const local = socialApi.getLocal();
  const remotes = socialApi.getRemotes();
  const room = socialApi.roomLabel?.() || "room";

  const row = (r, isLocal) => {
    if (isLocal) {
      return `<div class="pl-row is-local">
        <div>
          <div class="pl-name">${escape(r.name)} <span class="tag">you</span></div>
          <div class="pl-meta">K ${r.kills} · D ${r.deaths} · HP ${r.hp}</div>
        </div>
        <div class="pl-rel"><span class="mp-badge self">Self</span></div>
      </div>`;
    }
    const rel = socialApi.getRelation(r.id);
    let actions = "";
    if (rel === "friend") {
      actions = `<span class="mp-badge friend">Friends</span>
        <button type="button" class="mp-btn unfriend" data-act="unfriend" data-pid="${escape(r.id)}">Unfriend</button>`;
    } else if (rel === "pending_out") {
      actions = `<span class="mp-badge pending">Request sent…</span>
        <button type="button" class="mp-btn enemy" data-act="enemy" data-pid="${escape(r.id)}">Hostile</button>`;
    } else if (rel === "pending_in") {
      actions = `<span class="mp-badge pending">Wants to be friends</span>
        <button type="button" class="mp-btn friend" data-act="accept" data-pid="${escape(r.id)}">Accept</button>
        <button type="button" class="mp-btn enemy" data-act="decline" data-pid="${escape(r.id)}">Decline</button>`;
    } else if (rel === "enemy") {
      actions = `<span class="mp-badge enemy">Hostile</span>
        <button type="button" class="mp-btn friend" data-act="friend" data-pid="${escape(r.id)}">Request friend</button>`;
    } else {
      actions = `<button type="button" class="mp-btn friend" data-act="friend" data-pid="${escape(r.id)}">Request friend</button>
        <button type="button" class="mp-btn enemy" data-act="enemy" data-pid="${escape(r.id)}">Hostile</button>`;
    }
    return `<div class="pl-row" data-pid="${escape(r.id)}">
      <div>
        <div class="pl-name">${escape(r.name)}</div>
        <div class="pl-meta">K ${r.kills} · D ${r.deaths}</div>
      </div>
      <div class="pl-rel">${actions}</div>
    </div>`;
  };

  return `
    <div class="mp-section-title">Server · ${escape(room)}</div>
    <p class="mp-hint">Request friend → Accept / Decline. Decline = hostile. Friends deal no damage. (Fleet Quests tab → Server here)</p>
    <div id="players-list" class="mp-players">
      ${row(local, true)}
      ${remotes.map((r) => row(r, false)).join("") || `<div class="mp-hint" style="padding:12px">No other players in room</div>`}
    </div>
  `;
}

function wireServer(root) {
  if (!socialApi) return;
  root.querySelectorAll("[data-act]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const id = btn.getAttribute("data-pid");
      const act = btn.getAttribute("data-act");
      if (!id) return;
      if (act === "friend") socialApi.requestFriend(id);
      else if (act === "enemy") socialApi.declareEnemy(id);
      else if (act === "unfriend") socialApi.unfriend(id);
      else if (act === "accept") socialApi.acceptFriend?.(id);
      else if (act === "decline") socialApi.declineFriend?.(id);
      renderMainPanelTab("server");
    });
  });
}

export function showFriendRequestUI(fromId, fromName, onYes, onNo) {
  const host = document.getElementById("friend-request-toast");
  if (!host) return;
  const el = document.createElement("div");
  el.className = "fr-card";
  el.innerHTML = `
    <div class="fr-title">Friend request</div>
    <div class="fr-body">Accept friend <strong>${escape(fromName || fromId)}</strong>?</div>
    <div class="fr-actions">
      <button type="button" class="fr-yes">Yes — Friend</button>
      <button type="button" class="fr-no">No — Enemy</button>
    </div>`;
  host.appendChild(el);
  const done = () => el.remove();
  el.querySelector(".fr-yes")?.addEventListener("click", () => {
    onYes?.();
    done();
  });
  el.querySelector(".fr-no")?.addEventListener("click", () => {
    onNo?.();
    done();
  });
}

/** @deprecated kept for callers that re-wire buy buttons on inventory-only body */
export function wireInventoryBuys(root) {
  root?.querySelectorAll(".mp-buy").forEach((btn) => {
    btn.addEventListener("click", () => {
      const res = buy(btn.getAttribute("data-v"), btn.getAttribute("data-item"));
      if (res.ok) {
        window.dispatchEvent(new CustomEvent("mv-bag"));
        renderMainPanelTab(activeTab);
      } else alert(res.error === "gold" ? "Not enough gold" : "Buy failed");
    });
  });
}

export function refreshOpenTab() {
  const on = document.querySelector("#main-panel-tabs button.on");
  renderMainPanelTab(on?.dataset?.tab || activeTab || "equipment");
}

function escape(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Inject fleet main-panel chrome (info.grudge-studio.com layout tokens). */
function ensureFleetPanelStyles() {
  if (document.getElementById("mv-fleet-main-panel-css")) return;
  const s = document.createElement("style");
  s.id = "mv-fleet-main-panel-css";
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=JetBrains+Mono:wght@400;700&display=swap');
    #main-panel {
      position: fixed; inset: 0; z-index: 99996;
      display: none; align-items: stretch; justify-content: stretch;
      background: rgba(0,0,0,0.72); backdrop-filter: blur(6px);
      --mp-gold: #d4af37; --mp-gold-dim: rgba(212,175,55,0.2);
      --mp-muted: #9a8f7a; --mp-dim: #6a6050; --mp-text: #e8e0d0;
      --mp-green: #44ff44; --mp-panel: #1a120c; --mp-border: #3a2a1a;
    }
    #main-panel.open { display: flex; }
    #main-panel-card {
      width: 100%; height: 100%; max-width: none; max-height: none;
      border-radius: 0; border: none; background: transparent;
      box-shadow: none; display: flex; flex-direction: column; overflow: hidden;
      font-family: 'Cinzel', system-ui, sans-serif; color: var(--mp-text);
    }
    .mp-app {
      display: flex; flex-direction: column; height: 100%; width: 100%;
      background:
        radial-gradient(ellipse at top, hsl(225 30% 12%) 0%, transparent 50%),
        linear-gradient(180deg, #0c0e14 0%, #121018 50%, #0a0c10 100%);
    }
    .mp-top-bar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 16px; flex-shrink: 0;
      background: linear-gradient(90deg,#1a100a,#221710,#1a100a);
      border-bottom: 2px solid var(--mp-gold);
    }
    .mp-logo { display: flex; align-items: center; gap: 12px; }
    .mp-logo h1 {
      margin: 0; font-size: 15px; color: var(--mp-gold);
      letter-spacing: 2px; text-transform: uppercase;
    }
    .mp-ssot-link { font-size: 10px; color: var(--mp-muted); text-decoration: none; }
    .mp-ssot-link:hover { color: var(--mp-gold); }
    .mp-player-info { display: flex; align-items: center; gap: 14px; font-size: 12px; }
    .mp-name { color: var(--mp-gold); font-weight: 700; }
    .mp-class { color: var(--mp-muted); font-size: 11px; }
    .mp-xp-bar {
      width: 120px; height: 6px; background: #2a1e14; border-radius: 3px;
      overflow: hidden; border: 1px solid #3a2a1a;
    }
    .mp-xp-fill {
      height: 100%; width: 0%; background: linear-gradient(90deg, #a67c1a, var(--mp-gold));
      border-radius: 3px; transition: width 0.3s;
    }
    #main-panel-close {
      border: 1px solid rgba(212,175,55,0.4); background: transparent;
      color: var(--mp-muted); border-radius: 4px; padding: 6px 12px;
      cursor: pointer; font: 700 10px Cinzel, system-ui; text-transform: uppercase; letter-spacing: 1px;
    }
    #main-panel-close:hover { color: var(--mp-gold); border-color: var(--mp-gold); }
    .mp-main-body { display: flex; flex: 1; min-height: 0; }
    .mp-left-col {
      width: 240px; flex-shrink: 0; background: #1a120c;
      border-right: 2px solid #3a2a1a; overflow-y: auto; padding: 12px;
    }
    .mp-center-col { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .mp-right-col {
      width: 280px; flex-shrink: 0; background: #1a120c;
      border-left: 2px solid #3a2a1a; display: flex; flex-direction: column;
    }
    .mp-tab-strip {
      display: flex; background: #14100a; border-bottom: 2px solid var(--mp-gold);
      flex-shrink: 0; overflow-x: auto;
    }
    .mp-tab-btn {
      border: 0; background: transparent; color: var(--mp-muted); cursor: pointer;
      padding: 10px 14px; font-family: Cinzel, system-ui; font-size: 10px;
      text-transform: uppercase; letter-spacing: 1px; font-weight: 700;
      border-bottom: 2px solid transparent; white-space: nowrap;
    }
    .mp-tab-btn:hover { color: var(--mp-text); background: rgba(255,215,0,0.05); }
    .mp-tab-btn.on {
      color: var(--mp-gold); border-bottom-color: var(--mp-gold);
      background: rgba(255,215,0,0.08);
    }
    .mp-content-area { flex: 1; overflow-y: auto; padding: 16px; }
    .mp-section-title {
      font-family: Cinzel, system-ui; font-size: 12px; color: var(--mp-gold);
      text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px;
      padding-left: 12px; border-left: 3px solid var(--mp-gold);
    }
    .mp-stat-row {
      display: flex; justify-content: space-between; padding: 4px 0;
      font-size: 12px; border-bottom: 1px solid rgba(255,255,255,0.03);
    }
    .mp-stat-row .k { color: var(--mp-muted); font-weight: 600; font-family: system-ui; }
    .mp-stat-row .v { font-family: 'JetBrains Mono', monospace; font-size: 11px; }
    .mp-stat-row .v.positive { color: var(--mp-green); }
    .mp-hint { font-size: 11px; color: var(--mp-muted); line-height: 1.45; font-family: system-ui; }
    .mp-hint a { color: var(--mp-gold); }
    .mp-inv-header {
      padding: 10px 12px; border-bottom: 1px solid #3a2a1a;
      display: flex; justify-content: space-between; align-items: center;
    }
    .mp-inv-header h3 {
      margin: 0; font-size: 12px; color: var(--mp-gold); text-transform: uppercase;
    }
    .mp-inv-meta { display: flex; align-items: center; gap: 10px; }
    .mp-inv-count { font-size: 10px; color: var(--mp-dim); font-family: system-ui; }
    .mp-gold-display {
      font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--mp-gold);
    }
    .mp-inv-grid {
      display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px;
      padding: 8px; flex: 1; overflow-y: auto; align-content: start;
    }
    .mp-inv-cell {
      aspect-ratio: 1; border: 2px solid #3a2a1a; border-radius: 6px;
      background: #221710; display: flex; align-items: center; justify-content: center;
      position: relative; font-size: 9px; color: var(--mp-dim);
    }
    .mp-inv-cell.has-item { cursor: pointer; }
    .mp-inv-cell.has-item:hover { border-color: var(--mp-gold) !important; box-shadow: 0 0 8px rgba(212,175,55,0.2); }
    .mp-inv-cell img { width: 100%; height: 100%; object-fit: contain; padding: 4px; image-rendering: pixelated; }
    .mp-inv-tier {
      position: absolute; top: 1px; right: 2px; font-size: 6px; font-weight: 700;
      padding: 0 3px; border-radius: 2px; color: #000; font-family: system-ui;
    }
    .mp-inv-stack {
      position: absolute; bottom: 1px; right: 2px; font-size: 7px; font-weight: 700;
      color: #fff; text-shadow: 0 1px 2px #000; font-family: system-ui;
    }
    .mp-eq-panel { display: flex; align-items: stretch; gap: 0; width: 100%; min-height: 420px; }
    .mp-eq-col {
      display: flex; flex-direction: column; gap: 6px; justify-content: center;
      padding: 8px 6px; width: 86px; flex-shrink: 0;
    }
    .mp-eq-center {
      flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: radial-gradient(ellipse at center, rgba(212,175,55,0.04) 0%, transparent 70%);
      border-left: 1px solid rgba(212,175,55,0.1); border-right: 1px solid rgba(212,175,55,0.1);
      min-width: 140px;
    }
    .mp-silhouette {
      width: 130px; height: 200px; border-radius: 8px; overflow: hidden;
      border: 2px solid rgba(212,175,55,0.25);
      background: linear-gradient(180deg, rgba(30,20,12,0.9), rgba(20,14,8,0.7));
      display: flex; align-items: center; justify-content: center; font-size: 48px;
    }
    .mp-silhouette img { width: 100%; height: 100%; object-fit: cover; }
    .mp-eq-race {
      margin-top: 8px; font-size: 10px; color: var(--mp-muted);
      text-transform: uppercase; letter-spacing: 1px;
    }
    .mp-eq-subtitle {
      text-align: center; font-size: 11px; color: var(--mp-muted);
      letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px;
    }
    .mp-eq-slot {
      width: 68px; height: 68px; border: 2px solid rgba(212,175,55,0.25); border-radius: 8px;
      background: linear-gradient(180deg, #2e1f14 0%, #221710 100%);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      font-size: 8px; color: var(--mp-muted); text-transform: uppercase; position: relative;
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.4); transition: all 0.15s;
    }
    .mp-eq-slot.interactive { cursor: pointer; }
    .mp-eq-slot.interactive:hover {
      border-color: var(--mp-gold); transform: scale(1.05);
      box-shadow: 0 0 12px rgba(212,175,55,0.3), inset 0 2px 4px rgba(0,0,0,0.4);
    }
    .mp-eq-slot.equipped { border-color: var(--mp-gold); background: linear-gradient(180deg,#3a2a1a,#2e1f14); }
    .mp-eq-slot.locked-slot { opacity: 0.55; }
    .mp-eq-slot .slot-icon {
      width: 40px; height: 40px; object-fit: contain; image-rendering: pixelated;
      filter: drop-shadow(0 0 4px rgba(212,175,55,0.3));
    }
    .mp-eq-slot .slot-label { font-size: 7px; margin-top: 1px; letter-spacing: 0.5px; color: var(--mp-dim); }
    .mp-eq-slot .slot-tier {
      position: absolute; top: 2px; right: 3px; font-size: 7px; font-weight: 700;
      padding: 1px 4px; border-radius: 3px; font-family: system-ui;
    }
    .mp-eq-slot .slot-placeholder { font-size: 18px; opacity: 0.2; margin-bottom: 2px; }
    .mp-eq-summary {
      display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 14px;
      padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px;
      border: 1px solid rgba(212,175,55,0.08);
    }
    .mp-eq-sum { text-align: center; min-width: 50px; }
    .mp-eq-sum .val {
      font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 700; color: var(--mp-green);
    }
    .mp-eq-sum .lbl {
      font-size: 8px; color: var(--mp-dim); text-transform: uppercase; letter-spacing: 0.5px;
    }
    .mp-mesh-strip {
      display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 8px;
      padding: 10px; background: rgba(0,0,0,0.25); border: 1px solid rgba(212,175,55,0.12); border-radius: 8px;
    }
    .mp-mesh-chip {
      display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 6px;
      border: 1px solid #3a2a1a; background: #221710; font-size: 10px; max-width: 160px;
      font-family: system-ui;
    }
    .mp-mesh-chip img { width: 28px; height: 28px; object-fit: contain; }
    .mp-mesh-chip .chip-slot { font-size: 7px; color: var(--mp-dim); text-transform: uppercase; }
    .mp-mesh-chip .chip-name { color: var(--mp-text); font-weight: 600; }
    .mp-mesh-empty { font-size: 10px; color: var(--mp-dim); padding: 8px; font-family: system-ui; }
    .mp-hotbar {
      display: flex; gap: 4px; justify-content: center; padding: 6px; flex-shrink: 0;
      background: #120c06; border-top: 2px solid var(--mp-gold); align-items: center;
    }
    .mp-hb-slot {
      width: 44px; height: 44px; border: 2px solid #3a2a1a; border-radius: 6px;
      background: #2a1e14; display: flex; align-items: center; justify-content: center;
      position: relative; font-size: 9px; color: var(--mp-dim);
    }
    .mp-hb-slot.skill { border-color: #4a3520; }
    .mp-hb-slot.consumable { border-color: #2a3520; }
    .mp-hb-slot img { width: 100%; height: 100%; object-fit: contain; padding: 3px; }
    .mp-hb-slot .key {
      position: absolute; top: 2px; left: 4px; font-size: 8px; color: var(--mp-muted);
      font-family: system-ui; font-weight: 700;
    }
    .mp-hb-slot .hb-letter { font-size: 10px; font-weight: 700; color: var(--mp-gold); font-family: system-ui; }
    .mp-hb-divider { width: 2px; height: 30px; background: #3a2a1a; margin: 0 4px; border-radius: 1px; }
    .mp-wst-action-bar {
      display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin: 12px 0;
    }
    .mp-action-slot-wrap {
      display: flex; flex-direction: column; align-items: center; gap: 4px; width: 96px;
    }
    .mp-action-slot-wrap.locked { opacity: 0.4; }
    .mp-action-slot-wrap .slot-label-above {
      font-size: 8px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
      color: var(--mp-gold); text-align: center; min-height: 2.4em;
      display: flex; align-items: flex-end; justify-content: center;
    }
    .mp-action-slot {
      width: 52px; height: 52px; border-radius: 8px; border: 2px solid #3a2a1a;
      background: #221710; display: flex; align-items: center; justify-content: center;
    }
    .mp-action-slot img { width: 36px; height: 36px; object-fit: contain; }
    .mp-action-slot-wrap .slot-key {
      font-size: 9px; font-weight: 700; color: var(--mp-gold); font-family: monospace;
      width: 18px; height: 18px; border-radius: 50%; border: 1px solid rgba(212,175,55,0.35);
      display: flex; align-items: center; justify-content: center; background: #1a100a;
    }
    .mp-action-slot-wrap .slot-skill-meta {
      font-size: 8px; color: var(--mp-muted); text-align: center; font-family: system-ui;
    }
    .mp-craft-list { display: flex; flex-direction: column; gap: 6px; }
    .mp-craft-btn {
      display: block; width: 100%; text-align: left; cursor: pointer;
      padding: 10px 12px; border-radius: 8px; font-family: system-ui;
      border: 1px solid rgba(212,175,55,0.3); background: rgba(0,0,0,0.35); color: #ddd;
    }
    .mp-craft-btn.ready { border-color: rgba(95,212,138,0.5); }
    .mp-craft-btn.disabled { opacity: 0.45; cursor: not-allowed; }
    .mp-craft-costs { display: block; font-size: 10px; color: #888; margin-top: 4px; }
    .mp-craft-costs .ok { color: #6eec9a; }
    .mp-craft-costs .bad { color: #ff8a8a; }
    .mp-craft-out { display: block; font-size: 11px; color: var(--mp-gold); margin-top: 2px; }
    .mp-craft-embed-wrap { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
    .mp-craft-embed-bar {
      display: flex; justify-content: space-between; font-size: 11px; color: var(--mp-muted); font-family: system-ui;
    }
    .mp-craft-embed-bar a { color: var(--mp-gold); }
    .mp-craft-iframe {
      width: 100%; min-height: 420px; height: 48vh; border: 2px solid #3a2a1a;
      border-radius: 8px; background: #0a0a10;
    }
    .mp-vendor-mini { margin-bottom: 10px; }
    .mp-vendor-name { font-weight: 700; color: #8ec0ff; margin-bottom: 4px; font-size: 11px; font-family: system-ui; }
    .mp-buy {
      display: block; width: 100%; text-align: left; margin: 3px 0;
      padding: 5px 8px; border-radius: 6px; border: 1px solid #3a2a1a;
      background: #221710; color: #ccc; cursor: pointer; font-size: 11px; font-family: system-ui;
    }
    .mp-buy:hover { border-color: var(--mp-gold); }
    .mp-players { font-family: system-ui; }
    .mp-badge {
      display: inline-block; padding: 3px 8px; border-radius: 999px;
      font-size: 10px; font-weight: 700;
    }
    .mp-badge.friend { color: #6eec9a; border: 1px solid rgba(80,200,120,0.5); background: rgba(80,200,120,0.12); }
    .mp-badge.enemy { color: #ff8a8a; border: 1px solid rgba(230,80,80,0.5); background: rgba(230,80,80,0.12); }
    .mp-badge.pending { color: #f4c542; border: 1px solid rgba(244,197,66,0.4); background: rgba(244,197,66,0.1); }
    .mp-badge.self { color: #888; border: 1px solid #333; }
    .mp-btn {
      border-radius: 999px; padding: 4px 10px; font-size: 11px; font-weight: 600;
      cursor: pointer; border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.04); color: #aaa; margin-left: 4px; font-family: system-ui;
    }
    .mp-btn.friend { border-color: rgba(80,200,120,0.5); color: #6eec9a; }
    .mp-btn.enemy { border-color: rgba(230,80,80,0.5); color: #ff8a8a; }
    .mp-btn.unfriend { border-color: rgba(200,168,75,0.4); color: #c8a84b; }
    .pl-row {
      display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center;
      padding: 10px 4px; border-bottom: 1px solid rgba(255,255,255,0.04);
    }
    .pl-row.is-local { background: rgba(100,180,255,0.06); border-radius: 6px; padding: 10px 8px; }
    .pl-name { font-size: 13px; font-weight: 600; }
    .pl-name .tag { font-size: 10px; color: #666; font-weight: 500; margin-left: 6px; }
    .pl-meta { font-size: 11px; color: #777; }
    .pl-rel { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }
    #friend-request-toast {
      position: fixed; top: 72px; right: 16px; z-index: 100010;
      display: flex; flex-direction: column; gap: 8px; pointer-events: none;
    }
    #friend-request-toast .fr-card {
      pointer-events: auto; min-width: 260px; max-width: 320px;
      background: rgba(12,14,22,0.96); border: 1px solid rgba(200,168,75,0.45);
      border-radius: 10px; padding: 14px 16px; box-shadow: 0 12px 32px rgba(0,0,0,0.5);
      font-family: system-ui; color: #e8e4d8;
    }
    .fr-title { font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #c8a84b; }
    .fr-body { font-size: 13px; margin: 8px 0 12px; line-height: 1.4; }
    .fr-actions { display: flex; gap: 8px; }
    .fr-yes, .fr-no {
      flex: 1; padding: 8px; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 12px;
    }
    .fr-yes { border: 1px solid rgba(80,200,120,0.5); background: rgba(80,200,120,0.15); color: #6eec9a; }
    .fr-no { border: 1px solid rgba(230,80,80,0.5); background: rgba(230,80,80,0.12); color: #ff8a8a; }
    @media (max-width: 900px) {
      .mp-left-col { display: none; }
      .mp-right-col { width: 200px; }
      .mp-inv-grid { grid-template-columns: repeat(4, 1fr); }
    }
    @media (max-width: 640px) {
      .mp-right-col { display: none; }
      .mp-eq-col { width: 64px; }
      .mp-eq-slot { width: 56px; height: 56px; }
    }
  `;
  document.head.appendChild(s);
}
