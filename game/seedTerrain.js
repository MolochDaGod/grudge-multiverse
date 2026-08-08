/**
 * Configurable seed terrain — practices from Simon's infinite terrain generator
 * https://discourse.threejs.org/t/configurable-infinite-terrain-generator/87001
 * https://simonstorlschulke.github.io/threejs-examples/?scene=0
 *
 * Multiverse: not infinite streaming — FBM pads on faction land discs (5 km seed).
 * Hub keeps Bermuda mesh; procedural tiles fill outer discs + island skirts.
 *
 * SI metres. Deterministic from world seed.
 */
import * as THREE from "three";
import { COLLIDER_LAYER } from "./mapLiteracy.js";
import {
  sampleBiome,
  biomeTerrainColor,
  assignIslandBiomes,
} from "./biomeSsot.js";

/** Default args (Simon-style knobs, SI-scaled). */
export const TERRAIN_DEFAULTS = {
  gain: 0.5,
  lacunarity: 2.0,
  frequency: 0.0045,
  amplitude: 1,
  altitude: 0.15,
  falloff: 0.55,
  erosion: 0.65,
  erosionSoftness: 0.35,
  rivers: 0.45,
  riversFrequency: 1.4,
  riverWidth: 0.55,
  riverFalloff: 0.6,
  smoothLowerPlanes: 0.4,
  octaves: 5,
  /** Peak height above water on island centre (m) — walkable hills, not cliffs */
  peakM: 14,
  /** Mesh resolution per disc (segments) */
  resolution: 72,
  /** Flatten near shore for landings / boats / nav */
  shoreFlatM: 1.4,
};

function hash2(x, z, seed) {
  let n = Math.sin(x * 127.1 + z * 311.7 + seed * 0.001) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x, z, seed) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi, seed);
  const b = hash2(xi + 1, zi, seed);
  const c = hash2(xi, zi + 1, seed);
  const d = hash2(xi + 1, zi + 1, seed);
  return (
    a * (1 - u) * (1 - v) +
    b * u * (1 - v) +
    c * (1 - u) * v +
    d * u * v
  );
}

/** Fractional Brownian motion (Simon FbmNoiseBuilder spirit). */
export function fbm2(x, z, opts) {
  const {
    octaves = 5,
    lacunarity = 2,
    gain = 0.5,
    frequency = 0.01,
    amplitude = 1,
    seed = 1,
    offset = 0,
  } = opts;
  let amp = amplitude;
  let freq = frequency;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += (smoothNoise(x * freq, z * freq, seed + i * 17) * 2 - 1 + offset) * amp;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return norm > 0 ? sum / norm : 0;
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}
function smoothstep(e0, e1, x) {
  const t = clamp01((x - e0) / Math.max(1e-6, e1 - e0));
  return t * t * (3 - 2 * t);
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function pingpong(t, l = 1) {
  const m = Math.abs(t) % (l * 2);
  return m < l ? m : l * 2 - m;
}

/**
 * Height at world XZ relative to waterY (returns absolute Y).
 * @param {number} x
 * @param {number} z
 * @param {number} seedU32
 * @param {object} disc {x,z,r}
 * @param {number} waterY
 * @param {Partial<typeof TERRAIN_DEFAULTS>} [args]
 */
export function sampleSeedTerrainHeight(x, z, seedU32, disc, waterY, args = {}) {
  const a = { ...TERRAIN_DEFAULTS, ...args };
  const lx = x - disc.x;
  const lz = z - disc.z;
  const dist = Math.hypot(lx, lz);
  const edge = clamp01(1 - dist / Math.max(1, disc.r));
  if (edge <= 0) return waterY;

  const sx = x;
  const sz = z;
  let terrainNoise = fbm2(sx, sz, {
    octaves: a.octaves,
    lacunarity: a.lacunarity,
    gain: a.gain,
    frequency: a.frequency,
    amplitude: a.amplitude,
    seed: seedU32,
    offset: 0.25,
  });

  const erosionNoise =
    fbm2(sx + 500, sz + 500, {
      octaves: 1,
      frequency: 0.012,
      seed: seedU32 + 4,
    }) *
      0.6 -
    0.1;
  const erosionSoftness = erosionNoise + a.erosionSoftness;
  let erosion = fbm2(sx, sz, {
    octaves: 3,
    lacunarity: 1.8,
    seed: seedU32 + 1,
    offset: 0.3,
    amplitude: 0.2,
    frequency: a.frequency,
  });
  erosion = smoothstep(0, 1, erosion);
  erosion = Math.pow(erosion, 1 + Math.max(0, erosionSoftness));
  erosion = clamp01(pingpong(erosion * 2, 1) - 0.3);
  terrainNoise *= lerp(1, erosion, a.erosion * Math.max(0, terrainNoise));

  let rivers = (Math.abs(
    fbm2(sx, sz, {
      octaves: 4,
      gain: 0.35,
      lacunarity: 2,
      seed: seedU32 + 9,
      amplitude: 0.2,
      frequency: a.frequency * a.riversFrequency,
    }),
  ) -
    0.5) *
    2;
  rivers = pingpong(rivers, 0.5);
  const riverWidth = lerp(0.5, 0.44, a.riverWidth);
  const riverFalloff = a.riverFalloff * 0.3;
  rivers = clamp01(
    (rivers - riverWidth) / Math.max(1e-4, riverFalloff),
  );
  // invert: river channels low
  rivers = 1 - smoothstep(0, 1, rivers);
  rivers *= 0.5;

  const altitudeNoise =
    fbm2(sx, sz, { octaves: 1, frequency: 0.012, seed: seedU32 + 4 }) * 1.4 -
    0.75;
  const altitude = a.altitude + altitudeNoise * 0.15;
  terrainNoise = terrainNoise + altitude;
  const n2 = terrainNoise * terrainNoise;
  const n3 = n2 * terrainNoise;
  terrainNoise = lerp(n2, n3, a.smoothLowerPlanes);

  // Map noise to SI height; island dome falloff at disc edge
  let h =
    waterY +
    a.shoreFlatM +
    Math.max(0, terrainNoise) * a.peakM * Math.pow(edge, 1.05) -
    rivers * a.rivers * a.peakM * 0.28 * edge;

  // Soft shore ring — keep walkable beach for nav (player-ready)
  if (edge < 0.18) {
    h = lerp(waterY + 0.4, h, edge / 0.18);
  }

  return Math.max(waterY + 0.08, h);
}

/**
 * Slope/height stylized material (SeedThree terrain-material spirit — toon bands).
 */
export function makeStylizedTerrainMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x4a7a3a,
    roughness: 0.92,
    metalness: 0.02,
    flatShading: false,
    vertexColors: true,
  });
}

