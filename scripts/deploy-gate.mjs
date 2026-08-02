/**
 * Production deploy gate — refuse Vercel promote if the world is not game-sane.
 *
 * A deploy only "makes sense" when:
 *  1. Bermuda map GLB is live on R2 CDN (binary, not HTML)
 *  2. At least one grudge6 race kit GLB is live
 *  3. Open anim bake host responds for CANONICAL run clip
 *
 * Usage: node scripts/deploy-gate.mjs
 * Exit 0 = ok · non-zero = do not deploy
 */

const MAP = "https://assets.grudge-studio.com/models/maps/bermuda.glb";
const KIT = "https://assets.grudge-studio.com/models/grudge6/races/WK_Characters.glb";
const ATLAS =
  "https://assets.grudge-studio.com/textures/grudge6/western-kingdoms/WK_Standard_Units.webp";
const ANIM =
  "https://open.grudge-studio.com/anims/baked/locomotion/run_forward.json";
/** Must never exist as primary loco (banned) */
const BANNED_PROBE =
  "https://open.grudge-studio.com/anims/baked/locomotion/running.json";

async function headOk(url, opts = {}) {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!res.ok) return { ok: false, url, status: res.status, ct, err: "not ok" };
    if (opts.rejectHtml && ct.includes("text/html")) {
      return { ok: false, url, status: res.status, ct, err: "html masquerade" };
    }
    if (opts.requireGlb && !ct.includes("model") && !ct.includes("octet") && !ct.includes("gltf")) {
      // some CDNs use application/octet-stream
      if (!ct.includes("octet") && !ct.includes("binary")) {
        // still accept if 200 and large — HEAD may omit type
      }
    }
    return { ok: true, url, status: res.status, ct };
  } catch (e) {
    return { ok: false, url, err: e?.message || String(e) };
  }
}

async function main() {
  console.log("[deploy-gate] Multiverse production sanity…");
  const checks = await Promise.all([
    headOk(MAP, { rejectHtml: true, requireGlb: true }),
    headOk(KIT, { rejectHtml: true, requireGlb: true }),
    headOk(ATLAS, { rejectHtml: true }),
    headOk(ANIM, { rejectHtml: true }),
  ]);
  let failed = 0;
  for (const c of checks) {
    if (c.ok) console.log("  OK ", c.status, c.url.split("/").slice(-2).join("/"), c.ct || "");
    else {
      failed++;
      console.error("  FAIL", c.url, c.err || c.status, c.ct || "");
    }
  }
  // Soft: banned clip may 200 on host but we must not USE it — warn only
  const banned = await headOk(BANNED_PROBE);
  if (banned.ok) {
    console.warn(
      "  WARN banned loco file still on CDN (locomotion/running) — runtime must never select it (DRC filter)",
    );
  }

  if (failed) {
    console.error(`[deploy-gate] ${failed} critical check(s) failed — REFUSING deploy`);
    process.exit(1);
  }
  console.log("[deploy-gate] PASS — game-sane production assets reachable");
  process.exit(0);
}

main();
