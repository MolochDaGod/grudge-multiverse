# Kenney Food Kit SSOT (Multiverse)

**Pack:** `kenney_food-kit.zip` (Kenney · CC0)  
**In-repo:**  
- Models: `public/models/kenney/food-kit/*.glb` (200)  
- Icons / prefab sprites: `public/icons/kenney/food/*.png` (200)  
- Catalog: `public/models/kenney/food-kit/catalog.json`  

**Code:** `game/foodKit.js`

## Prefab triple (required for every food)

| Surface | Path |
|---------|------|
| **Model** | `/models/kenney/food-kit/{slug}.glb` |
| **Icon** | `/icons/kenney/food/{slug}.png` |
| **Prefab sprite** | same as icon (UI + admin / spawn tools) |

Item id: `food_{slug_with_underscores}` · slot `food` · `heal` from catalog.

## Play

1. Starter bag: apple ×3, bread, cheese, carrot, meat-cooked (after catalog load).  
2. Bag (I): click food cell → **eat** → +HP.  
3. Kill loot: chance to drop random food.  
4. Admin **F2**: food preview grid + grant starters.

## SI

Food props `targetHeightM` ≈ **0.12 m** (table scale). Never hero-height fit.

## Do not

- Invent second food hosts  
- Load whole multipack as one entity (this kit is **single-file GLBs** — good)  
- Treat utensils/plates as food (`slot: prop`, heal 0)  
