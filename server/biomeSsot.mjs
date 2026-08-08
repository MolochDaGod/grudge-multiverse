/**
 * Multiverse island biomes — Valheim *systems* on **islands**, not distance rings.
 *
 * Fleet sector map practice (Aethermoor / Warlords 9-sector):
 *   hub  · Sanctuary / Ethereal Falls camp · home meadows
 *   N    · Frozen Expanse / Northern Ethereal Falls · mountain
 *   E    · Starfall / Fabled · plains + tropical coast
 *   S    · Hellmaw Depths · volcanic (islands *start* volcanic content here)
 *   W    · Forgotten Shoals / Wildwood · forest–swamp
 *   SE   · Pirate Expanse · tropical coves
 *
 * Each land disc gets ONE primary archetype at seed time.
 * sampleBiome(x,z) = nearest island archetype (or coast of that island / ocean).
 *
 * Assets: fleet CDN Kenney nature-kit only.
 * Gen: BIOME_GEN — bump with WORLD_GEN_VERSION when rules change.
 */

export const BIOME_GEN = "2026-08-08.2-island-archetypes";

export const WARLORDS_CDN = "https://assets.grudge-studio.com";

/**
 * Island archetypes (production world spirit: home|mountain|volcanic|tropical|plains|…).
 * Valheim-like: danger, vegetation density, rock scale/bury, animal tables — **per island**.
 */
