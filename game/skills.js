/**
 * Class skill hotkeys: F + Shift+1..5
 * Combat hotbar with ObjectStore icons (info.grudge-studio.com item catalog).
 */
import { unlockedSkills } from "./classes.js";
import { ensureItemCatalog, skillIconUrl } from "./itemIcons.js";

export class SkillBar {
  constructor(classDef, getLevel, opts = {}) {
    this.classDef = classDef;
    this.getLevel = getLevel;
    this.opts = opts;
    this.cds = new Map();
    this.el = null;
    this._cdTimer = null;
    ensureItemCatalog().then(() => this.mountHud());
  }

  bind() {
    document.addEventListener("keydown", this._onKey);
    this.mountHud();
    // Refresh CD overlays
    this._cdTimer = setInterval(() => this.mountHud(), 200);
  }

  unbind() {
    document.removeEventListener("keydown", this._onKey);
    if (this._cdTimer) clearInterval(this._cdTimer);
  }

  _onKey = (e) => {
    if (e.repeat) return;
    // Don't steal keys while typing in chat / panel inputs
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;

    const level = this.getLevel();
    const skills = unlockedSkills(this.classDef, level);
    let skill = null;
    if (e.code === "KeyF" && !e.shiftKey) {
      skill = skills.find((s) => s.key === "KeyF");
    } else if (e.shiftKey && /^Digit[1-5]$/.test(e.code)) {
      skill = skills.find((s) => s.shift && s.key === e.code);
    }
    if (!skill) return;
    e.preventDefault();
    this.cast(skill);
  };

  cast(skill) {
    const now = performance.now();
    const ready = this.cds.get(skill.id) || 0;
    if (now < ready) {
      this.opts.flash?.(`CD ${((ready - now) / 1000).toFixed(1)}s`, 0.3);
      return false;
    }
    this.cds.set(skill.id, now + (skill.cd || 1) * 1000);
    this.opts.onCast?.(skill);
    this.opts.flash?.(`${skill.name}!`, 0.5);
    this.mountHud();
    return true;
  }

  mountHud() {
    let el = document.getElementById("skill-hotbar");
    if (!el) {
      el = document.createElement("div");
      el.id = "skill-hotbar";
      el.setAttribute("aria-label", "Combat skill bar");
      document.body.appendChild(el);
    }
    const level = this.getLevel();
    const skills = unlockedSkills(this.classDef, level);
    const now = performance.now();
    const classId = this.classDef?.id;
    el.innerHTML = skills
      .map((s) => {
        const left = Math.max(0, (this.cds.get(s.id) || 0) - now);
        const key = s.key === "KeyF" ? "F" : s.key.replace("Digit", "⇧");
        const icon = skillIconUrl(s, classId);
        const iconHtml = icon
          ? `<img class="sk-icon" src="${icon}" alt="" width="28" height="28" loading="lazy" />`
          : `<span class="sk-icon-fallback">${(s.name || "?").slice(0, 2)}</span>`;
        const pct = left > 0 ? Math.min(100, (left / ((s.cd || 1) * 1000)) * 100) : 0;
        return `<div class="sk-slot ${left > 0 ? "on-cd" : ""}" title="${s.name} · ${s.kind}">
          ${iconHtml}
          <span class="sk-key">${key}</span>
          <span class="sk-name">${s.name}</span>
          ${left > 0 ? `<span class="sk-cd">${(left / 1000).toFixed(1)}</span><span class="sk-cd-fill" style="height:${pct}%"></span>` : ""}
        </div>`;
      })
      .join("");
    this.el = el;
    this.ensureStyles();
  }

  ensureStyles() {
    if (document.getElementById("mv-skillbar-css")) return;
    const s = document.createElement("style");
    s.id = "mv-skillbar-css";
    s.textContent = `
      #skill-hotbar {
        position: fixed; bottom: 88px; left: 50%; transform: translateX(-50%);
        z-index: 9995; display: flex; gap: 8px; pointer-events: none;
      }
      #skill-hotbar .sk-slot {
        position: relative; width: 56px; height: 56px; border-radius: 10px;
        border: 1px solid rgba(200,168,75,0.5); background: rgba(8,10,16,0.9);
        box-shadow: 0 4px 16px rgba(0,0,0,0.45); overflow: hidden;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
      }
      #skill-hotbar .sk-slot.on-cd { opacity: 0.75; }
      #skill-hotbar .sk-icon { width: 28px; height: 28px; object-fit: contain; image-rendering: auto; }
      #skill-hotbar .sk-icon-fallback {
        width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
        font: 700 11px system-ui; color: #e8c877; background: rgba(200,168,75,0.12); border-radius: 6px;
      }
      #skill-hotbar .sk-key {
        position: absolute; top: 2px; left: 4px; font: 700 9px system-ui; color: #e8c877;
        text-shadow: 0 1px 2px #000;
      }
      #skill-hotbar .sk-name {
        position: absolute; bottom: 2px; left: 0; right: 0; text-align: center;
        font: 600 8px system-ui; color: #ccc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        padding: 0 2px;
      }
      #skill-hotbar .sk-cd {
        position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
        font: 700 12px system-ui; color: #fff; z-index: 2; text-shadow: 0 1px 3px #000;
      }
      #skill-hotbar .sk-cd-fill {
        position: absolute; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.55); z-index: 1;
      }
    `;
    document.head.appendChild(s);
  }
}
