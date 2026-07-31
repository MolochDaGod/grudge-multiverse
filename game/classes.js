/**
 * Grudge6 RTS Toon classes for Multiverse.
 * CDN SSOT: assets.grudge-studio.com/models/grudge6/races/*
 * Exact mesh_ids: fleetGearPresets.js (gameopen gearPresets.ts / D1)
 * Classes: warrior | ranger | mage | worge
 */
import { resolveClassKit } from "./fleetGearPresets.js";

export const CDN = "https://assets.grudge-studio.com";

/** @typedef {'warrior'|'ranger'|'mage'|'worge'} ClassId */
/** @typedef {'human'|'elf'|'undead'|'orc'} RaceId */

export const CLASSES = [
  {
    id: "warrior",
    label: "Warrior",
    raceId: "human",
    prefix: "WK_",
    kitUrl: `${CDN}/models/grudge6/races/WK_Characters.glb`,
    atlasUrl: `${CDN}/models/grudge6/atlases/WK_Standard_Units.webp`,
    animPack: "sword_shield",
    blurb: "Sword & shield · frontline · melee skills",
    starterGear: {
      weapon: { id: "t0_sword", name: "Recruit Sword", tier: 0, slot: "weapon", dmg: 12 },
      armor: { id: "t0_mail", name: "Recruit Mail", tier: 0, slot: "armor", armor: 8 },
      offhand: { id: "t0_shield", name: "Wood Shield", tier: 0, slot: "shield", armor: 4 },
    },
    /** @deprecated use resolveClassKit().visibleMeshes — exact gear_presets mesh_ids */
    meshHints: null,
    skills: [
      { id: "slash", name: "Slash", key: "KeyF", level: 1, cd: 0.8, dmgMul: 1.0, kind: "melee" },
      { id: "shield_bash", name: "Shield Bash", key: "Digit1", shift: true, level: 1, cd: 6, dmgMul: 1.4, kind: "melee" },
      { id: "war_cry", name: "War Cry", key: "Digit2", shift: true, level: 2, cd: 12, dmgMul: 0, kind: "buff" },
      { id: "cleave", name: "Cleave", key: "Digit3", shift: true, level: 3, cd: 8, dmgMul: 1.8, kind: "melee_aoe" },
      { id: "fortify", name: "Fortify", key: "Digit4", shift: true, level: 4, cd: 20, dmgMul: 0, kind: "buff" },
      { id: "execute", name: "Execute", key: "Digit5", shift: true, level: 5, cd: 15, dmgMul: 2.5, kind: "melee" },
    ],
  },
  {
    id: "ranger",
    label: "Ranger",
    raceId: "elf",
    prefix: "ELF_",
    kitUrl: `${CDN}/models/grudge6/races/ELF_Characters.glb`,
    atlasUrl: `${CDN}/models/grudge6/atlases/ELF_HighElves_Texture.webp`,
    animPack: "longbow",
    blurb: "Longbow · kiting · ranged skills",
    starterGear: {
      weapon: { id: "t0_bow", name: "Recruit Bow", tier: 0, slot: "weapon", dmg: 10 },
      armor: { id: "t0_leather", name: "Scout Leather", tier: 0, slot: "armor", armor: 5 },
      offhand: null,
    },
    meshHints: null,
    skills: [
      { id: "shot", name: "Quick Shot", key: "KeyF", level: 1, cd: 0.5, dmgMul: 1.0, kind: "ranged" },
      { id: "power_shot", name: "Power Shot", key: "Digit1", shift: true, level: 1, cd: 5, dmgMul: 1.6, kind: "ranged" },
      { id: "trap", name: "Snare", key: "Digit2", shift: true, level: 2, cd: 14, dmgMul: 0.5, kind: "ranged" },
      { id: "volley", name: "Volley", key: "Digit3", shift: true, level: 3, cd: 10, dmgMul: 1.2, kind: "ranged_aoe" },
      { id: "mark", name: "Hunter Mark", key: "Digit4", shift: true, level: 4, cd: 18, dmgMul: 0, kind: "debuff" },
      { id: "rain", name: "Arrow Rain", key: "Digit5", shift: true, level: 5, cd: 22, dmgMul: 2.0, kind: "ranged_aoe" },
    ],
  },
  {
    id: "mage",
    label: "Mage",
    raceId: "undead",
    prefix: "UD_",
    kitUrl: `${CDN}/models/grudge6/races/UD_Characters.glb`,
    atlasUrl: `${CDN}/models/grudge6/atlases/UD_Standard_Units.webp`,
    animPack: "magic",
    blurb: "Staff · bolts · area magic",
    starterGear: {
      weapon: { id: "t0_staff", name: "Apprentice Staff", tier: 0, slot: "weapon", dmg: 11 },
      armor: { id: "t0_robe", name: "Apprentice Robe", tier: 0, slot: "armor", armor: 3 },
      offhand: null,
    },
    meshHints: null,
    skills: [
      { id: "bolt", name: "Arcane Bolt", key: "KeyF", level: 1, cd: 0.7, dmgMul: 1.0, kind: "magic" },
      { id: "nova", name: "Frost Nova", key: "Digit1", shift: true, level: 1, cd: 8, dmgMul: 1.3, kind: "magic_aoe" },
      { id: "shield", name: "Mana Shield", key: "Digit2", shift: true, level: 2, cd: 16, dmgMul: 0, kind: "buff" },
      { id: "meteor", name: "Meteor", key: "Digit3", shift: true, level: 3, cd: 14, dmgMul: 2.2, kind: "magic_aoe" },
      { id: "blink", name: "Blink", key: "Digit4", shift: true, level: 4, cd: 12, dmgMul: 0, kind: "mobility" },
      { id: "storm", name: "Storm", key: "Digit5", shift: true, level: 5, cd: 25, dmgMul: 2.8, kind: "magic_aoe" },
    ],
  },
  {
    id: "worge",
    label: "Worge",
    raceId: "orc",
    prefix: "ORC_",
    kitUrl: `${CDN}/models/grudge6/races/ORC_Characters.glb`,
    atlasUrl: `${CDN}/models/grudge6/atlases/ORC_StandardUnits.webp`,
    animPack: "twohand",
    blurb: "Brutal orc · 2H melee · raw power",
    starterGear: {
      weapon: { id: "t0_axe", name: "Worge Axe", tier: 0, slot: "weapon", dmg: 15 },
      armor: { id: "t0_hide", name: "Hide Harness", tier: 0, slot: "armor", armor: 6 },
      offhand: null,
    },
    meshHints: null,
    skills: [
      { id: "smash", name: "Smash", key: "KeyF", level: 1, cd: 0.9, dmgMul: 1.1, kind: "melee" },
      { id: "howl", name: "Howl", key: "Digit1", shift: true, level: 1, cd: 10, dmgMul: 0, kind: "buff" },
      { id: "leap", name: "Leap", key: "Digit2", shift: true, level: 2, cd: 9, dmgMul: 1.5, kind: "melee" },
      { id: "rend", name: "Rend", key: "Digit3", shift: true, level: 3, cd: 7, dmgMul: 1.7, kind: "melee" },
      { id: "enrage", name: "Enrage", key: "Digit4", shift: true, level: 4, cd: 18, dmgMul: 0, kind: "buff" },
      { id: "rampage", name: "Rampage", key: "Digit5", shift: true, level: 5, cd: 20, dmgMul: 2.4, kind: "melee_aoe" },
    ],
  },
];

export function getClass(id) {
  return CLASSES.find((c) => c.id === id) || CLASSES[0];
}

/** Exact gear_presets mesh_ids + anim pack for a Multiverse class. */
export function getClassKit(id) {
  return resolveClassKit(id);
}

/** Level unlock: skill index unlocked when player level >= skill.level */
export function unlockedSkills(classDef, level) {
  return (classDef.skills || []).filter((s) => level >= (s.level || 1));
}
