/**
 * Multiverse admin UI / editors — F1–F5 hotkeys (as product owner described).
 *
 * F1  Player · agents · commands · integrity / seed identity
 * F2  Assets · harvestables · vehicles · CDN paths
 * F3  Enemy / monster / ally · scene entry · training dummy
 * F4  Weapons & armour · mesh prefabs · loadout
 * F5  World · seed · map · terrain / nav / nature
 *
 * Escape closes. Does not invent a second game system — surfaces live SSOT state.
 */
import { CDN, RACES, kitUrl, atlasUrl, WARLORDS_PLAY_CONTRACT_VERSION } from "./grudge6SSOT.js";
import { WORLD_GEN_VERSION, DEFAULT_WORLD_SEED } from "./worldSeedGen.js";
import { FLEET_NATURE_CDN, ORE_VEINS } from "./natureSsot.js";
import { BIOME_GEN } from "./biomeSsot.js";
import { loadBag, loadLoadout } from "./inventory.js";
import {
  loadFoodCatalog,
  allFoodPrefabs,
  FOOD_KIT_GEN,
  foodIconUrl,
  foodModelUrl,
} from "./foodKit.js";
import {
  loadRetroCatalog,
  allPrefabs as allBuildPrefabs,
  playerBuildPalette,
  RETRO_FANTASY_GEN,
  RETRO_CDN,
} from "./retroFantasyKit.js";

export const ADMIN_TABS = [
  { id: "player", key: "F1", title: "Player", blurb: "Hero · agents · integrity · seed id" },
  { id: "assets", key: "F2", title: "Assets", blurb: "Harvest · vehicles · CDN · props" },
  { id: "creatures", key: "F3", title: "Creatures", blurb: "Enemy · monster · ally · dummies" },
  { id: "prefabs", key: "F4", title: "Prefabs", blurb: "Weapons · armour · mesh ids" },
  { id: "world", key: "F5", title: "World", blurb: "Seed · map · nav · nature · layers" },
];

let _bound = false;
let _active = null;

export function mountAdminEditors(opts = {}) {
  ensureAdminStyles();
  ensureAdminShell();
  if (!_bound) {
    _bound = true;
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      // Don't steal F-keys when chat focused
      if (document.getElementById("chat-input") === document.activeElement) return;

      const map = {
        F1: "player",
        F2: "assets",
        F3: "creatures",
        F4: "prefabs",
        F5: "world",
      };
      const tab = map[e.code] || map[e.key];
      if (tab) {
        e.preventDefault();
        e.stopPropagation();
        toggleAdminTab(tab);
        return;
      }
      if (e.code === "Escape" && _active) {
        e.preventDefault();
        closeAdmin();
      }
    }, true);
  }
  window.__mvAdmin = { open: openAdminTab, close: closeAdmin, tabs: ADMIN_TABS };
  opts.flash?.("Admin · F1 Player · F2 Assets · F3 Creatures · F4 Prefabs · F5 World", 2.2);
  return window.__mvAdmin;
}

function ensureAdminShell() {
  if (document.getElementById("mv-admin-root")) return;
  const root = document.createElement("div");
  root.id = "mv-admin-root";
  root.style.display = "none";
  root.innerHTML = `
    <div class="mv-admin-panel" role="dialog" aria-label="Admin editors">
      <header class="mv-admin-head">
        <div class="mv-admin-tabs" id="mv-admin-tabs"></div>
        <button type="button" class="mv-admin-x" aria-label="Close">×</button>
      </header>
      <div class="mv-admin-body" id="mv-admin-body"></div>
      <footer class="mv-admin-foot">
        <span>F1–F5 switch · Esc close · live Multiverse SSOT</span>
        <button type="button" class="mv-admin-refresh">Refresh</button>
      </footer>
    </div>
  `;
  root.querySelector(".mv-admin-x")?.addEventListener("click", closeAdmin);
  root.querySelector(".mv-admin-refresh")?.addEventListener("click", () => {
    if (_active) renderAdminBody(_active);
  });
  root.addEventListener("click", (e) => {
    if (e.target === root) closeAdmin();
  });
  const tabs = root.querySelector("#mv-admin-tabs");
  for (const t of ADMIN_TABS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "mv-admin-tab";
    b.dataset.tab = t.id;
    b.innerHTML = `<kbd>${t.key}</kbd> ${t.title}`;
    b.title = t.blurb;
    b.addEventListener("click", () => openAdminTab(t.id));
    tabs.appendChild(b);
  }
  document.body.appendChild(root);
}

