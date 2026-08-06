/**
 * Multiverse UI theme — gametest RPG UI + Desktop sloticons + Kenney cursors.
 *
 * Sources (local public copies):
 *   /ui/gametest/*     ← Character-Animator-Mapper gametest dist UI
 *   /ui/sloticons/*    ← Desktop grudgeproduction/icons/sloticons
 *   /ui/cursors/*      ← Kenney cursor pack + gametest Cursor_Normal
 *
 * Cursor modes for gameplay hover (not a second HUD stack).
 */
const BASE = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) || "/";
const root = BASE.replace(/\/?$/, "/");

export const UI = {
  slotBg: `${root}ui/gametest/inventory/Inventory_Slot_Background.png`,
  spellSlot: `${root}ui/gametest/spellbook/SpellBook_Spell_Slot_Background.png`,
  spellOverlay: `${root}ui/gametest/spellbook/SpellBook_Spell_Slot_Overlay.png`,
  actionBar: `${root}ui/gametest/actionbar/ActionBar_Main_Background.png`,
  btnBg: `${root}ui/gametest/buttons/Button_RM_Background.png`,
  btnHover: `${root}ui/gametest/buttons/Button_RM_Hover_Red.png`,
  btnPress: `${root}ui/gametest/buttons/Button_RM_Press.png`,
  menuBg: `${root}ui/gametest/menu/GameMenu_Background.png`,
  menuBtn: `${root}ui/gametest/menu/GameMenu_Button_Foreground_Yellow.png`,
  menuBtnHover: `${root}ui/gametest/menu/GameMenu_Button_Hover_Yellow.png`,
  textBox: `${root}ui/gametest/text/TextBox_Background.png`,
  textWarn: `${root}ui/gametest/text/TextBox_Warning_Background.png`,
  castBarBg: `${root}ui/gametest/castbar/CastBar_Background.png`,
  castBarFill: `${root}ui/gametest/castbar/CastBar_Bar_Fill.png`,
  modalBg: `${root}ui/gametest/modal/ModalBox_Background.png`,
  modalClose: `${root}ui/gametest/modal/ModalBox_CloseButton_Background.png`,
  modalCloseHover: `${root}ui/gametest/modal/ModalBox_CloseButton_Hover.png`,
  notify: `${root}ui/gametest/modal/Notification_Background.png`,
  sliderBg: `${root}ui/gametest/slider/Slider_Horizontal_Background.png`,
  sliderFill: `${root}ui/gametest/slider/Slider_Horizontal_Bar_Fill_Green.png`,
  sliderHandle: `${root}ui/gametest/slider/Slider_Horizontal_Handle.png`,
  coinGold: `${root}ui/gametest/inventory/Coin_Gold.png`,
};

/** Kenney / gametest cursor URLs by gameplay mode */
export const CURSORS = {
  default: `${root}ui/cursors/pointer_b.png`,
  pointer: `${root}ui/cursors/pointer_a.png`,
  combat: `${root}ui/cursors/tool_sword_a.png`,
  magic: `${root}ui/cursors/tool_wand.png`,
  bow: `${root}ui/cursors/tool_bow.png`,
  harvest: `${root}ui/cursors/tool_axe.png`,
  mine: `${root}ui/cursors/tool_pickaxe.png`,
  interact: `${root}ui/cursors/hand_thin_point.png`,
  hand: `${root}ui/cursors/hand_thin_open.png`,
  target: `${root}ui/cursors/target_a.png`,
  targetHostile: `${root}ui/cursors/target_b.png`,
  disabled: `${root}ui/cursors/cursor_disabled.png`,
  busy: `${root}ui/cursors/cursor_busy.png`,
  help: `${root}ui/cursors/cursor_help.png`,
  menu: `${root}ui/cursors/cursor_menu.png`,
  loot: `${root}ui/cursors/hand_open.png`,
  vendor: `${root}ui/cursors/hand_point.png`,
};

/** Action slot icons (Desktop sloticons) */
export const SLOT_ICONS = {
  attack: `${root}ui/sloticons/attack.png`,
  defend: `${root}ui/sloticons/defend.png`,
  guard: `${root}ui/sloticons/guard.png`,
  charge: `${root}ui/sloticons/charge.png`,
  harvest: `${root}ui/sloticons/harvest.png`,
  equip: `${root}ui/sloticons/equip.png`,
  inventory: `${root}ui/sloticons/inventory.png`,
  skills: `${root}ui/sloticons/scriptable-skills.png`,
  skillSlot: `${root}ui/sloticons/skill-slot.png`,
  settings: `${root}ui/sloticons/hud-settings.png`,
  trade: `${root}ui/sloticons/trade.png`,
  rest: `${root}ui/sloticons/rest.png`,
  retreat: `${root}ui/sloticons/retreat.png`,
  move: `${root}ui/sloticons/move.png`,
  physics: `${root}ui/sloticons/physics.png`,
};

