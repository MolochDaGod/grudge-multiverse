/**
 * Seeded settlements on Bermuda — port of Island-Crusade settlements.ts.
 * Towns / farms / camps per faction wedge (SI metres, land-snapped later).
 */
import { mulberry32, childSeed } from "./realmSeed.js";
import { ORDER, THEMES } from "./realmZones.js";

/** @typedef {'town'|'farm'|'camp'} SettlementKind */
/** @typedef {'castle'|'village'|'orc'} BuildingKit */

/**
 * @typedef {{
 *   id: string,
 *   faction: string,
 *   kind: SettlementKind,
 *   kit: BuildingKit,
 *   x: number,
 *   z: number,
 *   radius: number,
 *   name: string,
 *   accent: string,
 * }} Settlement
 */

const TOWN_KIT = {
  crusade: "castle",
  fabled: "village",
  legion: "orc",
};

const TOWN_NAME = {
  crusade: "Crusade Keep",
  fabled: "Fabled Spire",
  legion: "Legion Hold",
};

/**
 * @param {ReturnType<import('./realmZones.js').createRealmLayout>} layout
 * @returns {{ towns: Settlement[], farms: Settlement[], camps: Settlement[], all: Settlement[] }}
 */
export function buildSettlements(layout) {
  const rng = mulberry32(childSeed("settlements"));
  /** @type {Settlement[]} */
  const towns = [];
  /** @type {Settlement[]} */
  const farms = [];
  /** @type {Settlement[]} */
  const camps = [];

  for (const t of layout.towns) {
    const f = t.faction;
    towns.push({
      id: `town-${f}`,
      faction: f,
      kind: "town",
      kit: TOWN_KIT[f],
      x: t.x,
      z: t.z,
      radius: 28,
      name: TOWN_NAME[f],
      accent: THEMES[f].accent,
    });

    // Farm: offset from town toward hub (safer inland)
    const farmAng = t.angle + (rng() - 0.5) * 0.8;
    const farmR = layout.townRingR * (0.32 + rng() * 0.08);
    farms.push({
      id: `farm-${f}`,
      faction: f,
      kind: "farm",
      kit: "village",
      x: Math.cos(farmAng) * farmR,
      z: Math.sin(farmAng) * farmR,
      radius: 16,
      name: `${TOWN_NAME[f]} Farm`,
      accent: THEMES[f].accent,
    });

    // Enemy camp: outer ring, opposite side of farm
    const campAng = t.angle + Math.PI * (0.35 + rng() * 0.3) * (rng() > 0.5 ? 1 : -1);
    const campR = layout.landRadius * (0.62 + rng() * 0.1);
    camps.push({
      id: `camp-${f}`,
      faction: f,
      kind: "camp",
      kit: "orc",
      x: Math.cos(campAng) * campR,
      z: Math.sin(campAng) * campR,
      radius: 14,
      name: `${f} Raider Camp`,
      accent: "#8b2020",
    });
  }

  // Neutral hub market at origin
  towns.unshift({
    id: "town-neutral",
    faction: "neutral",
    kind: "town",
    kit: "village",
    x: 0,
    z: 0,
    radius: 32,
    name: "Grudgehold",
    accent: "#e8d9a8",
  });

  const all = [...towns, ...farms, ...camps];
  return { towns, farms, camps, all };
}