function toggleAdminTab(id) {
  if (_active === id) closeAdmin();
  else openAdminTab(id);
}

export function openAdminTab(id) {
  ensureAdminShell();
  _active = id;
  const root = document.getElementById("mv-admin-root");
  if (root) root.style.display = "flex";
  root?.querySelectorAll(".mv-admin-tab").forEach((b) => {
    b.classList.toggle("on", b.dataset.tab === id);
  });
  renderAdminBody(id);
  // Close help if open
  const help = document.getElementById("mv-help-overlay");
  if (help) help.style.display = "none";
}

export function closeAdmin() {
  _active = null;
  const root = document.getElementById("mv-admin-root");
  if (root) root.style.display = "none";
}

function renderAdminBody(id) {
  const body = document.getElementById("mv-admin-body");
  if (!body) return;
  const tab = ADMIN_TABS.find((t) => t.id === id) || ADMIN_TABS[0];
  let html = `<h2>${tab.title} <small>${tab.key}</small></h2><p class="mv-admin-blurb">${tab.blurb}</p>`;
  try {
    if (id === "player") html += renderPlayerTab();
    else if (id === "assets") html += renderAssetsTab();
    else if (id === "creatures") html += renderCreaturesTab();
    else if (id === "prefabs") html += renderPrefabsTab();
    else if (id === "world") html += renderWorldTab();
  } catch (e) {
    html += `<pre class="mv-admin-err">${esc(String(e?.message || e))}</pre>`;
  }
  body.innerHTML = html;
  wireAdminActions(body);
}

function renderPlayerTab() {
  const src = window.__mvCharacterSource || {};
  const ready = window.__mvPlayReady || {};
  const seed = window.__mvWorldSeed || DEFAULT_WORLD_SEED;
  const race = window.__mvRaceId || src.raceId || "—";
  const cls = window.__mvClassId || src.classId || "—";
  const integ = window.__mvIntegrity || {};
  return `
    <section class="mv-admin-card">
      <h3>Hero identity</h3>
      <table class="mv-admin-table">
        <tr><th>Race</th><td>${esc(race)}</td></tr>
        <tr><th>Class</th><td>${esc(cls)}</td></tr>
        <tr><th>Play mesh</th><td>${esc(src.playMesh || "—")}</td></tr>
        <tr><th>Kit</th><td class="mono">${esc((src.kitUrl || "").split("/").pop() || "—")}</td></tr>
        <tr><th>Anim pack</th><td>${esc(src.animPack || "—")}</td></tr>
        <tr><th>Height</th><td>${num(src.heightM)} m</td></tr>
        <tr><th>Director</th><td>${src.director ? "yes" : "NO"}</td></tr>
        <tr><th>Integrity</th><td>${esc(integ.grade || src.integrity || "—")} ${(integ.reasons || []).slice(0, 3).map(esc).join(", ")}</td></tr>
        <tr><th>Contract</th><td class="mono">${esc(src.warlordsPlayContract || WARLORDS_PLAY_CONTRACT_VERSION)}</td></tr>
        <tr><th>MP ready</th><td>${ready.ok ? "green" : "blocked"} ${(ready.reasons || []).slice(0, 2).map(esc).join(", ")}</td></tr>
        <tr><th>Seed</th><td class="mono">${esc(seed)}</td></tr>
      </table>
      <div class="mv-admin-actions">
        <button type="button" data-act="dump-char">Copy __mvCharacterSource</button>
        <button type="button" data-act="log-char">Console dump</button>
      </div>
    </section>
    <section class="mv-admin-card">
      <h3>Races (Toon RTS CDN)</h3>
      <ul class="mv-admin-list">
        ${Object.values(RACES)
          .map(
            (r) =>
              `<li><b>${esc(r.label)}</b> · <span class="mono">${esc(r.libraryId)}.glb</span></li>`,
          )
          .join("")}
      </ul>
      <p class="hint">Primary: assets.grudge-studio.com/asset-packs/toon-rts-characters/glb/characters/</p>
    </section>
  `;
}

