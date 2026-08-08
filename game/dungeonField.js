/**
 * Mount a seeded Kenney modular dungeon into the Multiverse scene.
 *
 * Flow: entrance gate → halls → room openings → enemies → boss chamber.
 * Uses dungeonSeedGen (layout) + modularDungeonKit (meshes).
 */
import * as THREE from "three";
import {
  generateDungeon,
  normalizeDungeonSeed,
  DUNGEON_GEN_VERSION,
  DUNGEON_TILE_M,
} from "./dungeonSeedGen.js";
import {
  loadDungeonCatalog,
  createDungeonModule,
  dungeonIconUrl,
} from "./modularDungeonKit.js";
import { COLLIDER_LAYER } from "./mapLiteracy.js";

/**
 * @param {THREE.Scene|THREE.Object3D} scene
 * @param {string} seedLabel
 * @param {{
 *   origin?: {x:number,y:number,z:number},
 *   groundAt?: (x:number,z:number)=>number|null,
 *   spineLen?: number,
 *   sideRooms?: number,
 *   enemyDensity?: number,
 *   worldSeed?: string,
 *   island?: object,
 * }} [opts]
 */
export async function mountDungeonField(scene, seedLabel, opts = {}) {
  await loadDungeonCatalog();
  const seed = normalizeDungeonSeed(seedLabel);
  let origin = opts.origin || { x: 0, y: 0, z: 0 };
  if (opts.groundAt && Number.isFinite(origin.x) && Number.isFinite(origin.z)) {
    try {
      const gy = opts.groundAt(origin.x, origin.z);
      if (Number.isFinite(gy)) origin = { ...origin, y: gy };
    } catch {
      /* */
    }
  }

  const doc = generateDungeon(seed, {
    origin,
    spineLen: opts.spineLen,
    sideRooms: opts.sideRooms,
    enemyDensity: opts.enemyDensity,
    worldSeed: opts.worldSeed,
    tileM: opts.tileM || DUNGEON_TILE_M,
  });

  const root = new THREE.Group();
  root.name = `dungeon_${doc.seed}`;
  root.userData.dungeonSeed = doc.seed;
  root.userData.kit = "kenney-modular-dungeon";
  root.userData.gen = DUNGEON_GEN_VERSION;
  scene.add(root);

  /** @type {object[]} */
  const actors = [];
  /** @type {object[]} */
  const interactables = [];

  // Modules
  const batch = 6;
  for (let i = 0; i < doc.modules.length; i += batch) {
    const slice = doc.modules.slice(i, i + batch);
    await Promise.all(
      slice.map(async (mod) => {
        const inst = await createDungeonModule(mod.piece, {
          yaw: mod.yaw || 0,
          tileM: doc.tileM,
          fallbackBox: true,
        });
        inst.position.set(mod.x, mod.y || origin.y || 0, mod.z);
        inst.userData.module = mod;
        inst.userData.colliderLayer = COLLIDER_LAYER.SOLID;
        root.add(inst);
        try {
          opts.island?.worldPhysics?.addStaticBox?.(
            mod.x,
            (mod.y || 0) + 1.5,
            mod.z,
            doc.tileM * 0.45,
            1.5,
            doc.tileM * 0.45,
          );
        } catch {
          /* */
        }
      }),
    );
  }

  // Openings / gates (extra decoration on module)
  for (const op of doc.openings || []) {
    const inst = await createDungeonModule(op.piece, {
      yaw: op.yaw || 0,
      tileM: doc.tileM * 0.55,
      heightM: 2.8,
      fallbackBox: true,
    });
    // Scale gates smaller so they sit in openings
    inst.scale.multiplyScalar(0.55);
    inst.position.set(op.x, op.y ?? origin.y ?? 0, op.z);
    inst.userData.opening = op;
    root.add(inst);
  }

  // Enemies
  for (const e of doc.enemies || []) {
    const mesh = makeDungeonEnemyMesh(e, false);
    mesh.position.set(e.x, e.y || origin.y || 0, e.z);
    root.add(mesh);
    actors.push({
      id: e.id,
      type: e.type,
      hostile: true,
      alive: true,
      hp: e.hp,
      maxHp: e.maxHp || e.hp,
      dmg: e.dmg || 10,
      mesh,
      homeX: e.x,
      homeZ: e.z,
      def: {
        label: e.label,
        roomId: e.roomId,
        dungeon: true,
      },
      dungeon: true,
      brain: null,
      params: {
        aggroRange: 12,
        attackRange: 2.2,
        speed: 2.4,
      },
    });
  }

  // Boss
  if (doc.boss) {
    const b = doc.boss;
    const mesh = makeDungeonEnemyMesh(b, true);
    mesh.position.set(b.x, b.y || origin.y || 0, b.z);
    root.add(mesh);
    actors.push({
      id: b.id,
      type: "dungeon_boss",
      hostile: true,
      alive: true,
      hp: b.hp,
      maxHp: b.maxHp || b.hp,
      dmg: b.dmg || 28,
      mesh,
      homeX: b.x,
      homeZ: b.z,
      def: {
        label: b.label,
        roomId: b.roomId,
        dungeon: true,
        boss: true,
      },
      dungeon: true,
      boss: true,
      brain: null,
      params: {
        aggroRange: 18,
        attackRange: 3.2,
        speed: 2.0,
      },
    });
    interactables.push({
      kind: "dungeon_boss",
      id: b.id,
      label: b.label,
      x: b.x,
      z: b.z,
      y: b.y,
      radius: 4,
      boss: b,
    });
  }

  // Exit / entrance interact
  interactables.push({
    kind: "dungeon_exit",
    id: `${doc.seed}-exit`,
    label: "Dungeon Exit",
    x: doc.entrance.x,
    z: doc.entrance.z,
    y: doc.entrance.y,
    radius: 3.5,
    dungeonSeed: doc.seed,
  });

  console.info(
    `[dungeonField] ${doc.summary} modules=${doc.counts.modules}`,
  );

  return {
    root,
    doc,
    actors,
    interactables,
    seed: doc.seed,
    dispose() {
      scene.remove(root);
      root.traverse((o) => {
        if (o.geometry) o.geometry.dispose?.();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) m.dispose?.();
        }
      });
    },
  };
}

