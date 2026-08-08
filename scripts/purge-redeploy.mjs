/**
 * Purge-friendly redeploy checklist for Multiverse.
 * Does not call Cloudflare purge API (R2 assets stay); forces SPA + room redeploy stamps.
 *
 * Usage: node scripts/purge-redeploy.mjs
 * Then: npm run deploy && npm run deploy:railway
 */
import { generateWorld, DEFAULT_WORLD_SEED, WORLD_GEN_VERSION, WORLD_SIZE_M } from "../shared/worldSeedGen.mjs";

const w = generateWorld(DEFAULT_WORLD_SEED, { landRadius: 2400, worldSize: WORLD_SIZE_M });
console.log("[purge-redeploy] default seed", DEFAULT_WORLD_SEED);
console.log("[purge-redeploy] worldGen", WORLD_GEN_VERSION);
console.log("[purge-redeploy] worldSizeM", w.worldSizeM, "landRadius", w.landRadius);
console.log("[purge-redeploy] world", w.summary);
console.log("[purge-redeploy] counts", JSON.stringify(w.counts));
console.log("[purge-redeploy] nature: ROCK 20m @ 40% bury · multi-chunk trees/rocks · Kenney variety");
console.log(`
Next:
  1. npm run deploy:gate
  2. npm run deploy          # Vercel SPA (hashed assets = auto cache bust)
  3. npm run deploy:railway  # Railway room API + default seed
  4. Hard refresh: https://grudge-multiverse.vercel.app/?seed=${DEFAULT_WORLD_SEED}#room1
  5. curl …/api/world?seed=${DEFAULT_WORLD_SEED}
`);