function renderAssetsTab() {
  const harvest = window.__mvIsland?.harvestNodes || [];
  const rocks = harvest.filter((n) => n.kind === "rock").length;
  const ores = harvest.filter((n) => n.kind === "ore").length;
  const trees = harvest.filter((n) => n.kind === "tree").length;
  const nature = window.__mvNature?.stats || window.__mvIsland?.natureField || {};
  const boats = window.__mvBoats;
  return `
    <section class="mv-admin-card">
      <h3>Live harvest field</h3>
      <table class="mv-admin-table">
        <tr><th>Trees</th><td>${trees}</td></tr>
        <tr><th>Rocks</th><td>${rocks}</td></tr>
        <tr><th>Ore veins</th><td>${ores}</td></tr>
        <tr><th>Nature gen</th><td class="mono">${esc(nature.gen || "—")}</td></tr>
        <tr><th>Forest trees</th><td>${nature.forestTrees ?? "—"}</td></tr>
      </table>
    </section>
    <section class="mv-admin-card">
      <h3>Ore catalog</h3>
      <ul class="mv-admin-list">
        ${ORE_VEINS.map((v) => `<li>${esc(v.name)} · <span class="mono">${esc(v.materialId)}</span> · chunks ${v.chunks}</li>`).join("")}
      </ul>
    </section>
    <section class="mv-admin-card">
      <h3>Fleet CDN (nature / vehicles)</h3>
      <ul class="mv-admin-list mono">
        ${Object.entries(FLEET_NATURE_CDN)
          .map(([k, u]) => `<li><b>${esc(k)}</b> · ${esc(u.replace(CDN + "/", ""))}</li>`)
          .join("")}
      </ul>
      <p class="hint">Boats: ${boats?.boats?.length ?? 0} · Watercraft on CDN · Build B = 1 m snap</p>
    </section>
    <section class="mv-admin-card">
      <h3>Kenney food kit (${FOOD_KIT_GEN})</h3>
      <p class="hint">Real foods: icon PNG + GLB model + prefab sprite (same preview). Eat from bag (I).</p>
      <div id="mv-admin-food-preview" class="mv-admin-food-grid"></div>
      <div class="mv-admin-actions">
        <button type="button" data-act="grant-food">Grant starter foods</button>
        <button type="button" data-act="log-food-prefabs">Log food prefabs</button>
      </div>
    </section>
    <section class="mv-admin-card">
      <h3>Kenney retro-fantasy buildings (${RETRO_FANTASY_GEN})</h3>
      <p class="hint">Modular structures · camps · player build (B). Icon + GLB + prefab sprite. CDN: <span class="mono">${esc(RETRO_CDN)}</span></p>
      <div id="mv-admin-build-preview" class="mv-admin-food-grid"></div>
      <div class="mv-admin-actions">
        <button type="button" data-act="log-build-prefabs">Log build prefabs</button>
        <button type="button" data-act="toggle-build">Toggle build mode (B)</button>
      </div>
    </section>
    <section class="mv-admin-card">
      <h3>Actions</h3>
      <div class="mv-admin-actions">
        <button type="button" data-act="log-harvest">Log harvest nodes</button>
        <button type="button" data-act="copy-cdn">Copy CDN base</button>
      </div>
    </section>
  `;
}

