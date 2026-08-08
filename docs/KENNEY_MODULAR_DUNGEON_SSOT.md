# Kenney Modular Dungeon Kit SSOT (Multiverse)

**Pack:** `kenney_modular-dungeon-kit_1.0.zip` (Kenney · CC0)  
**Use:** seeded dungeon generation — entrance, halls, openings, enemies, boss  

## Paths

| Surface | Path |
|---------|------|
| **Model** | `/models/kenney/modular-dungeon-kit/{slug}.glb` (39) |
| **Icon / prefab sprite** | `/icons/kenney/modular-dungeon/{slug}.png` (39) |
| **Catalog** | `/models/kenney/modular-dungeon-kit/catalog.json` |
| **CDN** (when uploaded) | `https://assets.grudge-studio.com/models/kenney/modular-dungeon-kit/` |

## Code (do not fork)

| Layer | File |
|-------|------|
| **Seed → layout** | `shared/dungeonSeedGen.mjs` (isomorphic) · `game/dungeonSeedGen.js` |
| **Meshes** | `game/modularDungeonKit.js` |
| **Scene mount** | `game/dungeonField.js` |
| **World POIs** | `stampDungeonPois` in dungeonSeedGen · called from `shared/worldSeedGen.mjs` |
| **Play enter** | `realmLife` + `warlordsBootstrap` E on `kind: dungeon` |
| **Admin** | F5 World · dungeon section |
| **Skill** | `~/.grok/skills/kenney-modular-dungeon/SKILL.md` |

**Gen stamp:** `2026-08-08.1-kenney-modular-dungeon`  
**Schema:** `grudge.multiverse.dungeon/v1`

## Prefab triple

Every piece: **GLB model** + **PNG icon** + **prefab sprite** (same PNG).

## Generation contract

```
worldSeed ──► dungeonSeedFromWorld(worldSeed, index)
                    │
                    ▼
            generateDungeon(dungeonSeed)
                    │
        ┌───────────┼──────────────┬─────────────┬──────────┐
        ▼           ▼              ▼             ▼          ▼
   entrance     halls/spine    openings      enemies     boss
   room-small   corridor*      gates         rooms+hall  boss chamber
```

Same dungeon seed ⇒ same modules, openings, enemy stamps, boss label/HP.

| Stage | Pieces / logic |
|-------|----------------|
| **Entrance** | `room-small` + south gate (`gate-door`…) |
| **Halls** | North spine `corridor` / junction / end · tile **4 m** |
| **Openings** | Room doors + boss gate (`gate*`) |
| **Rooms** | Side `room-small` / `room-large` off junctions |
| **Enemies** | Crypt skirmisher / archer / brute in rooms + light hall ambush |
| **Boss** | North chamber · Warden/Jailer/Horror · high HP |

## Play

1. World loads → **Ancient Crypt** (hub) + **Forgotten Vault** (wild) POIs.  
2. Walk to purple arch · **E** → snap to entrance · clear halls → boss.  
3. F5 admin → log layout / prefab grid.  

## SI

- Modular tile **4 m** (`DUNGEON_TILE_M`)  
- Human **1.8 m** · corridor clear ~3 m  
- Fit module to tile; if AABB &gt; 40 → ×0.01 (100× ban)

## Do not

- Invent a second dungeon generator (extend `dungeonSeedGen`)  
- Load multipack as one entity (single-file GLBs)  
- Place dungeon enemies as production heroes (markers until creature GLBs)  
- Change layout without bumping `DUNGEON_GEN_VERSION` (seed contract)