export const SPELL_ICONS = {
  fireball: `${root}ui/gametest/icons128/Icon_Fireball_128.png`,
  shield: `${root}ui/gametest/icons128/Icon_Shield_128.png`,
  sword: `${root}ui/gametest/icons128/Icon_Sword_128.png`,
  leafs: `${root}ui/gametest/icons128/Icon_Leafs_128.png`,
  death: `${root}ui/gametest/icons128/Icon_Deathkiss_128.png`,
  arrows: `${root}ui/gametest/icons128/Icon_Arrows_128.png`,
};

let _mode = "default";
let _stylesInjected = false;

export function setGameCursor(mode = "default") {
  const url = CURSORS[mode] || CURSORS.default;
  _mode = mode;
  document.documentElement.style.setProperty("--mv-cursor", `url("${url}") 4 2, auto`);
  document.body.style.cursor = `url("${url}") 4 2, auto`;
  const canvas = document.querySelector("canvas");
  if (canvas) canvas.style.cursor = `url("${url}") 4 2, auto`;
  return mode;
}

export function getGameCursor() {
  return _mode;
}

/**
 * Pick cursor from hover context (combat soft-lock / harvest / vendor).
 * @param {{ hostile?: boolean, harvest?: boolean, vendor?: boolean, loot?: boolean, ui?: boolean, busy?: boolean, classId?: string }} ctx
 */
export function cursorFromContext(ctx = {}) {
  if (ctx.busy) return setGameCursor("busy");
  if (ctx.ui) return setGameCursor("pointer");
  if (ctx.vendor) return setGameCursor("vendor");
  if (ctx.loot) return setGameCursor("loot");
  if (ctx.harvest) return setGameCursor("harvest");
  if (ctx.hostile) return setGameCursor("targetHostile");
  if (ctx.classId === "mage") return setGameCursor("magic");
  if (ctx.classId === "ranger") return setGameCursor("bow");
  return setGameCursor("combat");
}

