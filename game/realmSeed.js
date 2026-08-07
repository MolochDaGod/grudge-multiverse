/**
 * Thin re-export of world seed PRNG (Valheim-style SSOT).
 * Prefer importing from `worldSeedGen.js` in new code.
 */
export {
  mulberry32,
  childSeed,
  parseSeed,
  hashString,
  DEFAULT_WORLD_SEED,
  normalizeSeedLabel,
} from "./worldSeedGen.js";

import { parseSeed, DEFAULT_WORLD_SEED } from "./worldSeedGen.js";

/** @deprecated fixed numeric default — use DEFAULT_WORLD_SEED string */
export const REALM_MAP_SEED = parseSeed(DEFAULT_WORLD_SEED);

/** @deprecated old float hash — use childSeed / parseSeed */
export function hash2(x, z, salt = 0) {
  return parseSeed(`${Math.floor(x)},${Math.floor(z)},${salt}`);
}
