import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(
  "F:",
  "GitHub",
  "three-player-controller",
  "example",
  "multiplayer-gltf.html",
);
const dest = path.join(root, "index.html");

let t = fs.readFileSync(src, "utf8");
t = t.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
t = t.replace(/<title>[^<]*<\/title>/, "<title>Grudge Multiverse</title>");
t = t.replace(
  /src=["']\.\/multiplayer-gltf\.js["']/,
  'type="module" src="/multiplayer-gltf.js"',
);
t = t.replace(/src=["']\.\/loader\.js["']/, 'src="/loader.js"');
t = t.replace(/src=["']\.\/img\//g, 'src="/img/');
t = t.replace(/type="module"\s+type="module"/g, 'type="module"');

// Inject main panel (Players) styles + markup before </style> and before death overlay
const panelCss = `
            /* ===== Main Panel — Players (K) ===== */
            #main-panel {
                position: fixed; inset: 0; z-index: 99996;
                display: none; align-items: center; justify-content: center;
                background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);
            }
            #main-panel.open { display: flex; }
            #main-panel-card {
                width: min(520px, 92vw); max-height: min(70vh, 560px);
                background: rgba(12,14,22,0.96);
                border: 1px solid rgba(200,168,75,0.35); border-radius: 12px;
                box-shadow: 0 16px 48px rgba(0,0,0,0.55);
                display: flex; flex-direction: column; overflow: hidden;
                font-family: system-ui, sans-serif; color: #e8e4d8;
            }
            #main-panel-card .mp-head {
                display: flex; align-items: center; justify-content: space-between;
                padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.08);
                background: rgba(200,168,75,0.08);
            }
            #main-panel-card .mp-head h2 {
                margin: 0; font-size: 14px; letter-spacing: 0.14em;
                text-transform: uppercase; color: #c8a84b;
            }
            #main-panel-card .mp-head .mp-sub { font-size: 11px; color: #888; margin-top: 2px; }
            #main-panel-close {
                border: 1px solid rgba(255,255,255,0.15); background: transparent;
                color: #ccc; border-radius: 6px; padding: 6px 10px; cursor: pointer; font-size: 12px;
            }
            #main-panel-tabs {
                display: flex; gap: 0; border-bottom: 1px solid rgba(255,255,255,0.08);
            }
            #main-panel-tabs button {
                flex: 1; padding: 10px; border: none; background: transparent;
                color: #888; font-size: 12px; font-weight: 700; letter-spacing: 0.08em;
                text-transform: uppercase; cursor: pointer;
            }
            #main-panel-tabs button.on {
                color: #c8a84b; box-shadow: inset 0 -2px 0 #c8a84b;
                background: rgba(200,168,75,0.06);
            }
            #players-list {
                flex: 1; overflow-y: auto; padding: 8px 0; min-height: 200px;
            }
            .pl-row {
                display: grid; grid-template-columns: 1fr auto auto;
                gap: 8px; align-items: center;
                padding: 10px 16px; border-bottom: 1px solid rgba(255,255,255,0.04);
            }
            .pl-row:hover { background: rgba(255,255,255,0.03); }
            .pl-row.is-local { background: rgba(100,180,255,0.06); }
            .pl-name { font-size: 13px; font-weight: 600; }
            .pl-name .tag { font-size: 10px; color: #666; font-weight: 500; margin-left: 6px; }
            .pl-meta { font-size: 11px; color: #777; }
            .pl-rel {
                display: flex; gap: 4px;
            }
            .pl-rel button {
                border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04);
                color: #aaa; border-radius: 999px; padding: 4px 10px; font-size: 11px;
                cursor: pointer; font-weight: 600;
            }
            .pl-rel button.friend.on { border-color: rgba(80,200,120,0.6); color: #6eec9a; background: rgba(80,200,120,0.12); }
            .pl-rel button.enemy.on { border-color: rgba(230,80,80,0.6); color: #ff8a8a; background: rgba(230,80,80,0.12); }
            .pl-rel button:disabled { opacity: 0.4; cursor: default; }
            #main-panel-foot {
                padding: 10px 16px; border-top: 1px solid rgba(255,255,255,0.08);
                font-size: 11px; color: #777; line-height: 1.4;
            }
            #main-panel-foot kbd {
                display: inline-block; padding: 1px 5px; font-size: 10px;
                background: #222; border: 1px solid #444; border-radius: 3px; color: #ccc;
            }
            .player-name-label.rel-friend { color: #6eec9a !important; }
            .player-name-label.rel-enemy { color: #ff8a8a !important; }
            #enemy-area-badge {
                position: fixed; top: 56px; left: 50%; transform: translateX(-50%);
                z-index: 9990; display: none; padding: 6px 14px; border-radius: 999px;
                background: rgba(180,30,30,0.75); color: #fff; font-family: system-ui;
                font-size: 12px; font-weight: 700; letter-spacing: 0.08em;
                border: 1px solid rgba(255,100,100,0.5);
                text-shadow: 0 1px 4px #000;
            }
`;

const panelHtml = `
        <!-- Main Panel: Players (friend / enemy) — open with K -->
        <div id="main-panel" aria-hidden="true">
            <div id="main-panel-card" role="dialog" aria-label="Players panel">
                <div class="mp-head">
                    <div>
                        <h2>Players</h2>
                        <div class="mp-sub">Room roster · friend = no damage · enemy = PvP</div>
                    </div>
                    <button type="button" id="main-panel-close" aria-label="Close">Close</button>
                </div>
                <div id="main-panel-tabs">
                    <button type="button" class="on" data-tab="players">Players</button>
                    <button type="button" data-tab="areas">Enemy Areas</button>
                </div>
                <div id="players-list"></div>
                <div id="areas-panel" style="display:none;padding:12px 16px;font-size:12px;color:#aaa;line-height:1.5;overflow:auto;">
                    <p><strong style="color:#ff8a8a">Enemy Areas</strong> are map zones where PvP is forced.</p>
                    <ul id="enemy-areas-list" style="margin:8px 0 0 16px;padding:0;"></ul>
                    <p style="margin-top:10px;color:#666;">Inside a red zone, all other players count as enemies even if marked friend (optional: soft / hard mode in later build).</p>
                </div>
                <div id="main-panel-foot">
                    <kbd>K</kbd> toggle panel · <kbd>Tab</kbd> scoreboard ·
                    <span style="color:#6eec9a">Friend</span> = no damage either way ·
                    <span style="color:#ff8a8a">Enemy</span> = default PvP
                </div>
            </div>
        </div>
        <div id="enemy-area-badge">ENEMY AREA</div>
`;

if (!t.includes("#main-panel")) {
  t = t.replace("</style>", panelCss + "\n        </style>");
}
if (!t.includes('id="main-panel"')) {
  t = t.replace("<!-- 死亡遮罩 -->", panelHtml + "\n        <!-- 死亡遮罩 -->");
  if (!t.includes('id="main-panel"')) {
    t = t.replace('<div id="death-overlay">', panelHtml + '\n        <div id="death-overlay">');
  }
}

// HUD hint for K
if (!t.includes(">K</kbd>") && t.includes("class=\"hud\"")) {
  t = t.replace(
    /(<div class="hud">[\s\S]*?)(<\/div>\s*<!--)/,
    "$1            <div class=\"row\"><kbd>K</kbd><span class=\"hint-text\">Players panel</span></div>\n            $2",
  );
}

fs.writeFileSync(dest, t);
console.log("wrote", dest, "bytes", t.length);
