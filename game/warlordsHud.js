/**
 * Warlords / Danger-style control HUD — replaces FPS gun key legend.
 */
export function mountWarlordsHud() {
  const el = document.querySelector(".hud");
  if (!el) return;
  el.innerHTML = `
    <div class="row"><span class="hint-text">Move</span> <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>
      <span class="hud-sep"></span><span class="hint-text">Sprint</span> <kbd>Shift</kbd>
      <span class="hud-sep"></span><span class="hint-text">Jump</span> <kbd>Space</kbd></div>
    <div class="row"><span class="hint-text">Skill</span> <kbd>F</kbd>
      <span class="hud-sep"></span><span class="hint-text">Skills</span> <kbd>⇧1</kbd>–<kbd>⇧5</kbd>
      <span class="hud-sep"></span><span class="hint-text">Harvest</span> <kbd>E</kbd></div>
    <div class="row"><span class="hint-text">Select</span> <kbd>LMB</kbd>
      <span class="hud-sep"></span><span class="hint-text">Focus soft-lock</span> <kbd>RMB</kbd>
      <span class="hud-sep"></span><span class="hint-text">Panel</span> <kbd>I</kbd>
      <span class="hud-sep"></span><span class="hint-text">Chat</span> <kbd>Enter</kbd></div>
  `;
  el.setAttribute("aria-label", "Warlords controls");

  // Soft-lock crosshair (hidden until focus)
  let ch = document.getElementById("crosshair");
  if (ch) {
    ch.style.width = "14px";
    ch.style.height = "14px";
    ch.style.borderRadius = "50%";
    ch.style.border = "2px solid rgba(232,200,119,0.9)";
    ch.style.background = "transparent";
    ch.style.boxShadow = "0 0 8px rgba(0,0,0,0.5)";
  }

  // Hide gun HUD panels in warlords
  const br = document.getElementById("br-panel");
  if (br) br.style.display = "none";
  const ammo = document.getElementById("ammo-panel");
  if (ammo) ammo.style.display = "none";
}
