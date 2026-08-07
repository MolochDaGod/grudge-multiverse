# Island-Crusade-Realm-2 → Multiverse ingest

**Source archive:** `C:\Users\nugye\Documents\Island-Crusade-Realm-2.zip`  
**Extracted:** `…\Island-Crusade-Realm-2\Island-Crusade-Realm-2\` (Replit pnpm monorepo)  
**Primary artifact:** `artifacts/combat-sandbox` (R3F + Rapier Warlords sandbox)

## What we took (and what we did not)

| Crusade system | Multiverse module | Notes |
|----------------|-------------------|--------|
| `state/seed.ts` | `game/realmSeed.js` | mulberry32 / childSeed |
| `state/zones.ts` + `islands.ts` | `game/realmZones.js` | **Wedges on Bermuda** (not 5 km archipelago) |
| `state/settlements.ts` | `game/realmSettlements.js` | Towns / farms / camps per faction |
| `data/npcRoster.ts` | `game/realmNpcs.js` | 5 vendors + 3 guards + captain |
| `systems/enemyAI.ts` | `game/realmAi.js` | idle/patrol/chase/attack/return |
| `data/animals.ts` | `game/realmAnimals.js` | Wildlife + farm stock + loot ids |
| Runtime spawn/update | `game/realmLife.js` | Overlay on live Bermuda |
| Market stock | `game/vendors.js` | Alchemist / Fletcher / Provisioner / Merchant |
| Wire-up | `game/warlordsBootstrap.js` | Mount + E interact + skill hits |

**Not replaced:** Bermuda play mesh remains CDN `models/maps/bermuda.glb`.  
Crusade procedural terrain (Simplex archipelago) is **data/flow**, not a second physics map.  
**Not ported whole:** R3F components, Rapier heightfield worldgen, full kit building GLBs, dangerroom artifact.

## Game flow (after ingest)

1. Spawn on **Grudgehold** hub (neutral centre).
2. Three faction **towns** on land ring (Crusade / Fabled / Legion).
3. Each faction: **farm** (livestock) + **raider camp** (hostile AI).
4. **E** near market NPC → shop (expanded vendor keys).  
   **E** near Captain → accept clear-camp mission.
5. Skills damage raiders/wolves; camp wipe → gold + mission done.
6. Zone badge via `window.__mvZone` (faction theme / aggression).

## Console SSOT

```js
window.__mvRealm          // full realm state
window.__mvZone           // current faction theme
window.__mvNearRealm      // nearest interactable
window.__mvMission        // captain mission
```

## Map product decision

| Option | Status |
|--------|--------|
| A. Keep Bermuda + Crusade systems overlay | **Shipped** |
| B. Bake Crusade archipelago to production GLB on R2 | Future — convert + CDN + island.js URL swap |
| C. Full R3F combat-sandbox as Multiverse shell | Rejected — would fork stacks |

## Re-ingest path

```text
1. Unzip Island-Crusade-Realm-2.zip
2. Read combat-sandbox src/game/{state,data,systems}
3. Port pure logic → Multiverse game/realm*.js (no React)
4. SI snap via island.nav / groundAt
5. Wire warlordsBootstrap mount + update + E + skill damage
```
