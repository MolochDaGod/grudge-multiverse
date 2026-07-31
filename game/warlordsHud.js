/**
 * Danger Room / Warlords control HUD — replaces FPS gun legend.
 */
export function mountWarlordsHud() {
  const el = document.querySelector(".hud");
  if (el) {
    el.innerHTML = `
      <div class="row"><span class="hint-text">Move</span> <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>
        <span class="hud-sep"></span><span class="hint-text">Sprint</span> <kbd>Shift</kbd>
        <span class="hud-sep"></span><span class="hint-text">Jump</span> <kbd>Space</kbd></div>
      <div class="row"><span class="hint-text">Attack</span> <kbd>F</kbd>
        <span class="hud-sep"></span><span class="hint-text">Skills</span> <kbd>⇧1</kbd>–<kbd>⇧5</kbd>
        <span class="hud-sep"></span><span class="hint-text">Harvest</span> <kbd>E</kbd></div>
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
}

export function setNetStatus(text, ok) {
  const net = document.getElementById("mv-net-status");
  if (!net) return;
  net.textContent = text;
  net.style.borderColor = ok ? "rgba(80,200,120,0.5)" : "rgba(200,168,75,0.35)";
  net.style.color = ok ? "#6eec9a" : "#aaa";
}
