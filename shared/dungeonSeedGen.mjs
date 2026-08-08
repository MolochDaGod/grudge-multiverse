/**
 * Kenney Modular Dungeon — isomorphic seed → DungeonDocument.
 *
 * Contract: same seed string → same layout (entrance, halls, openings,
 * enemies, boss). Client SPA + tools share this module.
 *
 * Schema: grudge.multiverse.dungeon/v1
 * Kit: kenney_modular-dungeon-kit (CC0) · 4 m modular tile
 */
import { mulberry32, parseSeed, hashString, childSeed } from "./worldSeedGen.mjs";

export const DUNGEON_SCHEMA = "grudge.multiverse.dungeon/v1";
export const DUNGEON_GEN_VERSION = "2026-08-08.1-kenney-modular-dungeon";

/** SI metres per Kenney modular cell (catalog si.modularTileM). */
export const DUNGEON_TILE_M = 4;

/** Default dungeon seed when world does not stamp one. */
export const DEFAULT_DUNGEON_SEED = "CRYPT01";

export const DIR = {
  N: { dx: 0, dz: -1, yaw: 0, name: "N" },
  E: { dx: 1, dz: 0, yaw: -Math.PI / 2, name: "E" },
  S: { dx: 0, dz: 1, yaw: Math.PI, name: "S" },
  W: { dx: -1, dz: 0, yaw: Math.PI / 2, name: "W" },
};

const OPP = { N: "S", S: "N", E: "W", W: "E" };

/** Piece picks by topology role. */
export const PIECE_POOL = {
  entrance: ["room-small", "room-small-variation"],
  hall_straight: ["corridor", "corridor-wide"],
  hall_corner: ["corridor-corner", "corridor-wide-corner"],
  hall_junction: ["corridor-junction", "corridor-wide-junction"],
  hall_cross: ["corridor-intersection", "corridor-wide-intersection"],
  hall_end: ["corridor-end", "corridor-wide-end"],
  hall_transition: ["corridor-transition"],
  room_small: ["room-small", "room-small-variation", "room-corner"],
  room_large: ["room-large", "room-large-variation", "room-wide", "room-wide-variation"],
  gate: ["gate-door", "gate", "gate-door-window", "gate-metal-bars"],
  stairs: ["stairs", "stairs-wide"],
  boss_room: ["room-large", "room-large-variation", "room-wide"],
};

