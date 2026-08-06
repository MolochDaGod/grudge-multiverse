/**
 * Danger Room / Warlords control HUD — combat + harvest chrome (desktop keyboard).
 * DRC tight bar (Open HUD art) owns slots/bag; combat frame = boss + XP strip.
 */
import { ensureItemCatalog, iconHtml } from "./itemIcons.js";
import { loadBag, loadLoadout } from "./inventory.js";
import { mountDrcTightHud, refreshDrcTightHud } from "./drcTightHud.js";

export function mountWarlordsHud() {
  // Kill legacy prototype chrome — HUD tight.psd owns combat UI
  hideLegacyChrome();

  const el = document.querySelector(".hud");
  if (el) {
    // No permanent WASD wall — F1 help only
    el.innerHTML = `
      <button type="button" id="mv-help-btn" class="mv-help-chip" title="Keyboard help">
        <kbd>F1</kbd> <span>Help</span>
      </button>
    `;
    el.setAttribute("aria-label", "Controls help");
    el.style.cssText =
      "position:fixed;top:10px;left:12px;z-index:9994;background:transparent;padding:0;border:none;pointer-events:auto;";
    el.querySelector("#mv-help-btn")?.addEventListener("click", () => toggleHelpOverlay(true));
  }

  window.addEventListener("mv-bag", () => {
    refreshCombatFrame();
    refreshDrcTightHud();
  });
  window.addEventListener("mv-loadout", () => {
    refreshCombatFrame();
    refreshDrcTightHud();
  });
  window.addEventListener("mv-hp", (e) => {
    if (e?.detail?.hp != null) window.__mvHp = e.detail.hp;
    if (e?.detail?.maxHp != null) window.__mvMaxHp = e.detail.maxHp;
    refreshCombatFrame({ hp: window.__mvHp, maxHp: window.__mvMaxHp });
    refreshDrcTightHud();
  });

  const br = document.getElementById("br-panel");
  if (br) br.style.display = "none";
  const ammo = document.getElementById("ammo-panel");
  if (ammo) ammo.style.display = "none";

  let ch = document.getElementById("crosshair");
  if (ch) {
    // Open-style reticle: thin cross, not filled white blob
    ch.style.width = "18px";
    ch.style.height = "18px";
    ch.style.borderRadius = "0";
    ch.style.border = "none";
    ch.style.background =
      "linear-gradient(#e8c877,#e8c877) center/2px 100% no-repeat," +
      "linear-gradient(#e8c877,#e8c877) center/100% 2px no-repeat";
    ch.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.35)";
    ch.style.opacity = "0.92";
  }

  let net = document.getElementById("mv-net-status");
  if (!net) {
    net = document.createElement("div");
    net.id = "mv-net-status";
    net.style.cssText =
      "position:fixed;top:12px;right:12px;z-index:9998;padding:6px 10px;border-radius:999px;font:11px system-ui;background:rgba(0,0,0,0.55);border:1px solid rgba(200,168,75,0.35);color:#aaa;";
    net.textContent = "Net · connecting…";
    document.body.appendChild(net);
  }

  mountCombatFrame();
  mountHarvestPrompt();
  mountHelpOverlay();
  mountDrcTightHud();
  ensureItemCatalog().then(() => {
    refreshCombatFrame();
    refreshDrcTightHud();
  });
  ensureHudStyles();

  // F1 / ? help
  if (!window.__mvHelpKeysBound) {
    window.__mvHelpKeysBound = true;
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.code === "F1" || (e.key === "?" && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault();
        const ov = document.getElementById("mv-help-overlay");
        toggleHelpOverlay(!ov || ov.style.display === "none");
      }
      if (e.code === "Escape") toggleHelpOverlay(false);
    });
  }
}

function hideLegacyChrome() {
  const kill = ["player-hud", "weapon-hud", "ammo-hud", "br-panel", "ammo-panel"];
  for (const id of kill) {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = "none";
      el.setAttribute("aria-hidden", "true");
    }
  }
  // Any leftover green unit frames
  document.querySelectorAll(".avatar-box, #my-hp-num").forEach((n) => {
    const p = n.closest("#player-hud") || n;
    if (p && p.id === "player-hud") p.style.display = "none";
  });
}

