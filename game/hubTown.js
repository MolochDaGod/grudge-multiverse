/**
 * Neutral starting town — Islands medieval village pack (Sketchfab GLB).
 *
 * Source: Islands_medieval_village_strategies_pack.glb
 * Prod: public/models/towns/medieval-village.prod.glb
 * CDN fallback when uploaded: assets.grudge-studio.com/models/towns/…
 *
 * Systems (extend existing SSOT — no parallel engines):
 *  - Visual mesh (Three.js GLTF)
 *  - Ground: sampleY + Rapier heightfield (worldPhysics)
 *  - Building shells: AABB cuboids on Rapier + BVH merge for feet
 *  - Pathfinding: three-pathfinding zone from ground mesh
 *  - NPCs: vendors, faction neutrals, class specialists, craft specialists
 *
 * SI: pack bbox ~±48 m → already ~96 m village. Human 1.8 m yardstick.
 * Fail-closed: if load fails, return null (hub keeps seed footing).
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import {
  MeshBVH,
  StaticGeometryGenerator,
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
} from "three-mesh-bvh";
import { Pathfinding } from "three-pathfinding";
import { createBrain } from "./realmAi.js";
import { COLLIDER_LAYER } from "./mapLiteracy.js";

// Patch once
if (!THREE.BufferGeometry.prototype.computeBoundsTree) {
  THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
  THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
  THREE.Mesh.prototype.raycast = acceleratedRaycast;
}

const BASE =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) ||
  "/";
const CDN = "https://assets.grudge-studio.com";

export const HUB_TOWN_GEN = "2026-08-08.1-medieval-village-hub";
export const HUB_TOWN_ZONE = "hub_town";

export const HUB_TOWN_URLS = [
  `${BASE}models/towns/medieval-village.prod.glb`,
  `${BASE}models/towns/medieval-village.glb`,
  `${CDN}/models/towns/medieval-village.prod.glb`,
  // Local author pack path is NOT used in browser — bake to public/ first
];

/** Material / name tags → role for colliders + POI placement. */
export const MESH_ROLE = {
  ground: "ground",
  home: "building",
  church: "building",
  market: "building",
  gate: "gate",
  fence: "fence",
  material: "prop",
};

/**
 * Neutral friendly roster — seed operates FROM this town.
 * Roles drive interact + simple pathfinding patrol.
 */
export const HUB_NPC_ROSTER = [
  // Vendors (existing shop keys)
  {
    id: "hub-vendor-weapon",
    role: "vendor",
    vendorKey: "weapon",
    label: "Weapon Merchant",
    classId: "warrior",
    slot: "market",
    accent: "#c9a227",
  },
  {
    id: "hub-vendor-armor",
    role: "vendor",
    vendorKey: "armor",
    label: "Armorer",
    classId: "warrior",
    slot: "market",
    accent: "#8a9ab0",
  },
  {
    id: "hub-vendor-general",
    role: "vendor",
    vendorKey: "general",
    label: "Market Warden",
    classId: "ranger",
    slot: "market",
    accent: "#6a9a5a",
  },
  // Faction members (neutral — friendly)
  {
    id: "hub-guard-a",
    role: "guard",
    label: "Town Guard",
    classId: "warrior",
    slot: "gate",
    faction: "neutral",
    accent: "#e8d9a8",
    patrol: true,
  },
  {
    id: "hub-guard-b",
    role: "guard",
    label: "Town Guard",
    classId: "warrior",
    slot: "plaza",
    faction: "neutral",
    accent: "#e8d9a8",
    patrol: true,
  },
  {
    id: "hub-captain",
    role: "captain",
    label: "Seed Captain",
    classId: "warrior",
    slot: "plaza",
    faction: "neutral",
    accent: "#d4a84b",
  },
  // Class specialists (trainers)
  {
    id: "hub-class-warrior",
    role: "class_specialist",
    label: "Arms Master",
    classId: "warrior",
    specialist: "warrior",
    slot: "plaza",
    accent: "#b05040",
  },
  {
    id: "hub-class-ranger",
    role: "class_specialist",
    label: "Huntress",
    classId: "ranger",
    specialist: "ranger",
    slot: "edge",
    accent: "#4a8a50",
  },
  {
    id: "hub-class-mage",
    role: "class_specialist",
    label: "Scribe Magus",
    classId: "mage",
    specialist: "mage",
    slot: "church",
    accent: "#5a6ab0",
  },
  {
    id: "hub-class-worge",
    role: "class_specialist",
    label: "Pack Elder",
    classId: "worge",
    specialist: "worge",
    slot: "edge",
    accent: "#8a5a30",
  },
  // Crafting specialists
  {
    id: "hub-craft-smith",
    role: "craft_specialist",
    label: "Blacksmith",
    craft: "smithing",
    classId: "warrior",
    slot: "market",
    accent: "#a07040",
  },
  {
    id: "hub-craft-alchemy",
    role: "craft_specialist",
    label: "Herbalist",
    craft: "alchemy",
    classId: "mage",
    slot: "home",
    accent: "#60a070",
  },
  {
    id: "hub-craft-cook",
    role: "craft_specialist",
    label: "Cook",
    craft: "cooking",
    classId: "ranger",
    slot: "home",
    accent: "#c08050",
  },
  {
    id: "hub-craft-carpenter",
    role: "craft_specialist",
    label: "Carpenter",
    craft: "woodwork",
    classId: "warrior",
    slot: "edge",
    accent: "#806040",
  },
];

