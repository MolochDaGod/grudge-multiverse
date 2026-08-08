/**
 * Multiverse nature field — 5 km seed land discs.
 *
 * Trees: discourse-style InstancedForest (real branched canopy + leaf sway LOD)
 *   https://discourse.threejs.org/t/procedural-instanced-forest-high-performance-real-trees/88610
 * Rocks: 20 m tall, 40% buried, multi-chunk Valheim mining (Kenney cliff GLB or procedural)
 * Harvest: proxy meshes for pick; forest visual hides/scales per tree index
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import {
  ROCK_PROTOTYPES,
  kenneyNatureUrl,
  NATURE_DENSITY,
  NATURE_GEN,
  ROCK_HEIGHT_M,
  ROCK_BURY_FRAC,
  HP_PER_CHUNK,
  CHUNK_DEBRIS,
  TREE_CHUNKS,
} from "./natureSsot.js";
import {
  InstancedForest,
  createLeafTexture,
  createBarkTexture,
  FOREST_CONFIG,
} from "./instancedForest.js";
import { COLLIDER_LAYER } from "./mapLiteracy.js";
import {
  sampleBiome,
  pickBiomeTreeId,
  ISLAND_ARCHETYPES,
} from "./biomeSsot.js";

function mulberry32(a) {
  return function rand() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str) {
  let h = 2166136261;
  const s = String(str || "VALHEIM42");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function normalizeToHeight(root, targetHeightM) {
  const clone = root.clone(true);
  clone.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(clone);
  const size = new THREE.Vector3();
  box.getSize(size);
  const h = Math.max(0.01, size.y);
  clone.scale.multiplyScalar(targetHeightM / h);
  clone.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(clone);
  clone.position.y -= box2.min.y;
  clone.updateMatrixWorld(true);
  return clone;
}

function makeProceduralRock(proto, scale = 1) {
  const h = (proto.heightM || ROCK_HEIGHT_M) * scale;
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.DodecahedronGeometry(h * 0.42, 1),
    new THREE.MeshStandardMaterial({
      color: proto.color || 0x6a6a66,
      roughness: 0.95,
      flatShading: true,
    }),
  );
  body.position.y = h * 0.42;
  body.scale.set(1.05, 1.15, 0.95);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  const lobe = new THREE.Mesh(
    new THREE.DodecahedronGeometry(h * 0.22, 0),
    body.material.clone(),
  );
  lobe.position.set(h * 0.18, h * 0.28, -h * 0.1);
  lobe.castShadow = true;
  g.add(lobe);
  g.userData.siHeight = h;
  return g;
}

/**
 * @param {THREE.Scene} scene
 * @param {object} island
 * @param {(x:number,z:number)=>number|null} groundAt
 * @param {{ seed?: string, world?: object }} opts
 */
