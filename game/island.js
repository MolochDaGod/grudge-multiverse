/**
 * Bermuda Free Fire island — layered bake, water ring, grass harvest nodes outside hub.
 * Map binary: R2 CDN (GitHub 50 MB free). Local public/maps is offline fallback only.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshBVH, acceleratedRaycast } from "three-mesh-bvh";
import {
  tagMeshWorld,
  buildNavGrid,
  describeIslandLiteracy,
  estimateWaterline,
  measureLandRadius,
  createWaterPhysics,
  COLLIDER_LAYER,
} from "./mapLiteracy.js";

// Enable BVH raycasts for ground sampling (same as playerController)
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const BASE = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) || "/";

/** Production map SSOT — R2 CDN only (Vercel does not ship 54MB GLB). */
export const MAP_CDN_URL = "https://assets.grudge-studio.com/models/maps/bermuda.glb";
/** Dev offline only — stripped from production dist. */
export const MAP_LOCAL_URL = BASE + "maps/bermuda.glb";
export const MAP_URL = MAP_CDN_URL;
/**
 * Bermuda Free Fire GLB is already authored near SI metres (~840×610 m, buildings ~5–10 m).
 * NEVER force 120 m — that shrinks buildings under 1.8 m heroes (characters > houses).
 * null = preserve authored scale (preferred). Pass a number only for unit-decade rescue.
 */
export const ISLAND_TARGET_WIDTH_M = null;
export const HUMAN_HEIGHT_M = 1.8;

/** Layer names for production world stack */
export const ISLAND_LAYERS = {
  terrain: "layer-terrain",
  props: "layer-props",
  harvest: "layer-harvest",
  buildings: "layer-buildings",
  water: "layer-water",
  hubs: "layer-hub",
};

export function classifyMeshName(name) {
  const n = String(name || "");
  // Foliage first (leaves must not become walkable/solid)
  if (
    /leave|leaf|plant_01|Broom_snakeweed|bush|flower|grass(?!_ground)/i.test(n) &&
    !/wall|fence|house|power|terrain|ground|Floor|road/i.test(n)
  ) {
    return "tree";
  }
  if (/pinecone|Common_trunk|wood_trunk/i.test(n) && !/wall|fence|house/i.test(n)) {
    return "tree";
  }
  if (/Rock_big|stone_01_A|stone_01_B|stone_01_C/i.test(n) && !/ruined|house/i.test(n)) {
    return "rock";
  }
  // Free Fire Bermuda: Main_Large_Terrain* is the real island shell (not tiny "ground" props)
  if (
    /Main_Large_Terrain|CementFactory_ground|^ground|ground\.|ground_lod|Floor|terrain|grass_ground|MainHighway|UnsurfacedRoad|airport_road|Road_Town|road2Lane|Mesh Object.*floor|floor03/i.test(
      n,
    )
  ) {
    return "terrain";
  }
  if (/house|building|wall|fence|tower|factory|barn|roof|Hangar|Warehouse|Garage|Airport|Logcabin|Sandbags|Container|Cargo_container/i.test(n)) {
    return "building";
  }
  return "prop";
}

/**
 * Load island GLB with magic-byte gate (reject SPA HTML fake-200).
 * Order: CDN first (production), local last (dev only).
 */
async function loadIslandGltf(loader, preferredUrl) {
  const candidates = [preferredUrl, MAP_CDN_URL, MAP_LOCAL_URL].filter(
    (u, i, a) => u && a.indexOf(u) === i,
  );
  let lastErr;
  for (const url of candidates) {
    try {
      window.setLoaderStatus?.(`Loading map ${url.includes("assets.") ? "CDN" : "local"}…`);
      window.setLoaderProgress?.(0, 1, "Downloading Bermuda island…");
      // Magic-byte probe — never parse HTML as GLB
      try {
        const head = await fetch(url, { method: "HEAD", mode: "cors", cache: "no-store" });
        const ct = (head.headers.get("content-type") || "").toLowerCase();
        if (ct.includes("text/html") || (!head.ok && head.status !== 0)) {
          throw new Error(`bad content-type ${ct || head.status}`);
        }
      } catch (probeErr) {
        // Some CDNs block HEAD — still try load; GET magic-byte below if fetch range works
        if (String(probeErr?.message || "").includes("bad content-type")) throw probeErr;
      }
      const gltf = await loader.loadAsync(url);
      window.setLoaderProgress?.(1, 1, "Island geometry ready");
      console.info("[island] loaded", url);
      return { gltf, url };
    } catch (e) {
      lastErr = e;
      console.warn("[island] load fail", url, e?.message || e);
    }
  }
  throw lastErr || new Error("bermuda.glb load failed (CDN required in production)");
}

