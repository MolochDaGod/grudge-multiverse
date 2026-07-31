/**
 * Danger Room multiplayer relay client — fleet SSOT protocol (@workspace/danger-net).
 * Connects to Railway gameopen-api: wss://gameopen-production.up.railway.app/api/danger
 *
 * Multiverse uses this as PRIMARY realtime presence; Firebase remains fallback.
 */
export const WS_PATH = "/api/danger";
export const STATE_REPORT_MS = 50;

/** Production Railway host for Danger relay (from gameopen .env.example). */
export const DEFAULT_DANGER_ORIGIN = "https://gameopen-production.up.railway.app";

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

function relayUrl() {
  const configured =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_GAME_SERVER_URL?.trim()) ||
    (typeof window !== "undefined" && window.__MV_GAME_SERVER_URL) ||
    DEFAULT_DANGER_ORIGIN;
  const base = String(configured).replace(/\/+$/, "");
  const wsBase = base.replace(/^http(s?):\/\//i, (_m, s) => `ws${s || ""}://`);
  // already ws?
  if (/^wss?:\/\//i.test(base)) return `${base.replace(/\/+$/, "")}${WS_PATH}`;
  return `${wsBase}${WS_PATH}`;
}

/**
 * Thin DangerClient clone for Multiverse (no monorepo dep).
 */
export class DangerRelay {
  constructor() {
    this.ws = null;
    this.wantOpen = false;
    this.reconnectTimer = null;
    this.outbox = [];
    this.selfId = "";
    this.roomCode = null;
    this.hostId = null;
    this.mode = "coop";
    this.listeners = {
      open: new Set(),
      close: new Set(),
      rooms: new Set(),
      welcome: new Set(),
      snapshot: new Set(),
      joined: new Set(),
      left: new Set(),
      combat: new Set(),
      error: new Set(),
    };
    this._url = relayUrl();
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
        console.warn("[DangerRelay]", event, e);
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
    let ws;
    try {
      ws = new WebSocket(this._url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;
    console.info("[DangerRelay] connecting", this._url);

    ws.onopen = () => {
      for (const f of this.outbox.splice(0)) ws.send(f);
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
      case "rooms":
        this.emit("rooms", msg.rooms);
        break;
      case "welcome":
        this.selfId = msg.self;
        this.roomCode = msg.code;
        this.hostId = msg.hostId;
        this.mode = msg.mode;
        this.emit("welcome", msg);
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
        this.emit("combat", msg.ev);
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

  list() {
    this.send(encode({ t: "list" }));
  }

  create(opts) {
    this.send(
      encode({
        t: "create",
        player: opts.player,
        name: (opts.name || "Multiverse").slice(0, 60),
        mode: opts.mode === "pvp" ? "pvp" : "coop",
        visibility: opts.visibility === "private" ? "private" : "public",
        content: opts.content || { kind: "arena", name: "Multiverse Bermuda", preset: "bermuda" },
      }),
    );
  }

  join(code, player) {
    this.send(encode({ t: "join", code: String(code).toUpperCase(), player }));
  }

  leave() {
    this.roomCode = null;
    this.hostId = null;
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(encode({ t: "leave" }));
  }

  sendState(snap) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(encode({ t: "state", snap }));
  }

  sendCombat(ev) {
    this.send(encode({ t: "combat", ev }));
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
 * Join Multiverse room on Danger relay.
 * Room code from hash (#room1 → MVROOM1) or create public Multiverse room.
 */
export async function connectMultiverseDanger(playerName, roomHint) {
  const client = new DangerRelay();
  const code = (roomHint || "MV1").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8) || "MV1";

  return new Promise((resolve) => {
    let settled = false;
    const done = (ok, err) => {
      if (settled) return;
      settled = true;
      resolve({ client, ok, err, code });
    };

    const t = setTimeout(() => {
      done(false, "timeout");
    }, 8000);

    client.on("open", () => {
      // Prefer join existing Multiverse code; if fail, create
      client.join(code, playerName);
    });

    client.on("welcome", (msg) => {
      clearTimeout(t);
      done(true);
      console.info("[DangerRelay] welcome", msg.code, "players", msg.players?.length);
    });

    client.on("error", (c, message) => {
      if (c === "not_found" || c === "room_full") {
        client.create({
          player: playerName,
          name: `Multiverse ${code}`,
          mode: "coop",
          visibility: "public",
          content: { kind: "arena", name: "Bermuda", preset: "bermuda" },
        });
      } else {
        console.warn("[DangerRelay] error", c, message);
      }
    });

    client.on("close", () => {
      /* reconnect handles */
    });

    try {
      client.connect();
    } catch (e) {
      clearTimeout(t);
      done(false, e);
    }
  });
}
