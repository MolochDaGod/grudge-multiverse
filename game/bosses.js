/**
 * Two island bosses — east / west pads. Multiplayer HP via Firebase.
 */
import * as THREE from "three";

export class BossFight {
  /**
   * @param {THREE.Scene} scene
   * @param {{ id: string, position: THREE.Vector3, name: string }[]} pads
   */
  constructor(scene, pads) {
    this.scene = scene;
    this.bosses = [];
    for (const p of pads) {
      const root = new THREE.Group();
      root.position.copy(p.position);
      // Placeholder boss body (grudge6 kit can replace later)
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.55, 1.4, 6, 12),
        new THREE.MeshStandardMaterial({ color: 0x6a2020, roughness: 0.4, metalness: 0.2 }),
      );
      body.position.y = 1.2;
      body.castShadow = true;
      root.add(body);
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(0.5, 0.6, 6),
        new THREE.MeshStandardMaterial({ color: 0xc8a84b }),
      );
      crown.position.y = 2.5;
      root.add(crown);
      // Arena ring
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(3.2, 3.5, 32),
        new THREE.MeshBasicMaterial({ color: 0xff4444, side: THREE.DoubleSide, transparent: true, opacity: 0.45 }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      root.add(ring);

      scene.add(root);
      this.bosses.push({
        id: p.id,
        name: p.name,
        root,
        body,
        hp: 500,
        maxHp: 500,
        phase: 1,
        dead: false,
        nextAttack: 0,
        aggroRange: 14,
        attackRange: 3.2,
        dmg: 18,
      });
    }
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
      b.dmg = 28;
      b.body.material.color.setHex(0xaa1010);
    }
    if (b.hp <= 0) {
      b.dead = true;
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
    if (b.phase >= 2) b.body.material.color.setHex(0xaa1010);
  }

  /**
   * AI tick: face player, melee pulse when in range.
   * @returns {{ id: string, damage: number }[]} attacks on local player
   */
  update(dt, playerPos) {
    const attacks = [];
    if (!playerPos) return attacks;
    const now = performance.now() / 1000;
    for (const b of this.bosses) {
      if (b.dead) continue;
      const toP = new THREE.Vector3().subVectors(playerPos, b.root.position);
      toP.y = 0;
      const dist = toP.length();
      if (dist < b.aggroRange && dist > 0.2) {
        const dir = toP.normalize();
        b.root.position.addScaledVector(dir, (b.phase === 2 ? 2.8 : 1.8) * dt);
        b.root.lookAt(playerPos.x, b.root.position.y, playerPos.z);
      }
      if (dist < b.attackRange && now >= b.nextAttack) {
        b.nextAttack = now + (b.phase === 2 ? 1.1 : 1.6);
        attacks.push({ id: b.id, damage: b.dmg, name: b.name });
        // pulse scale
        b.body.scale.setScalar(1.15);
        setTimeout(() => b.body.scale.setScalar(1), 120);
      }
    }
    return attacks;
  }

  serialize() {
    const out = {};
    for (const b of this.bosses) {
      out[b.id] = { hp: b.hp, maxHp: b.maxHp, phase: b.phase, dead: b.dead };
    }
    return out;
  }
}
