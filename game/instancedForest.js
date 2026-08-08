/**
 * Procedural instanced forest — port of discourse three.js demo
 * https://discourse.threejs.org/t/procedural-instanced-forest-high-performance-real-trees/88610
 *
 * SI metres. Instanced bark + leaves, LOD leaf fade, optional per-tree culling.
 * Multiverse: place on land discs; harvest uses proxy nodes (hide tree on break).
 */
import * as THREE from "three";

/** Default forest structure (SI-ish trunks 4–9 m before type scale). */
export const FOREST_CONFIG = {
  TREE_COUNT: 400,
  FOREST_RADIUS: 80,
  CLEAR_RADIUS: 8,
  CUSTOM_TREE_CULLING: true,

  TRUNK_LENGTH_MIN: 4.2,
  TRUNK_LENGTH_MAX: 7.5,
  TRUNK_RADIUS_MIN: 0.18,
  TRUNK_RADIUS_MAX: 0.38,
  BRANCH_LEVELS: 4,
  BRANCH_ANGLE: 0.55,
  BRANCH_ANGLE_VARIANCE: 0.25,
  LENGTH_FALLOFF: 0.68,
  RADIUS_FALLOFF: 0.55,
  BRANCHES_PER_NODE: 3,
  TWIST: 0.5,

  LEAF_SIZE: 0.85,
  LEAF_DENSITY: 4,
  LEAF_SPREAD: 0.85,

  BARK_COLOR: [0.24, 0.16, 0.09],
  BARK_DISTANT_TINT: [0.29, 0.52, 0.27],
  LEAF_HUE_MIN: 0.25,
  LEAF_HUE_MAX: 0.35,
  LEAF_SATURATION: 0.55,
  LEAF_LIGHTNESS_MIN: 0.35,
  LEAF_LIGHTNESS_MAX: 0.5,
  LEAF_TINGE_PERCENT: 0.15,
  LEAF_TINGE_YELLOW_CHANCE: 0.5,
  LEAF_TINGE_HUE_SHIFT: 0.03,
  LEAF_TINGE_SAT_SHIFT: 0.28,
  LEAF_TINGE_LIGHT_SHIFT: 0.09,

  LOD_FADE_START: 180,
  LOD_MAX_DISTANCE: 420,
  LOD_SWAY_DISTANCE: 60,
  LOD_SWAY_FADE_START: 35,

  ROOT_SPREAD_MIN: 0.2,
  ROOT_SPREAD_MAX: 0.6,
  ROOT_HEIGHT_MIN: 0.3,
  ROOT_HEIGHT_MAX: 0.6,
  ROOT_BUMPS_MIN: 2,
  ROOT_BUMPS_MAX: 5,

  BARK_SEGMENTS: 8,
};

const TREE_TYPES = [
  { levels: 4, branchAngle: 0.5, lengthFalloff: 0.7, radiusFalloff: 0.55, branches: 3 },
  { levels: 5, branchAngle: 0.4, lengthFalloff: 0.65, radiusFalloff: 0.5, branches: 2 },
  { levels: 4, branchAngle: 0.65, lengthFalloff: 0.72, radiusFalloff: 0.6, branches: 4 },
  { levels: 3, branchAngle: 0.55, lengthFalloff: 0.75, radiusFalloff: 0.58, branches: 3 },
  { levels: 4, branchAngle: 0.48, lengthFalloff: 0.68, radiusFalloff: 0.52, branches: 3 },
];

