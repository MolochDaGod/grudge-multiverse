/**
 * Multiverse Main Panel — fleet shape from info.grudge-studio.com/main-panel.html
 * Tabs: Equipment · Inventory · Skills · Crafting · Server
 * (Quests → Server: roster + friend/enemy social)
 *
 * Crafting: local recipes with correct mat counts + optional Puter suite embed.
 */
import { getClass } from "./classes.js";
import { loadBag, saveBag, countMat } from "./inventory.js";
import { QUICK_RECIPES, craft, canCraft } from "./crafting.js";
import { VENDORS, buy } from "./vendors.js";
import { ensureItemCatalog, iconHtml, skillIconUrl } from "./itemIcons.js";

// Prefetch ObjectStore icons (info.grudge-studio.com catalog)
ensureItemCatalog().catch(() => {});

export const CRAFTING_SUITE_URL = "https://grudge-crafting.puter.site/";

/** @typedef {'friend'|'enemy'|null} Relation */

/**
 * Social / server-tab API injected from multiplayer-gltf.
 * @typedef {{
 *   getLocal: () => { id: string, name: string, kills: number, deaths: number, hp: number },
 *   getRemotes: () => { id: string, name: string, kills: number, deaths: number, hp: number|string }[],
 *   getRelation: (id: string) => 'friend'|'enemy'|'self'|'pending_out'|'pending_in'|string,
 *   requestFriend: (id: string) => void,
 *   declareEnemy: (id: string) => void,
 *   unfriend: (id: string) => void,
 *   roomLabel?: () => string,
 * }} SocialApi
 */

/** @type {SocialApi | null} */
let socialApi = null;

export function setMainPanelSocialApi(api) {
  socialApi = api;
}

export function mountMainPanelShell() {
  const card = document.getElementById("main-panel-card");
  if (!card) return;

  card.innerHTML = `
    <div class="mp-head">
      <div>
        <h2>Main Panel</h2>
        <div class="mp-sub">Grudge Multiverse · fleet layout · <kbd>I</kbd> close</div>
      </div>
      <button type="button" id="main-panel-close" aria-label="Close">Close</button>
    </div>
    <div id="main-panel-tabs" class="mp-tab-strip" role="tablist">
      <button type="button" class="on" data-tab="equipment">Equipment</button>
      <button type="button" data-tab="inventory">Inventory</button>
      <button type="button" data-tab="skills">Skills</button>
      <button type="button" data-tab="crafting">Crafting</button>
      <button type="button" data-tab="server">Server</button>
    </div>
    <div id="mp-body" class="mp-body"></div>
    <div id="main-panel-foot">
      <span style="color:#6eec9a">Friend</span> = no damage ·
      <span style="color:#ff8a8a">Enemy</span> = PvP ·
      Friend request needs accept · Decline = hostile
    </div>
  `;

  // Friend request toast host
  if (!document.getElementById("friend-request-toast")) {
    const toast = document.createElement("div");
    toast.id = "friend-request-toast";
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }

  const tabs = document.getElementById("main-panel-tabs");
  tabs?.querySelectorAll("button[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      tabs.querySelectorAll("button").forEach((b) => b.classList.remove("on"));
      btn.classList.add("on");
      renderMainPanelTab(btn.dataset.tab || "server");
    });
  });

  document.getElementById("main-panel-close")?.addEventListener("click", () => {
    window.__mvCloseMainPanel?.();
  });
}

export function renderMainPanelTab(tab = "server") {
  const body = document.getElementById("mp-body");
  if (!body) return;
  if (tab === "equipment") body.innerHTML = renderEquipment();
  else if (tab === "inventory") {
    body.innerHTML = renderInventory();
    wireInventoryBuys(body);
  } else if (tab === "skills") body.innerHTML = renderSkills();
  else if (tab === "crafting") {
    body.innerHTML = renderCrafting();
    wireCrafting(body);
  } else {
    body.innerHTML = renderServer();
    wireServer(body);
  }
}

function classDef() {
  const id = localStorage.getItem("mv_class_id") || "warrior";
  return getClass(id);
}

