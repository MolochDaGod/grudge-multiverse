/**
 * DRC (Danger Room Combat) animation SSOT for Multiverse.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * "Banned loco" is NOT a ban on Toon RTS packs, meshes, or character builds.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * REJECTED_BAD_CLIP_PATHS = a few *baked anim JSON paths* that are known broken
 * when used as walk/run (run-to-roll flip, tip-toe walk, thin wrong-facing run).
 * We skip those *file paths only* and use CANONICAL_LOCO instead.
 *
 * Full Toon RTS ★ mesh + gear mesh_ids + weapon anim packs remain the product.
 * Never interpret this list as "strip Toon content" or "block character options."
 */

export const HUMAN_HEIGHT_M = 1.8;

/**
 * Known-broken *clip file paths* under /anims/baked — not mesh bans.
 * @deprecated name kept for callers; prefer REJECTED_BAD_CLIP_PATHS
 */
export const BANNED_LOCOMOTION = [
  "locomotion/running", // run-to-roll (not a clean run)
  "uploads_2026_06/locomotion/running",
  "uploads/locomotion/Quick_Roll_To_Run",
  "locomotion/walking", // tip gait, not production walk
  "sword_shield/sword and shield run", // thin / wrong-facing arena bake
  "sword_shield/sword-and-shield-run",
];

/** Alias — preferred name (not a product ban). */
export const REJECTED_BAD_CLIP_PATHS = BANNED_LOCOMOTION;

/** Production walk/run when a pack's loco candidate is a rejected bad path. */
export const CANONICAL_LOCO = {
  walk: "magic/Standing Walk Forward",
  run: "locomotion/run_forward",
  runAlt: "greatsword_samurai/gs_samurai_run_sword",
};

/** True if this baked path is a known-broken walk/run clip (path filter only). */
export function isBannedLocomotionClip(rel) {
  return isRejectedBadClipPath(rel);
}

export function isRejectedBadClipPath(rel) {
  const n = String(rel || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/\.json$/i, "");
  const base = n.split("/").pop() || n;
  // Roll/tumble clips must never be selected as continuous walk/run gait
  if (
    /roll|tumble|somersault|cartwheel/i.test(base) ||
    /quick[_\s-]?roll/i.test(n) ||
    /^running$/i.test(base)
  ) {
    return true;
  }
  return REJECTED_BAD_CLIP_PATHS.some(
    (b) => n === b || n.endsWith(`/${b}`) || n.includes("Quick_Roll_To_Run"),
  );
}

/** Filter candidate path lists — drop known-broken loco paths, keep order. */
export function filterLocoCandidates(paths) {
  return (paths || []).filter((p) => !isRejectedBadClipPath(p));
}

/**
 * Pack role → relative paths under /anims/baked (no .json). First hit wins.
 * Aligned with open.grudge-studio.com DRC production.
 */
