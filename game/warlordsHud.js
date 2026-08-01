/**
 * Danger Room / Warlords control HUD — combat + harvest chrome (desktop keyboard).
 * Replaces FPS gun legend. No mobile joystick UI.
 */
import { ensureItemCatalog, iconHtml } from "./itemIcons.js";
import { loadBag } from "./inventory.js";

export function mountWarlordsHud() {
  const el = document.querySelector(".hud");
  if (el) {
    el.innerHTML = `
      <div class="row"><span class="hint-text">Move</span> <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>
        <span class="hud-sep"></span><span class="hint-text">Sprint</span> <kbd>Shift</kbd>
        <span class="hud-sep"></span><span class="hint-text">Jump</span> <kbd>Space</kbd></div>
      <div class="row"><span class="hint-text">Attack</span> <kbd>F</kbd>
        <span class="hud-sep"></span><span class="hint-text">Skills</span> <kbd>1</kbd>–<kbd>5</kbd>
        <span class="hud-sep"></span><span class="hint-text">Harvest / loot</span> <kbd>E</kbd></div>
      <div class="row"><span class="hint-text">Select</span> <kbd>LMB</kbd>
        <span class="hud-sep"></span><span class="hint-text">Focus soft-lock</span> <kbd>RMB</kbd>
        <span class="hud-sep"></span><span class="hint-text">Main panel</span> <kbd>I</kbd>
        <span class="hud-sep"></span><span class="hint-text">Chat</span> <kbd>Enter</kbd></div>
    `;
    el.setAttribute("aria-label", "Danger controls");
  }

  // Hide FPS gun chrome
  const br = document.getElementById("br-panel");
  if (br) br.style.display = "none";
  const ammo = document.getElementById("ammo-panel");
  if (ammo) ammo.style.display = "none";

  let ch = document.getElementById("crosshair");
  if (ch) {
    ch.style.width = "14px";
    ch.style.height = "14px";
    ch.style.borderRadius = "50%";
    ch.style.border = "2px solid rgba(232,200,119,0.9)";
    ch.style.background = "transparent";
    ch.style.boxShadow = "0 0 8px rgba(0,0,0,0.5)";
  }

  // Net status pill
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
  ensureItemCatalog().then(() => refreshCombatFrame());
  ensureHudStyles();
}

function ensureHudStyles() {
  if (document.getElementById("mv-warlords-hud-css")) return;
  const s = document.createElement("style");
  s.id = "mv-warlords-hud-css";
  s.textContent = `
    #mv-combat-frame {
      position: fixed; top: 56px; left: 16px; z-index: 9996;
      min-width: 200px; max-width: 260px; padding: 10px 12px;
      border-radius: 12px; background: rgba(8,10,16,0.82);
      border: 1px solid rgba(200,168,75,0.35); box-shadow: 0 6px 24px rgba(0,0,0,0.4);
      font: 12px system-ui; color: #ddd; pointer-events: none;
    }
    #mv-combat-frame .cf-name { font-weight: 700; color: #e8c877; margin-bottom: 6px; }
    #mv-combat-frame .cf-bar {
      height: 10px; border-radius: 999px; background: rgba(255,255,255,0.08);
      overflow: hidden; margin: 3px 0 2px;
    }
    #mv-combat-frame .cf-bar > i { display: block; height: 100%; border-radius: inherit; }
    #mv-combat-frame .cf-hp > i { background: linear-gradient(90deg,#8b2e2e,#e85d5d); }
    #mv-combat-frame .cf-xp > i { background: linear-gradient(90deg,#2a5a8a,#5aa8e8); width: 0%; }
    #mv-combat-frame .cf-meta { display: flex; justify-content: space-between; color: #888; font-size: 10px; }
    #mv-combat-frame .cf-mats { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
    #mv-combat-frame .cf-mat {
      display: flex; align-items: center; gap: 4px; padding: 2px 6px;
      border-radius: 6px; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.06);
      font-size: 10px; color: #ccc;
    }
    #mv-combat-frame .cf-mat img { width: 16px; height: 16px; object-fit: contain; }
    #mv-harvest-prompt {
      position: fixed; bottom: 160px; left: 50%; transform: translateX(-50%);
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
  const hp = typeof extra.hp === "number" ? extra.hp : (window.__mvHp ?? 100);
  const maxHp = typeof extra.maxHp === "number" ? extra.maxHp : (window.__mvMaxHp ?? 100);
  const name = extra.name || window.__mvPlayerName || "Hero";
  const classLabel = extra.classLabel || window.__mvClassLabel || "";
  const xpInLevel = (bag.xp || 0) % 100;
  const mats = (bag.items || []).filter((i) => i.slot === "mat").slice(0, 4);
  const matHtml = mats
    .map(
      (m) =>
        `<span class="cf-mat">${iconHtml(m.id || m.name, 16, m.name)}<span>${m.name} ×${m.qty || 1}</span></span>`,
    )
    .join("");
  el.innerHTML = `
    <div class="cf-name">${escapeHtml(name)}${classLabel ? ` · ${escapeHtml(classLabel)}` : ""} · L${bag.level || 1}</div>
    <div class="cf-meta"><span>HP</span><span>${Math.round(hp)} / ${Math.round(maxHp)}</span></div>
    <div class="cf-bar cf-hp"><i style="width:${Math.max(0, Math.min(100, (hp / maxHp) * 100))}%"></i></div>
    <div class="cf-meta"><span>XP</span><span>${bag.xp || 0} · ${bag.gold || 0}g</span></div>
    <div class="cf-bar cf-xp"><i style="width:${xpInLevel}%"></i></div>
    ${matHtml ? `<div class="cf-mats">${matHtml}</div>` : `<div class="cf-meta" style="margin-top:6px">Harvest with <kbd style="color:#6eec9a">E</kbd></div>`}
  `;
}

function mountHarvestPrompt() {
  if (document.getElementById("mv-harvest-prompt")) return;
  const el = document.createElement("div");
  el.id = "mv-harvest-prompt";
  el.textContent = "Harvest";
  document.body.appendChild(el);
}

/** Show/hide proximity harvest prompt. */
export function setHarvestPrompt(visible, kind = "resource") {
  const el = document.getElementById("mv-harvest-prompt");
  if (!el) return;
  if (!visible) {
    el.style.display = "none";
    return;
  }
  el.style.display = "block";
  el.innerHTML = `Press <kbd>E</kbd> to harvest <strong>${escapeHtml(kind)}</strong>`;
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
