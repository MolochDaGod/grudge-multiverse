/**
 * Kenney Food Kit — real in-game foods with icon + model + prefab sprite.
 * Source pack: kenney_food-kit (200 GLB + preview PNGs).
 * Local: public/models/kenney/food-kit/*.glb · public/icons/kenney/food/*.png
 * Catalog: public/models/kenney/food-kit/catalog.json
 *
 * SI: food props ~0.08–0.25 m (table scale). Not character-fit.
 */
import { loadBag, saveBag } from "./inventory.js";

const BASE =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) ||
  "/";

export const FOOD_KIT_GEN = "2026-08-08.1-kenney-food";
export const FOOD_MODEL_DIR = `${BASE}models/kenney/food-kit/`;
export const FOOD_ICON_DIR = `${BASE}icons/kenney/food/`;
export const FOOD_CATALOG_URL = `${BASE}models/kenney/food-kit/catalog.json`;

/** @type {{ foods: object[], props: object[] } | null} */
let _catalog = null;
let _byId = new Map();
let _bySlug = new Map();

export function foodModelUrl(slug) {
  return `${FOOD_MODEL_DIR}${slug}.glb`;
}

export function foodIconUrl(slug) {
  return `${FOOD_ICON_DIR}${slug}.png`;
}

export async function loadFoodCatalog() {
  if (_catalog) return _catalog;
  try {
    const res = await fetch(FOOD_CATALOG_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _catalog = await res.json();
  } catch (e) {
    console.warn("[foodKit] catalog load failed", e?.message || e);
    _catalog = { version: FOOD_KIT_GEN, foods: [], props: [] };
  }
  _byId = new Map();
  _bySlug = new Map();
  for (const f of _catalog.foods || []) {
    const def = normalizeFood(f);
    _byId.set(def.id, def);
    _bySlug.set(def.slug, def);
  }
  for (const p of _catalog.props || []) {
    const def = {
      ...p,
      slot: "prop",
      consumable: false,
      heal: 0,
      modelUrl: foodModelUrl(p.slug),
      iconUrl: foodIconUrl(p.slug),
      prefabSprite: foodIconUrl(p.slug),
    };
    _byId.set(def.id, def);
    _bySlug.set(def.slug, def);
  }
  console.info(
    `[foodKit] ${FOOD_KIT_GEN} foods=${_catalog.foods?.length || 0} props=${_catalog.props?.length || 0}`,
  );
  return _catalog;
}

function normalizeFood(f) {
  const slug = f.slug;
  return {
    ...f,
    id: f.id || `food_${String(slug).replace(/-/g, "_")}`,
    name: f.name || slug,
    slot: "food",
    consumable: true,
    heal: Number(f.heal) || 10,
    tier: f.tier ?? 0,
    qty: 1,
    modelUrl: foodModelUrl(slug),
    iconUrl: foodIconUrl(slug),
    prefabSprite: foodIconUrl(slug),
    targetHeightM: f.targetHeightM ?? 0.12,
    kit: "kenney-food",
  };
}

export function getFoodDef(idOrSlug) {
  if (!idOrSlug) return null;
  const k = String(idOrSlug);
  return _byId.get(k) || _bySlug.get(k) || _bySlug.get(k.replace(/^food_/, "").replace(/_/g, "-"));
}

export function allFoodItems() {
  return [..._byId.values()].filter((d) => d.slot === "food" && d.heal > 0);
}

export function allFoodPrefabs() {
  return [..._byId.values()].map((d) => ({
    id: d.id,
    name: d.name,
    slug: d.slug,
    slot: d.slot,
    heal: d.heal || 0,
    model: d.modelUrl,
    icon: d.iconUrl,
    sprite: d.prefabSprite,
    targetHeightM: d.targetHeightM || 0.12,
  }));
}

/** Bag item shape for inventory */
export function foodAsBagItem(def, qty = 1) {
  if (!def) return null;
  return {
    id: def.id,
    name: def.name,
    tier: def.tier ?? 0,
    slot: "food",
    qty,
    heal: def.heal || 0,
    consumable: true,
    iconUrl: def.iconUrl,
    modelUrl: def.modelUrl,
    prefabSprite: def.prefabSprite,
    slug: def.slug,
    kit: "kenney-food",
  };
}

/**
 * Eat food from bag — restores HP on window.__mvHp / combat host.
 * @returns {{ ok: boolean, healed?: number, hp?: number, maxHp?: number, reason?: string }}
 */
export function useFood(itemId) {
  const bag = loadBag();
  const idx = (bag.items || []).findIndex((i) => i.id === itemId && (i.qty || 1) > 0);
  if (idx < 0) return { ok: false, reason: "not_in_bag" };
  const it = bag.items[idx];
  const def = getFoodDef(it.id) || it;
  const heal = Number(def.heal ?? it.heal) || 0;
  if (heal <= 0 && def.slot === "prop") return { ok: false, reason: "not_food" };

  const maxHp = Number(window.__mvMaxHp) || 100;
  let hp = Number(window.__mvHp);
  if (!Number.isFinite(hp)) hp = maxHp;
  const before = hp;
  hp = Math.min(maxHp, hp + heal);
  const healed = hp - before;
  window.__mvHp = hp;
  window.dispatchEvent(new CustomEvent("mv-hp", { detail: { hp, maxHp } }));

  const q = (it.qty || 1) - 1;
  if (q <= 0) bag.items.splice(idx, 1);
  else it.qty = q;
  saveBag(bag);
  window.dispatchEvent(new CustomEvent("mv-bag", { detail: bag }));
  return { ok: true, healed, hp, maxHp, name: def.name || it.name };
}

/** Grant starter foods into bag once catalog loaded. */
export async function ensureStarterFoods(bag) {
  await loadFoodCatalog();
  const starters = ["apple", "bread", "cheese", "carrot", "meat-cooked"];
  let added = 0;
  for (const slug of starters) {
    const def = getFoodDef(slug);
    if (!def || def.heal <= 0) continue;
    const id = def.id;
    const has = (bag.items || []).some((i) => i.id === id);
    if (has) continue;
    const item = foodAsBagItem(def, slug === "apple" ? 3 : 1);
    // stack as mat-like for qty
    const existing = bag.items.find((i) => i.id === id);
    if (existing) existing.qty = (existing.qty || 1) + (item.qty || 1);
    else bag.items.push(item);
    added++;
  }
  if (added) saveBag(bag);
  return added;
}

/**
 * Random food loot drop (for harvest/kill).
 */
export function rollFoodDrop(rng = Math.random) {
  const foods = allFoodItems().filter((f) => f.heal >= 10 && f.heal <= 28);
  if (!foods.length) return null;
  const f = foods[Math.floor(rng() * foods.length)];
  return foodAsBagItem(f, 1);
}