export const ISLAND_ARCHETYPES = {
  /** Hub — Ethereal Falls camp / Sanctuary Waters (meadows start) */
  ethereal_falls: {
    id: "ethereal_falls",
    name: "Ethereal Falls",
    sectorHint: "c",
    sectorName: "Sanctuary Waters",
    archetype: "home",
    danger: 0.12,
    peakScale: 0.7,
    ground: 0x4a8f3a,
    sand: 0xc4b28a,
    rock: 0x7a7a72,
    trees: ["oak", "default", "detailed"],
    rocks: ["cliff_diag"],
    rockScale: 0.5,
    rockBury: 0.35,
    treeDensity: 1.0,
    rockDensity: 0.45,
    flower: true,
    animals: ["Deer", "Fox", "Cow", "Alpaca"],
    hostiles: [],
    fog: 0.05,
  },
  /** North — Frozen Expanse / Northern Ethereal Falls */
  frozen_expanse: {
    id: "frozen_expanse",
    name: "Frozen Expanse",
    sectorHint: "nw",
    sectorName: "Northern Ethereal Falls",
    archetype: "mountain",
    danger: 0.55,
    peakScale: 1.45,
    ground: 0x6a7a78,
    sand: 0x9aa0a0,
    rock: 0xa0a8a8,
    trees: ["pine"],
    rocks: ["cliff_cave", "cliff_diag"],
    rockScale: 1.0,
    rockBury: 0.4,
    treeDensity: 0.7,
    rockDensity: 1.3,
    flower: false,
    animals: ["Wolf", "Stag"],
    hostiles: ["raider"],
    fog: 0.15,
  },
  /** East — Starfall / Fabled */
  starfall: {
    id: "starfall",
    name: "Starfall Archipelago",
    sectorHint: "e",
    sectorName: "Fabled eastern realms",
    archetype: "plains",
    danger: 0.5,
    peakScale: 0.85,
    ground: 0x5a9a48,
    sand: 0xd0c090,
    rock: 0x7a6a58,
    trees: ["detailed", "oak", "default"],
    rocks: ["cliff_diag"],
    rockScale: 0.75,
    rockBury: 0.38,
    treeDensity: 0.95,
    rockDensity: 0.65,
    flower: true,
    animals: ["Deer", "Stag", "Fox"],
    hostiles: ["raider"],
    fog: 0.08,
  },
  /**
   * South — Hellmaw Depths · volcanic.
   * Production rule: world bosses / volcanic content **start** on these islands.
   */
  hellmaw: {
    id: "hellmaw",
    name: "Hellmaw Depths",
    sectorHint: "s",
    sectorName: "Legion volcanic south",
    archetype: "volcanic",
    danger: 1.1,
    peakScale: 1.35,
    ground: 0x5a3028,
    sand: 0x6a4030,
    rock: 0x4a3030,
    trees: ["pine", "default"],
    rocks: ["cliff_cave", "cliff_diag"],
    rockScale: 1.15,
    rockBury: 0.4,
    treeDensity: 0.35,
    rockDensity: 1.45,
    flower: false,
    animals: [],
    hostiles: ["raider"],
    fog: 0.22,
    allowWorldBoss: true,
    tags: ["volcanic", "hellmaw", "boss_event"],
  },
  /** West — Wildwood / Forgotten Shoals */
  wildwood: {
    id: "wildwood",
    name: "Wildwood Drift",
    sectorHint: "w",
    sectorName: "Western ruins & forest",
    archetype: "mountain", // forest-heavy
    danger: 0.65,
    peakScale: 1.05,
    ground: 0x2a4a28,
    sand: 0x5a4a30,
    rock: 0x4a4a42,
    trees: ["pine", "detailed", "oak"],
    rocks: ["cliff_cave", "cliff_diag"],
    rockScale: 0.9,
    rockBury: 0.42,
    treeDensity: 1.5,
    rockDensity: 0.95,
    flower: false,
    animals: ["Deer", "Wolf", "Fox"],
    hostiles: ["raider"],
    fog: 0.18,
  },
  /** SE pirate tropical (optional 5th pad / coast of SE island) */
  pirate_coves: {
    id: "pirate_coves",
    name: "Pirate Expanse",
    sectorHint: "se",
    sectorName: "Freeport & lawless coves",
    archetype: "tropical",
    danger: 0.7,
    peakScale: 0.65,
    ground: 0x3a8a40,
    sand: 0xd8c890,
    rock: 0x8a8070,
    trees: ["palm", "default"],
    rocks: ["cliff_diag"],
    rockScale: 0.7,
    rockBury: 0.4,
    treeDensity: 0.8,
    rockDensity: 0.7,
    flower: false,
    animals: ["Fox"],
    hostiles: ["raider"],
    fog: 0.1,
  },
  /** Swamp / mist island variant */
  end_of_path: {
    id: "end_of_path",
    name: "End of Path",
    sectorHint: "sw",
    sectorName: "Frontier marsh — path ends at the mist",
    archetype: "plains",
    danger: 0.8,
    peakScale: 0.55,
    ground: 0x3a4a32,
    sand: 0x4a4030,
    rock: 0x4a4a42,
    trees: ["detailed", "default"],
    rocks: ["cliff_diag"],
    rockScale: 0.8,
    rockBury: 0.45,
    treeDensity: 0.9,
    rockDensity: 0.85,
    flower: false,
    animals: ["Fox", "Wolf"],
    hostiles: ["raider"],
    fog: 0.35,
    waterBias: 0.28,
    tags: ["mist", "swamp", "end_of_path"],
  },
};

export const BIOME_COAST = {
  id: "coast",
  name: "Coast",
  archetype: "tropical",
  danger: 0.2,
  peakScale: 0.45,
  ground: 0xc2b280,
  sand: 0xd4c49a,
  rock: 0x8a8070,
  trees: ["palm"],
  rocks: ["cliff_diag"],
  rockScale: 0.6,
  rockBury: 0.4,
  treeDensity: 0.65,
  rockDensity: 0.55,
  flower: false,
  animals: ["Fox"],
  hostiles: [],
};

export const BIOME_OCEAN = {
  id: "ocean",
  name: "Ocean",
  archetype: "event",
  danger: 0,
  ground: 0x1a4a6a,
  trees: [],
  rocks: [],
  treeDensity: 0,
  rockDensity: 0,
};

