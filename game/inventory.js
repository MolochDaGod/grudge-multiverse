/**
 * Multiverse bag / rewards T0–T1 + local persistence.
 */

const KEY = "mv_inventory_v1";

/** @typedef {{ id: string, name: string, tier: 0|1, slot: string, dmg?: number, armor?: number, qty?: number }} Item */

export const T0_DROPS = [
  { id: "t0_wood", name: "Wood", tier: 0, slot: "mat", qty: 1 },
  { id: "t0_stone", name: "Stone", tier: 0, slot: "mat", qty: 1 },
  { id: "t0_scrap", name: "Scrap Ore", tier: 0, slot: "mat", qty: 1 },
  { id: "t0_hide_scrap", name: "Hide Scrap", tier: 0, slot: "mat", qty: 1 },
];

export const T1_DROPS = [
  { id: "t1_sword", name: "Iron Sword", tier: 1, slot: "weapon", dmg: 18 },
  { id: "t1_bow", name: "Yew Bow", tier: 1, slot: "weapon", dmg: 16 },
  { id: "t1_staff", name: "Oak Staff", tier: 1, slot: "weapon", dmg: 17 },
  { id: "t1_mail", name: "Iron Mail", tier: 1, slot: "armor", armor: 14 },
  { id: "t1_leather", name: "Hardened Leather", tier: 1, slot: "armor", armor: 10 },
  { id: "t1_robe", name: "Woven Robe", tier: 1, slot: "armor", armor: 7 },
];

export function emptyBag() {
  return { items: /** @type {Item[]} */ ([]), gold: 50, xp: 0, level: 1 };
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

  // T0 mats always
  const mat = T0_DROPS[Math.floor(Math.random() * T0_DROPS.length)];
  addItem(bag, mat, isBoss ? 3 : 1);

  // T0–T1 gear chance
  if (isBoss || Math.random() < 0.35) {
    const pool = isBoss || Math.random() < 0.4 ? T1_DROPS : T0_DROPS.filter((d) => d.slot !== "mat");
    if (pool.length) addItem(bag, pool[Math.floor(Math.random() * pool.length)], 1);
  }
  saveBag(bag);
  return { bag, leveled, level: bag.level };
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
