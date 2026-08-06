/**
 * Multiverse PvP + skill shape helpers — soft-lock preferred, MM gap-close, AoE radii.
 * Used by warlordsBootstrap skill cast + Railway combat fan-out. Not a second combat engine.
 */
import * as THREE from "three";

/** Clamp client-claimed PvP damage (server also clamps). */
export function clampPvpDmg(n) {
  const v = Math.floor(Number(n) || 0);
  if (!Number.isFinite(v)) return 1;
  return Math.max(1, Math.min(80, v));
}

/**
 * Skill production shape: range, aoe, gap-close distance (SI metres).
 * Extends class skill defs without inventing a parallel skill system.
 */
export function skillCombatMeta(skill) {
  if (!skill) {
    return { range: 2.8, aoeR: 0, gapClose: 0, isRanged: false, isAoe: false, isMobility: false };
  }
  const k = `${skill.kind || ""} ${skill.id || ""} ${skill.name || ""}`.toLowerCase();
  const isRanged = /ranged|magic|bolt|arrow|shot/.test(k) && !/melee/.test(k);
  const isAoe = /aoe|nova|cleave|rain|volley|storm|meteor|rampage|blast/.test(k);
  const isMobility = /mobility|leap|blink|dash|charge|gap/.test(k);
  const gapClose =
    skill.gapClose ??
    (isMobility
      ? /blink/.test(k)
        ? 9
        : 6.5
      : /leap|bash|shield_bash|power_shot|execute|smash|rend/.test(k)
        ? 5.5
        : 0);
  const aoeR =
    skill.aoeR ??
    (isAoe
      ? /meteor|storm|rain|rampage/.test(k)
        ? 5.5
        : /cleave|nova|volley/.test(k)
          ? 4.2
          : 3.6
      : 0);
  const range =
    skill.rangeM ??
    (isRanged ? 22 : isAoe ? Math.max(4.5, aoeR) : gapClose > 0 ? 3.2 : 2.8);
  return { range, aoeR, gapClose, isRanged, isAoe, isMobility };
}

/**
 * Destination for MM gap-close: soft-lock preferred, else forward dash.
 * Stops ~1.35 m short of target chest (melee range).
 * @returns {THREE.Vector3 | null}
 */
export function resolveGapCloseDest(fromPos, dir, skill, preferredPoint, opts = {}) {
  const meta = skillCombatMeta(skill);
  const maxDist = meta.gapClose || opts.defaultGap || 0;
  if (maxDist <= 0) return null;
  const out = new THREE.Vector3();
  if (preferredPoint) {
    const to = preferredPoint.clone().sub(fromPos);
    to.y = 0;
    const len = to.length();
    if (len < 1.2) return null; // already in face
    to.normalize();
    const travel = Math.min(maxDist, Math.max(0.5, len - 1.35));
    out.copy(fromPos).addScaledVector(to, travel);
    out.y = fromPos.y;
    return out;
  }
  const d = dir?.clone?.() || new THREE.Vector3(0, 0, 1);
  d.y = 0;
  if (d.lengthSq() < 1e-6) d.set(0, 0, 1);
  d.normalize();
  // Blink goes full; leap ~0.85 of max
  const frac = /blink/i.test(`${skill?.id} ${skill?.name}`) ? 1 : 0.85;
  out.copy(fromPos).addScaledVector(d, maxDist * frac);
  out.y = fromPos.y;
  return out;
}

/** Collect PvP hit candidates: { id, pos, name } from remote maps. */
export function collectPvpTargets(remotePlayers, netRemotes) {
  /** @type {{ id: string, pos: THREE.Vector3, name?: string }[]} */
  const out = [];
  if (remotePlayers) {
    for (const [id, rp] of remotePlayers) {
      if (!rp || rp._isDead) continue;
      const pos =
        rp.model?.position ||
        rp.targetPos ||
        rp.root?.position ||
        null;
      if (!pos) continue;
      out.push({ id, pos: pos.clone ? pos.clone() : new THREE.Vector3(pos.x, pos.y, pos.z), name: rp.name });
    }
  }
  if (netRemotes) {
    for (const [id, rp] of netRemotes) {
      if (!rp || rp.dead) continue;
      if (out.some((t) => t.id === id)) continue;
      const pos = rp.root?.position || rp.targetPos;
      if (!pos) continue;
      out.push({ id, pos: pos.clone(), name: rp.name });
    }
  }
  return out;
}
