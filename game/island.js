/**
 * Bermuda Free Fire island: layered map + water ring + harvest classification.
 * Map binary lives on R2 CDN (GitHub 50 MB warning); local public/maps is dev fallback.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

const BASE = import.meta.env.BASE_URL || "/";

/** Production R2 CDN (assets.grudge-studio.com → grudge-assets bucket). */
export const MAP_CDN_URL = "https://assets.grudge-studio.com/models/maps/bermuda.glb";
/** Local/dev fallback when CDN unavailable. */
export const MAP_LOCAL_URL = BASE + "maps/bermuda.glb";
/** Preferred load URL: CDN first. */
export const MAP_URL = MAP_CDN_URL;

/** World SI: fit island ~120 m across for human 1.8 m */
export const ISLAND_TARGET_WIDTH_M = 120;

/**
 * Classify mesh for harvest / terrain.
 * @returns {'terrain'|'tree'|'rock'|'prop'|'water_edge'|null}
 */
export function classifyMeshName(name) {
  const n = String(name || "");
  if (/pinecone|Common_trunk|Common_leave|wood_trunk|plant_01/i.test(n) && !/wall|fence|house|power/i.test(n)) {
    return "tree";
  }
  if (/Rock_big|stone_01_A|stone_01_B/i.test(n) && !/ruined|house/i.test(n)) {
    return "rock";
  }
  if (/^ground|ground\.|Floor|terrain|CementFactory_ground/i.test(n)) {
    return "terrain";
  }
  return "prop";
}

async function loadIslandGltf(loader, preferredUrl) {
  const candidates = [preferredUrl, MAP_CDN_URL, MAP_LOCAL_URL].filter(
    (u, i, a) => u && a.indexOf(u) === i,
  );
  let lastErr;
  for (const url of candidates) {
    try {
      const gltf = await loader.loadAsync(url);
      console.info("[island] loaded", url);
      return { gltf, url };
    } catch (e) {
      lastErr = e;
      console.warn("[island] load fail", url, e?.message || e);
    }
  }
  throw lastErr || new Error("bermuda.glb load failed");
}

/**
 * Load Bermuda GLB, SI-scale, build water border, return harvest roots.
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

  // Compute bounds and SI scale
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxXZ = Math.max(size.x, size.z) || 1;
  const scale = (opts.targetWidth || ISLAND_TARGET_WIDTH_M) / maxXZ;
  root.scale.setScalar(scale);

  // Center on XZ, feet-ish on y=0
  box.setFromObject(root);
  const center = new THREE.Vector3();
  box.getCenter(center);
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= box.min.y;

  box.setFromObject(root);
  const halfW = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 0.5;

  // Water ring at borders (island)
  const waterGroup = new THREE.Group();
  waterGroup.name = "island-water";
  const waterSize = halfW * 2.6;
  const waterGeo = new THREE.CircleGeometry(waterSize, 64);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x1a5a7a,
    metalness: 0.2,
    roughness: 0.35,
    transparent: true,
    opacity: 0.92,
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = box.min.y - 0.15;
  water.receiveShadow = true;
  waterGroup.add(water);

  // Outer deep water plane
  const deep = new THREE.Mesh(
    new THREE.PlaneGeometry(waterSize * 4, waterSize * 4),
    new THREE.MeshStandardMaterial({ color: 0x0a2030, metalness: 0.15, roughness: 0.5 }),
  );
  deep.rotation.x = -Math.PI / 2;
  deep.position.y = box.min.y - 0.4;
  waterGroup.add(deep);

  scene.add(waterGroup);
  scene.add(root);

  // Harvestable nodes: group by parent LOD root when possible
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
    });
    host.userData.harvestId = harvestNodes[harvestNodes.length - 1].id;
    host.userData.harvestKind = kind;
  });

  const maxH = opts.maxHarvest ?? 80;
  const capped = harvestNodes.slice(0, maxH);

  const spawns = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = halfW * 0.22;
    spawns.push(new THREE.Vector3(Math.cos(a) * r, box.max.y * 0.05 + 1.2, Math.sin(a) * r));
  }

  const bossPads = [
    { id: "boss_east", position: new THREE.Vector3(halfW * 0.55, 1.5, 0), name: "East Colossus" },
    { id: "boss_west", position: new THREE.Vector3(-halfW * 0.55, 1.5, 0), name: "West Colossus" },
  ];

  const vendorPads = [
    { id: "armor", position: new THREE.Vector3(4, 1.2, 6), label: "Armourer" },
    { id: "weapon", position: new THREE.Vector3(-4, 1.2, 6), label: "Weaponsmith" },
  ];

  return {
    root,
    waterGroup,
    harvestNodes: capped,
    spawns,
    bossPads,
    vendorPads,
    halfW,
    bounds: box.clone(),
    scale,
  };
}

/** Simple ground height: raycast down onto terrain meshes */
export function makeGroundSampler(islandRoot) {
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const origin = new THREE.Vector3();
  const meshes = [];
  islandRoot.traverse((o) => {
    if (o.isMesh && classifyMeshName(o.name) === "terrain") meshes.push(o);
  });
  if (!meshes.length) {
    islandRoot.traverse((o) => {
      if (o.isMesh) meshes.push(o);
    });
  }
  return (x, z) => {
    origin.set(x, 200, z);
    ray.set(origin, down);
    const hits = ray.intersectObjects(meshes, true);
    if (hits[0]) return hits[0].point.y;
    return 0;
  };
}
