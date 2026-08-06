/**
 * Multiverse world bosses / elite enemies — real GLBs + Elden Ring-style
 * deterministic attack scripts (telegraph → windup → active → recover).
 *
 * Units:
 *  - Shadow Flame Mantis (Hellmaw world boss GLB)
 *  - Ash Ghast (ranged + fireball projectiles + ground warnings)
 *  - Werelephant (local/public models/enemies/werelephant.glb)
 *
 * SI: human 1.8 m yardstick. Deterministic combo lists — no pure random spam.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

const CDN = "https://assets.grudge-studio.com";
const OPEN = "https://gameopen.vercel.app";
const BASE = import.meta.env.BASE_URL || "/";

/**
 * @typedef {'circle'|'cone'|'line'|'homing'} TelegraphKind
 * @typedef {'melee'|'projectile'|'charge'|'aoe'} AttackKind
 * @typedef {{
 *   id: string, name: string, kind: AttackKind,
 *   telegraph: TelegraphKind, radius: number, angle?: number, length?: number,
 *   windup: number, active: number, recover: number,
 *   dmgMul: number, color: number, clip?: string, projectileSpeed?: number
 * }} AttackDef
 */

/** @type {Record<string, object>} */
export const WORLD_BOSS_DEFS = {
  shadow_flame_mantis: {
    id: "shadow_flame_mantis",
    name: "Shadow Flame Mantis",
    role: "world_boss",
    heightM: 3.2,
    hp: 4200,
    dmg: 48,
    speed: 3.0,
    attackRange: 4.0,
    aggroRange: 30,
    meshUrls: [
      `${CDN}/models/bosses/shadow-flame-mantis.prod.glb`,
      `${OPEN}/models/bosses/shadow-flame-mantis.prod.glb`,
    ],
    clips: {
      idle: ["Idle", "idle"],
      walk: ["Walk", "walk", "Run", "run"],
      attack: ["Burning Slice", "Flaming Upper Stab", "Grabbing Munch", "Attack"],
      heavy: ["Nuclear Slice", "Rushing Charge", "Shadow Call"],
    },
    /** Deterministic rotation of attacks (Elden Ring-like script) */
    rotation: ["swipe", "stab", "charge", "swipe", "nuke"],
    attacks: {
      swipe: {
        id: "swipe",
        name: "Burning Slice",
        kind: "melee",
        telegraph: "cone",
        radius: 4.2,
        angle: Math.PI * 0.7,
        windup: 0.85,
        active: 0.35,
        recover: 0.7,
        dmgMul: 1.0,
        color: 0xff6622,
        clip: "attack",
      },
      stab: {
        id: "stab",
        name: "Flaming Upper Stab",
        kind: "melee",
        telegraph: "line",
        radius: 1.1,
        length: 5.5,
        windup: 1.0,
        active: 0.28,
        recover: 0.75,
        dmgMul: 1.25,
        color: 0xff8844,
        clip: "attack",
      },
      charge: {
        id: "charge",
        name: "Rushing Charge",
        kind: "charge",
        telegraph: "line",
        radius: 1.4,
        length: 14,
        windup: 1.15,
        active: 0.55,
        recover: 0.9,
        dmgMul: 1.4,
        color: 0xff2200,
        clip: "heavy",
      },
      nuke: {
        id: "nuke",
        name: "Nuclear Slice",
        kind: "aoe",
        telegraph: "circle",
        radius: 6.5,
        windup: 1.55,
        active: 0.4,
        recover: 1.2,
        dmgMul: 1.85,
        color: 0xffaa00,
        clip: "heavy",
      },
    },
  },
  volcano_ghast: {
    id: "volcano_ghast",
    name: "Ash Ghast",
    role: "volcano_ranged",
    heightM: 2.4,
    hp: 900,
    dmg: 26,
    speed: 2.2,
    attackRange: 18,
    aggroRange: 34,
    hoverY: 1.35,
    meshUrls: [
      `${OPEN}/models/enemies/volcano/minecraft-ghast.prod.glb`,
      `${CDN}/models/enemies/volcano/minecraft-ghast.prod.glb`,
    ],
    clips: {
      idle: ["Idle", "idle"],
      walk: ["Idle", "idle"],
      attack: ["Fire", "fire", "Attack"],
      heavy: ["Fire", "fire"],
    },
    rotation: ["bolt", "bolt", "barrage", "bolt", "meteor"],
    attacks: {
      bolt: {
        id: "bolt",
        name: "Ash Bolt",
        kind: "projectile",
        telegraph: "circle",
        radius: 1.6,
        windup: 0.9,
        active: 0.2,
        recover: 0.65,
        dmgMul: 1.0,
        color: 0xff7733,
        clip: "attack",
        projectileSpeed: 22,
      },
      barrage: {
        id: "barrage",
        name: "Ash Barrage",
        kind: "projectile",
        telegraph: "circle",
        radius: 1.4,
        windup: 1.1,
        active: 0.15,
        recover: 0.85,
        dmgMul: 0.75,
        color: 0xff9944,
        clip: "attack",
        projectileSpeed: 18,
        /** fire N projectiles with slight spread */
        count: 3,
      },
      meteor: {
        id: "meteor",
        name: "Ash Meteor",
        kind: "projectile",
        telegraph: "circle",
        radius: 3.2,
        windup: 1.45,
        active: 0.25,
        recover: 1.1,
        dmgMul: 1.7,
        color: 0xff2200,
        clip: "heavy",
        projectileSpeed: 16,
      },
    },
  },
  werelephant: {
    id: "werelephant",
    name: "Werelephant",
    role: "elite",
    /** Authoring is ~cm — fitBossHeight handles 100× then residual */
    heightM: 4.2,
    hp: 2800,
    dmg: 42,
    speed: 3.6,
    attackRange: 4.5,
    aggroRange: 26,
    meshUrls: [
      `${BASE}models/enemies/werelephant.glb`,
      `/models/enemies/werelephant.glb`,
      `${OPEN}/models/enemies/werelephant.glb`,
      `${CDN}/models/enemies/werelephant.glb`,
    ],
    clips: {
      idle: ["Take 001", "Idle", "idle", "Armature|Idle"],
      walk: ["Take 001", "Walk", "walk", "Run"],
      attack: ["Take 001", "Attack", "attack"],
      heavy: ["Take 001"],
    },
    rotation: ["stomp", "tusk", "charge", "stomp", "slam"],
    attacks: {
      stomp: {
        id: "stomp",
        name: "Ground Stomp",
        kind: "aoe",
        telegraph: "circle",
        radius: 4.0,
        windup: 1.05,
        active: 0.3,
        recover: 0.85,
        dmgMul: 1.15,
        color: 0xc8a84b,
        clip: "attack",
      },
      tusk: {
        id: "tusk",
        name: "Tusk Sweep",
        kind: "melee",
        telegraph: "cone",
        radius: 5.0,
        angle: Math.PI * 0.9,
        windup: 0.95,
        active: 0.35,
        recover: 0.75,
        dmgMul: 1.05,
        color: 0xe8c877,
        clip: "attack",
      },
      charge: {
        id: "charge",
        name: "Tusker Charge",
        kind: "charge",
        telegraph: "line",
        radius: 1.6,
        length: 16,
        windup: 1.25,
        active: 0.65,
        recover: 1.0,
        dmgMul: 1.5,
        color: 0xff6644,
        clip: "heavy",
      },
      slam: {
        id: "slam",
        name: "Body Slam",
        kind: "aoe",
        telegraph: "circle",
        radius: 5.5,
        windup: 1.4,
        active: 0.4,
        recover: 1.15,
        dmgMul: 1.65,
        color: 0xff4400,
        clip: "heavy",
      },
    },
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

function fitBossHeight(model, heightM) {
  model.updateMatrixWorld(true);
  let box = bodyBox(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  let h = size.y || 1;
  let factor = 1;
  // Classic cm-as-m (werelephant raw ~340 m)
  if (h > 40) {
    model.scale.multiplyScalar(0.01);
    factor *= 0.01;
    model.updateMatrixWorld(true);
    box = bodyBox(model);
    box.getSize(size);
    h = size.y || 1;
  }
  if (h > 1e-4) {
    const s = heightM / h;
    model.scale.multiplyScalar(s);
    factor *= s;
    model.updateMatrixWorld(true);
  }
  box = bodyBox(model);
  model.position.y -= box.min.y;
  model.updateMatrixWorld(true);
  model.userData.baseScale = model.scale.x;
  model.userData.deployScaleFactor = factor;
  box.getSize(size);
  return size.y;
}

function findClip(animations, names) {
  if (!animations?.length) return null;
  for (const want of names) {
    const hit = animations.find(
      (c) => c.name === want || c.name.toLowerCase() === String(want).toLowerCase(),
    );
    if (hit) return hit;
  }
  for (const want of names) {
    const w = String(want).toLowerCase();
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

// ── Telegraph visuals (Elden Ring style) ───────────────────────────────────

function makeTelegraphMesh(kind, radius, color, angle = Math.PI * 0.6, length = 8) {
  const group = new THREE.Group();
  group.name = "boss_telegraph";
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const edge = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  if (kind === "circle") {
    const fill = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), mat);
    fill.rotation.x = -Math.PI / 2;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(Math.max(0.05, radius - 0.12), radius, 48),
      edge,
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    group.add(fill, ring);
  } else if (kind === "cone") {
    // Triangle fan cone on ground
    const segs = 24;
    const geo = new THREE.BufferGeometry();
    const verts = [0, 0.02, 0];
    for (let i = 0; i <= segs; i++) {
      const a = -angle / 2 + (angle * i) / segs;
      verts.push(Math.sin(a) * radius, 0.02, Math.cos(a) * radius);
    }
    const pos = new Float32Array(verts);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const idx = [];
    for (let i = 1; i <= segs; i++) idx.push(0, i, i + 1);
    geo.setIndex(idx);
    geo.computeVertexNormals();
    group.add(new THREE.Mesh(geo, mat));
  } else if (kind === "line") {
    const w = radius * 2;
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(w, length), mat);
    fill.rotation.x = -Math.PI / 2;
    fill.position.z = length * 0.5;
    group.add(fill);
    const border = new THREE.Mesh(
      new THREE.PlaneGeometry(w + 0.15, length),
      edge,
    );
    border.rotation.x = -Math.PI / 2;
    border.position.z = length * 0.5;
    border.position.y = -0.01;
    group.add(border);
  }
  return group;
}

// ── Projectiles ────────────────────────────────────────────────────────────

class ProjectileField {
  constructor(scene) {
    this.scene = scene;
    /** @type {object[]} */
    this.list = [];
  }

  /**
   * Fireball from origin → impact point (pre-warned).
   * Damage applied on impact if player still in radius.
   */
  spawnFireball(origin, impact, opts = {}) {
    const speed = opts.speed ?? 20;
    const color = opts.color ?? 0xff6622;
    const radius = opts.radius ?? 1.6;
    const dmg = opts.dmg ?? 20;
    const bossId = opts.bossId;
    const bossName = opts.bossName || "Boss";

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 12),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
      }),
    );
    mesh.position.copy(origin);
    this.scene.add(mesh);

    // trail light
    const light = new THREE.PointLight(color, 1.4, 8);
    mesh.add(light);

    const dir = impact.clone().sub(origin);
    const dist = dir.length() || 0.01;
    dir.normalize();
    const life = Math.min(2.8, dist / speed + 0.05);

    this.list.push({
      mesh,
      vel: dir.multiplyScalar(speed),
      t: 0,
      life,
      impact: impact.clone(),
      radius,
      dmg,
      bossId,
      bossName,
      hit: false,
    });
  }

  /**
   * @param {number} dt
   * @param {THREE.Vector3} playerPos
   * @returns {{ damage: number, name: string, id: string }[]}
   */
  update(dt, playerPos) {
    const hits = [];
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.t += dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += dt * 8;
      p.mesh.rotation.y += dt * 5;

      const nearImpact = p.mesh.position.distanceTo(p.impact) < 0.45 || p.t >= p.life;
      if (nearImpact && !p.hit) {
        p.hit = true;
        // impact burst
        const burst = new THREE.Mesh(
          new THREE.SphereGeometry(p.radius * 0.55, 12, 12),
          new THREE.MeshBasicMaterial({
            color: 0xffaa66,
            transparent: true,
            opacity: 0.7,
            depthWrite: false,
          }),
        );
        burst.position.copy(p.impact);
        this.scene.add(burst);
        setTimeout(() => {
          this.scene.remove(burst);
          burst.geometry.dispose();
          burst.material.dispose();
        }, 220);

        if (playerPos && playerPos.distanceTo(p.impact) <= p.radius + 0.35) {
          hits.push({ damage: p.dmg, name: p.bossName, id: p.bossId });
        }
      }

      if (p.t >= p.life + 0.05) {
        this.scene.remove(p.mesh);
        p.mesh.geometry?.dispose();
        p.mesh.material?.dispose();
        this.list.splice(i, 1);
      }
    }
    return hits;
  }

  dispose() {
    for (const p of this.list) {
      this.scene.remove(p.mesh);
      p.mesh.geometry?.dispose();
      p.mesh.material?.dispose();
    }
    this.list.length = 0;
  }
}

