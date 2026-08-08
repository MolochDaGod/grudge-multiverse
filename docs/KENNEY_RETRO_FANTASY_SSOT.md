# Kenney Retro Fantasy Kit SSOT (Multiverse)

**Pack:** `kenney_retro-fantasy-kit.zip` (Kenney · CC0)  
**Use:** player buildings, modular structures, camps / towns / farms style + texture  

## Paths

| Surface | Path |
|---------|------|
| **Model** | `/models/kenney/retro-fantasy-kit/{slug}.glb` (105) |
| **Icon / prefab sprite** | `/icons/kenney/retro-fantasy/{slug}.png` (105) |
| **Catalog** | `/models/kenney/retro-fantasy-kit/catalog.json` |
| **CDN primary** | `https://assets.grudge-studio.com/models/kenney/retro-fantasy-kit/{slug}.glb` |

**Code:** `game/retroFantasyKit.js`  
**Consumers:** `game/buildSnap.js` (player B-build), `game/realmLife.js` (settlement spawn), admin F2  

## Prefab triple

Every piece has:

1. **GLB model** — modular mesh + baked Kenney textures  
2. **PNG icon** — inventory / admin / blueprint  
3. **Prefab sprite** — same PNG for spawn tools  

Item / build id: `build_{slug_with_underscores}` · `kit: kenney-retro-fantasy`

## Roles (catalog)

| Role | Count (approx) | Use |
|------|---------------:|-----|
| wall | 43 | walls, doors, windows, battlements |
| structure | 11 | frames, poles, structural walls |
| stairs | 10 | wood/stone stairs, ladder |
| roof | 9 | roofs / edges |
| prop | 8 | crates, barrels, bricks |
| fence | 7 | fence / overhang |
| tower | 6 | tower segments |
| floor | 6 | stone / wood floors |
| dock | 2 | dock tiles |
| nature | 2 | tree-large / shrub (not player build) |
| water | 1 | water tile |

## Play

1. **B** — build mode; **[ ]** cycle Kenney pieces; **LMB** place; **R** rotate.  
2. Costs still bag mats (`t0_wood` / `t0_stone`) via existing inventory.  
3. Seeded **towns / farms / camps** auto-place modular layouts (`SETTLEMENT_LAYOUTS`).  
4. Admin **F2** — building prefab grid + log catalog.

## SI

- Modular tile ≈ **1 m** (`si.modularTileM`).  
- Human yardstick **1.8 m**.  
- Fit by `targetHeightM` (walls ~2.4 m, towers ~4–6 m, floors ~0.15 m).  
- If AABB height > 40 → treat as cm and ×0.01 (fail-closed 100× ban).

## Do not

- Invent a second build system (extend `buildSnap` + this kit).  
- Load multipack as one fused entity (this kit is **single-file GLBs**).  
- Place nature trees via player build palette (role `nature` not buildable).  
- Use Meshy / capsule placeholders for camps when kit loads.
