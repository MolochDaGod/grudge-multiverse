/**
 * Island-Crusade realm life on Bermuda — settlements, NPCs, raiders, animals.
 *
 * Does NOT replace Bermuda GLB. Overlays Crusade game systems (MMO flow):
 * hub + faction towns + farms + camps + AI + wildlife.
 *
 * Source ingest: Documents/Island-Crusade-Realm-2 combat-sandbox.
 */
import * as THREE from "three";
import { createRealmLayout, factionAt, NEUTRAL_THEME } from "./realmZones.js";
import { buildSettlements } from "./realmSettlements.js";
import { buildAllTownNpcs, buildCampRaiders } from "./realmNpcs.js";
import { WILD_ANIMALS, FARM_ANIMALS } from "./realmAnimals.js";
import {
  createBrain,
  stepBrain,
  CAMP_AI,
  GUARD_AI,
  ANIMAL_AI,
  WOLF_AI,
} from "./realmAi.js";
import { mulberry32, childSeed } from "./realmSeed.js";

/**
 * Snap XZ to land using nav/groundAt; return {x,y,z} or null if water.
 */
function snapLand(x, z, island, groundAt) {
  let sx = x;
  let sz = z;
  if (island?.nav?.snap) {
    const sn = island.nav.snap(x, z);
    sx = sn.x;
    sz = sn.z;
  }
  if (island?.nav?.isWaterWorld?.(sx, sz)) {
    // pull toward origin
    for (let i = 0; i < 8; i++) {
      sx *= 0.85;
      sz *= 0.85;
      if (!island.nav.isWaterWorld(sx, sz)) break;
    }
  }
  const gy = groundAt?.(sx, sz);
  if (!Number.isFinite(gy)) return null;
  return { x: sx, y: gy, z: sz };
}

function makeMarker(color, height = 2.2, radius = 0.45) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, height * 0.55, 4, 8),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.75,
      metalness: 0.05,
    }),
  );
  body.position.y = height * 0.5;
  body.castShadow = true;
  g.add(body);
  return g;
}

function makeFlag(color, label) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 4.2, 6),
    new THREE.MeshStandardMaterial({ color: 0x333333 }),
  );
  pole.position.y = 2.1;
  g.add(pole);
  const flag = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.9, 0.05),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.15 }),
  );
  flag.position.set(0.85, 3.6, 0);
  g.add(flag);
  g.userData.label = label;
  return g;
}

function makeAnimalMesh(def) {
  const h = def.height || 1;
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(h * 0.22, h * 0.55, 4, 8),
    new THREE.MeshStandardMaterial({ color: def.color || 0x888888, roughness: 0.85 }),
  );
  body.position.y = h * 0.45;
  body.rotation.z = Math.PI / 2;
  body.scale.set(1.4, 1, 0.7);
  g.add(body);
  g.userData.species = def.species;
  return g;
}

/**
 * @param {THREE.Scene} scene
 * @param {object} island - loadBermudaIsland result
 * @param {(x:number,z:number)=>number|null} groundAt
 */
