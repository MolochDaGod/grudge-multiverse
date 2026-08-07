/**
 * ═══════════════════════════════════════════════════════════════════════════
 * GRUDGE6 STONE SSOT — Multiverse + fleet agent contract
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ★ PLAY MESH (only production primary):
 *   {CDN}/asset-packs/toon-rts-characters/glb/characters/{raceId}.glb
 *   raceId = human | elf | orc | undead | barbarian | dwarf
 *
 * Atlas:
 *   {CDN}/textures/grudge6/{folder}/{file}.webp
 *
 * Equip: mesh_ids visibility (never whole-body GLB swap)
 * Unit:  one uniform SI fit → ~1.8 m human yardstick
 * Anims: open.grudge-studio.com/anims/baked/*  (Bip001, strip position)
 *
 * LEGACY (fallback only — wrong bake / compare):
 *   models/grudge6/races/{PREFIX}_Characters.glb
 *
 * FORBIDDEN primary:
 *   - models/grudge6/metaverse/*
 *   - models/grudge6/atlases/*
 *   - Meshy / capsules as final hero
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Bump when kit/atlas/anim contracts change — used as asset query bust. */
export const GRUDGE6_SSOT_VERSION = "2026-08-07.1-failclosed";

/** Append to CDN asset URLs so clients drop stale browser cache after SSOT ship. */
export function assetUrlBust(url) {
  const u = String(url || "");
  if (!u || u.startsWith("blob:") || u.startsWith("data:")) return u;
  const stamp = GRUDGE6_SSOT_VERSION.replace(/[^a-zA-Z0-9._-]/g, "");
  if (u.includes("v=" + stamp)) return u;
  return u.includes("?") ? `${u}&v=${stamp}` : `${u}?v=${stamp}`;
}

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
/** Toon RTS ★ play mesh path. */
export function toonRtsKitUrl(libraryId) {
  return `${CDN}/asset-packs/toon-rts-characters/glb/characters/${libraryId}.glb`;
}

/** Legacy races bake — fallback only. */
export function legacyRaceKitUrl(prefixFile) {
  return `${CDN}/models/grudge6/races/${prefixFile}`;
}

export const RACES = {
  "western-kingdoms": {
    raceId: "western-kingdoms",
    short: "human",
    prefix: "WK_",
    label: "Western Kingdoms",
    kitGlb: toonRtsKitUrl("human"),
    kitFallback: legacyRaceKitUrl("WK_Characters.glb"),
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
    kitGlb: toonRtsKitUrl("elf"),
    kitFallback: legacyRaceKitUrl("ELF_Characters.glb"),
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
    kitGlb: toonRtsKitUrl("orc"),
    kitFallback: legacyRaceKitUrl("ORC_Characters.glb"),
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
    kitGlb: toonRtsKitUrl("undead"),
    kitFallback: legacyRaceKitUrl("UD_Characters.glb"),
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
    kitGlb: toonRtsKitUrl("barbarian"),
    kitFallback: legacyRaceKitUrl("BRB_Characters.glb"),
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
    kitGlb: toonRtsKitUrl("dwarf"),
    kitFallback: legacyRaceKitUrl("DWF_Characters.glb"),
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

/** True if URL is Toon RTS ★ play mesh. */
export function isToonRtsKitUrl(url) {
  return /asset-packs\/toon-rts-characters\/glb\/characters\/[a-z]+\.glb/i.test(String(url || ""));
}

/**
 * Accept Toon RTS ★ as canonical; allow legacy races as explicit fallback.
 * Throw on metaverse / forbidden hosts.
 */
export function assertAllowedKitUrl(url) {
  const u = String(url || "");
  for (const bad of FORBIDDEN_PATH_FRAGMENTS) {
    if (u.includes(bad)) {
      throw new Error(`[grudge6SSOT] FORBIDDEN kit URL: ${u} (matched ${bad})`);
    }
  }
  if (isToonRtsKitUrl(u)) return u;
  if (u.includes("/models/grudge6/races/") && /_Characters\.glb$/i.test(u)) {
    console.warn("[grudge6SSOT] legacy races kit (fallback only — prefer Toon RTS ★):", u);
    return u;
  }
  console.warn(
    "[grudge6SSOT] non-canonical kit URL (expected …/toon-rts-characters/glb/characters/{race}.glb):",
    u,
  );
  return u;
}

/**
 * PLAY candidates = Toon RTS only.
 * Legacy races bake only when caller sets ?mvLegacyKit=1 (see grudge6Loader).
 * Never metaverse / FBX as play.
 */
export function kitUrlCandidates(idOrShort, { allowLegacy = false } = {}) {
  const r = getRace(idOrShort);
  const list = [r.kitGlb];
  if (allowLegacy && r.kitFallback && r.kitFallback !== r.kitGlb) list.push(r.kitFallback);
  return list;
}

/** List for UI / debug. */
export function raceList() {
  return Object.values(RACES);
}

/** Runtime stamp so console proves which SSOT shipped. */
export function logSSOT() {
  console.info(
    `[grudge6SSOT ${GRUDGE6_SSOT_VERSION}] CDN=${CDN} races=${Object.keys(RACES).length} ` +
      `play=ToonRTS★ human=${HUMAN_HEIGHT_M}m R2=grudge-assets anims=${ANIMS_BAKED}`,
  );
}

/**
 * Production character source contract — single object every loader must stamp.
 * Deployed usage: kit GLB + body atlas from assets CDN, anims from Open baked, SI 1.8 m.
 *
 * @param {string} raceId
 * @param {string} [classId]
 * @param {{ animPack?: string, visibleMeshes?: string[], kitUrl?: string, atlasUrl?: string }} [extra]
 */
export function resolveCharacterSource(raceId, classId = "warrior", extra = {}) {
  const race = getRace(raceId);
  const kit = assertAllowedKitUrl(extra.kitUrl || race.kitGlb);
  const atlas = extra.atlasUrl || race.atlasUrl;
  return {
    ssotVersion: GRUDGE6_SSOT_VERSION,
    units: "si_metres",
    humanHeightM: HUMAN_HEIGHT_M,
    raceId: race.raceId,
    raceLabel: race.label,
    prefix: race.prefix,
    classId: classId || "warrior",
    kitUrl: kit,
    atlasUrl: atlas,
    animsHost: ANIMS_BAKED,
    animPack: extra.animPack || "sword_shield",
    meshIds: Array.isArray(extra.visibleMeshes) ? extra.visibleMeshes.slice() : [],
    cdn: CDN,
    forbidden: FORBIDDEN_PATH_FRAGMENTS,
  };
}

/** All production URLs deploy-gate / agents should HEAD. */
export function productionCharacterUrls() {
  const kits = [];
  const atlases = [];
  for (const r of Object.values(RACES)) {
    kits.push(r.kitGlb);
    atlases.push(r.atlasUrl);
  }
  return {
    kits,
    atlases,
    animWalk: `${ANIMS_BAKED}/magic/Standing%20Walk%20Forward.json`,
    animRun: `${ANIMS_BAKED}/locomotion/run_forward.json`,
    animIdle2h: `${ANIMS_BAKED}/greatsword_samurai/gs_samurai_idle_sword.json`,
  };
}
