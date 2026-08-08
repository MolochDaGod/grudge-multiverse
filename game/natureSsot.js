/**
 * Multiverse nature / harvest SSOT (Valheim-style + Kenney CDN).
 * SI: 1 unit = 1 m · human 1.8 m yardstick.
 *
 * Rocks: 20 m tall, 40% buried (mineable mass in ground).
 * Trees / rocks: multi-chunk break (parts fall off before despawn).
 * CDN: assets.grudge-studio.com models/world/kenney/* — do not invent hosts.
 */

export const WARLORDS_CDN = "https://assets.grudge-studio.com";

/** Mineable boulder total height (metres), including buried portion. */
export const ROCK_HEIGHT_M = 20;
/** Fraction of rock height under ground (Valheim-like mining mass). */
export const ROCK_BURY_FRAC = 0.4;
/** Exposed height above ground = 12 m at default. */
export const ROCK_EXPOSED_M = ROCK_HEIGHT_M * (1 - ROCK_BURY_FRAC);

/** Chunks per rock before full clear (each hit can strip one chunk). */
export const ROCK_CHUNKS = 6;
/** Chunks / stages per tree (trunk segments + canopy). */
export const TREE_CHUNKS = 4;

export const NATURE_GEN = "2026-08-08.1-valheim-chunks";

/** Kenney nature-kit singles (verified 200 on CDN). */
export const TREE_PROTOTYPES = [
  {
    id: "oak",
    file: "tree_oak.glb",
    heightM: 14,
    canopyTint: 0x3d8f3a,
    trunkTint: 0x4a3420,
    chunks: TREE_CHUNKS,
    materialId: "t0_wood",
  },
  {
    id: "default",
    file: "tree_default.glb",
    heightM: 11,
    canopyTint: 0x2f7a34,
    trunkTint: 0x3d2a18,
    chunks: TREE_CHUNKS,
    materialId: "t0_wood",
  },
  {
    id: "pine",
    file: "tree_pineDefaultA.glb",
    heightM: 16,
    canopyTint: 0x1f5c38,
    trunkTint: 0x3a2818,
    chunks: TREE_CHUNKS + 1,
    materialId: "t0_wood",
  },
  {
    id: "detailed",
    file: "tree_detailed.glb",
    heightM: 13,
    canopyTint: 0x4a9a40,
    trunkTint: 0x45301c,
    chunks: TREE_CHUNKS,
    materialId: "t0_wood",
  },
  {
    id: "palm",
    file: "tree_palm.glb",
    heightM: 12,
    canopyTint: 0x3a8f48,
    trunkTint: 0x6b5430,
    chunks: 3,
    materialId: "t0_wood",
    coastal: true,
  },
];

export const ROCK_PROTOTYPES = [
  {
    id: "cliff_cave",
    file: "cliff_blockCave_rock.glb",
    heightM: ROCK_HEIGHT_M,
    buryFrac: ROCK_BURY_FRAC,
    chunks: ROCK_CHUNKS,
    color: 0x6a6a66,
    materialId: "t0_stone",
  },
  {
    id: "cliff_diag",
    file: "cliff_blockDiagonal_rock.glb",
    heightM: ROCK_HEIGHT_M * 0.92,
    buryFrac: ROCK_BURY_FRAC,
    chunks: ROCK_CHUNKS,
    color: 0x5c5c58,
    materialId: "t0_stone",
  },
];

export function kenneyNatureUrl(file) {
  const f = file.endsWith(".glb") ? file : `${file}.glb`;
  return `${WARLORDS_CDN}/models/world/kenney/nature-kit/${f}`;
}

/** Density for 5 km seed (land discs only). */
export const NATURE_DENSITY = {
  /** Interactive harvest trees per land disc */
  harvestTreesPerDisc: 28,
  /** Interactive harvest rocks per disc */
  harvestRocksPerDisc: 10,
  /** Decorative instanced trees (no harvest) per disc */
  decorTreesPerDisc: 90,
  clearHubM: 18,
  minSpacingTreeM: 6,
  minSpacingRockM: 14,
};

/** Debris from chunk break */
export const CHUNK_DEBRIS = {
  rockPieces: 4,
  treePieces: 3,
  lifeMs: 4200,
  impulse: 4.5,
};

/** HP scaling: total node HP = chunks * perChunk */
export const HP_PER_CHUNK = {
  rock: 22,
  tree: 16,
};