function renderCreaturesTab() {
  const realm = window.__mvRealm;
  const actors = realm?.actors || [];
  const hostiles = actors.filter((a) => a.alive && (a.type === "raider" || a.hostile));
  const animals = actors.filter((a) => a.type === "animal" || a.def?.species);
  const npcs = actors.filter((a) => a.type === "npc" || a.def?.role);
  return `
    <section class="mv-admin-card">
      <h3>Scene population</h3>
      <table class="mv-admin-table">
        <tr><th>Alive hostiles</th><td>${hostiles.length}</td></tr>
        <tr><th>Animals</th><td>${animals.length}</td></tr>
        <tr><th>NPCs</th><td>${npcs.length}</td></tr>
        <tr><th>Total actors</th><td>${actors.length}</td></tr>
      </table>
    </section>
    <section class="mv-admin-card">
      <h3>Spawn tools (admin)</h3>
      <p class="hint">Training dummy = passive target near player. Commander stubs expand later.</p>
      <div class="mv-admin-actions">
        <button type="button" data-act="spawn-dummy">Spawn training dummy</button>
        <button type="button" data-act="spawn-dummy-aggro">Spawn aggro dummy</button>
        <button type="button" data-act="list-hostiles">Log hostiles</button>
      </div>
    </section>
    <section class="mv-admin-card">
      <h3>Nearest hostiles</h3>
      <ul class="mv-admin-list">
        ${hostiles
          .slice(0, 12)
          .map(
            (a) =>
              `<li>${esc(a.def?.label || a.def?.species || a.type || "foe")} · hp ${a.hp ?? "?"} · ${esc(a.def?.raceId || "")}</li>`,
          )
          .join("") || "<li class='hint'>None alive</li>"}
      </ul>
    </section>
  `;
}

function renderPrefabsTab() {
  const lo = loadLoadout?.() || {};
  const bag = loadBag?.() || {};
  const meshes = window.__mvMeshLabels || window.__mvShownMeshes || [];
  const labels = Array.isArray(meshes)
    ? meshes.map((m) => (typeof m === "string" ? m : `${m.slot || "?"}:${m.label || m.id || "?"}`))
    : [];
  return `
    <section class="mv-admin-card">
      <h3>Equipped mesh_ids (Toon modular)</h3>
      <ul class="mv-admin-list mono">
        ${labels.slice(0, 24).map((l) => `<li>${esc(l)}</li>`).join("") || "<li class='hint'>No mesh labels yet</li>"}
      </ul>
    </section>
    <section class="mv-admin-card">
      <h3>Loadout / bag</h3>
      <pre class="mv-admin-pre">${esc(JSON.stringify({ loadout: lo, bagSlots: (bag.items || []).length, gold: bag.gold }, null, 2))}</pre>
      <div class="mv-admin-actions">
        <button type="button" data-act="open-bag">Open bag (I)</button>
        <button type="button" data-act="open-skills">Open skills</button>
      </div>
    </section>
    <section class="mv-admin-card">
      <h3>Weapon / armour prefab notes</h3>
      <p class="hint">Equip via mesh_ids visibility on Toon RTS kit — never whole-body GLB swap. Gear presets: ${esc(CDN)}/api/v1/grudge6-gear-presets.json</p>
    </section>
  `;
}

