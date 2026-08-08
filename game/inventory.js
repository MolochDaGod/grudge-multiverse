/**
 * Multiverse bag / loadout / rewards T0–T1 + local persistence.
 */

const KEY = "mv_inventory_v1";
const LOADOUT_KEY = "mv_loadout_v1";

/**
 * @typedef {{
 *   id: string, name: string, tier: 0|1, slot: string,
 *   dmg?: number, armor?: number, qty?: number,
 *   meshFamily?: string, meshLabel?: string, meshSlot?: string
 * }} Item
 */
/** @typedef {{ weapon: Item|null, armor: Item|null, offhand: Item|null }} Loadout */

export const T0_DROPS = [
  { id: "t0_wood", name: "Wood", tier: 0, slot: "mat", qty: 1 },
  { id: "t0_stone", name: "Stone", tier: 0, slot: "mat", qty: 1 },
  { id: "t0_scrap", name: "Scrap Ore", tier: 0, slot: "mat", qty: 1 },
  { id: "t0_hide_scrap", name: "Hide Scrap", tier: 0, slot: "mat", qty: 1 },
];

export const T1_DROPS = [
  { id: "t1_sword", name: "Iron Sword", tier: 1, slot: "weapon", dmg: 18, meshFamily: "sword", meshLabel: "Sword B+", meshSlot: "sword" },
  { id: "t1_bow", name: "Yew Bow", tier: 1, slot: "weapon", dmg: 16, meshFamily: "bow", meshLabel: "Bow", meshSlot: "bow" },
  { id: "t1_staff", name: "Oak Staff", tier: 1, slot: "weapon", dmg: 17, meshFamily: "staff", meshLabel: "Staff", meshSlot: "staff" },
  {
    id: "t1_nature_staff",
    name: "Grove Staff",
    tier: 1,
    slot: "weapon",
    dmg: 18,
    meshFamily: "staff",
    meshLabel: "Nature Staff",
    meshSlot: "staff",
    school: "nature",
  },
  { id: "t1_mail", name: "Iron Mail", tier: 1, slot: "armor", armor: 14, meshFamily: "heavy", meshLabel: "Heavy body", meshSlot: "body" },
  { id: "t1_leather", name: "Hardened Leather", tier: 1, slot: "armor", armor: 10, meshFamily: "medium", meshLabel: "Medium body", meshSlot: "body" },
  { id: "t1_robe", name: "Woven Robe", tier: 1, slot: "armor", armor: 7, meshFamily: "light", meshLabel: "Light body", meshSlot: "body" },
  { id: "t1_shield", name: "Iron Shield", tier: 1, slot: "shield", armor: 8, meshFamily: "shield", meshLabel: "Shield B+", meshSlot: "shield" },
];

/** Starter gear templates with mesh labels (classes.js merges these). */
export const STARTER_MESH_META = {
  t0_sword: { meshFamily: "sword", meshLabel: "Recruit Sword", meshSlot: "sword" },
  t0_bow: { meshFamily: "bow", meshLabel: "Recruit Bow", meshSlot: "bow" },
  t0_staff: { meshFamily: "staff", meshLabel: "Apprentice Staff", meshSlot: "staff" },
  t0_nature_staff: {
    meshFamily: "staff",
    meshLabel: "Nature Staff",
    meshSlot: "staff",
    school: "nature",
  },
  t1_nature_staff: {
    meshFamily: "staff",
    meshLabel: "Grove Staff",
    meshSlot: "staff",
    school: "nature",
  },
  t0_axe: { meshFamily: "axe", meshLabel: "Worge Axe", meshSlot: "axe" },
  t0_mail: { meshFamily: "heavy", meshLabel: "Recruit Mail", meshSlot: "body" },
  t0_leather: { meshFamily: "medium", meshLabel: "Scout Leather", meshSlot: "body" },
  t0_robe: { meshFamily: "light", meshLabel: "Apprentice Robe", meshSlot: "body" },
  t0_hide: { meshFamily: "medium", meshLabel: "Hide Harness", meshSlot: "body" },
  t0_shield: { meshFamily: "shield", meshLabel: "Wood Shield", meshSlot: "shield" },
};

export function decorateItemMeshMeta(item) {
  if (!item) return item;
  const meta = STARTER_MESH_META[item.id] || {};
  return {
    ...item,
    meshFamily: item.meshFamily || meta.meshFamily,
    meshLabel: item.meshLabel || meta.meshLabel || item.name,
    meshSlot: item.meshSlot || meta.meshSlot || item.slot,
  };
}

export function emptyBag() {
  return { items: /** @type {Item[]} */ ([]), gold: 50, xp: 0, level: 1 };
}

export function emptyLoadout() {
  return /** @type {Loadout} */ ({ weapon: null, armor: null, offhand: null });
}

export function loadBag() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (raw && Array.isArray(raw.items)) return raw;
  } catch { /* ignore */ }
  return emptyBag();
}

export function saveBag(bag) {
  try {
    localStorage.setItem(KEY, JSON.stringify(bag));
  } catch { /* ignore */ }
}

