/**
 * Breakable crates / barrels / jars (Loafbrr · CC0).
 * Source: Brekable_Boxes_FBX_GLTF_Blend_Textures.zip
 *
 * Placed at camps, near enemy NPCs, settlements, dungeon rooms.
 * Harvest (E) or combat hit → break → world loot drops (LootField).
 *
 * Extends HarvestSystem nodes (kind crate|barrel|jar) — no second break pipeline.
 * SI: props ~0.6–1.0 m tall (table / cache scale). Never hero-height.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { T0_DROPS, T1_DROPS } from "./inventory.js";

const BASE =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) ||
  "/";

export const BREAKABLE_GEN = "2026-08-08.1-loafbrr-breakables";

export const BREAKABLE_TYPES = {
  crate: {
    id: "crate",
    name: "Crate",
    intactUrl: `${BASE}models/breakable/crate.glb`,
    brokenUrl: `${BASE}models/breakable/crate_broken.glb`,
    heightM: 0.85,
    hp: 28,
    chunks: 1,
    tool: "any",
    weight: 1.0,
  },
  barrel: {
    id: "barrel",
    name: "Barrel",
    intactUrl: `${BASE}models/breakable/barrel.glb`,
    brokenUrl: `${BASE}models/breakable/barrel_broken.glb`,
    heightM: 0.95,
    hp: 34,
    chunks: 1,
    tool: "any",
    weight: 0.85,
  },
  jar: {
    id: "jar",
    name: "Jar",
    intactUrl: `${BASE}models/breakable/jar.glb`,
    brokenUrl: `${BASE}models/breakable/jar_broken.glb`,
    heightM: 0.55,
    hp: 16,
    chunks: 1,
    tool: "any",
    weight: 0.55,
  },
};

/** Loot tables — mats always; food/gear chance. */
export function rollBreakableLoot(kind, rng = Math.random) {
  const items = [];
  // Mats
  const mat = { ...T0_DROPS[Math.floor(rng() * T0_DROPS.length)] };
  mat.qty = 1 + Math.floor(rng() * 2);
  items.push(mat);

  // Food chance
  if (rng() < 0.35) {
    items.push({
      id: "food_pending",
      name: "Food",
      tier: 0,
      slot: "food",
      qty: 1,
      _rollFood: true,
    });
  }

  // Scrap / gold-ish
  if (rng() < 0.4) {
    items.push({ id: "t0_scrap", name: "Scrap Ore", tier: 0, slot: "mat", qty: 1 });
  }

  // Rare gear
  if (rng() < (kind === "barrel" ? 0.12 : kind === "crate" ? 0.1 : 0.06)) {
    const gear = { ...T1_DROPS[Math.floor(rng() * T1_DROPS.length)], qty: 1 };
    items.push(gear);
  }

  // Jar often food/potion-like
  if (kind === "jar" && rng() < 0.5) {
    items.push({
      id: "food_pending",
      name: "Preserves",
      tier: 0,
      slot: "food",
      qty: 1,
      _rollFood: true,
    });
  }

  return items;
}

let _loader = null;
/** @type {Map<string, THREE.Object3D>} */
const _proto = new Map();

function getLoader() {
  if (_loader) return _loader;
  _loader = new GLTFLoader();
  try {
    const d = new DRACOLoader();
    d.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    _loader.setDRACOLoader(d);
  } catch {
    /* */
  }
  return _loader;
}

function fitHeight(root, heightM) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  let h = size.y || 1;
  if (h > 40) {
    root.scale.multiplyScalar(0.01);
    root.updateMatrixWorld(true);
    box.setFromObject(root);
    box.getSize(size);
    h = size.y || 1;
  }
  if (h > 1e-4) root.scale.multiplyScalar(heightM / h);
  root.updateMatrixWorld(true);
  box.setFromObject(root);
  root.position.y -= box.min.y;
  // center XZ
  root.position.x -= (box.min.x + box.max.x) * 0.5;
  root.position.z -= (box.min.z + box.max.z) * 0.5;
  root.updateMatrixWorld(true);
  return root;
}

function prepMats(root) {
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
      m.needsUpdate = true;
    }
  });
}

async function loadProto(url) {
  if (_proto.has(url)) return _proto.get(url);
  try {
    const gltf = await getLoader().loadAsync(url);
    const root = gltf.scene || gltf.scenes?.[0];
    if (!root) return null;
    prepMats(root);
    _proto.set(url, root);
    return root;
  } catch (e) {
    console.warn("[breakable] load miss", url, e?.message || e);
    return null;
  }
}

/**
 * @returns {Promise<THREE.Group>}
 */
