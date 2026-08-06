/**
 * Load Bip001 baked packs from fleet hosts.
 * DRC SSOT: game/drcAnimSsot.js (same rules as open.grudge-studio.com Danger Room).
 * NEVER use locomotion/running (run-to-roll) or thin sword_shield run.
 */
import * as THREE from "three";

import { ANIMS_BAKED } from "./grudge6SSOT.js";
import {
  DRC_PACK_CLIPS,
  isBannedLocomotionClip,
  filterLocoCandidates,
  CANONICAL_LOCO,
  resolveAnimPackId,
} from "./drcAnimSsot.js";

/** Primary hosts for Bip001 baked clips — DRC Open only, then R2. No threejs-rapier. */
export const OPEN_ANIMS = ANIMS_BAKED; // open.grudge-studio.com/anims/baked
export const GAMEOPEN_ANIMS = "https://open.grudge-studio.com/anims/baked";
export const CDN_ANIMS = "https://assets.grudge-studio.com/prod/anims";
/** @deprecated last resort only */
export const ARENA_ANIMS = "https://grudge-arena.grudge-studio.com/anims/baked";

/** Pack role → relative paths under /anims/baked (no .json). First hit wins. */
export const PACK_CLIPS = {
  ...DRC_PACK_CLIPS,
  pistol: {
    idle: ["pistol/pistol idle", "unarmed/fight_idle"],
    walk: ["pistol/pistol walk", CANONICAL_LOCO.walk],
    run: ["pistol/pistol run", CANONICAL_LOCO.run],
    attack: ["pistol/pistol idle", "dual_wield/attack"],
    skill1: ["pistol/pistol kneeling idle", "dual_wield/attack2"],
    skill2: ["pistol/pistol jump", "dual_wield/dash"],
    skill3: ["pistol/pistol strafe", "dual_wield/attack3"],
    skill4: ["pistol/pistol run backward", "dual_wield/combo"],
    skill5: ["pistol/pistol walk backward", "dual_wield/attack5"],
  },
  rifle: {
    idle: ["rifle/rifle aiming idle", "rifle/idle", "unarmed/fight_idle"],
    walk: ["rifle/walking", CANONICAL_LOCO.walk],
    run: ["rifle/rifle run", "rifle/run forward", CANONICAL_LOCO.run],
    attack: ["rifle/firing rifle", "dual_wield/attack"],
    skill1: ["rifle/reloading", "dual_wield/attack2"],
    skill2: ["rifle/rifle jump", "dual_wield/dash"],
    skill3: ["rifle/firing rifle", "dual_wield/attack3"],
    skill4: ["rifle/reloading", "dual_wield/combo"],
    skill5: ["rifle/firing rifle", "dual_wield/attack5"],
  },
  farming: {
    idle: ["farming/holding idle", "farming/box idle", "unarmed/fight_idle"],
    walk: ["farming/holding walk", CANONICAL_LOCO.walk],
    run: [CANONICAL_LOCO.run],
    attack: ["farming/dig and plant seeds", "farming/pull plant", "farming/watering"],
    skill1: ["farming/pick fruit", "farming/pull plant"],
    skill2: ["farming/plant tree", "farming/plant a plant"],
    skill3: ["farming/watering", "farming/dig and plant seeds"],
    skill4: ["farming/cow milking", "farming/holding idle"],
    skill5: ["farming/wheelbarrow dump", "farming/pull plant"],
  },
};

export { isBannedLocomotionClip, filterLocoCandidates, CANONICAL_LOCO };

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
  // DRC SSOT: Open production baked, then R2 prod/anims, arena last only
  return [
    `${OPEN_ANIMS}/${clean}.json`,
    `${GAMEOPEN_ANIMS}/${clean}.json`,
    `${CDN_ANIMS}/${clean}.json`,
    `${ARENA_ANIMS}/${clean}.json`,
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
  const list = filterLocoCandidates(paths);
  for (const p of list) {
    if (isBannedLocomotionClip(p)) continue;
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
  const resolved = resolveAnimPackId(packId);
  const table = PACK_CLIPS[resolved] || PACK_CLIPS[packId] || PACK_CLIPS.sword_shield;
  if (!table || typeof table !== "object") {
    console.warn("[animPack] missing table for", packId, "→", resolved, "using sword_shield");
  }
  const packTable = table && table.idle ? table : PACK_CLIPS.sword_shield;
  const out = {};
  const roles = ["idle", "walk", "run", "attack", "skill1", "skill2", "skill3", "skill4", "skill5"];
  await Promise.all(
    roles.map(async (role) => {
      let paths = packTable[role];
      if (!paths) {
        out[role] = null;
        return;
      }
      // Never load banned gait as walk/run
      if (role === "walk" || role === "run") {
        paths = filterLocoCandidates(paths);
        if (!paths.length) {
          paths = role === "walk" ? [CANONICAL_LOCO.walk] : [CANONICAL_LOCO.run, CANONICAL_LOCO.runAlt];
        }
      }
      out[role] = await firstClip(paths);
    }),
  );
  // Sprint = clone of verified run only (NEVER locomotion/running run-to-roll)
  if (out.run) {
    out.sprint = out.run.clone();
    out.sprint.name = "sprint";
    out.sprint.userData = { ...(out.sprint.userData || {}), locoMult: 1.75, source: "clone:run" };
  } else {
    out.sprint = out.walk;
  }
  if (!out.idle && out.walk) out.idle = out.walk;
  if (!out.walk && out.run) out.walk = out.run;
  if (!out.run && out.walk) out.run = out.walk;
  out._packId = resolved;
  out._sourceHost = OPEN_ANIMS;
  console.info(
    `[animPack] ${packId}→${resolved} idle=${!!out.idle} walk=${!!out.walk} run=${!!out.run} host=${OPEN_ANIMS}`,
  );
  return out;
}