const HELP_ROWS = [
  ["WASD", "Move"],
  ["Shift", "Sprint"],
  ["Space", "Jump"],
  ["LMB", "Select / attack"],
  ["RMB", "Focus soft-lock"],
  ["F / 1–5", "Skills"],
  ["E", "Harvest / loot"],
  ["I", "Bag / equipment"],
  ["Enter", "Chat"],
  ["F1", "This help"],
];

function mountHelpOverlay() {
  if (document.getElementById("mv-help-overlay")) return;
  const ov = document.createElement("div");
  ov.id = "mv-help-overlay";
  ov.style.display = "none";
  ov.innerHTML = `
    <div class="mv-help-card" role="dialog" aria-label="Controls">
      <header>
        <h2>Controls</h2>
        <p>HUD Tight (HUD.psd) · Multiverse combat</p>
        <button type="button" class="mv-help-x" aria-label="Close">×</button>
      </header>
      <ul>
        ${HELP_ROWS.map(([k, a]) => `<li><kbd>${k}</kbd><span>${a}</span></li>`).join("")}
      </ul>
      <footer>
        <span>Bottom bar = HP / stamina orbs + skills + loadout (Open HUD tight art)</span>
        <button type="button" class="mv-help-done">Got it</button>
      </footer>
    </div>
  `;
  ov.addEventListener("click", (e) => {
    if (e.target === ov || e.target.closest(".mv-help-x, .mv-help-done")) toggleHelpOverlay(false);
  });
  document.body.appendChild(ov);
}

function toggleHelpOverlay(open) {
  const ov = document.getElementById("mv-help-overlay");
  if (!ov) return;
  ov.style.display = open ? "grid" : "none";
  if (open) document.exitPointerLock?.();
}