export function loadLoadout() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOADOUT_KEY) || "null");
    if (raw && typeof raw === "object") {
      return {
        weapon: raw.weapon || null,
        armor: raw.armor || null,
        offhand: raw.offhand || null,
      };
    }
  } catch { /* ignore */ }
  return emptyLoadout();
}

export function saveLoadout(loadout) {
  try {
    localStorage.setItem(LOADOUT_KEY, JSON.stringify(loadout));
  } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("mv-loadout", { detail: loadout }));
}

/**
 * Seed starter gear from class into bag + loadout (once per class change).
 * @param {{ weapon?: Item, armor?: Item, offhand?: Item|null }} starter
 */
export function ensureStarterGear(starter) {
  if (!starter) return loadLoadout();
  const bag = loadBag();
  const loadout = loadLoadout();
  const seed = (item, slotKey) => {
    if (!item) return;
    const decorated = decorateItemMeshMeta(item);
    if (!bag.items.some((i) => i.id === decorated.id)) {
      addItem(bag, { ...decorated, qty: 1 });
    }
    if (!loadout[slotKey]) loadout[slotKey] = { ...decorated };
    else loadout[slotKey] = decorateItemMeshMeta(loadout[slotKey]);
  };
  seed(starter.weapon, "weapon");
  seed(starter.armor, "armor");
  seed(starter.offhand, "offhand");
  saveBag(bag);
  saveLoadout(loadout);
  return loadout;
}

/** Equip bag item by id into loadout slot (weapon / armor / offhand). */
export function equipItem(itemId) {
  const bag = loadBag();
  const item = bag.items.find((i) => i.id === itemId);
  if (!item) return { ok: false, error: "missing" };
  if (!["weapon", "armor", "shield"].includes(item.slot)) {
    return { ok: false, error: "not_gear" };
  }
  const loadout = loadLoadout();
  const key = item.slot === "shield" ? "offhand" : item.slot;
  loadout[key] = { ...decorateItemMeshMeta(item), qty: 1 };
  saveLoadout(loadout);
  return { ok: true, loadout, item: loadout[key] };
}

export function unequipSlot(slotKey) {
  const loadout = loadLoadout();
  if (!(slotKey in loadout)) return { ok: false };
  loadout[slotKey] = null;
  saveLoadout(loadout);
  return { ok: true, loadout };
}

/** Combat power from equipped gear (fallback starter dmg). */
export function equippedWeaponDmg(fallback = 12) {
  const w = loadLoadout().weapon;
  return w?.dmg || fallback;
}

export function addItem(bag, item, qty = 1) {
  const q = qty || item.qty || 1;
  if (item.slot === "mat") {
    const existing = bag.items.find((i) => i.id === item.id);
    if (existing) {
      existing.qty = (existing.qty || 1) + q;
      return bag;
    }
  }
  bag.items.push({ ...item, qty: item.slot === "mat" ? q : 1 });
  return bag;
}

export function rollKillReward(isBoss = false) {
  const bag = loadBag();
  bag.xp = (bag.xp || 0) + (isBoss ? 80 : 18);
  bag.gold = (bag.gold || 0) + (isBoss ? 40 : 6);
  // Level every 100 xp
  const newLevel = 1 + Math.floor((bag.xp || 0) / 100);
  const leveled = newLevel > (bag.level || 1);
  bag.level = newLevel;

  /** @type {Item[]} */
  const dropped = [];

  // T0 mats always
  const mat = { ...T0_DROPS[Math.floor(Math.random() * T0_DROPS.length)] };
  addItem(bag, mat, isBoss ? 3 : 1);
  dropped.push({ ...mat, qty: isBoss ? 3 : 1 });

  // T0–T1 gear chance (guaranteed on boss)
  if (isBoss || Math.random() < 0.42) {
    const pool = isBoss || Math.random() < 0.55 ? T1_DROPS : T0_DROPS.filter((d) => d.slot !== "mat");
    if (pool.length) {
      const gear = { ...pool[Math.floor(Math.random() * pool.length)], qty: 1 };
      addItem(bag, gear, 1);
      dropped.push(gear);
    }
  }
  saveBag(bag);
  window.dispatchEvent(new CustomEvent("mv-bag", { detail: bag }));
  return { bag, leveled, level: bag.level, dropped };
}

export function countMat(bag, id) {
  return bag.items.filter((i) => i.id === id).reduce((s, i) => s + (i.qty || 1), 0);
}

export function spendMats(bag, costs) {
  // costs: { wood: 2, stone: 1 }
  for (const [id, n] of Object.entries(costs)) {
    let need = n;
    for (const it of bag.items) {
      if (it.id !== id && it.id !== `t0_${id}` && it.name?.toLowerCase() !== id) continue;
      const q = it.qty || 1;
      const use = Math.min(q, need);
      it.qty = q - use;
      need -= use;
      if (need <= 0) break;
    }
    if (need > 0) return false;
  }
  bag.items = bag.items.filter((i) => (i.qty ?? 1) > 0);
  return true;
}
