/**
 * Procedural / CDN nature field for Multiverse 5 km seeds.
 * Pattern: variety + instanced decor (discourse forest style) + pickable harvest nodes.
 *
 * - Trees: Kenney nature-kit variety, SI canopy heights
 * - Rocks: 20 m tall, 40% buried (Valheim mining), multi-chunk HP
 * - Decor: InstancedMesh trees for density without per-draw cost
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import {
  TREE_PROTOTYPES,
  ROCK_PROTOTYPES,
  kenneyNatureUrl,
  NATURE_DENSITY,
  NATURE_GEN,
  ROCK_HEIGHT_M,
  ROCK_BURY_FRAC,
  HP_PER_CHUNK,
  CHUNK_DEBRIS,
} from "./natureSsot.js";
import { COLLIDER_LAYER } from "./mapLiteracy.js";

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

/**
 * Normalize a loaded GLB root so min.y = 0 and height ≈ targetHeightM.
 * @returns {THREE.Object3D}
 */
function normalizeToHeight(root, targetHeightM) {
  const clone = root.clone(true);
  clone.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(clone);
  const size = new THREE.Vector3();
  box.getSize(size);
  const h = Math.max(0.01, size.y);
  const s = targetHeightM / h;
  clone.scale.multiplyScalar(s);
  clone.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(clone);
  clone.position.y -= box2.min.y;
  clone.updateMatrixWorld(true);
  return clone;
}

/** Procedural tree fallback (discourse-style trunk + canopy) when GLB fails. */
function makeProceduralTree(proto, scale = 1) {
  const g = new THREE.Group();
  const h = (proto.heightM || 12) * scale;
  const trunkR = Math.max(0.18, h * 0.028);
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(trunkR * 0.7, trunkR, h * 0.55, 8),
    new THREE.MeshStandardMaterial({
      color: proto.trunkTint || 0x3d2a18,
      roughness: 0.92,
    }),
  );
  trunk.position.y = h * 0.275;
  trunk.castShadow = true;
  g.add(trunk);
  const canopy = new THREE.Mesh(
    new THREE.IcosahedronGeometry(h * 0.22, 1),
    new THREE.MeshStandardMaterial({
      color: proto.canopyTint || 0x2f7a34,
      roughness: 0.85,
    }),
  );
  canopy.position.y = h * 0.62;
  canopy.scale.set(1.1, 1.25, 1.1);
  canopy.castShadow = true;
  g.add(canopy);
  g.userData.siHeight = h;
  return g;
}

/** Procedural boulder — 20 m class with base at y=0 (bury applied on place). */
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
  // Sit on y=0: geometry radius → shift up
  body.position.y = h * 0.42;
  body.scale.set(1.05, 1.15, 0.95);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  // Extra lobe for variety
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

async function loadPrototype(loader, url) {
  const gltf = await loader.loadAsync(url);
  return gltf.scene;
}

