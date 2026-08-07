# Grudge Multiverse — deploy map

## Topology (fleet best practice)

```
Browser
  │
  ├─ SPA (Three.js r185)  → Vercel  grudge-multiverse.vercel.app
  │                           optional DNS: multiverse.grudge-studio.com
  │
  ├─ Map GLB (Bermuda)    → R2 CDN  assets.grudge-studio.com/models/maps/bermuda.glb
  │                           (never ship 54MB on Vercel)
  │
  ├─ Characters ★         → R2 CDN  asset-packs/toon-rts-characters/glb/characters/*
  ├─ Atlases              → R2 CDN  textures/grudge6/*
  │
  ├─ Baked anims          → gameopen.vercel.app/anims/baked/*  (or open.grudge-studio.com)
  │
  └─ Multiplayer rooms    → Railway  grudge-multiverse-room (OWN service)
                              wss://…/api/mv?room=room1
                              NOT Carrier, NOT gameopen-production
```

## Surfaces

| Layer | URL | Deploy |
|-------|-----|--------|
| **Play** | https://grudge-multiverse.vercel.app/#room1 | `npm run deploy` |
| **Play alt** | https://multiverse.grudge-studio.com/#room1 | DNS → Vercel |
| **Map** | https://assets.grudge-studio.com/models/maps/bermuda.glb | R2 (already live) |
| **Room server** | https://grudge-multiverse-room-production.up.railway.app | `cd server && railway up --service grudge-multiverse-room` |
| **Open library** | open.grudge-studio.com → “Grudge Multiverse” card | gameopen `gameLibrary.ts` |

## Env

| Var | Where | Value |
|-----|--------|--------|
| `VITE_MV_GAME_SERVER_URL` | Vercel | `https://grudge-multiverse-room-production.up.railway.app` |
| `PORT` | Railway | set by platform |
| `ALLOWED_ORIGINS` | Railway optional | multiverse + open origins |

## Smoke

```bash
# SPA
curl -sI https://grudge-multiverse.vercel.app/
# Map magic-byte (glTF)
curl -sI https://assets.grudge-studio.com/models/maps/bermuda.glb
# Railway room
curl -s https://grudge-multiverse-room-production.up.railway.app/api/health
# WS path only: /api/mv  (not /api/carrier)
# Character CDN + idle parse
npm run smoke:character
# Optional browser assert (needs playwright)
# PLAYWRIGHT=1 npm run smoke:character
```

### Character integrity (fail-closed)

Live tab after spawn: top-right **CHAR** badge (green/yellow/red) from `window.__mvCharacterSource`.

| Grade | Meaning |
|-------|---------|
| **green** | Toon RTS ★ kit + director + core Bip001 rematch |
| **yellow** | Playable but degraded (partial mesh_ids / height) |
| **red** | Not production — capsule, no director, missing bones |

**“Banned loco”** = a few *bad baked walk/run JSON paths* (run-to-roll, tip walk).  
It is **not** a ban on Toon RTS meshes, gear mesh_ids, or character build options.  
Production loads **only** Toon `…/glb/characters/{race}.glb` (legacy races bake needs `?mvLegacyKit=1`).

## Three.js production checklist (this app)

- [x] three ^0.185
- [x] `outputColorSpace = SRGBColorSpace`, ACES, DPR ≤ 1.5
- [x] Draco GLTFLoader for map + kits
- [x] SI scale heroes ~1.8 m; map authored metres
- [x] No permanent capsule heroes (grudge6 CDN)
- [x] Map from CDN, not git deploy artifact
- [x] Dedicated Railway per game
