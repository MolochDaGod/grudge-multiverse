/**
 * Faction territories for Multiverse Bermuda.
 *
 * Island-Crusade-Realm-2 used a 5 km archipelago (hub + 3 faction islands).
 * Multiverse keeps the **Bermuda GLB** as the play mesh and maps the same
 * three factions onto land **wedges** around the island centre (SI metres).
 *
 * Source: combat-sandbox zones.ts + islands.ts (adapted).
 */

/** @typedef {'crusade'|'fabled'|'legion'|'neutral'} Faction */

/**
 * @typedef {{
 *   faction: Faction,
 *   name: string,
 *   tint: [number, number, number],
 *   aggression: number,
 *   enemyRace: 'orcs'|'undead'|'western-kingdoms',
 *   accent: string,
 *   raceId: string,
 * }} ZoneTheme
 */

const THEMES = {
  crusade: {
    faction: "crusade",
    name: "Crusade Marches",
    tint: [0.06, 0.04, -0.02],
    aggression: 1,
    enemyRace: "orcs",
    accent: "#c9a227",
    raceId: "western-kingdoms",
  },
  fabled: {
    faction: "fabled",
    name: "Fabled Wilds",
    tint: [-0.04, 0.05, 0.02],
    aggression: 0.85,
    enemyRace: "undead",
    accent: "#4c8fe0",
    raceId: "high-elves",
  },
  legion: {
    faction: "legion",
    name: "Legion Wastes",
    tint: [0.05, -0.03, -0.04],
    aggression: 1.25,
    enemyRace: "orcs",
    accent: "#b8402e",
    raceId: "orcs",
  },
};

const ORDER = ["crusade", "fabled", "legion"];

const NEUTRAL_THEME = {
  faction: "neutral",
  name: "Grudgehold Hub",
  tint: [0, 0, 0],
  aggression: 0,
  enemyRace: "orcs",
  accent: "#e8d9a8",
  raceId: "western-kingdoms",
};

/**
 * Build wedge layout for a Bermuda-sized island.
 * @param {number} landRadius - from island.nav / measureLandRadius
 * @param {number} [hubFrac=0.22] - central neutral hub as fraction of land radius
 */
export function createRealmLayout(landRadius, hubFrac = 0.22) {
  const R = Math.max(80, Number(landRadius) || 300);
  const hubR = R * hubFrac;
  // Faction town anchors: 55% of land radius, 120° apart
  const townR = R * 0.52;
  const towns = ORDER.map((f, i) => {
    const ang = (i / 3) * Math.PI * 2 - Math.PI / 2;
    return {
      faction: f,
      angle: ang,
      x: Math.cos(ang) * townR,
      z: Math.sin(ang) * townR,
      theme: THEMES[f],
    };
  });
  return { landRadius: R, hubRadius: hubR, townRingR: townR, towns, order: ORDER.slice() };
}

/**
 * Faction at world XZ on Bermuda overlay.
 * Hub disc = neutral; else nearest wedge by angle.
 */
export function factionAt(x, z, layout) {
  if (!layout) return NEUTRAL_THEME;
  const d = Math.hypot(x, z);
  if (d <= layout.hubRadius) return NEUTRAL_THEME;
  if (d > layout.landRadius * 1.05) return NEUTRAL_THEME;
  const ang = Math.atan2(z, x);
  let best = ORDER[0];
  let bestDa = Infinity;
  for (const t of layout.towns) {
    let da = Math.abs(ang - t.angle);
    while (da > Math.PI) da = Math.abs(da - Math.PI * 2);
    if (da < bestDa) {
      bestDa = da;
      best = t.faction;
    }
  }
  return THEMES[best] || NEUTRAL_THEME;
}

export function allZoneThemes() {
  return ORDER.map((f) => THEMES[f]);
}

export { THEMES, ORDER, NEUTRAL_THEME };
