/**
 * Exact gear_presets mesh_ids — vendored SSOT from gameopen gearPresets.ts
 * (D1 / main-panel class kits). Do not invent mesh name hints.
 */

export const RACE_IDS = {
  human: "western-kingdoms",
  elf: "high-elves",
  undead: "undead",
  orc: "orcs",
  barbarian: "barbarians",
  dwarf: "dwarves",
};

/** @type {Record<string, { id: string, animPack: string, visibleMeshes: string[], label: string }[]>} */
export const RACE_GEAR_PRESETS = {
  "western-kingdoms": [
    { id: "mage", label: "Wizard", animPack: "magic", visibleMeshes: ["WK_Units_head_A","WK_Units_Body_A","WK_Units_Arms_A","WK_Units_Legs_A","WK_weapon_staff_C"] },
    { id: "ranger", label: "Archer", animPack: "longbow", visibleMeshes: ["WK_Units_head_C","WK_Units_Body_B","WK_Units_Arms_B","WK_Units_Legs_B","WK_weapon_Bow","WK_Xtra_quiver"] },
    { id: "warrior", label: "Warrior", animPack: "sword_shield", visibleMeshes: ["WK_Units_head_D","WK_Units_Body_C","WK_Units_Arms_B","WK_Units_Legs_B","WK_Units_shoulderpads_A","WK_weapon_sword_B","WK_Shield_B"] },
    { id: "unarmed", label: "Unarmed", animPack: "unarmed", visibleMeshes: ["WK_Units_head_A","WK_Units_Body_B","WK_Units_Arms_A","WK_Units_Legs_A"] },
  ],
  "high-elves": [
    { id: "mage", label: "Mage", animPack: "magic", visibleMeshes: ["ELF_Units_Head_B","ELF_Units_Body_A","ELF_Units_Arms_A","ELF_Units_Legs_A","ELF_weapon_staff_C"] },
    { id: "ranger", label: "Ranger", animPack: "longbow", visibleMeshes: ["ELF_Units_Head_C","ELF_Units_Body_B","ELF_Units_Arms_B","ELF_Units_Legs_B","ELF_Units_Shoulderpads_A","ELF_weapon_bow","ELF_Xtra_quiver"] },
    { id: "warrior", label: "Warrior", animPack: "sword_shield", visibleMeshes: ["ELF_Units_Head_D","ELF_Units_Body_C","ELF_Units_Arms_B","ELF_Units_Legs_B","ELF_Units_Shoulderpads_B","ELF_weapon_sword_B","ELF_shield_B"] },
    { id: "unarmed", label: "Unarmed", animPack: "unarmed", visibleMeshes: ["ELF_Units_Head_A","ELF_Units_Body_B","ELF_Units_Arms_A","ELF_Units_Legs_A"] },
  ],
  undead: [
    { id: "mage", label: "Lich", animPack: "magic", visibleMeshes: ["UD_Units_head_A","UD_Units_body_G","UD_Units_arms_B","UD_Units_legs_B","UD_weapon_staff_D"] },
    { id: "ranger", label: "Shade", animPack: "longbow", visibleMeshes: ["UD_Units_head_C","UD_Units_body_B","UD_Units_arms_B","UD_Units_legs_B","UD_Units_shoulderpads_A","UD_weapon_Bow","UD_Xtra_Quiver"] },
    { id: "warrior", label: "Warrior", animPack: "sword_shield", visibleMeshes: ["UD_Units_head_G","UD_Units_body_D","UD_Units_arms_C","UD_Units_legs_C","UD_Units_shoulderpads_B","UD_weapon_Sword_B","UD_Shield_C"] },
    { id: "unarmed", label: "Risen", animPack: "unarmed", visibleMeshes: ["UD_Units_head_A","UD_Units_body_B","UD_Units_arms_A","UD_Units_legs_A"] },
  ],
  orcs: [
    { id: "mage", label: "Shaman", animPack: "magic", visibleMeshes: ["ORC_Units_Head_A","ORC_Units_Body_A","ORC_Units_Arms_A","ORC_Units_Legs_A","ORC_weapon_staff_C"] },
    { id: "ranger", label: "Hunter", animPack: "longbow", visibleMeshes: ["ORC_Units_Head_B","ORC_Units_Body_B","ORC_Units_Arms_B","ORC_Units_Legs_B","ORC_Units_Shoulderpads_A","ORC_weapon_Bow","ORC_Xtra_quiver"] },
    { id: "warrior", label: "Warrior", animPack: "sword_shield", visibleMeshes: ["ORC_Units_Head_E","ORC_Units_Body_C","ORC_Units_Arms_B","ORC_Units_Legs_B","ORC_Units_Shoulderpads_C","ORC_weapon_Axe_B","ORC_Shield_C"] },
    { id: "unarmed", label: "Brawler", animPack: "unarmed", visibleMeshes: ["ORC_Units_Head_A","ORC_Units_Body_A","ORC_Units_Arms_A","ORC_Units_Legs_A"] },
  ],
};

/** Multiverse class → fleet race + preset (exact mesh_ids). */
export const CLASS_TO_PRESET = {
  warrior: { raceId: "western-kingdoms", presetId: "warrior", kitUrl: "https://assets.grudge-studio.com/models/grudge6/races/WK_Characters.glb" },
  ranger: { raceId: "high-elves", presetId: "ranger", kitUrl: "https://assets.grudge-studio.com/models/grudge6/races/ELF_Characters.glb" },
  mage: { raceId: "undead", presetId: "mage", kitUrl: "https://assets.grudge-studio.com/models/grudge6/races/UD_Characters.glb" },
  worge: { raceId: "orcs", presetId: "warrior", kitUrl: "https://assets.grudge-studio.com/models/grudge6/races/ORC_Characters.glb", animPackOverride: "twohand" },
};

export function getPreset(raceId, presetId) {
  const list = RACE_GEAR_PRESETS[raceId] || RACE_GEAR_PRESETS["western-kingdoms"];
  return list.find((p) => p.id === presetId) || list.find((p) => p.id === "warrior") || list[0];
}

export function resolveClassKit(classId) {
  const map = CLASS_TO_PRESET[classId] || CLASS_TO_PRESET.warrior;
  const preset = getPreset(map.raceId, map.presetId);
  return {
    ...map,
    animPack: map.animPackOverride || preset.animPack,
    visibleMeshes: preset.visibleMeshes.slice(),
    label: preset.label,
    preset,
  };
}
