# Multiverse nature + Valheim harvest SSOT

**Gen:** `NATURE_GEN` in `game/natureSsot.js`  
**Wire:** `mountNatureField` → `HarvestSystem` (chunk mode)

## Rocks (mineable)

| Spec | Value |
|------|--------|
| Height | **20 m** total (`ROCK_HEIGHT_M`) |
| Buried | **40%** (`ROCK_BURY_FRAC`) → **8 m** in ground, **12 m** exposed |
| Chunks | **6** (`ROCK_CHUNKS`) — each strip spawns debris + scale-weld |
| Tool | pick / any (soft match) |
| Assets | Kenney `cliff_blockCave_rock` / `cliff_blockDiagonal_rock` (CDN) |

Place: bottom of mesh at `groundY - bury`. Chunk hits reduce scale and re-bury remaining mass.

## Trees

| Spec | Value |
|------|--------|
| Variety | oak, default, pine, detailed, palm (Kenney nature-kit) |
| Height | 11–16 m SI canopy targets |
| Chunks | 3–5 trunk/canopy stages |
| Decor | `InstancedMesh` cone forest (no harvest) for density |
| Pattern | discourse-style instanced forest + per-tree harvest nodes |

## Animals

`realmAnimals.js` species variety (deer/stag/fox/wolf/farm). Silhouettes in `realmLife.makeAnimalMesh` until animal GLBs land on CDN.

## Terrain

- Bermuda GLB = **hub mesh** only (authored SI, no dollhouse squash).
- 5 km seed: `expandIslandToSeedWorld` ocean + nav + faction discs.
- Ground sample: mesh on hub, dome pads on faction islands, sea elsewhere.
- Harvestables snap to `groundAt` / `island.sampleY`.

## CDN

```
https://assets.grudge-studio.com/models/world/kenney/nature-kit/<file>.glb
```

Do not invent alternate nature hosts. Procedural fallback if a GLB fails HEAD/load.

## Play

1. Aim at rock/tree · **E** (or harvest prompt) swings.  
2. Rocks take multiple chunk hits (debris flies, mass shrinks).  
3. Trees stage-chop until clear.  
4. Loot: `t0_stone` / `t0_wood` per chunk.

## Do not

- Ship 0.5 m “rocks” or cone “trees” as primary harvest (fallback only).  
- Place whole multipack GLBs as one entity.  
- Skip bury fraction on Valheim rocks.
