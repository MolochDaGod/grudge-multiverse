/**
 * ═══════════════════════════════════════════════════════════════════════════
 * GRUDGE6 STONE SSOT — Multiverse + fleet agent contract
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * SET IN STONE 2026-08-01. Do not invent alternate CDNs, atlases, or “temp” hosts.
 * Verified live HEAD 200 on every kit + atlas path below.
 *
 * BINARY MESHES
 *   R2 bucket : grudge-assets   (only place bytes live)
 *   Public CDN: https://assets.grudge-studio.com  (Worker in front of that R2)
 *   Open mirror (same keys): https://open.grudge-studio.com  — optional fallback only
 *
 * NOT mesh storage
 *   D1 = index only (meshes / gear_presets / asset_registry)
 *   Railway Postgres = player heroes / bag / account (not kit GLB)
 *
 * LOAD ORDER (browser production)
 *   1. GLB kit:  {CDN}/models/grudge6/races/{PREFIX}_Characters.glb
 *   2. Atlas:    {CDN}/textures/grudge6/{folder}/{file}.webp
 *   3. Equip:    mesh_ids visibility (never swap whole body GLB)
 *   4. Unit:     one uniform SI normalize → ~1.8 m (CDN kits still ~10–22 m raw)
 *   5. Anims:    open.grudge-studio.com/anims/baked/*  (Bip001, strip position)
 *
 * FORBIDDEN
 *   - models/grudge6/atlases/*          (404)
 *   - objectstore…/api/v1/grudge6-*     (often 404; use assets CDN api)
 *   - Meshy / capsules as final hero
 *   - Non-uniform “orc stretch” / body-region hacks
 *   - Second character host (arena CDN characters, random Vercel glb)
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const GRUDGE6_SSOT_VERSION = "2026-08-01.1";

/** Only public mesh CDN (R2 grudge-assets). */
export const CDN = "https://assets.grudge-studio.com";

/** Optional same-key mirror — never primary. */
export const CDN_MIRROR_OPEN = "https://open.grudge-studio.com";

/** SI human yardstick (metres). One uniform scale for every race. */
export const HUMAN_HEIGHT_M = 1.8;

/** Baked anim packs (Bip001 JSON). */
export const ANIMS_BAKED = "https://open.grudge-studio.com/anims/baked";

/** Gear preset JSON (live on assets CDN). */
export const GEAR_PRESETS_URL = `${CDN}/api/v1/grudge6-gear-presets.json`;

/** Race pack manifest. */
export const RACE_MODELS_URL = `${CDN}/asset-packs/toon-rts-characters/race-models.json`;

/** Shared kit helper (equip + path rewrite). */
export const GRUDGE6_KIT_JS = `${CDN}/js/grudge6-kit.js`;

/**
 * 6 races — production browser kit = GLB.
 * FBX exists on same path for convert/authoring fallback only.
 *
 * @type {Record<string, {
 *   raceId: string,
 *   prefix: string,
 *   label: string,
 *   kitGlb: string,
 *   kitFbx: string,
 *   atlasUrl: string,
 *   libraryId: string,
 * }>}
 */
