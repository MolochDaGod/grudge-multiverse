/**
 * Canonical quick-crafting (fleet harvestCatalog style) — client-side recipes.
 */

import { loadBag, saveBag, countMat, spendMats, addItem } from "./inventory.js";

export const QUICK_RECIPES = [
  {
    id: "craft_planks",
    name: "Wood Planks",
    station: "bench",
    costs: { t0_wood: 2 },
    result: { id: "t0_planks", name: "Wood Planks", tier: 0, slot: "mat", qty: 1 },
  },
  {
    id: "craft_t0_sword",
    name: "Recruit Sword",
    station: "weapon",
    costs: { t0_scrap: 2, t0_wood: 1 },
    result: { id: "t0_sword", name: "Recruit Sword", tier: 0, slot: "weapon", dmg: 12 },
  },
  {
    id: "craft_t0_bow",
    name: "Recruit Bow",
    station: "weapon",
    costs: { t0_wood: 3, t0_hide_scrap: 1 },
    result: { id: "t0_bow", name: "Recruit Bow", tier: 0, slot: "weapon", dmg: 10 },
  },
  {
    id: "craft_t1_mail",
    name: "Iron Mail",
    station: "armor",
    costs: { t0_scrap: 4, t0_hide_scrap: 2 },
    result: { id: "t1_mail", name: "Iron Mail", tier: 1, slot: "armor", armor: 14 },
  },
  {
    id: "craft_t1_sword",
    name: "Iron Sword",
    station: "weapon",
    costs: { t0_scrap: 5, t0_wood: 2 },
    result: { id: "t1_sword", name: "Iron Sword", tier: 1, slot: "weapon", dmg: 18 },
  },
];

export function canCraft(recipeId) {
  const bag = loadBag();
  const r = QUICK_RECIPES.find((x) => x.id === recipeId);
  if (!r) return false;
  for (const [mat, n] of Object.entries(r.costs)) {
    const have =
      countMat(bag, mat) +
      countMat(bag, mat.replace(/^t0_/, "")) +
      bag.items.filter((i) => i.name?.toLowerCase().includes(mat.replace(/^t0_/, ""))).reduce((s, i) => s + (i.qty || 1), 0);
    // simpler: match id
    let total = 0;
    for (const it of bag.items) {
      if (it.id === mat || it.id === `t0_${mat}` || it.id.endsWith(mat)) total += it.qty || 1;
    }
    if (total < n) return false;
  }
  return true;
}

export function craft(recipeId) {
  const r = QUICK_RECIPES.find((x) => x.id === recipeId);
  if (!r) return { ok: false, error: "unknown recipe" };
  const bag = loadBag();
  // spend by id keys as stored (t0_wood etc.)
  const costs = { ...r.costs };
  for (const [mat, n] of Object.entries(costs)) {
    let need = n;
    for (const it of bag.items) {
      if (it.id !== mat) continue;
      const q = it.qty || 1;
      const use = Math.min(q, need);
      it.qty = q - use;
      need -= use;
      if (need <= 0) break;
    }
    if (need > 0) return { ok: false, error: `need ${mat} x${n}` };
  }
  bag.items = bag.items.filter((i) => (i.qty ?? 1) > 0);
  addItem(bag, r.result, r.result.qty || 1);
  saveBag(bag);
  return { ok: true, bag, result: r.result };
}
