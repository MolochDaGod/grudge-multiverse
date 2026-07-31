# Grudge Multiverse

**Live:** https://multiverse.grudge-studio.com (alias of this deploy)

Multiplayer GLTF shooter / freeflight sandbox based on **three-player-controller** multiplayer-gltf:

- Burnout junction map  
- 6 characters (Josh, Tommy, Swat, Manny, Mob, AntMan)  
- Firebase realtime rooms (`#room1` …)  
- Weapons, decals, kill feed, chat, scoreboard  

## Stack

- Three.js r185 + three-mesh-bvh + Rapier (controller)  
- Firebase RTDB rooms (`player-controller` project — demo rooms)  
- Vite production SPA  

## Dev

```bash
cd F:\GitHub\grudge-multiverse
npm install
npm run dev
# http://localhost:5195
```

## Deploy

```bash
npm run deploy
# then: npx vercel domains add multiverse.grudge-studio.com
# Cloudflare: CNAME multiverse → cname.vercel-dns.com
```

## Fleet

| Surface | URL |
|---------|-----|
| Multiverse | https://multiverse.grudge-studio.com |
| Metaverse shell | https://metaverse.grudge-studio.com |
| Open | https://open.grudge-studio.com |

Source controller: `F:\GitHub\three-player-controller` (upstream example).