/**
 * Mount nature field after island expand.
 * Mutates island.harvestNodes (appends) and returns controller.
 *
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

  const decorRoot = new THREE.Group();
  decorRoot.name = "nature-decor";
  root.add(decorRoot);

  const debrisRoot = new THREE.Group();
  debrisRoot.name = "nature-debris";
  root.add(debrisRoot);

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

  // Load tree/rock templates (CDN with procedural fallback)
  const treeTemplates = [];
  for (const proto of TREE_PROTOTYPES) {
    let tpl = null;
    try {
      const raw = await loadPrototype(loader, kenneyNatureUrl(proto.file));
      tpl = normalizeToHeight(raw, proto.heightM);
      tpl.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          o.frustumCulled = true;
        }
      });
    } catch (e) {
      console.warn("[nature] tree CDN fail", proto.id, e?.message || e);
      tpl = makeProceduralTree(proto, 1);
    }
    treeTemplates.push({ proto, template: tpl });
  }

  const rockTemplates = [];
  for (const proto of ROCK_PROTOTYPES) {
    let tpl = null;
    try {
      const raw = await loadPrototype(loader, kenneyNatureUrl(proto.file));
      tpl = normalizeToHeight(raw, proto.heightM || ROCK_HEIGHT_M);
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

  // Land discs: hub + faction territories from seed world
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

  const harvestNodes = [];
  let treeIdx = 0;
  let rockIdx = 0;

  const placeOnDisc = (disc, count, minSpacing, preferCoastal = false) => {
    const pts = [];
    let guard = 0;
    while (pts.length < count && guard++ < count * 40) {
      const a = rng() * Math.PI * 2;
      const rr = Math.sqrt(rng()) * disc.r * 0.92;
      if (rr < NATURE_DENSITY.clearHubM && disc.x === 0 && disc.z === 0) continue;
      const x = disc.x + Math.cos(a) * rr;
      const z = disc.z + Math.sin(a) * rr;
      // stay on land-ish
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
      pts.push({ x, z, y: gy, coastal: preferCoastal || rr > disc.r * 0.72 });
    }
    return pts;
  };

  // ── Harvest trees ─────────────────────────────────────────────
  for (const disc of discs) {
    const pts = placeOnDisc(
      disc,
      NATURE_DENSITY.harvestTreesPerDisc,
      NATURE_DENSITY.minSpacingTreeM,
    );
    for (const p of pts) {
      let pick = treeTemplates[Math.floor(rng() * treeTemplates.length)];
      if (p.coastal) {
        const palm = treeTemplates.find((t) => t.proto.coastal);
        if (palm && rng() < 0.55) pick = palm;
      }
      const { proto, template } = pick;
      const scaleJitter = 0.75 + rng() * 0.5;
      const obj = template.clone(true);
      obj.scale.multiplyScalar(scaleJitter);
      obj.rotation.y = rng() * Math.PI * 2;
      // slight lean
      obj.rotation.z = (rng() - 0.5) * 0.08;
      obj.rotation.x = (rng() - 0.5) * 0.06;
      const height = (proto.heightM || 12) * scaleJitter;
      obj.position.set(p.x, p.y, p.z);
      obj.name = `nature-tree-${proto.id}-${treeIdx}`;
      const chunks = proto.chunks || 4;
      const maxHp = chunks * HP_PER_CHUNK.tree;
      const id = `nat_tree_${seed}_${treeIdx++}`;
      obj.userData.harvestId = id;
      obj.userData.harvestKind = "tree";
      obj.userData.selectable = "node";
      obj.userData.worldKind = "tree";
      obj.userData.colliderLayer = COLLIDER_LAYER.HARVEST;
      obj.userData.natureProto = proto.id;
      obj.userData.siHeight = height;
      harvestRoot.add(obj);
      harvestNodes.push({
        id,
        kind: "tree",
        materialId: proto.materialId || "t0_wood",
        object: obj,
        position: new THREE.Vector3(p.x, p.y + height * 0.4, p.z),
        halfExtents: new THREE.Vector3(1.2, height * 0.5, 1.2),
        hp: maxHp,
        maxHp,
        tool: "axe",
        zone: "nature",
        chunks,
        maxChunks: chunks,
        chunkMode: true,
        buryFrac: 0,
        siHeight: height,
        nature: true,
        protoId: proto.id,
      });
    }
  }

  // ── Harvest rocks — 20 m, 40% buried ──────────────────────────
  for (const disc of discs) {
    const pts = placeOnDisc(
      disc,
      NATURE_DENSITY.harvestRocksPerDisc,
      NATURE_DENSITY.minSpacingRockM,
    );
    for (const p of pts) {
      const pick = rockTemplates[Math.floor(rng() * rockTemplates.length)];
      const { proto, template } = pick;
      const scaleJitter = 0.85 + rng() * 0.3;
      const obj = template.clone(true);
      obj.scale.multiplyScalar(scaleJitter);
      obj.rotation.y = rng() * Math.PI * 2;
      const height = (proto.heightM || ROCK_HEIGHT_M) * scaleJitter;
      const buryFrac = proto.buryFrac ?? ROCK_BURY_FRAC;
      const bury = height * buryFrac;
      // bottom of mesh at y=0 after normalize → sink bury metres into ground
      obj.position.set(p.x, p.y - bury, p.z);
      obj.name = `nature-rock-${proto.id}-${rockIdx}`;
      const chunks = proto.chunks || 6;
      const maxHp = chunks * HP_PER_CHUNK.rock;
      const id = `nat_rock_${seed}_${rockIdx++}`;
      obj.userData.harvestId = id;
      obj.userData.harvestKind = "rock";
      obj.userData.selectable = "node";
      obj.userData.worldKind = "rock";
      obj.userData.colliderLayer = COLLIDER_LAYER.HARVEST;
      obj.userData.natureProto = proto.id;
      obj.userData.siHeight = height;
      obj.userData.buryFrac = buryFrac;
      obj.userData.buryM = bury;
      obj.userData.exposedM = height * (1 - buryFrac);
      harvestRoot.add(obj);
      harvestNodes.push({
        id,
        kind: "rock",
        materialId: proto.materialId || "t0_stone",
        object: obj,
        position: new THREE.Vector3(p.x, p.y + height * (1 - buryFrac) * 0.5, p.z),
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
        valheimRock: true,
      });
    }
  }

  // ── Instanced decor trees (density, no harvest) ───────────────
  // One shared cone+trunk billboard-ish icosa for draw-call batching
  const decorGeo = new THREE.ConeGeometry(1.4, 4.5, 6);
  decorGeo.translate(0, 2.25, 0);
  const decorMat = new THREE.MeshStandardMaterial({
    color: 0x2a6b32,
    roughness: 0.9,
    flatShading: true,
  });
  const maxDecor = discs.length * NATURE_DENSITY.decorTreesPerDisc;
  const inst = new THREE.InstancedMesh(decorGeo, decorMat, maxDecor);
  inst.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  inst.castShadow = false;
  inst.receiveShadow = true;
  inst.frustumCulled = true;
  inst.name = "nature-decor-instanced";
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let di = 0;
  for (const disc of discs) {
    const pts = placeOnDisc(
      disc,
      NATURE_DENSITY.decorTreesPerDisc,
      4.5,
    );
    for (const p of pts) {
      if (di >= maxDecor) break;
      const s = 0.7 + rng() * 1.4;
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, rng() * Math.PI * 2, 0);
      dummy.scale.set(s * 0.85, s, s * 0.85);
      dummy.updateMatrix();
      inst.setMatrixAt(di, dummy.matrix);
      color.setHSL(0.28 + rng() * 0.08, 0.45 + rng() * 0.2, 0.28 + rng() * 0.12);
      inst.setColorAt(di, color);
      di++;
    }
  }
  inst.count = di;
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  decorRoot.add(inst);

  // Merge into island harvest list
  if (!Array.isArray(island.harvestNodes)) island.harvestNodes = [];
  island.harvestNodes.push(...harvestNodes);
  island.natureField = {
    gen: NATURE_GEN,
    trees: treeIdx,
    rocks: rockIdx,
    decor: di,
    discs: discs.length,
  };

  console.info(
    `[nature] ${NATURE_GEN} harvest trees=${treeIdx} rocks=${rockIdx} (${ROCK_HEIGHT_M}m @ ${ROCK_BURY_FRAC * 100}% bury) decorInst=${di} discs=${discs.length}`,
  );

  /** Active debris for update() */
  const debris = [];

  /**
   * Spawn chunk debris at node (called from HarvestSystem).
   */
  function spawnChunkDebris(node, kind) {
    const n = CHUNK_DEBRIS[kind === "rock" ? "rockPieces" : "treePieces"] || 3;
    const base =
      node.object?.position?.clone?.() ||
      node.position?.clone?.() ||
      new THREE.Vector3();
    const h = node.siHeight || (kind === "rock" ? ROCK_HEIGHT_M : 12);
    const exposed = kind === "rock" ? h * (1 - (node.buryFrac ?? ROCK_BURY_FRAC)) : h;
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
        (node.groundY ?? base.y) + exposed * (0.3 + rng() * 0.5),
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

  /**
   * Visual: shrink remaining rock/tree after chunk strip (Valheim weld scale).
   */
  function applyChunkVisual(node) {
    if (!node?.object || !node.maxChunks) return;
    const frac = Math.max(0.12, (node.chunks || 0) / node.maxChunks);
    const base = node._chunkBaseScale || node.object.scale.x || 1;
    if (!node._chunkBaseScale) node._chunkBaseScale = base;
    // Rocks keep bury: scale about base, re-anchor bottom into ground
    if (node.kind === "rock" && Number.isFinite(node.groundY)) {
      const h = (node.siHeight || ROCK_HEIGHT_M) * frac;
      const bury = h * (node.buryFrac ?? ROCK_BURY_FRAC);
      node.object.scale.setScalar(node._chunkBaseScale * frac);
      node.object.position.y = node.groundY - bury;
    } else {
      node.object.scale.setScalar(node._chunkBaseScale * (0.55 + 0.45 * frac));
    }
  }

  function update(dt) {
    const now = performance.now();
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      const age = now - d.born;
      if (age > d.life) {
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
      // soft ground stop
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
    harvestNodes,
    spawnChunkDebris,
    applyChunkVisual,
    update,
    stats: island.natureField,
  };
}
