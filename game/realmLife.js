/**
 * Multiverse realm life — mounts a generated WorldDocument on Bermuda.
 *
 * Pattern:
 *   1. Resolve seed (URL / room welcome / default)
 *   2. generateWorld(seed, { landRadius })  — same as Railway /api/world
 *   3. Snap placements to island.nav / groundAt
 *   4. Spawn markers + AI actors
 *
 * Generator SSOT: shared/worldSeedGen.mjs (isomorphic with server).
 */
import * as THREE from "three";
import {
  generateWorld,
  factionAtWorld,
  FACTION_THEMES,
  resolveSeedFromContext,
  DEFAULT_WORLD_SEED,
  WORLD_SIZE_M,
  DEFAULT_LAND_RADIUS_M,
} from "./worldSeedGen.js";
import {
  createBrain,
  stepBrain,
  CAMP_AI,
  GUARD_AI,
  ANIMAL_AI,
  WOLF_AI,
} from "./realmAi.js";
import { createActorLod } from "./worldLod.js";
import { addSettlementFooting, seedGroundAt } from "./worldSpace.js";

/**
 * Snap seed XZ onto land nav or footing on 5 km ocean pads.
 * Never shrinks 5 km coords onto Bermuda — full SI placement.
 */
function snapLand(x, z, island, groundAt, _footingBag) {
  let sx = x;
  let sz = z;
  const meshR = island?.meshLandRadius || 0;
  const onMesh = meshR > 0 && Math.hypot(x, z) <= meshR * 1.05;

  if (onMesh && island?.nav?.snap) {
    const sn = island.nav.snap(x, z);
    sx = sn.x;
    sz = sn.z;
    if (island?.nav?.isWaterWorld?.(sx, sz)) {
      for (let i = 0; i < 6; i++) {
        sx *= 0.9;
        sz *= 0.9;
        if (!island.nav.isWaterWorld(sx, sz)) break;
      }
    }
  }

  let gy = seedGroundAt(island, sx, sz);
  if (groundAt && onMesh) {
    try {
      const g = groundAt(sx, sz);
      if (Number.isFinite(g) && g > (island.waterY || 0) + 0.3) gy = g;
    } catch {
      /* */
    }
  }

  const needFooting =
    !onMesh ||
    (island?.nav?.isWaterWorld?.(sx, sz) && Math.hypot(x, z) > meshR * 0.95);
  if (needFooting) {
    gy = (island.waterY || 0) + 1.2;
  }

  if (!Number.isFinite(gy)) return null;
  return { x: sx, y: gy, z: sz, footing: needFooting };
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

function makeFlag(color) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 4.2, 6),
    new THREE.MeshStandardMaterial({ color: 0x333333 }),
  );
  pole.position.y = 2.1;
  g.add(pole);
  const flag = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.9, 0.05),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.15,
    }),
  );
  flag.position.set(0.85, 3.6, 0);
  g.add(flag);
  return g;
}

