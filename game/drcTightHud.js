/**
 * DRC Tight HUD for Multiverse — vanilla port of Open Danger TightBar.
 *
 * Art SSOT: https://open.grudge-studio.com/hud-tight-bar.png (HUD.psd / 3800×726)
 * Geometry matches gameopen TightBar.tsx (orbs + 6+6 slots + center avatar).
 * Data: Multiverse bag / loadout / class skills / HP — no parallel stacks.
 */
import { loadBag, loadLoadout } from "./inventory.js";
import { unlockedSkills } from "./classes.js";
import { ensureItemCatalog, itemIconUrl, skillIconUrl } from "./itemIcons.js";
import { racePortraitUrl } from "./selectIcons.js";
import { ensureMvUiTheme } from "./mvUiTheme.js";

/** SSOT: HUD tight.psd export — local first, then Open CDN */
const TIGHT_BAR_CANDIDATES = [
  "/hud-tight-bar.png",
  "./hud-tight-bar.png",
  "https://open.grudge-studio.com/hud-tight-bar.png",
];
let tightBarUrl = TIGHT_BAR_CANDIDATES[0];

function resolveTightBarArt() {
  return new Promise((resolve) => {
    let i = 0;
    const tryNext = () => {
      if (i >= TIGHT_BAR_CANDIDATES.length) {
        resolve(TIGHT_BAR_CANDIDATES[TIGHT_BAR_CANDIDATES.length - 1]);
        return;
      }
      const url = TIGHT_BAR_CANDIDATES[i++];
      const img = new Image();
      img.onload = () => {
        tightBarUrl = url;
        resolve(url);
      };
      img.onerror = () => tryNext();
      img.src = url;
    };
    tryNext();
  });
}

const TB_W = 3800;
const TB_H = 726;
const TB_CELL_W = 230;
const TB_CELL_H = 132;
const TB_COLS = [776, 1028, 1274, 2276, 2526, 2772];
const TB_ROWS = [378, 548];
const TB_ORB_R = 150;
const TB_ORB_HP = { cx: 354, cy: 360 };
const TB_ORB_MP = { cx: 3446, cy: 360 };

function pct(n, d) {
  return `${((n / d) * 100).toFixed(3)}%`;
}
function slotStyle(i) {
  const grid = i < 6 ? 0 : 1;
  const j = i % 6;
  const col = grid * 3 + (j % 3);
  const row = Math.floor(j / 3);
  return `left:${pct(TB_COLS[col], TB_W)};top:${pct(TB_ROWS[row], TB_H)};width:${pct(TB_CELL_W, TB_W)};height:${pct(TB_CELL_H, TB_H)}`;
}
function orbStyle(orb) {
  return `left:${pct(orb.cx - TB_ORB_R, TB_W)};top:${pct(orb.cy - TB_ORB_R, TB_H)};width:${pct(TB_ORB_R * 2, TB_W)};height:${pct(TB_ORB_R * 2, TB_H)}`;
}

/** @type {{ skillBar?: any, classDef?: object } | null} */
let ctx = null;
let cdTimer = 0;
let listenersBound = false;

/**
 * @param {{ skillBar?: any, classDef?: object }} opts
 */