const FRIENDLY_AI = {
  aggroRange: 0,
  attackRange: 0,
  leash: 28,
  speed: 1.35,
  wanderRadius: 10,
};

function getLoader() {
  const loader = new GLTFLoader();
  try {
    const d = new DRACOLoader();
    d.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    loader.setDRACOLoader(d);
  } catch {
    /* */
  }
  return loader;
}

function classifyMesh(mesh) {
  const matName = (
    Array.isArray(mesh.material)
      ? mesh.material[0]?.name
      : mesh.material?.name
  ) || "";
  const objName = mesh.name || mesh.parent?.name || "";
  const s = `${matName} ${objName}`.toLowerCase();
  if (s.includes("ground") || s.includes("terrain") || s.includes("floor")) return "ground";
  if (s.includes("church")) return "building";
  if (s.includes("market")) return "building";
  if (s.includes("home") || s.includes("house") || s.includes("build")) return "building";
  if (s.includes("gate")) return "gate";
  if (s.includes("fence") || s.includes("wall")) return "fence";
  // Lines / tiny helpers → skip
  if (mesh.geometry?.type === "BufferGeometry") {
    const idx = mesh.geometry.index;
    const count = idx ? idx.count / 3 : (mesh.geometry.attributes.position?.count || 0) / 3;
    if (count < 8) return "skip";
  }
  return "prop";
}

function fitVillageToSI(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  // If cm-scale (span > 400), shrink 0.01
  if (size.x > 400 || size.z > 400 || size.y > 200) {
    root.scale.multiplyScalar(0.01);
    root.updateMatrixWorld(true);
    box.setFromObject(root);
    box.getSize(size);
  }
  // Plant feet, center XZ on origin (hub)
  root.position.x -= (box.min.x + box.max.x) * 0.5;
  root.position.z -= (box.min.z + box.max.z) * 0.5;
  root.position.y -= box.min.y;
  root.updateMatrixWorld(true);
  box.setFromObject(root);
  box.getSize(size);
  return { box, size };
}

function prepMaterials(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      if (m.map) {
        m.map.colorSpace = THREE.SRGBColorSpace;
        m.map.flipY = false;
      }
      m.side = THREE.FrontSide;
      m.needsUpdate = true;
    }
  });
}

/**
 * Build three-pathfinding zone from ground meshes (projected walkable).
 */
function buildTownPathfinding(groundMeshes) {
  if (!groundMeshes.length) return null;
  try {
    const gen = new StaticGeometryGenerator(groundMeshes);
    gen.attributes = ["position"];
    const geo = gen.generate();
    // Flatten slight Y noise for pathfinding graph stability
    const pos = geo.attributes.position;
    let minY = Infinity;
    for (let i = 0; i < pos.count; i++) minY = Math.min(minY, pos.getY(i));
    // Keep geometry as-is; Pathfinding.createZone needs faces
    geo.computeVertexNormals();
    const zone = Pathfinding.createZone(geo);
    const pf = new Pathfinding();
    pf.setZoneData(HUB_TOWN_ZONE, zone);
    return { pathfinding: pf, zoneName: HUB_TOWN_ZONE, navGeometry: geo };
  } catch (e) {
    console.warn("[hubTown] pathfinding build failed", e?.message || e);
    return null;
  }
}

