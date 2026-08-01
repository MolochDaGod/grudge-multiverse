/**
 * Multiverse island world bosses — real meshes from Warlords / Hellmaw pack
 * (Unity Grudge Warlords uMMORPG island world-boss line → production GLB).
 *
 * SSOT meshes (CDN):
 *  - Shadow Flame Mantis — world boss (models/bosses/shadow-flame-mantis.prod.glb)
 *  - Ash Ghast — island boss / minion (models/enemies/volcano/minecraft-ghast.prod.glb)
 *
 * Catalog: gameopen content/enemies/volcano-bosses.json
 * Scale: SI human 1.8 m yardstick — mantis ~3.2 m, ghast ~2.4 m.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

const CDN = "https://assets.grudge-studio.com";
const OPEN = "https://gameopen.vercel.app";

/** Fleet world-boss catalog (Island / Hellmaw / uMMORPG world-boss ports). */
export const WORLD_BOSS_DEFS = {
  shadow_flame_mantis: {
    id: "shadow_flame_mantis",
    name: "Shadow Flame Mantis",
    role: "world_boss",
    heightM: 3.2,
    hp: 4200,
    dmg: 48,
    speed: 3.2,
    attackRange: 3.4,
    aggroRange: 28,
    meshUrls: [
      `${CDN}/models/bosses/shadow-flame-mantis.prod.glb`,
      `${OPEN}/models/bosses/shadow-flame-mantis.prod.glb`,
      `${CDN}/models/bosses/shadow-flame-mantis.glb`,
      `${OPEN}/models/bosses/shadow-flame-mantis.glb`,
    ],
    clips: {
      idle: ["Idle", "idle", "IDLE"],
      walk: ["Walk", "walk", "Run", "run"],
      attack: [
        "Burning Slice",
        "Flaming Upper Stab",
        "Grabbing Munch",
        "Rushing Charge",
        "Nuclear Slice",
        "Attack",
        "attack",
      ],
      phase2: ["Nuclear Slice", "Shadow Call", "Rushing Charge"],
    },
  },
  volcano_ghast: {
    id: "volcano_ghast",
    name: "Ash Ghast",
    role: "volcano_ranged",
    heightM: 2.4,
    hp: 900,
    dmg: 28,
    speed: 2.6,
    attackRange: 12,
    aggroRange: 32,
    meshUrls: [
      `${OPEN}/models/enemies/volcano/minecraft-ghast.prod.glb`,
      `${CDN}/models/enemies/volcano/minecraft-ghast.prod.glb`,
      `${OPEN}/models/enemies/volcano/minecraft-ghast.glb`,
    ],
    clips: {
      idle: ["Idle", "idle"],
      walk: ["Idle", "idle"],
      attack: ["Fire", "fire", "Attack", "attack"],
      phase2: ["Fire", "fire"],
    },
    /** Hover body slightly above ground */
    hoverY: 1.1,
  },
};

let _loader = null;
function getLoader() {
  if (_loader) return _loader;
  _loader = new GLTFLoader();
  try {
    const draco = new DRACOLoader();
    draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    _loader.setDRACOLoader(draco);
  } catch {
    /* optional */
  }
  return _loader;
}

async function loadGltfFirst(urls) {
  let last;
  for (const url of urls) {
    try {
      const gltf = await getLoader().loadAsync(url);
      console.info("[bosses] loaded", url);
      return gltf;
    } catch (e) {
      last = e;
      console.warn("[bosses] miss", url, e?.message || e);
    }
  }
  throw last || new Error("boss mesh load failed");
}

function bodyBox(root) {
  const box = new THREE.Box3();
  let any = false;
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    if (!o.visible) return;
    const b = new THREE.Box3().setFromObject(o, true);
    if (b.isEmpty()) return;
    if (!any) {
      box.copy(b);
      any = true;
    } else box.union(b);
  });
  if (!any) box.setFromObject(root, true);
  return box;
}