function renderWorldTab() {
  const meta = window.__mvMapMeta || {};
  const gate = window.__mvMapGate || meta.mapGate || {};
  const island = window.__mvIsland || {};
  const nav = window.__mvNav || island.nav;
  const seed = window.__mvWorldSeed || DEFAULT_WORLD_SEED;
  const biomes = island.islandBiomes || meta.seedReady || {};
  const islands =
    window.__mvRealm?.world?.biomes?.islands ||
    island.seedTerrains?.islands ||
    [];
  return `
    <section class="mv-admin-card">
      <h3>Seed / map gate</h3>
      <table class="mv-admin-table">
        <tr><th>Seed</th><td class="mono">${esc(seed)}</td></tr>
        <tr><th>World gen</th><td class="mono">${esc(WORLD_GEN_VERSION)}</td></tr>
        <tr><th>Biome gen</th><td class="mono">${esc(BIOME_GEN)}</td></tr>
        <tr><th>Size</th><td>${meta.worldSizeM || 5000} m · radius ${meta.worldRadiusM || "—"}</td></tr>
        <tr><th>Map ready</th><td>${gate.ok ? "OK" : "issues"} ${(gate.reasons || []).map(esc).join(", ")}</td></tr>
        <tr><th>Walk cells</th><td>${nav?.walkCount ?? meta.nav?.walkable ?? "—"} / ${nav?.cells?.length ?? meta.nav?.total ?? "—"}</td></tr>
        <tr><th>Nav cell</th><td>${nav?.cellSize ?? meta.nav?.cellSize ?? "—"} m</td></tr>
        <tr><th>Spawns</th><td>${island.spawns?.length ?? "—"}</td></tr>
        <tr><th>Water</th><td>${window.__mvOcean ? "three.js Water" : "flat"} · y=${num(island.waterY)}</td></tr>
        <tr><th>Physics</th><td>${window.__mvWorldPhysics ? "Rapier" : "BVH only"}</td></tr>
      </table>
    </section>
    <section class="mv-admin-card">
      <h3>Island biomes (not rings)</h3>
      <ul class="mv-admin-list">
        ${(Array.isArray(islands) ? islands : [])
          .map(
            (i) =>
              `<li><b>${esc(i.biomeId || i.name)}</b> · ${esc(i.archetype || "")} · (${i.x},${i.z}) r=${i.r}${i.allowWorldBoss ? " · BOSS" : ""}</li>`,
          )
          .join("") || "<li class='hint'>No island stamps yet</li>"}
      </ul>
    </section>
    <section class="mv-admin-card">
      <h3>World actions</h3>
      <div class="mv-admin-actions">
        <button type="button" data-act="copy-seed">Copy seed</button>
        <button type="button" data-act="log-map">Log __mvMapMeta</button>
        <button type="button" data-act="toggle-build">Toggle build (B)</button>
      </div>
      <p class="hint">Play: seed oceans + islands · E harvest · board boats · B build</p>
    </section>
  `;
}

function wireAdminActions(body) {
  body.querySelectorAll("[data-act]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const act = btn.getAttribute("data-act");
      runAdminAction(act);
    });
  });
  // Food preview strip (async catalog)
  const grid = body.querySelector("#mv-admin-food-preview");
  if (grid) {
    loadFoodCatalog().then(() => {
      const prefs = allFoodPrefabs()
        .filter((p) => p.slot === "food" && p.heal > 0)
        .slice(0, 24);
      grid.innerHTML = prefs
        .map(
          (p) =>
            `<div class="mv-food-tile" title="${esc(p.name)} · heal ${p.heal}" data-food="${esc(p.id)}">
              <img src="${esc(p.icon)}" alt="" />
              <span>${esc(p.name)}</span>
            </div>`,
        )
        .join("");
    });
  }
  // Building / camp prefab strip
  const buildGrid = body.querySelector("#mv-admin-build-preview");
  if (buildGrid) {
    loadRetroCatalog().then(() => {
      const prefs = playerBuildPalette().slice(0, 24);
      buildGrid.innerHTML =
        prefs
          .map(
            (p) =>
              `<div class="mv-food-tile" title="${esc(p.name)} · ${esc(p.role)} · ${esc(p.slug)}" data-build="${esc(p.id)}">
              <img src="${esc(p.iconUrl)}" alt="" />
              <span>${esc(p.name)}</span>
            </div>`,
          )
          .join("") || "<span class='hint'>No build palette</span>";
    });
  }
}