function heightColor(y, waterY, peak) {
  const t = clamp01((y - waterY) / Math.max(1, peak));
  const c = new THREE.Color();
  if (t < 0.12) c.setHex(0xc2b280); // sand
  else if (t < 0.45) c.setHex(0x3d7a38); // grass
  else if (t < 0.75) c.setHex(0x5a6a48); // scrub
  else c.setHex(0x8a8a88); // rock
  return c;
}

/**
 * Build a disc terrain mesh (Simon plane displace, SI) tinted by **island biome**.
 * @returns {{ mesh: THREE.Mesh, sampleY: (x:number,z:number)=>number }}
 */
export function createDiscTerrainMesh(disc, seedU32, waterY, args = {}) {
  const biome = args.biome || null;
  const peakScale = biome?.peakScale ?? 1;
  const a = {
    ...TERRAIN_DEFAULTS,
    ...args,
    peakM: (args.peakM || TERRAIN_DEFAULTS.peakM) * peakScale,
  };
  // Volcanic / Hellmaw: sharper peaks, less river
  if (biome?.archetype === "volcanic" || biome?.id === "hellmaw") {
    a.rivers = 0.15;
    a.erosion = 0.75;
    a.peakM = Math.max(a.peakM, 18);
  }
  // End of Path / mist: flatter, wetter
  if (biome?.id === "end_of_path" || biome?.waterBias) {
    a.rivers = 0.55;
    a.peakM *= 0.85;
    a.shoreFlatM = 1.8;
  }
  const res = a.resolution;
  const diameter = disc.r * 2;
  const geo = new THREE.PlaneGeometry(diameter, diameter, res, res);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const islands = args.islands || null;

  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const lz = pos.getZ(i);
    const wx = disc.x + lx;
    const wz = disc.z + lz;
    const d = Math.hypot(lx, lz);
    let y = waterY;
    if (d <= disc.r * 1.001) {
      y = sampleSeedTerrainHeight(wx, wz, seedU32, disc, waterY, a);
    } else {
      y = waterY - 2;
    }
    pos.setY(i, y);
    const b =
      biome ||
      (islands
        ? sampleBiome(wx, wz, { seedU32, islands })
        : null);
    if (b && b.id !== "ocean") {
      const c = biomeTerrainColor(b, y, waterY, a.peakM);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    } else {
      heightColor(y, waterY, a.peakM).toArray(colors, i * 3);
    }
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, makeStylizedTerrainMaterial());
  mesh.position.set(0, 0, 0);
  const bid = biome?.id || "island";
  mesh.name = `seed-terrain-${bid}-${disc.x.toFixed(0)}_${disc.z.toFixed(0)}`;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.userData.worldKind = "terrain";
  mesh.userData.colliderLayer = COLLIDER_LAYER.WALKABLE;
  mesh.userData.walkable = true;
  mesh.userData.seedTerrain = true;
  mesh.userData.biomeId = bid;
  mesh.userData.archetype = biome?.archetype || null;

  const sampleY = (x, z) => sampleSeedTerrainHeight(x, z, seedU32, disc, waterY, a);
  return { mesh, sampleY, disc, biome };
}

