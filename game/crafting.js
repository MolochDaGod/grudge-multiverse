/**
 * Canonical quick-crafting (fleet harvestCatalog style) — client-side recipes.
 * Costs use bag item ids (t0_wood, t0_stone, t0_scrap, t0_hide_scrap).
 */

import { loadBag, saveBag, countMat, addItem } from "./inventory.js";

export const QUICK_RECIPES = [
  {
    id: "craft_planks",
    name: "Wood Planks",
    station: "bench",
    costs: { t0_wood: 2 },
    result: { id: "t0_planks", name: "Wood Planks", tier: 0, slot: "mat", qty: 1 },
  },
  {
    id: "craft_stone_brick",
    name: "Stone Brick",
    station: "bench",
    costs: { t0_stone: 2 },
    result: { id: "t0_brick", name: "Stone Brick", tier: 0, slot: "mat", qty: 1 },
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
    id: "craft_t0_staff",
    name: "Apprentice Staff",
    station: "weapon",
    costs: { t0_wood: 2, t0_stone: 1 },
    result: { id: "t0_staff", name: "Apprentice Staff", tier: 0, slot: "weapon", dmg: 11 },
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

/** Count mats by exact id (and common aliases). */
export function haveMat(bag, matId) {
  let n = countMat(bag, matId);
  if (n > 0) return n;
  // aliases
  const aliases = {
    wood: "t0_wood",
    stone: "t0_stone",
    scrap: "t0_scrap",
    hide: "t0_hide_scrap",
  };
  if (aliases[matId]) n = countMat(bag, aliases[matId]);
  return n;
}

export function canCraft(recipeId) {
  const bag = loadBag();
  const r = QUICK_RECIPES.find((x) => x.id === recipeId);
  if (!r) return false;
  for (const [mat, need] of Object.entries(r.costs)) {
    if (haveMat(bag, mat) < need) return false;
  }
  return true;
}

export function craft(recipeId) {
  const r = QUICK_RECIPES.find((x) => x.id === recipeId);
  if (!r) return { ok: false, error: "unknown recipe" };
  if (!canCraft(recipeId)) {
    const bag = loadBag();
    const missing = Object.entries(r.costs)
      .filter(([mat, n]) => haveMat(bag, mat) < n)
      .map(([mat, n]) => `${mat} (${haveMat(bag, mat)}/${n})`)
      .join(", ");
    return { ok: false, error: `Need materials: ${missing}` };
  }
  const bag = loadBag();
  for (const [mat, n] of Object.entries(r.costs)) {
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