function renderEquipment() {
  const c = classDef();
  const bag = loadBag();
  const gear = c.starterGear || {};
  const slots = [
    { key: "weapon", label: "Mainhand", item: gear.weapon },
    { key: "offhand", label: "Offhand", item: gear.offhand },
    { key: "armor", label: "Chest", item: gear.armor },
  ];
  const bagWeapons = bag.items.filter((i) => i.slot === "weapon" || i.slot === "armor" || i.slot === "shield");
  return `
    <div class="mp-section">
      <div class="mp-section-title">${escape(c.label)} · loadout</div>
      <div class="mp-eq-grid">
        ${slots
          .map(
            (s) => `
          <div class="mp-eq-slot">
            <div class="mp-eq-label">${s.label}</div>
            <div class="mp-eq-item mp-eq-with-icon">${
              s.item
                ? `${iconHtml(s.item.id || s.item.name, 32, s.item.name)}<span>${escape(s.item.name)}${s.item.dmg ? ` · ${s.item.dmg} dmg` : ""}${s.item.armor ? ` · ${s.item.armor} ar` : ""}</span>`
                : "— empty —"
            }</div>
          </div>`,
          )
          .join("")}
      </div>
      <div class="mp-section-title" style="margin-top:14px">Bag gear</div>
      <ul class="mp-list">
        ${
          bagWeapons
            .map(
              (i) =>
                `<li class="mp-li-icon">${iconHtml(i.id || i.name, 22, i.name)} ${escape(i.name)} <span class="mp-muted">T${i.tier} ${i.slot}</span></li>`,
            )
            .join("") || "<li class='mp-muted'>No extra gear yet — craft or buy</li>"
        }
      </ul>
    </div>`;
}

function renderInventory() {
  const bag = loadBag();
  const mats = bag.items.filter((i) => i.slot === "mat");
  const other = bag.items.filter((i) => i.slot !== "mat");
  return `
    <div class="mp-section">
      <div class="mp-inv-bar">
        <span>Level <strong>${bag.level}</strong></span>
        <span>XP <strong>${bag.xp}</strong></span>
        <span class="mp-gold">${bag.gold} Gold</span>
      </div>
      <div class="mp-section-title">Materials</div>
      <div class="mp-mat-row">
        ${
          mats
            .map(
              (m) =>
                `<span class="mp-chip mp-chip-icon">${iconHtml(m.id || m.name, 18, m.name)} ${escape(m.name)} ×${m.qty || 1}</span>`,
            )
            .join("") ||
          '<span class="mp-muted">Harvest trees/rocks (E) for wood & stone</span>'
        }
      </div>
      <div class="mp-section-title" style="margin-top:12px">Items</div>
      <ul class="mp-list">
        ${
          other
            .map(
              (i) =>
                `<li class="mp-li-icon">${iconHtml(i.id || i.name, 22, i.name)} ${escape(i.name)}${i.qty > 1 ? ` ×${i.qty}` : ""} <span class="mp-muted">T${i.tier} ${i.slot}</span></li>`,
            )
            .join("") || "<li class='mp-muted'>Empty</li>"
        }
      </ul>
      <div class="mp-section-title" style="margin-top:12px">Vendors (near hub)</div>
      ${Object.entries(VENDORS)
        .map(
          ([key, v]) =>
            `<div class="mp-vendor">
              <div class="mp-vendor-name">${escape(v.name)}</div>
              ${v.stock
                .map(
                  (s) =>
                    `<button type="button" class="mp-buy" data-v="${key}" data-item="${s.id}">${escape(s.name)} · ${s.price}g</button>`,
                )
                .join("")}
            </div>`,
        )
        .join("")}
    </div>`;
}

function renderSkills() {
  const c = classDef();
  const bag = loadBag();
  const level = bag.level || 1;
  return `
    <div class="mp-section">
      <div class="mp-section-title">${escape(c.label)} skills · L${level}</div>
      <div class="mp-skill-grid">
        ${(c.skills || [])
          .map((s) => {
            const locked = level < (s.level || 1);
            const key = s.key === "KeyF" ? "F" : s.shift ? `⇧${s.key.replace("Digit", "")}` : s.key;
            const ic = skillIconUrl(s, c.id);
            const icon = ic
              ? `<img src="${ic}" width="28" height="28" alt="" style="border-radius:6px;object-fit:contain" />`
              : "";
            return `<div class="mp-skill ${locked ? "locked" : ""}">
              <div class="mp-skill-key">${key}</div>
              ${icon}
              <div class="mp-skill-name">${escape(s.name)}</div>
              <div class="mp-skill-meta">${s.kind} · CD ${s.cd}s${locked ? ` · need L${s.level}` : ""}</div>
            </div>`;
          })
          .join("")}
      </div>
    </div>`;
}

function matHave(bag, matId) {
  return countMat(bag, matId);
}

