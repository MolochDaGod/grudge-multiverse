/**
 * Production deploy gate — refuse Vercel promote if world + Toon RTS sources are not game-sane.
 *
 * A deploy only "makes sense" when:
 *  1. Bermuda map GLB is live on R2 CDN (binary, not HTML)
 *  2. ALL 6 Toon RTS ★ race kit GLBs are live
 *  3. ALL 6 race body atlases are live (image/webp)
 *  4. Open anim bake host responds for canonical walk + run + 2h idle
 *  5. Idle JSON parses and has enough Bip001 (or remappable) rotation tracks
 *
 * "Banned loco" probe: only flags known-broken *clip paths* still on CDN —
 * that is NOT a ban on Toon RTS meshes/builds. Runtime filters those paths only.
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
  `${ANIMS}/sword_shield/sword%20and%20shield%20idle.json`,
  `${ANIMS}/dual_wield/idle.json`,
];

/** Known-broken walk/run clip path (still may exist on CDN — runtime must not select it). */
const REJECTED_BAD_CLIP = `${ANIMS}/locomotion/running.json`;

const MIN_BIP001ISH_TRACKS = 8;

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

/**
 * GET + parse baked JSON; count tracks that look like Bip001 / humanoid bones.
 * Fails closed if too few rotation tracks or HTML body.
 */
async function parseIdleClipOk(url) {
  try {
    const res = await fetch(url, { redirect: "follow" });
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!res.ok) return { ok: false, url, err: `HTTP ${res.status}` };
    if (ct.includes("text/html")) return { ok: false, url, err: "html masquerade" };
    const json = await res.json();
    const tracks = Array.isArray(json.tracks) ? json.tracks : [];
    let bip = 0;
    let rot = 0;
    for (const t of tracks) {
      const name = String(t?.name || t?.n || "");
      if (/\.quaternion|\.rotation/i.test(name)) rot++;
      if (/bip001|pelvis|spine|upperarm|thigh|neck|head/i.test(name)) bip++;
    }
    const ok = rot >= MIN_BIP001ISH_TRACKS || bip >= MIN_BIP001ISH_TRACKS;
    return {
      ok,
      url,
      tracks: tracks.length,
      rotationTracks: rot,
      bip001ish: bip,
      err: ok ? null : `too few bone tracks rot=${rot} bipish=${bip} need≥${MIN_BIP001ISH_TRACKS}`,
    };
  } catch (e) {
    return { ok: false, url, err: e?.message || String(e) };
  }
}

function short(url) {
  return url.replace(/^https:\/\/[^/]+\//, "").split("/").slice(-3).join("/");
}

async function main() {
  console.log(
    "[deploy-gate] Multiverse production (Toon RTS ★ kits + atlases + anims + idle parse)…",
  );
  console.log(
    "[deploy-gate] Note: rejected bad clip paths ≠ ban on Toon meshes/builds — path filter only.",
  );

  const checks = [
    await headOk(MAP, { rejectHtml: true }),
    ...(await Promise.all(KITS.map((u) => headOk(u, { rejectHtml: true })))),
    ...(await Promise.all(ATLASES.map((u) => headOk(u, { rejectHtml: true })))),
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

  // Parse production idle candidates for Bip001-ish tracks
  const parseTargets = [
    `${ANIMS}/greatsword_samurai/gs_samurai_idle_sword.json`,
    `${ANIMS}/sword_shield/sword%20and%20shield%20idle.json`,
    `${ANIMS}/dual_wield/idle.json`,
  ];
  let parsePass = 0;
  for (const url of parseTargets) {
    const p = await parseIdleClipOk(url);
    if (p.ok) {
      parsePass++;
      console.log(
        "  OK  parse",
        short(url),
        `tracks=${p.tracks} rot=${p.rotationTracks} bipish=${p.bip001ish}`,
      );
    } else {
      console.error("  FAIL parse", short(url), p.err);
    }
  }
  if (parsePass === 0) {
    failed++;
    console.error("[deploy-gate] no idle JSON parsed with enough bone tracks — REFUSING");
  }

  const banned = await headOk(REJECTED_BAD_CLIP);
  if (banned.ok) {
    console.warn(
      "  WARN rejected-bad-clip still on CDN (locomotion/running) — runtime must not use it as walk/run (path filter only; Toon meshes unaffected)",
    );
  }

  if (failed) {
    console.error(`[deploy-gate] ${failed} critical check(s) failed — REFUSING deploy`);
    process.exit(1);
  }
  console.log(
    `[deploy-gate] PASS — map + ${KITS.length} Toon RTS kits + ${ATLASES.length} atlases + anims + ${parsePass} idle parse(s)`,
  );
  process.exit(0);
}

main();
