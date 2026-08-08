/**
 * Multiverse realtime client — **dedicated Multiverse Railway room server**.
 *
 * Fleet rule: each game has its own Railway service.
 *   Multiverse → grudge-multiverse-room (this file)
 *   NOT gameopen-production /api/danger (404 / wrong game)
 *   Firebase is optional social/harvest only — never the multiplayer authority.
 *
 * Production WS: wss://<multiverse-railway>/api/mv?room=room1
 */
export const WS_PATH = "/api/mv";
export const STATE_REPORT_MS = 50;

/**
 * Dedicated Multiverse Railway origin.
 * Override: VITE_MV_GAME_SERVER_URL or window.__MV_GAME_SERVER_URL
 * Never fall back to gameopen-production (different game).
 */
export const DEFAULT_MV_RAILWAY =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_MV_GAME_SERVER_URL?.trim()) ||
  (typeof window !== "undefined" && window.__MV_GAME_SERVER_URL) ||
  // Set after first deploy; also try common public host names
  "https://grudge-multiverse-room-production.up.railway.app";

export function encode(msg) {
  return JSON.stringify(msg);
}

export function decodeServer(raw) {
  try {
    const m = JSON.parse(raw);
    if (m && typeof m === "object" && typeof m.t === "string") return m;
  } catch {
    /* drop */
  }
  return null;
}

function httpToWs(base) {
  const b = String(base).replace(/\/+$/, "");
  if (/^wss?:\/\//i.test(b)) return b;
  return b.replace(/^http(s?):\/\//i, (_m, s) => `ws${s || ""}://`);
}

/**
 * Build WS URL for Multiverse room server.
 * @param {string} roomHint e.g. room1 / MVROOM1
 */
/**
 * @param {string} roomHint e.g. room1 / MVROOM1
 * @param {string} [seed] world seed (Valheim-style) — locked per room on server
 */
export function multiverseWsUrl(roomHint, seed) {
  const room = String(roomHint || "room1")
    .replace(/^MV/i, "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .toLowerCase()
    .slice(0, 32) || "room1";
  const origin =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_MV_GAME_SERVER_URL?.trim()) ||
    (typeof window !== "undefined" && window.__MV_GAME_SERVER_URL) ||
    DEFAULT_MV_RAILWAY;
  const wsBase = httpToWs(origin);
  let q = `room=${encodeURIComponent(room)}`;
  if (seed) {
    const s = String(seed)
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, "")
      .slice(0, 24);
    if (s) q += `&seed=${encodeURIComponent(s)}`;
  }
  return `${wsBase}${WS_PATH}?${q}`;
}

/**
 * Multiverse room client (own Railway).
 */
export class DangerRelay {
  constructor(roomHint = "room1", seed = null) {
    this.ws = null;
    this.wantOpen = false;
    this.reconnectTimer = null;
    this.outbox = [];
    this.selfId = "";
    this.roomCode = null;
    this.hostId = null;
    this.mode = "coop";
    this.roomHint = roomHint;
    this.seed = seed || null;
    this.world = null;
    this.playerName = "Player";
    this.classId = "warrior";
    this.raceId = "western-kingdoms";
    this.backend = "multiverse-railway";
    this.listeners = {
      open: new Set(),
      close: new Set(),
      rooms: new Set(),
      welcome: new Set(),
      snapshot: new Set(),
      joined: new Set(),
      left: new Set(),
      combat: new Set(),
      chat: new Set(),
      error: new Set(),
      world: new Set(),
    };
    this._url = multiverseWsUrl(roomHint, this.seed);
  }

  on(event, cb) {
    this.listeners[event]?.add(cb);
    return () => this.listeners[event]?.delete(cb);
  }

  emit(event, ...args) {
    for (const cb of this.listeners[event] || []) {
      try {
        cb(...args);
      } catch (e) {
        console.warn("[MvRelay]", event, e);
      }
    }
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect() {
    this.wantOpen = true;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this._url = multiverseWsUrl(this.roomHint, this.seed);
    let ws;
    try {
      ws = new WebSocket(this._url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;
    console.info("[MvRelay] connecting Multiverse Railway", this._url);

    ws.onopen = () => {
      // Identify to room server (+ optional seed request)
      this.send(
        encode({
          t: "hello",
          name: this.playerName,
          classId: this.classId,
          raceId: this.raceId,
          animPack: this.animPack || undefined,
          seed: this.seed || undefined,
        }),
      );
      for (const f of this.outbox.splice(0)) {
        try {
          ws.send(f);
        } catch {
          /* */
        }
      }
      this.emit("open");
    };
    ws.onclose = () => {
      this.emit("close");
      if (this.wantOpen) this.scheduleReconnect();
    };
    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        /* */
      }
    };
    ws.onmessage = (e) => this.handle(typeof e.data === "string" ? e.data : "");
  }

  scheduleReconnect() {
    if (this.reconnectTimer || !this.wantOpen) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 1600);
  }

  handle(raw) {
    const msg = decodeServer(raw);
    if (!msg) return;
    switch (msg.t) {
      case "welcome":
        this.selfId = msg.self;
        this.roomCode = msg.code;
        this.hostId = msg.hostId;
        this.mode = msg.mode || "coop";
        if (msg.seed) this.seed = msg.seed;
        if (msg.world) this.world = msg.world;
        if (typeof window !== "undefined") {
          window.__mvWorldSeed = this.seed;
          window.__mvWorldWelcome = msg.world || null;
        }
        this.emit("welcome", msg);
        break;
      case "world":
        if (msg.seed) this.seed = msg.seed;
        if (msg.world) this.world = msg.world;
        this.emit("world", msg);
        break;
      case "snapshot":
        this.emit("snapshot", msg.players, msg.time);
        break;
      case "joined":
        this.emit("joined", msg.player);
        break;
      case "left":
        this.emit("left", msg.id);
        break;
      case "combat":
        // Full envelope: { id, name, ev, time } so remotes can play VFX + apply PvP
        this.emit("combat", msg);
        break;
      case "chat":
        this.emit("chat", msg);
        break;
      case "error":
        this.emit("error", msg.code, msg.message);
        break;
      case "host":
        this.hostId = msg.id;
        break;
      default:
        break;
    }
  }

  send(frame) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(frame);
    else {
      this.outbox.push(frame);
      if (this.outbox.length > 16) this.outbox.shift();
    }
  }

  /** Room is selected via ?room= on the WS URL — no lobby create/join messages. */
  list() {}
  create() {}
  join() {}

  leave() {
    this.roomCode = null;
    this.hostId = null;
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(encode({ t: "leave" }));
  }

  sendState(snap) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        encode({
          t: "state",
          name: this.playerName,
          snap,
        }),
      );
    }
  }

  sendCombat(ev) {
    this.send(encode({ t: "combat", ev }));
  }

  /** Report measured Bermuda landRadius so room re-bakes world at SI scale. */
  sendWorldMeta({ landRadius, seed } = {}) {
    this.send(
      encode({
        t: "world_meta",
        landRadius: Number(landRadius) || undefined,
        seed: seed || this.seed || undefined,
      }),
    );
  }

  dispose() {
    this.wantOpen = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        /* */
      }
      this.ws = null;
    }
  }
}