export async function createBreakableMesh(kind, opts = {}) {
  const def = BREAKABLE_TYPES[kind] || BREAKABLE_TYPES.crate;
  const g = new THREE.Group();
  g.name = `breakable_${kind}`;
  g.userData.breakableKind = kind;
  g.userData.worldKind = "prop";

  const proto = await loadProto(def.intactUrl);
  if (proto) {
    const clone = proto.clone(true);
    fitHeight(clone, opts.heightM ?? def.heightM);
    g.add(clone);
  } else {
    // Fail-closed stylized box (not capsule hero)
    const h = def.heightM;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, h, 0.7),
      new THREE.MeshStandardMaterial({
        color: kind === "barrel" ? 0x6b4a2a : kind === "jar" ? 0x6a8a6a : 0x8a6a3a,
        roughness: 0.88,
        flatShading: true,
      }),
    );
    mesh.position.y = h * 0.5;
    mesh.castShadow = true;
    g.add(mesh);
  }
  if (Number.isFinite(opts.yaw)) g.rotation.y = opts.yaw;
  return g;
}

export async function createBrokenDebris(kind, opts = {}) {
  const def = BREAKABLE_TYPES[kind] || BREAKABLE_TYPES.crate;
  const g = new THREE.Group();
  g.name = `breakable_${kind}_debris`;
  const proto = await loadProto(def.brokenUrl);
  if (proto) {
    const clone = proto.clone(true);
    fitHeight(clone, (opts.heightM ?? def.heightM) * 0.55);
    g.add(clone);
  }
  return g;
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickKind(rng) {
  const types = Object.values(BREAKABLE_TYPES);
  const total = types.reduce((s, t) => s + t.weight, 0);
  let r = rng() * total;
  for (const t of types) {
    r -= t.weight;
    if (r <= 0) return t.id;
  }
  return "crate";
}

/**
 * Mount breakables around camps, settlements, hostiles, dungeon rooms.
 * Registers harvest nodes on island + HarvestSystem.
 *
 * @param {THREE.Scene|THREE.Object3D} scene
 * @param {object} island
 * @param {(x:number,z:number)=>number|null} groundAt
 * @param {{
 *   world?: object,
 *   seed?: string|number,
 *   harvest?: import('./harvest.js').HarvestSystem,
 *   loot?: import('./lootField.js').LootField,
 *   flash?: Function,
 * }} opts
 */
export async function mountBreakableField(scene, island, groundAt, opts = {}) {
  const root = new THREE.Group();
  root.name = "breakable_props";
  scene.add(root);

  const seedStr = String(opts.seed || opts.world?.seed || "VALHEIM42");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const rng = mulberry32(h ^ 0xb34e00);

  const placements = planBreakablePlacements(opts.world, rng);
  /** @type {object[]} */
  const nodes = [];
  let id = 0;

  // Preload all prototypes
  await Promise.all(
    Object.values(BREAKABLE_TYPES).flatMap((t) => [
      loadProto(t.intactUrl),
      loadProto(t.brokenUrl),
    ]),
  );

  const batch = 8;
  for (let i = 0; i < placements.length; i += batch) {
    const slice = placements.slice(i, i + batch);
    await Promise.all(
      slice.map(async (p) => {
        const kind = p.kind || pickKind(rng);
        const def = BREAKABLE_TYPES[kind] || BREAKABLE_TYPES.crate;
        let gy = p.y;
        if (!Number.isFinite(gy)) {
          try {
            gy = groundAt?.(p.x, p.z);
          } catch {
            /* */
          }
        }
        if (!Number.isFinite(gy)) gy = 0;

        const mesh = await createBreakableMesh(kind, {
          yaw: p.yaw ?? rng() * Math.PI * 2,
          heightM: def.heightM,
        });
        mesh.position.set(p.x, gy, p.z);
        const nid = `brk_${kind}_${id++}`;
        mesh.userData.harvestId = nid;
        mesh.userData.breakable = true;
        mesh.userData.breakableKind = kind;
        root.add(mesh);

        const node = {
          id: nid,
          kind,
          tool: "any",
          breakable: true,
          materialId: kind === "jar" ? "t0_scrap" : "t0_wood",
          materialName: def.name + " Scrap",
          hp: def.hp,
          maxHp: def.hp,
          chunks: 1,
          maxChunks: 1,
          object: mesh,
          position: mesh.position,
          groundY: gy,
          siHeight: def.heightM,
          lootTable: kind,
          tier: 0,
        };
        nodes.push(node);
      }),
    );
  }

  if (!Array.isArray(island.harvestNodes)) island.harvestNodes = [];
  island.harvestNodes.push(...nodes);
  opts.harvest?.addNodes?.(nodes);

  // Hook break → debris + world loot (extends harvest.hit once)
  if (opts.harvest && !opts.harvest._breakableHooked) {
    const harvest = opts.harvest;
    harvest._breakableHooked = true;
    const origHit = harvest.hit.bind(harvest);
    harvest.hit = (id, tool, power) => {
      const n = harvest.getNode(id);
      const res = origHit(id, tool, power);
      if (res?.broken && n?.breakable) {
        onBreakableBroken(n, root, opts).catch(() => {});
      }
      return res;
    };
  }

  console.info(
    `[breakable] ${BREAKABLE_GEN} placed=${nodes.length} camps/enemies/dungeons`,
  );

  return {
    root,
    nodes,
    gen: BREAKABLE_GEN,
    stats: {
      total: nodes.length,
      crate: nodes.filter((n) => n.kind === "crate").length,
      barrel: nodes.filter((n) => n.kind === "barrel").length,
      jar: nodes.filter((n) => n.kind === "jar").length,
    },
  };
}

/**
 * Plan world placements from settlements, hostiles, dungeon modules.
 */
export function planBreakablePlacements(world, rng = Math.random) {
  /** @type {{x:number,z:number,y?:number,kind?:string,yaw?:number,tag?:string}[]} */
  const out = [];
  if (!world) return out;

  // Camps + farms + towns
  for (const s of world.settlements || []) {
    const isCamp = s.kind === "camp";
    const isFarm = s.kind === "farm";
    const n = isCamp ? 5 + Math.floor(rng() * 4) : isFarm ? 3 + Math.floor(rng() * 2) : 2 + Math.floor(rng() * 3);
    const r = (s.radius || 14) * (isCamp ? 0.55 : 0.4);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2;
      const d = 2 + rng() * r;
      out.push({
        x: s.x + Math.cos(a) * d,
        z: s.z + Math.sin(a) * d,
        y: s.y,
        kind: pickKind(rng),
        tag: s.kind || "settlement",
      });
    }
  }

  // Near hostiles / raiders
  for (const h of world.hostiles || []) {
    if (rng() > 0.65) continue;
    const n = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2;
      const d = 1.2 + rng() * 3.5;
      out.push({
        x: h.x + Math.cos(a) * d,
        z: h.z + Math.sin(a) * d,
        y: h.y,
        kind: pickKind(rng),
        tag: "hostile",
      });
    }
  }

  // POIs (mines, towers, dungeon entrances)
  for (const p of world.pois || []) {
    if (p.kind === "info" || p.kind === "training") continue;
    const n = p.kind === "dungeon" ? 4 + Math.floor(rng() * 3) : 1 + Math.floor(rng() * 2);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2;
      const d = 2 + rng() * 5;
      out.push({
        x: p.x + Math.cos(a) * d,
        z: p.z + Math.sin(a) * d,
        y: p.y,
        kind: pickKind(rng),
        tag: p.kind || "poi",
      });
    }
  }

  // Cap density for performance
  if (out.length > 220) {
    // shuffle trim
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out.slice(0, 220);
  }
  return out;
}