export const BIOME_TREE_ASSETS = {
  oak: { kit: "nature-kit", file: "tree_oak.glb", heightM: 14 },
  default: { kit: "nature-kit", file: "tree_default.glb", heightM: 11 },
  pine: { kit: "nature-kit", file: "tree_pineDefaultA.glb", heightM: 16 },
  detailed: { kit: "nature-kit", file: "tree_detailed.glb", heightM: 13 },
  palm: { kit: "nature-kit", file: "tree_palm.glb", heightM: 12 },
};

export const BIOME_ROCK_ASSETS = {
  cliff_cave: {
    kit: "nature-kit",
    file: "cliff_blockCave_rock.glb",
    heightM: 20,
  },
  cliff_diag: {
    kit: "nature-kit",
    file: "cliff_blockDiagonal_rock.glb",
    heightM: 18,
  },
};

export const BIOME_FLOWER_ASSET = {
  kit: "nature-kit",
  file: "flower_purpleA.glb",
  heightM: 0.35,
};

export function kenneyUrl(kit, file) {
  const f = file.endsWith(".glb") ? file : `${file}.glb`;
  return `${WARLORDS_CDN}/models/world/kenney/${kit}/${f}`;
}

/**
 * Assign archetypes to hub + faction islands (sector compass, not rings).
 * @param {{ x:number, z:number, r:number, kind?: string, faction?: string }[]} discs
 * @param {number} seedU32
 * @returns {Array<object>} island biome stamps
 */
export function assignIslandBiomes(discs, seedU32 = 1) {
  const out = [];
  for (const d of discs || []) {
    const isHub =
      d.kind === "hub" ||
      d.faction === "neutral" ||
      (Math.hypot(d.x || 0, d.z || 0) < 80 && (d.r || 0) > 0);
    let archId;
    if (isHub) {
      archId = "ethereal_falls";
    } else if (d.faction === "legion") {
      // Legion home = Hellmaw volcanic — world bosses / volcanic islands start here
      archId = "hellmaw";
    } else if (d.faction === "fabled") {
      archId = "starfall";
    } else if (d.faction === "crusade") {
      archId = "frozen_expanse";
    } else if (d.faction === "wild") {
      archId = "wildwood";
    } else {
      // Compass fallback (no faction)
      const ang = Math.atan2(d.z || 0, d.x || 0);
      const deg = ((ang * 180) / Math.PI + 360) % 360;
      if (deg >= 45 && deg < 135) archId = "hellmaw";
      else if (deg >= 135 && deg < 200) archId = "end_of_path";
      else if (deg >= 200 && deg < 250) archId = "wildwood";
      else if (deg >= 250 && deg < 310) archId = "frozen_expanse";
      else if (deg >= 310 || deg < 20) archId = "starfall";
      else archId = "pirate_coves";
    }
    // Seed jitter: wildwood ↔ end_of_path; never demote hellmaw
    const j =
      ((seedU32 + Math.floor((d.x || 0) * 3) + Math.floor((d.z || 0) * 7)) >>>
        0) %
      11;
    if (!isHub && archId === "wildwood" && j === 0) archId = "end_of_path";
    if (!isHub && archId === "starfall" && j === 1) archId = "pirate_coves";

    const arch = ISLAND_ARCHETYPES[archId] || ISLAND_ARCHETYPES.ethereal_falls;
    out.push({
      x: d.x || 0,
      z: d.z || 0,
      r: d.r || 400,
      kind: d.kind || "territory",
      faction: d.faction || null,
      biomeId: arch.id,
      archetype: arch.archetype,
      name: arch.name,
      sectorHint: arch.sectorHint,
      allowWorldBoss: !!arch.allowWorldBoss,
      tags: arch.tags || [],
      danger: arch.danger,
    });
  }
  // Guarantee at least one volcanic if any non-hub island and none assigned
  if (out.some((i) => i.kind !== "hub") && !out.some((i) => i.biomeId === "hellmaw")) {
    let south = out[0];
    for (const i of out) {
      if (i.biomeId === "ethereal_falls") continue;
      if ((i.z || 0) > (south.z || 0)) south = i;
    }
    if (south && south.biomeId !== "ethereal_falls") {
      const arch = ISLAND_ARCHETYPES.hellmaw;
      Object.assign(south, {
        biomeId: arch.id,
        archetype: arch.archetype,
        name: arch.name,
        sectorHint: arch.sectorHint,
        allowWorldBoss: true,
        tags: arch.tags || [],
        danger: arch.danger,
      });
    }
  }
  return out;
}