export function mountRealmLife(scene, island, groundAt) {
  const landR = island.landRadius || island.halfW * 0.85 || 300;
  const layout = createRealmLayout(landR, (island.hubRadius || landR * 0.18) / landR);
  const settlements = buildSettlements(layout);

  // Land-snap all settlements
  for (const s of settlements.all) {
    const p = snapLand(s.x, s.z, island, groundAt);
    if (p) {
      s.x = p.x;
      s.z = p.z;
      s.y = p.y;
    } else {
      s.y = 0;
    }
  }

  const root = new THREE.Group();
  root.name = "realm_life";
  scene.add(root);

  /** @type {object[]} */
  const actors = [];
  /** @type {object[]} */
  const interactables = [];

  // Settlement flags + plaza discs
  for (const s of settlements.all) {
    const col = new THREE.Color(s.accent || "#888");
    const flag = makeFlag(col.getHex(), s.name);
    flag.position.set(s.x, s.y || 0, s.z);
    root.add(flag);

    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(s.radius * 0.35, 24),
      new THREE.MeshStandardMaterial({
        color: col.getHex(),
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(s.x, (s.y || 0) + 0.05, s.z);
    root.add(disc);

    interactables.push({
      kind: "settlement",
      id: s.id,
      label: s.name,
      x: s.x,
      z: s.z,
      y: s.y,
      radius: 4.5,
      settlement: s,
    });
  }

  // NPCs (vendors / guards / captains)
  const npcs = buildAllTownNpcs(settlements.towns);
  for (const n of npcs) {
    const p = snapLand(n.x, n.z, island, groundAt);
    if (!p) continue;
    n.x = p.x;
    n.z = p.z;
    n.y = p.y;
    const mesh = makeMarker(new THREE.Color(n.accent || 0x88aacc).getHex(), 1.85, 0.32);
    mesh.position.set(n.x, n.y, n.z);
    mesh.rotation.y = n.rotationY || 0;
    mesh.userData.npc = n;
    root.add(mesh);

    const brain =
      n.role === "guard"
        ? createBrain(n.x, n.z)
        : null;

    actors.push({
      type: "npc",
      def: n,
      mesh,
      brain,
      homeX: n.x,
      homeZ: n.z,
      hp: n.role === "guard" ? 140 : 9999,
      maxHp: n.role === "guard" ? 140 : 9999,
      alive: true,
      params: n.role === "guard" ? GUARD_AI : null,
    });

    if (n.role === "vendor") {
      interactables.push({
        kind: "vendor",
        id: n.id,
        label: n.label,
        vendorKey: n.vendorKey,
        x: n.x,
        z: n.z,
        y: n.y,
        radius: 2.8,
        npc: n,
      });
    } else if (n.role === "captain") {
      interactables.push({
        kind: "captain",
        id: n.id,
        label: n.label,
        x: n.x,
        z: n.z,
        y: n.y,
        radius: 3.2,
        npc: n,
        mission: {
          title: `Secure ${n.faction === "neutral" ? "the roads" : n.faction + " lands"}`,
          blurb: "Clear a raider camp, return to the Captain.",
          targetCamp: settlements.camps.find((c) => c.faction === n.faction || n.faction === "neutral")
            ?.id,
        },
      });
    }
  }

  // Camp raiders (hostile AI)
  const raiders = buildCampRaiders(settlements.camps);
  for (const r of raiders) {
    const p = snapLand(r.x, r.z, island, groundAt);
    if (!p) continue;
    r.x = p.x;
    r.z = p.z;
    r.y = p.y;
    const mesh = makeMarker(0x8b2020, 1.9, 0.34);
    mesh.position.set(r.x, r.y, r.z);
    root.add(mesh);
    actors.push({
      type: "raider",
      def: r,
      mesh,
      brain: createBrain(r.x, r.z),
      homeX: r.x,
      homeZ: r.z,
      hp: r.hp,
      maxHp: r.maxHp,
      dmg: r.dmg,
      alive: true,
      params: CAMP_AI,
      hostile: true,
    });
  }

  // Wildlife scatter
  const rng = mulberry32(childSeed("animals"));
  for (const def of WILD_ANIMALS) {
    const count = def.species === "Wolf" ? 6 : 5;
    for (let i = 0; i < count; i++) {
      const ang = rng() * Math.PI * 2;
      const rr = layout.hubRadius * 1.4 + rng() * (layout.landRadius * 0.55);
      const p = snapLand(Math.cos(ang) * rr, Math.sin(ang) * rr, island, groundAt);
      if (!p) continue;
      const mesh = makeAnimalMesh(def);
      mesh.position.set(p.x, p.y, p.z);
      root.add(mesh);
      actors.push({
        type: "animal",
        def,
        mesh,
        brain: createBrain(p.x, p.z),
        homeX: p.x,
        homeZ: p.z,
        hp: def.maxHp,
        maxHp: def.maxHp,
        dmg: def.hostile ? 8 : 0,
        alive: true,
        params: def.hostile ? WOLF_AI : { ...ANIMAL_AI, aggroRange: 0 },
        hostile: !!def.hostile,
        loot: def.loot,
      });
    }
  }

  // Farm animals near farms
  for (const farm of settlements.farms) {
    for (let i = 0; i < 3; i++) {
      const def = FARM_ANIMALS[i % FARM_ANIMALS.length];
      const a = rng() * Math.PI * 2;
      const p = snapLand(
        farm.x + Math.cos(a) * (4 + rng() * 6),
        farm.z + Math.sin(a) * (4 + rng() * 6),
        island,
        groundAt,
      );
      if (!p) continue;
      const mesh = makeAnimalMesh(def);
      mesh.position.set(p.x, p.y, p.z);
      root.add(mesh);
      actors.push({
        type: "animal",
        def,
        mesh,
        brain: createBrain(p.x, p.z),
        homeX: p.x,
        homeZ: p.z,
        hp: def.maxHp,
        maxHp: def.maxHp,
        dmg: 0,
        alive: true,
        params: { ...ANIMAL_AI, wanderRadius: 6, speed: 1.4 },
        hostile: false,
        loot: def.loot,
      });
    }
  }

  const state = {
    root,
    layout,
    settlements,
    actors,
    interactables,
    zone: NEUTRAL_THEME,
    mission: null,
    stats: {
      npcs: npcs.length,
      raiders: raiders.length,
      animals: actors.filter((a) => a.type === "animal").length,
      settlements: settlements.all.length,
    },
  };

  console.info(
    `[realmLife] Crusade overlay on Bermuda · settlements=${state.stats.settlements} npcs=${state.stats.npcs} raiders=${state.stats.raiders} animals=${state.stats.animals} landR=${landR.toFixed(0)}`,
  );

  return state;
}

/**
 * Per-frame update: AI, zone, optional combat hooks.
 * @returns {{ zone: object, attacks: {actor, dmg}[], near: object|null }}
 */
export function updateRealmLife(realm, dt, playerPos, opts = {}) {
  if (!realm || !playerPos) return { zone: NEUTRAL_THEME, attacks: [], near: null };
  const now = performance.now();
  const attacks = [];
  realm.zone = factionAt(playerPos.x, playerPos.z, realm.layout);

  for (const a of realm.actors) {
    if (!a.alive || !a.mesh) continue;
    if (!a.brain || !a.params) continue;

    // Passive animals with aggro 0 still patrol
    const step = stepBrain(
      a.brain,
      a.params,
      a.mesh.position.x,
      a.mesh.position.z,
      a.homeX,
      a.homeZ,
      playerPos.x,
      playerPos.z,
      now,
      a.alive,
    );

    if (step.moving) {
      a.mesh.position.x += step.vx * dt;
      a.mesh.position.z += step.vz * dt;
      const gy = opts.groundAt?.(a.mesh.position.x, a.mesh.position.z);
      if (Number.isFinite(gy)) a.mesh.position.y = gy;
    }
    if (step.faceAngle != null) a.mesh.rotation.y = step.faceAngle;

    if (
      a.hostile &&
      step.state === "attack" &&
      a.dmg > 0 &&
      (!a._nextHit || now >= a._nextHit)
    ) {
      const d = Math.hypot(
        playerPos.x - a.mesh.position.x,
        playerPos.z - a.mesh.position.z,
      );
      if (d <= (a.params.attackRange || 2.2) + 0.3) {
        attacks.push({ actor: a, dmg: a.dmg * (realm.zone.aggression || 1) });
        a._nextHit = now + 1100;
      }
    }
  }

  // Nearest interactable
  let near = null;
  let best = 1e9;
  for (const it of realm.interactables) {
    const d = Math.hypot(playerPos.x - it.x, playerPos.z - it.z);
    if (d < it.radius && d < best) {
      best = d;
      near = it;
    }
  }
  realm.near = near;
  return { zone: realm.zone, attacks, near };
}

/** Damage hostile actor (raider/animal). Returns loot item or null. */
export function damageRealmActor(realm, actor, dmg) {
  if (!actor?.alive) return null;
  actor.hp -= dmg;
  if (actor.hp > 0) return null;
  actor.alive = false;
  actor.mesh.visible = false;
  return actor.loot || null;
}

/** Find nearest hostile within range for player skills. */
export function pickNearestHostile(realm, pos, range = 8) {
  let best = null;
  let bd = range;
  for (const a of realm.actors) {
    if (!a.alive || !a.hostile) continue;
    const d = Math.hypot(pos.x - a.mesh.position.x, pos.z - a.mesh.position.z);
    if (d < bd) {
      bd = d;
      best = a;
    }
  }
  return best;
}


