/**
 * Vendors — Multiverse base + Island-Crusade market cast
 * (Blacksmith, Merchant, Alchemist, Fletcher, Provisioner).
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
    name: "Blacksmith",
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
  /** Island-Crusade market roles */
  alchemist: {
    id: "vendor_alchemist",
    name: "Alchemist",
    stock: [
      { id: "t0_potion_hp", name: "Health Vial", tier: 0, slot: "consumable", heal: 40, price: 15 },
      { id: "t0_potion_sta", name: "Stamina Draft", tier: 0, slot: "consumable", stamina: 30, price: 12 },
      { id: "t1_potion_hp", name: "Greater Health", tier: 1, slot: "consumable", heal: 90, price: 45 },
      { id: "t0_antidote", name: "Antidote", tier: 0, slot: "consumable", price: 18 },
    ],
  },
  fletcher: {
    id: "vendor_fletcher",
    name: "Fletcher",
    stock: [
      { id: "t0_arrows", name: "Arrow Bundle", tier: 0, slot: "ammo", dmg: 2, price: 8 },
      { id: "t0_bow", name: "Recruit Bow", tier: 0, slot: "weapon", dmg: 10, price: 28 },
      { id: "t1_bow", name: "Yew Bow", tier: 1, slot: "weapon", dmg: 16, price: 85 },
      { id: "t1_arrows", name: "Bodkin Arrows", tier: 1, slot: "ammo", dmg: 4, price: 22 },
    ],
  },
  provisioner: {
    id: "vendor_provisioner",
    name: "Provisioner",
    stock: [
      { id: "t0_ration", name: "Travel Ration", tier: 0, slot: "consumable", heal: 15, price: 6 },
      { id: "t0_rope", name: "Rope Coil", tier: 0, slot: "material", price: 10 },
      { id: "t0_torch", name: "Torch", tier: 0, slot: "tool", price: 5 },
      { id: "t1_map_scrap", name: "Map Scrap", tier: 1, slot: "quest", price: 40 },
    ],
  },
  /** Alias for Merchant booth (general goods) */
  merchant: {
    id: "vendor_merchant",
    name: "Merchant",
    stock: [
      { id: "t0_ration", name: "Travel Ration", tier: 0, slot: "consumable", heal: 15, price: 6 },
      { id: "t0_potion_hp", name: "Health Vial", tier: 0, slot: "consumable", heal: 40, price: 16 },
      { id: "t0_mail", name: "Recruit Mail", tier: 0, slot: "armor", armor: 8, price: 28 },
      { id: "t0_sword", name: "Recruit Sword", tier: 0, slot: "weapon", dmg: 12, price: 32 },
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