export function mountDrcTightHud(opts = {}) {
  ctx = { ...(ctx || {}), ...opts };
  try {
    ensureMvUiTheme();
  } catch {
    /* */
  }
  ensureStyles();
  ensureItemCatalog().then(() => refreshDrcTightHud());

  let root = document.getElementById("mv-tightbar");
  if (!root) {
    root = document.createElement("div");
    root.id = "mv-tightbar";
    root.className = "mv-tightbar";
    root.setAttribute("aria-label", "Combat tight HUD — HUD.psd");
    document.body.appendChild(root);
  }

  // Hide every legacy / prototype HUD that fights HUD tight.psd
  for (const id of ["skill-hotbar", "player-hud", "weapon-hud", "ammo-hud", "br-panel"]) {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = "none";
      el.setAttribute("aria-hidden", "true");
    }
  }

  // Resolve art ASAP (local public copy preferred)
  resolveTightBarArt().then((url) => {
    const r = document.getElementById("mv-tightbar");
    if (r) {
      r.style.backgroundImage = `url(${url})`;
      r.dataset.art = url;
    }
    refreshDrcTightHud();
  });

  if (!listenersBound) {
    listenersBound = true;
    window.addEventListener("mv-bag", () => refreshDrcTightHud());
    window.addEventListener("mv-loadout", () => refreshDrcTightHud());
    window.addEventListener("mv-hp", () => refreshDrcTightHud());
    window.addEventListener("mv-stamina", () => refreshDrcTightHud());
  }

  if (!cdTimer) {
    cdTimer = window.setInterval(() => refreshDrcTightHud({ light: true }), 200);
  }

  if (!root.dataset.wired) {
    root.dataset.wired = "1";
    root.addEventListener("click", (e) => {
      const t = e.target?.closest?.("[data-skill],[data-open-tab],#tb-open-bag");
      if (!t || !root.contains(t)) return;
      if (t.id === "tb-open-bag" || t.getAttribute("data-open-tab")) {
        const tab = t.getAttribute("data-open-tab") || "equipment";
        window.__mvOpenMainPanel?.(tab === "inventory" ? "equipment" : tab);
        return;
      }
      const id = t.getAttribute("data-skill");
      if (!id || !ctx?.skillBar) return;
      const bag = loadBag();
      const skills = ctx.classDef ? unlockedSkills(ctx.classDef, bag.level || 1) : [];
      const skill = skills.find((s) => s.id === id);
      if (skill) ctx.skillBar.cast(skill);
    });
  }

  refreshDrcTightHud();
  return { refresh: refreshDrcTightHud, root };
}

export function setTightHudSkillBar(skillBar, classDef) {
  if (!ctx) ctx = {};
  ctx.skillBar = skillBar;
  if (classDef) ctx.classDef = classDef;
  refreshDrcTightHud();
}