// ── BossFight ──────────────────────────────────────────────────────────────

/**
 * Island bosses with real meshes + deterministic Elden Ring-style attack scripts.
 */
export class BossFight {
  /**
   * @param {THREE.Scene} scene
   * @param {{ id: string, position: THREE.Vector3, name?: string, defId?: string }[]} pads
   */
  constructor(scene, pads) {
    this.scene = scene;
    this.projectiles = new ProjectileField(scene);
    /** @type {object[]} */
    this.bosses = [];
    this._ready = false;

    for (const p of pads) {
      const defId = p.defId || "shadow_flame_mantis";
      const def = WORLD_BOSS_DEFS[defId] || WORLD_BOSS_DEFS.shadow_flame_mantis;
      const root = new THREE.Group();
      root.name = `boss_${def.id}`;
      root.position.copy(p.position);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(3.4, 3.8, 40),
        new THREE.MeshBasicMaterial({
          color: def.role === "world_boss" ? 0xff5533 : def.role === "elite" ? 0xc8a84b : 0xffaa44,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.45,
          depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      root.add(ring);

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
        aggroRange: def.aggroRange,
        attackRange: def.attackRange,
        speed: def.speed,
        hoverY: def.hoverY || 0,
        heightM: def.heightM,
        // Elden Ring combat state
        state: "idle", // idle | chase | telegraph | active | recover
        stateT: 0,
        rotIndex: 0,
        /** @type {AttackDef|null} */
        currentAtk: null,
        telegraph: null,
        /** locked aim at telegraph start (deterministic hit zone) */
        aimYaw: 0,
        impactPos: new THREE.Vector3(),
        chargeVel: new THREE.Vector3(),
        hitThisActive: false,
      });
    }
  }

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
      console.info(`[bosses] ${b.name} height=${h.toFixed(2)}m target=${b.def.heightM}`);

