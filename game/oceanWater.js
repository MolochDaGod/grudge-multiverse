/**
 * Ocean surface — three.js Water best practice
 * https://threejs.org/docs/#examples/en/objects/Water
 *
 * Replaces flat water-surface mesh with reflective Water + waterNormals.
 * SI: large plane under 5 km realm.
 */
import * as THREE from "three";
import { Water } from "three/examples/jsm/objects/Water.js";
import { COLLIDER_LAYER } from "./mapLiteracy.js";

const WATER_NORMALS_URL =
  "https://threejs.org/examples/textures/waternormals.jpg";

/**
 * @param {THREE.Scene} scene
 * @param {object} island
 * @param {{ size?: number, sunDirection?: THREE.Vector3, renderer?: THREE.WebGLRenderer }} opts
 */
export function mountOceanWater(scene, island, opts = {}) {
  const waterY = island.waterY ?? 0.25;
  const size = opts.size || Math.max(
    (island.worldRadiusM || 2400) * 2.4,
    (island.worldHalfM || 2500) * 2.1,
  );

  // Hide / remove old flat water surface meshes (keep deep plane if present)
  if (island.waterGroup) {
    island.waterGroup.traverse((o) => {
      if (o.isMesh && o.name === "water-surface") {
        o.visible = false;
      }
    });
  }

  const geo = new THREE.PlaneGeometry(size, size, 1, 1);
  const waterNormals = new THREE.TextureLoader().load(
    WATER_NORMALS_URL,
    (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    },
  );

  const sunDir =
    opts.sunDirection ||
    new THREE.Vector3(0.65, 0.55, 0.25).normalize();

  let water;
  try {
    water = new Water(geo, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals,
      sunDirection: sunDir,
      sunColor: 0xffffff,
      waterColor: 0x1a4a6a,
      distortionScale: 2.8,
      fog: scene.fog !== undefined,
      alpha: 0.92,
    });
  } catch (e) {
    console.warn("[oceanWater] Water addon failed, keep flat plane", e);
    return null;
  }

  water.rotation.x = -Math.PI / 2;
  water.position.y = waterY - 0.05;
  water.name = "ocean-water-three";
  water.userData.worldKind = "water";
  water.userData.colliderLayer = COLLIDER_LAYER.WATER;
  water.userData.walkable = false;
  water.userData.waterSurfaceY = waterY;
  scene.add(water);

  island.oceanWater = water;
  island.waterY = waterY;

  console.info(
    `[oceanWater] three.js Water size=${size.toFixed(0)}m y=${waterY.toFixed(2)}`,
  );

  return {
    mesh: water,
    update(dt) {
      if (water?.material?.uniforms?.time) {
        water.material.uniforms.time.value += dt;
      }
    },
    setSunDirection(v) {
      if (water?.material?.uniforms?.sunDirection) {
        water.material.uniforms.sunDirection.value.copy(v);
      }
    },
  };
}
