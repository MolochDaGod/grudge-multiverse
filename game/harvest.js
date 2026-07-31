/**
 * Resource node harvest — multiplayer-aware (local + Firebase node HP).
 */
import * as THREE from "three";
import { addItem, loadBag, saveBag } from "./inventory.js";

export class HarvestSystem {
  /**
   * @param {THREE.Scene} scene
   * @param {object[]} nodes from island.harvestNodes
   * @param {{ flash?: Function, onBreak?: Function, db?: any, roomRef?: any }} opts
   */
  constructor(scene, nodes, opts = {}) {
    this.scene = scene;
    this.nodes = new Map();
    this.opts = opts;
    for (const n of nodes) {
      this.nodes.set(n.id, {
        ...n,
        broken: false,
        respawnAt: 0,
      });
    }
  }

  getNode(id) {
    return this.nodes.get(id);
  }

  /** Raycast from player for harvest target */
  pick(origin, dir, maxDist = 4) {
    const ray = new THREE.Raycaster(origin, dir.normalize(), 0, maxDist);
    const meshes = [];
    for (const n of this.nodes.values()) {
      if (n.broken || !n.object) continue;
      n.object.traverse((o) => {
        if (o.isMesh) meshes.push(o);
      });
    }
    const hits = ray.intersectObjects(meshes, true);
    if (!hits[0]) return null;
    let o = hits[0].object;
    while (o && !o.userData.harvestId && o.parent) o = o.parent;
    const id = o?.userData?.harvestId;
    return id ? this.nodes.get(id) : null;
  }

  hit(id, tool, power = 12) {
    const n = this.nodes.get(id);
    if (!n || n.broken) return { ok: false };
    const match =
      tool === "any" ||
      tool === n.tool ||
      (tool === "axe" && n.kind === "tree") ||
      (tool === "pick" && n.kind === "rock");
    const dmg = Math.max(1, Math.floor(power * (match ? 1 : 0.45)));
    n.hp = Math.max(0, n.hp - dmg);
    this.opts.flash?.(`${n.kind} −${dmg} (${n.hp}/${n.maxHp})`, 0.4);
    if (n.hp <= 0) {
      n.broken = true;
      n.object.visible = false;
      n.respawnAt = performance.now() + 45000;
      const bag = loadBag();
      addItem(bag, {
        id: n.materialId,
        name: n.kind === "tree" ? "Wood" : "Stone",
        tier: 0,
        slot: "mat",
        qty: 1 + Math.floor(Math.random() * 2),
      });
      saveBag(bag);
      this.opts.onBreak?.(n);
      this.opts.flash?.(`Harvested ${n.kind}!`, 0.8);
      return { ok: true, broken: true, materialId: n.materialId };
    }
    return { ok: true, broken: false, hp: n.hp };
  }

  applyRemoteState(id, hp, broken) {
    const n = this.nodes.get(id);
    if (!n) return;
    n.hp = hp;
    n.broken = !!broken;
    if (n.object) n.object.visible = !n.broken;
  }

  update() {
    const now = performance.now();
    for (const n of this.nodes.values()) {
      if (n.broken && n.respawnAt && now >= n.respawnAt) {
        n.broken = false;
        n.hp = n.maxHp;
        n.respawnAt = 0;
        if (n.object) n.object.visible = true;
      }
    }
  }

  serializePublic() {
    const out = {};
    for (const [id, n] of this.nodes) {
      out[id] = { hp: n.hp, broken: n.broken };
    }
    return out;
  }
}
