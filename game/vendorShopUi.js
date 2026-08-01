/**
 * Near-vendor shop UI — opens on E when standing at weapon/armor booth.
 */
import { VENDORS, buy } from "./vendors.js";
import { loadBag } from "./inventory.js";
import { ensureItemCatalog, iconHtml } from "./itemIcons.js";

let mounted = false;

function ensureStyles() {
  if (document.getElementById("mv-vendor-shop-css")) return;
  const s = document.createElement("style");
  s.id = "mv-vendor-shop-css";
  s.textContent = `
    #mv-vendor-shop {
      position: fixed; inset: 0; z-index: 100010;
      display: none; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);
      font-family: system-ui, sans-serif; color: #e8e4d8;
    }
    #mv-vendor-shop.open { display: flex; }
    #mv-vendor-shop .vs-card {
      width: min(440px, 94vw); max-height: min(78vh, 640px);
      background: linear-gradient(180deg, #14100a, #0c0e16);
      border: 1px solid rgba(200,168,75,0.45); border-radius: 12px;
      box-shadow: 0 16px 48px rgba(0,0,0,0.55);
      display: flex; flex-direction: column; overflow: hidden;
    }
    #mv-vendor-shop .vs-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 14px; border-bottom: 2px solid rgba(200,168,75,0.3);
      background: #14100a;
    }
    #mv-vendor-shop .vs-head h3 {
      margin: 0; font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; color: #c8a84b;
    }
    #mv-vendor-shop .vs-gold { color: #f4c542; font-size: 12px; font-weight: 700; }
    #mv-vendor-shop .vs-body { overflow-y: auto; padding: 10px 12px; flex: 1; }
    #mv-vendor-shop .vs-row {
      display: flex; align-items: center; gap: 10px; padding: 8px 10px; margin: 4px 0;
      border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); background: rgba(0,0,0,0.28);
    }
    #mv-vendor-shop .vs-row:hover { border-color: rgba(200,168,75,0.35); }
    #mv-vendor-shop .vs-meta { flex: 1; min-width: 0; }
    #mv-vendor-shop .vs-name { font-size: 13px; font-weight: 700; color: #eee; }
    #mv-vendor-shop .vs-sub { font-size: 11px; color: #888; }
    #mv-vendor-shop .vs-buy {
      border: 1px solid rgba(200,168,75,0.5); background: rgba(200,168,75,0.12);
      color: #e8c877; border-radius: 6px; padding: 6px 10px; cursor: pointer; font-size: 11px; font-weight: 700;
    }
    #mv-vendor-shop .vs-buy:disabled { opacity: 0.4; cursor: not-allowed; }
    #mv-vendor-shop .vs-close {
      border: 1px solid rgba(255,255,255,0.15); background: transparent; color: #ccc;
      border-radius: 6px; padding: 5px 10px; cursor: pointer; font-size: 12px;
    }
    #mv-vendor-prompt {
      position: fixed; bottom: 200px; left: 50%; transform: translateX(-50%);
      z-index: 9996; padding: 8px 14px; border-radius: 10px; display: none;
      background: rgba(8,12,18,0.9); border: 1px solid rgba(110,200,255,0.5);
      color: #c8e8ff; font: 600 13px system-ui; pointer-events: none;
    }
    #mv-vendor-prompt kbd {
      display: inline-block; padding: 1px 6px; border-radius: 4px;
      border: 1px solid rgba(110,200,255,0.5); background: rgba(0,0,0,0.4); font: 700 11px system-ui;
    }
  `;
  document.head.appendChild(s);
}

function ensureDom() {
  ensureStyles();
  if (!document.getElementById("mv-vendor-shop")) {
    const el = document.createElement("div");
    el.id = "mv-vendor-shop";
    el.innerHTML = `
      <div class="vs-card" role="dialog" aria-label="Vendor shop">
        <div class="vs-head">
          <div>
            <h3 id="vs-title">Vendor</h3>
            <div class="vs-gold" id="vs-gold">0g</div>
          </div>
          <button type="button" class="vs-close" id="vs-close">Close</button>
        </div>
        <div class="vs-body" id="vs-body"></div>
      </div>`;
    document.body.appendChild(el);
    el.querySelector("#vs-close")?.addEventListener("click", closeVendorShop);
    el.addEventListener("click", (e) => {
      if (e.target === el) closeVendorShop();
    });
  }
  if (!document.getElementById("mv-vendor-prompt")) {
    const p = document.createElement("div");
    p.id = "mv-vendor-prompt";
    document.body.appendChild(p);
  }
  mounted = true;
}

export function setVendorPrompt(visible, label = "Weaponsmith") {
  ensureDom();
  const p = document.getElementById("mv-vendor-prompt");
  if (!p) return;
  if (!visible) {
    p.style.display = "none";
    return;
  }
  p.style.display = "block";
  p.innerHTML = `Press <kbd>E</kbd> to trade with <strong>${escapeHtml(label)}</strong>`;
}

export function openVendorShop(vendorKey = "weapon") {
  ensureDom();
  ensureItemCatalog().catch(() => {});
  const v = VENDORS[vendorKey];
  if (!v) return;
  const bag = loadBag();
  const el = document.getElementById("mv-vendor-shop");
  const title = document.getElementById("vs-title");
  const gold = document.getElementById("vs-gold");
  const body = document.getElementById("vs-body");
  if (title) title.textContent = v.name;
  if (gold) gold.textContent = `${bag.gold || 0} gold`;
  if (body) {
    body.innerHTML = v.stock
      .map((s) => {
        const can = (bag.gold || 0) >= s.price;
        const stat =
          s.dmg != null ? `${s.dmg} dmg` : s.armor != null ? `${s.armor} armor` : `T${s.tier}`;
        return `<div class="vs-row">
          ${iconHtml(s.id, 32, s.name)}
          <div class="vs-meta">
            <div class="vs-name">${escapeHtml(s.name)}</div>
            <div class="vs-sub">${stat} · T${s.tier}</div>
          </div>
          <button type="button" class="vs-buy" data-v="${vendorKey}" data-item="${s.id}" ${can ? "" : "disabled"}>
            ${s.price}g
          </button>
        </div>`;
      })
      .join("");
    body.querySelectorAll(".vs-buy").forEach((btn) => {
      btn.addEventListener("click", () => {
        const res = buy(btn.getAttribute("data-v"), btn.getAttribute("data-item"));
        if (res.ok) {
          window.dispatchEvent(new CustomEvent("mv-bag", { detail: res.bag }));
          openVendorShop(vendorKey);
        } else if (res.error === "gold") {
          btn.textContent = "Need gold";
        }
      });
    });
  }
  el?.classList.add("open");
}

export function closeVendorShop() {
  document.getElementById("mv-vendor-shop")?.classList.remove("open");
}

export function isVendorShopOpen() {
  return !!document.getElementById("mv-vendor-shop")?.classList.contains("open");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