async function onBreakableBroken(n, root, opts) {
  const kind = n.kind || n.lootTable || "crate";
  const pos = n.object?.position || n.position;
  if (!pos) return;

  // Swap to debris mesh briefly
  if (n.object) {
    n.object.visible = false;
    try {
      const debris = await createBrokenDebris(kind, { heightM: n.siHeight });
      debris.position.copy(pos);
      debris.rotation.y = n.object.rotation.y || 0;
      root.add(debris);
      // Fade debris after a few seconds
      const start = performance.now();
      const life = 4200;
      const tick = () => {
        const t = (performance.now() - start) / life;
        if (t >= 1) {
          root.remove(debris);
          return;
        }
        debris.traverse((o) => {
          if (o.isMesh && o.material) {
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            for (const m of mats) {
              m.transparent = true;
              m.opacity = Math.max(0, 1 - t);
            }
          }
        });
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch {
      /* */
    }
  }

  // Roll loot → LootField world drops (not only bag mats)
  let items = rollBreakableLoot(kind);
  // Resolve food via foodKit if available
  try {
    const { rollFoodDrop, loadFoodCatalog } = await import("./foodKit.js");
    await loadFoodCatalog();
    items = items
      .map((it) => {
        if (it._rollFood) {
          const f = rollFoodDrop();
          return f || { id: "t0_hide_scrap", name: "Hide Scrap", tier: 0, slot: "mat", qty: 1 };
        }
        return it;
      })
      .filter(Boolean);
  } catch {
    items = items.filter((it) => !it._rollFood);
  }

  const loot = opts.loot || window.__mvLoot;
  if (loot?.spawnMany) {
    const v = new THREE.Vector3(pos.x, pos.y, pos.z);
    loot.spawnMany(v, items);
  } else if (loot?.spawn) {
    for (const it of items) {
      loot.spawn(new THREE.Vector3(pos.x, pos.y, pos.z), it);
    }
  }
  opts.flash?.(
    `Broke ${BREAKABLE_TYPES[kind]?.name || kind} · ${items.map((i) => i.name).join(", ")}`,
    1.4,
  );
}
