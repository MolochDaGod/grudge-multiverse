# Island biomes SSOT (not rings)

**Mode:** Valheim **systems** (seed, harvest, danger, vegetation tables) on **islands**.  
**Not:** concentric distance rings from spawn.

## Sector map practice (fleet)

| Compass | Island biome id | Lore / sector |
|---------|-----------------|---------------|
| Hub | `ethereal_falls` | Sanctuary Waters · Ethereal Falls camp · **home** |
| N / NW | `frozen_expanse` | Northern Ethereal Falls · mountain |
| E | `starfall` | Fabled / Starfall Archipelago |
| S | `hellmaw` | Hellmaw Depths · **volcanic** (bosses start here) |
| W | `wildwood` | Wildwood / Forgotten Shoals forest |
| SW | `end_of_path` | End of Path · mist / marsh |
| SE | `pirate_coves` | Pirate Expanse tropical |

Code SSOT: `shared/biomeSsot.mjs` · gen `BIOME_GEN`.  
World stamp: `generateWorld().biomes.islands`.

## Rules

1. Each **land disc** gets one primary archetype at seed time (`assignIslandBiomes`).  
2. `sampleBiome(x,z)` = nearest island (coast strip → palm / volcanic shore).  
3. Terrain vertex colors + FBM peak/river from **that island’s** archetype.  
4. Nature density: trees/rocks scale with `treeDensity` / `rockDensity`.  
5. Hellmaw: sparse trees, max rock scale, `allowWorldBoss`.  
6. Ethereal Falls hub: soft meadows, small rocks, farm animals.  
7. Ocean between islands = no land biome (boats).

## Assets (CDN)

Kenney `models/world/kenney/nature-kit/*` — oak/pine/palm/detailed, cliff rocks.  
Do not invent hosts.

## Player experience

- Start on **Ethereal Falls** hub (Bermuda shell).  
- Sail to faction islands with distinct biomes (volcanic south = Hellmaw).  
- Same seed → same island biome assignment (FE + Railway).

## Layers (playable deploy)

| Layer | System |
|-------|--------|
| Terrain hub | Bermuda GLB SI |
| Terrain pads | FBM per island biome color |
| Water | three.js Water + sea nav |
| Nature | Instanced forest + Kenney rocks/ore |
| Harvest | multi-chunk rock/ore/tree (pick/axe) |
| Characters | Toon RTS GLB only |
| NPCs / hostiles | realmLife raceId snap |
| Build | 1 m snap (B) |

## Fleet assets already on CDN (use, don’t invent)

Kenney nature-kit trees/rocks · pirate palms · watercraft · castle tower ·  
`models/nature/stylized/rocks/*` multipacks (isolate only) ·  
`models/nature/stylized/biome/*` · bermuda map · Toon RTS characters.
