/**
 * Load Bip001 baked packs from fleet hosts (Open same-origin first, then CDN).
 * SSOT: grudge6-combat-runtime + threejs-rapier-react-three-controller anims.ts
 *
 * Open hosts use **space names** for many sword_shield / longbow / magic clips
 * (hyphenated aliases often 404). Always try aliases + dual_wield fallbacks.
 */
import * as THREE from "three";

import { ANIMS_BAKED } from "./grudge6SSOT.js";

/** Primary hosts for Bip001 baked clips (per-clip JSON under pack folders). */
export const OPEN_ANIMS = ANIMS_BAKED; // open.grudge-studio.com/anims/baked
/** gameopen ships the full baked set — prefer first for reliability. */
export const GAMEOPEN_ANIMS = "https://gameopen.vercel.app/anims/baked";
export const CDN_ANIMS = "https://assets.grudge-studio.com/prod/anims";
export const ARENA_ANIMS = "https://grudge-arena.grudge-studio.com/anims/baked";
export const DANGER_ANIMS =
  "https://threejs-rapier-react-three-controll.vercel.app/anims/baked";

/** Pack role → relative paths under /anims/baked (no .json). First hit wins. */
export const PACK_CLIPS = {
  sword_shield: {
    idle: [
      "sword_shield/sword and shield idle",
      "sword_shield/sword-and-shield-idle",
      "dual_wield/idle",
    ],
    walk: ["locomotion/walking", "dual_wield/walk", "sword_shield/standing walk forward"],
    run: [
      "sword_shield/sword and shield run",
      "sword_shield/sword-and-shield-run",
      "locomotion/running",
      "dual_wield/run",
    ],
    attack: [
      "sword_shield/sword and shield attack",
      "sword_shield/sword-and-shield-attack",
      "dual_wield/attack",
    ],
    skill1: ["dual_wield/attack2", "dual_wield/combo", "sword_shield/sword and shield attack"],
    skill2: ["dual_wield/attack3", "dual_wield/dash"],
    skill3: ["dual_wield/attack4", "dual_wield/flyingKick"],
    skill4: ["dual_wield/attack5", "dual_wield/combo"],
    skill5: ["dual_wield/combo", "dual_wield/attack"],
  },
  longbow: {
    idle: ["longbow/standing idle 01", "longbow/idle", "dual_wield/idle"],
    walk: ["longbow/standing walk forward", "locomotion/walking", "dual_wield/walk"],
    run: ["longbow/standing run forward", "locomotion/running", "dual_wield/run"],
    attack: ["longbow/standing aim recoil", "longbow/draw", "dual_wield/attack"],
    skill1: ["longbow/standing aim recoil", "dual_wield/attack2"],
    skill2: ["dual_wield/attack3", "longbow/standing aim recoil"],
    skill3: ["dual_wield/combo", "dual_wield/attack"],
    skill4: ["dual_wield/attack4"],
    skill5: ["dual_wield/attack5", "dual_wield/combo"],
  },
  magic: {
    idle: ["magic/standing idle", "magic/idle", "dual_wield/idle"],
    walk: ["magic/Standing Walk Forward", "locomotion/walking", "dual_wield/walk"],
    run: [
      "magic/Standing Run Forward",
      "uploads_2026_06/locomotion/running",
      "locomotion/running",
      "dual_wield/run",
    ],
    attack: ["unarmed/punching", "dual_wield/attack", "magic/attack"],
    skill1: ["dual_wield/attack2", "unarmed/punching"],
    skill2: ["dual_wield/attack3", "dual_wield/dash"],
    skill3: ["dual_wield/combo", "dual_wield/attack4"],
    skill4: ["dual_wield/dash", "dual_wield/flyingKick"],
    skill5: ["dual_wield/attack5", "dual_wield/combo"],
  },
  twohand: {
    idle: ["dual_wield/idle", "sword_shield/sword and shield idle"],
    walk: ["dual_wield/walk", "locomotion/walking"],
    run: ["dual_wield/run", "locomotion/running"],
    attack: ["dual_wield/attack", "dual_wield/combo"],
    skill1: ["dual_wield/attack2"],
    skill2: ["dual_wield/dash"],
    skill3: ["dual_wield/attack3"],
    skill4: ["dual_wield/flyingKick"],
    skill5: ["dual_wield/attack5"],
  },
  unarmed: {
    idle: ["unarmed/fight_idle", "dual_wield/idle"],
    walk: ["locomotion/walking", "dual_wield/walk"],
    run: ["locomotion/running", "dual_wield/run"],
    attack: ["unarmed/punching", "dual_wield/attack"],
    skill1: ["dual_wield/attack2"],
    skill2: ["dual_wield/dash"],
    skill3: ["dual_wield/flyingKick"],
    skill4: ["dual_wield/combo"],
    skill5: ["dual_wield/attack5"],
  },
  /** Pistol — author Mixamo in _anim_packs/pistol; baked under anims/baked/pistol/ */
  pistol: {
    idle: ["pistol/pistol idle", "unarmed/fight_idle"],
    walk: ["pistol/pistol walk", "locomotion/walking"],
    run: ["pistol/pistol run", "locomotion/running"],
    attack: ["pistol/pistol idle", "dual_wield/attack"],
    skill1: ["pistol/pistol kneeling idle", "dual_wield/attack2"],
    skill2: ["pistol/pistol jump", "dual_wield/dash"],
    skill3: ["pistol/pistol strafe", "dual_wield/attack3"],
    skill4: ["pistol/pistol run backward", "dual_wield/combo"],
    skill5: ["pistol/pistol walk backward", "dual_wield/attack5"],
  },
  /** Rifle / gun — author in _anim_packs/rifle */
  rifle: {
    idle: ["rifle/rifle aiming idle", "rifle/idle", "unarmed/fight_idle"],
    walk: ["rifle/walking", "locomotion/walking"],
    run: ["rifle/rifle run", "rifle/run forward", "locomotion/running"],
    attack: ["rifle/firing rifle", "dual_wield/attack"],
    skill1: ["rifle/reloading", "dual_wield/attack2"],
    skill2: ["rifle/rifle jump", "dual_wield/dash"],
    skill3: ["rifle/firing rifle", "dual_wield/attack3"],
    skill4: ["rifle/reloading", "dual_wield/combo"],
    skill5: ["rifle/firing rifle", "dual_wield/attack5"],
  },
  /** Farming / harvest — author in _anim_packs/farming */
  farming: {
    idle: ["farming/holding idle", "farming/box idle", "unarmed/fight_idle"],
    walk: ["farming/holding walk", "locomotion/walking"],
    run: ["locomotion/running"],
    attack: ["farming/dig and plant seeds", "farming/pull plant", "farming/watering"],
    skill1: ["farming/pick fruit", "farming/pull plant"],
    skill2: ["farming/plant tree", "farming/plant a plant"],
    skill3: ["farming/watering", "farming/dig and plant seeds"],
    skill4: ["farming/cow milking", "farming/holding idle"],
    skill5: ["farming/wheelbarrow dump", "farming/pull plant"],
  },
};

