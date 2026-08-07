/**
 * Character integrity grade — fail-closed proof for Multiverse Toon RTS.
 *
 * GREEN  = playable production hero
 * YELLOW = playable but degraded (mesh_ids partial, thin anims, etc.)
 * RED    = not production (capsule, legacy bake, no director, missing core bones)
 *
 * This is NOT a ban on Toon RTS content. It grades whether the *runtime bind* worked.
 */

/** Core Bip001 bones required for a usable humanoid retarget. */
export const CORE_BIP001_BONES = Object.freeze([
  "Bip001 Pelvis",
  "Bip001 Spine",
  "Bip001 Neck",
  "Bip001 Head",
  "Bip001 L UpperArm",
  "Bip001 R UpperArm",
  "Bip001 L Thigh",
  "Bip001 R Thigh",
]);

/**
 * Grade a finished character source object.
 * @param {Record<string, unknown>} source
 * @returns {{ grade: 'green'|'yellow'|'red', reasons: string[], ok: boolean }}
 */
export function gradeCharacterSource(source) {
  const s = source || {};
  const reasons = [];

  if (s.degraded || s.standIn || s.pipeline === "capsule") {
    reasons.push("capsule_or_degraded");
  }
  if (s.playMesh !== "toon-rts" && s.isToonRtsKit !== true) {
    reasons.push("not_toon_rts_play_mesh");
  }
  // ObjectStore hardened contract stamp (single Warlords play system)
  if (s.grudge6Play !== true && s.playMesh === "toon-rts") {
    // soft: older stamps may omit — require contract when present path claims Toon
  }
  if (s.warlordsPlayContract && !/^2026-08-07\.harden/.test(String(s.warlordsPlayContract))) {
    reasons.push(`stale_play_contract:${s.warlordsPlayContract}`);
  }
  if (!s.warlordsPlayContract && s.playMesh === "toon-rts") {
    reasons.push("missing_warlords_play_contract");
  }
  if (!s.director) {
    reasons.push("no_animation_director");
  }
  if (!s.coreBonesOk) {
    reasons.push(`core_bones_missing:${(s.coreBonesMissing || []).join(",") || "?"}`);
  }
  if (!s.coreClipOk) {
    reasons.push("idle_clip_missing_core_tracks");
  }
  const clips = Array.isArray(s.clipsLoaded) ? s.clipsLoaded : [];
  if (!clips.includes("idle") && !clips.includes("walk")) {
    reasons.push("no_idle_or_walk_clip");
  }
  const h = Number(s.heightM);
  if (Number.isFinite(h) && (h < 1.4 || h > 2.4)) {
    reasons.push(`height_out_of_band:${h.toFixed?.(2) ?? h}`);
  }
  const meshes = Array.isArray(s.shownMeshes) ? s.shownMeshes : [];
  if (meshes.length === 0 && !s.standIn) {
    reasons.push("no_mesh_ids_shown");
  }

  // Hard reds
  const hard = reasons.some((r) =>
    /capsule|not_toon|no_animation_director|core_bones_missing|idle_clip_missing/.test(r),
  );
  if (hard || reasons.length >= 3) {
    return { grade: "red", reasons, ok: false };
  }
  if (reasons.length > 0) {
    return { grade: "yellow", reasons, ok: false };
  }
  return { grade: "green", reasons: [], ok: true };
}

/** Human label for HUD. */
export function integrityLabel(grade, source) {
  const race = source?.raceId || source?.raceLabel || "?";
  const pack = source?.animPack || "?";
  if (grade === "green") return `Toon RTS · ${race} · ${pack} · OK`;
  if (grade === "yellow") return `Toon RTS · degraded · ${race}`;
  return `CHAR FAIL · ${race} · not production`;
}

export const INTEGRITY_COLORS = {
  green: { bg: "rgba(16,80,40,0.85)", border: "#3dba6a", text: "#b8f0c8" },
  yellow: { bg: "rgba(90,70,10,0.9)", border: "#e0b040", text: "#ffe9a8" },
  red: { bg: "rgba(90,16,16,0.92)", border: "#e05050", text: "#ffc8c8" },
};