/** @param {{ light?: boolean }} [opts] light = only update orbs/CD if shell already built */
export function refreshDrcTightHud(opts = {}) {
  const root = document.getElementById("mv-tightbar");
  if (!root) return;

  const bag = loadBag();
  const loadout = loadLoadout();
  const hp = window.__mvHp ?? 100;
  const maxHp = window.__mvMaxHp ?? 100;
  const stam = window.__mvStamina ?? 100;
  const maxStam = window.__mvMaxStamina ?? 100;
  const hpPct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
  const stPct = maxStam > 0 ? Math.max(0, Math.min(100, (stam / maxStam) * 100)) : 0;

  const name = window.__mvPlayerName || "Hero";
  const classDef = ctx?.classDef || null;
  const level = bag.level || 1;
  const skills = classDef ? unlockedSkills(classDef, level) : [];
  const skillBar = ctx?.skillBar;
  const now = performance.now();

  const raceId = window.__mvRaceId || "western-kingdoms";
  const portrait = racePortraitUrl(raceId);
  const bagCount = (bag.items || []).reduce((n, i) => n + (i.qty || 1), 0);

  // Light path: update live numbers without full rebuild
  if (opts.light && root.dataset.shell === "1") {
    const drainHp = root.querySelector(".tb-orb-hp .tb-orb-drain");
    const valHp = root.querySelector(".tb-orb-hp .tb-orb-val");
    const drainMp = root.querySelector(".tb-orb-mp .tb-orb-drain");
    const valMp = root.querySelector(".tb-orb-mp .tb-orb-val");
    if (drainHp) drainHp.style.height = `${100 - hpPct}%`;
    if (valHp) valHp.textContent = String(Math.round(hp));
    if (drainMp) drainMp.style.height = `${100 - stPct}%`;
    if (valMp) valMp.textContent = String(Math.round(stam));
    const xpFill = root.querySelector(".tb-poise-fill");
    if (xpFill) xpFill.style.width = `${(bag.xp || 0) % 100}%`;
    const bagFab = root.querySelector("#tb-open-bag span");
    if (bagFab) bagFab.textContent = String(bagCount);

    root.querySelectorAll("[data-skill]").forEach((el) => {
      const id = el.getAttribute("data-skill");
      const skill = skills.find((s) => s.id === id);
      if (!skill) return;
      const readyAt = skillBar?.cds?.get?.(skill.id) || 0;
      const left = Math.max(0, readyAt - now);
      const cdMax = (skill.cd || 1) * 1000;
      const onCd = left > 0;
      el.classList.toggle("on-cd", onCd);
      el.classList.toggle("ready", !onCd);
      let sweep = el.querySelector(".tb-sweep");
      let cdEl = el.querySelector(".tb-cd:not(.tb-badge)");
      if (onCd) {
        const frac = Math.min(1, left / cdMax);
        if (!sweep) {
          sweep = document.createElement("div");
          sweep.className = "tb-sweep";
          el.appendChild(sweep);
        }
        sweep.style.background = `conic-gradient(rgba(4,10,20,0.78) ${frac * 360}deg, transparent 0deg)`;
        if (!cdEl) {
          cdEl = document.createElement("span");
          cdEl.className = "tb-cd";
          el.appendChild(cdEl);
        }
        cdEl.textContent = (left / 1000).toFixed(1);
      } else {
        sweep?.remove();
        cdEl?.remove();
      }
    });
    return;
  }

  const slots = [];

  for (let i = 0; i < 6; i++) {
    const skill = skills[i] || null;
    if (!skill) {
      slots.push({ empty: true, key: "·" });
      continue;
    }
    const key = skill.key === "KeyF" ? "F" : String(skill.key || "").replace("Digit", "");
    const readyAt = skillBar?.cds?.get?.(skill.id) || 0;
    const left = Math.max(0, readyAt - now);
    const cdMax = (skill.cd || 1) * 1000;
    const icon = skillIconUrl(skill, classDef?.id);
    slots.push({
      id: skill.id,
      name: skill.name,
      key,
      icon,
      tip: `${skill.name} · ${skill.kind || "skill"} · CD ${skill.cd || 0}s`,
      onCd: left > 0,
      cdLeft: left / 1000,
      frac: left > 0 ? Math.min(1, left / cdMax) : 0,
      skill: true,
    });
  }

  const wep = loadout.weapon;
  const off = loadout.offhand;
  const armor = loadout.armor;

  slots.push(
    {
      id: "weapon",
      name: wep?.name || "Weapon",
      key: "W",
      icon: wep ? itemIconUrl(wep.id || wep.name) : null,
      letter: "⚔",
      accent: !!wep,
      openTab: "equipment",
    },
    {
      id: "offhand",
      name: off?.name || "Offhand",
      key: "O",
      icon: off ? itemIconUrl(off.id || off.name) : null,
      letter: "🛡",
      accent: !!off,
      openTab: "equipment",
    },
    {
      id: "armor",
      name: armor?.name || "Armor",
      key: "A",
      icon: armor ? itemIconUrl(armor.id || armor.name) : null,
      letter: "🎽",
      accent: !!armor,
      openTab: "equipment",
    },
    {
      id: "bag",
      name: `Bag · ${bagCount} items`,
      key: "I",
      icon: null,
      letter: "🎒",
      accent: true,
      openTab: "inventory",
      badge: bagCount > 0 ? String(bagCount) : "",
    },
    {
      id: "gold",
      name: `${bag.gold || 0} Gold`,
      key: "G",
      letter: "💰",
      openTab: "inventory",
      badge: String(bag.gold || 0),
    },
    {
      id: "level",
      name: `Level ${level} · XP ${bag.xp || 0}`,
      key: "L",
      letter: "★",
      openTab: "equipment",
      badge: `L${level}`,
    },
  );

  const slotHtml = slots
    .map((s, i) => {
      if (s.empty) {
        return `<div class="tb-slot tb-empty" style="${slotStyle(i)}" title="Empty"><span class="tb-key">·</span></div>`;
      }
      const img = s.icon
        ? `<img src="${esc(s.icon)}" alt="" draggable="false" onerror="this.style.display='none'" />`
        : `<span class="tb-letter">${s.letter || "?"}</span>`;
      const cd =
        s.onCd
          ? `<div class="tb-sweep" style="background:conic-gradient(rgba(4,10,20,0.78) ${s.frac * 360}deg, transparent 0deg)"></div>
             <span class="tb-cd">${s.cdLeft.toFixed(1)}</span>`
          : s.badge
            ? `<span class="tb-cd tb-badge">${esc(s.badge)}</span>`
            : "";
      const cls = `tb-slot ${s.accent ? "tb-accent" : ""} ${s.onCd ? "on-cd" : "ready"} ${s.openTab || s.skill ? "tb-click" : ""}`;
      const data = s.skill
        ? `data-skill="${esc(s.id)}"`
        : s.openTab
          ? `data-open-tab="${esc(s.openTab)}"`
          : "";
      const tip = s.tip || s.name || "";
      return `<div class="${cls} mv-slot" style="${slotStyle(i)}" title="${esc(s.name)}${s.key ? ` — ${s.key}` : ""}" data-tip="${esc(tip)}" data-tip-title="${esc(s.name || "")}" ${data}>
        ${img}
        ${cd}
        <span class="tb-key">${esc(s.key || "")}</span>
      </div>`;
    })
    .join("");

  root.innerHTML = `
    <div class="tb-orb tb-orb-hp" style="${orbStyle(TB_ORB_HP)}" title="Health — ${Math.round(hp)}/${Math.round(maxHp)}">
      <div class="tb-orb-drain" style="height:${100 - hpPct}%"></div>
      <span class="tb-orb-val">${Math.round(hp)}</span>
    </div>
    <div class="tb-orb tb-orb-mp" style="${orbStyle(TB_ORB_MP)}" title="Stamina — ${Math.round(stam)}/${Math.round(maxStam)}">
      <div class="tb-orb-drain" style="height:${100 - stPct}%"></div>
      <span class="tb-orb-val">${Math.round(stam)}</span>
    </div>
    ${slotHtml}
    <div class="tb-avatar" title="${esc(name)}">
      <img src="${esc(portrait)}" alt="" draggable="false" onerror="this.style.display='none'" />
      <span class="tb-avatar-name">${esc(name)}</span>
    </div>
    <div class="tb-poise" title="XP">
      <div class="tb-poise-fill" style="width:${(bag.xp || 0) % 100}%"></div>
    </div>
    <button type="button" class="tb-bag-fab" id="tb-open-bag" title="Bag / Main Panel (I)">
      🎒 <span>${bagCount}</span>
    </button>
  `;

  root.style.backgroundImage = `url(${tightBarUrl})`;
  root.dataset.shell = "1";
}

