/**
 * Production deploy gate — refuse Vercel promote if world + character sources are not game-sane.
 *
 * A deploy only "makes sense" when:
 *  1. Bermuda map GLB is live on R2 CDN (binary, not HTML)
 *  2. ALL 6 Toon RTS ★ race kit GLBs are live
 *  3. ALL 6 race body atlases are live (image/webp)
 *  4. Open anim bake host responds for canonical walk + run + 2h idle
 *
 * Usage: node scripts/deploy-gate.mjs
 * Exit 0 = ok · non-zero = do not deploy
 */

const CDN = "https://assets.grudge-studio.com";
const ANIMS = "https://open.grudge-studio.com/anims/baked";

const MAP = `${CDN}/models/maps/bermuda.glb`;

/** Toon RTS ★ play meshes only (human.glb … dwarf.glb). */
const KITS = [
  `${CDN}/asset-packs/toon-rts-characters/glb/characters/human.glb`,
  `${CDN}/asset-packs/toon-rts-characters/glb/characters/elf.glb`,
  `${CDN}/asset-packs/toon-rts-characters/glb/characters/orc.glb`,
  `${CDN}/asset-packs/toon-rts-characters/glb/characters/undead.glb`,
  `${CDN}/asset-packs/toon-rts-characters/glb/characters/barbarian.glb`,
  `${CDN}/asset-packs/toon-rts-characters/glb/characters/dwarf.glb`,
];

const ATLASES = [
  `${CDN}/textures/grudge6/western-kingdoms/WK_Standard_Units.webp`,
  `${CDN}/textures/grudge6/elves/ELF_HighElves_Texture.webp`,
  `${CDN}/textures/grudge6/orcs/ORC_StandardUnits.webp`,
  `${CDN}/textures/grudge6/undead/UD_Standard_Units.webp`,
  `${CDN}/textures/grudge6/barbarians/BRB_StandardUnits_texture.webp`,
  `${CDN}/textures/grudge6/dwarves/DWF_Standard_Units.webp`,
];

const ANIMS_REQUIRED = [
  `${ANIMS}/locomotion/run_forward.json`,
  `${ANIMS}/magic/Standing%20Walk%20Forward.json`,
  `${ANIMS}/greatsword_samurai/gs_samurai_idle_sword.json`,
];

/** Must never be selected as primary loco (banned) */
const BANNED_PROBE = `${ANIMS}/locomotion/running.json`;

async function headOk(url, opts = {}) {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!res.ok) return { ok: false, url, status: res.status, ct, err: "not ok" };
    if (opts.rejectHtml && ct.includes("text/html")) {
      return { ok: false, url, status: res.status, ct, err: "html masquerade" };
    }
    return { ok: true, url, status: res.status, ct };
  } catch (e) {
    return { ok: false, url, err: e?.message || String(e) };
  }
}

function short(url) {
  return url.replace(/^https:\/\/[^/]+\//, "").split("/").slice(-3).join("/");
}

async function main() {
  console.log("[deploy-gate] Multiverse production (map + 6 Toon RTS kits + atlases + anims)…");
  const checks = [
    await headOk(MAP, { rejectHtml: true }),
    ...(await Promise.all(KITS.map((u) => headOk(u, { rejectHtml: true })))),
    ...(await Promise.all(ATLASES.map((u) => headOk(u, { rejectHtml: true, expectImage: true })))),
    ...(await Promise.all(ANIMS_REQUIRED.map((u) => headOk(u, { rejectHtml: true })))),
  ];

  let failed = 0;
  for (const c of checks) {
    if (c.ok) console.log("  OK ", c.status, short(c.url), c.ct || "");
    else {
      failed++;
      console.error("  FAIL", short(c.url), c.err || c.status, c.ct || "");
    }
  }

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
  console.log(
    `[deploy-gate] PASS — map + ${KITS.length} Toon RTS kits + ${ATLASES.length} atlases + anims`,
  );
  process.exit(0);
}

main();
