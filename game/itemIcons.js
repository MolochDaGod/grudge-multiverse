/**
 * Item / skill icons — fleet catalog + resilient fallbacks.
 * Catalog SSOT: info.grudge-studio.com/api/v1/master-items.json
 * Binary icons often 404 on github.io — map to Open public icons + glyph chips.
 */

export const MASTER_ITEMS_URL = "https://info.grudge-studio.com/api/v1/master-items.json";
export const MASTER_ITEMS_FALLBACK =
  "https://assets.grudge-studio.com/api/v1/grudge6-gear-presets.json";
/** Open ships a stable icon pack used by Danger Room. */
export const OPEN_ICONS = "https://gameopen.vercel.app/icons";

/** @type {Map<string, { id: string, name: string, iconUrl: string, tier?: number, type?: string }>} */
const byId = new Map();
/** @type {Map<string, { id: string, name: string, iconUrl: string }>} */
const byName = new Map();

let loadPromise = null;
let loaded = false;

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/** Prefer Open icons; rewrite dead github ObjectStore hosts. */
export function rewriteIconUrl(url, hint = "") {
  if (!url || typeof url !== "string") return localIconFor(hint);
  if (/molochdagod\.github\.io|raw\.githubusercontent\.com.*ObjectStore/i.test(url)) {
    return localIconFor(hint || url);
  }
  return url;
}

function localIconFor(hint) {
  const h = String(hint || "").toLowerCase();
  if (/bow|longbow|arrow|ranger|yew/.test(h)) return `${OPEN_ICONS}/attack.png`;
  if (/staff|mage|magic|arcane|bolt|meteor/.test(h)) return `${OPEN_ICONS}/charge.png`;
  if (/axe|worge|smash|cleave/.test(h)) return `${OPEN_ICONS}/ambush.png`;
  if (/shield|block|fortify|guard|bash/.test(h)) return `${OPEN_ICONS}/defend.png`;
  if (/sword|slash|blade|melee|execute|rend/.test(h)) return `${OPEN_ICONS}/attack.png`;
  if (/wood|tree|harvest|plant/.test(h)) return `${OPEN_ICONS}/harvest.png`;
  if (/stone|ore|rock|scrap|mine/.test(h)) return `${OPEN_ICONS}/build.png`;
  if (/armor|mail|leather|robe|hide|chest/.test(h)) return `${OPEN_ICONS}/equip.png`;
  if (/gold|coin|currency/.test(h)) return `${OPEN_ICONS}/loot.png`;
  if (/skill|buff|howl|cry|enrage|mark/.test(h)) return `${OPEN_ICONS}/combat-pad.png`;
  return `${OPEN_ICONS}/gear-trial.png`;
}

function indexItem(it) {
  if (!it) return;
  const id = it.id || it.uuid;
  const name = it.name || it.baseName || id;
  const rawIcon = it.iconUrl || it.icon || it.image || "";
  const iconUrl = rewriteIconUrl(rawIcon, `${id} ${name} ${it.category || ""} ${it.weaponType || ""}`);
  const row = {
    id,
    name,
    iconUrl,
    tier: it.tier,
    type: it.type || it.category,
  };
  if (id) {
    byId.set(String(id).toLowerCase(), row);
    byId.set(norm(id), row);
    byId.set(String(id).toLowerCase().replace(/-/g, "_"), row);
    byId.set(String(id).toLowerCase().replace(/_/g, "-"), row);
  }
  if (row.name) byName.set(norm(row.name), row);
}

export async function ensureItemCatalog() {
  if (loaded) return true;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    seedLocalFallbacks();
    try {
      const res = await fetch(MASTER_ITEMS_URL, { mode: "cors" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items = data.items || data.weapons || (Array.isArray(data) ? data : []);
      if (Array.isArray(items)) {
        for (const it of items) indexItem(it);
      }
      loaded = true;
      console.info(`[itemIcons] indexed catalog keys=${byId.size} from info.grudge-studio.com`);
      return true;
    } catch (e) {
      console.warn("[itemIcons] catalog load failed — local fallbacks only", e?.message || e);
      loaded = true;
      return false;
    }
  })();
  return loadPromise;
}

