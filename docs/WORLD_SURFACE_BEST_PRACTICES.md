# Multiverse world surface — best practices SSOT

Sources wired into Multiverse (not forked as parallel engines):

| Source | What we take | Module |
|--------|----------------|--------|
| [Simon infinite terrain](https://simonstorlschulke.github.io/threejs-examples/?scene=0) · [discourse](https://discourse.threejs.org/t/configurable-infinite-terrain-generator/87001) | Seeded FBM, erosion, rivers, configurable knobs | `game/seedTerrain.js` |
| [SeedThree](https://github.com/SkyeShark/SeedThree) | Stylized species variety, LOD forest, living scene, 1 m build grid spirit | `instancedForest.js` · `buildSnap.js` · nature |
| [three.js Water](https://threejs.org/docs/#examples/en/objects/Water) | Reflective ocean + waterNormals | `game/oceanWater.js` |
| [three.js RapierPhysics](https://threejs.org/docs/#examples/en/physics/RapierPhysics) | Static heightfields / cuboids | `game/worldPhysics.js` (**local** `@dimforge/rapier3d-compat`) |

## Terrain (5 km seed) — player-ready

1. **Hub** = Bermuda GLB mesh (authored SI) — never dollhouse-squash.  
2. **Faction discs** = FBM heightfields (Simon-style erosion/rivers) with slope/height vertex colours (sand → grass → rock); walkable peaks ~12–18 m.  
3. **Nav** rebakes from composed `island.sampleY` after expand with **landDiscs** water mask (ocean between islands = sea).  
4. **Spawns** rebuilt after expand nav (never use Bermuda-only pre-expand spawns).  
5. **Colliders** = Bermuda walkable + FBM seed-terrain meshes (BVH rebind).  
6. **Gate** = `assertMapSeedReady(island)` → `seedReady.ok` (walkable ≥ 80, hubWalk ≥ 12, spawns ≥ 1).  
7. Infinite chunk streaming is **out of scope** for Multiverse room play; same noise API can later stream tiles.

## Water

- Prefer `three/examples/jsm/objects/Water.js` over flat blue circles.  
- Update `uniforms.time` every frame.  
- Keep `waterY` SSOT for boats / nav water mask.

## Physics

- One Rapier world, **fixed ~1/60**.  
- Fleet package: `@dimforge/rapier3d-compat` (not Skypack CDN from addon demo).  
- Player locomotion stays on existing BVH/controller; Rapier owns **world solids** (terrain HF, rocks, build pieces).

## Stylized assets

- Procedural instanced forest (discourse + SeedThree foliage card ideas).  
- Kenney nature-kit rocks scaled Valheim (20 m / 40% bury).  
- Toon race kits for heroes (grudge6) — never Meshy capsules.

## Build (B)

| Key | Action |
|-----|--------|
| **B** | Toggle build mode |
| **LMB** | Place snapped piece (1 m grid) |
| **R** | Rotate 90° |
| **[ ]** | Cycle piece |
| **Esc** | Exit build |

Costs: `t0_wood` / `t0_stone` from harvest bag.

## Hard bans

- ❌ Second physics engine beside Rapier for the same body  
- ❌ Infinite terrain replacing Bermuda hub without seed lock  
- ❌ CDN physics from Skypack in production (use npm rapier)  
- ❌ Build system that invents a second bag/inventory SSOT  
