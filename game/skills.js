/**
 * Class skill hotkeys: F + Shift+1..5
 */
import { unlockedSkills } from "./classes.js";

export class SkillBar {
  constructor(classDef, getLevel, opts = {}) {
    this.classDef = classDef;
    this.getLevel = getLevel;
    this.opts = opts;
    this.cds = new Map();
    this.el = null;
  }

  bind() {
    document.addEventListener("keydown", this._onKey);
    this.mountHud();
  }

  unbind() {
    document.removeEventListener("keydown", this._onKey);
  }

  _onKey = (e) => {
    if (e.repeat) return;
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
      this.opts.flash?.(`CD ${( (ready - now) / 1000).toFixed(1)}s`, 0.3);
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
      el.style.cssText =
        "position:fixed;bottom:90px;left:50%;transform:translateX(-50%);z-index:9995;display:flex;gap:6px;pointer-events:none;";
      document.body.appendChild(el);
    }
    const level = this.getLevel();
    const skills = unlockedSkills(this.classDef, level);
    const now = performance.now();
    el.innerHTML = skills
      .map((s) => {
        const left = Math.max(0, (this.cds.get(s.id) || 0) - now);
        const key = s.key === "KeyF" ? "F" : s.key.replace("Digit", "⇧");
        return `<div style="width:48px;height:48px;border-radius:8px;border:1px solid rgba(200,168,75,0.45);background:rgba(10,12,20,0.85);color:#e8c877;font:11px system-ui;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:${left > 0 ? 0.45 : 1}">
          <span style="font-size:9px;color:#888">${key}</span>
          <span style="font-weight:700;font-size:10px;text-align:center;line-height:1.1;padding:0 2px">${s.name}</span>
          ${left > 0 ? `<span style="font-size:9px">${(left / 1000).toFixed(1)}</span>` : ""}
        </div>`;
      })
      .join("");
    this.el = el;
  }
}