export function ensureMvUiTheme() {
  if (_stylesInjected) return;
  _stylesInjected = true;
  const s = document.createElement("style");
  s.id = "mv-ui-theme";
  s.textContent = `
    :root {
      --mv-cursor: url("${CURSORS.default}") 4 2, auto;
      --mv-slot-bg: url("${UI.slotBg}");
      --mv-spell-slot: url("${UI.spellSlot}");
      --mv-btn-bg: url("${UI.btnBg}");
      --mv-btn-hover: url("${UI.btnHover}");
      --mv-text-box: url("${UI.textBox}");
      --mv-gold: #e8c877;
      --mv-panel: rgba(8,10,16,0.88);
    }
    body, canvas { cursor: var(--mv-cursor); }
    .mv-slot {
      background-image: var(--mv-slot-bg);
      background-size: 100% 100%;
      background-repeat: no-repeat;
      image-rendering: auto;
      border: 1px solid rgba(200,168,75,0.25);
      border-radius: 6px;
      transition: transform 0.08s ease, box-shadow 0.12s ease, filter 0.12s;
    }
    .mv-slot:hover, .mv-slot.mv-hover {
      transform: translateY(-2px) scale(1.04);
      box-shadow: 0 0 12px rgba(232,200,119,0.45);
      filter: brightness(1.12);
      cursor: url("${CURSORS.pointer}") 4 2, pointer;
    }
    .mv-slot:active { transform: scale(0.96); filter: brightness(0.9); }
    .mv-btn-rpg {
      background: var(--mv-btn-bg) center/100% 100% no-repeat;
      border: none; color: #f5e6c8; font-weight: 700;
      padding: 10px 18px; min-width: 96px; cursor: url("${CURSORS.pointer}") 4 2, pointer;
      text-shadow: 0 1px 2px #000;
    }
    .mv-btn-rpg:hover { background-image: var(--mv-btn-hover); filter: brightness(1.08); }
    .mv-btn-rpg:active { background-image: url("${UI.btnPress}"); }
    .mv-tooltip {
      position: fixed; z-index: 12000; pointer-events: none;
      max-width: 280px; padding: 10px 12px;
      background: var(--mv-text-box) center/100% 100% no-repeat, var(--mv-panel);
      color: #eee; font: 12px/1.4 system-ui,sans-serif;
      border: 1px solid rgba(200,168,75,0.35); border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.55);
      opacity: 0; transform: translateY(4px); transition: opacity 0.12s, transform 0.12s;
    }
    .mv-tooltip.show { opacity: 1; transform: translateY(0); }
    .mv-tooltip .tt-title { color: var(--mv-gold); font-weight: 700; margin-bottom: 4px; }
    .mv-tooltip .tt-body { color: #c8c8c8; font-size: 11px; }
    .mv-castbar {
      position: fixed; left: 50%; bottom: 22%; transform: translateX(-50%);
      width: min(360px, 50vw); height: 28px; z-index: 9000;
      background: url("${UI.castBarBg}") center/100% 100% no-repeat;
      display: none; align-items: center; padding: 4px 8px;
    }
    .mv-castbar.show { display: flex; }
    .mv-castbar .fill {
      height: 14px; border-radius: 3px;
      background: url("${UI.castBarFill}") left/cover no-repeat, linear-gradient(90deg,#c478ff,#7ec8ff);
      transition: width 0.05s linear;
    }
    .mv-castbar .label {
      position: absolute; left: 0; right: 0; text-align: center;
      font: 11px system-ui; color: #fff; text-shadow: 0 1px 2px #000; pointer-events: none;
    }
    #mv-game-menu {
      position: fixed; inset: 0; z-index: 13000; display: none;
      place-items: center; background: rgba(0,0,0,0.55);
    }
    #mv-game-menu.open { display: grid; }
    #mv-game-menu .panel {
      width: min(420px, 92vw); min-height: 320px; padding: 48px 36px 36px;
      background: url("${UI.menuBg}") center/cover no-repeat, #0c1018;
      border: 1px solid rgba(200,168,75,0.4); border-radius: 12px;
      display: flex; flex-direction: column; gap: 12px; align-items: stretch;
    }
    #mv-game-menu h2 {
      margin: 0 0 8px; text-align: center; color: var(--mv-gold);
      font: 700 22px/1.2 Georgia, serif; text-shadow: 0 2px 4px #000;
    }
    #mv-game-menu button.menu-item {
      background: url("${UI.menuBtn}") center/100% 100% no-repeat;
      border: none; color: #1a1208; font-weight: 800; font-size: 15px;
      padding: 14px 12px; cursor: url("${CURSORS.pointer}") 4 2, pointer;
    }
    #mv-game-menu button.menu-item:hover {
      background-image: url("${UI.menuBtnHover}");
      filter: brightness(1.06);
    }
    .tb-slot, .mp-hb-slot, .sk-slot {
      background-image: var(--mv-spell-slot), var(--mv-slot-bg) !important;
      background-size: 100% 100% !important;
      background-repeat: no-repeat !important;
    }
    .tb-slot:hover, .mp-hb-slot:hover, .sk-slot:hover {
      filter: brightness(1.15) drop-shadow(0 0 6px rgba(232,200,119,0.5));
      cursor: url("${CURSORS.pointer}") 4 2, pointer;
    }
    #mv-combat-frame .cf-bar {
      background: url("${UI.sliderBg}") center/100% 100% no-repeat, rgba(0,0,0,0.5);
    }
    #mv-combat-frame .cf-bar > i {
      background: url("${UI.sliderFill}") left/cover no-repeat, linear-gradient(90deg,#8b2020,#e85d5d) !important;
    }
  `;
  document.head.appendChild(s);
  setGameCursor("default");
}

/** Floating tooltip (title + body) following pointer */
export function showTooltip(title, body, x, y) {
  let el = document.getElementById("mv-tooltip");
  if (!el) {
    el = document.createElement("div");
    el.id = "mv-tooltip";
    el.className = "mv-tooltip";
    document.body.appendChild(el);
  }
  el.innerHTML = `<div class="tt-title"></div><div class="tt-body"></div>`;
  el.querySelector(".tt-title").textContent = title || "";
  el.querySelector(".tt-body").textContent = body || "";
  const pad = 14;
  el.style.left = `${Math.min(window.innerWidth - 300, x + pad)}px`;
  el.style.top = `${Math.min(window.innerHeight - 80, y + pad)}px`;
  el.classList.add("show");
}

export function hideTooltip() {
  document.getElementById("mv-tooltip")?.classList.remove("show");
}