function ensureStyles() {
  if (document.getElementById("mv-tightbar-css")) return;
  const s = document.createElement("style");
  s.id = "mv-tightbar-css";
  s.textContent = `
    .mv-tightbar {
      position: fixed;
      left: 50%;
      bottom: 0;
      z-index: 9997;
      width: min(96vw, 1160px);
      aspect-ratio: 3800 / 726;
      transform: translateX(-50%);
      background-size: 100% 100%;
      background-repeat: no-repeat;
      background-color: transparent;
      pointer-events: none;
      filter: drop-shadow(0 6px 18px rgba(0, 0, 0, 0.55));
    }
    /* Fallback ring if PSD art is slow — still reads as orbs */
    .mv-tightbar .tb-orb {
      position: absolute; border-radius: 50%; overflow: hidden;
      display: flex; align-items: center; justify-content: center;
      box-shadow: inset 0 0 0 2px rgba(232,200,119,0.25), 0 0 12px rgba(0,0,0,0.45);
      background: radial-gradient(circle at 40% 35%, rgba(40,20,20,0.35), rgba(8,8,12,0.55));
    }
    .mv-tightbar .tb-orb-mp {
      background: radial-gradient(circle at 40% 35%, rgba(20,30,50,0.4), rgba(8,8,12,0.55));
    }
    .mv-tightbar .tb-orb-drain {
      position: absolute; top: 0; left: 0; right: 0;
      background: rgba(8, 8, 12, 0.86); transition: height 160ms linear;
    }
    .mv-tightbar .tb-orb-val {
      position: relative; font-size: clamp(11px, 1.4vw, 17px); font-weight: 700;
      letter-spacing: 0.04em; color: #f2ecdf;
      text-shadow: 0 1px 3px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6);
    }
    .mv-tightbar .tb-slot {
      position: absolute; display: flex; align-items: center; justify-content: center;
      color: #cfe2ff; border-radius: 4px; pointer-events: auto; cursor: default;
    }
    .mv-tightbar .tb-slot.tb-click { cursor: pointer; }
    .mv-tightbar .tb-slot img {
      filter: drop-shadow(0 1px 2px rgba(0,0,0,0.9));
      max-width: 72%; max-height: 72%; object-fit: contain;
    }
    .mv-tightbar .tb-letter {
      font-size: clamp(14px, 1.8vw, 22px); line-height: 1;
      filter: drop-shadow(0 1px 2px rgba(0,0,0,0.9));
    }
    .mv-tightbar .tb-slot.tb-accent { color: #ffd27a; }
    .mv-tightbar .tb-slot.tb-empty { opacity: 0.35; }
    .mv-tightbar .tb-key {
      position: absolute; right: 5%; bottom: 3%;
      font-size: clamp(7px, 0.75vw, 10px); font-weight: 700;
      letter-spacing: 0.05em; color: rgba(235,240,250,0.75);
      text-shadow: 0 1px 2px rgba(0,0,0,0.9);
    }
    .mv-tightbar .tb-sweep {
      position: absolute; inset: 6%; border-radius: 4px; pointer-events: none;
    }
    .mv-tightbar .tb-cd {
      position: absolute; font-size: clamp(9px, 1vw, 13px); font-weight: 700;
      color: #ffe9b0; text-shadow: 0 1px 3px rgba(0,0,0,0.95);
    }
    .mv-tightbar .tb-badge {
      bottom: 12%; right: 8%; top: auto; font-size: clamp(8px, 0.85vw, 11px);
    }
    .mv-tightbar .tb-slot.on-cd img { opacity: 0.45; }
    .mv-tightbar .tb-avatar {
      position: absolute; left: 45.947%; top: 38.6%; width: 7.789%; height: 55.1%;
      border-radius: 48% 48% 6% 6% / 34% 34% 4% 4%; overflow: hidden;
      display: flex; align-items: center; justify-content: center;
      background: radial-gradient(circle at 50% 30%, rgba(58,66,84,0.55), rgba(10,12,18,0.65));
      pointer-events: none;
    }
    .mv-tightbar .tb-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .mv-tightbar .tb-avatar-name {
      position: absolute; bottom: 2%; left: 0; right: 0; text-align: center;
      font-size: clamp(7px, 0.8vw, 11px); font-weight: 700; letter-spacing: 0.08em;
      text-transform: uppercase; color: #e8dcc2;
      text-shadow: 0 1px 3px rgba(0,0,0,0.95);
    }
    .mv-tightbar .tb-poise {
      position: absolute; left: 45.947%; top: 95%; width: 7.789%; height: 3%;
      border-radius: 3px; background: rgba(10,8,8,0.72);
      box-shadow: inset 0 0 0 1px rgba(0,0,0,0.6); overflow: hidden;
    }
    .mv-tightbar .tb-poise-fill {
      height: 100%; background: linear-gradient(90deg, #b9924e, #e8c979);
      transition: width 120ms linear;
    }
    .mv-tightbar .tb-bag-fab {
      position: absolute; right: 1.5%; bottom: 8%;
      pointer-events: auto; cursor: pointer;
      display: flex; align-items: center; gap: 6px;
      padding: 6px 12px; border-radius: 999px;
      border: 1px solid rgba(212,175,55,0.55);
      background: rgba(12,10,8,0.88); color: #e8c877;
      font: 700 12px system-ui; z-index: 2;
      box-shadow: 0 4px 14px rgba(0,0,0,0.45);
    }
    .mv-tightbar .tb-bag-fab:hover {
      border-color: #e8c877; background: rgba(30,22,12,0.95);
    }
    #skill-hotbar { display: none !important; }
  `;
  document.head.appendChild(s);
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