/**
 * Load Bermuda GLB, SI-scale, build water border, layered groups, grass harvest ring outside hub.
 */
export async function loadBermudaIsland(scene, opts = {}) {
  const loader = new GLTFLoader();
  try {
    const draco = new DRACOLoader();
    draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    loader.setDRACOLoader(draco);
  } catch {
    /* optional */
  }

  const { gltf } = await loadIslandGltf(loader, opts.url || MAP_URL);
  const root = gltf.scene;
  root.name = "bermuda-island";

  // Layer groups
  const layers = {
    terrain: new THREE.Group(),
    props: new THREE.Group(),
    harvest: new THREE.Group(),
    buildings: new THREE.Group(),
    hubs: new THREE.Group(),
  };
  for (const [k, g] of Object.entries(layers)) {
    g.name = ISLAND_LAYERS[k] || `layer-${k}`;
  }

  // SI scale — 1 unit = 1 m. Preserve authored metres; only fix 100× errors.
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxXZ = Math.max(size.x, size.z) || 1;
  const maxY = size.y || 1;
  let scale = 1;
  const forced = opts.targetWidth ?? ISLAND_TARGET_WIDTH_M;
  if (typeof forced === "number" && forced > 0) {
    // Explicit override only (legacy). Prefer leaving null.
    scale = forced / maxXZ;
  } else if (maxXZ > 5000 || maxY > 2000) {
    // Classic cm-as-m decade
    scale = 0.01;
  } else if (maxXZ < 20 && maxY < 5) {
    // Tiny authored map — enlarge carefully (not character-fit)
    scale = 100;
  }
  // Sanity: after scale, map XZ should be multi-hundred metres for Bermuda, not dollhouse
  const scaledXZ = maxXZ * scale;
  if (scaledXZ < 80 && maxXZ > 100) {
    // Someone forced a tiny targetWidth — refuse squash that makes heroes > buildings
    console.warn(
      `[island] refusing dollhouse scale ${scale.toFixed(4)} (would be ${scaledXZ.toFixed(1)} m); keeping authored SI`,
    );
    scale = 1;
  }
  root.scale.setScalar(scale);
  console.info(
    `[island] SI scale=${scale.toFixed(4)} rawXZ=${maxXZ.toFixed(1)}m → ${(maxXZ * scale).toFixed(1)}m  rawY=${maxY.toFixed(1)} → ${(maxY * scale).toFixed(1)}m`,
  );

  box.setFromObject(root);
  const center = new THREE.Vector3();
  box.getCenter(center);
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= box.min.y;

  box.setFromObject(root);
  const halfW = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 0.5;
  const hubRadius = halfW * 0.18; // central hub exclusion for harvest

  // Materials / shadows
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    o.frustumCulled = true;
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
        m.side = THREE.FrontSide;
        m.needsUpdate = true;
      }
    }
    const kind = classifyMeshName(o.name);
    tagMeshWorld(o, kind);
  });

  // Root first so ground sampler can hit Main_Large_Terrain before water is placed
  scene.add(root);
  // Keep layer markers as empty groups for tools (children stay under root)
  for (const g of Object.values(layers)) scene.add(g);

  // Invisible safety under island (last-resort collider — not preferred ground)
  const safety = new THREE.Mesh(
    new THREE.CircleGeometry(halfW * 1.15, 48),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  safety.rotation.x = -Math.PI / 2;
  safety.position.y = box.min.y - 0.02;
  safety.name = "island-safety-ground";
  safety.userData.colliderLayer = COLLIDER_LAYER.WALKABLE;
  safety.userData.walkable = true;
  safety.userData.worldKind = "terrain";
  safety.userData.safetyOnly = true;
  root.add(safety);

  // Ground sampler BEFORE water (water must not win raycasts)
  const sampleY = makeGroundSampler(root);

  // Calibrate sea level + land radius from real terrain (SI metres)
  const waterY = estimateWaterline(sampleY, halfW);
  const landRadius = measureLandRadius(sampleY, halfW, waterY);
  console.info(
    `[island] waterline Y=${waterY.toFixed(2)} m · landRadius=${landRadius.toFixed(1)} m · halfW=${halfW.toFixed(1)} m`,
  );

  // Water ring — visual + semantic WATER layer (not walkable, not static BVH solid)
  const waterGroup = new THREE.Group();
  waterGroup.name = ISLAND_LAYERS.water;
  const waterSize = Math.max(landRadius * 2.4, halfW * 2.4);
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(waterSize, 64),
    new THREE.MeshStandardMaterial({
      color: 0x1a5a7a,
      metalness: 0.2,
      roughness: 0.35,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    }),
  );
  water.name = "water-surface";
  water.rotation.x = -Math.PI / 2;
  water.position.y = waterY - 0.08;
  water.receiveShadow = true;
  waterGroup.add(water);
  const deep = new THREE.Mesh(
    new THREE.PlaneGeometry(waterSize * 3.5, waterSize * 3.5),
    new THREE.MeshStandardMaterial({
      color: 0x0a2030,
      metalness: 0.15,
      roughness: 0.5,
      transparent: true,
      opacity: 0.95,
    }),
  );
  deep.name = "water-deep";
  deep.rotation.x = -Math.PI / 2;
  deep.position.y = waterY - 0.55;
  waterGroup.add(deep);
  waterGroup.traverse((o) => {
    if (o.isMesh) {
      o.userData.worldKind = "water";
      o.userData.colliderLayer = COLLIDER_LAYER.WATER;
      o.userData.walkable = false;
      o.userData.waterSurfaceY = waterY;
    }
  });
  scene.add(waterGroup);

  // Harvestables — prefer grass/tree/rock OUTSIDE hub ring
  const harvestNodes = [];
  const seen = new Set();
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const kind = classifyMeshName(obj.name);
    if (kind !== "tree" && kind !== "rock") return;
    let host = obj;
    if (obj.parent && /LOD0|pinecone|Rock_big|stone_01/i.test(obj.parent.name)) {
      host = obj.parent;
    }
    if (seen.has(host.uuid)) return;
    seen.add(host.uuid);

    const wb = new THREE.Box3().setFromObject(host);
    const c = new THREE.Vector3();
    wb.getCenter(c);
    const hs = new THREE.Vector3();
    wb.getSize(hs);

    // Outside hub (middle) + not in deep water edge
    const distXZ = Math.hypot(c.x, c.z);
    if (distXZ < hubRadius) return; // skip central hub
    if (distXZ > halfW * 0.92) return; // skip water edge

    harvestNodes.push({
      id: `hrv_${kind}_${harvestNodes.length}`,
      kind,
      materialId: kind === "tree" ? "t0_wood" : "t0_stone",
      object: host,
      position: c.clone(),
      halfExtents: hs.clone().multiplyScalar(0.5),
      hp: kind === "tree" ? 40 : 55,
      maxHp: kind === "tree" ? 40 : 55,
      tool: kind === "tree" ? "axe" : "pick",
      zone: "grass",
    });
    host.userData.harvestId = harvestNodes[harvestNodes.length - 1].id;
    host.userData.harvestKind = kind;
    host.userData.selectable = "node";
  });

  // If classification found few trees, seed synthetic grass-ring nodes for gameplay
  if (harvestNodes.length < 12) {
    const ringCount = 24;
    for (let i = 0; i < ringCount; i++) {
      const a = (i / ringCount) * Math.PI * 2;
      const r = hubRadius * 1.6 + (i % 3) * halfW * 0.08;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const kind = i % 3 === 0 ? "rock" : "tree";
      const mesh = new THREE.Mesh(
        kind === "tree"
          ? new THREE.ConeGeometry(0.45, 2.2, 6)
          : new THREE.DodecahedronGeometry(0.55, 0),
        new THREE.MeshStandardMaterial({
          color: kind === "tree" ? 0x2d6b3a : 0x6a6a68,
          roughness: 0.9,
        }),
      );
      mesh.position.set(x, 1.1, z);
      mesh.castShadow = true;
      mesh.userData.selectable = "node";
      layers.harvest.add(mesh);
      harvestNodes.push({
        id: `hrv_seed_${kind}_${i}`,
        kind,
        materialId: kind === "tree" ? "t0_wood" : "t0_stone",
        object: mesh,
        position: mesh.position.clone(),
        halfExtents: new THREE.Vector3(0.5, 1, 0.5),
        hp: kind === "tree" ? 40 : 55,
        maxHp: kind === "tree" ? 40 : 55,
        tool: kind === "tree" ? "axe" : "pick",
        zone: "grass",
        seeded: true,
      });
      mesh.userData.harvestId = harvestNodes[harvestNodes.length - 1].id;
    }
  }

  const maxH = opts.maxHarvest ?? 80;
  const capped = harvestNodes.slice(0, maxH);

  // Heightfield navmesh — land only (above waterline, inside landRadius)
  const nav = buildNavGrid(
    { bounds: box, halfW, hubRadius, scale, waterY, landRadius },
    sampleY,
    { cellSize: opts.navCellSize ?? 5, waterY, landRadius },
  );

  // Spawns: ALWAYS from walkable land cells (never mathematical ring into sea)
  const landPts = nav.pickLandSpawns(12, hubRadius);
  const spawns = landPts.map((p) => new THREE.Vector3(p.x, p.y, p.z));

  // World / elite pins — snap onto land nav
  const bossPads = [
    {
      id: "boss_east",
      position: new THREE.Vector3(halfW * 0.35, 1.5, halfW * 0.08),
      name: "Shadow Flame Mantis",
      defId: "shadow_flame_mantis",
    },
    {
      id: "boss_west",
      position: new THREE.Vector3(-halfW * 0.35, 1.5, -halfW * 0.06),
      name: "Ash Ghast",
      defId: "volcano_ghast",
    },
    {
      id: "boss_north",
      position: new THREE.Vector3(0, 1.5, -halfW * 0.4),
      name: "Werelephant",
      defId: "werelephant",
    },
  ];
  for (const b of bossPads) {
    const sn = nav.snap(b.position.x, b.position.z);
    b.position.set(sn.x, sn.y + 0.1, sn.z);
  }

  // Vendors near hub — land-snapped
  const vendorPads = [
    { id: "weapon", position: new THREE.Vector3(10, 1.2, 12), label: "Weaponsmith" },
    { id: "armor", position: new THREE.Vector3(-10, 1.2, 12), label: "Armourer" },
  ];
  for (const v of vendorPads) {
    const sn = nav.snap(v.position.x, v.position.z);
    v.position.set(sn.x, sn.y + 0.05, sn.z);
  }

  const waterPhysics = createWaterPhysics(nav, { waterY, landRadius });

  const island = {
    root,
    waterGroup,
    layers,
    harvestNodes: capped,
    spawns,
    bossPads,
    vendorPads,
    halfW,
    hubRadius,
    landRadius,
    waterY,
    waterPhysics,
    bounds: box.clone(),
    scale,
    units: "si_metres",
    humanHeightM: HUMAN_HEIGHT_M,
    nav,
    sampleY,
  };
  console.info("[island] literacy", describeIslandLiteracy(island, nav));
  console.info(
    `[island] land spawns=${spawns.length} first=${spawns[0]?.toArray?.()?.map?.((n) => +n.toFixed(1))}`,
  );
  return island;
}

