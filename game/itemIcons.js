/**
 * Item / skill / unit / building icons.
 *
 * Priority:
 *  1. Desktop pack shipped at /ui/icons/ (weapons, armor, entities, resources…)
 *  2. info.grudge-studio.com master-items catalog (iconUrl)
 *  3. assets.grudge-studio.com/game-assets/icons
 *  4. gameopen.vercel.app/icons
 */

export const MASTER_ITEMS_URL = "https://info.grudge-studio.com/api/v1/master-items.json";
export const INFO_ICONS = "https://info.grudge-studio.com/icons";
export const CDN_ICONS = "https://assets.grudge-studio.com/game-assets/icons";
export const OPEN_ICONS = "https://gameopen.vercel.app/icons";
/** Multiverse-local Desktop pack (curated from C:\\Users\\…\\Desktop\\icons\\icons) */

/** @type {Map<string, { id: string, name: string, iconUrl: string, tier?: number, type?: string }>} */
const byId = new Map();
const byName = new Map();

let loadPromise = null;
let loaded = false;

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/** Map Multiverse / catalog ids → Desktop pack relative paths */
const DESKTOP_MAP = {
  // T0 starters — Desktop pack basenames (match master-items after SSOT normalize)
  t0_sword: "weapons/Sword_01.png",
  "t0-sword": "weapons/Sword_01.png",
  t0_axe1h: "weapons/Axe_01.png",
  "t0-axe1h": "weapons/Axe_01.png",
  t0_axe: "weapons/Axe_01.png",
  t0_dagger: "weapons/Dagger_01.png",
  "t0-dagger": "weapons/Dagger_01.png",
  t0_hammer1h: "weapons/Hammer_01.png",
  "t0-hammer1h": "weapons/Hammer_01.png",
  t0_spear: "weapons/Spear_01.png",
  "t0-spear": "weapons/Spear_01.png",
  t0_greatsword: "weapons/Sword_30.png",
  "t0-greatsword": "weapons/Sword_30.png",
  t0_greataxe: "weapons/Axe_20.png",
  "t0-greataxe": "weapons/Axe_20.png",
  t0_hammer2h: "weapons/Hammer_20.png",
  "t0-hammer2h": "weapons/Hammer_20.png",
  t0_bow: "weapons/Bow_01.png",
  "t0-bow": "weapons/Bow_01.png",
  t0_crossbow: "weapons/Crossbow_01.png",
  "t0-crossbow": "weapons/Crossbow_01.png",
  t0_wand: "weapons/staff_1.png",
  "t0-wand": "weapons/staff_1.png",
  t0_nature_staff: "weapons/staff_2.png",
  "t0-nature-staff": "weapons/staff_2.png",
  t0_staff: "weapons/staff_1.png",
  t0_offhand_tome: "weapons/Book_1.png",
  "t0-offhand-tome": "weapons/Book_1.png",
  t0_shield: "weapons/shield_01.png",
  t1_sword: "weapons/Sword_05.png",
  t1_bow: "weapons/Bow_05.png",
  t1_staff: "weapons/staff_5.png",
  t1_axe: "weapons/Axe_05.png",
  t1_shield: "weapons/shield_05.png",
  t0_mail: "armor/Chest_01.png",
  t1_mail: "armor/Chest_05.png",
  t0_leather: "armor/Chest_02.png",
  t1_leather: "armor/Chest_06.png",
  t0_robe: "armor/Chest_03.png",
  t1_robe: "armor/Chest_07.png",
  t0_wood: "resources/Loot_01.png",
  t0_stone: "resources/Loot_02.png",
  t0_scrap: "resources/Loot_03.png",
  t0_hide_scrap: "resources/Loot_04.png",
  t0_hide: "resources/Loot_04.png",
  vendor_weapon: "entities/Blacksmith Icon.png",
  vendor_armor: "entities/Armory Icon.png",
  blacksmith: "entities/Blacksmith Icon.png",
  armory: "entities/Armory Icon.png",
  arsenal: "entities/Arsenal Icon.png",
  foundry: "entities/Foundry Icon.png",
};

export function desktopIconUrl(rel) {
  if (!rel) return null;
  const clean = String(rel).replace(/^\/+/, "");
  const base = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
  return `${base}ui/icons/${clean}`;
}

export function rewriteIconUrl(url, hint = "") {
  if (!url || typeof url !== "string") return localIconFor(hint);
  let u = url;
  // Dead github.io → assets CDN (info.* category paths return HTML shells)
  if (/molochdagod\.github\.io\/ObjectStore\//i.test(u)) {
    u = u.replace(
      /https?:\/\/molochdagod\.github\.io\/ObjectStore\//i,
      "https://assets.grudge-studio.com/game-assets/",
    );
  }
  // Dual prefix: pack icons SSOT is game-assets/icons/pack/
  u = u.replace(
    /https:\/\/assets\.grudge-studio\.com\/icons\/pack\//i,
    "https://assets.grudge-studio.com/game-assets/icons/pack/",
  );
  u = u.replace(
    /https:\/\/info\.grudge-studio\.com\/icons\/pack\//i,
    "https://assets.grudge-studio.com/game-assets/icons/pack/",
  );
  // Desktop pack basename quirks
  u = u.replace(/\/shield_04\.png$/i, "/shield_4.png");
  u = u.replace(/\/staff_0([1-9])\.png$/i, "/staff_$1.png");
  return u;
}

