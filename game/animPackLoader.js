/**
 * Load Bip001 baked packs from fleet hosts (Open same-origin first, then CDN).
 * SSOT: grudge6-combat-runtime + gameopen anims.ts
 */
import * as THREE from "three";

export const OPEN_ANIMS = "https://open.grudge-studio.com/anims/baked";
export const CDN_ANIMS = "https://assets.grudge-studio.com/prod/anims";
export const ARENA_ANIMS = "https://grudge-arena.grudge-studio.com/anims/baked";

/** Pack role → relative paths under /anims/baked (no .json). */
export const PACK_CLIPS = {
  sword_shield: {
    idle: ["sword_shield/fight_idle", "dual_wield/idle", "magic/Standing Walk Forward"],
    walk: ["sword_shield/standing walk forward", "sword_shield/Standing Walk Forward", "dual_wield/walk"],
    run: ["sword_shield/sword and shield run", "sword_shield/standing run forward", "dual_wield/run"],
    attack: ["dual_wield/attack", "sword_shield/fight_idle"],
    skill1: ["dual_wield/attack2", "dual_wield/combo"],
    skill2: ["dual_wield/attack3", "dual_wield/dash"],
    skill3: ["dual_wield/attack4", "dual_wield/flyingKick"],
    skill4: ["dual_wield/attack5", "dual_wield/combo"],
    skill5: ["dual_wield/combo", "dual_wield/attack"],
  },
  longbow: {
    idle: ["longbow/idle", "dual_wield/idle"],
    walk: ["longbow/walk", "sword_shield/standing walk forward"],
    run: ["longbow/run", "sword_shield/standing run forward"],
    attack: ["longbow/shoot", "longbow/attack", "dual_wield/attack"],
    skill1: ["longbow/skill1", "dual_wield/attack2"],
    skill2: ["longbow/skill2", "dual_wield/attack3"],
    skill3: ["longbow/skill3", "dual_wield/combo"],
    skill4: ["longbow/skill4", "dual_wield/attack4"],
    skill5: ["longbow/special", "dual_wield/attack5"],
  },
  magic: {
    idle: ["magic/idle", "dual_wield/idle"],
    walk: ["magic/Standing Walk Forward", "sword_shield/standing walk forward"],
    run: ["uploads_2026_06/locomotion/torch run forward", "sword_shield/standing run forward"],
    attack: ["magic/attack", "magic/cast", "dual_wield/attack"],
    skill1: ["magic/skill1", "dual_wield/attack2"],
    skill2: ["magic/skill2", "dual_wield/attack3"],
    skill3: ["magic/skill3", "dual_wield/combo"],
    skill4: ["magic/skill4", "dual_wield/dash"],
    skill5: ["magic/nova", "dual_wield/attack5"],
  },
  twohand: {
    idle: ["dual_wield/idle", "sword_shield/fight_idle"],
    walk: ["dual_wield/walk", "sword_shield/standing walk forward"],
    run: ["dual_wield/run", "sword_shield/standing run forward"],
    attack: ["dual_wield/attack", "dual_wield/combo"],
    skill1: ["dual_wield/attack2"],
    skill2: ["dual_wield/dash"],
    skill3: ["dual_wield/attack3"],
    skill4: ["dual_wield/flyingKick"],
    skill5: ["dual_wield/attack5"],
  },
  unarmed: {
    idle: ["unarmed/idle", "dual_wield/idle"],
    walk: ["unarmed/walk", "sword_shield/standing walk forward"],
    run: ["unarmed/run", "sword_shield/standing run forward"],
    attack: ["unarmed/attack", "dual_wield/attack"],
    skill1: ["dual_wield/attack2"],
    skill2: ["dual_wield/dash"],
    skill3: ["dual_wield/flyingKick"],
    skill4: ["dual_wield/combo"],
    skill5: ["dual_wield/attack5"],
  },
};

function rotationOnlyClip(clip) {
  if (!clip) return clip;
  // Already rotation-heavy from bake; strip position tracks if present
  const tracks = clip.tracks.filter((t) => /\.quaternion$|\.rotation/.test(t.name));
  if (tracks.length === clip.tracks.length) return clip;
  return new THREE.AnimationClip(clip.name, clip.duration, tracks.length ? tracks : clip.tracks);
}

export function bakedCandidates(rel) {
  const clean = rel.replace(/^\//, "").replace(/\.json$/i, "");
  return [
    `${OPEN_ANIMS}/${clean}.json`,
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
  // Sprint = run clone faster
  if (out.run) {
    out.sprint = out.run.clone();
    out.sprint.name = "sprint";
    out.sprint.userData = { ...(out.sprint.userData || {}), locoMult: 1.75 };
  } else {
    out.sprint = out.walk;
  }
  // Ensure idle exists as last resort synthetic
  if (!out.idle && out.walk) out.idle = out.walk;
  return out;
}
