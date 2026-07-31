/**
 * Two vendors: armour + weapons (T0–T1 stock).
 */

import { loadBag, saveBag, addItem } from "./inventory.js";

export const VENDORS = {
  armor: {
    id: "vendor_armor",
    name: "Armourer",
    stock: [
      { id: "t0_mail", name: "Recruit Mail", tier: 0, slot: "armor", armor: 8, price: 25 },
      { id: "t0_leather", name: "Scout Leather", tier: 0, slot: "armor", armor: 5, price: 20 },
      { id: "t0_robe", name: "Apprentice Robe", tier: 0, slot: "armor", armor: 3, price: 18 },
      { id: "t1_mail", name: "Iron Mail", tier: 1, slot: "armor", armor: 14, price: 80 },
      { id: "t1_leather", name: "Hardened Leather", tier: 1, slot: "armor", armor: 10, price: 70 },
    ],
  },
  weapon: {
    id: "vendor_weapon",
    name: "Weaponsmith",
    stock: [
      { id: "t0_sword", name: "Recruit Sword", tier: 0, slot: "weapon", dmg: 12, price: 30 },
      { id: "t0_bow", name: "Recruit Bow", tier: 0, slot: "weapon", dmg: 10, price: 28 },
      { id: "t0_staff", name: "Apprentice Staff", tier: 0, slot: "weapon", dmg: 11, price: 28 },
      { id: "t0_axe", name: "Worge Axe", tier: 0, slot: "weapon", dmg: 15, price: 32 },
      { id: "t1_sword", name: "Iron Sword", tier: 1, slot: "weapon", dmg: 18, price: 90 },
      { id: "t1_bow", name: "Yew Bow", tier: 1, slot: "weapon", dmg: 16, price: 85 },
      { id: "t1_staff", name: "Oak Staff", tier: 1, slot: "weapon", dmg: 17, price: 85 },
    ],
  },
};

export function buy(vendorKey, itemId) {
  const v = VENDORS[vendorKey];
  if (!v) return { ok: false, error: "vendor" };
  const item = v.stock.find((s) => s.id === itemId);
  if (!item) return { ok: false, error: "stock" };
  const bag = loadBag();
  if ((bag.gold || 0) < item.price) return { ok: false, error: "gold" };
  bag.gold -= item.price;
  const { price, ...rest } = item;
  addItem(bag, rest, 1);
  saveBag(bag);
  return { ok: true, bag, item: rest };
}
