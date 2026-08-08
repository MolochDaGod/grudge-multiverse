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
  // Warlords play contract — accept any 2026-08+ fleet stamp (not only old harden)
  if (s.warlordsPlayContract) {
    const c = String(s.warlordsPlayContract);
    if (!/^2026-0[89]|2026-1[0-2]|202[7-9]/.test(c) && !/valheim|harden|toon|island/i.test(c)) {
      reasons.push(`stale_play_contract:${c}`);
    }
  } else if (s.playMesh === "toon-rts") {
    // soft yellow only — loader may stamp after grade in some paths
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

  // Hard reds — block play
  const hard = reasons.some((r) =>
    /capsule|not_toon|no_animation_director|core_bones_missing|idle_clip_missing/.test(r),
  );
  if (hard) {
    return { grade: "red", reasons, ok: false };
  }
  // Yellow = playable with warnings (mesh_ids partial, soft contract noise)
  if (reasons.length > 0) {
    return { grade: "yellow", reasons, ok: true };
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