export const DRC_PACK_CLIPS = {
  sword_shield: {
    idle: [
      "greatsword_samurai/gs_samurai_idle_sword",
      "dual_wield/idle",
      "sword_shield/sword and shield idle",
    ],
    walk: [
      "greatsword_samurai/gs_samurai_walk_sword",
      CANONICAL_LOCO.walk,
      "longbow/standing walk forward",
    ],
    run: [CANONICAL_LOCO.run, CANONICAL_LOCO.runAlt, "magic/Standing Run Forward", "dual_wield/run"],
    attack: [
      "greatsword_samurai/gs_samurai_combo_a",
      "dual_wield/attack",
      "dual_wield/slash",
    ],
    skill1: ["greatsword_samurai/gs_samurai_combo_b", "dual_wield/attack2", "dual_wield/combo"],
    skill2: ["greatsword_samurai/gs_samurai_dash_opener", "dual_wield/dash", "dual_wield/attack3"],
    skill3: ["greatsword_samurai/gs_samurai_teleport_strike", "dual_wield/sword_dash_attack"],
    skill4: ["greatsword_samurai/gs_samurai_jump_sword", "dual_wield/attack4"],
    skill5: ["ghost_rider/quakesmash", "dual_wield/combo"],
  },
  longbow: {
    idle: ["longbow/standing idle 01", "longbow/idle", "dual_wield/idle"],
    walk: ["longbow/standing walk forward", CANONICAL_LOCO.walk],
    run: ["longbow/standing run forward", CANONICAL_LOCO.run],
    attack: ["longbow/standing aim recoil", "longbow/draw", "dual_wield/attack"],
    skill1: ["longbow/standing aim recoil", "dual_wield/attack2"],
    skill2: ["longbow/overdraw", "dual_wield/attack3"],
    skill3: ["dual_wield/dash", "dual_wield/combo"],
    skill4: ["dual_wield/attack4"],
    skill5: ["dual_wield/attack5", "dual_wield/combo"],
  },
  magic: {
    idle: ["magic/standing idle", "magic/idle", "dual_wield/idle"],
    walk: [CANONICAL_LOCO.walk, "dual_wield/walk"],
    run: ["magic/Standing Run Forward", CANONICAL_LOCO.run],
    attack: ["magic/standing 1h cast spell 01", "dual_wield/attack", "unarmed/punching"],
    skill1: ["dual_wield/attack2", "magic/standing 1h cast spell 01"],
    skill2: ["dual_wield/attack3", "dual_wield/dash"],
    skill3: ["dual_wield/combo", "dual_wield/attack4"],
    skill4: ["dual_wield/dash"],
    skill5: ["dual_wield/attack5", "dual_wield/combo"],
  },
  /**
   * 2H melee — greatsword is 2h_melee; samurai set is primary.
   * Aliases: twohand, greatsword, 2h_melee, greatsword_samurai (see below).
   */
  "2h_melee": {
    idle: ["greatsword_samurai/gs_samurai_idle_sword", "dual_wield/idle"],
    walk: ["greatsword_samurai/gs_samurai_walk_sword", CANONICAL_LOCO.walk],
    run: [CANONICAL_LOCO.runAlt, CANONICAL_LOCO.run, "dual_wield/run"],
    attack: ["greatsword_samurai/gs_samurai_combo_a", "dual_wield/slash", "dual_wield/attack"],
    skill1: ["greatsword_samurai/gs_samurai_combo_b", "dual_wield/combo"],
    skill2: ["greatsword_samurai/gs_samurai_dash_opener", "dual_wield/dash"],
    skill3: ["greatsword_samurai/gs_samurai_teleport_strike", "dual_wield/overhead"],
    skill4: ["greatsword_samurai/gs_samurai_jump_sword", "dual_wield/sword_dash_attack"],
    skill5: ["ghost_rider/quakesmash", "dual_wield/combo"],
  },
  unarmed: {
    idle: ["unarmed/fight_idle", "dual_wield/idle"],
    walk: [CANONICAL_LOCO.walk, "dual_wield/walk"],
    run: [CANONICAL_LOCO.run, "dual_wield/run"],
    attack: ["unarmed/punching", "dual_wield/attack"],
    skill1: ["dual_wield/attack2"],
    skill2: ["dual_wield/dash"],
    skill3: ["dual_wield/combo"],
    skill4: ["dual_wield/overhead"],
    skill5: ["dual_wield/attack5"],
  },
  polearm: {
    idle: ["polearm/idle", "dual_wield/idle"],
    walk: [CANONICAL_LOCO.walk, "magic/Standing Walk Forward"],
    run: [CANONICAL_LOCO.run, "magic/Standing Run Forward"],
    attack: ["polearm/attack", "dual_wield/thrust"],
    skill1: ["polearm/skill1", "dual_wield/attack2"],
    skill2: ["polearm/skill2", "dual_wield/dash"],
    skill3: ["polearm/skill3", "dual_wield/combo"],
    skill4: ["polearm/skill4", "dual_wield/overhead"],
    skill5: ["polearm/special", "dual_wield/attack5"],
  },
  twohand_hammer: {
    idle: ["twohand_hammer/idle", "dual_wield/idle"],
    walk: [CANONICAL_LOCO.walk],
    run: [CANONICAL_LOCO.run],
    attack: ["twohand_hammer/attack", "dual_wield/overhead"],
    skill1: ["twohand_hammer/attack-charge", "dual_wield/combo"],
    skill2: ["twohand_hammer/skill1", "dual_wield/dash"],
    skill3: ["twohand_hammer/skill2", "dual_wield/attack3"],
    skill4: ["twohand_hammer/jump", "dual_wield/attack4"],
    skill5: ["ghost_rider/quakesmash", "dual_wield/combo"],
  },
};

// Aliases AFTER object init (never touch TDZ)
const _2h = DRC_PACK_CLIPS["2h_melee"];
DRC_PACK_CLIPS.twohand = _2h;
DRC_PACK_CLIPS.greatsword = _2h;
DRC_PACK_CLIPS.greatsword_samurai = _2h;
DRC_PACK_CLIPS.samurai = _2h;
DRC_PACK_CLIPS["2h"] = _2h;

/** Resolve pack id → table key (2h_melee aliases). */
export function resolveAnimPackId(pack) {
  const p = String(pack || "sword_shield").toLowerCase().trim();
  if (
    p === "twohand" ||
    p === "greatsword" ||
    p === "greatsword_samurai" ||
    p === "samurai" ||
    p === "2h" ||
    p === "2h_melee"
  ) {
    return "2h_melee";
  }
  return p;
}
