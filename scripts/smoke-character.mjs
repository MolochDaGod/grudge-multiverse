/**
 * Multiverse character smoke — CDN + anim parse (no browser).
 * Browser durable proof still needs hard-refresh + window.__mvCharacterSource.integrity === "green".
 *
 * Usage: node scripts/smoke-character.mjs
 * Optional: MV_SMOKE_URL=https://grudge-multiverse.vercel.app node scripts/smoke-character.mjs
 *
 * Playwright (optional, if installed):
 *   npx playwright install chromium
 *   then this script will open the SPA and assert __mvCharacterSource when PLAYWRIGHT=1
 */

const CDN = "https://assets.grudge-studio.com";
const ANIMS = "https://open.grudge-studio.com/anims/baked";
const SPA = process.env.MV_SMOKE_URL || "https://grudge-multiverse.vercel.app/";
/** Must match ObjectStore + Multiverse WARLORDS_PLAY_CONTRACT_VERSION */
const EXPECT_CONTRACT = "2026-08-07.harden.1";

const KITS = ["human", "elf", "orc", "undead", "barbarian", "dwarf"].map(
  (r) => `${CDN}/asset-packs/toon-rts-characters/glb/characters/${r}.glb`,
);

async function head(url) {
  const res = await fetch(url, { method: "HEAD", redirect: "follow" });
  return { ok: res.ok, status: res.status, url };
}

async function parseIdle(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const tracks = json.tracks || [];
  const bipish = tracks.filter((t) =>
    /bip001|pelvis|spine|upperarm|thigh|neck|head/i.test(String(t.name || "")),
  ).length;
  return { tracks: tracks.length, bipish };
}

async function smokeCdn() {
  console.log("[smoke] CDN Toon RTS kits + ObjectStore contract…");
  let fail = 0;
  for (const u of KITS) {
    const h = await head(u);
    console.log(h.ok ? "  OK" : "  FAIL", h.status, u.split("/").pop());
    if (!h.ok) fail++;
  }
  // Machine contract on info (deployed ObjectStore)
  try {
    const contractUrl =
      "https://info.grudge-studio.com/api/v1/grudge6-warlords-play-contract.json";
    const res = await fetch(contractUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    console.log("  OK contract", j.version, "code=", j.code);
    if (j.version !== EXPECT_CONTRACT) {
      console.warn(
        "  WARN contract version",
        j.version,
        "expected",
        EXPECT_CONTRACT,
        "(info deploy may lag ObjectStore main)",
      );
    }
    if (!Array.isArray(j.banned) || j.banned.length < 5) {
      console.error("  FAIL contract banned list thin");
      fail++;
    }
  } catch (e) {
    console.error("  FAIL contract", e.message);
    fail++;
  }
  const idleUrl = `${ANIMS}/greatsword_samurai/gs_samurai_idle_sword.json`;
  try {
    const p = await parseIdle(idleUrl);
    console.log("  OK idle parse tracks=", p.tracks, "bipish=", p.bipish);
    if (p.bipish < 8 && p.tracks < 8) {
      console.error("  FAIL idle too thin");
      fail++;
    }
  } catch (e) {
    console.error("  FAIL idle", e.message);
    fail++;
  }
  return fail;
}

async function smokePlaywright() {
  if (process.env.PLAYWRIGHT !== "1") {
    console.log(
      "[smoke] skip browser (set PLAYWRIGHT=1 + install playwright for __mvCharacterSource assert)",
    );
    return 0;
  }
  let playwright;
  try {
    playwright = await import("playwright");
  } catch {
    console.warn("[smoke] playwright not installed — npm i -D playwright");
    return 0;
  }
  console.log("[smoke] browser", SPA);
  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(SPA, { waitUntil: "networkidle", timeout: 120_000 });
  // Wait for character source stamp (race/class select may block — try hash room)
  await page.waitForTimeout(8000);
  const src = await page.evaluate(() => window.__mvCharacterSource || null);
  await browser.close();
  if (!src) {
    console.error(
      "[smoke] FAIL no window.__mvCharacterSource (may need race/class click path)",
    );
    return 1;
  }
  console.log("[smoke] source", {
    integrity: src.integrity,
    playMesh: src.playMesh,
    director: src.director,
    contract: src.warlordsPlayContract,
    kit: (src.kitUrl || "").split("/").pop(),
    reasons: src.integrityReasons,
  });
  if (src.playMesh !== "toon-rts" || !src.director) {
    console.error("[smoke] FAIL not Toon production path");
    return 1;
  }
  if (src.warlordsPlayContract !== EXPECT_CONTRACT) {
    console.error(
      "[smoke] FAIL missing/stale warlordsPlayContract",
      src.warlordsPlayContract,
    );
    return 1;
  }
  if (src.integrity !== "green" && src.integrity !== "yellow") {
    console.error("[smoke] FAIL integrity red", src.integrityReasons);
    return 1;
  }
  console.log("[smoke] browser PASS integrity=green");
  if (errors.length) console.warn("[smoke] pageerrors", errors.slice(0, 5));
  return 0;
}

const a = await smokeCdn();
const b = await smokePlaywright();
const code = a + b > 0 ? 1 : 0;
console.log(code === 0 ? "[smoke] PASS" : "[smoke] FAIL");
process.exit(code);