/** Bind [data-tip] hover tooltips */
export function bindTooltipDelegation(root = document.body) {
  root.addEventListener("pointerover", (e) => {
    const t = e.target?.closest?.("[data-tip]");
    if (!t) return;
    const title = t.getAttribute("data-tip-title") || t.getAttribute("title") || "";
    const body = t.getAttribute("data-tip") || "";
    showTooltip(title, body, e.clientX, e.clientY);
  });
  root.addEventListener("pointermove", (e) => {
    const el = document.getElementById("mv-tooltip");
    if (!el?.classList.contains("show")) return;
    el.style.left = `${Math.min(window.innerWidth - 300, e.clientX + 14)}px`;
    el.style.top = `${Math.min(window.innerHeight - 80, e.clientY + 14)}px`;
  });
  root.addEventListener("pointerout", (e) => {
    if (!e.target?.closest?.("[data-tip]")) return;
    if (e.relatedTarget?.closest?.("[data-tip]")) return;
    hideTooltip();
  });
}

/** Cast bar for spells / long skills */
export function showCastBar(label, durationMs = 800) {
  let el = document.getElementById("mv-castbar");
  if (!el) {
    el = document.createElement("div");
    el.id = "mv-castbar";
    el.className = "mv-castbar";
    el.innerHTML = `<div class="fill" style="width:0%"></div><div class="label"></div>`;
    document.body.appendChild(el);
  }
  el.classList.add("show");
  el.querySelector(".label").textContent = label || "Casting…";
  const fill = el.querySelector(".fill");
  const t0 = performance.now();
  const tick = (now) => {
    const u = Math.min(1, (now - t0) / durationMs);
    fill.style.width = `${u * 100}%`;
    if (u < 1) requestAnimationFrame(tick);
    else setTimeout(() => el.classList.remove("show"), 80);
  };
  requestAnimationFrame(tick);
}

/** ESC game menu (resume / bag / settings-ish) */
export function mountGameMenu(handlers = {}) {
  ensureMvUiTheme();
  let el = document.getElementById("mv-game-menu");
  if (!el) {
    el = document.createElement("div");
    el.id = "mv-game-menu";
    el.innerHTML = `
      <div class="panel" role="dialog" aria-label="Game menu">
        <h2>Grudge Multiverse</h2>
        <button type="button" class="menu-item" data-act="resume">Resume</button>
        <button type="button" class="menu-item" data-act="bag">Inventory</button>
        <button type="button" class="menu-item" data-act="skills">Spell Book</button>
        <button type="button" class="menu-item" data-act="help">Controls (F1)</button>
      </div>`;
    document.body.appendChild(el);
    el.addEventListener("click", (e) => {
      if (e.target === el) {
        el.classList.remove("open");
        return;
      }
      const act = e.target?.closest?.("[data-act]")?.getAttribute("data-act");
      if (!act) return;
      if (act === "resume") el.classList.remove("open");
      handlers[act]?.();
      if (act !== "resume") el.classList.remove("open");
    });
  }
  if (!window.__mvMenuBound) {
    window.__mvMenuBound = true;
    document.addEventListener("keydown", (e) => {
      if (e.code !== "Escape" || e.repeat) return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      // Don't steal Escape from vendor shop
      if (document.getElementById("vendor-shop")?.style?.display === "block") return;
      e.preventDefault();
      el.classList.toggle("open");
      if (el.classList.contains("open")) setGameCursor("menu");
      else setGameCursor("combat");
    });
  }
  return {
    open: () => el.classList.add("open"),
    close: () => el.classList.remove("open"),
    toggle: () => el.classList.toggle("open"),
  };
}

/** Map skill kind → spell/slot icon for hotbar */
export function actionIconForSkill(skill, classId) {
  if (!skill) return SLOT_ICONS.skillSlot;
  const k = `${skill.kind || ""} ${skill.id || ""} ${skill.name || ""}`.toLowerCase();
  if (/fire|meteor|flame|burn/.test(k)) return SPELL_ICONS.fireball;
  if (/shield|block|fortify|guard|parry/.test(k)) return SPELL_ICONS.shield;
  if (/arrow|shot|volley|bow|rain/.test(k)) return SPELL_ICONS.arrows;
  if (/heal|nature|leaf|plant/.test(k)) return SPELL_ICONS.leafs;
  if (/execute|death|rend|smash|nuke/.test(k)) return SPELL_ICONS.death;
  if (/slash|cleave|melee|sword|attack|basic/.test(k) || skill.key === "KeyF")
    return classId === "mage" ? SPELL_ICONS.fireball : SPELL_ICONS.sword;
  return SLOT_ICONS.attack;
}
