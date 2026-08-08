/**
 * Grudge Multiverse — Valheim-style world seed generator (isomorphic).
 *
 * SAME module for:
 *   - Browser SPA (Vite imports via game/worldSeedGen.js)
 *   - Railway room server (server/index.mjs)
 *
 * Contract: one seed string → one WorldDocument.
 * Clients must NOT invent a different world than the room welcome seed.
 *
 * Schema: grudge.multiverse.world/v1
 * Info hub: https://info.grudge-studio.com/docs
 */

import {
  BIOME_GEN,
  sampleBiome,
  assignIslandBiomes,
  biomeIslandSummary,
  ISLAND_ARCHETYPES,
} from "./biomeSsot.mjs";

export const WORLD_SCHEMA = "grudge.multiverse.world/v1";
export const WORLD_GEN_VERSION = "2026-08-08.5-island-biomes";

/**
 * Seed play space — SI metres (same as Island-Crusade / Valheim-scale).
 * 5 km × 5 km world box; playable disc radius WORLD_RADIUS_M.
 */
export const WORLD_SIZE_M = 5000;
export const WORLD_HALF_M = WORLD_SIZE_M / 2;
/** Playable ocean disc radius (content clamps outside this). */
export const WORLD_RADIUS_M = 2400;
/** Neutral hub island / town radius. */
export const HUB_RADIUS_M = 340;
/** Faction capitals ring radius from origin. */
export const FACTION_RING_M = 1550;
/** Default land/coast radius for generation (full 5 km realm). */
export const DEFAULT_LAND_RADIUS_M = WORLD_RADIUS_M;

/** Grudge Info (info.grudge-studio.com) — product SSOT links, not mesh CDN. */
export const GRUDGE_INFO = {
  hub: "https://info.grudge-studio.com/docs",
  root: "https://info.grudge-studio.com/",
  /** Soft paths for main-panel / systems docs (HTML docs hub). */
  topics: {
    items: "https://info.grudge-studio.com/docs#items",
    skills: "https://info.grudge-studio.com/docs#skills",
    tiers: "https://info.grudge-studio.com/docs#tiers",
    models: "https://info.grudge-studio.com/docs#models",
    factions: "https://info.grudge-studio.com/docs#factions",
  },
};

/**
 * Default world seed when room/URL omit ?seed= (Valheim-style map identity).
 * Production default: VALHEIM42
 */
export const DEFAULT_WORLD_SEED = "VALHEIM42";

export const FACTION_ORDER = ["crusade", "fabled", "legion", "wild"];

export const FACTION_THEMES = {
  crusade: {
    faction: "crusade",
    name: "Crusade Marches",
    accent: "#c9a227",
    raceId: "western-kingdoms",
    enemyRace: "orcs",
    aggression: 1.0,
    kit: "castle",
  },
  fabled: {
    faction: "fabled",
    name: "Fabled Wilds",
    accent: "#4c8fe0",
    raceId: "high-elves",
    enemyRace: "undead",
    aggression: 0.85,
    kit: "village",
  },
  legion: {
    faction: "legion",
    name: "Legion Wastes",
    accent: "#b8402e",
    raceId: "orcs",
    enemyRace: "orcs",
    aggression: 1.25,
    kit: "orc",
  },
  wild: {
    faction: "wild",
    name: "Wild Frontier",
    accent: "#5a8f4a",
    raceId: "barbarians",
    enemyRace: "orcs",
    aggression: 1.1,
    kit: "village",
  },
  neutral: {
    faction: "neutral",
    name: "Grudgehold",
    accent: "#e8d9a8",
    raceId: "western-kingdoms",
    enemyRace: "orcs",
    aggression: 0,
    kit: "village",
  },
};