function runAdminAction(act) {
  const flash = (m) =>
    window.dispatchEvent(new CustomEvent("mv-flash", { detail: { msg: m } })) ||
    console.info("[admin]", m);

  if (act === "dump-char") {
    const s = JSON.stringify(window.__mvCharacterSource || {}, null, 2);
    navigator.clipboard?.writeText?.(s);
    flash("Character source copied");
  } else if (act === "log-char") {
    console.info("[admin] __mvCharacterSource", window.__mvCharacterSource);
  } else if (act === "log-harvest") {
    console.info("[admin] harvest", window.__mvIsland?.harvestNodes);
  } else if (act === "copy-cdn") {
    navigator.clipboard?.writeText?.(CDN);
    flash("CDN base copied");
  } else if (act === "grant-food") {
    import("./foodKit.js").then(async ({ loadFoodCatalog, ensureStarterFoods }) => {
      await loadFoodCatalog();
      const bag = loadBag();
      const n = await ensureStarterFoods(bag);
      window.dispatchEvent(new CustomEvent("mv-bag", { detail: bag }));
      flash(`Food bag +${n} stacks`);
    });
  } else if (act === "log-food-prefabs") {
    import("./foodKit.js").then(async ({ loadFoodCatalog, allFoodPrefabs }) => {
      await loadFoodCatalog();
      console.info("[admin] food prefabs", allFoodPrefabs());
    });
  } else if (act === "log-build-prefabs") {
    loadRetroCatalog().then(() => {
      console.info("[admin] retro-fantasy prefabs", allBuildPrefabs());
      console.info("[admin] player build palette", playerBuildPalette());
      flash(`Build prefabs ${allBuildPrefabs().length} · palette ${playerBuildPalette().length}`);
    });
  } else if (act === "list-hostiles") {
    console.info(
      "[admin] hostiles",
      (window.__mvRealm?.actors || []).filter((a) => a.alive && a.hostile),
    );
  } else if (act === "spawn-dummy" || act === "spawn-dummy-aggro") {
    spawnTrainingDummy(act === "spawn-dummy-aggro");
  } else if (act === "open-bag") {
    window.dispatchEvent(new CustomEvent("mv-open-tab", { detail: { tab: "bag" } }));
  } else if (act === "open-skills") {
    window.dispatchEvent(new CustomEvent("mv-open-tab", { detail: { tab: "skills" } }));
  } else if (act === "copy-seed") {
    navigator.clipboard?.writeText?.(window.__mvWorldSeed || DEFAULT_WORLD_SEED);
    flash("Seed copied");
  } else if (act === "log-map") {
    console.info("[admin] map", window.__mvMapMeta, window.__mvIsland?.seedReady);
  } else if (act === "toggle-build") {
    window.__mvBuild?.setMode?.(!window.__mvBuild?.isMode?.());
  }
}

/** Simple training dummy near player for F3 admin. */
function spawnTrainingDummy(aggro = false) {
  import("three").then((THREE) => {
    const pos =
      window.__mvLocalCapsule?.position ||
      window.__mvPlayerPos ||
      { x: 0, y: 2, z: 5 };
    const g = new THREE.Group();
    g.name = "admin-training-dummy";
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 1.2, 4, 8),
      new THREE.MeshToonMaterial({ color: aggro ? 0xaa3333 : 0x888888 }),
    );
    body.position.y = 1.0;
    body.castShadow = true;
    g.add(body);
    const groundAt = window.__mvIsland?.sampleY;
    const x = (pos.x || 0) + 2.5;
    const z = (pos.z || 0) + 1.2;
    let y = pos.y || 1;
    try {
      const gy = groundAt?.(x, z);
      if (Number.isFinite(gy)) y = gy;
    } catch {
      /* */
    }
    g.position.set(x, y, z);
    const s = window.__mvThreeScene || window.__mvScene;
    if (s?.add) s.add(g);
    else if (window.__mvIsland?.root?.parent?.add) {
      window.__mvIsland.root.parent.add(g);
    }

    const actor = {
      id: `dummy_${Date.now()}`,
      type: "raider",
      hostile: !!aggro,
      alive: true,
      hp: 200,
      maxHp: 200,
      mesh: g,
      def: {
        label: aggro ? "Training Dummy (aggro)" : "Training Dummy",
        raceId: "orcs",
        campId: "admin",
      },
      adminDummy: true,
      passive: !aggro,
    };
    if (window.__mvRealm?.actors) {
      window.__mvRealm.actors.push(actor);
    }
    console.info("[admin] spawned dummy", actor.id, aggro ? "aggro" : "passive");
  });
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function num(v) {
  return Number.isFinite(Number(v)) ? Number(v).toFixed(2) : "—";
}