function rotationOnlyClip(clip) {
  if (!clip) return clip;
  const tracks = clip.tracks.filter((t) => /\.quaternion$|\.rotation/.test(t.name));
  if (tracks.length === clip.tracks.length) return clip;
  return new THREE.AnimationClip(clip.name, clip.duration, tracks.length ? tracks : clip.tracks);
}

/** Encode each path segment (spaces → %20) without breaking slashes. */
function encodeRel(rel) {
  return rel
    .replace(/^\//, "")
    .replace(/\.json$/i, "")
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
}

export function bakedCandidates(rel) {
  const clean = encodeRel(rel);
  // gameopen first (full pack mirror), then Open domain, then archives
  return [
    `${GAMEOPEN_ANIMS}/${clean}.json`,
    `${OPEN_ANIMS}/${clean}.json`,
    `${DANGER_ANIMS}/${clean}.json`,
    `${ARENA_ANIMS}/${clean}.json`,
    `${CDN_ANIMS}/${clean}.json`,
  ];
}

export async function loadBakedClip(rel) {
  let last;
  for (const url of bakedCandidates(rel)) {
    try {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) {
        last = `HTTP ${res.status} ${url}`;
        continue;
      }
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("text/html")) {
        last = `HTML ${url}`;
        continue;
      }
      const json = await res.json();
      const clip = rotationOnlyClip(THREE.AnimationClip.parse(json));
      clip.name = clip.name || rel.split("/").pop() || rel;
      return clip;
    } catch (e) {
      last = e;
    }
  }
  throw new Error(`loadBakedClip failed ${rel}: ${last}`);
}

async function firstClip(paths) {
  for (const p of paths) {
    try {
      return await loadBakedClip(p);
    } catch {
      /* try next */
    }
  }
  return null;
}

/**
 * Load loco + attack + skill clips for a pack id.
 * @returns {Promise<Record<string, THREE.AnimationClip|null>>}
 */
export async function loadAnimPack(packId) {
  const table = PACK_CLIPS[packId] || PACK_CLIPS.sword_shield;
  const out = {};
  const roles = ["idle", "walk", "run", "attack", "skill1", "skill2", "skill3", "skill4", "skill5"];
  await Promise.all(
    roles.map(async (role) => {
      const paths = table[role];
      if (!paths) {
        out[role] = null;
        return;
      }
      out[role] = await firstClip(paths);
    }),
  );
  // Sprint prefers dedicated sprint loco when available
  try {
    const sprintClip = await loadBakedClip("uploads_2026_06/locomotion/running");
    out.sprint = sprintClip;
    out.sprint.userData = { ...(out.sprint.userData || {}), locoMult: 1.75 };
  } catch {
    if (out.run) {
      out.sprint = out.run.clone();
      out.sprint.name = "sprint";
      out.sprint.userData = { ...(out.sprint.userData || {}), locoMult: 1.75 };
    } else {
      out.sprint = out.walk;
    }
  }
  if (!out.idle && out.walk) out.idle = out.walk;
  if (!out.walk && out.run) out.walk = out.run;
  if (!out.run && out.walk) out.run = out.walk;
  return out;
}
