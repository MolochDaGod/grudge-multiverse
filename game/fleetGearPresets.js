/**
 * Exact gear_presets mesh_ids — race kits/atlases ONLY from grudge6SSOT (stone).
 * Multiverse: pick race first, then class (preset).
 */
import {
  CDN,
  raceList,
  getRace as ssotGetRace,
  resolveRaceId,
  kitUrl,
  atlasUrl,
  assertAllowedKitUrl,
} from "./grudge6SSOT.js";

export { CDN };

/** Fleet race list for UI — kitUrl/atlasUrl from stone SSOT (verified textures/ paths). */
export const RACES = raceList().map((r) => ({
  id: r.raceId,
  short: r.short,
  label: r.label,
  prefix: r.prefix,
  kitUrl: r.kitGlb,
  atlasUrl: r.atlasUrl,
  color: r.color,
}));

/** Class presets available for every race (fleet gear_presets ids). */
export const CLASS_PRESETS = [
  { id: "warrior", label: "Warrior", blurb: "Sword & shield · melee", animPack: "sword_shield" },
  { id: "knight", label: "Knight", blurb: "Heavy plate · frontline", animPack: "sword_shield" },
  { id: "ranger", label: "Ranger", blurb: "Bow · ranged", animPack: "longbow" },
  { id: "mage", label: "Mage", blurb: "Staff · magic", animPack: "magic" },
  { id: "unarmed", label: "Unarmed", blurb: "Fists · raw", animPack: "unarmed" },
];