function seedLocalFallbacks() {
  const local = [
    { id: "t0_wood", name: "Wood", iconUrl: localIconFor("wood") },
    { id: "t0_stone", name: "Stone", iconUrl: localIconFor("stone") },
    { id: "t0_scrap", name: "Scrap Ore", iconUrl: localIconFor("ore") },
    { id: "t0_hide_scrap", name: "Hide Scrap", iconUrl: localIconFor("hide") },
    { id: "t0_sword", name: "Recruit Sword", iconUrl: localIconFor("sword") },
    { id: "t0-sword", name: "Training Sword", iconUrl: localIconFor("sword") },
    { id: "t0_bow", name: "Recruit Bow", iconUrl: localIconFor("bow") },
    { id: "t0_staff", name: "Apprentice Staff", iconUrl: localIconFor("staff") },
    { id: "t0_axe", name: "Worge Axe", iconUrl: localIconFor("axe") },
    { id: "t0_shield", name: "Wood Shield", iconUrl: localIconFor("shield") },
    { id: "t0_mail", name: "Recruit Mail", iconUrl: localIconFor("mail") },
    { id: "t0_leather", name: "Scout Leather", iconUrl: localIconFor("leather") },
    { id: "t0_robe", name: "Apprentice Robe", iconUrl: localIconFor("robe") },
    { id: "t0_hide", name: "Hide Harness", iconUrl: localIconFor("hide armor") },
    { id: "t1_sword", name: "Iron Sword", iconUrl: localIconFor("sword") },
    { id: "t1_bow", name: "Yew Bow", iconUrl: localIconFor("bow") },
    { id: "t1_staff", name: "Oak Staff", iconUrl: localIconFor("staff") },
    { id: "t1_mail", name: "Iron Mail", iconUrl: localIconFor("mail") },
    { id: "t1_leather", name: "Hardened Leather", iconUrl: localIconFor("leather") },
    { id: "t1_robe", name: "Woven Robe", iconUrl: localIconFor("robe") },
    { id: "t1_shield", name: "Iron Shield", iconUrl: localIconFor("shield") },
  ];
  for (const it of local) {
    if (!byId.has(it.id.toLowerCase())) indexItem(it);
  }
}

export function resolveItem(idOrName) {
  if (!idOrName) return null;
  const k = String(idOrName).toLowerCase();
  return (
    byId.get(k) ||
    byId.get(norm(k)) ||
    byId.get(k.replace(/-/g, "_")) ||
    byId.get(k.replace(/_/g, "-")) ||
    byName.get(norm(k)) ||
    null
  );
}

export function itemIconUrl(idOrName) {
  const row = resolveItem(idOrName);
  if (row?.iconUrl) return rewriteIconUrl(row.iconUrl, idOrName);
  return localIconFor(idOrName);
}

export function skillIconUrl(skill, classId) {
  if (!skill) return localIconFor("skill");
  const hint = `${skill.id || ""} ${skill.name || ""} ${skill.kind || ""} ${classId || ""}`;
  // Prefer catalog by skill id / name
  const row = resolveItem(skill.id) || resolveItem(skill.name);
  if (row?.iconUrl) return rewriteIconUrl(row.iconUrl, hint);
  return localIconFor(hint);
}

/**
 * HTML for an icon (img + onerror glyph).
 */
export function iconHtml(idOrName, size = 20, label = "") {
  const url = itemIconUrl(idOrName);
  const alt = escapeAttr(label || idOrName || "");
  const s = Math.max(12, size | 0);
  const letter = String(label || idOrName || "?")
    .replace(/^t[01][_-]?/i, "")
    .slice(0, 2)
    .toUpperCase();
  return `<span class="mv-icon-wrap" style="width:${s}px;height:${s}px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">
    <img src="${escapeAttr(url)}" alt="${alt}" width="${s}" height="${s}" loading="lazy"
      style="width:${s}px;height:${s}px;object-fit:contain;display:block"
      onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='inline-flex')" />
    <span class="mv-icon-fallback" style="display:none;width:${s}px;height:${s}px;font-size:${Math.max(8, s * 0.4)}px">${escapeAttr(letter)}</span>
  </span>`;
}

function escapeAttr(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}
