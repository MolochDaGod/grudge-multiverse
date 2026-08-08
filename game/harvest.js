/**
 * Resource node harvest — multiplayer-aware + Valheim-style multi-chunk.
 * Rocks: strip chunks (scale weld + debris) until fully mined.
 * Trees: stage chops until fall / clear.
 */
import * as THREE from "three";
import { addItem, loadBag, saveBag } from "./inventory.js";

export class HarvestSystem {
  /**
   * @param {THREE.Scene} scene
   * @param {object[]} nodes from island.harvestNodes
   * @param {{ flash?: Function, onBreak?: Function, onChunk?: Function, nature?: object, db?: any, roomRef?: any }} opts
   */
  constructor(scene, nodes, opts = {}) {
    this.scene = scene;
    this.nodes = new Map();
    this.opts = opts;
    for (const n of nodes) {
      this._register(n);
    }
  }

  _register(n) {
    const chunks =
      n.chunks ??
      n.maxChunks ??
      (n.chunkMode ? (n.kind === "rock" ? 6 : 4) : 1);
    const maxChunks = n.maxChunks ?? chunks;
    this.nodes.set(n.id, {
      ...n,
      chunks,
      maxChunks,
      broken: false,
      respawnAt: 0,
      _chunkBaseScale: n.object?.scale?.x || 1,
    });
  }

  /** Hot-add nodes from natureField after island boot */
  addNodes(nodes = []) {
    for (const n of nodes) {
      if (!n?.id || this.nodes.has(n.id)) continue;
      this._register(n);
    }
  }

  getNode(id) {
    return this.nodes.get(id);
  }

  /** Raycast from player for harvest target */
  pick(origin, dir, maxDist = 6) {
    const ray = new THREE.Raycaster(origin, dir.normalize(), 0, maxDist);
    // Tall Valheim rocks need longer pick range (exposed face)
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

  /**
   * Apply harvest swing. Multi-chunk nodes strip parts before full break.
   */
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

    const perChunk = Math.max(1, Math.floor(n.maxHp / Math.max(1, n.maxChunks)));
    const chunksLeftIdeal = Math.ceil(n.hp / perChunk);
    const prevChunks = n.chunks;
    if (n.maxChunks > 1 && chunksLeftIdeal < n.chunks) {
      n.chunks = Math.max(0, chunksLeftIdeal);
      // Partial loot each stripped chunk
      const stripped = prevChunks - n.chunks;
      if (stripped > 0) {
        this._grantLoot(n, stripped);
        this._onChunkStrip(n, stripped);
      }
    }

    this.opts.flash?.(
      `${n.kind}${n.valheimRock ? " 20m" : ""} −${dmg} · chunk ${n.chunks}/${n.maxChunks} (${n.hp}/${n.maxHp})`,
      0.45,
    );

    if (n.hp <= 0 || n.chunks <= 0) {
      n.hp = 0;
      n.chunks = 0;
      n.broken = true;
      if (n.object) n.object.visible = false;
      n.respawnAt = performance.now() + (n.nature ? 90000 : 45000);
      // Final loot if last strip didn't grant
      if (prevChunks <= 1) this._grantLoot(n, 1);
      this.opts.onBreak?.(n);
      this.opts.flash?.(
        `Cleared ${n.kind}${n.protoId ? ` (${n.protoId})` : ""}`,
        0.85,
      );
      return {
        ok: true,
        broken: true,
        materialId: n.materialId,
        chunks: 0,
      };
    }
    return {
      ok: true,
      broken: false,
      hp: n.hp,
      chunks: n.chunks,
      maxChunks: n.maxChunks,
    };
  }

  _grantLoot(n, chunkCount = 1) {
    const bag = loadBag();
    const qty = Math.max(1, chunkCount) * (1 + Math.floor(Math.random() * 2));
    addItem(bag, {
      id: n.materialId || (n.kind === "tree" ? "t0_wood" : "t0_stone"),
      name: n.kind === "tree" ? "Wood" : "Stone",
      tier: 0,
      slot: "mat",
      qty,
    });
    saveBag(bag);
    window.dispatchEvent(new CustomEvent("mv-bag", { detail: bag }));
  }

  _onChunkStrip(n, stripped) {
    const nature = this.opts.nature;
    if (nature?.spawnChunkDebris) {
      for (let i = 0; i < stripped; i++) {
        nature.spawnChunkDebris(n, n.kind);
      }
    }
    if (nature?.applyChunkVisual) {
      nature.applyChunkVisual(n);
    } else if (n.object && n.maxChunks > 1) {
      const frac = Math.max(0.15, n.chunks / n.maxChunks);
      const base = n._chunkBaseScale || 1;
      n.object.scale.setScalar(base * (0.5 + 0.5 * frac));
      if (n.kind === "rock" && Number.isFinite(n.groundY) && n.siHeight) {
        const h = n.siHeight * frac;
        const bury = h * (n.buryFrac ?? 0.4);
        n.object.position.y = n.groundY - bury;
      }
    }
    this.opts.onChunk?.(n, stripped);
  }

  applyRemoteState(id, hp, broken, chunks) {
    const n = this.nodes.get(id);
    if (!n) return;
    n.hp = hp;
    n.broken = !!broken;
    if (typeof chunks === "number") n.chunks = chunks;
    if (n.object) {
      n.object.visible = !n.broken;
      if (!n.broken && n.maxChunks > 1) {
        this.opts.nature?.applyChunkVisual?.(n);
      }
    }
  }

  update(dt = 0.016) {
    const now = performance.now();
    for (const n of this.nodes.values()) {
      if (n.broken && n.respawnAt && now >= n.respawnAt) {
        n.broken = false;
        n.hp = n.maxHp;
        n.chunks = n.maxChunks;
        n.respawnAt = 0;
        if (n.object) {
          n.object.visible = true;
          n.object.scale.setScalar(n._chunkBaseScale || 1);
          if (n.kind === "rock" && Number.isFinite(n.groundY) && n.siHeight) {
            const bury = n.siHeight * (n.buryFrac ?? 0.4);
            n.object.position.y = n.groundY - bury;
          }
        }
        if (n.forestTreeIndex != null && this.opts.nature?.forest) {
          this.opts.nature.forest.setTreeVisible(n.forestTreeIndex, true);
          this.opts.nature.forest.setTreeChunkScale(n.forestTreeIndex, 1);
        }
      }
    }
    // nature.update(dt, camera?) — camera optional for forest cull
    this.opts.nature?.update?.(dt, this.opts.getCamera?.());
  }

  serializePublic() {
    const out = {};
    for (const [id, n] of this.nodes) {
      out[id] = { hp: n.hp, broken: n.broken, chunks: n.chunks };
    }
    return out;
  }
}