function ensureHudStyles() {
  if (document.getElementById("mv-warlords-hud-css")) return;
  const s = document.createElement("style");
  s.id = "mv-warlords-hud-css";
  s.textContent = `
    /* Legacy green frame must never compete with HUD tight */
    #player-hud, #weapon-hud, #ammo-hud, #br-panel { display: none !important; }

    .mv-help-chip {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 5px 10px; border-radius: 999px; cursor: pointer;
      border: 1px solid rgba(212,175,55,0.4); background: rgba(8,10,16,0.82);
      color: #e8c877; font: 700 11px system-ui; letter-spacing: 0.04em;
      box-shadow: 0 4px 14px rgba(0,0,0,0.35); pointer-events: auto;
    }
    .mv-help-chip:hover { border-color: #e8c877; background: rgba(20,16,10,0.95); }
    .mv-help-chip kbd {
      padding: 1px 6px; border-radius: 4px; border: 1px solid rgba(232,200,119,0.45);
      background: rgba(0,0,0,0.45); color: #f2ecdf; font: 700 10px ui-monospace, monospace;
    }

    #mv-help-overlay {
      position: fixed; inset: 0; z-index: 100050; place-items: center;
      background: rgba(4,8,16,0.72); backdrop-filter: blur(6px);
    }
    #mv-help-overlay .mv-help-card {
      width: min(420px, 92vw); border-radius: 14px; overflow: hidden;
      border: 1px solid rgba(212,175,55,0.35);
      background: linear-gradient(165deg, rgba(14,16,24,0.98), rgba(8,10,16,0.99));
      box-shadow: 0 20px 50px rgba(0,0,0,0.55); color: #e8ecf8; font: 13px system-ui;
    }
    #mv-help-overlay header {
      position: relative; padding: 14px 16px 10px; border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    #mv-help-overlay h2 { margin: 0; font-size: 1.1rem; color: #e8c877; letter-spacing: 0.08em; text-transform: uppercase; }
    #mv-help-overlay header p { margin: 4px 0 0; color: #8b93b0; font-size: 12px; }
    #mv-help-overlay .mv-help-x {
      position: absolute; top: 10px; right: 10px; width: 32px; height: 32px;
      border-radius: 8px; border: 1px solid rgba(255,255,255,0.12);
      background: transparent; color: #ccc; font-size: 1.3rem; cursor: pointer;
    }
    #mv-help-overlay ul { list-style: none; margin: 0; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; }
    #mv-help-overlay li { display: flex; gap: 12px; align-items: center; }
    #mv-help-overlay li kbd {
      min-width: 72px; text-align: center; padding: 3px 8px; border-radius: 5px;
      border: 1px solid rgba(165,180,252,0.35); background: rgba(30,40,70,0.85);
      color: #e0e7ff; font: 700 11px ui-monospace, monospace;
    }
    #mv-help-overlay footer {
      display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;
      padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.06);
      font-size: 11px; color: #7c849e;
    }
    #mv-help-overlay .mv-help-done {
      padding: 7px 14px; border-radius: 8px; cursor: pointer;
      border: 1px solid rgba(212,175,55,0.45); background: rgba(212,175,55,0.12);
      color: #e8c877; font: 700 11px system-ui; letter-spacing: 0.06em; text-transform: uppercase;
    }

    /* Compact top-left — name + boss only (HP lives on tight orbs) */
    #mv-combat-frame {
      position: fixed; top: 48px; left: 14px; z-index: 9996;
      min-width: 168px; max-width: 220px; padding: 8px 10px;
      border-radius: 10px; background: rgba(8,10,16,0.72);
      border: 1px solid rgba(200,168,75,0.28); box-shadow: 0 4px 18px rgba(0,0,0,0.35);
      font: 11px system-ui; color: #ddd; pointer-events: none;
    }
    #mv-combat-frame.cf-idle { opacity: 0.55; }
    #mv-combat-frame .cf-name { font-weight: 700; color: #e8c877; margin-bottom: 2px; font-size: 12px; }
    #mv-combat-frame .cf-bar {
      height: 6px; border-radius: 999px; background: rgba(255,255,255,0.08);
      overflow: hidden; margin: 2px 0;
    }
    #mv-combat-frame .cf-bar > i { display: block; height: 100%; border-radius: inherit; }
    #mv-combat-frame .cf-xp > i { background: linear-gradient(90deg,#2a5a8a,#5aa8e8); width: 0%; }
    #mv-combat-frame .cf-boss-hp > i { background: linear-gradient(90deg,#5a1a08,#e85a20); }
    #mv-combat-frame .cf-meta { display: flex; justify-content: space-between; color: #888; font-size: 10px; }
    #mv-combat-frame .cf-wep {
      display: flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 10px; color: #bbb;
    }
    #mv-combat-frame .cf-boss { margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,100,60,0.25); }
    #mv-combat-frame .cf-telegraph {
      margin-top: 4px; font-size: 10px; font-weight: 700; color: #ffb070;
      letter-spacing: 0.04em; animation: mv-tel-pulse 0.45s ease-in-out infinite alternate;
    }
    @keyframes mv-tel-pulse { from { opacity: 0.65; } to { opacity: 1; } }
    #mv-combat-frame .cf-mats { display: none; }
    #mv-harvest-prompt {
      position: fixed; bottom: 22vh; left: 50%; transform: translateX(-50%);
      z-index: 9996; padding: 8px 14px; border-radius: 10px;
      background: rgba(8,12,18,0.88); border: 1px solid rgba(110,236,154,0.45);
      color: #b8f0c8; font: 600 13px system-ui; display: none; pointer-events: none;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    }
    #mv-harvest-prompt kbd {
      display: inline-block; padding: 1px 6px; margin: 0 2px; border-radius: 4px;
      border: 1px solid rgba(110,236,154,0.5); background: rgba(0,0,0,0.4); font: 700 11px system-ui;
    }
    .mv-icon-fallback {
      display: inline-flex; align-items: center; justify-content: center;
      background: rgba(200,168,75,0.15); border-radius: 4px; font: 700 9px system-ui; color: #e8c877;
    }
  `;
  document.head.appendChild(s);
}

function mountCombatFrame() {
  let el = document.getElementById("mv-combat-frame");
  if (!el) {
    el = document.createElement("div");
    el.id = "mv-combat-frame";
    document.body.appendChild(el);
  }
  refreshCombatFrame();
}