export const RACES = {
  "western-kingdoms": {
    raceId: "western-kingdoms",
    short: "human",
    prefix: "WK_",
    label: "Western Kingdoms",
    kitGlb: `${CDN}/models/grudge6/races/WK_Characters.glb`,
    kitFbx: `${CDN}/models/grudge6/races/WK_Characters.fbx`,
    atlasUrl: `${CDN}/textures/grudge6/western-kingdoms/WK_Standard_Units.webp`,
    libraryId: "human",
    color: "#c9a04e",
  },
  "high-elves": {
    raceId: "high-elves",
    short: "elf",
    prefix: "ELF_",
    label: "High Elves",
    kitGlb: `${CDN}/models/grudge6/races/ELF_Characters.glb`,
    kitFbx: `${CDN}/models/grudge6/races/ELF_Characters.fbx`,
    atlasUrl: `${CDN}/textures/grudge6/elves/ELF_HighElves_Texture.webp`,
    libraryId: "elf",
    color: "#7ec8e3",
  },
  orcs: {
    raceId: "orcs",
    short: "orc",
    prefix: "ORC_",
    label: "Orcs",
    kitGlb: `${CDN}/models/grudge6/races/ORC_Characters.glb`,
    kitFbx: `${CDN}/models/grudge6/races/ORC_Characters.fbx`,
    atlasUrl: `${CDN}/textures/grudge6/orcs/ORC_StandardUnits.webp`,
    libraryId: "orc",
    color: "#8b2020",
  },
  undead: {
    raceId: "undead",
    short: "undead",
    prefix: "UD_",
    label: "Undead",
    kitGlb: `${CDN}/models/grudge6/races/UD_Characters.glb`,
    kitFbx: `${CDN}/models/grudge6/races/UD_Characters.fbx`,
    atlasUrl: `${CDN}/textures/grudge6/undead/UD_Standard_Units.webp`,
    libraryId: "undead",
    color: "#6a3a8a",
  },
  barbarians: {
    raceId: "barbarians",
    short: "barbarian",
    prefix: "BRB_",
    label: "Barbarians",
    kitGlb: `${CDN}/models/grudge6/races/BRB_Characters.glb`,
    kitFbx: `${CDN}/models/grudge6/races/BRB_Characters.fbx`,
    atlasUrl: `${CDN}/textures/grudge6/barbarians/BRB_StandardUnits_texture.webp`,
    libraryId: "barbarian",
    color: "#c2410c",
  },
  dwarves: {
    raceId: "dwarves",
    short: "dwarf",
    prefix: "DWF_",
    label: "Dwarves",
    kitGlb: `${CDN}/models/grudge6/races/DWF_Characters.glb`,
    kitFbx: `${CDN}/models/grudge6/races/DWF_Characters.fbx`,
    atlasUrl: `${CDN}/textures/grudge6/dwarves/DWF_Standard_Units.webp`,
    libraryId: "dwarf",
    color: "#4a90d9",
  },
};

/** Alias short → raceId */
export const RACE_ALIASES = {
  human: "western-kingdoms",
  humans: "western-kingdoms",
  wk: "western-kingdoms",
  elf: "high-elves",
  elves: "high-elves",
  "high-elf": "high-elves",
  orc: "orcs",
  undead: "undead",
  ud: "undead",
  barbarian: "barbarians",
  brb: "barbarians",
  dwarf: "dwarves",
  dwarves: "dwarves",
  dwf: "dwarves",
};

export function resolveRaceId(idOrShort) {
  const k = String(idOrShort || "").toLowerCase().trim();
  if (RACES[k]) return k;
  if (RACE_ALIASES[k]) return RACE_ALIASES[k];
  // match short field
  for (const r of Object.values(RACES)) {
    if (r.short === k || r.raceId === k) return r.raceId;
  }
  return "western-kingdoms";
}

export function getRace(idOrShort) {
  return RACES[resolveRaceId(idOrShort)] || RACES["western-kingdoms"];
}

/** Production kit URL (GLB only). */
export function kitUrl(idOrShort) {
  return getRace(idOrShort).kitGlb;
}

export function atlasUrl(idOrShort) {
  return getRace(idOrShort).atlasUrl;
}

export function libraryJsonUrl(idOrShort) {
  const r = getRace(idOrShort);
  return `${CDN}/models/grudge6/races/library/${r.libraryId}/library.json`;
}

/**
 * Paths that MUST NOT be used (known 404 / wrong).
 * Agents: if you generate a URL matching these, you are wrong.
 */
export const FORBIDDEN_PATH_FRAGMENTS = [
  "/models/grudge6/atlases/",
  "objectstore.grudge-studio.com/api/v1/grudge6",
  "cdn.grudge-studio.com/models/grudge6",
  "r2.grudge-studio.com/",
  "grudge-arena.grudge-studio.com/cdn/assets/characters",
  "models/grudge6/metaverse/",
];

export function assertAllowedKitUrl(url) {
  const u = String(url || "");
  for (const bad of FORBIDDEN_PATH_FRAGMENTS) {
    if (u.includes(bad)) {
      throw new Error(`[grudge6SSOT] FORBIDDEN kit URL: ${u} (matched ${bad})`);
    }
  }
  if (!u.includes("/models/grudge6/races/") || !u.endsWith("_Characters.glb")) {
    console.warn("[grudge6SSOT] non-canonical kit URL (expected …/races/{PFX}_Characters.glb):", u);
  }
  return u;
}

/** List for UI / debug. */
export function raceList() {
  return Object.values(RACES);
}

/** Runtime stamp so console proves which SSOT shipped. */
export function logSSOT() {
  console.info(
    `[grudge6SSOT ${GRUDGE6_SSOT_VERSION}] CDN=${CDN} races=${Object.keys(RACES).length} ` +
      `kits=GLB primary human=${HUMAN_HEIGHT_M}m R2=grudge-assets`,
  );
}
