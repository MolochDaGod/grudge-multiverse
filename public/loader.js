/**
 * Grudge Multiverse production loader
 * — loyalty MP4 intro, then looping GIF until hideLoader()
 * CDN SSOT: assets.grudge-studio.com/branding/*
 */
(function () {
  const CDN = "https://assets.grudge-studio.com";
  const VIDEO_URL = CDN + "/branding/grudgestudioloyalty.mp4";
  const GIF_URL = CDN + "/branding/grudgestudioloyalty.gif";
  const LOCAL_GIF = (document.currentScript?.src || "").replace(/loader\.js.*/, "img/loader.gif");
  const fade = 700;

  if (!document.querySelector('link[href*="Cinzel"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&display=swap";
    document.head.appendChild(link);
  }

  const style = document.createElement("style");
  style.id = "__loader-style__";
  style.textContent = `
    #__loading-overlay__ {
      position: fixed; inset: 0; z-index: 99999;
      background: #05060a;
      display: flex; align-items: center; justify-content: center;
      transition: opacity ${fade}ms cubic-bezier(0.4,0,0.2,1);
    }
    #__loading-overlay__.fade-out { opacity: 0; pointer-events: none; }
    .__ldr-content__ {
      display: flex; flex-direction: column; align-items: center; gap: 18px;
      user-select: none; max-width: min(92vw, 720px); width: 100%;
    }
    .__ldr-media__ {
      width: 100%; max-width: 560px; aspect-ratio: 16/9;
      border-radius: 12px; overflow: hidden;
      border: 1px solid rgba(200,168,75,0.35);
      box-shadow: 0 0 40px rgba(200,168,75,0.12), 0 12px 40px rgba(0,0,0,0.55);
      background: #0a0c12; position: relative;
    }
    .__ldr-media__ video, .__ldr-media__ img {
      width: 100%; height: 100%; object-fit: cover; display: block;
    }
    .__ldr-media__ img { position: absolute; inset: 0; opacity: 0; transition: opacity 0.4s; }
    .__ldr-media__.show-gif video { opacity: 0; position: absolute; inset: 0; }
    .__ldr-media__.show-gif img { opacity: 1; position: relative; }
    .__ldr-title__ {
      font-family: "Cinzel", serif;
      font-size: clamp(1.1rem, 3vw, 1.75rem);
      font-weight: 900; letter-spacing: 0.12em;
      color: #e8c877; text-align: center;
    }
    .__ldr-sub__ {
      font-family: system-ui, sans-serif; font-size: 12px; color: #8a90a0;
      letter-spacing: 0.06em; text-align: center;
    }
    .__ldr-progress__ {
      width: min(100%, 320px); display: flex; flex-direction: column; align-items: center; gap: 6px;
    }
    .__ldr-track__ {
      width: 100%; height: 4px; background: rgba(255,255,255,0.08);
      border-radius: 2px; overflow: hidden;
    }
    .__ldr-fill__ {
      height: 100%; width: 8%;
      background: linear-gradient(90deg, #c8a84b, #8ec0ff);
      border-radius: 2px; transition: width 0.3s ease;
      animation: __ldr-pulse 1.4s ease-in-out infinite;
    }
    @keyframes __ldr-pulse {
      0%, 100% { filter: brightness(1); }
      50% { filter: brightness(1.25); }
    }
    .__ldr-pct__ {
      font-family: system-ui, sans-serif; font-size: 11px; color: #9aa3b5; letter-spacing: 0.08em;
    }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement("div");
  overlay.id = "__loading-overlay__";
  overlay.innerHTML = `
    <div class="__ldr-content__">
      <div class="__ldr-media__" id="__ldr-media__">
        <video id="__ldr-video__" muted playsinline autoplay preload="auto"
          poster="" src="${VIDEO_URL}"></video>
        <img id="__ldr-gif__" alt="Loading Grudge Studio" src="${GIF_URL}"
          onerror="this.src='${LOCAL_GIF || ""}'" />
      </div>
      <div class="__ldr-title__">GRUDGE MULTIVERSE</div>
      <div class="__ldr-sub__" id="__ldr-status__">Deploying world · characters · systems…</div>
      <div class="__ldr-progress__">
        <div class="__ldr-track__"><div class="__ldr-fill__" id="__ldr-fill__"></div></div>
        <div class="__ldr-pct__" id="__ldr-pct__">Starting…</div>
      </div>
    </div>`;
  document.documentElement.appendChild(overlay);

  const media = document.getElementById("__ldr-media__");
  const video = document.getElementById("__ldr-video__");
  const statusEl = document.getElementById("__ldr-status__");
  let gifMode = false;

  function showGifLoop(reason) {
    if (gifMode) return;
    gifMode = true;
    media?.classList.add("show-gif");
    try { video?.pause(); } catch { /* ignore */ }
    if (statusEl) statusEl.textContent = reason || "Loading scene systems…";
  }

  if (video) {
    video.addEventListener("ended", () => showGifLoop("Finishing world load…"));
    video.addEventListener("error", () => showGifLoop("Loading…"));
    // If load takes longer than video (~or 8s), switch to gif
    const playP = video.play?.();
    if (playP && typeof playP.catch === "function") {
      playP.catch(() => showGifLoop("Loading…"));
    }
    setTimeout(() => {
      if (!window.__mvWorldReady) showGifLoop("Still loading island & characters…");
    }, 9000);
  } else {
    showGifLoop("Loading…");
  }

  window.setLoaderProgress = function (loaded, total, label) {
    const fill = document.getElementById("__ldr-fill__");
    const pct = document.getElementById("__ldr-pct__");
    if (!fill) return;
    if (label && statusEl) statusEl.textContent = label;
    if (total > 0) {
      const p = Math.min(100, Math.round((loaded / total) * 100));
      fill.style.width = p + "%";
      fill.style.animation = "none";
      if (pct) pct.textContent = p + "%";
    } else if (typeof loaded === "number" && loaded > 0) {
      const mb = (loaded / 1048576).toFixed(1);
      fill.style.width = Math.min(95, 20 + loaded / 5e5) + "%";
      if (pct) pct.textContent = mb + " MB";
    }
  };

  window.setLoaderStatus = function (msg) {
    if (statusEl) statusEl.textContent = msg;
  };

  window.hideLoader = function () {
    window.__mvWorldReady = true;
    const el = document.getElementById("__loading-overlay__");
    if (!el) return;
    el.classList.add("fade-out");
    el.addEventListener(
      "transitionend",
      () => {
        el.remove();
        document.getElementById("__loader-style__")?.remove();
      },
      { once: true },
    );
  };
})();