export function refreshCombatFrame(extra = {}) {
  const el = document.getElementById("mv-combat-frame");
  if (!el) return;
  const bag = loadBag();
  const loadout = loadLoadout();
  const hp = typeof extra.hp === "number" ? extra.hp : (window.__mvHp ?? 100);
  const maxHp = typeof extra.maxHp === "number" ? extra.maxHp : (window.__mvMaxHp ?? 100);
  const name = extra.name || window.__mvPlayerName || "Hero";
  const classLabel = extra.classLabel || window.__mvClassLabel || "";
  const scaleNote = window.__mvCharMeta?.height
    ? ` · ${Number(window.__mvCharMeta.height).toFixed(2)}m`
    : "";
  const mapNote = window.__mvMapMeta?.widthM
    ? ` · map ~${Math.round(window.__mvMapMeta.widthM)}m`
    : "";
  const xpInLevel = (bag.xp || 0) % 100;
  const mats = (bag.items || []).filter((i) => i.slot === "mat").slice(0, 4);
  const matHtml = mats
    .map(
      (m) =>
        `<span class="cf-mat">${iconHtml(m.id || m.name, 16, m.name)}<span>${escapeHtml(m.name)} ×${m.qty || 1}</span></span>`,
    )
    .join("");
  const wep = loadout.weapon;
  const wepHtml = wep
    ? `<div class="cf-wep">${iconHtml(wep.id || wep.name, 18, wep.name)}<span>${escapeHtml(wep.name)}${wep.dmg ? ` · ${wep.dmg} dmg` : ""}</span></div>`
    : `<div class="cf-meta" style="margin-top:4px;opacity:0.7">No weapon · open <kbd>I</kbd> Equipment</div>`;
  const boss = window.__mvBossTarget;
  const tel = window.__mvBossTelegraph;
  const telHtml = tel
    ? `<div class="cf-telegraph">⚠ ${escapeHtml(tel.boss || "")} · ${escapeHtml(tel.attack || "Attack")}</div>`
    : "";
  const bossHtml =
    boss && boss.hp > 0
      ? `<div class="cf-boss">
          <div class="cf-meta"><span>${escapeHtml(boss.name || "Boss")}</span><span>${Math.round(boss.hp)}/${Math.round(boss.maxHp || 1)}</span></div>
          <div class="cf-bar cf-boss-hp"><i style="width:${Math.max(0, Math.min(100, (boss.hp / Math.max(1, boss.maxHp || 1)) * 100))}%"></i></div>
          ${telHtml}
        </div>`
      : telHtml
        ? `<div class="cf-boss">${telHtml}</div>`
        : "";
  // HP is on HUD-tight orbs — keep frame for name / weapon / boss only
  const showBoss = !!(boss && boss.hp > 0) || !!tel;
  el.classList.toggle("cf-idle", !showBoss);
  el.innerHTML = `
    <div class="cf-name">${escapeHtml(name)}${classLabel ? ` · ${escapeHtml(classLabel)}` : ""} · L${bag.level || 1}</div>
    <div class="cf-meta"><span>${bag.xp || 0} XP · ${bag.gold || 0}g</span><span>${mapNote.replace(/^ · /, "") || ""}</span></div>
    <div class="cf-bar cf-xp"><i style="width:${xpInLevel}%"></i></div>
    ${wepHtml}
    ${bossHtml}
  `;
}

function mountHarvestPrompt() {
  if (document.getElementById("mv-harvest-prompt")) return;
  const el = document.createElement("div");
  el.id = "mv-harvest-prompt";
  el.textContent = "Harvest";
  document.body.appendChild(el);
}

/** Show/hide proximity harvest / loot prompt. */
export function setHarvestPrompt(visible, kind = "resource", mode = "harvest") {
  const el = document.getElementById("mv-harvest-prompt");
  if (!el) return;
  if (!visible) {
    el.style.display = "none";
    return;
  }
  el.style.display = "block";
  if (mode === "loot") {
    el.innerHTML = `Press <kbd>E</kbd> or walk over to pick up <strong>${escapeHtml(kind)}</strong>`;
  } else {
    el.innerHTML = `Press <kbd>E</kbd> to harvest <strong>${escapeHtml(kind)}</strong>`;
  }
}

/** Push local HP into HUD (call from damage / heal). */
export function syncHp(hp, maxHp = 100) {
  window.__mvHp = hp;
  window.__mvMaxHp = maxHp;
  window.dispatchEvent(new CustomEvent("mv-hp", { detail: { hp, maxHp } }));
}

export function setNetStatus(text, ok) {
  const net = document.getElementById("mv-net-status");
  if (!net) return;
  net.textContent = text;
  net.style.borderColor = ok ? "rgba(80,200,120,0.5)" : "rgba(200,168,75,0.35)";
  net.style.color = ok ? "#6eec9a" : "#aaa";
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
