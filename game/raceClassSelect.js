/**
 * Two-step gate: Race → Class (fleet gear_presets), then name + Enter World.
 * Danger Room style select before systems boot.
 */
import { RACES, CLASS_PRESETS, getPreset, getRace, saveSelection, loadSelection } from "./fleetGearPresets.js";

/**
 * Mount race → class UI into #char-picker + #name-form.
 * @returns {{ getRaceId: () => string, getClassId: () => string, getSelection: () => object }}
 */
export function setupRaceClassSelectUI() {
  const picker = document.getElementById("char-picker");
  const form = document.getElementById("name-form");
  if (!picker) {
    return {
      getRaceId: () => loadSelection().raceId,
      getClassId: () => loadSelection().classId,
      getSelection: loadSelection,
    };
  }

  const saved = loadSelection();
  let step = "race"; // race | class
  let raceId = saved.raceId;
  let classId = saved.classId;

  const stepEl = document.createElement("div");
  stepEl.id = "select-step-bar";
  stepEl.style.cssText =
    "grid-column:1/-1;display:flex;gap:8px;align-items:center;margin-bottom:4px;font-size:11px;color:#8a90a0;";
  if (!document.getElementById("select-step-bar")) {
    picker.parentElement?.insertBefore(stepEl, picker);
  }

  function updateStepBar() {
    const bar = document.getElementById("select-step-bar") || stepEl;
    const race = getRace(raceId);
    bar.innerHTML = `
      <span class="${step === "race" ? "on" : ""}" style="color:${step === "race" ? "#c8a84b" : "#666"};font-weight:700">1 Race</span>
      <span>→</span>
      <span class="${step === "class" ? "on" : ""}" style="color:${step === "class" ? "#c8a84b" : "#666"};font-weight:700">2 Class</span>
      <span style="margin-left:auto;color:#c8a84b">${race.label}${step === "class" ? " · " + (getPreset(raceId, classId)?.label || "") : ""}</span>`;
  }

  function renderRaceStep() {
    step = "race";
    picker.style.gridTemplateColumns = "repeat(2, 1fr)";
    picker.innerHTML = "";
    RACES.forEach((r) => {
      const card = document.createElement("div");
      card.className = "char-card" + (r.id === raceId ? " selected" : "");
      card.dataset.raceId = r.id;
      card.innerHTML = `
        <div class="char-avatar" style="display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,#1a2030,${r.color}33);color:${r.color};font-size:20px;font-weight:800;">
          ${r.label.slice(0, 1)}
        </div>
        <span class="char-name">${r.label}</span>`;
      card.title = r.label;
      card.addEventListener("click", () => {
        raceId = r.id;
        // keep class if valid for race
        const p = getPreset(raceId, classId);
        classId = p.id;
        saveSelection(raceId, classId);
        renderClassStep();
      });
      picker.appendChild(card);
    });
    updateStepBar();
    updateConfirmLabel();
  }

  function renderClassStep() {
    step = "class";
    picker.style.gridTemplateColumns = "repeat(2, 1fr)";
    picker.innerHTML = "";
    const back = document.createElement("div");
    back.className = "char-divider";
    back.style.cursor = "pointer";
    back.textContent = "← Change race";
    back.addEventListener("click", renderRaceStep);
    picker.appendChild(back);

    CLASS_PRESETS.forEach((c) => {
      const preset = getPreset(raceId, c.id);
      const card = document.createElement("div");
      card.className = "char-card" + (c.id === classId ? " selected" : "");
      card.dataset.classId = c.id;
      card.innerHTML = `
        <div class="char-avatar" style="display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,#1a2030,#0d1018);color:#c8a84b;font-size:18px;font-weight:800;">
          ${preset.label.slice(0, 1)}
        </div>
        <span class="char-name">${preset.label}</span>`;
      card.title = c.blurb;
      card.addEventListener("click", () => {
        classId = c.id;
        saveSelection(raceId, classId);
        picker.querySelectorAll(".char-card").forEach((x) => x.classList.remove("selected"));
        card.classList.add("selected");
        updateStepBar();
        updateConfirmLabel();
      });
      picker.appendChild(card);
    });
    updateStepBar();
    updateConfirmLabel();
  }

  function updateConfirmLabel() {
    const btn = document.getElementById("name-confirm");
    if (!btn) return;
    if (step === "race") {
      btn.textContent = "Next · Class";
    } else {
      const p = getPreset(raceId, classId);
      btn.textContent = `Enter · ${getRace(raceId).label} ${p.label}`;
    }
  }

  // Intercept confirm: race step → class step; class step → allow form submit
  const btn = document.getElementById("name-confirm");
  const title = form?.querySelector(".nd-title");
  if (title) title.textContent = "Grudge Multiverse";
  const sub = form?.querySelector(".nd-sub") || form?.querySelector("[style*='font-size:11px']");
  if (sub) sub.textContent = "Race → Class → Danger systems";

  renderRaceStep();

  return {
    getRaceId: () => raceId,
    getClassId: () => classId,
    getSelection: () => ({ raceId, classId }),
    /** Call from confirm handler: returns true if ready to enter world */
    advanceOrReady() {
      if (step === "race") {
        renderClassStep();
        return false;
      }
      saveSelection(raceId, classId);
      return true;
    },
    goRace: renderRaceStep,
    goClass: renderClassStep,
  };
}
