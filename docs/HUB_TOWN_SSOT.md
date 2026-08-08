# Starting town (hub) SSOT — Multiverse

**Mesh pack:** `Islands_medieval_village_strategies_pack.glb` (Sketchfab export)  
**Prod bake:** `public/models/towns/medieval-village.prod.glb` (draco + webp)  
**Code:** `game/hubTown.js` · gen `2026-08-08.1-medieval-village-hub`

## Purpose

Neutral **friendly** starting zone every world seed operates from:

- Player **entry** at the town gate / plaza (not random ocean pad)
- Buildings + ground with **colliders**
- **Pathfinding** for NPCs (outside / yard; indoor shells as AABB)
- NPCs: vendors · faction guards · class specialists · craft specialists

## Physics / colliders (best stack)

| Layer | System | Use |
|-------|--------|-----|
| **Player feet / walls** | `three-mesh-bvh` StaticGeometryGenerator + MeshBVH | Walk + capsule collide (existing Multiverse path) |
| **World solids** | Rapier heightfield (ground) + **static cuboids** (buildings) | Projectiles / future CCT; fleet SSOT `@dimforge/rapier3d-compat` |
| **AI navigation** | `three-pathfinding` zone from **ground** mesh | Patrol / wander on walkable surface |

Do **not** add a second physics engine. Do **not** use full 895 MB author GLB in the SPA — bake prod first.

Author bbox ~±48 m × 22 m → SI village ~**96 m** footprint (fit cm→m if span &gt; 400).

## Entry

1. Load hub town at origin after seed expand.  
2. Spawn player just **inside the gate**, facing the plaza.  
3. Camera over-shoulder toward plaza.  
4. Seed world (camps, dungeons, biomes) still radiates from hub.

## NPC roster (friendly)

| Role | Examples | Interact |
|------|----------|----------|
| **vendor** | Weapon, Armor, Market | E → shop (`vendorKey`) |
| **guard** | Town Guard ×2 | Patrol via pathfinding / wander |
| **captain** | Seed Captain | E → mission leave town / clear camp |
| **class_specialist** | Arms Master, Huntress, Magus, Pack Elder | E → class tip flash |
| **craft_specialist** | Smith, Herbalist, Cook, Carpenter | E → craft tip / open craft panel |

## Files

| File | Duty |
|------|------|
| `game/hubTown.js` | Load, SI fit, colliders, PF, NPCs |
| `game/warlordsBootstrap.js` | Mount before spawn; entry pose |
| `game/realmLife.js` | Merge hub interactables/actors |
| `game/worldPhysics.js` | Heightfield + boxes (unchanged API) |

## Bake command

```bash
gltf-transform optimize ^
  "C:\Users\nugye\Documents\Islands_medieval_village_strategies_pack.glb" ^
  public/models/towns/medieval-village.prod.glb ^
  --texture-compress webp --texture-size 1024 --compress draco
```

Optional R2: `models/towns/medieval-village.prod.glb` on `assets.grudge-studio.com`.

## Do not

- Invent a second hub/city package  
- Spawn hostile AI inside town radius (friendly zone)  
- Ship author 895 MB GLB to Vercel  
- Pelvis-as-feet / 100× giants on village scale  
