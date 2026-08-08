# Multiverse world seed SSOT (Valheim-style)

## Pattern

```
?seed=MYWORLD  +  #room1
        │
        ▼
┌───────────────────┐     WS ?room=room1&seed=MYWORLD      ┌─────────────────────┐
│  SPA (Vite)       │ ───────────────────────────────────► │ Railway room server │
│  generateWorld()  │ ◄──── welcome.seed + welcome.world ──│ generateWorld()     │
│  mountRealmLife   │                                      │ GET /api/world      │
└───────────────────┘                                      └─────────────────────┘
        │
        ▼
  Bermuda GLB (terrain bytes unchanged)
  + seeded towns/villages/camps/NPCs/AI/wildlife/POIs
```

**One seed → one world.** Client and server use the **same** generator:

| Surface | Module |
|---------|--------|
| Shared source | `shared/worldSeedGen.mjs` |
| Browser | `game/worldSeedGen.js` → re-exports shared |
| Railway | `server/worldSeedGen.mjs` (copy of shared for deploy) |

Schema: `grudge.multiverse.world/v1` · gen: `WORLD_GEN_VERSION`

## How to play a seed

```
https://grudge-multiverse.vercel.app/#room1
https://grudge-multiverse.vercel.app/?seed=VALHEIM42#room1
(default seed when omitted: **VALHEIM42**)
```

- Room locks seed on **first** join (query `seed=`).
- Later joiners get the same room seed from `welcome.seed`.
- HUD **SEED** chip (top-right) shows seed + summary; click copies.

## Backend API

| Method | Path | Result |
|--------|------|--------|
| GET | `/api/health` | includes `worldGen` |
| GET | `/api/world?seed=X&landRadius=320` | compact world welcome payload |
| GET | `/api/world?seed=X&full=1` | full settlements/npcs/hostiles |
| GET | `/api/rooms` | live rooms + seeds |
| WS | `/api/mv?room=R&seed=X` | welcome includes `seed` + `world` |
| WS msg | `{ t: "world_meta", landRadius }` | room re-generates at measured SI |

## Frontend delivery

1. `multiplayer-gltf.js` connects with `?seed=` from URL.  
2. `welcome` stores `window.__mvWorldSeed` / `__mvWorldWelcome`.  
3. `warlordsBootstrap` mounts `mountRealmLife({ seed })` after Bermuda landRadius is known.  
4. Sends `world_meta` so server landRadius matches Bermuda measure.

## Grudge Info

Generator stamps:

```json
"grudgeInfo": {
  "hub": "https://info.grudge-studio.com/docs",
  "topics": { "items", "skills", "tiers", "models", "factions" }
}
```

Hub **Grudge Info Obelisk** POI → **E** opens info docs.

## Density / content (per seed)

- 4 faction territories + neutral hub  
- Capitals + villages + farms + raider camps  
- Market NPCs (5 roles) + guards + captains  
- Wildlife + farm stock  
- POIs: shrine, mine, watchtower, info obelisk  
- **Harbors + sea lanes** · coastal boats (board E / sail WASD / leave F)  
- **Land nav** heightfield + **sea nav** water-mask A\*  
- **LOD** actor bands + mesh terrain distance culling  

## Large-scale map practices

| Concern | Implementation |
|---------|----------------|
| Nav density | `adaptiveNavCellSize(landRadius)` — larger cells on bigger maps |
| Actor AI | `worldLod.createActorLod` near/mid/far/cull |
| Mesh props | LOD0 near, LOD1/2 far, terrain always |
| Boats | Seed harbors · `game/boats.js` · sea snap on water mask |
| Seed lock | Room `welcome.seed` = SPA generateWorld |

## Deploy order

1. **Frontend:** `npm run deploy` (Vercel) — ships generator + realm mount.  
2. **Backend:** `cd server && railway up` (or root railway) — ships `/api/world` + welcome.seed.  
3. Smoke:  
   `curl "https://grudge-multiverse-room-production.up.railway.app/api/world?seed=TEST"`  
   Hard-refresh SPA with `?seed=TEST`.

## Do not

- Invent a second seed hash on the client that ignores `welcome.seed`.  
- Ship different generator versions FE vs BE without bumping `WORLD_GEN_VERSION` both sides.  
- Replace Bermuda GLB path without CDN bake (seed places **content**, not terrain bytes).
