/**
 * Deterministic PRNG — ported from Island-Crusade-Realm-2 combat-sandbox seed.ts.
 * Same seed → same settlements / NPC offsets / animal scatter on Bermuda.
 */
export const REALM_MAP_SEED = 0xa17c3f;

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

export function childSeed(tag, base = REALM_MAP_SEED) {
  let h = base >>> 0;
  for (let i = 0; i < tag.length; i++) {
    h = Math.imul(h ^ tag.charCodeAt(i), 16777619) >>> 0;
  }
  return h >>> 0;
}

export function hash2(x, z, salt = 0) {
  let h =
    (Math.imul(Math.floor(x) | 0, 374761393) ^
      Math.imul(Math.floor(z) | 0, 668265263) ^
      Math.imul(salt | 0, 2246822519)) >>>
    0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
