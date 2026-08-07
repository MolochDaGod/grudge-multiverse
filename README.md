# Grudge Multiverse (Warlords)

**Live:** https://grudge-multiverse.vercel.app/#room1  
**Alt:** https://multiverse.grudge-studio.com/#room1  

Multiplayer Warlords island on Free Fire **Bermuda** + **grudge6 Toon RTS ★** race kits (SI ~1.8 m heroes).

## Play mesh SSOT (do not invent CDNs)

| Role | Path |
|------|------|
| **★ PLAY kit** | `https://assets.grudge-studio.com/asset-packs/toon-rts-characters/glb/characters/{human\|elf\|orc\|undead\|barbarian\|dwarf}.glb` |
| Atlas | `https://assets.grudge-studio.com/textures/grudge6/{folder}/*.webp` |
| Anims | `https://open.grudge-studio.com/anims/baked/*` (Bip001) |
| Map | `https://assets.grudge-studio.com/models/maps/bermuda.glb` |
| Legacy fallback only | `models/grudge6/races/*_Characters.glb` — not primary |
| **Forbidden** | `models/grudge6/metaverse/*`, capsules as final hero |

Contract: `game/grudge6SSOT.js` · version stamp `GRUDGE6_SSOT_VERSION` · deploy gate `npm run deploy:gate`

## Play

1. Open room URL, enter **name**
2. Pick race + class: **Warrior · Ranger · Mage · Worge** (Toon RTS modular kit)
3. Land on **Bermuda island** (water borders, heightfield nav)

### Controls

| Key | Action |
|-----|--------|
| WASD | Move |
| Mouse | Look / aim (no pointer-lock soft aim) |
| **E** | Harvest tree/rock (look at it) |
| **F** / **1–5** | Class skills |
| **I** | Main panel (Players / Bag / Craft / Vendors / Areas) |
| **Tab** | Scoreboard |
| **Enter** | Chat |

### Systems (production)

- **Map:** Bermuda CDN GLB, SI metres, land-only navmesh + A\*  
- **Realm overlay (seeded world):** Valheim-style `?seed=` → denser towns/villages/camps/NPCs/AI/wildlife on Bermuda — `shared/worldSeedGen.mjs` · `docs/WORLD_SEED_SSOT.md`  
- **Crusade ingest notes:** `docs/ISLAND_CRUSADE_INGEST.md`  

- **Hero:** Toon RTS ★ load → SI fit (`characterDeploy`) → mesh_ids equip  
- **Harvest:** trees/rocks → wood/stone, Firebase HP sync  
- **Skills + VFX:** hotbar + `fleetVfx` (slash / bolt / nova / **fire** SI stream)  
- **Bosses:** Mantis / Ash Ghast / Werelephant — pathfind on land, SI height fit  
- **Death:** lite Bip001 ragdoll (`game/ragdollLite.js`)  
- **Vendors / craft / bag:** Main panel + T0–T1 + Crusade market roles (alchemist/fletcher/…)  

### Multiplayer

Firebase RTDB rooms (`#room1`…): players, harvest, bosses, hits, chat.  
Dedicated room service: Railway `grudge-multiverse` (`/api/mv`).

### DRC stack (same as Open Danger — no parallel loader)

| Layer | Module |
|-------|--------|
| Kits / atlas | `game/grudge6SSOT.js` → Toon ★ R2 |
| Deploy ~1.8 m | `game/characterDeploy.js` |
| Load + mesh_ids | `game/grudge6Loader.js` |
| Baked packs | `game/drcAnimSsot.js` + `animPackLoader.js` |
| Mixer | `game/bip001Director.js` |
| Aim | `game/combatAim.js` |
| Skills VFX | `game/fleetVfx.js` |
| Boss AI / nav | `game/bosses.js` + `mapLiteracy.buildNavGrid` |

Console: `__mvDrc` · `__mvCharMeta` (height / kitUrl / playMesh)

## Dev

```bash
cd C:\Users\nugye\Documents\grudge-multiverse   # or F:\GitHub\grudge-multiverse
npm install
npm run deploy:gate   # HEAD map + 6 Toon kits + atlases + anims
npm run dev
npm run deploy        # gate + build + vercel --prod
```

## Repo

https://github.com/MolochDaGod/grudge-multiverse  
Docs: [docs/DEPLOY.md](docs/DEPLOY.md) · [docs/MAP_LITERACY.md](docs/MAP_LITERACY.md)  