// ─── PRNG (mulberry32 family) ───────────────────────────────────────────────

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** String or number → stable u32 seed (Valheim-style). */
export function parseSeed(input) {
  if (input == null || input === "") return hashString(DEFAULT_WORLD_SEED);
  if (typeof input === "number" && Number.isFinite(input)) {
    return input >>> 0 || hashString(DEFAULT_WORLD_SEED);
  }
  const s = String(input).trim();
  if (/^\d+$/.test(s)) return (Number(s) >>> 0) || hashString(s);
  return hashString(s);
}

export function hashString(str) {
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function childSeed(tag, baseU32) {
  let h = baseU32 >>> 0;
  const t = String(tag);
  for (let i = 0; i < t.length; i++) {
    h = Math.imul(h ^ t.charCodeAt(i), 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Normalize room / UI seed label. */
export function normalizeSeedLabel(raw) {
  const s = String(raw || DEFAULT_WORLD_SEED)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 24);
  return s || DEFAULT_WORLD_SEED;
}

/**
 * Resolve seed from URL, room code, or env-style defaults.
 * Priority: ?seed= → #seed= → room hash → default
 */
export function resolveSeedFromContext(opts = {}) {
  const {
    search = "",
    hash = "",
    roomCode = "",
    explicit = null,
  } = opts;
  if (explicit) return normalizeSeedLabel(explicit);
  try {
    const q = new URLSearchParams(
      String(search || "").replace(/^\?/, ""),
    );
    if (q.get("seed")) return normalizeSeedLabel(q.get("seed"));
  } catch {
    /* */
  }
  const h = String(hash || "");
  const m = h.match(/seed=([A-Za-z0-9_-]+)/i);
  if (m) return normalizeSeedLabel(m[1]);
  // room1 → ROOM1 as soft seed unless generic
  const room = String(roomCode || "")
    .replace(/^#/, "")
    .replace(/^MV/i, "");
  if (room && !/^room\d*$/i.test(room) && room.length >= 3) {
    return normalizeSeedLabel(room);
  }
  return DEFAULT_WORLD_SEED;
}

// ─── World generation ───────────────────────────────────────────────────────

const VENDOR_LABELS = ["Blacksmith", "Merchant", "Alchemist", "Fletcher", "Provisioner"];
const VENDOR_KEYS = ["weapon", "armor", "alchemist", "fletcher", "provisioner"];
const VENDOR_CLASSES = ["knight", "mage", "mage", "ranger", "ranger"];

const VILLAGE_NAMES = {
  crusade: ["Ashford", "Goldmere", "Stonewatch", "Hearthgate", "Sunvale"],
  fabled: ["Moonwell", "Sylvarin", "Starfen", "Glimmerbrook", "Elaris"],
  legion: ["Bloodspike", "Ashkar", "Ironjaw", "Skullford", "Warfen"],
  wild: ["Thorncamp", "Redoak", "Wolfden", "Barrenpost", "Greymound"],
};

/**
 * Generate full world document — **5 km × 5 km SI** seed space.
 * Bermuda mesh may sit at the hub; faction islands ring at FACTION_RING_M.
 *
 * @param {string|number} seedInput
 * @param {{ landRadius?: number, hubRadius?: number, density?: number, worldSize?: number }} [opts]
 * @returns {object} WorldDocument
 */
export function generateWorld(seedInput, opts = {}) {
  const seedLabel = normalizeSeedLabel(
    typeof seedInput === "string" ? seedInput : String(seedInput ?? DEFAULT_WORLD_SEED),
  );
  const seedU32 = parseSeed(seedLabel);
  // Fixed 5 km realm unless explicitly overridden (e.g. tests)
  const worldSize = Math.max(1000, Number(opts.worldSize) || WORLD_SIZE_M);
  const worldHalf = worldSize / 2;
  const landRadius = Math.max(
    500,
    Number(opts.landRadius) || DEFAULT_LAND_RADIUS_M,
  );
  const hubRadius = Math.max(80, Number(opts.hubRadius) || HUB_RADIUS_M);
  const density = Math.min(2, Math.max(0.6, Number(opts.density) || 1.15));
  const rng = mulberry32(seedU32);
  const ringRot = rng() * Math.PI * 2;
  const ringR = FACTION_RING_M * (0.92 + rng() * 0.16);

  const factions = FACTION_ORDER.map((f, i) => {
    const theme = FACTION_THEMES[f];
    const ang = ringRot + (i / FACTION_ORDER.length) * Math.PI * 2;
    return {
      ...theme,
      angle: ang,
      // capital on faction island centre (Crusade-style ring)
      capitalR: ringR,
      islandRadius: 600 * (0.9 + rng() * 0.25),
      islandPeak: 30 + rng() * 16,
    };
  });

  /** @type {object[]} */
  const zones = [
    {
      id: "zone-hub",
      faction: "neutral",
      name: "Grudgehold Hub",
      kind: "hub",
      x: 0,
      z: 0,
      radius: hubRadius,
      accent: FACTION_THEMES.neutral.accent,
    },
  ];

  for (const f of factions) {
    zones.push({
      id: `zone-${f.faction}`,
      faction: f.faction,
      name: f.name,
      kind: "territory",
      angle: f.angle,
      // Island disc around capital
      x: Math.cos(f.angle) * f.capitalR,
      z: Math.sin(f.angle) * f.capitalR,
      radius: f.islandRadius,
      innerR: hubRadius * 1.05,
      outerR: landRadius * 0.98,
      accent: f.accent,
      aggression: f.aggression,
      raceId: f.raceId,
    });
  }

  /** @type {object[]} */
  const settlements = [];
  /** @type {object[]} */
  const npcs = [];
  /** @type {object[]} */
  const hostiles = [];
  /** @type {object[]} */
  const animals = [];
  /** @type {object[]} */
  const pois = [];
  /** @type {object[]} */
  const harbors = [];
  /** @type {object[]} */
  const seaLanes = [];

  // Island biomes (sector map) — not distance rings
  const landDiscsForBiome = [
    {
      x: 0,
      z: 0,
      r: Math.max(hubRadius * 1.15, 360),
      kind: "hub",
      faction: "neutral",
    },
    ...factions.map((f) => ({
      x: Math.cos(f.angle) * f.capitalR,
      z: Math.sin(f.angle) * f.capitalR,
      r: f.islandRadius,
      kind: "territory",
      faction: f.faction,
    })),
  ];
  const islandBiomes = assignIslandBiomes(landDiscsForBiome, seedU32);
  const biomeAt = (x, z) =>
    sampleBiome(x, z, { seedU32, islands: islandBiomes });

  // Stamp archetype on zones
  for (const z0 of zones) {
    const ib = islandBiomes.find(
      (i) =>
        Math.hypot(i.x - (z0.x || 0), i.z - (z0.z || 0)) < 40 ||
        (z0.kind === "hub" && i.biomeId === "ethereal_falls"),
    );
    if (ib) {
      z0.biomeId = ib.biomeId;
      z0.archetype = ib.archetype;
      z0.sectorHint = ib.sectorHint;
      z0.allowWorldBoss = ib.allowWorldBoss;
      z0.biomeName = ib.name;
    }
  }

  // Hub capital — Ethereal Falls / Sanctuary
  settlements.push({
    id: "town-neutral",
    faction: "neutral",
    kind: "town",
    kit: "village",
    name: "Grudgehold",
    x: 0,
    z: 0,
    radius: 34,
    biome: "ethereal_falls",
    archetype: "home",
    accent: FACTION_THEMES.neutral.accent,
    population: Math.round(12 * density),
  });
  pushTownNpcs(npcs, settlements[0], FACTION_THEMES.neutral, density, rng);

  // Hub POIs
  pois.push(
    poi("poi-info-obelisk", "Grudge Info Obelisk", 0, hubRadius * 0.35, "info", "#d4a84b", {
      url: GRUDGE_INFO.hub,
    }),
    poi("poi-training", "Training Yard", hubRadius * 0.4, 0, "training", "#88aacc"),
  );

  for (const f of factions) {
    const cx = Math.cos(f.angle) * f.capitalR;
    const cz = Math.sin(f.angle) * f.capitalR;
    const capital = {
      id: `town-${f.faction}`,
      faction: f.faction,
      kind: "town",
      kit: f.kit,
      name: `${f.name.split(" ")[0]} Capital`,
      x: cx,
      z: cz,
      radius: 28,
      accent: f.accent,
      population: Math.round(10 * density),
    };
    settlements.push(capital);
    pushTownNpcs(npcs, capital, f, density, rng);

    // Villages (2–4 per faction)
    const nVill = Math.round(2 + density + rng() * 2);
    const names = VILLAGE_NAMES[f.faction] || VILLAGE_NAMES.wild;
    for (let v = 0; v < nVill; v++) {
      const va = f.angle + (rng() - 0.5) * 0.9;
      const vr = landRadius * (0.28 + rng() * 0.45);
      const village = {
        id: `village-${f.faction}-${v}`,
        faction: f.faction,
        kind: "village",
        kit: "village",
        name: names[v % names.length],
        x: Math.cos(va) * vr,
        z: Math.sin(va) * vr,
        radius: 14 + rng() * 6,
        accent: f.accent,
        population: Math.round(4 + rng() * 4 * density),
      };
      settlements.push(village);
      // Smaller market: 2 vendors + 1 guard
      pushVillageNpcs(npcs, village, f, rng);
    }

    // Farms
    const nFarm = Math.round(1 + density * 0.8);
    for (let k = 0; k < nFarm; k++) {
      const fa = f.angle + (rng() - 0.5) * 0.7;
      const fr = landRadius * (0.3 + rng() * 0.2);
      settlements.push({
        id: `farm-${f.faction}-${k}`,
        faction: f.faction,
        kind: "farm",
        kit: "village",
        name: `${names[k % names.length]} Farm`,
        x: Math.cos(fa) * fr,
        z: Math.sin(fa) * fr,
        radius: 16,
        accent: f.accent,
      });
    }

    // Enemy camps
    const nCamp = Math.round(2 + density);
    for (let k = 0; k < nCamp; k++) {
      const ca = f.angle + Math.PI * (0.25 + rng() * 0.5) * (rng() > 0.5 ? 1 : -1);
      const cr = landRadius * (0.55 + rng() * 0.28);
      const camp = {
        id: `camp-${f.faction}-${k}`,
        faction: f.faction,
        kind: "camp",
        kit: "orc",
        name: `${f.faction} Raider Camp`,
        x: Math.cos(ca) * cr,
        z: Math.sin(ca) * cr,
        radius: 12 + rng() * 4,
        accent: "#8b2020",
      };
      settlements.push(camp);
      const nRaid = Math.round(3 + density * 2);
      for (let r = 0; r < nRaid; r++) {
        const a = (r / nRaid) * Math.PI * 2 + rng() * 0.3;
        hostiles.push({
          id: `${camp.id}-raider-${r}`,
          campId: camp.id,
          faction: f.faction,
          role: "raider",
          label: "Raider",
          raceId: f.enemyRace === "undead" ? "undead" : "orcs",
          classId: "warrior",
          x: camp.x + Math.cos(a) * (5 + rng() * 4),
          z: camp.z + Math.sin(a) * (5 + rng() * 4),
          hp: 80 + Math.floor(rng() * 40),
          dmg: 10 + Math.floor(rng() * 6),
          hostile: true,
        });
      }
    }

    // POIs: shrine, mine, watchtower
    pois.push(
      poi(
        `poi-shrine-${f.faction}`,
        `${f.name} Shrine`,
        Math.cos(f.angle + 0.4) * landRadius * 0.4,
        Math.sin(f.angle + 0.4) * landRadius * 0.4,
        "shrine",
        f.accent,
      ),
      poi(
        `poi-mine-${f.faction}`,
        `${f.name} Mine`,
        Math.cos(f.angle - 0.5) * landRadius * 0.62,
        Math.sin(f.angle - 0.5) * landRadius * 0.62,
        "mine",
        "#888899",
      ),
      poi(
        `poi-tower-${f.faction}`,
        `Watchtower`,
        Math.cos(f.angle) * landRadius * 0.75,
        Math.sin(f.angle) * landRadius * 0.75,
        "tower",
        f.accent,
      ),
    );

    // Coastal harbor (boat dock) — seaward of capital
    const harborR = landRadius * (0.9 + rng() * 0.06);
    const harborA = f.angle + (rng() - 0.5) * 0.25;
    const hx = Math.cos(harborA) * harborR;
    const hz = Math.sin(harborA) * harborR;
    const harbor = {
      id: `harbor-${f.faction}`,
      name: `${f.name.split(" ")[0]} Harbor`,
      kind: "harbor",
      faction: f.faction,
      x: hx,
      z: hz,
      accent: f.accent,
      radius: 8,
      boats: Math.round(1 + density * 0.5),
    };
    harbors.push(harbor);
    pois.push(poi(harbor.id, harbor.name, hx, hz, "harbor", f.accent, { faction: f.faction }));
  }

  // Hub harbor (south)
  harbors.push({
    id: "harbor-hub",
    name: "Grudgehold Docks",
    kind: "harbor",
    faction: "neutral",
    x: 0,
    z: landRadius * 0.88,
    accent: "#4a90d9",
    radius: 10,
    boats: 2,
  });
  pois.push(
    poi("harbor-hub", "Grudgehold Docks", 0, landRadius * 0.88, "harbor", "#4a90d9"),
  );

  // Sea lanes between harbors (for map UI / future convoy AI)
  for (let i = 0; i < harbors.length; i++) {
    const a = harbors[i];
    const b = harbors[(i + 1) % harbors.length];
    seaLanes.push({
      id: `lane-${a.id}-${b.id}`,
      from: a.id,
      to: b.id,
      ax: a.x,
      az: a.z,
      bx: b.x,
      bz: b.z,
    });
  }

  // Wildlife scatter (seeded)
  const wildSpecies = [
    { species: "Deer", height: 1.5, maxHp: 60, loot: { id: "deer_hide", name: "Deer Hide" }, color: 0x8b6914, hostile: false },
    { species: "Stag", height: 1.8, maxHp: 95, loot: { id: "stag_pelt", name: "Stag Pelt" }, color: 0x6b4423, hostile: false },
    { species: "Fox", height: 0.5, maxHp: 35, loot: { id: "fox_fur", name: "Fox Fur" }, color: 0xc45c26, hostile: false },
    { species: "Wolf", height: 0.9, maxHp: 75, loot: { id: "wolf_pelt", name: "Wolf Pelt" }, color: 0x555566, hostile: true },
  ];
  for (const sp of wildSpecies) {
    const n = Math.round((sp.hostile ? 5 : 4) * density + rng() * 3);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2;
      const r = hubRadius * 1.3 + rng() * (landRadius * 0.6);
      animals.push({
        id: `wild-${sp.species}-${i}`,
        ...sp,
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        domestic: false,
      });
    }
  }

  // Farm animals near farms
  const farmSpecies = [
    { species: "Cow", height: 1.6, maxHp: 120, loot: { id: "cowhide", name: "Cowhide" }, color: 0xd0d0d0 },
    { species: "Bull", height: 1.8, maxHp: 150, loot: { id: "bull_leather", name: "Bull Leather" }, color: 0x3a2a1a },
    { species: "Alpaca", height: 1.4, maxHp: 80, loot: { id: "alpaca_wool", name: "Alpaca Wool" }, color: 0xe8e0d0 },
  ];
  let fi = 0;
  for (const s of settlements.filter((x) => x.kind === "farm")) {
    for (let k = 0; k < 3; k++) {
      const sp = farmSpecies[(fi + k) % farmSpecies.length];
      const a = rng() * Math.PI * 2;
      animals.push({
        id: `farm-${s.id}-${k}`,
        ...sp,
        x: s.x + Math.cos(a) * (3 + rng() * 7),
        z: s.z + Math.sin(a) * (3 + rng() * 7),
        domestic: true,
        hostile: false,
      });
    }
    fi++;
  }

  const doc = {
    schema: WORLD_SCHEMA,
    genVersion: WORLD_GEN_VERSION,
    seed: seedLabel,
    seedU32,
    /** 5 km × 5 km SI box */
    worldSizeM: worldSize,
    worldHalfM: worldHalf,
    worldRadiusM: landRadius,
    landRadius,
    hubRadius,
    factionRingM: ringR,
    density,
    ringRotation: ringRot,
    units: "si_metres",
    factions: factions.map((f) => ({
      faction: f.faction,
      name: f.name,
      accent: f.accent,
      raceId: f.raceId,
      aggression: f.aggression,
      angle: f.angle,
    })),
    zones,
    settlements,
    npcs,
    hostiles,
    animals,
    pois,
    harbors,
    seaLanes,
    counts: {
      settlements: settlements.length,
      npcs: npcs.length,
      hostiles: hostiles.length,
      animals: animals.length,
      pois: pois.length,
      zones: zones.length,
      harbors: harbors.length,
      seaLanes: seaLanes.length,
    },
    grudgeInfo: GRUDGE_INFO,
    playMesh: {
      kind: "bermuda_glb_hub",
      url: "https://assets.grudge-studio.com/models/maps/bermuda.glb",
      note: "5 km seed space; Bermuda mesh at hub; faction islands use footing pads + ocean",
    },
    nav: {
      land: "heightfield_grid_5km",
      sea: "water_mask_inverse",
      lod: true,
      worldSizeM: worldSize,
    },
    biomes: {
      gen: BIOME_GEN,
      mode: "island_archetypes",
      islands: biomeIslandSummary(islandBiomes),
      note: "Valheim systems per island (sector map): Ethereal Falls hub, Hellmaw volcanic S, End of Path mist, etc. — not distance rings",
    },
    summary: `${seedLabel} · 5×5 km · islands ${islandBiomes.map((i) => i.biomeId).join("+")} · ${settlements.length} sites · ${npcs.length} NPCs · ${hostiles.length} hostiles · ${harbors.length} harbors`,
  };

  // Stamp biome from nearest island
  for (const s of settlements) {
    if (!s.biome) {
      const b = biomeAt(s.x, s.z);
      s.biome = b.id;
      s.archetype = b.archetype;
    }
  }
  for (const p of pois) {
    if (!p.biome) p.biome = biomeAt(p.x, p.z).id;
  }
  for (const h of harbors) {
    if (!h.biome) h.biome = biomeAt(h.x, h.z).id || "coast";
  }
  for (const a of animals) {
    if (!a.biome) a.biome = biomeAt(a.x, a.z).id;
  }
  for (const h of hostiles) {
    if (!h.biome) h.biome = biomeAt(h.x, h.z).id;
  }

  return doc;
}

export {
  sampleBiome,
  BIOME_GEN,
  assignIslandBiomes,
  ISLAND_ARCHETYPES,
};

function poi(id, name, x, z, kind, accent, extra = {}) {
  return { id, name, x, z, kind, accent, radius: 3.5, ...extra };
}

function pushTownNpcs(npcs, town, theme, density, rng) {
  const raceId = theme.raceId || "western-kingdoms";
  const cx = town.x;
  const cz = town.z;
  const nVend = Math.min(5, Math.round(3 + density));
  for (let i = 0; i < nVend; i++) {
    const t = (i - (nVend - 1) / 2) * 0.55;
    npcs.push({
      id: `${town.id}-vendor-${i}`,
      townId: town.id,
      faction: town.faction,
      role: "vendor",
      label: VENDOR_LABELS[i % VENDOR_LABELS.length],
      vendorKey: VENDOR_KEYS[i % VENDOR_KEYS.length],
      classId: VENDOR_CLASSES[i % VENDOR_CLASSES.length],
      raceId,
      x: cx + t * 7,
      z: cz - 9,
      rotationY: 0,
      accent: theme.accent,
    });
  }
  const nGuard = Math.round(2 + density);
  for (let i = 0; i < nGuard; i++) {
    const a = (i / nGuard) * Math.PI * 2 + rng() * 0.2;
    const x = cx + Math.cos(a) * 11;
    const z = cz + Math.sin(a) * 11;
    npcs.push({
      id: `${town.id}-guard-${i}`,
      townId: town.id,
      faction: town.faction,
      role: "guard",
      label: "Town Guard",
      classId: "warrior",
      raceId,
      x,
      z,
      rotationY: Math.atan2(cx - x, cz - z),
      accent: theme.accent,
    });
  }
  npcs.push({
    id: `${town.id}-captain`,
    townId: town.id,
    faction: town.faction,
    role: "captain",
    label: "Captain — Missions",
    classId: "knight",
    raceId,
    x: cx,
    z: cz + 1,
    rotationY: 0,
    mounted: true,
    accent: theme.accent,
  });
}

function pushVillageNpcs(npcs, village, theme, rng) {
  const raceId = theme.raceId || "western-kingdoms";
  npcs.push({
    id: `${village.id}-vendor-0`,
    townId: village.id,
    faction: village.faction,
    role: "vendor",
    label: "Merchant",
    vendorKey: "merchant",
    classId: "mage",
    raceId,
    x: village.x,
    z: village.z - 4,
    rotationY: 0,
    accent: theme.accent,
  });
  npcs.push({
    id: `${village.id}-guard-0`,
    townId: village.id,
    faction: village.faction,
    role: "guard",
    label: "Village Guard",
    classId: "warrior",
    raceId,
    x: village.x + 5,
    z: village.z + 3,
    rotationY: rng() * Math.PI * 2,
    accent: theme.accent,
  });
}

/**
 * Faction at XZ given a generated world document.
 */
export function factionAtWorld(x, z, world) {
  if (!world) return FACTION_THEMES.neutral;
  const d = Math.hypot(x, z);
  const hubR = world.hubRadius || HUB_RADIUS_M;
  if (d <= hubR) return FACTION_THEMES.neutral;
  // Prefer island discs when present
  for (const z0 of world.zones || []) {
    if (z0.kind !== "territory" || z0.x == null) continue;
    const rd = Math.hypot(x - z0.x, z - z0.z);
    if (rd <= (z0.radius || 600)) {
      return FACTION_THEMES[z0.faction] || FACTION_THEMES.neutral;
    }
  }
  if (d > (world.landRadius || WORLD_RADIUS_M) * 1.05) return FACTION_THEMES.neutral;
  const ang = Math.atan2(z, x);
  let best = FACTION_ORDER[0];
  let bestDa = Infinity;
  for (const f of world.factions || []) {
    let da = Math.abs(ang - f.angle);
    while (da > Math.PI) da = Math.abs(da - Math.PI * 2);
    if (da < bestDa) {
      bestDa = da;
      best = f.faction;
    }
  }
  return FACTION_THEMES[best] || FACTION_THEMES.neutral;
}

/** Compact payload for WS welcome (full lists kept server-side optional). */
export function worldWelcomePayload(world) {
  if (!world) return null;
  return {
    schema: world.schema,
    genVersion: world.genVersion,
    seed: world.seed,
    seedU32: world.seedU32,
    landRadius: world.landRadius,
    hubRadius: world.hubRadius,
    density: world.density,
    counts: world.counts,
    summary: world.summary,
    grudgeInfo: world.grudgeInfo,
    playMesh: world.playMesh,
    factions: world.factions,
    // Full arrays for client rebuild (same seed regenerates; send seed is enough).
    // Sending seed only is preferred; client always re-generates from seed+landRadius.
  };
}