function localIconFor(hint) {
  const h = String(hint || "").toLowerCase();
  const idTry = DESKTOP_MAP[h] || DESKTOP_MAP[h.replace(/-/g, "_")];
  if (idTry) return desktopIconUrl(idTry);

  if (/sword|blade|melee|slash/.test(h)) return desktopIconUrl("weapons/Sword_01.png");
  if (/bow|arrow|ranger|yew/.test(h)) return desktopIconUrl("weapons/Bow_01.png");
  if (/staff|mage|magic|arcane/.test(h)) return desktopIconUrl("weapons/staff_1.png");
  if (/axe|worge|cleave/.test(h)) return desktopIconUrl("weapons/Axe_01.png");
  if (/shield|block|guard|parry/.test(h)) return desktopIconUrl("weapons/shield_01.png");
  if (/dodge|dash|roll|slide/.test(h)) return desktopIconUrl("entities/barb warrior.png");
  if (/wood|tree|harvest/.test(h)) return desktopIconUrl("resources/Loot_01.png");
  if (/stone|ore|rock|scrap/.test(h)) return desktopIconUrl("resources/Loot_02.png");
  if (/armor|mail|leather|robe|chest/.test(h)) return desktopIconUrl("armor/Chest_01.png");
  if (/potion|heal|mana/.test(h)) return desktopIconUrl("potions/P_Red03.png");
  if (/blacksmith|weapon.?smith|vendor.?weapon/.test(h))
    return desktopIconUrl("entities/Blacksmith Icon.png");
  if (/armou?r|armory|vendor.?armor/.test(h)) return desktopIconUrl("entities/Armory Icon.png");
  if (/house|cabin|building|castle|wall|gate/.test(h))
    return desktopIconUrl("entities/Castle Wall Icon.png");
  if (/ship|boat|catapult|siege/.test(h)) return desktopIconUrl("entities/Catapult.png");
  if (/warrior|archer|mage|paladin|merc|unit/.test(h))
    return desktopIconUrl("entities/barb warrior.png");
  return `${OPEN_ICONS}/gear-trial.png`;
}

function indexItem(it) {
  if (!it) return;
  const id = it.id || it.uuid;
  const name = it.name || it.baseName || id;
  // Prefer desktop map for known Multiverse ids
  const desk =
    (id && DESKTOP_MAP[id]) ||
    (id && DESKTOP_MAP[String(id).toLowerCase()]) ||
    (id && DESKTOP_MAP[String(id).toLowerCase().replace(/-/g, "_")]);
  const rawIcon = it.iconUrl || it.icon || it.image || "";
  const iconUrl = desk
    ? desktopIconUrl(desk)
    : rewriteIconUrl(rawIcon, `${id} ${name} ${it.category || ""}`);
  const row = { id, name, iconUrl, tier: it.tier, type: it.type || it.category };
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
      console.info(`[itemIcons] catalog keys=${byId.size} (desktop pack + info.*)`);
      return true;
    } catch (e) {
      console.warn("[itemIcons] catalog failed — desktop pack only", e?.message || e);
      loaded = true;
      return false;
    }
  })();
  return loadPromise;
}

function seedLocalFallbacks() {
  for (const [id, rel] of Object.entries(DESKTOP_MAP)) {
    if (id.includes("vendor") || id.includes("blacksmith")) continue;
    indexItem({
      id,
      name: id.replace(/[_-]/g, " "),
      iconUrl: desktopIconUrl(rel),
      slot: /sword|bow|staff|axe/.test(id) ? "weapon" : /mail|leather|robe/.test(id) ? "armor" : "mat",
    });
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
  const row = resolveItem(skill.id) || resolveItem(skill.name);
  if (row?.iconUrl) return rewriteIconUrl(row.iconUrl, hint);
  return localIconFor(hint);
}

/** Building / unit icons from Desktop entities pack */
export function entityIconUrl(name) {
  const n = String(name || "");
  // Try exact file in entities
  const base = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
  const tryNames = [
    n,
    `${n}.png`,
    `${n}.PNG`,
    n.replace(/\s+/g, " "),
  ];
  // Known aliases
  if (/blacksmith|weapon/i.test(n)) return desktopIconUrl("entities/Blacksmith Icon.png");
  if (/armou?ry|armor/i.test(n)) return desktopIconUrl("entities/Armory Icon.png");
  return desktopIconUrl(`entities/${tryNames[0]}.png`) || localIconFor(n);
}

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