/**
 * Connect to **Multiverse Railway** room (not Firebase, not gameopen).
 * @param {string} playerName
 * @param {string} roomHint hash room e.g. room1 or MVroom1
 * @param {{ classId?: string, raceId?: string }} [meta]
 */
export async function connectMultiverseDanger(playerName, roomHint, meta = {}) {
  const hint = (roomHint || "room1").replace(/^MV/i, "") || "room1";
  // seed from meta or ?seed=
  let seed = meta.seed || null;
  if (!seed && typeof window !== "undefined") {
    try {
      seed = new URLSearchParams(window.location.search).get("seed");
    } catch {
      /* */
    }
  }
  const client = new DangerRelay(hint, seed);
  client.playerName = String(playerName || "Player").slice(0, 24);
  client.classId = meta.classId || localStorage.getItem("mv_class_id") || "warrior";
  client.raceId = meta.raceId || localStorage.getItem("mv_race_id") || "western-kingdoms";
  client.seed = seed;

  return new Promise((resolve) => {
    let settled = false;
    const done = (ok, err) => {
      if (settled) return;
      settled = true;
      resolve({
        client,
        ok,
        err,
        code: client.roomCode || hint,
        seed: client.seed,
        world: client.world,
        backend: "multiverse-railway",
      });
    };

    const t = setTimeout(() => {
      done(false, "timeout");
    }, 10000);

    client.on("welcome", (msg) => {
      clearTimeout(t);
      done(true);
      console.info(
        "[MvRelay] welcome Multiverse Railway room=",
        msg.code,
        "self=",
        msg.self,
        "peers=",
        msg.players?.length,
      );
    });

    client.on("error", (c, message) => {
      console.warn("[MvRelay] error", c, message);
      if (c === "room_full") {
        clearTimeout(t);
        done(false, "room_full");
      }
    });

    client.on("close", () => {
      /* reconnect loop; only fail if never welcomed */
    });

    try {
      client.connect();
    } catch (e) {
      clearTimeout(t);
      done(false, e);
    }
  });
}