/** Uniform fit to target height (metres), feet on local y=0. */
function fitBossHeight(model, heightM) {
  model.updateMatrixWorld(true);
  let box = bodyBox(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  let h = size.y || 1;
  if (h > 50) {
    model.scale.multiplyScalar(0.01);
    model.updateMatrixWorld(true);
    box = bodyBox(model);
    box.getSize(size);
    h = size.y || 1;
  }
  if (h > 1e-4) {
    model.scale.multiplyScalar(heightM / h);
    model.updateMatrixWorld(true);
  }
  box = bodyBox(model);
  model.position.y -= box.min.y;
  model.updateMatrixWorld(true);
  return measureHeight(model);
}

function measureHeight(model) {
  const s = new THREE.Vector3();
  bodyBox(model).getSize(s);
  return s.y;
}

function findClip(animations, names) {
  if (!animations?.length) return null;
  for (const want of names) {
    const hit = animations.find(
      (c) => c.name === want || c.name.toLowerCase() === want.toLowerCase(),
    );
    if (hit) return hit;
  }
  // fuzzy contains
  for (const want of names) {
    const w = want.toLowerCase();
    const hit = animations.find((c) => c.name.toLowerCase().includes(w));
    if (hit) return hit;
  }
  return animations[0] || null;
}

function prepMaterials(root) {
  root.traverse((o) => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    if (o.isSkinnedMesh) o.frustumCulled = false;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      if (m.map) {
        m.map.colorSpace = THREE.SRGBColorSpace;
        m.map.flipY = false;
      }
      m.side = THREE.DoubleSide;
      m.needsUpdate = true;
    }
  });
}

/**
 * Island world bosses with real GLB bodies.
 * API matches previous BossFight for warlordsBootstrap.
 */
export class BossFight {
  /**
   * @param {THREE.Scene} scene
   * @param {{ id: string, position: THREE.Vector3, name?: string, defId?: string }[]} pads
   */
  constructor(scene, pads) {
    this.scene = scene;
    this.bosses = [];
    this._ready = false;
    this._pads = pads;
    // sync construct with rings only; meshes load via load()
    for (const p of pads) {
      const defId =
        p.defId ||
        (p.id?.includes("west") || p.name?.toLowerCase().includes("ghast")
          ? "volcano_ghast"
          : "shadow_flame_mantis");
      const def = WORLD_BOSS_DEFS[defId] || WORLD_BOSS_DEFS.shadow_flame_mantis;
      const root = new THREE.Group();
      root.name = `boss_${def.id}`;
      root.position.copy(p.position);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(3.4, 3.75, 40),
        new THREE.MeshBasicMaterial({
          color: def.role === "world_boss" ? 0xff5533 : 0xffaa44,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.06;
      root.add(ring);

      // Temp stand-in until GLB loads
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.6, 1.6, 6, 12),
        new THREE.MeshStandardMaterial({ color: 0x4a1818, roughness: 0.45 }),
      );
      body.position.y = 1.3;
      body.name = "boss_placeholder";
      root.add(body);

      scene.add(root);
      this.bosses.push({
        id: p.id,
        defId: def.id,
        name: p.name || def.name,
        def,
        root,
        body,
        model: null,
        mixer: null,
        actions: {},
        currentClip: "",
        hp: def.hp,
        maxHp: def.hp,
        dmg: def.dmg,
        phase: 1,
        dead: false,
        nextAttack: 0,
        aggroRange: def.aggroRange,
        attackRange: def.attackRange,
        speed: def.speed,
        hoverY: def.hoverY || 0,
        heightM: def.heightM,
      });
    }
  }

  /** Async mesh load — call after construct. */
  async load() {
    await Promise.all(this.bosses.map((b) => this._loadOne(b)));
    this._ready = true;
    return this;
  }

  async _loadOne(b) {
    try {
      const gltf = await loadGltfFirst(b.def.meshUrls);
      const model = gltf.scene;
      prepMaterials(model);
      const h = fitBossHeight(model, b.def.heightM);
      b.heightM = h;
      console.info(`[bosses] ${b.name} height=${h.toFixed(2)}m (target ${b.def.heightM})`);

      // Remove placeholder
      if (b.body?.parent) b.body.parent.remove(b.body);
      b.body = model;
      b.model = model;
      b.root.add(model);
      if (b.hoverY) model.position.y += b.hoverY;

      // Animations
      if (gltf.animations?.length) {
        b.mixer = new THREE.AnimationMixer(model);
        const mk = (role, names) => {
          const clip = findClip(gltf.animations, names);
          if (!clip) return null;
          const act = b.mixer.clipAction(clip);
          act.enabled = true;
          b.actions[role] = act;
          return act;
        };
        mk("idle", b.def.clips.idle);
        mk("walk", b.def.clips.walk);
        mk("attack", b.def.clips.attack);
        mk("phase2", b.def.clips.phase2);
        this._play(b, "idle", 0.2);
      }
    } catch (e) {
      console.warn(`[bosses] ${b.name} mesh failed — keeping placeholder`, e?.message || e);
    }
  }