      if (b.body?.parent) b.body.parent.remove(b.body);
      b.body = model;
      b.model = model;
      b.root.add(model);
      if (b.hoverY) model.position.y += b.hoverY;

      if (gltf.animations?.length) {
        b.mixer = new THREE.AnimationMixer(model);
        const mk = (role, names) => {
          const clip = findClip(gltf.animations, names);
          if (!clip) return null;
          const act = b.mixer.clipAction(clip);
          act.enabled = true;
          // Single long Take 001: use time scale for “intensity”
          if (clip.name === "Take 001") act.timeScale = role === "idle" ? 0.35 : role === "walk" ? 0.85 : 1.15;
          b.actions[role] = act;
          return act;
        };
        mk("idle", b.def.clips.idle);
        mk("walk", b.def.clips.walk);
        mk("attack", b.def.clips.attack);
        mk("heavy", b.def.clips.heavy);
        this._play(b, "idle", 0.2);
      }
    } catch (e) {
      console.warn(`[bosses] ${b.name} mesh failed — placeholder`, e?.message || e);
    }
  }

  _play(b, role, fade = 0.15) {
    if (!b.mixer || !b.actions[role]) return;
    if (b.currentClip === role && role !== "attack" && role !== "heavy") return;
    const next = b.actions[role];
    const prev = b.actions[b.currentClip];
    if (prev && prev !== next) prev.fadeOut(fade);
    next.reset().fadeIn(fade).play();
    if (role === "attack" || role === "heavy") {
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
    } else {
      next.setLoop(THREE.LoopRepeat, Infinity);
    }
    b.currentClip = role;
  }

  _clearTelegraph(b) {
    if (b.telegraph) {
      if (b.telegraph.parent) b.telegraph.parent.remove(b.telegraph);
      else this.scene.remove(b.telegraph);
      b.telegraph.traverse((o) => {
        o.geometry?.dispose?.();
        o.material?.dispose?.();
      });
      b.telegraph = null;
      b.telegraphWorld = false;
    }
  }

  _beginAttack(b, playerPos) {
    const list = b.def.rotation || Object.keys(b.def.attacks);
    // Phase 2: skip to heavier slots more often (still deterministic)
    let idx = b.rotIndex % list.length;
    if (b.phase === 2 && list.length > 2) {
      idx = (b.rotIndex + 1) % list.length;
    }
    b.rotIndex = (b.rotIndex + 1) % list.length;
    const atkId = list[idx];
    const atk = b.def.attacks[atkId];
    if (!atk) {
      b.state = "idle";
      return;
    }
    b.currentAtk = atk;
    b.state = "telegraph";
    b.stateT = 0;
    b.hitThisActive = false;

    // Lock aim yaw toward player at telegraph start (fair, readable)
    const toP = playerPos.clone().sub(b.root.position);
    toP.y = 0;
    b.aimYaw = Math.atan2(toP.x, toP.z);
    b.root.rotation.y = b.aimYaw;

    // Impact point for projectiles / AoE — player position snap at telegraph
    b.impactPos.copy(playerPos);
    b.impactPos.y = b.root.position.y;

    this._clearTelegraph(b);
    const tel = makeTelegraphMesh(
      atk.telegraph,
      atk.radius,
      atk.color,
      atk.angle,
      atk.length,
    );
    // World-aligned for circle on impact; local for cone/line from boss
    if (atk.telegraph === "circle" && atk.kind === "projectile") {
      // attach to scene so it stays on ground under player lock point
      tel.position.copy(b.impactPos);
      tel.position.y = b.root.position.y + 0.04;
      this.scene.add(tel);
      b.telegraph = tel;
      b.telegraphWorld = true;
    } else {
      tel.position.y = 0.04;
      b.root.add(tel);
      b.telegraph = tel;
      b.telegraphWorld = false;
    }

    // Charge aim vector
    if (atk.kind === "charge") {
      b.chargeVel.set(Math.sin(b.aimYaw), 0, Math.cos(b.aimYaw)).multiplyScalar(b.speed * 3.2);
    }

    window.__mvBossTelegraph = {
      boss: b.name,
      attack: atk.name,
      windup: atk.windup,
    };
  }

  _finishActive(b) {
    this._clearTelegraph(b);
    if (b.telegraphWorld) b.telegraphWorld = false;
    b.state = "recover";
    b.stateT = 0;
    window.__mvBossTelegraph = null;
  }

  /**
   * Test if player is inside the locked hit volume for current attack.
   */
  _playerInHit(b, playerPos, atk) {
    if (!atk || !playerPos) return false;
    const origin = b.root.position;
    const dx = playerPos.x - origin.x;
    const dz = playerPos.z - origin.z;
    const dist = Math.hypot(dx, dz);

    if (atk.kind === "projectile") {
      // damage handled by projectile field at impact
      return false;
    }
    if (atk.telegraph === "circle" || atk.kind === "aoe") {
      return dist <= atk.radius + 0.4;
    }
    if (atk.telegraph === "cone") {
      if (dist > atk.radius + 0.4) return false;
      const ang = Math.atan2(dx, dz);
      let d = ang - b.aimYaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return Math.abs(d) <= (atk.angle || Math.PI * 0.6) * 0.5;
    }
    if (atk.telegraph === "line" || atk.kind === "charge") {
      const len = atk.length || 10;
      const fx = Math.sin(b.aimYaw);
      const fz = Math.cos(b.aimYaw);
      const along = dx * fx + dz * fz;
      const side = -dx * fz + dz * fx;
      return along >= 0 && along <= len && Math.abs(side) <= atk.radius + 0.35;
    }
    return dist <= (atk.radius || b.attackRange);
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
      b.dmg = Math.floor(b.def.dmg * 1.4);
      b.speed *= 1.12;
      b.model?.traverse((o) => {
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (m?.emissive) {
            m.emissive.setHex(0x441000);
            m.emissiveIntensity = 0.5;
          }
        }
      });
    }
    if (b.hp <= 0) {
      b.dead = true;
      b.state = "dead";
      this._clearTelegraph(b);
      b.root.visible = false;
      return { ok: true, killed: true, boss: b };
    }
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
   * @param {number} dt
   * @param {THREE.Vector3} playerPos
   * @param {{ findPath?: Function, isWalkableWorld?: Function, sampleY?: Function } | null} [nav]
   *   Heightfield nav from mapLiteracy.buildNavGrid — A* pathfinding on land.
   * @returns {{ id: string, damage: number, name: string }[]}
   */
  update(dt, playerPos, nav = null) {
    const attacks = [];
    if (!playerPos) return attacks;

    // Projectiles always tick
    const projHits = this.projectiles.update(dt, playerPos);
    for (const h of projHits) attacks.push(h);

    for (const b of this.bosses) {
      b.mixer?.update(dt);
      if (b.dead) continue;

      const toP = new THREE.Vector3().subVectors(playerPos, b.root.position);
      toP.y = 0;
      const dist = toP.length();

      // Pulse telegraph opacity (Elden Ring “danger grows”)
      if (b.telegraph && b.state === "telegraph" && b.currentAtk) {
        const u = Math.min(1, b.stateT / Math.max(0.05, b.currentAtk.windup));
        b.telegraph.traverse((o) => {
          if (o.material && o.material.opacity != null) {
            o.material.opacity = 0.25 + u * 0.55;
          }
        });
        // Flash white near commit
        if (u > 0.85) {
          b.telegraph.traverse((o) => {
            if (o.material?.color) o.material.color.setHex(0xffffff);
          });
        }
      }

      switch (b.state) {
        case "idle":
        case "chase": {
          if (dist < b.aggroRange) {
            if (dist > b.attackRange * 0.92) {
              b.state = "chase";
              // Pathfinding on land navmesh when available; else straight line
              let dir = toP.clone();
              if (nav?.findPath && dist > 4) {
                b.pathT = (b.pathT || 0) + dt;
                if (!b.path || b.pathT > 0.45) {
                  b.pathT = 0;
                  try {
                    b.path = nav.findPath(
                      b.root.position.x,
                      b.root.position.z,
                      playerPos.x,
                      playerPos.z,
                    );
                    b.pathI = 1;
                  } catch {
                    b.path = null;
                  }
                }
                if (b.path && b.path.length > 1) {
                  const i = Math.min(b.pathI || 1, b.path.length - 1);
                  const wp = b.path[i];
                  const dx = wp.x - b.root.position.x;
                  const dz = wp.z - b.root.position.z;
                  if (dx * dx + dz * dz < 2.5 * 2.5 && i < b.path.length - 1) {
                    b.pathI = i + 1;
                  }
                  dir.set(dx, 0, dz);
                }
              }
              if (dir.lengthSq() < 1e-6) dir.copy(toP);
              dir.normalize();
              b.root.position.addScaledVector(dir, b.speed * dt);
              // Snap Y to land when nav provides sample
              if (nav?.sampleY) {
                try {
                  const gy = nav.sampleY(b.root.position.x, b.root.position.z);
                  if (Number.isFinite(gy)) b.root.position.y = gy + 0.05 + (b.hoverY || 0);
                } catch {
                  /* ignore */
                }
              }
              b.root.lookAt(playerPos.x, b.root.position.y, playerPos.z);
              this._play(b, "walk", 0.2);
            } else {
              b.path = null;
              // Enter deterministic attack script
              this._beginAttack(b, playerPos);
              this._play(b, b.currentAtk?.clip === "heavy" ? "heavy" : "attack", 0.1);
            }
          } else {
            b.state = "idle";
            b.path = null;
            this._play(b, "idle", 0.25);
          }
          break;
        }
        case "telegraph": {
          b.stateT += dt;
          // Hold facing locked
          b.root.rotation.y = b.aimYaw;
          if (b.stateT >= (b.currentAtk?.windup || 1)) {
            b.state = "active";
            b.stateT = 0;
            b.hitThisActive = false;
            // Launch projectiles at commit (after full windup — fair)
            const atk = b.currentAtk;
            if (atk?.kind === "projectile") {
              const mouth = b.root.position.clone();
              mouth.y += (b.heightM || 2) * 0.55 + (b.hoverY || 0);
              const count = atk.count || 1;
              for (let i = 0; i < count; i++) {
                const impact = b.impactPos.clone();
                if (count > 1) {
                  const spread = (i - (count - 1) / 2) * 1.2;
                  impact.x += Math.cos(b.aimYaw) * spread;
                  impact.z -= Math.sin(b.aimYaw) * spread;
                }
                this.projectiles.spawnFireball(mouth, impact, {
                  speed: atk.projectileSpeed || 20,
                  color: atk.color,
                  radius: atk.radius,
                  dmg: Math.floor(b.dmg * atk.dmgMul),
                  bossId: b.id,
                  bossName: b.name,
                });
              }
            }
          }
          break;
        }
        case "active": {
          b.stateT += dt;
          const atk = b.currentAtk;
          b.root.rotation.y = b.aimYaw;

          if (atk?.kind === "charge") {
            b.root.position.addScaledVector(b.chargeVel, dt);
          }

          // Melee / aoe / charge damage once in active window
          if (
            atk &&
            atk.kind !== "projectile" &&
            !b.hitThisActive &&
            b.stateT >= (atk.active || 0.2) * 0.35
          ) {
            if (this._playerInHit(b, playerPos, atk)) {
              b.hitThisActive = true;
              attacks.push({
                id: b.id,
                damage: Math.floor(b.dmg * atk.dmgMul),
                name: `${b.name} · ${atk.name}`,
              });
            }
          }

          if (b.stateT >= (atk?.active || 0.3)) {
            this._finishActive(b);
          }
          break;
        }
        case "recover": {
          b.stateT += dt;
          this._play(b, "idle", 0.2);
          const rec = b.currentAtk?.recover || 0.6;
          if (b.stateT >= rec) {
            b.state = "idle";
            b.currentAtk = null;
            b.stateT = 0;
          }
          break;
        }
        default:
          break;
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
        state: b.state,
      };
    }
    return out;
  }

  dispose() {
    this.projectiles.dispose();
    for (const b of this.bosses) {
      this._clearTelegraph(b);
      this.scene.remove(b.root);
    }
  }
}
