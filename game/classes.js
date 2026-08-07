/**
 * Grudge6 RTS Toon classes for Multiverse.
 * Kits/atlases: game/grudge6SSOT.js ONLY (stone).
 * mesh_ids: fleetGearPresets.js
 */
import { resolveClassKit } from "./fleetGearPresets.js";
import { CDN, kitUrl, atlasUrl } from "./grudge6SSOT.js";

export { CDN };

/** @typedef {'warrior'|'ranger'|'mage'|'worge'} ClassId */
/** @typedef{'human'|'elf'|'undead'|'orc'} RaceId */

export const CLASSES = [
  {
    id: "warrior",
    label: "Warrior",
    raceId: "human",
    prefix: "WK_",
    kitUrl: kitUrl("western-kingdoms"),
    atlasUrl: atlasUrl("western-kingdoms"),
    animPack: "sword_shield",
    blurb: "Sword & shield · frontline · melee skills",
    starterGear: {
      weapon: { id: "t0_sword", name: "Recruit Sword", tier: 0, slot: "weapon", dmg: 12, meshFamily: "sword", meshLabel: "Sword", meshSlot: "sword" },
      armor: { id: "t0_mail", name: "Recruit Mail", tier: 0, slot: "armor", armor: 8, meshFamily: "heavy", meshLabel: "Mail body", meshSlot: "body" },
      offhand: { id: "t0_shield", name: "Wood Shield", tier: 0, slot: "shield", armor: 4, meshFamily: "shield", meshLabel: "Shield", meshSlot: "shield" },
    },
    /** @deprecated use resolveClassKit().visibleMeshes — exact gear_presets mesh_ids */
    meshHints: null,
    skills: [
      { id: "slash", name: "Slash", key: "KeyF", level: 1, cd: 0.8, dmgMul: 1.0, kind: "melee", rangeM: 2.8 },
      { id: "shield_bash", name: "Shield Bash", key: "Digit1", shift: true, level: 1, cd: 6, dmgMul: 1.4, kind: "melee", gapClose: 5.5, rangeM: 3.2 },
      { id: "war_cry", name: "War Cry", key: "Digit2", shift: true, level: 2, cd: 12, dmgMul: 0, kind: "buff" },
      { id: "cleave", name: "Cleave", key: "Digit3", shift: true, level: 3, cd: 8, dmgMul: 1.8, kind: "melee_aoe", aoeR: 4.2, rangeM: 4.2 },
      { id: "fortify", name: "Fortify", key: "Digit4", shift: true, level: 4, cd: 20, dmgMul: 0, kind: "buff" },
      { id: "execute", name: "Execute", key: "Digit5", shift: true, level: 5, cd: 15, dmgMul: 2.5, kind: "melee", gapClose: 4.5, rangeM: 3.0 },
    ],
  },
  {
    id: "ranger",
    label: "Ranger",
    raceId: "elf",
    prefix: "ELF_",
    kitUrl: kitUrl("high-elves"),
    atlasUrl: atlasUrl("high-elves"),
    animPack: "longbow",
    blurb: "Longbow · kiting · ranged skills",
    starterGear: {
      weapon: { id: "t0_bow", name: "Recruit Bow", tier: 0, slot: "weapon", dmg: 10, meshFamily: "bow", meshLabel: "Bow", meshSlot: "bow" },
      armor: { id: "t0_leather", name: "Scout Leather", tier: 0, slot: "armor", armor: 5, meshFamily: "medium", meshLabel: "Leather body", meshSlot: "body" },
      offhand: null,
    },
    meshHints: null,
    skills: [
      { id: "shot", name: "Quick Shot", key: "KeyF", level: 1, cd: 0.5, dmgMul: 1.0, kind: "ranged", rangeM: 22 },
      { id: "power_shot", name: "Power Shot", key: "Digit1", shift: true, level: 1, cd: 5, dmgMul: 1.6, kind: "ranged", rangeM: 24, gapClose: 0 },
      { id: "trap", name: "Snare", key: "Digit2", shift: true, level: 2, cd: 14, dmgMul: 0.5, kind: "ranged", rangeM: 14 },
      { id: "volley", name: "Volley", key: "Digit3", shift: true, level: 3, cd: 10, dmgMul: 1.2, kind: "ranged_aoe", aoeR: 4.0, rangeM: 18 },
      { id: "mark", name: "Hunter Mark", key: "Digit4", shift: true, level: 4, cd: 18, dmgMul: 0, kind: "debuff", rangeM: 28 },
      { id: "rain", name: "Arrow Rain", key: "Digit5", shift: true, level: 5, cd: 22, dmgMul: 2.0, kind: "ranged_aoe", aoeR: 5.5, rangeM: 20 },
    ],
  },
  {
    id: "mage",
    label: "Mage",
    raceId: "undead",
    prefix: "UD_",
    kitUrl: kitUrl("undead"),
    atlasUrl: atlasUrl("undead"),
    animPack: "magic",
    blurb: "Staff · bolts · area magic",
    starterGear: {
      weapon: { id: "t0_staff", name: "Apprentice Staff", tier: 0, slot: "weapon", dmg: 11, meshFamily: "staff", meshLabel: "Staff", meshSlot: "staff" },
      armor: { id: "t0_robe", name: "Apprentice Robe", tier: 0, slot: "armor", armor: 3, meshFamily: "light", meshLabel: "Robe body", meshSlot: "body" },
      offhand: null,
    },
    meshHints: null,
    skills: [
      { id: "bolt", name: "Arcane Bolt", key: "KeyF", level: 1, cd: 0.7, dmgMul: 1.0, kind: "magic", rangeM: 22 },
      { id: "nova", name: "Frost Nova", key: "Digit1", shift: true, level: 1, cd: 8, dmgMul: 1.3, kind: "magic_aoe", aoeR: 4.5, rangeM: 4.5 },
      { id: "shield", name: "Mana Shield", key: "Digit2", shift: true, level: 2, cd: 16, dmgMul: 0, kind: "buff" },
      { id: "meteor", name: "Meteor", key: "Digit3", shift: true, level: 3, cd: 14, dmgMul: 2.2, kind: "magic_aoe", aoeR: 5.5, rangeM: 20 },
      { id: "blink", name: "Blink", key: "Digit4", shift: true, level: 4, cd: 12, dmgMul: 0, kind: "mobility", gapClose: 9, rangeM: 9 },
      { id: "storm", name: "Storm", key: "Digit5", shift: true, level: 5, cd: 25, dmgMul: 2.8, kind: "magic_aoe", aoeR: 6.0, rangeM: 16 },
    ],
  },
  {
    id: "worge",
    label: "Worge",
    raceId: "orc",
    prefix: "ORC_",
    kitUrl: kitUrl("orcs"),
    atlasUrl: atlasUrl("orcs"),
    animPack: "2h_melee", // greatsword + samurai (alias: twohand / greatsword)
    blurb: "Brutal orc · 2H melee · raw power",
    starterGear: {
      weapon: { id: "t0_axe", name: "Worge Axe", tier: 0, slot: "weapon", dmg: 15, meshFamily: "axe", meshLabel: "Axe", meshSlot: "axe" },
      armor: { id: "t0_hide", name: "Hide Harness", tier: 0, slot: "armor", armor: 6, meshFamily: "medium", meshLabel: "Hide body", meshSlot: "body" },
      offhand: null,
    },
    meshHints: null,
    skills: [
      { id: "smash", name: "Smash", key: "KeyF", level: 1, cd: 0.9, dmgMul: 1.1, kind: "melee", rangeM: 2.9 },
      { id: "howl", name: "Howl", key: "Digit1", shift: true, level: 1, cd: 10, dmgMul: 0, kind: "buff", aoeR: 5 },
      { id: "leap", name: "Leap", key: "Digit2", shift: true, level: 2, cd: 9, dmgMul: 1.5, kind: "melee", gapClose: 7.5, rangeM: 3.2 },
      { id: "rend", name: "Rend", key: "Digit3", shift: true, level: 3, cd: 7, dmgMul: 1.7, kind: "melee", rangeM: 3.0 },
      { id: "enrage", name: "Enrage", key: "Digit4", shift: true, level: 4, cd: 18, dmgMul: 0, kind: "buff" },
      { id: "rampage", name: "Rampage", key: "Digit5", shift: true, level: 5, cd: 20, dmgMul: 2.4, kind: "melee_aoe", aoeR: 5.2, gapClose: 4.0, rangeM: 5.2 },
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