  _play(b, role, fade = 0.15) {
    if (!b.mixer || !b.actions[role]) return;
    if (b.currentClip === role) return;
    const next = b.actions[role];
    const prev = b.actions[b.currentClip];
    if (prev && prev !== next) prev.fadeOut(fade);
    next.reset().fadeIn(fade).play();
    if (role === "attack" || role === "phase2") {
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
    } else {
      next.setLoop(THREE.LoopRepeat, Infinity);
    }
    b.currentClip = role;
  }

  get(id) {
    return this.bosses.find((b) => b.id === id);
  }

  hit(id, damage, by) {
    const b = this.get(id);
    if (!b || b.dead) return { ok: false };
    b.hp = Math.max(0, b.hp - damage);
    b.lastHitBy = by;
    if (b.hp <= b.maxHp * 0.5 && b.phase === 1) {
      b.phase = 2;
      b.dmg = Math.floor(b.def.dmg * 1.45);
      // flash phase — emissive pulse if materials allow
      b.model?.traverse((o) => {
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (m?.emissive) {
            m.emissive.setHex(0x441000);
            m.emissiveIntensity = 0.55;
          }
        }
      });
    }
    if (b.hp <= 0) {
      b.dead = true;
      b.root.visible = false;
      return { ok: true, killed: true, boss: b };
    }
    // attack telegraph anim
    this._play(b, b.phase === 2 && b.actions.phase2 ? "phase2" : "attack", 0.08);
    return { ok: true, killed: false, hp: b.hp, phase: b.phase };
  }

  applyRemote(id, state) {
    const b = this.get(id);
    if (!b || !state) return;
    b.hp = state.hp ?? b.hp;
    b.phase = state.phase ?? b.phase;
    b.dead = !!state.dead;
    b.root.visible = !b.dead;
  }

  /**
   * AI tick: face player, chase, melee / ranged pulse.
   * @returns {{ id: string, damage: number, name: string }[]}
   */
  update(dt, playerPos) {
    const attacks = [];
    if (!playerPos) return attacks;
    const now = performance.now() / 1000;
    for (const b of this.bosses) {
      b.mixer?.update(dt);
      if (b.dead) continue;

      const toP = new THREE.Vector3().subVectors(playerPos, b.root.position);
      toP.y = 0;
      const dist = toP.length();
      const speed = b.phase === 2 ? b.speed * 1.25 : b.speed;

      if (dist < b.aggroRange && dist > b.attackRange * 0.85) {
        const dir = toP.normalize();
        b.root.position.addScaledVector(dir, speed * dt);
        b.root.lookAt(playerPos.x, b.root.position.y, playerPos.z);
        this._play(b, "walk", 0.2);
      } else if (dist <= b.attackRange) {
        b.root.lookAt(playerPos.x, b.root.position.y, playerPos.z);
        if (now >= b.nextAttack) {
          b.nextAttack = now + (b.phase === 2 ? 1.05 : 1.55);
          this._play(b, b.phase === 2 && b.actions.phase2 ? "phase2" : "attack", 0.08);
          attacks.push({ id: b.id, damage: b.dmg, name: b.name });
          // brief model punch scale on attack
          if (b.model) {
            b.model.scale.multiplyScalar(1.04);
            setTimeout(() => {
              if (b.model) {
                // re-fit roughly — avoid cumulative scale drift: store baseScale
                const base = b.model.userData.baseScale || 1;
                b.model.scale.setScalar(base);
              }
            }, 140);
          }
        } else if (b.currentClip === "walk") {
          this._play(b, "idle", 0.2);
        }
      } else {
        this._play(b, "idle", 0.25);
      }

      // Store base scale once after load
      if (b.model && b.model.userData.baseScale == null) {
        b.model.userData.baseScale = b.model.scale.x;
      }
    }
    return attacks;
  }

  serialize() {
    const out = {};
    for (const b of this.bosses) {
      out[b.id] = {
        hp: b.hp,
        maxHp: b.maxHp,
        phase: b.phase,
        dead: b.dead,
        defId: b.defId,
        name: b.name,
      };
    }
    return out;
  }
}