export async function mountNatureField(scene, island, groundAt, opts = {}) {
  const seed = opts.seed || "VALHEIM42";
  const rng = mulberry32(hashSeed(seed) ^ 0x4e4154);
  const root = new THREE.Group();
  root.name = "nature-field";
  scene.add(root);

  const harvestRoot = new THREE.Group();
  harvestRoot.name = "nature-harvest";
  root.add(harvestRoot);

  const debrisRoot = new THREE.Group();
  debrisRoot.name = "nature-debris";
  root.add(debrisRoot);

  const sampleGround = (x, z) => {
    let y = island.waterY ?? 0.25;
    try {
      if (typeof groundAt === "function") {
        const g = groundAt(x, z);
        if (Number.isFinite(g)) y = g;
      } else if (island.sampleY) {
        const g = island.sampleY(x, z);
        if (Number.isFinite(g)) y = g;
      }
    } catch {
      /* */
    }
    return y;
  };

  // Land discs
  const discs = [];
  if (island.landDiscs?.length) {
    for (const d of island.landDiscs) discs.push({ ...d });
  } else {
    discs.push({
      x: 0,
      z: 0,
      r: island.meshLandRadius || island.hubRadius || 340,
    });
  }
  for (const z0 of opts.world?.zones || []) {
    if (z0.kind === "territory" && z0.x != null && z0.radius) {
      if (!discs.some((d) => Math.hypot(d.x - z0.x, d.z - z0.z) < 40)) {
        discs.push({ x: z0.x, z: z0.z, r: z0.radius });
      }
    }
  }

  const placeOnDisc = (disc, count, minSpacing) => {
    const pts = [];
    let guard = 0;
    while (pts.length < count && guard++ < count * 40) {
      const a = rng() * Math.PI * 2;
      const rr = Math.sqrt(rng()) * disc.r * 0.92;
      if (rr < NATURE_DENSITY.clearHubM && disc.x === 0 && disc.z === 0) continue;
      const x = disc.x + Math.cos(a) * rr;
      const z = disc.z + Math.sin(a) * rr;
      const gy = sampleGround(x, z);
      if (gy <= (island.waterY ?? 0.25) + 0.35) continue;
      let ok = true;
      for (const p of pts) {
        if (Math.hypot(p.x - x, p.z - z) < minSpacing) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      pts.push({ x, z, y: gy });
    }
    return pts;
  };

  // Island biomes (sector map) — density & tree type per island, not rings
  const islandBiomes =
    opts.world?.biomes?.islands ||
    island.islandBiomes ||
    island.seedTerrains?.islands ||
    null;
  const seedU32 = hashSeed(seed);

  // Map tree id → forest typeIndex (InstancedForest TREE_TYPES variety)
  const treeTypeIndex = { oak: 0, default: 1, pine: 2, detailed: 3, palm: 4 };

  // ── Procedural instanced forest (discourse) + island biome density ─
  const treePlacements = [];
  for (const disc of discs) {
    const biome = sampleBiome(disc.x, disc.z, {
      seedU32,
      islands: islandBiomes,
      landDiscs: discs,
    });
    const dens = biome.treeDensity ?? 1;
    const treesPerDisc = Math.max(
      4,
      Math.floor(
        (NATURE_DENSITY.harvestTreesPerDisc +
          NATURE_DENSITY.decorTreesPerDisc * 0.45) *
          dens,
      ),
    );
    // Hellmaw sparse; wildwood dense; ethereal_falls medium
    const pts = placeOnDisc(
      disc,
      treesPerDisc,
      Math.max(4, NATURE_DENSITY.minSpacingTreeM / Math.sqrt(dens)),
    );
    for (const p of pts) {
      const b = sampleBiome(p.x, p.z, {
        seedU32,
        islands: islandBiomes,
        landDiscs: discs,
      });
      const tid = pickBiomeTreeId(b, rng) || "default";
      treePlacements.push({
        x: p.x,
        z: p.z,
        y: p.y,
        scale: 0.7 + rng() * 0.85,
        typeIndex: treeTypeIndex[tid] ?? Math.floor(rng() * 5),
        treeId: tid,
        biomeId: b.id,
        seed:
          (hashSeed(seed) ^
            Math.floor(p.x * 100) ^
            Math.floor(p.z * 100)) >>>
          0,
      });
    }
  }

  const forest = new InstancedForest({
    ...FOREST_CONFIG,
    CUSTOM_TREE_CULLING: true,
    LOD_FADE_START: 220,
    LOD_MAX_DISTANCE: 520,
    TREE_COUNT: treePlacements.length,
  });
  const leafTex = createLeafTexture();
  const barkTex = createBarkTexture();
  const forestResult = forest.generateFromPlacements(
    treePlacements,
    leafTex,
    barkTex,
  );
  root.add(forest.group);

  // Harvest proxies — thin pickable trunks linked to forest tree index
  const harvestNodes = [];
  let treeIdx = 0;
  for (let i = 0; i < treePlacements.length; i++) {
    // Only every Nth tree is harvestable (keep density visual, limit MP nodes)
    const harvestable =
      i % 2 === 0 || treePlacements[i].scale > 1.1;
    if (!harvestable) continue;

    const p = treePlacements[i];
    const height = forest.treePlacements[i]?.height || 10;
    const proxy = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.75, Math.min(height * 0.55, 8), 6),
      new THREE.MeshBasicMaterial({
        visible: false,
        transparent: true,
        opacity: 0,
      }),
    );
    proxy.position.set(p.x, p.y + Math.min(height * 0.28, 4), p.z);
    proxy.name = `tree-proxy-${i}`;
    const chunks = TREE_CHUNKS;
    const maxHp = chunks * HP_PER_CHUNK.tree;
    const id = `nat_tree_${seed}_${treeIdx++}`;
    proxy.userData.harvestId = id;
    proxy.userData.harvestKind = "tree";
    proxy.userData.selectable = "node";
    proxy.userData.worldKind = "tree";
    proxy.userData.colliderLayer = COLLIDER_LAYER.HARVEST;
    proxy.userData.forestTreeIndex = i;
    harvestRoot.add(proxy);

    harvestNodes.push({
      id,
      kind: "tree",
      materialId: "t0_wood",
      object: proxy,
      position: new THREE.Vector3(p.x, p.y + height * 0.4, p.z),
      halfExtents: new THREE.Vector3(1.2, height * 0.5, 1.2),
      hp: maxHp,
      maxHp,
      tool: "axe",
      zone: "nature",
      chunks,
      maxChunks: chunks,
      chunkMode: true,
      siHeight: height,
      nature: true,
      forestTreeIndex: i,
      protoId: treePlacements[i].treeId || `proc_${treePlacements[i].typeIndex ?? 0}`,
      biomeId: treePlacements[i].biomeId || null,
    });
  }

  // ── Valheim rocks — scale/bury by **island** biome (Hellmaw big, meadows small) ─
  const loader = new GLTFLoader();
  try {
    const draco = new DRACOLoader();
    draco.setDecoderPath(
      "https://www.gstatic.com/draco/versioned/decoders/1.5.7/",
    );
    loader.setDRACOLoader(draco);
  } catch {
    /* optional */
  }

  const rockTemplates = [];
  for (const proto of ROCK_PROTOTYPES) {
    let tpl = null;
    try {
      const gltf = await loader.loadAsync(kenneyNatureUrl(proto.file));
      tpl = normalizeToHeight(gltf.scene, proto.heightM || ROCK_HEIGHT_M);
      tpl.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          o.frustumCulled = true;
        }
      });
    } catch (e) {
      console.warn("[nature] rock CDN fail", proto.id, e?.message || e);
      tpl = makeProceduralRock(proto, 1);
    }
    rockTemplates.push({ proto, template: tpl });
  }

  let rockIdx = 0;
  for (const disc of discs) {
    const discBiome = sampleBiome(disc.x, disc.z, {
      seedU32,
      islands: islandBiomes,
      landDiscs: discs,
    });
    const rockN = Math.max(
      2,
      Math.floor(
        NATURE_DENSITY.harvestRocksPerDisc * (discBiome.rockDensity ?? 1),
      ),
    );
    const pts = placeOnDisc(
      disc,
      rockN,
      NATURE_DENSITY.minSpacingRockM,
    );
    for (const p of pts) {
      const b = sampleBiome(p.x, p.z, {
        seedU32,
        islands: islandBiomes,
        landDiscs: discs,
      });
      // Prefer cave rock on hellmaw/mountain
      let pick = rockTemplates[Math.floor(rng() * rockTemplates.length)];
      if (b.archetype === "volcanic" || b.id === "hellmaw" || b.id === "frozen_expanse") {
        pick =
          rockTemplates.find((t) => t.proto.id === "cliff_cave") || pick;
      }
      const { proto, template } = pick;
      const biomeScale = b.rockScale ?? 1;
      const scaleJitter = (0.85 + rng() * 0.3) * biomeScale;
      const obj = template.clone(true);
      obj.scale.multiplyScalar(scaleJitter);
      obj.rotation.y = rng() * Math.PI * 2;
      // Valheim full 20 m on volcanic/mountain; smaller on ethereal meadows
      const baseH = proto.heightM || ROCK_HEIGHT_M;
      const height = baseH * scaleJitter;
      const buryFrac = b.rockBury ?? proto.buryFrac ?? ROCK_BURY_FRAC;
      const bury = height * buryFrac;
      obj.position.set(p.x, p.y - bury, p.z);
      obj.name = `nature-rock-${b.id || proto.id}-${rockIdx}`;
      const chunks = proto.chunks || 6;
      const maxHp = chunks * HP_PER_CHUNK.rock;
      const id = `nat_rock_${seed}_${rockIdx++}`;
      obj.userData.harvestId = id;
      obj.userData.harvestKind = "rock";
      obj.userData.selectable = "node";
      obj.userData.worldKind = "rock";
      obj.userData.colliderLayer = COLLIDER_LAYER.HARVEST;
      obj.userData.siHeight = height;
      obj.userData.buryFrac = buryFrac;
      obj.userData.biomeId = b.id;
      harvestRoot.add(obj);
      harvestNodes.push({
        id,
        kind: "rock",
        materialId: proto.materialId || "t0_stone",
        object: obj,
        position: new THREE.Vector3(
          p.x,
          p.y + height * (1 - buryFrac) * 0.5,
          p.z,
        ),
        halfExtents: new THREE.Vector3(
          height * 0.35,
          height * (1 - buryFrac) * 0.5,
          height * 0.35,
        ),
        hp: maxHp,
        maxHp,
        tool: "pick",
        zone: "nature",
        chunks,
        maxChunks: chunks,
        chunkMode: true,
        buryFrac,
        buryM: bury,
        siHeight: height,
        groundY: p.y,
        nature: true,
        protoId: proto.id,
        biomeId: b.id,
        valheimRock: true,
      });
    }
  }

  if (!Array.isArray(island.harvestNodes)) island.harvestNodes = [];
  island.harvestNodes.push(...harvestNodes);
  island.natureField = {
    gen: `${NATURE_GEN}+proc-forest`,
    trees: treeIdx,
    forestTrees: treePlacements.length,
    branches: forestResult.stats.branches,
    leaves: forestResult.stats.leaves,
    rocks: rockIdx,
    discs: discs.length,
  };

  console.info(
    `[nature] ${island.natureField.gen} forestTrees=${treePlacements.length} harvestTrees=${treeIdx} rocks=${rockIdx} (${ROCK_HEIGHT_M}m@${ROCK_BURY_FRAC * 100}%bury) branches=${forestResult.stats.branches} leaves=${forestResult.stats.leaves}`,
  );

  const debris = [];

  function spawnChunkDebris(node, kind) {
    const n = CHUNK_DEBRIS[kind === "rock" ? "rockPieces" : "treePieces"] || 3;
    const base =
      node.object?.position?.clone?.() ||
      node.position?.clone?.() ||
      new THREE.Vector3();
    const h = node.siHeight || (kind === "rock" ? ROCK_HEIGHT_M : 12);
    const exposed =
      kind === "rock" ? h * (1 - (node.buryFrac ?? ROCK_BURY_FRAC)) : h * 0.5;
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(
        kind === "rock"
          ? new THREE.DodecahedronGeometry(0.35 + rng() * 0.45, 0)
          : new THREE.CylinderGeometry(0.12, 0.18, 0.8 + rng() * 0.6, 5),
        new THREE.MeshStandardMaterial({
          color: kind === "rock" ? 0x6a6a66 : 0x4a3420,
          roughness: 0.95,
          flatShading: true,
        }),
      );
      mesh.position.set(
        base.x + (rng() - 0.5) * 1.2,
        (node.groundY ?? base.y) + exposed * (0.2 + rng() * 0.5),
        base.z + (rng() - 0.5) * 1.2,
      );
      mesh.castShadow = true;
      debrisRoot.add(mesh);
      debris.push({
        mesh,
        vel: new THREE.Vector3(
          (rng() - 0.5) * CHUNK_DEBRIS.impulse,
          2 + rng() * 3,
          (rng() - 0.5) * CHUNK_DEBRIS.impulse,
        ),
        life: CHUNK_DEBRIS.lifeMs,
        born: performance.now(),
      });
    }
  }

  function applyChunkVisual(node) {
    if (!node) return;
    const frac = Math.max(0.12, (node.chunks || 0) / Math.max(1, node.maxChunks));
    // Procedural forest tree
    if (node.forestTreeIndex != null) {
      if (node.chunks <= 0) forest.setTreeVisible(node.forestTreeIndex, false);
      else forest.setTreeChunkScale(node.forestTreeIndex, frac);
      return;
    }
    if (!node.object || !node.maxChunks) return;
    const base = node._chunkBaseScale || node.object.scale.x || 1;
    if (!node._chunkBaseScale) node._chunkBaseScale = base;
    if (node.kind === "rock" && Number.isFinite(node.groundY)) {
      const h = (node.siHeight || ROCK_HEIGHT_M) * frac;
      const bury = h * (node.buryFrac ?? ROCK_BURY_FRAC);
      node.object.scale.setScalar(node._chunkBaseScale * frac);
      node.object.position.y = node.groundY - bury;
    } else {
      node.object.scale.setScalar(node._chunkBaseScale * (0.55 + 0.45 * frac));
    }
  }

  function update(dt, camera) {
    const now = performance.now();
    forest.update(camera, now * 0.001);
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      if (now - d.born > d.life) {
        debrisRoot.remove(d.mesh);
        d.mesh.geometry?.dispose?.();
        d.mesh.material?.dispose?.();
        debris.splice(i, 1);
        continue;
      }
      d.vel.y -= 12 * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      d.mesh.rotation.x += dt * 2;
      d.mesh.rotation.z += dt * 1.4;
      const gy = sampleGround(d.mesh.position.x, d.mesh.position.z);
      if (d.mesh.position.y < gy + 0.15) {
        d.mesh.position.y = gy + 0.15;
        d.vel.y *= -0.2;
        d.vel.x *= 0.7;
        d.vel.z *= 0.7;
      }
    }
  }

  return {
    root,
    forest,
    harvestNodes,
    spawnChunkDebris,
    applyChunkVisual,
    update,
    stats: island.natureField,
  };
}