function makeAnimalMesh(def) {
  const h = def.height || 1;
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: def.color || 0x888888,
    roughness: 0.85,
  });
  // Species silhouettes (SI stand-ins until animal GLBs on CDN)
  const species = String(def.species || "").toLowerCase();
  if (species.includes("deer") || species.includes("stag")) {
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(h * 0.18, h * 0.5, 4, 6),
      mat,
    );
    body.position.y = h * 0.42;
    body.rotation.z = Math.PI / 2;
    body.scale.set(1.5, 1, 0.65);
    g.add(body);
    if (species.includes("stag")) {
      const ant = new THREE.Mesh(
        new THREE.ConeGeometry(h * 0.06, h * 0.35, 4),
        mat,
      );
      ant.position.set(h * 0.25, h * 0.75, 0);
      ant.rotation.z = -0.4;
      g.add(ant);
      const ant2 = ant.clone();
      ant2.position.z = 0.12;
      ant2.rotation.z = 0.4;
      g.add(ant2);
    }
  } else if (species.includes("wolf") || species.includes("fox")) {
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(h * 0.2, h * 0.45, 4, 6),
      mat,
    );
    body.position.y = h * 0.35;
    body.rotation.z = Math.PI / 2;
    body.scale.set(1.6, 1, 0.7);
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(h * 0.14, 6, 6), mat);
    head.position.set(h * 0.35, h * 0.42, 0);
    g.add(head);
  } else if (species.includes("cow") || species.includes("bull")) {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(h * 1.1, h * 0.55, h * 0.45),
      mat,
    );
    body.position.y = h * 0.4;
    g.add(body);
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(h * 0.28, h * 0.28, h * 0.22),
      mat,
    );
    head.position.set(h * 0.55, h * 0.5, 0);
    g.add(head);
  } else {
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(h * 0.22, h * 0.55, 4, 8),
      mat,
    );
    body.position.y = h * 0.45;
    body.rotation.z = Math.PI / 2;
    body.scale.set(1.4, 1, 0.7);
    g.add(body);
  }
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return g;
}

function makePoiMesh(kind, color) {
  const g = new THREE.Group();
  if (kind === "info") {
    const ob = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 3.2, 0.8),
      new THREE.MeshStandardMaterial({
        color: color || 0xd4a84b,
        emissive: 0xd4a84b,
        emissiveIntensity: 0.2,
      }),
    );
    ob.position.y = 1.6;
    g.add(ob);
  } else if (kind === "tower") {
    const t = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1.2, 5, 8),
      new THREE.MeshStandardMaterial({ color: color || 0x666666 }),
    );
    t.position.y = 2.5;
    g.add(t);
  } else if (kind === "mine") {
    const t = new THREE.Mesh(
      new THREE.ConeGeometry(1.4, 1.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x444455 }),
    );
    t.position.y = 0.6;
    g.add(t);
  } else {
    const t = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.7, 1.8, 6),
      new THREE.MeshStandardMaterial({ color: color || 0x888888 }),
    );
    t.position.y = 0.9;
    g.add(t);
  }
  return g;
}

/**
 * Resolve seed for this session (URL → welcome → room → default).
 */
