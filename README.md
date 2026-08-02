# Grudge Multiverse (Warlords)

**Live:** https://grudge-multiverse.vercel.app/#room1  

Multiplayer Warlords island on Free Fire **Bermuda** map + grudge6 RTS Toon classes.

## Play

1. Open room URL, enter **name**
2. Pick class: **Warrior · Ranger · Mage · Worge**
3. Land on **Bermuda island** (water borders)

### Controls

| Key | Action |
|-----|--------|
| WASD | Move |
| Mouse | Look / aim |
| **E** | Harvest tree/rock (look at it) |
| **F** | Class skill 0 |
| **Shift+1…5** | Class skills (unlock with level) |
| **I** | Main panel (Players / Bag / Craft / Vendors / Areas) |
| **Tab** | Scoreboard |
| **Enter** | Chat |

### Systems (v1 live)

- **Map:** `public/maps/bermuda.glb` SI-scaled ~120 m, water ring island  
- **Harvest:** pinecone/common trees → wood; stone/rock → stone (≤70 nodes), Firebase HP sync  
- **Classes:** CDN grudge6 kits (`WK_ / ELF_ / UD_ / ORC_`), starter T0 gear  
- **Skills:** hotbar F + Shift tiers by level (XP from kills/harvest)  
- **Rewards:** T0 mats + T0–T1 gear rolls on kills; bosses = higher loot  
- **Vendors:** Armourer + Weaponsmith (gold buy)  
- **Craft:** quick recipes (planks, swords, mail, …)  
- **Bosses:** East Colossus + West Colossus (phase 2 at 50% HP), MP HP sync  
- **Players panel:** friend (no damage) / enemy (default PvP)  
- **Enemy areas:** force PvP zones  

### Multiplayer

Firebase RTDB rooms (`#room1`…): players, harvest nodes, bosses, hits, chat, decals.

### DRC (Danger Room Combat) on Multiverse

Multiverse **imports** the same character/anim SSOT as Open Danger Room — no second stack:

| Layer | Module |
|-------|--------|
| Kits / atlas | `game/grudge6SSOT.js` → R2 |
| Deploy ~1.8 m | `game/characterDeploy.js` |
| Load + mesh_ids | `game/grudge6Loader.js` |
| Baked packs | `game/drcAnimSsot.js` + `animPackLoader.js` → open…/anims/baked |
| Mixer | `game/bip001Director.js` |
| Aim / free mouse | `game/combatAim.js` (no pointer-lock) |
| Skills VFX | `game/fleetVfx.js` |

Contract: `game/drcContract.js` · console `__mvDrc`  


## Dev

```bash
cd F:\GitHub\grudge-multiverse
npm install
npm run dev
npm run deploy
```

## Repo

https://github.com/MolochDaGod/grudge-multiverse  