function makeDungeonEnemyMesh(def, isBoss) {
  const g = new THREE.Group();
  g.name = isBoss ? `dungeon_boss_${def.id}` : `dungeon_enemy_${def.id}`;
  const h = def.height || (isBoss ? 2.6 : 1.8);
  const color = isBoss ? 0x8b2060 : 0x5a4068;
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(isBoss ? 0.55 : 0.32, h * 0.5, 4, 8),
    new THREE.MeshToonMaterial({ color }),
  );
  body.position.y = h * 0.5;
  body.castShadow = true;
  g.add(body);
  if (isBoss) {
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(0.35, 0.5, 5),
      new THREE.MeshToonMaterial({ color: 0xc9a227 }),
    );
    crown.position.y = h + 0.15;
    g.add(crown);
  }
  return g;
}

/**
 * Mount all dungeon POIs from a world document (seeded).
 */
export async function mountWorldDungeons(scene, world, groundAt, opts = {}) {
  const pois = (world?.pois || []).filter((p) => p.kind === "dungeon");
  const fields = [];
  for (const p of pois) {
    const seed = p.dungeonSeed || p.id;
    try {
      const field = await mountDungeonField(scene, seed, {
        origin: { x: p.x, y: p.y || 0, z: p.z },
        groundAt,
        worldSeed: world?.seed,
        island: opts.island,
        spineLen: p.dungeonIndex === 0 ? 7 : 10,
        sideRooms: p.dungeonIndex === 0 ? 3 : 5,
      });
      fields.push({ poi: p, field });
      // Mark POI interact → already on realm; attach dungeon ref
      p._dungeonField = field;
    } catch (e) {
      console.warn("[dungeonField] poi mount", p.id, e?.message || e);
    }
  }
  console.info(
    `[dungeonField] world dungeons=${fields.length} gen=${DUNGEON_GEN_VERSION}`,
  );
  return fields;
}

export { dungeonIconUrl };