export function createLeafTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);

  function leafPath(c) {
    const s = size;
    c.beginPath();
    c.moveTo(s * 0.5, s * 0.03);
    c.bezierCurveTo(s * 0.78, s * 0.18, s * 0.82, s * 0.65, s * 0.5, s * 0.97);
    c.bezierCurveTo(s * 0.18, s * 0.65, s * 0.22, s * 0.18, s * 0.5, s * 0.03);
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0, "#6ab560");
  gradient.addColorStop(0.3, "#5aa052");
  gradient.addColorStop(0.7, "#4a9045");
  gradient.addColorStop(1, "#3d8038");
  leafPath(ctx);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.globalCompositeOperation = "overlay";
  for (let i = 0; i < 600; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const brightness = Math.random() * 40 - 20;
    ctx.fillStyle = `rgba(${128 + brightness},${128 + brightness},${128 + brightness},0.04)`;
    ctx.fillRect(x, y, 3, 3);
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.save();
  leafPath(ctx);
  ctx.clip();
  ctx.strokeStyle = "rgba(35,60,30,0.18)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(size * 0.5, size * 0.08);
  ctx.quadraticCurveTo(size * 0.5, size * 0.5, size * 0.5, size * 0.92);
  ctx.stroke();
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

export function createBarkTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#3d2818";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const g = 40 + Math.random() * 50;
    ctx.fillStyle = `rgba(${g * 0.7},${g * 0.45},${g * 0.25},${0.08 + Math.random() * 0.12})`;
    ctx.fillRect(x, y, 2 + Math.random() * 4, 6 + Math.random() * 18);
  }
  for (let x = 0; x < size; x += 8) {
    ctx.strokeStyle = `rgba(20,12,6,${0.15 + Math.random() * 0.2})`;
    ctx.beginPath();
    ctx.moveTo(x + Math.random() * 4, 0);
    ctx.lineTo(x + Math.random() * 4, size);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

/**
 * @typedef {{ x: number, z: number, y?: number, scale?: number, typeIndex?: number, seed?: number }} TreePlacement
 */

export class InstancedForest {
  /**
   * @param {Partial<typeof FOREST_CONFIG>} [options]
   */
  constructor(options = {}) {
    this.cfg = { ...FOREST_CONFIG, ...options };
    this.branchMatrices = [];
    this.branchTreeIds = [];
    this.leafMatrices = [];
    this.leafTreeIds = [];
    this.leafColors = [];
    this.leafRandoms = [];
    this.leafWobbleX = [];
    this.leafWobbleY = [];
    this.leafSwayPhase = [];
    this.treeBounds = [];
    this.treePlacements = [];
    this.treeBranchRanges = [];
    this.treeLeafRanges = [];
    this.group = new THREE.Group();
    this.group.name = "instanced-forest";
    this.meshes = {};
    this.leafMat = null;
    this.barkMat = null;
    this.visibleTreeCount = 0;
    this._lastCamPos = new THREE.Vector3();
    this._frustum = new THREE.Frustum();
    this._projScreenMatrix = new THREE.Matrix4();
    this._matrix = new THREE.Matrix4();
    this._quaternion = new THREE.Quaternion();
    this._scale = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._color = new THREE.Color();
    this._leafGeo = new THREE.PlaneGeometry(1, 1);
    this._leafGeo.computeBoundingBox();
    this._leafBottomY = this._leafGeo.boundingBox.min.y;
    this._hiddenTrees = new Set();
  }

  _mulberry32(seed) {
    return () => {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * @param {TreePlacement[]} placements world XZ (+ optional y ground)
   * @param {THREE.Texture} leafTexture
   * @param {THREE.Texture} barkTexture
   */
  generateFromPlacements(placements, leafTexture, barkTexture) {
    this.branchMatrices = [];
    this.branchTreeIds = [];
    this.leafMatrices = [];
    this.leafTreeIds = [];
    this.leafColors = [];
    this.leafRandoms = [];
    this.leafWobbleX = [];
    this.leafWobbleY = [];
    this.leafSwayPhase = [];
    this.treeBounds = [];
    this.treePlacements = [];
    this.treeBranchRanges = [];
    this.treeLeafRanges = [];
    this._hiddenTrees.clear();

    const cfg = this.cfg;
    for (let i = 0; i < placements.length; i++) {
      const p = placements[i];
      const rand = this._mulberry32((p.seed ?? i * 54321 + 11111) >>> 0);
      const typeIndex =
        p.typeIndex != null
          ? p.typeIndex % TREE_TYPES.length
          : Math.floor(rand() * TREE_TYPES.length);
      const treeType = TREE_TYPES[typeIndex];
      const treeScale = p.scale ?? 0.65 + rand() * 0.75;
      const leafHue =
        cfg.LEAF_HUE_MIN + rand() * (cfg.LEAF_HUE_MAX - cfg.LEAF_HUE_MIN);
      const leafLightness =
        cfg.LEAF_LIGHTNESS_MIN +
        rand() * (cfg.LEAF_LIGHTNESS_MAX - cfg.LEAF_LIGHTNESS_MIN);
      const trunkLength =
        (cfg.TRUNK_LENGTH_MIN +
          rand() * (cfg.TRUNK_LENGTH_MAX - cfg.TRUNK_LENGTH_MIN)) *
        treeScale;
      const trunkRadius =
        (cfg.TRUNK_RADIUS_MIN +
          rand() * (cfg.TRUNK_RADIUS_MAX - cfg.TRUNK_RADIUS_MIN)) *
        treeScale;
      const treeRotation = rand() * Math.PI * 2;
      const gy = p.y ?? 0;

      this.treePlacements.push({
        x: p.x,
        z: p.z,
        y: gy,
        scale: treeScale,
        typeIndex,
        height: trunkLength * (1 + treeType.lengthFalloff),
      });

      this._generateTree(
        i,
        p.x,
        gy,
        p.z,
        treeRotation,
        treeScale,
        leafHue,
        leafLightness,
        trunkLength,
        trunkRadius,
        treeType,
        rand,
      );
    }

    this._buildMeshes(leafTexture, barkTexture);
    return {
      group: this.group,
      stats: {
        trees: placements.length,
        branches: this.branchMatrices.length,
        leaves: this.leafMatrices.length,
      },
    };
  }

  /**
   * Disc scatter (demo API).
   */
  generate(leafTexture, barkTexture) {
    const cfg = this.cfg;
    const placements = [];
    for (let i = 0; i < cfg.TREE_COUNT; i++) {
      const rand = this._mulberry32(i * 54321 + 11111);
      const r = cfg.CLEAR_RADIUS + Math.sqrt(rand()) * cfg.FOREST_RADIUS;
      const theta = rand() * Math.PI * 2;
      placements.push({
        x: Math.cos(theta) * r,
        z: Math.sin(theta) * r,
        y: 0,
        seed: i * 54321 + 11111,
      });
    }
    return this.generateFromPlacements(placements, leafTexture, barkTexture);
  }

  _generateTree(
    treeIndex,
    x,
    y,
    z,
    rotation,
    scale,
    leafHue,
    leafLightness,
    trunkLength,
    trunkRadius,
    treeType,
    rand,
  ) {
    const origin = new THREE.Vector3(x, y, z);
    const direction = new THREE.Vector3(0, 1, 0);
    direction.x += (rand() - 0.5) * 0.12;
    direction.z += (rand() - 0.5) * 0.12;
    direction.normalize();

    const estimatedHeight =
      trunkLength *
      (1 +
        treeType.lengthFalloff +
        treeType.lengthFalloff * treeType.lengthFalloff);
    const sphereRadius = Math.max(estimatedHeight * 0.6, trunkLength) * scale;
    const sphereCenter = new THREE.Vector3(x, y + estimatedHeight * 0.45, z);
    this.treeBounds.push({
      sphere: new THREE.Sphere(sphereCenter, sphereRadius),
      center: sphereCenter,
    });

    this._branch(
      origin,
      direction,
      trunkLength,
      trunkRadius,
      0,
      rotation,
      scale,
      leafHue,
      leafLightness,
      treeType,
      treeIndex,
      rand,
    );
  }

  _branch(
    start,
    direction,
    length,
    radius,
    level,
    treeRotation,
    treeScale,
    leafHue,
    leafLightness,
    treeType,
    treeIndex,
    rand,
  ) {
    const cfg = this.cfg;
    if (level > treeType.levels || radius < 0.012) return;

    const end = start.clone().addScaledVector(direction, length);
    const mid = start.clone().lerp(end, 0.5);
    this._quaternion.setFromUnitVectors(this._up, direction.clone().normalize());
    const topRadius = radius * treeType.radiusFalloff;
    const avgRadius = (radius + topRadius) * 0.5;
    this._scale.set(avgRadius, length, avgRadius);
    this._matrix.compose(mid, this._quaternion, this._scale);
    this.branchMatrices.push(this._matrix.clone());
    this.branchTreeIds.push(treeIndex);

    if (level >= treeType.levels - 1) {
      this._addLeaves(
        end,
        direction,
        treeScale,
        leafHue,
        leafLightness,
        rand,
        topRadius,
        level,
        treeType.levels,
        treeIndex,
      );
    }

    if (level < treeType.levels) {
      const numChildren =
        level === 0
          ? treeType.branches + Math.floor(rand() * 2)
          : Math.max(1, treeType.branches - Math.floor(level * 0.3));

      for (let i = 0; i < numChildren; i++) {
        const twistAngle =
          (i / numChildren) * Math.PI * 2 +
          rand() * cfg.TWIST +
          treeRotation;
        const bendAngle =
          treeType.branchAngle +
          (rand() - 0.5) * cfg.BRANCH_ANGLE_VARIANCE * 2;

        const perp = new THREE.Vector3(1, 0, 0);
        if (Math.abs(direction.y) < 0.9) {
          perp.crossVectors(this._up, direction).normalize();
        } else {
          perp.crossVectors(new THREE.Vector3(0, 0, 1), direction).normalize();
        }

        const childDir = direction.clone();
        childDir.applyAxisAngle(perp, bendAngle);
        childDir.applyAxisAngle(direction, twistAngle);
        childDir.normalize();

        const startT = 0.4 + rand() * 0.5;
        const childStart = start.clone().lerp(end, startT);
        const childLength =
          length * treeType.lengthFalloff * (0.8 + rand() * 0.4);
        const childRadius = radius * treeType.radiusFalloff;

        this._branch(
          childStart,
          childDir,
          childLength,
          childRadius,
          level + 1,
          treeRotation,
          treeScale,
          leafHue,
          leafLightness,
          treeType,
          treeIndex,
          rand,
        );
      }
    }
  }

  _addLeaves(
    branchEnd,
    branchDir,
    treeScale,
    leafHue,
    leafLightness,
    rand,
    topRadius,
    level,
    maxLevel,
    treeIndex,
  ) {
    const cfg = this.cfg;
    const count = cfg.LEAF_DENSITY + Math.floor(rand() * 3);
    const size = cfg.LEAF_SIZE * treeScale;

    const perp1 = new THREE.Vector3(1, 0, 0);
    if (Math.abs(branchDir.y) > 0.9) perp1.set(0, 0, 1);
    perp1.crossVectors(branchDir, perp1).normalize();
    const perp2 = new THREE.Vector3().crossVectors(branchDir, perp1).normalize();

    for (let i = 0; i < count; i++) {
      const aroundAngle = rand() * Math.PI * 2;
      const outward = new THREE.Vector3()
        .addScaledVector(perp1, Math.cos(aroundAngle))
        .addScaledVector(perp2, Math.sin(aroundAngle))
        .normalize();

      const attachPoint = branchEnd
        .clone()
        .addScaledVector(outward, topRadius);

      const stemDir = new THREE.Vector3()
        .addScaledVector(outward, 0.5 + rand() * 0.3)
        .addScaledVector(branchDir, 0.3 + rand() * 0.4)
        .add(new THREE.Vector3(0, 0.2 + rand() * 0.3, 0))
        .normalize();

      const leafUp = stemDir.clone();
      let leafNormal = new THREE.Vector3(0, 1, 0).addScaledVector(
        outward,
        (rand() - 0.5) * 0.5,
      );
      leafNormal
        .sub(leafUp.clone().multiplyScalar(leafNormal.dot(leafUp)))
        .normalize();
      if (leafNormal.lengthSq() < 0.1) {
        leafNormal.copy(outward);
        leafNormal
          .sub(leafUp.clone().multiplyScalar(leafNormal.dot(leafUp)))
          .normalize();
      }

      const leafRight = new THREE.Vector3()
        .crossVectors(leafUp, leafNormal)
        .normalize();
      leafNormal.crossVectors(leafRight, leafUp).normalize();

      const rotMatrix = new THREE.Matrix4();
      rotMatrix.makeBasis(leafRight, leafUp, leafNormal);
      const jitterQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          (rand() - 0.5) * 0.3,
          (rand() - 0.5) * 0.3,
          (rand() - 0.5) * 0.2,
        ),
      );
      const leafQuat = new THREE.Quaternion().setFromRotationMatrix(rotMatrix);
      leafQuat.multiply(jitterQuat);

      const localBottom = new THREE.Vector3(0, this._leafBottomY, 0);
      const rotatedBottom = localBottom.clone().applyQuaternion(leafQuat);
      const taperFactor = 0.8 + 0.2 * (1 - level / Math.max(1, maxLevel));
      const leafScale = size * (0.5 + rand() * 0.5) * taperFactor;
      const leafPos = attachPoint
        .clone()
        .sub(rotatedBottom.clone().multiplyScalar(leafScale));

      this._scale.set(leafScale, leafScale, leafScale);
      this._matrix.compose(leafPos, leafQuat, this._scale);
      this.leafMatrices.push(this._matrix.clone());
      this.leafTreeIds.push(treeIndex);

      let h = leafHue + (rand() - 0.5) * 0.05;
      let s = cfg.LEAF_SATURATION + rand() * 0.15;
      let l = leafLightness + (rand() - 0.5) * 0.08;
      if (rand() < cfg.LEAF_TINGE_PERCENT) {
        if (rand() < cfg.LEAF_TINGE_YELLOW_CHANCE) {
          h += cfg.LEAF_TINGE_HUE_SHIFT;
          l = Math.min(1.0, l + cfg.LEAF_TINGE_LIGHT_SHIFT);
        } else {
          s = Math.max(0.0, s - cfg.LEAF_TINGE_SAT_SHIFT);
          l = Math.max(0.0, l - cfg.LEAF_TINGE_LIGHT_SHIFT);
        }
      }
      this._color.setHSL(h, s, l);
      this.leafColors.push(this._color.r, this._color.g, this._color.b);
      this.leafRandoms.push(rand());
      this.leafWobbleX.push((rand() - 0.5) * 0.12);
      this.leafWobbleY.push((rand() - 0.5) * 0.12);
      this.leafSwayPhase.push(rand() * Math.PI * 2.0);
    }
  }

  _buildTreeRanges() {
    const nTrees = this.treeBounds.length;
    this.treeBranchRanges = Array.from({ length: nTrees }, () => ({
      start: 0,
      count: 0,
    }));
    this.treeLeafRanges = Array.from({ length: nTrees }, () => ({
      start: 0,
      count: 0,
    }));

    // Branches are generated tree-by-tree contiguously
    let bStart = 0;
    for (let t = 0; t < nTrees; t++) {
      let c = 0;
      while (
        bStart + c < this.branchTreeIds.length &&
        this.branchTreeIds[bStart + c] === t
      ) {
        c++;
      }
      this.treeBranchRanges[t] = { start: bStart, count: c };
      bStart += c;
    }
    let lStart = 0;
    for (let t = 0; t < nTrees; t++) {
      let c = 0;
      while (
        lStart + c < this.leafTreeIds.length &&
        this.leafTreeIds[lStart + c] === t
      ) {
        c++;
      }
      this.treeLeafRanges[t] = { start: lStart, count: c };
      lStart += c;
    }
  }

  _buildMeshes(leafTexture, barkTexture) {
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      child.geometry?.dispose?.();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose?.();
      }
      this.group.remove(child);
    }
    this.meshes = {};
    this._buildTreeRanges();
    const cfg = this.cfg;

    if (this.branchMatrices.length > 0) {
      const barkGeo = new THREE.CylinderGeometry(1, 1, 1, cfg.BARK_SEGMENTS, 1);
      const barkMat = new THREE.ShaderMaterial({
        uniforms: {
          barkTexture: { value: barkTexture },
          barkColor: { value: new THREE.Color(...cfg.BARK_COLOR) },
          leafTintColor: { value: new THREE.Color(...cfg.BARK_DISTANT_TINT) },
          leafFadeStart: { value: cfg.LOD_FADE_START },
          maxLeafDistance: { value: cfg.LOD_MAX_DISTANCE },
          rootSpreadMin: { value: cfg.ROOT_SPREAD_MIN },
          rootSpreadMax: { value: cfg.ROOT_SPREAD_MAX },
          rootHeightMin: { value: cfg.ROOT_HEIGHT_MIN },
          rootHeightMax: { value: cfg.ROOT_HEIGHT_MAX },
          rootBumpsMin: { value: cfg.ROOT_BUMPS_MIN },
          rootBumpsMax: { value: cfg.ROOT_BUMPS_MAX },
        },
        vertexShader: /* glsl */ `
          uniform float leafFadeStart;
          uniform float maxLeafDistance;
          uniform float rootSpreadMin;
          uniform float rootSpreadMax;
          uniform float rootHeightMin;
          uniform float rootHeightMax;
          uniform float rootBumpsMin;
          uniform float rootBumpsMax;
          varying vec3 vNormal;
          varying vec3 vWorldPosition;
          varying float vLeafTint;
          varying vec2 vUv;
          varying float vTreeRand;
          void main() {
            vec3 pos = position;
            vec4 worldPos = instanceMatrix * vec4(pos, 1.0);
            vec4 instanceCenter = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            float treeRand1 = fract(sin(instanceCenter.x * 12.9898 + instanceCenter.z * 78.233) * 43758.5453);
            float treeRand2 = fract(sin(instanceCenter.x * 63.7264 + instanceCenter.z * 10.873) * 43758.5453);
            float treeRand3 = fract(sin(instanceCenter.x * 36.1734 + instanceCenter.z * 91.147) * 43758.5453);
            float rootSpread = mix(rootSpreadMin, rootSpreadMax, treeRand1);
            float rootHeight = mix(rootHeightMin, rootHeightMax, treeRand2);
            float rootBumps = floor(mix(rootBumpsMin, rootBumpsMax + 1.0, treeRand3));
            if (worldPos.y < instanceCenter.y + rootHeight) {
              float rootFactor = 1.0 - ((worldPos.y - instanceCenter.y) / rootHeight);
              rootFactor = clamp(rootFactor, 0.0, 1.0);
              rootFactor = rootFactor * rootFactor;
              vec2 outwardDir = worldPos.xz - instanceCenter.xz;
              float outwardLen = length(outwardDir);
              if (outwardLen > 0.001) outwardDir /= outwardLen;
              else outwardDir = vec2(1.0, 0.0);
              float angle = atan(worldPos.z - instanceCenter.z, worldPos.x - instanceCenter.x);
              float treeSeed = fract(instanceCenter.x * 12.9898 + instanceCenter.z * 78.233) * 6.28;
              float bumpiness = 1.0 + 0.7 * sin(angle * rootBumps + treeSeed);
              float spreadAmount = rootFactor * rootSpread * bumpiness * outwardLen * 3.0;
              worldPos.xz += outwardDir * spreadAmount;
            }
            vWorldPosition = worldPos.xyz;
            vec3 toVertex = worldPos.xyz - instanceCenter.xyz;
            vec3 approxNormal = normalize(vec3(toVertex.x, 0.0, toVertex.z));
            if (abs(normal.y) > 0.9) approxNormal = vec3(0.0, sign(normal.y), 0.0);
            vNormal = approxNormal;
            float dist = length(cameraPosition - vWorldPosition);
            float safeFadeStart = min(leafFadeStart, maxLeafDistance - 1.0);
            vLeafTint = smoothstep(safeFadeStart, maxLeafDistance, dist);
            float uvAngle = atan(worldPos.z - instanceCenter.z, worldPos.x - instanceCenter.x);
            vUv = vec2(uvAngle * 1.5, worldPos.y * 0.5);
            vTreeRand = treeRand1;
            gl_Position = projectionMatrix * viewMatrix * worldPos;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform sampler2D barkTexture;
          uniform vec3 barkColor;
          uniform vec3 leafTintColor;
          varying vec3 vNormal;
          varying vec3 vWorldPosition;
          varying float vLeafTint;
          varying vec2 vUv;
          varying float vTreeRand;
          void main() {
            vec3 N = normalize(vNormal);
            vec3 L = normalize(vec3(0.5, 1.0, 0.3));
            float NdotL = max(dot(N, L), 0.0);
            vec2 wrappedUV = fract(vUv);
            vec3 texColor = texture2D(barkTexture, wrappedUV).rgb;
            float brightness = 0.85 + vTreeRand * 0.3;
            vec3 baseColor = mix(barkColor, texColor, 0.7) * 1.8 * brightness;
            baseColor *= vec3(1.0 + (vTreeRand - 0.5) * 0.1, 1.0, 1.0 - (vTreeRand - 0.5) * 0.1);
            baseColor = mix(baseColor, leafTintColor, vLeafTint * 0.7);
            vec3 litColor = baseColor * (0.3 + NdotL * 0.7);
            gl_FragColor = vec4(litColor, 1.0);
          }
        `,
      });

      const barkMesh = new THREE.InstancedMesh(
        barkGeo,
        barkMat,
        this.branchMatrices.length,
      );
      barkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      barkMesh.frustumCulled = !cfg.CUSTOM_TREE_CULLING;
      barkMesh.castShadow = true;
      barkMesh.receiveShadow = true;
      barkMesh.name = "forest-bark";
      for (let i = 0; i < this.branchMatrices.length; i++) {
        barkMesh.setMatrixAt(i, this.branchMatrices[i]);
      }
      barkMesh.instanceMatrix.needsUpdate = true;
      barkMesh.count = this.branchMatrices.length;
      this.group.add(barkMesh);
      this.meshes.bark = barkMesh;
      this.barkMat = barkMat;
    }

    if (this.leafMatrices.length > 0) {
      // Clone so multi-mount / rebuild does not share InstancedBufferAttributes
      const leafGeo = this._leafGeo.clone();
      const leafMat = new THREE.ShaderMaterial({
        uniforms: {
          leafTexture: { value: leafTexture },
          time: { value: 0 },
          leafFadeStart: { value: cfg.LOD_FADE_START },
          maxLeafDistance: { value: cfg.LOD_MAX_DISTANCE },
          swayDistance: { value: cfg.LOD_SWAY_DISTANCE },
          swayFadeStart: { value: cfg.LOD_SWAY_FADE_START },
        },
        vertexShader: /* glsl */ `
          attribute vec3 instanceColorAttr;
          attribute float instanceRand;
          attribute float instanceWobbleX;
          attribute float instanceWobbleY;
          attribute float instanceSwayPhase;
          uniform float time;
          uniform float leafFadeStart;
          uniform float maxLeafDistance;
          uniform float swayDistance;
          uniform float swayFadeStart;
          varying vec3 vColor;
          varying vec2 vUv;
          varying float vFade;
          varying float vNdotL;
          void main() {
            vUv = uv;
            vColor = instanceColorAttr;
            vec3 pos = position;
            // slight pre-wobble
            pos.x += instanceWobbleX * 0.15;
            pos.y += instanceWobbleY * 0.1;
            vec4 worldPos = instanceMatrix * vec4(pos, 1.0);
            float dist = length(cameraPosition - worldPos.xyz);
            float safeFadeStart = min(leafFadeStart, maxLeafDistance - 1.0);
            float fade = 1.0 - smoothstep(safeFadeStart, maxLeafDistance, dist);
            vFade = fade;
            // shrink leaves at distance
            vec3 center = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
            worldPos.xyz = mix(center, worldPos.xyz, max(fade, 0.05));
            float swayAmt = 1.0 - smoothstep(swayFadeStart, swayDistance, dist);
            float sway = sin(time * 1.6 + instanceSwayPhase) * 0.08 * swayAmt * instanceRand;
            worldPos.x += sway;
            worldPos.z += cos(time * 1.3 + instanceSwayPhase) * 0.05 * swayAmt;
            vec3 N = normalize(mat3(instanceMatrix) * vec3(0.0, 0.0, 1.0));
            vec3 L = normalize(vec3(0.5, 1.0, 0.3));
            vNdotL = max(dot(N, L), 0.0);
            gl_Position = projectionMatrix * viewMatrix * worldPos;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform sampler2D leafTexture;
          varying vec3 vColor;
          varying vec2 vUv;
          varying float vFade;
          varying float vNdotL;
          void main() {
            vec4 tex = texture2D(leafTexture, vUv);
            if (tex.a < 0.35) discard;
            if (vFade < 0.02) discard;
            vec3 col = tex.rgb * vColor * (0.45 + vNdotL * 0.65);
            gl_FragColor = vec4(col, tex.a * vFade);
          }
        `,
        transparent: true,
        depthWrite: true,
        side: THREE.DoubleSide,
      });

      const leafMesh = new THREE.InstancedMesh(
        leafGeo,
        leafMat,
        this.leafMatrices.length,
      );
      leafMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      leafMesh.frustumCulled = !cfg.CUSTOM_TREE_CULLING;
      leafMesh.castShadow = false;
      leafMesh.receiveShadow = false;
      leafMesh.name = "forest-leaves";

      // Per-instance attributes
      const colors = new Float32Array(this.leafColors);
      const rands = new Float32Array(this.leafRandoms);
      const wobX = new Float32Array(this.leafWobbleX);
      const wobY = new Float32Array(this.leafWobbleY);
      const phases = new Float32Array(this.leafSwayPhase);
      leafGeo.setAttribute(
        "instanceColorAttr",
        new THREE.InstancedBufferAttribute(colors, 3),
      );
      leafGeo.setAttribute(
        "instanceRand",
        new THREE.InstancedBufferAttribute(rands, 1),
      );
      leafGeo.setAttribute(
        "instanceWobbleX",
        new THREE.InstancedBufferAttribute(wobX, 1),
      );
      leafGeo.setAttribute(
        "instanceWobbleY",
        new THREE.InstancedBufferAttribute(wobY, 1),
      );
      leafGeo.setAttribute(
        "instanceSwayPhase",
        new THREE.InstancedBufferAttribute(phases, 1),
      );

      for (let i = 0; i < this.leafMatrices.length; i++) {
        leafMesh.setMatrixAt(i, this.leafMatrices[i]);
      }
      leafMesh.instanceMatrix.needsUpdate = true;
      leafMesh.count = this.leafMatrices.length;
      this.group.add(leafMesh);
      this.meshes.leaves = leafMesh;
      this.leafMat = leafMat;
    }

    // Master matrices for culling reorder / hide
    this._masterBranch = this.branchMatrices.map((m) => m.clone());
    this._masterLeaf = this.leafMatrices.map((m) => m.clone());
    this._zero = new THREE.Matrix4().makeScale(0, 0, 0);
  }

  /** Hide or show a tree (harvest break). */
  setTreeVisible(treeIndex, visible) {
    if (visible) this._hiddenTrees.delete(treeIndex);
    else this._hiddenTrees.add(treeIndex);
    this._applyTreeMatrices();
  }

  /** Scale remaining visual after chunk (0–1). */
  setTreeChunkScale(treeIndex, frac) {
    const f = Math.max(0.05, Math.min(1, frac));
    const br = this.treeBranchRanges[treeIndex];
    const lr = this.treeLeafRanges[treeIndex];
    const place = this.treePlacements[treeIndex];
    if (!place || !this.meshes.bark) return;
    const origin = new THREE.Vector3(place.x, place.y, place.z);
    const sMat = new THREE.Matrix4().makeScale(f, f, f);
    const t0 = new THREE.Matrix4().makeTranslation(-origin.x, -origin.y, -origin.z);
    const t1 = new THREE.Matrix4().makeTranslation(origin.x, origin.y, origin.z);
    if (br && this.meshes.bark) {
      for (let i = 0; i < br.count; i++) {
        const idx = br.start + i;
        const m = this._masterBranch[idx].clone();
        m.premultiply(t0).premultiply(sMat).premultiply(t1);
        this.meshes.bark.setMatrixAt(idx, this._hiddenTrees.has(treeIndex) ? this._zero : m);
      }
      this.meshes.bark.instanceMatrix.needsUpdate = true;
    }
    if (lr && this.meshes.leaves) {
      for (let i = 0; i < lr.count; i++) {
        const idx = lr.start + i;
        const m = this._masterLeaf[idx].clone();
        m.premultiply(t0).premultiply(sMat).premultiply(t1);
        this.meshes.leaves.setMatrixAt(idx, this._hiddenTrees.has(treeIndex) ? this._zero : m);
      }
      this.meshes.leaves.instanceMatrix.needsUpdate = true;
    }
  }

  _applyTreeMatrices() {
    if (this.meshes.bark) {
      for (let i = 0; i < this._masterBranch.length; i++) {
        const tid = this.branchTreeIds[i];
        this.meshes.bark.setMatrixAt(
          i,
          this._hiddenTrees.has(tid) ? this._zero : this._masterBranch[i],
        );
      }
      this.meshes.bark.instanceMatrix.needsUpdate = true;
    }
    if (this.meshes.leaves) {
      for (let i = 0; i < this._masterLeaf.length; i++) {
        const tid = this.leafTreeIds[i];
        this.meshes.leaves.setMatrixAt(
          i,
          this._hiddenTrees.has(tid) ? this._zero : this._masterLeaf[i],
        );
      }
      this.meshes.leaves.instanceMatrix.needsUpdate = true;
    }
  }

  /**
   * Per-frame: leaf sway + optional frustum cull by reordering count.
   * @param {THREE.Camera} camera
   * @param {number} timeSec
   */
  update(camera, timeSec) {
    if (this.leafMat) this.leafMat.uniforms.time.value = timeSec;
    if (!this.cfg.CUSTOM_TREE_CULLING || !camera || !this.meshes.bark) return this.treeBounds.length;

    // Throttle: only when camera moved
    if (this._lastCamPos.distanceToSquared(camera.position) < 0.25) {
      return this.visibleTreeCount || this.treeBounds.length;
    }
    this._lastCamPos.copy(camera.position);
    this._projScreenMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    this._frustum.setFromProjectionMatrix(this._projScreenMatrix);

    let visible = 0;
    const bark = this.meshes.bark;
    const leaves = this.meshes.leaves;
    // Simple approach: zero out culled trees (keep draw order stable)
    for (let t = 0; t < this.treeBounds.length; t++) {
      if (this._hiddenTrees.has(t)) continue;
      const hit = this._frustum.intersectsSphere(this.treeBounds[t].sphere);
      if (hit) visible++;
      const br = this.treeBranchRanges[t];
      const lr = this.treeLeafRanges[t];
      for (let i = 0; i < br.count; i++) {
        const idx = br.start + i;
        bark.setMatrixAt(idx, hit ? this._masterBranch[idx] : this._zero);
      }
      if (leaves && lr) {
        for (let i = 0; i < lr.count; i++) {
          const idx = lr.start + i;
          leaves.setMatrixAt(idx, hit ? this._masterLeaf[idx] : this._zero);
        }
      }
    }
    bark.instanceMatrix.needsUpdate = true;
    if (leaves) leaves.instanceMatrix.needsUpdate = true;
    this.visibleTreeCount = visible;
    return visible;
  }
}
