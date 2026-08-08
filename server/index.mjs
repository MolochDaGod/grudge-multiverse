/**
 * Grudge Multiverse — dedicated Railway room server
 *
 * Fleet rule: **each new game gets its own Railway service**.
 * Do NOT share gameopen-production /api/danger for Multiverse.
 *
 * Endpoints:
 *   GET  /health  /api/health  /api/healthz  → JSON ok
 *   WS   /api/mv?room=ROOM1                  → Multiverse rooms only
 *
 * NOT Carrier (/api/carrier) — Carrier is GRUDOX space / RTS. Multiverse is separate.
 *
 * Wire protocol (JSON, `t` tag) — Multiverse room client:
 *   Client → Server: { t: "hello", id, name, classId, raceId }
 *                    { t: "state", id, name, snap }
 *                    { t: "combat", id, ev }  // dodge|parry|block|slide|skill|hit
 *                    { t: "boss", id, bossId, hp, telegraph }
 *                    { t: "chat", id, name, text }
 *   Server → Client: { t: "welcome", self, code, peers, tickHz }
 *                    { t: "joined", player }
 *                    { t: "left", id }
 *                    { t: "snapshot", time, players }
 *                    { t: "combat", ev }
 *                    { t: "boss", ... }
 *                    { t: "chat", ... }
 *
 * Combat events (DRC fleet): kind = dodge|parry|parrySuccess|block|slide|doubleJump|skill|hit
 */
import http from "node:http";
import { WebSocketServer } from "ws";
import { randomBytes } from "node:crypto";
import {
  generateWorld,
  worldWelcomePayload,
  normalizeSeedLabel,
  resolveSeedFromContext,
  DEFAULT_WORLD_SEED,
  WORLD_GEN_VERSION,
  WORLD_SCHEMA,
} from "./worldSeedGen.mjs";

/** Play contract stamp — clients refuse mismatch for shared assets */
const PLAY_CONTRACT = process.env.WARLORDS_PLAY_CONTRACT || "2026-08-08.valheim42.1";
const MP_PROTOCOL = "grudge.multiverse.mp/v1";

const PORT = Number(process.env.PORT || 8787);
const TICK_MS = Number(process.env.TICK_MS || 50); // 20 Hz snapshots
const STALE_MS = Number(process.env.STALE_MS || 15000);
const MAX_PER_ROOM = Number(process.env.MAX_PER_ROOM || 16);
const SERVICE = "grudge-multiverse-room";
/** Default land radius for seed gen when client has not measured Bermuda yet. */
const DEFAULT_LAND_RADIUS = Number(process.env.WORLD_LAND_RADIUS || 320);

/** @type {Map<string, Room>} */
const rooms = new Map();

const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ||
  [
    "https://grudge-multiverse.vercel.app",
    "https://multiverse.grudge-studio.com",
    "https://gameopen.vercel.app",
    "https://open.grudge-studio.com",
    "http://localhost:5195",
    "http://127.0.0.1:5195",
    "http://localhost:5173",
  ].join(",")
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function corsOk(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/\.vercel\.app$/i.test(origin)) return true;
  if (/\.grudge-studio\.com$/i.test(origin)) return true;
  if (/^http:\/\/localhost(:\d+)?$/i.test(origin)) return true;
  return false;
}

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(data),
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
  });
  res.end(data);
}

function newId() {
  return randomBytes(4).toString("hex");
}

class Room {
  /**
   * @param {string} code
   * @param {string} [seedLabel]
   */
  constructor(code, seedLabel) {
    this.code = code;
    /** @type {Map<string, Player>} */
    this.players = new Map();
    this.createdAt = Date.now();
    // Valheim-style: room locks world seed at create time (first joiner / query)
    this.seed = normalizeSeedLabel(
      seedLabel ||
        resolveSeedFromContext({ roomCode: code }) ||
        DEFAULT_WORLD_SEED,
    );
    this.landRadius = DEFAULT_LAND_RADIUS;
    this.world = generateWorld(this.seed, {
      landRadius: this.landRadius,
      density: 1.15,
    });
  }

  /** Recompute world if landRadius updated (first client reports SI measure). */
  setLandRadius(r) {
    const n = Number(r);
    if (!Number.isFinite(n) || n < 80 || n > 2000) return false;
    if (Math.abs(n - this.landRadius) < 1) return false;
    this.landRadius = n;
    this.world = generateWorld(this.seed, {
      landRadius: this.landRadius,
      density: 1.15,
    });
    return true;
  }

