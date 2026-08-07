/**
 * Huntable wildlife + farm stock — port of Island-Crusade animals.ts.
 * Visuals: SI-scaled stand-ins until animal GLBs are on CDN (optional later).
 */

export const WILD_ANIMALS = [
  { species: "Deer", height: 1.5, maxHp: 60, loot: { id: "deer_hide", name: "Deer Hide", tier: 0 }, domestic: false, color: 0x8b6914, hostile: false },
  { species: "Stag", height: 1.8, maxHp: 95, loot: { id: "stag_pelt", name: "Stag Pelt", tier: 1 }, domestic: false, color: 0x6b4423, hostile: false },
  { species: "Fox", height: 0.5, maxHp: 35, loot: { id: "fox_fur", name: "Fox Fur", tier: 0 }, domestic: false, color: 0xc45c26, hostile: false },
  { species: "Wolf", height: 0.9, maxHp: 75, loot: { id: "wolf_pelt", name: "Wolf Pelt", tier: 1 }, domestic: false, color: 0x555566, hostile: true },
];

export const FARM_ANIMALS = [
  { species: "Cow", height: 1.6, maxHp: 120, loot: { id: "cowhide", name: "Cowhide", tier: 0 }, domestic: true, color: 0xd0d0d0, hostile: false },
  { species: "Bull", height: 1.8, maxHp: 150, loot: { id: "bull_leather", name: "Bull Leather", tier: 1 }, domestic: true, color: 0x3a2a1a, hostile: false },
  { species: "Alpaca", height: 1.4, maxHp: 80, loot: { id: "alpaca_wool", name: "Alpaca Wool", tier: 0 }, domestic: true, color: 0xe8e0d0, hostile: false },
  { species: "Donkey", height: 1.4, maxHp: 90, loot: { id: "donkey_hide", name: "Donkey Hide", tier: 0 }, domestic: true, color: 0x7a6a50, hostile: false },
];

export const ALL_ANIMALS = [...WILD_ANIMALS, ...FARM_ANIMALS];

export function animalBySpecies(species) {
  return ALL_ANIMALS.find((a) => a.species === species);
}