function pick(rng, arr) {
  if (!arr?.length) return null;
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

function key(gx, gz) {
  return `${gx},${gz}`;
}

function cellWorld(gx, gz, tileM, origin) {
  return {
    x: (origin?.x || 0) + gx * tileM,
    z: (origin?.z || 0) + gz * tileM,
  };
}

/**
 * Generate a modular dungeon layout from a seed label.
 *
 * @param {string|number} seedInput
 * @param {{
 *   tileM?: number,
 *   spineLen?: number,
 *   sideRooms?: number,
 *   enemyDensity?: number,
 *   origin?: {x:number,z:number,y?:number},
 *   worldSeed?: string,
 * }} [opts]
 * @returns {object} DungeonDocument
 */
export function generateDungeon(seedInput, opts = {}) {
  const seedLabel = normalizeDungeonSeed(seedInput);
  const seedU32 = parseSeed(seedLabel);
  const rng = mulberry32(seedU32);
  const tileM = opts.tileM || DUNGEON_TILE_M;
  const spineLen = Math.max(4, Math.min(24, opts.spineLen ?? 8 + Math.floor(rng() * 5)));
  const sideRooms = Math.max(1, Math.min(12, opts.sideRooms ?? 3 + Math.floor(rng() * 3)));
  const enemyDensity = opts.enemyDensity ?? 1.0;
  const origin = opts.origin || { x: 0, y: 0, z: 0 };

  /** @type {Map<string, object>} */
  const grid = new Map();
  /** @type {object[]} */
  const modules = [];
  /** @type {object[]} */
  const openings = [];
  /** @type {object[]} */
  const enemies = [];

  function placeModule(def) {
    const k = key(def.gx, def.gz);
    if (grid.has(k)) return grid.get(k);
    const w = cellWorld(def.gx, def.gz, tileM, origin);
    const mod = {
      id: def.id || `mod-${def.gx}-${def.gz}`,
      gx: def.gx,
      gz: def.gz,
      x: w.x,
      y: origin.y || 0,
      z: w.z,
      yaw: def.yaw || 0,
      piece: def.piece,
      role: def.role,
      kind: def.kind,
      depth: def.depth || 0,
      exits: def.exits || [],
    };
    grid.set(k, mod);
    modules.push(mod);
    return mod;
  }

  // ── Entrance (south) ─────────────────────────────────────────────────────
  const entrancePiece = pick(rng, PIECE_POOL.entrance);
  const entrance = placeModule({
    id: "entrance",
    gx: 0,
    gz: 0,
    piece: entrancePiece,
    role: "room",
    kind: "entrance",
    depth: 0,
    yaw: 0,
    exits: ["N"],
  });

  // Gate opening facing south (outside world)
  openings.push({
    id: "opening-entrance-gate",
    type: "gate",
    gx: 0,
    gz: 0,
    x: entrance.x,
    z: entrance.z + tileM * 0.45,
    yaw: Math.PI,
    piece: pick(rng, PIECE_POOL.gate),
    links: ["world", "entrance"],
  });

  // ── Spine halls north ────────────────────────────────────────────────────
  let prev = entrance;
  for (let i = 1; i <= spineLen; i++) {
    const gz = -i;
    const isLast = i === spineLen;
    const piece = isLast
      ? pick(rng, PIECE_POOL.hall_end)
      : i % 4 === 0
        ? pick(rng, PIECE_POOL.hall_transition)
        : pick(rng, PIECE_POOL.hall_straight);
    prev = placeModule({
      id: `hall-spine-${i}`,
      gx: 0,
      gz,
      piece,
      role: "corridor",
      kind: isLast ? "hall_end" : "hall",
      depth: i,
      yaw: 0,
      exits: isLast ? ["S"] : ["N", "S"],
    });
  }

  // ── Side rooms off spine ─────────────────────────────────────────────────
  let roomsPlaced = 0;
  const roomCells = [];
  for (let attempt = 0; attempt < sideRooms * 4 && roomsPlaced < sideRooms; attempt++) {
    const spineI = 2 + Math.floor(rng() * Math.max(1, spineLen - 2));
    const side = rng() > 0.5 ? 1 : -1; // E or W
    const gx = side;
    const gz = -spineI;
    const k = key(gx, gz);
    if (grid.has(k)) continue;

    // Junction on spine if not already special
    const spineKey = key(0, gz);
    const spineMod = grid.get(spineKey);
    if (spineMod && spineMod.role === "corridor") {
      spineMod.piece = pick(rng, PIECE_POOL.hall_junction);
      spineMod.kind = "hall_junction";
      spineMod.yaw = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      if (!spineMod.exits.includes(side > 0 ? "E" : "W")) {
        spineMod.exits.push(side > 0 ? "E" : "W");
      }
    }

    // Connecting corridor stub
    const large = rng() > 0.55;
    const roomPiece = pick(rng, large ? PIECE_POOL.room_large : PIECE_POOL.room_small);
    const room = placeModule({
      id: `room-side-${roomsPlaced}`,
      gx,
      gz,
      piece: roomPiece,
      role: "room",
      kind: "room",
      depth: spineI + 1,
      yaw: side > 0 ? -Math.PI / 2 : Math.PI / 2,
      exits: [side > 0 ? "W" : "E"],
    });
    roomCells.push(room);
    roomsPlaced++;

    openings.push({
      id: `opening-room-${roomsPlaced}`,
      type: "door",
      gx,
      gz,
      x: room.x - side * tileM * 0.4,
      z: room.z,
      yaw: side > 0 ? Math.PI / 2 : -Math.PI / 2,
      piece: pick(rng, PIECE_POOL.gate),
      links: [spineMod?.id || "spine", room.id],
    });
  }

  // ── Boss chamber at north end ────────────────────────────────────────────
  const bossGz = -(spineLen + 1);
  const bossPiece = pick(rng, PIECE_POOL.boss_room);
  const bossRoom = placeModule({
    id: "boss-chamber",
    gx: 0,
    gz: bossGz,
    piece: bossPiece,
    role: "room",
    kind: "boss",
    depth: spineLen + 1,
    yaw: 0,
    exits: ["S"],
  });

  // Upgrade last spine to lead into boss
  const lastHall = grid.get(key(0, -spineLen));
  if (lastHall) {
    lastHall.piece = pick(rng, PIECE_POOL.hall_straight);
    lastHall.kind = "hall_to_boss";
    if (!lastHall.exits.includes("N")) lastHall.exits.push("N");
  }

  openings.push({
    id: "opening-boss-gate",
    type: "boss_gate",
    gx: 0,
    gz: bossGz,
    x: bossRoom.x,
    z: bossRoom.z + tileM * 0.45,
    yaw: 0,
    piece: pick(rng, ["gate-metal-bars", "gate-door", "gate"]),
    links: [lastHall?.id || "spine", bossRoom.id],
  });

  // Optional stairs module as vertical cue near mid-spine
  if (rng() > 0.35) {
    const sg = -Math.floor(spineLen / 2);
    if (!grid.has(key(1, sg))) {
      placeModule({
        id: "stairs-mid",
        gx: 1,
        gz: sg,
        piece: pick(rng, PIECE_POOL.stairs),
        role: "stairs",
        kind: "stairs",
        depth: Math.floor(spineLen / 2),
        yaw: -Math.PI / 2,
        exits: ["W"],
      });
    }
  }

  // ── Enemies (rooms only, not entrance) ───────────────────────────────────
  const enemyTypes = [
    { type: "dungeon_skirmisher", label: "Crypt Skirmisher", hp: 70, dmg: 10, height: 1.8 },
    { type: "dungeon_archer", label: "Crypt Archer", hp: 55, dmg: 12, height: 1.75 },
    { type: "dungeon_brute", label: "Crypt Brute", hp: 120, dmg: 16, height: 2.05 },
  ];
  let enemyI = 0;
  for (const room of roomCells) {
    const n = Math.max(1, Math.round((1 + rng() * 2) * enemyDensity));
    for (let e = 0; e < n; e++) {
      const et = pick(rng, enemyTypes);
      const ang = rng() * Math.PI * 2;
      const rad = 0.6 + rng() * 1.2;
      enemies.push({
        id: `enemy-${enemyI++}`,
        roomId: room.id,
        type: et.type,
        label: et.label,
        hp: et.hp,
        maxHp: et.hp,
        dmg: et.dmg,
        height: et.height,
        x: room.x + Math.cos(ang) * rad,
        y: room.y,
        z: room.z + Math.sin(ang) * rad,
        hostile: true,
        dungeon: true,
      });
    }
  }

  // Boss actor stamp
  const boss = {
    id: `boss-${seedLabel.toLowerCase()}`,
    roomId: bossRoom.id,
    type: "dungeon_boss",
    label: pick(rng, [
      "Crypt Warden",
      "Bone Sovereign",
      "Ashen Jailer",
      "Vault Horror",
      "Dungeon Heart",
    ]),
    hp: 600 + Math.floor(rng() * 400),
    maxHp: 0,
    dmg: 28,
    height: 2.6,
    x: bossRoom.x,
    y: bossRoom.y,
    z: bossRoom.z,
    hostile: true,
    dungeon: true,
    boss: true,
  };
  boss.maxHp = boss.hp;

  // Hall ambush enemies (light)
  for (let i = 2; i < spineLen; i += 3) {
    const hall = grid.get(key(0, -i));
    if (!hall) continue;
    if (rng() > 0.55 * enemyDensity) continue;
    const et = pick(rng, enemyTypes);
    enemies.push({
      id: `enemy-hall-${i}`,
      roomId: hall.id,
      type: et.type,
      label: et.label,
      hp: Math.round(et.hp * 0.85),
      maxHp: Math.round(et.hp * 0.85),
      dmg: et.dmg,
      height: et.height,
      x: hall.x + (rng() - 0.5) * 1.2,
      y: hall.y,
      z: hall.z + (rng() - 0.5) * 1.2,
      hostile: true,
      dungeon: true,
    });
  }

  const bounds = {
    minGx: Infinity,
    maxGx: -Infinity,
    minGz: Infinity,
    maxGz: -Infinity,
  };
  for (const m of modules) {
    bounds.minGx = Math.min(bounds.minGx, m.gx);
    bounds.maxGx = Math.max(bounds.maxGx, m.gx);
    bounds.minGz = Math.min(bounds.minGz, m.gz);
    bounds.maxGz = Math.max(bounds.maxGz, m.gz);
  }

  const entranceWorld = {
    x: entrance.x,
    y: origin.y || 0,
    z: entrance.z + tileM * 0.9,
    yaw: Math.PI, // face into dungeon (north)
    piece: openings[0]?.piece || "gate-door",
  };

  return {
    schema: DUNGEON_SCHEMA,
    genVersion: DUNGEON_GEN_VERSION,
    seed: seedLabel,
    seedU32,
    worldSeed: opts.worldSeed || null,
    tileM,
    origin: { ...origin },
    entrance: entranceWorld,
    modules,
    openings,
    enemies,
    boss,
    bossRoom: {
      id: bossRoom.id,
      x: bossRoom.x,
      z: bossRoom.z,
      piece: bossRoom.piece,
    },
    bounds,
    counts: {
      modules: modules.length,
      rooms: modules.filter((m) => m.role === "room").length,
      halls: modules.filter((m) => m.role === "corridor").length,
      openings: openings.length,
      enemies: enemies.length,
      bosses: 1,
    },
    summary: `${seedLabel} · spine ${spineLen} · rooms ${roomsPlaced} · enemies ${enemies.length} · boss ${boss.label}`,
  };
}

export function normalizeDungeonSeed(raw) {
  const s = String(raw || DEFAULT_DUNGEON_SEED)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 24);
  return s || DEFAULT_DUNGEON_SEED;
}