/**
 * BVH collider mesh for buildings + ground (player feet / ray).
 */
function buildTownBvhCollider(meshes) {
  if (!meshes.length) return null;
  try {
    const gen = new StaticGeometryGenerator(meshes);
    gen.attributes = ["position"];
    const geo = gen.generate();
    geo.boundsTree = new MeshBVH(geo);
    const collider = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        visible: false,
        wireframe: true,
        transparent: true,
        opacity: 0.15,
      }),
    );
    collider.name = "hub_town_bvh_collider";
    collider.userData.colliderLayer = COLLIDER_LAYER.SOLID;
    return collider;
  } catch (e) {
    console.warn("[hubTown] bvh collider", e?.message || e);
    return null;
  }
}

/**
 * Sample Y on town ground meshes.
 */
function makeSampleY(groundMeshes, fallbackY = 0) {
  const ray = new THREE.Raycaster();
  const origin = new THREE.Vector3();
  const down = new THREE.Vector3(0, -1, 0);
  return (x, z) => {
    origin.set(x, 80, z);
    ray.set(origin, down);
    ray.firstHitOnly = true;
    const hits = ray.intersectObjects(groundMeshes, true);
    if (hits[0]) return hits[0].point.y;
    return fallbackY;
  };
}

/**
 * Place NPC markers at slot positions around town box.
 */
function slotPosition(slot, box, size, i, n) {
  const cx = (box.min.x + box.max.x) * 0.5;
  const cz = (box.min.z + box.max.z) * 0.5;
  const rx = size.x * 0.22;
  const rz = size.z * 0.22;
  switch (slot) {
    case "market":
      return {
        x: cx + (i - n / 2) * 2.4,
        z: cz + 4,
      };
    case "gate":
      return {
        x: cx,
        z: box.max.z - 3 - i * 2,
      };
    case "church":
      return {
        x: cx - rx * 0.6,
        z: cz - rz * 0.4 + i * 1.5,
      };
    case "home":
      return {
        x: cx + rx * 0.55 + (i % 3) * 2.2,
        z: cz + rz * 0.2 + Math.floor(i / 3) * 2.5,
      };
    case "edge":
      return {
        x: cx + Math.cos((i / Math.max(1, n)) * Math.PI * 2) * rx * 1.15,
        z: cz + Math.sin((i / Math.max(1, n)) * Math.PI * 2) * rz * 1.15,
      };
    case "plaza":
    default:
      return {
        x: cx + (i - n / 2) * 2.0,
        z: cz - 2 + (i % 2) * 1.5,
      };
  }
}

function makeNpcMesh(def) {
  const g = new THREE.Group();
  g.name = def.id;
  const h = 1.8;
  const col = new THREE.Color(def.accent || "#ccc");
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.32, h * 0.5, 4, 8),
    new THREE.MeshToonMaterial({ color: col.getHex() }),
  );
  body.position.y = h * 0.5;
  body.castShadow = true;
  g.add(body);
  // Role badge
  const badge = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshBasicMaterial({
      color:
        def.role === "vendor"
          ? 0xf4c542
          : def.role === "craft_specialist"
            ? 0x60c080
            : def.role === "class_specialist"
              ? 0x6080e0
              : 0xe8d9a8,
    }),
  );
  badge.position.y = h + 0.25;
  g.add(badge);
  return g;
}

/**
 * Mount starting town at world hub origin.
 *
 * @param {THREE.Scene} scene
 * @param {object} island
 * @param {{
 *   worldPhysics?: object,
 *   flash?: Function,
 *   origin?: {x:number,y:number,z:number},
 * }} [opts]
 */
