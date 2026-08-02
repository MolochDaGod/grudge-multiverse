# Map literacy — Multiverse (Bermuda)

How an agent or engineer **knows where things are** and **what layer each part uses**.

## Coordinates

| Rule | Value |
|------|--------|
| Units | **SI metres** after `island.js` normalize |
| Origin | Island XZ **centered**, ground near **y ≈ 0** |
| +Y | Up (Three.js right-handed) |
| Map CDN | `assets.grudge-studio.com/models/maps/bermuda.glb` |
| Never | Force map to 120 m (dollhouse vs 1.8 m heroes) |

## How we know “what is where”

1. **Mesh name → kind** — `classifyMeshName()`  
   `terrain | tree | rock | building | prop`
2. **Semantic collider layer** — `tagMeshWorld()` / `mapLiteracy.js`  
   `walkable | solid | harvest | water | trigger | ignore`
3. **Ground height** — raycast down from `(x, 500, z)` via `makeGroundSampler`  
   Prefer terrain/building/safety meshes
4. **Navmesh grid** — `buildNavGrid()` samples walkable cells over bounds  
   Exposed as `window.__mvNav` and `island.nav`
5. **Gameplay pads** — returned from `loadBermudaIsland()`  
   `spawns`, `bossPads`, `vendorPads`, `harvestNodes[]` with world `position`

## Layers (do not confuse)

| System | Meaning |
|--------|---------|
| **colliderLayer** | Physics / nav / AI (our SSOT) |
| **THREE.Layers** | Camera/render bitmask (e.g. hitbox layer 2) |
| **Group names** | `layer-terrain`, `layer-water`, … labels for tools |

### colliderLayer map

| Layer | Stands on? | Blocks? | Examples |
|-------|------------|---------|----------|
| walkable | yes | floor | ground, road, safety plane |
| solid | no | yes | houses, walls, fences |
| harvest | soft | yes for AI | trees, rocks (nodes) |
| water | no | no walk | synthetic ring + deep |
| trigger | no | no | boss/vendor pads |
| ignore | no | no | leaves, tiny props |

## Spawns / nodes

- **Player spawns**: ring outside hub → Y from ground sample + nav snap  
- **Harvest**: trees/rocks outside hub, inside water edge; max ~70  
- **Bosses / vendors**: pads at fractions of `halfW`, grounded  
- **Node inventory**: `public/maps/bermuda-node-names.json` (GLB name dump)

## Characters (DRC)

| Step | Source |
|------|--------|
| Mesh | `assets…/models/grudge6/races/*_Characters.glb` |
| Atlas | `textures/grudge6/…` |
| Deploy | `characterDeploy.js` → ~1.8 m uniform |
| Anims | `drcAnimSsot.js` → Open `/anims/baked` |
| Banned loco | `running`, tip `walking`, thin `sword_shield run` |

## Deploy gate

```bash
npm run deploy:gate   # HEAD-check map + kit + anim
npm run deploy        # gate → build → vercel --prod
```

If the gate fails, **do not ship**. A Vercel HTML 200 with missing CDN map is not a game deploy.

## Agent rules

- **Do not invent** map hosts, kit CDNs, or nav layers.
- **Do not deploy** without gate pass.
- **Do not use** Mixamo scale 0.001 as hero visual SSOT — capsule may use controller scale; **skin is grudge6 SI**.
- Read `window.__mvMapMeta` / `__mvNav` in browser console after load for live literacy.