function ensureAdminStyles() {
  if (document.getElementById("mv-admin-css")) return;
  const st = document.createElement("style");
  st.id = "mv-admin-css";
  st.textContent = `
    #mv-admin-root {
      position: fixed; inset: 0; z-index: 10050;
      display: none; align-items: stretch; justify-content: flex-end;
      background: rgba(0,0,0,0.35); pointer-events: auto;
    }
    .mv-admin-panel {
      width: min(440px, 96vw); height: 100%;
      background: linear-gradient(165deg, #1a1814 0%, #0e0d0b 100%);
      border-left: 1px solid #c9a04e88;
      color: #e8d9a8; font: 12px/1.4 system-ui, sans-serif;
      display: flex; flex-direction: column;
      box-shadow: -8px 0 32px rgba(0,0,0,0.55);
    }
    .mv-admin-head {
      display: flex; align-items: flex-start; gap: 6px;
      padding: 10px 10px 6px; border-bottom: 1px solid #3a3428;
    }
    .mv-admin-tabs { display: flex; flex-wrap: wrap; gap: 4px; flex: 1; }
    .mv-admin-tab {
      background: #221e18; border: 1px solid #4a4030; color: #cbb88a;
      border-radius: 6px; padding: 5px 8px; cursor: pointer; font-size: 11px;
    }
    .mv-admin-tab.on { border-color: #c9a04e; background: #2a2418; color: #ffe9a8; }
    .mv-admin-tab kbd {
      font: 10px ui-monospace, monospace; background: #111; padding: 1px 4px;
      border-radius: 3px; border: 1px solid #555; margin-right: 3px;
    }
    .mv-admin-x {
      background: transparent; border: none; color: #c9a04e;
      font-size: 22px; cursor: pointer; line-height: 1; padding: 0 4px;
    }
    .mv-admin-body {
      flex: 1; overflow: auto; padding: 10px 12px 16px;
    }
    .mv-admin-body h2 { margin: 0 0 4px; font-size: 16px; color: #f0e0b0; }
    .mv-admin-body h2 small { opacity: 0.55; font-size: 12px; margin-left: 6px; }
    .mv-admin-blurb { margin: 0 0 12px; opacity: 0.75; font-size: 11px; }
    .mv-admin-card {
      background: rgba(0,0,0,0.35); border: 1px solid #3a3428;
      border-radius: 8px; padding: 10px 12px; margin-bottom: 10px;
    }
    .mv-admin-card h3 { margin: 0 0 8px; font-size: 13px; color: #e0c878; }
    .mv-admin-table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .mv-admin-table th {
      text-align: left; width: 38%; color: #a89870; font-weight: 600;
      padding: 3px 6px 3px 0; vertical-align: top;
    }
    .mv-admin-table td { padding: 3px 0; color: #e8dcc0; word-break: break-word; }
    .mv-admin-list { margin: 0; padding-left: 16px; }
    .mv-admin-list li { margin: 3px 0; }
    .mv-admin-list .hint, .hint { opacity: 0.65; font-size: 11px; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; }
    .mv-admin-pre {
      max-height: 180px; overflow: auto; background: #0a0a08; padding: 8px;
      border-radius: 6px; font-size: 10px; color: #c8c0a8;
    }
    .mv-admin-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .mv-admin-actions button, .mv-admin-refresh {
      background: #2a2418; border: 1px solid #c9a04e66; color: #e8d9a8;
      border-radius: 6px; padding: 6px 10px; cursor: pointer; font-size: 11px;
    }
    .mv-admin-actions button:hover { border-color: #c9a04e; }
    .mv-admin-foot {
      display: flex; justify-content: space-between; align-items: center;
      padding: 8px 12px; border-top: 1px solid #3a3428; font-size: 10px; opacity: 0.8;
    }
    .mv-admin-err { color: #f88; white-space: pre-wrap; }
    .mv-admin-food-grid {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; max-height: 200px; overflow: auto;
    }
    .mv-food-tile {
      background: #14120e; border: 1px solid #3a4a30; border-radius: 6px; padding: 4px;
      text-align: center; font-size: 9px;
    }
    .mv-food-tile img { width: 40px; height: 40px; object-fit: contain; display: block; margin: 0 auto 2px; }
  `;
  document.head.appendChild(st);
}