export async function mountHubTown(scene, island, opts = {}) {
  const root = new THREE.Group();
  root.name = "hub_town_medieval";
  root.userData.gen = HUB_TOWN_GEN;
  root.userData.friendly = true;
  root.userData.neutral = true;

  const loader = getLoader();
  let gltf = null;
  let loadedUrl = null;
  for (const url of HUB_TOWN_URLS) {
    try {
      gltf = await loader.loadAsync(url);
      loadedUrl = url;
      console.info("[hubTown] loaded", url);
      break;
    } catch (e) {
      console.warn("[hubTown] miss", url, e?.message || e);
    }
  }
  if (!gltf) {
    console.error("[hubTown] all URLs failed — no starting town mesh");
    return null;
  }

  const model = gltf.scene || gltf.scenes?.[0];
  prepMaterials(model);
  root.add(model);

  // Place at hub origin (world seed operates from here)
  const origin = opts.origin || { x: 0, y: 0, z: 0 };
  root.position.set(origin.x, origin.y, origin.z);
  const { box, size } = fitVillageToSI(root);
  // Re-center after plant (fitVillage centers relative to model)
  root.position.x += origin.x;
  root.position.z += origin.z;
  root.updateMatrixWorld(true);
  box.setFromObject(root);
  box.getSize(size);

  /** @type {THREE.Mesh[]} */
  const groundMeshes = [];
  /** @type {THREE.Mesh[]} */
  const solidMeshes = [];
  /** @type {THREE.Mesh[]} */
  const buildingMeshes = [];
  /** @type {{mesh:THREE.Mesh, role:string, box:THREE.Box3}[]} */
  const buildings = [];

  root.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    // Skip line primitives
    if (o.geometry.type === "BufferGeometry" && o.material) {
      const mode = o.geometry.drawRange;
      /* keep */
    }
    const role = classifyMesh(o);
    if (role === "skip") {
      o.visible = false;
      return;
    }
    o.userData.townRole = role;
    if (role === "ground") {
      groundMeshes.push(o);
      o.receiveShadow = true;
      o.castShadow = false;
      o.userData.walkable = true;
      o.userData.colliderLayer = COLLIDER_LAYER.WALKABLE;
    } else {
      solidMeshes.push(o);
      o.userData.colliderLayer = COLLIDER_LAYER.SOLID;
      if (role === "building" || role === "gate" || role === "fence") {
        buildingMeshes.push(o);
        const b = new THREE.Box3().setFromObject(o);
        buildings.push({ mesh: o, role, box: b });
      }
    }
  });

  // If no ground tagged, use largest low mesh as ground
  if (!groundMeshes.length) {
    let best = null;
    let bestArea = 0;
    root.traverse((o) => {
      if (!o.isMesh) return;
      const b = new THREE.Box3().setFromObject(o);
      const s = new THREE.Vector3();
      b.getSize(s);
      const area = s.x * s.z;
      if (s.y < 2.5 && area > bestArea) {
        bestArea = area;
        best = o;
      }
    });
    if (best) {
      groundMeshes.push(best);
      best.userData.townRole = "ground";
    }
  }

  const sampleY = makeSampleY(groundMeshes, box.min.y);
  const plaza = {
    x: (box.min.x + box.max.x) * 0.5,
    z: (box.min.z + box.max.z) * 0.5,
  };
  plaza.y = sampleY(plaza.x, plaza.z);

  // Gate: south edge of town (max Z in pack was north-ish — use max.z as entry face)
  const gate = {
    x: plaza.x,
    z: box.max.z - 2.5,
    y: 0,
  };
  gate.y = sampleY(gate.x, gate.z);

  // Player spawn just inside gate facing plaza
  const spawn = {
    x: gate.x,
    y: gate.y + 1.12,
    z: gate.z - 4,
    yaw: Math.PI, // face into town (toward -Z plaza if gate at max z)
  };
  spawn.y = sampleY(spawn.x, spawn.z) + 1.12;

  // Pathfinding
  const pfPack = buildTownPathfinding(groundMeshes);

  // BVH collider
  const colliderMeshes = [...groundMeshes, ...solidMeshes];
  const bvhCollider = buildTownBvhCollider(colliderMeshes);
  if (bvhCollider) root.add(bvhCollider);

  // Rapier: heightfield ground + building AABBs
  const phys = opts.worldPhysics || island?.worldPhysics;
  if (phys) {
    for (const gm of groundMeshes) {
      try {
        phys.addHeightfieldFromMesh?.(gm, { nrows: 32, ncols: 32 });
      } catch (e) {
        console.warn("[hubTown] rapier HF", e?.message || e);
      }
    }
    for (const b of buildings) {
      const s = new THREE.Vector3();
      b.box.getSize(s);
      const c = new THREE.Vector3();
      b.box.getCenter(c);
      // Only substantial buildings
      if (s.y < 1.2 || s.x * s.z < 4) continue;
      try {
        phys.addStaticBox?.(
          c.x,
          c.y,
          c.z,
          Math.max(0.4, s.x * 0.45),
          Math.max(0.5, s.y * 0.45),
          Math.max(0.4, s.z * 0.45),
        );
      } catch {
        /* */
      }
    }
  }

  // NPCs
  /** @type {object[]} */
  const actors = [];
  /** @type {object[]} */
  const interactables = [];
  const bySlot = {};
  for (const def of HUB_NPC_ROSTER) {
    bySlot[def.slot] = (bySlot[def.slot] || 0) + 1;
  }
  const slotIdx = {};
  for (const def of HUB_NPC_ROSTER) {
    slotIdx[def.slot] = slotIdx[def.slot] || 0;
    const i = slotIdx[def.slot]++;
    const nSlot = bySlot[def.slot] || 1;
    const p = slotPosition(def.slot, box, size, i, nSlot);
    const y = sampleY(p.x, p.z);
    const mesh = makeNpcMesh(def);
    mesh.position.set(p.x, y, p.z);
    // Face plaza
    mesh.rotation.y = Math.atan2(plaza.x - p.x, plaza.z - p.z);
    root.add(mesh);

    const actor = {
      id: def.id,
      type: "npc",
      hostile: false,
      friendly: true,
      alive: true,
      hp: def.role === "guard" ? 160 : 9999,
      maxHp: def.role === "guard" ? 160 : 9999,
      mesh,
      homeX: p.x,
      homeZ: p.z,
      brain: def.patrol ? createBrain(p.x, p.z) : null,
      params: def.patrol ? { ...FRIENDLY_AI, wanderRadius: 14, speed: 1.2 } : null,
      def: {
        ...def,
        raceId: "western-kingdoms",
        faction: "neutral",
        townId: "town-neutral",
        hub: true,
      },
      path: null,
      pathI: 0,
    };
    actors.push(actor);

    // Interact radii
    if (def.role === "vendor") {
      interactables.push({
        kind: "vendor",
        id: def.id,
        label: def.label,
        vendorKey: def.vendorKey,
        x: p.x,
        z: p.z,
        y,
        radius: 2.8,
        npc: def,
      });
    } else if (def.role === "captain") {
      interactables.push({
        kind: "captain",
        id: def.id,
        label: def.label,
        x: p.x,
        z: p.z,
        y,
        radius: 3,
        mission: {
          title: "Leave the seed town — clear a raider camp",
          blurb: "Walk beyond Grudgehold walls, defeat raiders, return for gold.",
        },
      });
    } else if (def.role === "class_specialist") {
      interactables.push({
        kind: "class_specialist",
        id: def.id,
        label: def.label,
        specialist: def.specialist || def.classId,
        x: p.x,
        z: p.z,
        y,
        radius: 2.6,
        npc: def,
      });
    } else if (def.role === "craft_specialist") {
      interactables.push({
        kind: "craft_specialist",
        id: def.id,
        label: def.label,
        craft: def.craft,
        x: p.x,
        z: p.z,
        y,
        radius: 2.6,
        npc: def,
      });
    } else if (def.role === "guard") {
      interactables.push({
        kind: "poi",
        id: def.id,
        label: def.label,
        x: p.x,
        z: p.z,
        y,
        radius: 2.2,
      });
    }
  }

  // Parent under island.root when possible so BVH rebind includes town solids
  if (island?.root?.add) island.root.add(root);
  else scene.add(root);

  // Expose ground sample to island (prefer town Y inside footprint)
  const townRadius = Math.max(size.x, size.z) * 0.55;
  const prevSample = island.sampleY?.bind?.(island);
  island.sampleY = (x, z) => {
    if (Math.hypot(x - plaza.x, z - plaza.z) < townRadius) {
      const ty = sampleY(x, z);
      if (Number.isFinite(ty)) return ty;
    }
    if (prevSample) {
      const y = prevSample(x, z);
      if (Number.isFinite(y)) return y;
    }
    return sampleY(x, z);
  };

  // Register with island for collider rebind
  island.hubTown = {
    root,
    box,
    size,
    plaza,
    gate,
    spawn,
    sampleY,
    bvhCollider,
    pathfinding: pfPack?.pathfinding || null,
    zoneName: HUB_TOWN_ZONE,
    buildings,
    groundMeshes,
    gen: HUB_TOWN_GEN,
    url: loadedUrl,
  };

  console.info(
    `[hubTown] ${HUB_TOWN_GEN} span=${size.x.toFixed(0)}×${size.z.toFixed(0)} m h=${size.y.toFixed(1)} npcs=${actors.length} buildings=${buildings.length} pf=${!!pfPack} url=${loadedUrl}`,
  );

  return {
    root,
    box,
    size,
    plaza,
    gate,
    spawn,
    sampleY,
    actors,
    interactables,
    pathfinding: pfPack?.pathfinding || null,
    zoneName: HUB_TOWN_ZONE,
    bvhCollider,
    buildings,
    gen: HUB_TOWN_GEN,
    /**
     * Follow path or wander for friendly NPCs.
     */
    update(dt, playerPos) {
      if (!playerPos) return;
      const now = performance.now();
      for (const a of actors) {
        if (!a.mesh || !a.brain || !a.params) continue;
        // Simple wander in town (no aggro)
        if (now > (a.brain.nextWanderAt || 0)) {
          const ang = Math.random() * Math.PI * 2;
          const r = Math.random() * (a.params.wanderRadius || 8);
          a.brain.wanderX = a.homeX + Math.cos(ang) * r;
          a.brain.wanderZ = a.homeZ + Math.sin(ang) * r;
          a.brain.nextWanderAt = now + 3000 + Math.random() * 4000;
          // Optional pathfinding path
          if (pfPack?.pathfinding) {
            try {
              const start = a.mesh.position.clone();
              const end = new THREE.Vector3(a.brain.wanderX, start.y, a.brain.wanderZ);
              const groupId = pfPack.pathfinding.getGroup(HUB_TOWN_ZONE, start);
              a.path = pfPack.pathfinding.findPath(start, end, HUB_TOWN_ZONE, groupId);
              a.pathI = 0;
            } catch {
              a.path = null;
            }
          }
        }
        let tx = a.brain.wanderX;
        let tz = a.brain.wanderZ;
        if (a.path && a.path.length) {
          const pt = a.path[Math.min(a.pathI, a.path.length - 1)];
          tx = pt.x;
          tz = pt.z;
          if (Math.hypot(a.mesh.position.x - tx, a.mesh.position.z - tz) < 0.6) {
            a.pathI++;
            if (a.pathI >= a.path.length) a.path = null;
          }
        }
        const dx = tx - a.mesh.position.x;
        const dz = tz - a.mesh.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.25) {
          const sp = (a.params.speed || 1.2) * dt;
          const step = Math.min(sp, dist);
          a.mesh.position.x += (dx / dist) * step;
          a.mesh.position.z += (dz / dist) * step;
          a.mesh.position.y = sampleY(a.mesh.position.x, a.mesh.position.z);
          a.mesh.rotation.y = Math.atan2(dx, dz);
        }
      }
    },
  };
}

/**
 * Find path inside hub town (for AI / tools).
 */
export function hubFindPath(hub, from, to) {
  if (!hub?.pathfinding) return null;
  try {
    const start = from.isVector3 ? from : new THREE.Vector3(from.x, from.y || 0, from.z);
    const end = to.isVector3 ? to : new THREE.Vector3(to.x, to.y || 0, to.z);
    const groupId = hub.pathfinding.getGroup(HUB_TOWN_ZONE, start);
    return hub.pathfinding.findPath(start, end, HUB_TOWN_ZONE, groupId);
  } catch {
    return null;
  }
}