/**
 * Mount procedural terrains for non-hub discs (and optional hub skirt).
 * @param {THREE.Scene} scene
 * @param {object} island
 * @param {{ seed?: string|number, world?: object, includeHub?: boolean }} opts
 */
export function mountSeedTerrains(scene, island, opts = {}) {
  const seedLabel = String(opts.seed || "VALHEIM42");
  let seedU32 = 0;
  for (let i = 0; i < seedLabel.length; i++) {
    seedU32 = (Math.imul(seedU32 ^ seedLabel.charCodeAt(i), 16777619) >>> 0);
  }
  const waterY = island.waterY ?? 0.25;
  const root = new THREE.Group();
  root.name = "seed-terrains";
  scene.add(root);

  const discs = island.landDiscs || [];
  const meshLandR = island.meshLandRadius || 0;
  const samplers = [];
  const meshes = [];

  // Island biomes from world zones or assign by compass (sector map)
  let islandBiomes =
    opts.world?.biomes?.islands ||
    opts.islands ||
    null;
  if (!islandBiomes?.length) {
    const forAssign = discs.map((d, i) => ({
      ...d,
      kind: i === 0 && Math.hypot(d.x, d.z) < 80 ? "hub" : "territory",
      faction: d.faction || null,
    }));
    // Prefer zone stamps from seed gen
    if (opts.world?.zones?.length) {
      islandBiomes = opts.world.zones
        .filter((z) => z.x != null && z.radius)
        .map((z) => ({
          x: z.x,
          z: z.z,
          r: z.radius,
          kind: z.kind,
          faction: z.faction,
          biomeId: z.biomeId,
          archetype: z.archetype,
          name: z.biomeName || z.name,
          sectorHint: z.sectorHint,
          allowWorldBoss: z.allowWorldBoss,
        }));
      // Fill missing biomeIds
      const assigned = assignIslandBiomes(forAssign, seedU32);
      for (const ib of islandBiomes) {
        if (!ib.biomeId) {
          const a = assigned.find(
            (x) => Math.hypot(x.x - ib.x, x.z - ib.z) < 50,
          );
          if (a) Object.assign(ib, a);
        }
      }
    } else {
      islandBiomes = assignIslandBiomes(forAssign, seedU32);
    }
  }

  for (const disc of discs) {
    const isHub = Math.hypot(disc.x, disc.z) < 40;
    // Skip full hub mesh replace — Bermuda owns centre (Ethereal Falls shell)
    if (isHub && !opts.includeHub) continue;
    if (isHub) continue;

    const stamp =
      islandBiomes.find(
        (i) => Math.hypot(i.x - disc.x, i.z - disc.z) < 80,
      ) || null;
    const biome = stamp
      ? sampleBiome(disc.x, disc.z, { seedU32, islands: islandBiomes })
      : null;

    const { mesh, sampleY } = createDiscTerrainMesh(disc, seedU32, waterY, {
      peakM: 12 + (seedU32 % 6),
      frequency: 0.0035 + (seedU32 % 5) * 0.00015,
      erosion: 0.5,
      rivers: 0.35,
      biome,
      islands: islandBiomes,
    });
    root.add(mesh);
    meshes.push(mesh);
    samplers.push({ disc, sampleY, biomeId: biome?.id });
  }

  island.seedTerrains = {
    root,
    meshes,
    samplers,
    seedU32,
    islands: islandBiomes,
  };
  island.islandBiomes = islandBiomes;

  // Compose sampleY: Bermuda hub → FBM discs → sea
  const meshSample = island.sampleY;
  const prevSample = meshSample;
  island.sampleY = (x, z) => {
    const d0 = Math.hypot(x, z);
    if (d0 <= meshLandR * 1.02 && prevSample) {
      try {
        const y = prevSample(x, z);
        if (Number.isFinite(y) && y > waterY + 0.15) return y;
      } catch {
        /* */
      }
    }
    for (const s of samplers) {
      if (Math.hypot(x - s.disc.x, z - s.disc.z) <= s.disc.r) {
        return s.sampleY(x, z);
      }
    }
    // soft shore outside mesh but near hub disc
    for (const disc of discs) {
      if (Math.hypot(x - disc.x, z - disc.z) <= disc.r) {
        return sampleSeedTerrainHeight(x, z, seedU32, disc, waterY);
      }
    }
    return waterY;
  };

  console.info(
    `[seedTerrain] FBM discs=${samplers.length} seed=${seedLabel} (Simon-style erosion/rivers)`,
  );
  return island.seedTerrains;
}