export function resolvePlaySeed(opts = {}) {
  if (typeof window !== "undefined") {
    return resolveSeedFromContext({
      search: window.location?.search,
      hash: window.location?.hash,
      roomCode: opts.roomCode || (window.location?.hash || "").replace(/^#/, ""),
      explicit: opts.explicit || window.__mvWorldSeed || null,
    });
  }
  return opts.explicit || DEFAULT_WORLD_SEED;
}

/**
 * @param {THREE.Scene} scene
 * @param {object} island
 * @param {(x:number,z:number)=>number|null} groundAt
 * @param {{ seed?: string, world?: object, density?: number }} [opts]
 */
export function mountRealmLife(scene, island, groundAt, opts = {}) {
  // Always generate in 5 km seed space (island.worldRadiusM after expandIslandToSeedWorld)
  const landR =
    island.worldRadiusM ||
    island.landRadius ||
    opts.landRadius ||
    DEFAULT_LAND_RADIUS_M;
  const seed = opts.seed || resolvePlaySeed({ roomCode: opts.roomCode });
  const world =
    opts.world && opts.world.seed === seed && (opts.world.worldSizeM || 0) >= 4000
      ? opts.world
      : generateWorld(seed, {
          landRadius: landR,
          density: opts.density || 1.15,
          worldSize: opts.worldSizeM || island.worldSizeM || WORLD_SIZE_M,
        });

  const footingBag = new Map();
  const footingRoot = new THREE.Group();
  footingRoot.name = "seed_footing";
  scene.add(footingRoot);

  // Land-snap all world entities (full 5 km coords — no shrink to Bermuda)
  for (const s of world.settlements || []) {
    const p = snapLand(s.x, s.z, island, groundAt, footingBag);
    if (p) {
      s.x = p.x;
      s.z = p.z;
      s.y = p.y;
      if (p.footing) {
        addSettlementFooting(
          footingRoot,
          p.x,
          p.z,
          (s.radius || 20) * 1.2,
          p.y,
          new THREE.Color(s.accent || "#3a4a3a").getHex(),
        );
      }
    } else s.y = 0;
  }
  for (const n of world.npcs || []) {
    const p = snapLand(n.x, n.z, island, groundAt, footingBag);
    if (p) {
      n.x = p.x;
      n.z = p.z;
      n.y = p.y;
    }
  }
  for (const h of world.hostiles || []) {
    const p = snapLand(h.x, h.z, island, groundAt, footingBag);
    if (p) {
      h.x = p.x;
      h.z = p.z;
      h.y = p.y;
    }
  }
  for (const a of world.animals || []) {
    const p = snapLand(a.x, a.z, island, groundAt, footingBag);
    if (p) {
      a.x = p.x;
      a.z = p.z;
      a.y = p.y;
    }
  }
  for (const p0 of world.pois || []) {
    const p = snapLand(p0.x, p0.z, island, groundAt, footingBag);
    if (p) {
      p0.x = p.x;
      p0.z = p.z;
      p0.y = p.y;
      if (p.footing && (p0.kind === "harbor" || p0.kind === "dock")) {
        addSettlementFooting(footingRoot, p.x, p.z, 12, p.y, 0x4a5560);
      }
    }
  }

  const root = new THREE.Group();
  root.name = "realm_life";
  scene.add(root);
  root.add(footingRoot);

  /** @type {object[]} */
  const actors = [];
  /** @type {object[]} */
  const interactables = [];

  for (const s of world.settlements || []) {
    const col = new THREE.Color(s.accent || "#888");
    const flag = makeFlag(col.getHex());
    flag.position.set(s.x, s.y || 0, s.z);
    root.add(flag);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(Math.max(6, (s.radius || 14) * 0.35), 24),
      new THREE.MeshStandardMaterial({
        color: col.getHex(),
        transparent: true,
        opacity: 0.16,
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

  for (const n of world.npcs || []) {
    if (n.x == null) continue;
    const mesh = makeMarker(
      new THREE.Color(n.accent || 0x88aacc).getHex(),
      1.85,
      0.32,
    );
    mesh.position.set(n.x, n.y || 0, n.z);
    mesh.rotation.y = n.rotationY || 0;
    mesh.userData.npc = n;
    root.add(mesh);
    actors.push({
      type: "npc",
      def: n,
      mesh,
      brain: n.role === "guard" ? createBrain(n.x, n.z) : null,
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
        },
      });
    }
  }

  for (const h of world.hostiles || []) {
    if (h.x == null) continue;
    const mesh = makeMarker(0x8b2020, 1.9, 0.34);
    mesh.position.set(h.x, h.y || 0, h.z);
    root.add(mesh);
    actors.push({
      type: "raider",
      def: h,
      mesh,
      brain: createBrain(h.x, h.z),
      homeX: h.x,
      homeZ: h.z,
      hp: h.hp || 90,
      maxHp: h.hp || 90,
      dmg: h.dmg || 12,
      alive: true,
      params: CAMP_AI,
      hostile: true,
    });
  }

  for (const a of world.animals || []) {
    if (a.x == null) continue;
    const mesh = makeAnimalMesh(a);
    mesh.position.set(a.x, a.y || 0, a.z);
    root.add(mesh);
    actors.push({
      type: "animal",
      def: a,
      mesh,
      brain: createBrain(a.x, a.z),
      homeX: a.x,
      homeZ: a.z,
      hp: a.maxHp || 60,
      maxHp: a.maxHp || 60,
      dmg: a.hostile ? 8 : 0,
      alive: true,
      params: a.hostile ? WOLF_AI : { ...ANIMAL_AI, aggroRange: 0 },
      hostile: !!a.hostile,
      loot: a.loot,
    });
  }

  for (const p0 of world.pois || []) {
    if (p0.x == null) continue;
    const col = new THREE.Color(p0.accent || "#888").getHex();
    const mesh = makePoiMesh(p0.kind, col);
    mesh.position.set(p0.x, p0.y || 0, p0.z);
    root.add(mesh);
    interactables.push({
      kind: p0.kind === "info" ? "info" : "poi",
      id: p0.id,
      label: p0.name,
      x: p0.x,
      z: p0.z,
      y: p0.y,
      radius: p0.radius || 3.5,
      url: p0.url,
      poi: p0,
    });
  }

  const actorLod = createActorLod(actors);

  const state = {
    root,
    world,
    seed: world.seed,
    layout: {
      landRadius: world.landRadius,
      hubRadius: world.hubRadius,
      towns: (world.factions || []).map((f) => ({
        faction: f.faction,
        angle: f.angle,
        x: Math.cos(f.angle) * world.landRadius * 0.5,
        z: Math.sin(f.angle) * world.landRadius * 0.5,
      })),
    },
    settlements: {
      all: world.settlements,
      towns: world.settlements.filter((s) => s.kind === "town"),
      farms: world.settlements.filter((s) => s.kind === "farm"),
      camps: world.settlements.filter((s) => s.kind === "camp"),
    },
    actors,
    interactables,
    actorLod,
    zone: FACTION_THEMES.neutral,
    mission: null,
    stats: {
      ...world.counts,
      npcs: world.counts?.npcs ?? actors.filter((a) => a.type === "npc").length,
      raiders: world.counts?.hostiles ?? actors.filter((a) => a.type === "raider").length,
      animals: world.counts?.animals ?? actors.filter((a) => a.type === "animal").length,
      settlements: world.counts?.settlements ?? world.settlements.length,
      harbors: world.counts?.harbors ?? (world.harbors || []).length,
    },
  };

  console.info(
    `[realmLife] seed=${world.seed} ${world.summary} landR=${landR.toFixed(0)} gen=${world.genVersion}`,
  );

  if (typeof window !== "undefined") {
    window.__mvWorldSeed = world.seed;
    window.__mvWorld = world;
  }

  return state;
}

export function updateRealmLife(realm, dt, playerPos, opts = {}) {
  if (!realm || !playerPos) {
    return { zone: FACTION_THEMES.neutral, attacks: [], near: null };
  }
  const now = performance.now();
  const attacks = [];
  realm.zone = factionAtWorld(playerPos.x, playerPos.z, realm.world);

  const runAi = (a, doStep) => {
    if (!doStep || !a.alive || !a.mesh || !a.brain || !a.params) return;
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
        attacks.push({
          actor: a,
          dmg: a.dmg * (realm.zone.aggression || 1),
        });
        a._nextHit = now + 1100;
      }
    }
  };

  // Large-scale LOD: cull far actors, throttle mid-range AI
  if (realm.actorLod) {
    realm.actorLod.update(playerPos, runAi);
  } else {
    for (const a of realm.actors) runAi(a, true);
  }

  let near = null;
  let best = 1e9;
  for (const it of realm.interactables) {
    const d = Math.hypot(playerPos.x - it.x, playerPos.z - it.z);
    if (d < it.radius && d < best) {
      best = d;
      near = it;
    }
  }
  // Merge boat docks if provided
  if (opts.boatInteract) {
    for (const it of opts.boatInteract) {
      const d = Math.hypot(playerPos.x - it.x, playerPos.z - it.z);
      if (d < it.radius && d < best) {
        best = d;
        near = it;
      }
    }
  }
  realm.near = near;
  return { zone: realm.zone, attacks, near };
}

export function damageRealmActor(realm, actor, dmg) {
  if (!actor?.alive) return null;
  actor.hp -= dmg;
  if (actor.hp > 0) return null;
  actor.alive = false;
  actor.mesh.visible = false;
  return actor.loot || null;
}

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

export { generateWorld, resolveSeedFromContext, DEFAULT_WORLD_SEED };