/** @type {Record<string, { id: string, animPack: string, visibleMeshes: string[], label: string }[]>} */
export const RACE_GEAR_PRESETS = {
  "western-kingdoms": [
    { id: "mage", label: "Wizard", animPack: "magic", visibleMeshes: ["WK_Units_head_A","WK_Units_Body_A","WK_Units_Arms_A","WK_Units_Legs_A","WK_weapon_staff_C"] },
    { id: "knight", label: "Knight", animPack: "sword_shield", visibleMeshes: ["WK_Units_head_F","WK_Units_Body_E","WK_Units_Arms_D","WK_Units_Legs_C","WK_Units_shoulderpads_B","WK_weapon_sword_B","WK_Shield_B"] },
    { id: "ranger", label: "Archer", animPack: "longbow", visibleMeshes: ["WK_Units_head_C","WK_Units_Body_B","WK_Units_Arms_B","WK_Units_Legs_B","WK_weapon_Bow","WK_Xtra_quiver"] },
    { id: "warrior", label: "Warrior", animPack: "sword_shield", visibleMeshes: ["WK_Units_head_D","WK_Units_Body_C","WK_Units_Arms_B","WK_Units_Legs_B","WK_Units_shoulderpads_A","WK_weapon_sword_B","WK_Shield_B"] },
    { id: "unarmed", label: "Unarmed", animPack: "unarmed", visibleMeshes: ["WK_Units_head_A","WK_Units_Body_B","WK_Units_Arms_A","WK_Units_Legs_A"] },
  ],
  "high-elves": [
    { id: "mage", label: "Mage", animPack: "magic", visibleMeshes: ["ELF_Units_Head_B","ELF_Units_Body_A","ELF_Units_Arms_A","ELF_Units_Legs_A","ELF_weapon_staff_C"] },
    { id: "knight", label: "Knight", animPack: "sword_shield", visibleMeshes: ["ELF_Units_Head_G","ELF_Units_Body_E","ELF_Units_Arms_C","ELF_Units_Legs_C","ELF_Units_Shoulderpads_C","ELF_weapon_sword_B","ELF_shield_B"] },
    { id: "ranger", label: "Ranger", animPack: "longbow", visibleMeshes: ["ELF_Units_Head_C","ELF_Units_Body_B","ELF_Units_Arms_B","ELF_Units_Legs_B","ELF_Units_Shoulderpads_A","ELF_weapon_bow","ELF_Xtra_quiver"] },
    { id: "warrior", label: "Warrior", animPack: "sword_shield", visibleMeshes: ["ELF_Units_Head_D","ELF_Units_Body_C","ELF_Units_Arms_B","ELF_Units_Legs_B","ELF_Units_Shoulderpads_B","ELF_weapon_sword_B","ELF_shield_B"] },
    { id: "unarmed", label: "Unarmed", animPack: "unarmed", visibleMeshes: ["ELF_Units_Head_A","ELF_Units_Body_B","ELF_Units_Arms_A","ELF_Units_Legs_A"] },
  ],
  undead: [
    { id: "mage", label: "Lich", animPack: "magic", visibleMeshes: ["UD_Units_head_A","UD_Units_body_G","UD_Units_arms_B","UD_Units_legs_B","UD_weapon_staff_D"] },
    { id: "knight", label: "Death Knight", animPack: "sword_shield", visibleMeshes: ["UD_Units_head_F","UD_Units_body_F","UD_Units_arms_D","UD_Units_legs_D","UD_Units_shoulderpads_C","UD_weapon_Sword_B","UD_Shield_C"] },
    { id: "ranger", label: "Shade", animPack: "longbow", visibleMeshes: ["UD_Units_head_C","UD_Units_body_B","UD_Units_arms_B","UD_Units_legs_B","UD_Units_shoulderpads_A","UD_weapon_Bow","UD_Xtra_Quiver"] },
    { id: "warrior", label: "Warrior", animPack: "sword_shield", visibleMeshes: ["UD_Units_head_G","UD_Units_body_D","UD_Units_arms_C","UD_Units_legs_C","UD_Units_shoulderpads_B","UD_weapon_Sword_B","UD_Shield_C"] },
    { id: "unarmed", label: "Risen", animPack: "unarmed", visibleMeshes: ["UD_Units_head_A","UD_Units_body_B","UD_Units_arms_A","UD_Units_legs_A"] },
  ],
  orcs: [
    { id: "mage", label: "Shaman", animPack: "magic", visibleMeshes: ["ORC_Units_Head_A","ORC_Units_Body_A","ORC_Units_Arms_A","ORC_Units_Legs_A","ORC_weapon_staff_C"] },
    { id: "knight", label: "Warchief", animPack: "sword_shield", visibleMeshes: ["ORC_Units_Head_G","ORC_Units_Body_F","ORC_Units_Arms_C","ORC_Units_Legs_C","ORC_Units_Shoulderpads_F","ORC_weapon_Axe_C","ORC_Shield_C"] },
    { id: "ranger", label: "Hunter", animPack: "longbow", visibleMeshes: ["ORC_Units_Head_B","ORC_Units_Body_B","ORC_Units_Arms_B","ORC_Units_Legs_B","ORC_Units_Shoulderpads_A","ORC_weapon_Bow","ORC_Xtra_quiver"] },
    { id: "warrior", label: "Warrior", animPack: "sword_shield", visibleMeshes: ["ORC_Units_Head_E","ORC_Units_Body_C","ORC_Units_Arms_B","ORC_Units_Legs_B","ORC_Units_Shoulderpads_C","ORC_weapon_Axe_B","ORC_Shield_C"] },
    { id: "unarmed", label: "Brawler", animPack: "unarmed", visibleMeshes: ["ORC_Units_Head_A","ORC_Units_Body_A","ORC_Units_Arms_A","ORC_Units_Legs_A"] },
  ],
  barbarians: [
    { id: "mage", label: "Mage", animPack: "magic", visibleMeshes: ["BRB_head_A","BRB_body_A","BRB_arms_A","BRB_legs_A","BRB_weapon_staff_C"] },
    { id: "knight", label: "Knight", animPack: "sword_shield", visibleMeshes: ["BRB_head_F","BRB_body_F","BRB_arms_C","BRB_legs_C","BRB_shoulderpads_C","BRB_weapon_sword_B","BRB_Shield_B"] },
    { id: "ranger", label: "Ranger", animPack: "longbow", visibleMeshes: ["BRB_head_C","BRB_body_B","BRB_arms_B","BRB_legs_B","BRB_shoulderpads_A","BRB_weapon_Bow","BRB_Xtra_quiver"] },
    { id: "warrior", label: "Warrior", animPack: "sword_shield", visibleMeshes: ["BRB_head_B","BRB_body_C","BRB_arms_B","BRB_legs_B","BRB_shoulderpads_B","BRB_weapon_sword_B","BRB_Shield_B"] },
    { id: "unarmed", label: "Unarmed", animPack: "unarmed", visibleMeshes: ["BRB_head_A","BRB_body_B","BRB_arms_A","BRB_legs_A"] },
  ],
  dwarves: [
    { id: "mage", label: "Mage", animPack: "magic", visibleMeshes: ["DWF_Units_Head_A","DWF_Units_Body_A","DWF_Units_Arms_A","DWF_Units_Legs_A","DWF_Weapon_staff_B"] },
    { id: "knight", label: "Knight", animPack: "sword_shield", visibleMeshes: ["DWF_Units_Head_F","DWF_Units_Body_D","DWF_Units_Arms_C","DWF_Units_Legs_C","DWF_Units_Shoulderpads_C","DWF_Weapon_sword_B","DWF_Shield_B"] },
    { id: "ranger", label: "Ranger", animPack: "longbow", visibleMeshes: ["DWF_Units_Head_C","DWF_Units_Body_B","DWF_Units_Arms_B","DWF_Units_Legs_B","DWF_Units_Shoulderpads_A","DWF_Weapon_bow","DWF_Xtra_quiver"] },
    { id: "warrior", label: "Warrior", animPack: "sword_shield", visibleMeshes: ["DWF_Units_Head_G","DWF_Units_Body_C","DWF_Units_Arms_B","DWF_Units_Legs_B","DWF_Units_Shoulderpads_B","DWF_Weapon_sword_B","DWF_Shield_B"] },
    { id: "unarmed", label: "Unarmed", animPack: "unarmed", visibleMeshes: ["DWF_Units_Head_A","DWF_Units_Body_B","DWF_Units_Arms_A","DWF_Units_Legs_A"] },
  ],
};