/**
 * Sample biome at world XZ from **island stamps** (nearest disc wins).
 * @param {number} x
 * @param {number} z
 * @param {{ seedU32?: number, islands?: object[], landDiscs?: object[] }} [ctx]
 */
export function sampleBiome(x, z, ctx = {}) {
  let islands = ctx.islands;
  if (!islands?.length && ctx.landDiscs?.length) {
    islands = assignIslandBiomes(ctx.landDiscs, ctx.seedU32 || 1);
  }
  if (!islands?.length) {
    return { ...ISLAND_ARCHETYPES.ethereal_falls };
  }

  let best = null;
  let bestD = Infinity;
  for (const isl of islands) {
    const d = Math.hypot(x - isl.x, z - isl.z);
    if (d <= isl.r && d < bestD) {
      bestD = d;
      best = isl;
    }
  }
  if (!best) return { ...BIOME_OCEAN };

  const arch =
    ISLAND_ARCHETYPES[best.biomeId] || ISLAND_ARCHETYPES.ethereal_falls;
  const edge = best.r - bestD;
  // Coast strip on any island
  if (edge < best.r * 0.12 && best.biomeId !== "hellmaw") {
    return {
      ...BIOME_COAST,
      parentIsland: best.biomeId,
      island: best,
    };
  }
  // Hellmaw keeps volcanic shore (black sand)
  if (edge < best.r * 0.1 && best.biomeId === "hellmaw") {
    return {
      ...arch,
      id: "hellmaw_coast",
      name: "Hellmaw Shore",
      ground: 0x3a2820,
      sand: 0x2a1a18,
      trees: ["palm", "pine"],
      island: best,
    };
  }
  return { ...arch, island: best };
}

export function biomeTerrainColor(biome, y, waterY, peak = 14) {
  const t = Math.min(1, Math.max(0, (y - waterY) / Math.max(1, peak)));
  let hex = biome.ground || 0x4a7a3a;
  if (t < 0.14) hex = biome.sand || 0xc2b280;
  else if (t > 0.7) hex = biome.rock || 0x8a8a88;
  return {
    r: ((hex >> 16) & 255) / 255,
    g: ((hex >> 8) & 255) / 255,
    b: (hex & 255) / 255,
  };
}

export function pickBiomeTreeId(biome, rand) {
  const list = biome.trees || [];
  if (!list.length) return null;
  return list[Math.floor(rand() * list.length) % list.length];
}

export function pickBiomeRockId(biome, rand) {
  const list = biome.rocks || [];
  if (!list.length) return null;
  return list[Math.floor(rand() * list.length) % list.length];
}

/** Summary for world doc / HUD (islands, not rings). */
export function biomeIslandSummary(islands) {
  return (islands || []).map((i) => ({
    biomeId: i.biomeId,
    name: i.name,
    archetype: i.archetype,
    x: Math.round(i.x),
    z: Math.round(i.z),
    r: Math.round(i.r),
    sectorHint: i.sectorHint,
    allowWorldBoss: !!i.allowWorldBoss,
  }));
}

/** @deprecated use biomeIslandSummary — kept so old imports don't crash */
export function biomeRingSummary() {
  return Object.values(ISLAND_ARCHETYPES).map((b) => ({
    id: b.id,
    name: b.name,
    archetype: b.archetype,
    danger: b.danger,
  }));
}

export function warpedDistance(x, z) {
  return Math.hypot(x, z);
}
