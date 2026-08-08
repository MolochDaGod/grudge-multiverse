# Breakable props SSOT (Multiverse)

**Pack:** `Brekable_Boxes_FBX_GLTF_Blend_Textures.zip` (Loafbrr · **CC0**)  
**Use:** smashable crates / barrels / jars at **camps**, **enemy NPCs**, settlements, dungeon entrances — **break → item drops**.

## Paths

| Surface | Path |
|---------|------|
| Intact | `/models/breakable/crate.glb` · `barrel.glb` · `jar.glb` |
| Broken debris | `/models/breakable/crate_broken.glb` · `barrel_broken.glb` · `jar_broken.glb` |

**Code:** `game/breakableProps.js`  
**Harvest:** extends existing `HarvestSystem` (no second break pipeline)  
**Drops:** `LootField` world sparkles (walk-over / E pickup)

## Play

1. World seed places props near camps, farms, towns, hostiles, mines/towers/dungeon POIs.  
2. Aim + **E** (same as harvest) → smash (low HP, any tool).  
3. Debris mesh appears briefly; **loot gems** spawn around the break.  
4. Pick up gems (auto when close or E).

## Loot table (seed-random)

| Chance | Drop |
|--------|------|
| always | T0 mat (wood/stone/scrap/hide) ×1–2 |
| ~35% | Kenney food (via `rollFoodDrop`) |
| ~40% | scrap ore |
| ~6–12% | T1 gear (crate/barrel higher) |
| jar bonus | extra food / preserves chance |

## Placement density

| Site | Count (approx) |
|------|----------------|
| Camp | 5–8 |
| Farm | 3–4 |
| Town | 2–4 |
| Hostile | 0–2 each (65% skip) |
| Dungeon POI | 4–6 |
| Cap | 220 total |

## SI

- Crate ~**0.85 m** · barrel ~**0.95 m** · jar ~**0.55 m**  
- Human **1.8 m** yardstick · never 100×  

## Do not

- Invent a second smash system (use harvest nodes + LootField)  
- Load full multipack as one fused entity for placement  
- Grant bag mats on breakable hit (drops are **world loot**, not silent bag)  

## Source / bake

```
zip → Blender isolate Crate|Barrel|Jar + Broken_1
    → public/models/breakable/*.glb
    → gltf-transform optimize (webp + draco)
```