export function getRace(raceId) {
  const id = resolveRaceId(raceId);
  return RACES.find((r) => r.id === id || r.short === raceId) || RACES[0];
}

export function getPreset(raceId, presetId) {
  const race = getRace(raceId);
  const list = RACE_GEAR_PRESETS[race.id] || RACE_GEAR_PRESETS["western-kingdoms"];
  return list.find((p) => p.id === presetId) || list.find((p) => p.id === "warrior") || list[0];
}

/** Primary resolver: race + class preset. Kit/atlas always from stone SSOT. */
export function resolveRaceClass(raceId, classId) {
  const race = getRace(raceId);
  const preset = getPreset(race.id, classId || "warrior");
  const url = assertAllowedKitUrl(kitUrl(race.id));
  return {
    raceId: race.id,
    raceShort: race.short,
    raceLabel: race.label,
    classId: preset.id,
    kitUrl: url,
    atlasUrl: atlasUrl(race.id),
    prefix: race.prefix,
    color: race.color,
    animPack: preset.animPack,
    visibleMeshes: preset.visibleMeshes.slice(),
    label: `${race.label} · ${preset.label}`,
    presetLabel: preset.label,
    preset,
  };
}

/** @deprecated prefer resolveRaceClass — maps legacy single class id */
export function resolveClassKit(classId) {
  const legacy = {
    warrior: { raceId: "western-kingdoms", classId: "warrior" },
    ranger: { raceId: "high-elves", classId: "ranger" },
    mage: { raceId: "undead", classId: "mage" },
    worge: { raceId: "orcs", classId: "warrior", animPackOverride: "twohand" },
    knight: { raceId: "western-kingdoms", classId: "knight" },
    unarmed: { raceId: "western-kingdoms", classId: "unarmed" },
  };
  const m = legacy[classId] || legacy.warrior;
  const kit = resolveRaceClass(m.raceId, m.classId);
  if (m.animPackOverride) kit.animPack = m.animPackOverride;
  return kit;
}

export function loadSelection() {
  return {
    raceId: localStorage.getItem("mv_race_id") || "western-kingdoms",
    classId: localStorage.getItem("mv_class_id") || "warrior",
  };
}

export function saveSelection(raceId, classId) {
  localStorage.setItem("mv_race_id", raceId);
  localStorage.setItem("mv_class_id", classId);
}
