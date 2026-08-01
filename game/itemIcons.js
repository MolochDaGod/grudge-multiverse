/**
 * Item icons from fleet ObjectStore master catalog (info.grudge-studio.com SSOT).
 * https://objectstore.grudge-studio.com/api/v1/master-items.json
 * https://info.grudge-studio.com/GRUDGE_Item_Database.html
 */

export const MASTER_ITEMS_URL = "https://objectstore.grudge-studio.com/api/v1/master-items.json";
export const ICON_CDN = "https://molochdagod.github.io/ObjectStore/icons";

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

function indexItem(it) {
  if (!it) return;
  const id = it.id || it.uuid;
  const iconUrl = it.iconUrl || it.icon || it.image || "";
  const row = {
    id,
    name: it.name || it.baseName || id,
    iconUrl,
    tier: it.tier,
    type: it.type || it.category,
  };
  if (id) {
    byId.set(String(id).toLowerCase(), row);
    byId.set(norm(id), row);
    // Multiverse uses underscores: t0_sword ↔ catalog t0-sword
    byId.set(String(id).toLowerCase().replace(/-/g, "_"), row);
    byId.set(String(id).toLowerCase().replace(/_/g, "-"), row);
  }
  if (row.name) byName.set(norm(row.name), row);
}

export async function ensureItemCatalog() {
  if (loaded) return true;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const res = await fetch(MASTER_ITEMS_URL, { mode: "cors" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items = data.items || data.weapons || data || [];
      if (Array.isArray(items)) {
        for (const it of items) indexItem(it);
      }
      // Material / harvest fallbacks
      seedLocalFallbacks();
      loaded = true;
      console.info(`[itemIcons] indexed ${byId.size} id keys from ObjectStore`);
      return true;
    } catch (e) {
      console.warn("[itemIcons] catalog load failed — local fallbacks only", e);
      seedLocalFallbacks();
      loaded = true;
      return false;
    }
  })();
  return loadPromise;
}

function seedLocalFallbacks() {
  const local = [
    { id: "t0_wood", name: "Wood", iconUrl: `${ICON_CDN}/materials/wood_01.png` },
    { id: "t0_stone", name: "Stone", iconUrl: `${ICON_CDN}/materials/stone_01.png` },
    { id: "t0_scrap", name: "Scrap Ore", iconUrl: `${ICON_CDN}/materials/ore_01.png` },
    { id: "t0_hide_scrap", name: "Hide Scrap", iconUrl: `${ICON_CDN}/materials/hide_01.png` },
    { id: "t0_sword", name: "Recruit Sword", iconUrl: `${ICON_CDN}/swords/sword_01.png` },
    { id: "t0-sword", name: "Training Sword", iconUrl: `${ICON_CDN}/swords/sword_01.png` },
    { id: "t0_bow", name: "Recruit Bow", iconUrl: `${ICON_CDN}/bows/bow_01.png` },
    { id: "t0_staff", name: "Apprentice Staff", iconUrl: `${ICON_CDN}/staves/staff_01.png` },
    { id: "t0_axe", name: "Worge Axe", iconUrl: `${ICON_CDN}/axes1h/axe_01.png` },
    { id: "t0_shield", name: "Wood Shield", iconUrl: `${ICON_CDN}/shields/shield_01.png` },
    { id: "t0_mail", name: "Recruit Mail", iconUrl: `${ICON_CDN}/armor/chest_01.png` },
    { id: "t0_leather", name: "Scout Leather", iconUrl: `${ICON_CDN}/armor/leather_01.png` },
    { id: "t0_robe", name: "Apprentice Robe", iconUrl: `${ICON_CDN}/armor/robe_01.png` },
    { id: "t0_hide", name: "Hide Harness", iconUrl: `${ICON_CDN}/armor/leather_01.png` },
    { id: "t1_sword", name: "Iron Sword", iconUrl: `${ICON_CDN}/swords/sword_02.png` },
    { id: "t1_bow", name: "Yew Bow", iconUrl: `${ICON_CDN}/bows/bow_02.png` },
    { id: "t1_staff", name: "Oak Staff", iconUrl: `${ICON_CDN}/staves/staff_02.png` },
    { id: "t1_mail", name: "Iron Mail", iconUrl: `${ICON_CDN}/armor/chest_02.png` },
    { id: "t1_leather", name: "Hardened Leather", iconUrl: `${ICON_CDN}/armor/leather_02.png` },
    { id: "t1_robe", name: "Woven Robe", iconUrl: `${ICON_CDN}/armor/robe_02.png` },
  ];
  for (const it of local) {
    if (!byId.has(it.id.toLowerCase())) indexItem(it);
  }
}

/**
 * Resolve icon URL for item id or name.
 * @param {string} idOrName
 * @returns {string|null}
 */
export function iconUrlFor(idOrName) {
  if (!idOrName) return null;
  const k = String(idOrName).toLowerCase();
  const row =
    byId.get(k) ||
    byId.get(k.replace(/_/g, "-")) ||
    byId.get(k.replace(/-/g, "_")) ||
    byId.get(norm(idOrName)) ||
    byName.get(norm(idOrName));
  return row?.iconUrl || null;
}

export function itemMeta(idOrName) {
  if (!idOrName) return null;
  const k = String(idOrName).toLowerCase();
  return (
    byId.get(k) ||
    byId.get(k.replace(/_/g, "-")) ||
    byId.get(k.replace(/-/g, "_")) ||
    byId.get(norm(idOrName)) ||
    byName.get(norm(idOrName)) ||
    null
  );
}

/** HTML img tag or monogram fallback for inventory / skill bars. */
export function iconHtml(idOrName, size = 28, alt = "") {
  const url = iconUrlFor(idOrName);
  const label = alt || idOrName || "?";
  if (url) {
    return `<img class="mv-icon" src="${url}" width="${size}" height="${size}" alt="${escapeAttr(label)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='flex')" /><span class="mv-icon-fallback" style="display:none;width:${size}px;height:${size}px">${escapeAttr(label.slice(0, 2))}</span>`;
  }
  return `<span class="mv-icon-fallback" style="width:${size}px;height:${size}px">${escapeAttr(String(label).slice(0, 2))}</span>`;
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/** Skill → catalog icon guess by kind / id */
export function skillIconUrl(skill, classId) {
  if (!skill) return null;
  const id = skill.id || "";
  const kind = skill.kind || "";
  if (/shot|arrow|volley|rain|mark|trap|bow/i.test(id) || kind.includes("ranged")) {
    return iconUrlFor("t0_bow") || `${ICON_CDN}/bows/bow_01.png`;
  }
  if (/bolt|nova|meteor|storm|blink|mana|magic|arcane/i.test(id) || kind.includes("magic")) {
    return iconUrlFor("t0_staff") || `${ICON_CDN}/staves/staff_01.png`;
  }
  if (/shield|fortify|bash/i.test(id)) {
    return iconUrlFor("t0_shield") || `${ICON_CDN}/shields/shield_01.png`;
  }
  if (classId === "ranger") return iconUrlFor("t0_bow") || `${ICON_CDN}/bows/bow_01.png`;
  if (classId === "mage") return iconUrlFor("t0_staff") || `${ICON_CDN}/staves/staff_01.png`;
  if (classId === "worge") return iconUrlFor("t0_axe") || `${ICON_CDN}/axes1h/axe_01.png`;
  return iconUrlFor("t0_sword") || `${ICON_CDN}/swords/sword_01.png`;
}