function renderCrafting() {
  const bag = loadBag();
  return `
    <div class="mp-section">
      <div class="mp-section-title">Quick craft (local bag)</div>
      <p class="mp-hint">Mats from harvest (E). Costs must match bag item ids (t0_wood, t0_stone, …).</p>
      <div class="mp-craft-list">
        ${QUICK_RECIPES.map((r) => {
          const lines = Object.entries(r.costs).map(([mat, n]) => {
            const have = matHave(bag, mat);
            const ok = have >= n;
            return `<span class="${ok ? "ok" : "bad"}">${mat} ${have}/${n}</span>`;
          });
          const ready = Object.entries(r.costs).every(([mat, n]) => matHave(bag, mat) >= n);
          return `<button type="button" class="mp-craft-btn ${ready ? "ready" : "disabled"}" data-craft="${r.id}" ${ready ? "" : "disabled"}>
            <strong>${escape(r.name)}</strong>
            <span class="mp-craft-costs">${lines.join(" · ")}</span>
            <span class="mp-craft-out">→ ${escape(r.result.name)}</span>
          </button>`;
        }).join("")}
      </div>
      <div class="mp-section-title" style="margin-top:16px">Full crafting suite</div>
      <div class="mp-craft-embed-bar">
        <a href="${CRAFTING_SUITE_URL}" target="_blank" rel="noopener">Open Puter suite ↗</a>
        <button type="button" id="mp-toggle-embed" class="mp-link-btn">Embed suite</button>
      </div>
      <div id="mp-craft-embed" style="display:none" class="mp-craft-embed-wrap">
        <iframe src="${CRAFTING_SUITE_URL}" title="Grudge Crafting" class="mp-craft-iframe"></iframe>
      </div>
    </div>`;
}

function wireCrafting(root) {
  root.querySelectorAll("[data-craft]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-craft");
      const res = craft(id);
      if (res.ok) {
        renderMainPanelTab("crafting");
      } else {
        btn.classList.add("shake");
        setTimeout(() => btn.classList.remove("shake"), 400);
        alert(res.error || "Need more materials");
      }
    });
  });
  root.querySelector("#mp-toggle-embed")?.addEventListener("click", () => {
    const emb = root.querySelector("#mp-craft-embed");
    if (!emb) return;
    emb.style.display = emb.style.display === "none" ? "block" : "none";
  });
  root.querySelectorAll(".mp-buy").forEach((btn) => {
    btn.addEventListener("click", () => {
      const res = buy(btn.getAttribute("data-v"), btn.getAttribute("data-item"));
      if (res.ok) renderMainPanelTab("inventory");
      else alert(res.error === "gold" ? "Not enough gold" : "Buy failed");
    });
  });
}

function renderServer() {
  if (!socialApi) {
    return `<div class="mp-section"><p class="mp-muted">Server roster loading…</p></div>`;
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
      actions = `
        <span class="mp-badge friend">Friends</span>
        <button type="button" class="mp-btn unfriend" data-act="unfriend" data-pid="${escape(r.id)}">Unfriend</button>`;
    } else if (rel === "pending_out") {
      actions = `<span class="mp-badge pending">Request sent…</span>
        <button type="button" class="mp-btn enemy" data-act="enemy" data-pid="${escape(r.id)}">Hostile</button>`;
    } else if (rel === "pending_in") {
      actions = `<span class="mp-badge pending">Wants to be friends</span>
        <button type="button" class="mp-btn friend" data-act="accept" data-pid="${escape(r.id)}">Accept</button>
        <button type="button" class="mp-btn enemy" data-act="decline" data-pid="${escape(r.id)}">Decline</button>`;
    } else if (rel === "enemy") {
      actions = `
        <span class="mp-badge enemy">Hostile</span>
        <button type="button" class="mp-btn friend" data-act="friend" data-pid="${escape(r.id)}">Request friend</button>`;
    } else {
      // neutral / unknown
      actions = `
        <button type="button" class="mp-btn friend" data-act="friend" data-pid="${escape(r.id)}">Request friend</button>
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
    <div class="mp-section">
      <div class="mp-section-title">Server · ${escape(room)}</div>
      <p class="mp-hint">Request friend → they get Accept / Decline. Decline = hostile. Friends deal no damage.</p>
      <div id="players-list" class="mp-players">
        ${row(local, true)}
        ${remotes.map((r) => row(r, false)).join("") || `<div class="mp-muted" style="padding:12px">No other players in room</div>`}
      </div>
    </div>`;
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
  // wire inventory buys if mixed (not on server)
  root.querySelectorAll(".mp-buy").forEach((btn) => {
    btn.addEventListener("click", () => {
      const res = buy(btn.getAttribute("data-v"), btn.getAttribute("data-item"));
      if (res.ok) renderMainPanelTab("inventory");
    });
  });
}

/** Incoming friend request modal toast */
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

function escape(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function wireInventoryBuys(root) {
  root?.querySelectorAll(".mp-buy").forEach((btn) => {
    btn.addEventListener("click", () => {
      const res = buy(btn.getAttribute("data-v"), btn.getAttribute("data-item"));
      if (res.ok) renderMainPanelTab("inventory");
      else alert(res.error === "gold" ? "Not enough gold" : "Buy failed");
    });
  });
}

export function refreshOpenTab() {
  const on = document.querySelector("#main-panel-tabs button.on");
  renderMainPanelTab(on?.dataset?.tab || "server");
}