/**
 * Derive a dungeon seed from a world seed + index (deterministic).
 */
export function dungeonSeedFromWorld(worldSeed, index = 0) {
  const base = hashString(`${worldSeed || "VALHEIM42"}|dungeon|${index}`);
  // Encode as short alnum label
  const hex = (base >>> 0).toString(16).toUpperCase().padStart(8, "0");
  return `D${hex.slice(0, 7)}`;
}

/**
 * World-document stamps: dungeon entrance POIs for Multiverse.
 * Call from generateWorld after hub POIs.
 */
export function stampDungeonPois(pois, worldSeed, rng, hubRadius = 340) {
  const list = pois || [];
  // Primary hub crypt entrance
  const ang = -Math.PI * 0.55 + (rng() - 0.5) * 0.2;
  const r = hubRadius * (0.55 + rng() * 0.08);
  const dSeed = dungeonSeedFromWorld(worldSeed, 0);
  list.push({
    id: "poi-dungeon-hub",
    name: "Ancient Crypt",
    x: Math.cos(ang) * r,
    z: Math.sin(ang) * r,
    kind: "dungeon",
    accent: "#6a4a8a",
    radius: 5,
    dungeonSeed: dSeed,
    dungeonIndex: 0,
  });
  // Outer wilderness crypt
  const ang2 = Math.PI * 0.7 + (rng() - 0.5) * 0.3;
  const r2 = hubRadius * (1.4 + rng() * 0.3);
  const dSeed2 = dungeonSeedFromWorld(worldSeed, 1);
  list.push({
    id: "poi-dungeon-wild",
    name: "Forgotten Vault",
    x: Math.cos(ang2) * r2,
    z: Math.sin(ang2) * r2,
    kind: "dungeon",
    accent: "#4a3055",
    radius: 5,
    dungeonSeed: dSeed2,
    dungeonIndex: 1,
  });
  return list;
}

export { mulberry32, parseSeed, hashString, childSeed };
