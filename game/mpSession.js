/**
 * Multiverse multiplayer session contract — create / join / shared experience.
 *
 * Fail-closed: no cylinders, no degraded capsules in the play session.
 * Everyone must share seed + gen version + play contract + loaded Toon local hero.
 */
import {
  WORLD_GEN_VERSION,
  WORLD_SCHEMA,
  DEFAULT_WORLD_SEED,
} from "./worldSeedGen.js";
import {
  GRUDGE6_SSOT_VERSION,
  WARLORDS_PLAY_CONTRACT_VERSION,
} from "./grudge6SSOT.js";

export const MP_PROTOCOL = "grudge.multiverse.mp/v1";

/** Versions every client + room must agree on for shared assets/experience. */
export function playContractVersions() {
  return {
    protocol: MP_PROTOCOL,
    worldSchema: WORLD_SCHEMA,
    worldGen: WORLD_GEN_VERSION,
    grudge6: GRUDGE6_SSOT_VERSION,
    warlordsPlay: WARLORDS_PLAY_CONTRACT_VERSION,
    defaultSeed: DEFAULT_WORLD_SEED,
  };
}

/**
 * @param {object} localSource window.__mvCharacterSource
 * @param {object} [welcome] from Railway welcome
 * @returns {{ ok: boolean, reasons: string[], grade: string }}
 */
export function assertPlayReady(localSource, welcome = null) {
  const reasons = [];
  const s = localSource || {};

  if (s.standIn || s.pipeline === "capsule" || s.playMesh === "none") {
    reasons.push("local_capsule_or_standin_forbidden");
  }
  if (s.playMesh !== "toon-rts" && s.isToonRtsKit !== true) {
    reasons.push("local_not_toon_rts");
  }
  if (!s.director) reasons.push("local_no_animation_director");
  if (s.integrity === "red" || s.degraded) reasons.push("local_integrity_red");
  if (s.coreBonesOk === false) reasons.push("local_core_bones_missing");
  if (s.coreClipOk === false) reasons.push("local_core_clip_fail");

  if (welcome?.worldGen && welcome.worldGen !== WORLD_GEN_VERSION) {
    reasons.push(`world_gen_mismatch:${welcome.worldGen}!=${WORLD_GEN_VERSION}`);
  }
  if (welcome?.warlordsPlay && welcome.warlordsPlay !== WARLORDS_PLAY_CONTRACT_VERSION) {
    reasons.push(`play_contract_mismatch:${welcome.warlordsPlay}`);
  }
  if (welcome?.seed && typeof window !== "undefined") {
    const localSeed = window.__mvWorldSeed;
    if (localSeed && localSeed !== welcome.seed) {
      reasons.push(`seed_mismatch:${localSeed}!=${welcome.seed}`);
    }
  }

  return {
    ok: reasons.length === 0,
    reasons,
    grade: reasons.length === 0 ? "green" : "red",
    versions: playContractVersions(),
  };
}

/**
 * Snapshot fields every peer must send so remotes hydrate the same assets.
 * @param {object} opts
 */
export function buildSharedPlayerSnap(opts = {}) {
  const {
    pos,
    ry = 0,
    clip = "idle",
    combat = "idle",
    hp = 100,
    stamina = 100,
    moving = false,
    sprinting = false,
    grounded = true,
    dead = false,
    focus = false,
    classId = "warrior",
    raceId = "western-kingdoms",
    animPack = "sword_shield",
    meshIds = [],
    weapon = "",
    name = "Player",
  } = opts;

  return {
    px: pos?.x ?? 0,
    py: pos?.y ?? 0,
    pz: pos?.z ?? 0,
    ry,
    clip: String(clip).slice(0, 32),
    combat: String(combat).slice(0, 24),
    hp,
    stamina,
    moving: !!moving,
    sprinting: !!sprinting,
    grounded: grounded !== false,
    dead: !!dead,
    focus: !!focus,
    classId: String(classId).slice(0, 24),
    raceId: String(raceId).slice(0, 32),
    animPack: String(animPack || "sword_shield").slice(0, 32),
    meshIds: Array.isArray(meshIds) ? meshIds.slice(0, 24).map(String) : [],
    weapon: String(weapon || classId).slice(0, 24),
    name: String(name).slice(0, 24),
  };
}

/** HUD: multiplayer readiness badge */
export function mountMpReadyBadge() {
  let el = document.getElementById("mv-mp-ready");
  if (!el) {
    el = document.createElement("div");
    el.id = "mv-mp-ready";
    el.style.cssText =
      "position:fixed;bottom:12px;left:12px;z-index:9998;padding:8px 12px;border-radius:8px;" +
      "font:11px/1.35 system-ui;max-width:min(360px,90vw);border:1px solid #666;background:rgba(0,0,0,0.75);color:#ccc";
    document.body.appendChild(el);
  }
  return el;
}

export function refreshMpReadyBadge(status) {
  const el = mountMpReadyBadge();
  if (!status) {
    el.textContent = "MP · waiting…";
    return;
  }
  if (status.ok) {
    el.style.borderColor = "#3dba6a";
    el.style.color = "#b8f0c8";
    el.textContent = `MP READY · seed ${status.seed || "?"} · Toon shared`;
  } else {
    el.style.borderColor = "#e05050";
    el.style.color = "#ffc8c8";
    el.textContent = `MP BLOCKED · ${(status.reasons || []).slice(0, 2).join(", ")}`;
  }
}