  /** @param {import('ws').WebSocket} ws */
  add(ws, hello) {
    if (this.players.size >= MAX_PER_ROOM) {
      return { ok: false, error: "room_full" };
    }
    const id = hello?.id && !this.players.has(hello.id) ? String(hello.id).slice(0, 16) : newId();
    const player = {
      id,
      name: String(hello?.name || "Player").slice(0, 24),
      classId: String(hello?.classId || "warrior").slice(0, 24),
      raceId: String(hello?.raceId || "western-kingdoms").slice(0, 32),
      ws,
      snap: null,
      lastSeen: Date.now(),
      joinedAt: Date.now(),
    };
    this.players.set(id, player);
    return { ok: true, player };
  }

  remove(id) {
    this.players.delete(id);
  }

  prune() {
    const now = Date.now();
    for (const [id, p] of this.players) {
      if (now - p.lastSeen > STALE_MS || p.ws.readyState !== 1) {
        try {
          p.ws.close();
        } catch {
          /* */
        }
        this.players.delete(id);
        this.broadcast({ t: "left", id }, id);
      }
    }
  }

  broadcast(msg, exceptId = null) {
    const raw = JSON.stringify(msg);
    for (const [id, p] of this.players) {
      if (exceptId && id === exceptId) continue;
      if (p.ws.readyState === 1) {
        try {
          p.ws.send(raw);
        } catch {
          /* */
        }
      }
    }
  }

  snapshot() {
    const players = [];
    for (const p of this.players.values()) {
      players.push({
        id: p.id,
        name: p.name,
        classId: p.classId,
        raceId: p.raceId,
        animPack: p.animPack || p.snap?.animPack || null,
        ...(p.snap || {}),
      });
    }
    return {
      t: "snapshot",
      time: Date.now(),
      players,
    };
  }
}

/**
 * @param {string} code
 * @param {string} [seedFromQuery]
 */
function getRoom(code, seedFromQuery) {
  const key = String(code || "room1")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 32)
    .toLowerCase() || "room1";
  let room = rooms.get(key);
  if (!room) {
    room = new Room(key, seedFromQuery);
    rooms.set(key, room);
    console.info(
      `[${SERVICE}] room=${key} seed=${room.seed} world=${room.world.summary}`,
    );
  }
  return room;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const path = url.pathname;

  if (req.method === "OPTIONS") {
    const origin = req.headers.origin || "*";
    res.writeHead(204, {
      "Access-Control-Allow-Origin": corsOk(origin) ? origin : ALLOWED_ORIGINS[0],
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Access-Control-Max-Age": "86400",
    });
    res.end();
    return;
  }

  if (path === "/health" || path === "/api/health" || path === "/api/healthz") {
    json(res, 200, {
      status: "ok",
      service: SERVICE,
      rooms: rooms.size,
      players: [...rooms.values()].reduce((n, r) => n + r.players.size, 0),
      time: new Date().toISOString(),
      ws: ["/api/mv"],
      worldSchema: WORLD_SCHEMA,
      worldGen: WORLD_GEN_VERSION,
    });
    return;
  }

  // Valheim-style world seed API (authoritative generate; same as welcome.world)
  if (path === "/api/world" || path === "/api/mv/world") {
    const seed = normalizeSeedLabel(
      url.searchParams.get("seed") || DEFAULT_WORLD_SEED,
    );
    const landRadius = Number(url.searchParams.get("landRadius") || DEFAULT_LAND_RADIUS);
    const density = Number(url.searchParams.get("density") || 1.15);
    const world = generateWorld(seed, { landRadius, density });
    const full = url.searchParams.get("full") === "1";
    json(res, 200, full ? world : worldWelcomePayload(world));
    return;
  }

  if (path === "/api/rooms" || path === "/api/mv/rooms") {
    const list = [...rooms.values()].map((r) => ({
      code: r.code,
      seed: r.seed,
      players: r.players.size,
      summary: r.world?.summary,
    }));
    json(res, 200, { rooms: list, gen: WORLD_GEN_VERSION });
    return;
  }

  if (path === "/" || path === "/api/fleet") {
    json(res, 200, {
      service: SERVICE,
      game: "grudge-multiverse",
      health: "/api/health",
      world: "/api/world?seed=VALHEIM42",
      ws: "wss://<host>/api/mv?room=room1&seed=VALHEIM42",
      note: "Dedicated Multiverse Railway only — not Carrier, not gameopen",
      worldGen: WORLD_GEN_VERSION,
      grudgeInfo: "https://info.grudge-studio.com/docs",
    });
    return;
  }

  json(res, 404, { error: "not_found", path });
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const path = url.pathname;
  // Multiverse rooms only — never Carrier (space/RTS) or Open gameopen paths
  if (path !== "/api/mv") {
    socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }

  const origin = req.headers.origin;
  if (origin && !corsOk(origin)) {
    socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req, url);
  });
});

