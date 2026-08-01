/**
 * World loot pickups — boss/equipment drops sparkle in the world; E or walk-over collect.
 */
import * as THREE from "three";
import { addItem, loadBag, saveBag } from "./inventory.js";

export class LootField {
  /**
   * @param {THREE.Scene} scene
   * @param {{ flash?: Function, groundAt?: (x:number,z:number)=>number|null }} opts
   */
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.opts = opts;
    /** @type {{ id: string, root: THREE.Group, item: object, t: number }[]} */
    this.drops = [];
    this._id = 0;
  }

  /**
   * @param {THREE.Vector3} pos
   * @param {object} item bag item
   */
  spawn(pos, item) {
    if (!pos || !item) return null;
    const id = `loot_${++this._id}`;
    const root = new THREE.Group();
    root.name = id;

    const gy =
      this.opts.groundAt?.(pos.x, pos.z) ??
      (typeof pos.y === "number" ? pos.y : 0);
    root.position.set(pos.x, gy + 0.55, pos.z);

    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28, 0),
      new THREE.MeshStandardMaterial({
        color: item.tier >= 1 ? 0xf4c542 : 0x8ec0ff,
        emissive: item.tier >= 1 ? 0x664400 : 0x224466,
        emissiveIntensity: 0.65,
        metalness: 0.4,
        roughness: 0.35,
      }),
    );
    gem.castShadow = true;
    root.add(gem);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.55, 24),
      new THREE.MeshBasicMaterial({
        color: item.tier >= 1 ? 0xf4c542 : 0x6ecbff,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.45;
    root.add(ring);

    root.userData.lootItem = item;
    root.userData.lootId = id;
    this.scene.add(root);
    this.drops.push({ id, root, item, t: 0 });
    this.opts.flash?.(`Drop: ${item.name}`, 0.9);
    return id;
  }

  /** Spawn several items in a small ring around pos. */
  spawnMany(pos, items) {
    const list = (items || []).filter(Boolean);
    list.forEach((it, i) => {
      const a = (i / Math.max(1, list.length)) * Math.PI * 2;
      const p = pos.clone();
      p.x += Math.cos(a) * 0.8;
      p.z += Math.sin(a) * 0.8;
      this.spawn(p, it);
    });
  }

  pickNearest(playerPos, maxDist = 2.4) {
    let best = null;
    let bestD = maxDist;
    for (const d of this.drops) {
      const dist = d.root.position.distanceTo(playerPos);
      if (dist < bestD) {
        bestD = dist;
        best = d;
      }
    }
    return best;
  }

  collect(id) {
    const idx = this.drops.findIndex((d) => d.id === id);
    if (idx < 0) return { ok: false };
    const d = this.drops[idx];
    const bag = loadBag();
    addItem(bag, d.item, d.item.qty || 1);
    saveBag(bag);
    window.dispatchEvent(new CustomEvent("mv-bag", { detail: bag }));
    this.scene.remove(d.root);
    d.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose?.();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.());
        else o.material.dispose?.();
      }
    });
    this.drops.splice(idx, 1);
    this.opts.flash?.(`Picked up ${d.item.name}`, 0.7);
    return { ok: true, item: d.item };
  }

  /** Auto-collect when close; also spins gems. */
  update(dt, playerPos) {
    for (const d of this.drops) {
      d.t += dt;
      d.root.rotation.y += dt * 1.6;
      d.root.position.y += Math.sin(d.t * 3) * 0.002;
      if (playerPos && d.root.position.distanceTo(playerPos) < 1.35) {
        this.collect(d.id);
      }
    }
  }
}
