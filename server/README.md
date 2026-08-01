# Grudge Multiverse — Railway room server

**Fleet rule:** each new game gets **its own Railway service**.

| Wrong | Right |
|-------|--------|
| Share `gameopen-production` `/api/danger` | Deploy **this** `server/` as Multiverse Railway |
| Firebase as multiplayer authority | Railway WS rooms; Firebase optional harvest/chat only |

## Endpoints

| Path | Role |
|------|------|
| `GET /api/health` | Healthcheck |
| `WS /api/mv?room=room1` | Multiverse rooms only |

**Not Carrier.** Carrier (`/api/carrier`) is GRUDOX space / RTS. Multiverse never shares that path.

## Deploy (new Railway project)

```bash
cd server
npm install
# First time — create a NEW project (do not link to gameopen)
railway login
railway init   # name: grudge-multiverse-room
railway up
railway domain  # public HTTPS / WSS
```

Set Vercel env for the SPA:

```
VITE_MV_GAME_SERVER_URL=https://<your-multiverse-railway>.up.railway.app
```

Then redeploy Vercel so the client bakes the URL.

## Local

```bash
cd server && npm start
# Client: window.__MV_GAME_SERVER_URL = "http://localhost:8787"
```