wss.on("connection", (ws, _req, url) => {
  const roomCode = url.searchParams.get("room") || "room1";
  const seedQ = url.searchParams.get("seed") || null;
  const room = getRoom(roomCode, seedQ);
  /** @type {string|null} */
  let selfId = null;

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(String(data));
    } catch {
      return;
    }
    if (!msg || typeof msg.t !== "string") return;

    if (msg.t === "hello" || msg.t === "join") {
      if (selfId) return;
      const res = room.add(ws, {
        id: msg.id,
        name: msg.player || msg.name,
        classId: msg.classId,
        raceId: msg.raceId,
        animPack: msg.animPack,
      });
      if (!res.ok) {
        ws.send(JSON.stringify({ t: "error", code: res.error, message: "Room full" }));
        ws.close();
        return;
      }
      selfId = res.player.id;
      if (msg.animPack) res.player.animPack = String(msg.animPack).slice(0, 32);
      const roster = [...room.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        classId: p.classId,
        raceId: p.raceId,
        animPack: p.animPack || null,
      }));
      ws.send(
        JSON.stringify({
          t: "welcome",
          self: selfId,
          code: room.code,
          mode: "coop",
          hostId: roster[0]?.id || selfId,
          players: roster,
          tickHz: Math.round(1000 / TICK_MS),
          content: {
            kind: "island",
            name: "Bermuda",
            preset: "bermuda",
            seed: room.seed,
          },
          seed: room.seed,
          world: worldWelcomePayload(room.world),
          protocol: MP_PROTOCOL,
          worldGen: WORLD_GEN_VERSION,
          warlordsPlay: PLAY_CONTRACT,
          requireToon: true,
          forbidCapsule: true,
        }),
      );
      room.broadcast(
        {
          t: "joined",
          player: {
            id: res.player.id,
            name: res.player.name,
            classId: res.player.classId,
            raceId: res.player.raceId,
            animPack: res.player.animPack || null,
          },
        },
        selfId,
      );
      return;
    }

    if (!selfId) {
      // Auto-hello if client only sends state (late first packet)
      const res = room.add(ws, { name: msg.name || "Player" });
      if (!res.ok) {
        ws.send(JSON.stringify({ t: "error", code: res.error, message: "Room full" }));
        ws.close();
        return;
      }
      selfId = res.player.id;
      ws.send(
        JSON.stringify({
          t: "welcome",
          self: selfId,
          code: room.code,
          mode: "coop",
          hostId: selfId,
          players: [...room.players.values()].map((p) => ({
            id: p.id,
            name: p.name,
          })),
          tickHz: Math.round(1000 / TICK_MS),
          seed: room.seed,
          world: worldWelcomePayload(room.world),
        }),
      );
    }

    const me = room.players.get(selfId);
    if (!me) return;
    me.lastSeen = Date.now();

    // Client reports measured Bermuda landRadius so seed content snaps correctly
    if (msg.t === "world_meta" && msg.landRadius) {
      if (room.setLandRadius(msg.landRadius)) {
        room.broadcast({
          t: "world",
          seed: room.seed,
          world: worldWelcomePayload(room.world),
        });
      }
      return;
    }

    if (msg.t === "state") {
      const snap = msg.snap || msg;
      if (snap.classId) me.classId = String(snap.classId).slice(0, 24);
      if (snap.raceId) me.raceId = String(snap.raceId).slice(0, 32);
      if (snap.animPack) me.animPack = String(snap.animPack).slice(0, 32);
      const meshIds = Array.isArray(snap.meshIds)
        ? snap.meshIds.slice(0, 24).map((x) => String(x).slice(0, 64))
        : me.snap?.meshIds || [];
      me.snap = {
        px: Number(snap.px) || 0,
        py: Number(snap.py) || 0,
        pz: Number(snap.pz) || 0,
        ry: Number(snap.ry) || 0,
        clip: String(snap.clip || "idle").slice(0, 32),
        weapon: String(snap.weapon || "").slice(0, 24),
        hp: Math.max(0, Math.min(200, Number(snap.hp ?? 100))),
        stamina: Math.max(0, Math.min(100, Number(snap.stamina ?? 100))),
        combat: String(snap.combat || "idle").slice(0, 24),
        moving: !!snap.moving,
        sprinting: !!snap.sprinting,
        grounded: snap.grounded !== false,
        dead: !!snap.dead,
        focus: !!snap.focus,
        classId: me.classId,
        raceId: me.raceId,
        animPack: me.animPack || snap.animPack || null,
        meshIds,
        name: me.name,
      };
      if (msg.name || snap.name) me.name = String(msg.name || snap.name).slice(0, 24);
      return;
    }

    if (msg.t === "combat" && msg.ev) {
      const ev = typeof msg.ev === "object" ? msg.ev : { kind: String(msg.ev) };
      const kind = String(ev.kind || "hit").slice(0, 32);
      // Simple rate limit + PvP damage clamp (anti-spam / sanity)
      me._combatLast = me._combatLast || 0;
      const now = Date.now();
      if (now - me._combatLast < 40) return; // max ~25 combat events/s
      me._combatLast = now;
      let safeEv = {
        kind,
        skill: ev.skill ? String(ev.skill).slice(0, 32) : undefined,
        name: ev.name ? String(ev.name).slice(0, 32) : undefined,
        vfx: ev.vfx ? String(ev.vfx).slice(0, 16) : undefined,
        dist: Number.isFinite(ev.dist) ? Math.min(20, Math.max(0, Number(ev.dist))) : undefined,
        aoeR: Number.isFinite(ev.aoeR) ? Math.min(12, Math.max(0, Number(ev.aoeR))) : undefined,
        x: Number.isFinite(ev.x) ? Number(ev.x) : undefined,
        y: Number.isFinite(ev.y) ? Number(ev.y) : undefined,
        z: Number.isFinite(ev.z) ? Number(ev.z) : undefined,
        dx: Number.isFinite(ev.dx) ? Number(ev.dx) : undefined,
        dz: Number.isFinite(ev.dz) ? Number(ev.dz) : undefined,
        color: Number.isFinite(ev.color) ? Number(ev.color) : undefined,
        blink: !!ev.blink,
      };
      if (kind === "pvp") {
        const dmg = Math.max(1, Math.min(80, Math.floor(Number(ev.dmg) || 0)));
        const targetId = String(ev.targetId || "").slice(0, 16);
        if (!targetId || !room.players.has(targetId)) return;
        safeEv = { ...safeEv, targetId, dmg };
      }
      room.broadcast(
        {
          t: "combat",
          id: selfId,
          name: me.name,
          ev: safeEv,
          time: now,
        },
        null,
      );
      return;
    }

    if (msg.t === "boss" && msg.bossId) {
      room.broadcast(
        {
          t: "boss",
          id: selfId,
          bossId: String(msg.bossId).slice(0, 48),
          hp: Number(msg.hp),
          maxHp: Number(msg.maxHp),
          telegraph: msg.telegraph ? String(msg.telegraph).slice(0, 64) : null,
          dead: !!msg.dead,
          time: Date.now(),
        },
        null,
      );
      return;
    }

    if (msg.t === "chat" && msg.text) {
      room.broadcast(
        {
          t: "chat",
          id: selfId,
          name: me.name,
          text: String(msg.text).slice(0, 200),
          time: Date.now(),
        },
        null,
      );
      return;
    }

    if (msg.t === "leave") {
      room.remove(selfId);
      room.broadcast({ t: "left", id: selfId });
      selfId = null;
      ws.close();
    }
  });

  ws.on("close", () => {
    if (!selfId) return;
    room.remove(selfId);
    room.broadcast({ t: "left", id: selfId });
    if (room.players.size === 0) rooms.delete(room.code);
  });

  ws.on("error", () => {
    /* close handler cleans */
  });
});

// Snapshot tick
setInterval(() => {
  for (const room of rooms.values()) {
    room.prune();
    if (room.players.size === 0) {
      rooms.delete(room.code);
      continue;
    }
    const snap = room.snapshot();
    const raw = JSON.stringify(snap);
    for (const p of room.players.values()) {
      if (p.ws.readyState === 1) {
        try {
          p.ws.send(raw);
        } catch {
          /* */
        }
      }
    }
  }
}, TICK_MS);

server.listen(PORT, "0.0.0.0", () => {
  console.info(
    `[${SERVICE}] listening :${PORT}  ws=/api/mv?room=room1  max=${MAX_PER_ROOM}/room`,
  );
});
