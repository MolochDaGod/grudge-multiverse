/**
 * Per-town NPC roster — port of Island-Crusade npcRoster.ts.
 * 5 vendors + 3 guards + 1 captain per faction town; hub has full market.
 * Models: Toon RTS race via Multiverse raceId (not separate crusade/fabled GLB folders).
 */
import { THEMES } from "./realmZones.js";

const VENDOR_LABELS = ["Blacksmith", "Merchant", "Alchemist", "Fletcher", "Provisioner"];
const VENDOR_KEYS = ["weapon", "armor", "alchemist", "fletcher", "provisioner"];
const VENDOR_CLASSES = ["knight", "mage", "mage", "ranger", "ranger"];

/**
 * @param {{ id: string, faction: string, x: number, z: number, kind: string }} town
 */
export function buildTownNpcs(town) {
  if (town.kind !== "town") return [];
  const f = town.faction;
  const theme = THEMES[f] || {
    raceId: "western-kingdoms",
    accent: "#e8d9a8",
  };
  const raceId = f === "neutral" ? "western-kingdoms" : theme.raceId || "western-kingdoms";
  const cx = town.x;
  const cz = town.z;
  /** @type {object[]} */
  const npcs = [];

  for (let i = 0; i < 5; i++) {
    const t = (i - 2) * 0.5;
    npcs.push({
      id: `${town.id}-vendor-${i}`,
      townId: town.id,
      faction: f,
      role: "vendor",
      label: VENDOR_LABELS[i],
      vendorKey: VENDOR_KEYS[i],
      classId: VENDOR_CLASSES[i],
      raceId,
      x: cx + t * 7,
      z: cz - 9,
      rotationY: 0,
      mounted: false,
      accent: theme.accent || "#c9a227",
    });
  }

  const guardPts = [
    [cx - 10, cz + 4],
    [cx + 10, cz + 4],
    [cx, cz + 11],
  ];
  for (let i = 0; i < 3; i++) {
    const [x, z] = guardPts[i];
    npcs.push({
      id: `${town.id}-guard-${i}`,
      townId: town.id,
      faction: f,
      role: "guard",
      label: "Town Guard",
      classId: "warrior",
      raceId,
      x,
      z,
      rotationY: Math.atan2(cx - x, cz - z),
      mounted: false,
      accent: theme.accent || "#888",
      hostile: false,
    });
  }

  npcs.push({
    id: `${town.id}-captain`,
    townId: town.id,
    faction: f,
    role: "captain",
    label: "Captain — Missions",
    classId: "knight",
    raceId,
    x: cx,
    z: cz + 1,
    rotationY: 0,
    mounted: true,
    accent: theme.accent || "#e8d9a8",
  });

  return npcs;
}

export function buildAllTownNpcs(towns) {
  return towns.flatMap((t) => buildTownNpcs(t));
}

/** Camp raiders (hostile) around enemy camps. */
export function buildCampRaiders(camps) {
  const out = [];
  for (const c of camps) {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      out.push({
        id: `${c.id}-raider-${i}`,
        campId: c.id,
        faction: c.faction,
        role: "raider",
        label: "Raider",
        classId: "warrior",
        raceId: "orcs",
        x: c.x + Math.cos(a) * 6,
        z: c.z + Math.sin(a) * 6,
        rotationY: a + Math.PI,
        hostile: true,
        hp: 90,
        maxHp: 90,
        dmg: 12,
        accent: "#8b2020",
      });
    }
  }
  return out;
}