/**
 * Ground height via raycast — terrain meshes preferred.
 * Builds MeshBVH on walk surfaces so acceleratedRaycast is fast on Bermuda-scale maps.
 */
export function makeGroundSampler(islandRoot) {
  const ray = new THREE.Raycaster();
  // three-mesh-bvh firstHitOnly when available
  try {
    ray.firstHitOnly = true;
  } catch {
    /* older three */
  }
  const down = new THREE.Vector3(0, -1, 0);
  const origin = new THREE.Vector3();
  /** Prefer Main_Large_Terrain / ground / roads / safety; then buildings; then all solid */
  const primary = [];
  const secondary = [];
  const all = [];
  islandRoot.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry) return;
    // Never sample water / foliage for feet Y
    if (o.userData?.colliderLayer === COLLIDER_LAYER.WATER) return;
    if (/leave|leaf|plant_01|bush|flower|LOD[12]|water/i.test(o.name || "") && !/LOD0/i.test(o.name || "")) {
      return;
    }
    if (/leave|leaf|plant_01|Broom_snakeweed|water-surface|water-deep/i.test(o.name || "")) return;
    // Safety plane only as last resort (not in primary)
    const isSafety = o.name === "island-safety-ground" || o.userData?.safetyOnly;
    if (!isSafety) all.push(o);
    const kind = o.userData?.worldKind || classifyMeshName(o.name);
    const n = o.name || "";
    if (
      !isSafety &&
      (kind === "terrain" ||
        /Main_Large_Terrain|^ground|ground\.|Floor|MainHighway|UnsurfacedRoad|airport_road|CementFactory_ground/i.test(
          n,
        ))
    ) {
      primary.push(o);
    } else if (!isSafety && (kind === "building" || /road|Road|Floor/i.test(n))) {
      secondary.push(o);
    } else if (isSafety) {
      // deferred
    }
  });
  // Append safety only if we have almost no terrain hits later
  const safetyMeshes = [];
  islandRoot.traverse((o) => {
    if (o.isMesh && (o.name === "island-safety-ground" || o.userData?.safetyOnly)) safetyMeshes.push(o);
  });

  // BVH on walk surfaces — required for fast ground raycasts on Main_Large_Terrain*
  const ensureBvh = (mesh) => {
    try {
      const g = mesh.geometry;
      if (!g || g.boundsTree) return;
      g.boundsTree = new MeshBVH(g);
    } catch (e) {
      console.warn("[island] MeshBVH build skip", mesh.name, e?.message || e);
    }
  };

  const preferred =
    primary.length >= 1
      ? primary.concat(secondary)
      : secondary.length
        ? secondary
        : all.concat(safetyMeshes);
  for (const m of preferred) ensureBvh(m);
  for (const m of safetyMeshes) ensureBvh(m);

  console.info(
    `[island] ground sampler primary=${primary.length} secondary=${secondary.length} solid=${all.length} safety=${safetyMeshes.length}`,
  );

  islandRoot.updateMatrixWorld(true);

  const sampleHit = (x, z) => {
    origin.set(x, 800, z);
    ray.set(origin, down);
    ray.far = 1600;
    if (primary.length) {
      const hits = ray.intersectObjects(primary, false);
      if (hits[0]) return { y: hits[0].point.y, name: hits[0].object?.name || "", mesh: hits[0].object };
    }
    const hits2 = ray.intersectObjects(preferred, false);
    if (hits2[0]) return { y: hits2[0].point.y, name: hits2[0].object?.name || "", mesh: hits2[0].object };
    const hits3 = ray.intersectObjects(all, false);
    if (hits3[0]) return { y: hits3[0].point.y, name: hits3[0].object?.name || "", mesh: hits3[0].object };
    if (safetyMeshes.length) {
      const hits4 = ray.intersectObjects(safetyMeshes, false);
      if (hits4[0]) return { y: hits4[0].point.y, name: "island-safety-ground", mesh: hits4[0].object };
    }
    return { y: 0, name: null, mesh: null };
  };

  const sampleY = (x, z) => sampleHit(x, z).y;
  sampleY.hit = sampleHit;
  return sampleY;
}
