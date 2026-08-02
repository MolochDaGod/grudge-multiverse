import * as THREE from "three";
import { MapControls } from "three/examples/jsm/Addons.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";

import { createVolumeCloud, updateVolumeCloud } from "./volumeCloud.js";
import { LocalPlayer } from "./shooting/player/LocalPlayer.js";
import { WeaponController } from "./shooting/weapon/WeaponController.js";
import { HUD } from "./shooting/ui/HUD.js";
import { ShootingEffects } from "./shooting/weapon/effects.js";
import { DecalSystem } from "./shooting/weapon/DecalSystem.js";

import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, onDisconnect, remove, get, onChildAdded } from "firebase/database";
import {
  setupRaceClassSelectUI,
  attachWarlordsWorld,
} from "./game/warlordsBootstrap.js";
import { loadBag } from "./game/inventory.js";
import { mountWarlordsHud, setNetStatus } from "./game/warlordsHud.js";
import {
  mountMainPanelShell,
  renderMainPanelTab,
  setMainPanelSocialApi,
  showFriendRequestUI,
  refreshOpenTab,
  wireInventoryBuys,
} from "./game/mainPanel.js";
import { connectMultiverseDanger, STATE_REPORT_MS } from "./game/net/dangerRelay.js";
import { loadSelection } from "./game/fleetGearPresets.js";

const BASE = import.meta.env.BASE_URL;
/** @type {Awaited<ReturnType<typeof attachWarlordsWorld>> | null} */
let warlords = null;

// ================================================================
// Firebase é…ç½®
// ================================================================
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyAHRbY8kGEkRT-dWYvdKgxBKPfAhKRP72E",
    authDomain: "player-controller.firebaseapp.com",
    databaseURL: "https://player-controller-default-rtdb.firebaseio.com",
    projectId: "player-controller",
    storageBucket: "player-controller.firebasestorage.app",
    messagingSenderId: "499506286184",
    appId: "1:499506286184:web:08b8a9b77f2f9c1a11b5dd",
};

// ==================== æˆ¿é—´ & èº«ä»½ ====================
const MAX_PLAYERS = 10;
if (!location.hash) location.replace(location.href + "#room1");
const roomId = "gltf-" + (location.hash.slice(1) || "room1");
const playerId = Math.random().toString(36).slice(2, 9);

const firebaseApp = initializeApp(FIREBASE_CONFIG);
const db = getDatabase(firebaseApp);
const myRef = ref(db, `rooms/${roomId}/players/${playerId}`);
onDisconnect(myRef).remove();
window.addEventListener("beforeunload", () => remove(myRef));

// ==================== Scene (Bermuda island via warlordsBootstrap) ====================
// Legacy burnout path kept as optional fallback only
/** Local maps/ is stripped from Vercel; CDN is production SSOT. */
const SCENE_URL = "https://assets.grudge-studio.com/models/maps/bermuda.glb";
const USE_WARLORDS_ISLAND = true;
/** Offline / dev fallback only (not shipped on Vercel). */
const SCENE_URL_LOCAL = BASE + "maps/bermuda.glb";
// å‡ºç”Ÿç‚¹åˆ—è¡¨ï¼ŒçŽ©å®¶æŒ‰å…¥æˆ¿é¡ºåºä¾æ¬¡åˆ†é…
const SPAWN_POINTS = [
    new THREE.Vector3(21.500, 3.755, 15.000),
    new THREE.Vector3(21.229, 5.257, 19.803),
    new THREE.Vector3(1.564, 5.257, 19.928),
    new THREE.Vector3(-1.312, 3.760, 14.723),
    new THREE.Vector3(-17.597, 11.163, 8.699),
    new THREE.Vector3(-24.421, 11.163, 0.332),
    new THREE.Vector3(-23.108, 5.257, 19.826),
    new THREE.Vector3(-23.273, 3.947, 15.322),
    new THREE.Vector3(-14.501, 2.757, 11.004),
    new THREE.Vector3(-7.957, 2.772, 9.655),
    new THREE.Vector3(2.330, 3.757, 21.281),
];
// è§’è‰²åº“ï¼ˆä¸Ž HTML data-idx å¯¹åº”ï¼‰ï¼Œæ¯é¡¹å«å®Œæ•´æ¨¡åž‹é…ç½®
const CHARACTER_LIST = [
    {
        name: "Josh",
        url: BASE + "glb/person1.glb",
        scale: 0.001,
        idleAnim: "idle1",
        walkAnim: "walk",
        runAnim: "run",
        jumpAnim: "jump",
        flyAnim: "flying",
        flyIdleAnim: "flyidle",
        headBoneName: "mixamorigHead",
        rotateY: -Math.PI / 2,
        minCamDistance: 10, maxCamDistance: 220,
        firstPersonPitchOffset: Math.PI * (10 / 180),
    },
    {
        name: "Tommy",
        url: BASE + "glb/person2.glb",
        scale: 0.001,
        idleAnim: "idle1",
        walkAnim: "walk",
        runAnim: "run",
        jumpAnim: "jump",
        flyAnim: "flying",
        flyIdleAnim: "flyidle",
        headBoneName: "mixamorigHead",
        rotateY: -Math.PI / 2,
        minCamDistance: 10, maxCamDistance: 220,
        firstPersonPitchOffset: Math.PI * (10 / 180),
    },
    {
        name: "Swat",
        url: BASE + "glb/person15.glb",
        scale: 0.001,
        idleAnim: "idle1",
        walkAnim: "walk",
        runAnim: "run",
        jumpAnim: "jump",
        flyAnim: "flying",
        flyIdleAnim: "flyidle",
        headBoneName: "mixamorigHead",
        rotateY: -Math.PI / 2,
        minCamDistance: 10, maxCamDistance: 220,
        firstPersonPitchOffset: Math.PI * (16 / 180),
    },
    {
        name: "Manny",
        url: BASE + "glb/UEPerson.glb",
        scale: 0.001,
        idleAnim: "idle",
        walkAnim: "walk",
        runAnim: "run",
        jumpAnim: ["jumpStart", "jumpLoop", "jumpEnd"],
        flyAnim: "fly",
        flyIdleAnim: "flyIdle",
        flyHoverForwardAnim: "flyHoverForward",
        flyHoverBackAnim: "flyHoverBack",
        flyHoverLeftAnim: "flyHoverLeft",
        flyHoverRightAnim: "flyHoverRight",
        flyHoverUpAnim: "flyHoverUp",
        flyHoverDownAnim: "flyHoverDown",
        headBoneName: null,
        firstPersonCameraOffset: [0, 25, 30],
        minCamDistance: 10, maxCamDistance: 220,
        firstPersonPitchOffset: 0,
        noGun: true,
    },
    {
        name: "Mob",
        url: BASE + "glb/person3.glb",
        scale: 0.003,
        idleAnim: "idle",
        walkAnim: "walk",
        runAnim: "run",
        jumpAnim: "jump",
        flyAnim: "flying",
        flyIdleAnim: "flyidle",
        headBoneName: "mixamorigHead",
        minCamDistance: 10, maxCamDistance: 220,
        firstPersonPitchOffset: Math.PI * (10 / 180),
        rotateY: Math.PI,
        noGun: true,
    },
    {
        name: "AntMan",
        url: BASE + "glb/person5.glb",
        scale: 0.001,
        idleAnim: "Idle_4",
        walkAnim: "Walking_3",
        runAnim: "Run_2",
        jumpAnim: "Jump_1",
        flyAnim: "flying",
        flyIdleAnim: "flyIdle",
        headBoneName: "mixamorigHead",
        minCamDistance: 10, maxCamDistance: 220,
        firstPersonPitchOffset: Math.PI * (10 / 180),
        rotateY: Math.PI,
        noGun: true,
    },
];
let selectedModelUrl = CHARACTER_LIST[2].url; // é»˜è®¤ Swatï¼ˆindex 2ï¼‰

const PLAYER_MODEL = { ...CHARACTER_LIST[2] };

// æŒæžªæ—¶è¿œç¨‹çŽ©å®¶çš„åŠ¨ç”»æ˜ å°„ï¼ˆclipName â†’ rifleClipNameï¼‰
const RIFLE_ANIM_MAP = { idle1: "rifle_idle", walk: "rifle_walk", run: "rifle_run", jump: "rifle_jump" };

// å¤šéƒ¨ä½éª¨éª¼ç¢°æ’žç›’å®šä¹‰ï¼ˆHITBOX_DEBUG=true æ—¶æ˜¾ç¤ºç»¿è‰²çº¿æ¡†ï¼‰
const HITBOX_DEBUG = false;
const HITBOX_DEFS = [
    { bone: "mixamorigHead", w: 20, h: 22, d: 20, oy: 10, part: "head", dmg: 2.0 },
    { bone: "mixamorigSpine2", w: 38, h: 60, d: 24, oy: -15, part: "torso", dmg: 1.0 },
    { bone: "mixamorigLeftArm", w: 12, h: 65, d: 12, oy: 38, part: "arm", dmg: 0.75 },
    { bone: "mixamorigRightArm", w: 12, h: 65, d: 12, oy: 38, part: "arm", dmg: 0.75 },
    { bone: "mixamorigLeftUpLeg", w: 14, h: 68, d: 14, oy: 46, part: "leg", dmg: 0.75 },
    { bone: "mixamorigRightUpLeg", w: 14, h: 68, d: 14, oy: 46, part: "leg", dmg: 0.75 },
];
// upperAnim key â†’ full clip nameï¼ˆç”¨äºŽè¿œç¨‹çŽ©å®¶å…¨èº«æ’­æ”¾ï¼‰
const UPPER_CLIP_MAP = { upper_aim: "rifle_idle_aim3", upper_shoot: "rifle_shoot3", upper_reload: "reload" };

// ==================== åœºæ™¯å˜é‡ ====================
// ==================== åŠ¨æ€å¹³å° ====================
let dynamicPlatforms = [];

const dynamicPlatformXPath = [
    new THREE.Vector3(20.94, 3.74, 14.89),
    new THREE.Vector3(-1.32, 7.65, 14.83),
    new THREE.Vector3(-19.85, 14.38, 8.77),
];
const dynamicPlatformXSegments = dynamicPlatformXPath.slice(0, -1).map((p, i) => ({
    from: p, to: dynamicPlatformXPath[i + 1],
    length: p.distanceTo(dynamicPlatformXPath[i + 1]),
}));
const dynamicPlatformXLength = dynamicPlatformXSegments.reduce((s, seg) => s + seg.length, 0);

let localPlayer = null;
let weapon = null;
let audioListener = null;  // THREE.AudioListenerï¼Œä¾›è¿œç¨‹çŽ©å®¶ç©ºé—´éŸ³é¢‘ä½¿ç”¨
let gunShotBuffer = null;  // æžªå£° AudioBufferï¼Œè¿œç¨‹çŽ©å®¶å¤ç”¨
let localShotSeq = 0;      // æœ¬åœ°å¼€ç«è®¡æ•°å™¨ï¼Œå†™å…¥ Firebaseï¼Œä¾›è¿œç¨‹çŽ©å®¶è§¦å‘å£°éŸ³
let decalSystem = null;
const scene = new THREE.Scene();
let camera, renderer, controls;
const clock = new THREE.Clock();
const gltfLoader = new GLTFLoader();

// æœ¬åœ°è¡€é‡ & åå­— & æ­»äº¡çŠ¶æ€ & å‡»æ€æ­»äº¡ç»Ÿè®¡
let myHp = 100;
let isDead = false;
let myName = "";
let localKills = 0;
let localDeaths = 0;
let spawnIndex = 0; // å½“å‰å‡ºç”Ÿç‚¹ç´¢å¼•ï¼Œåœ¨ init() å’Œå¤æ´»æ—¶é€’å¢ž
let isChatting = false;
let lastChatTime = 0;
const CHAT_COOLDOWN = 1000; // å‘é€å†·å´ï¼ˆmsï¼‰

// AntMan èšäººæŠ€èƒ½çŠ¶æ€
let antManIsSmall = false;
let antManIsScaling = false;
let antManScaleFrame = null;
const _lastHitterOf = new Map(); // targetId â†’ attackerIdï¼Œç”¨äºŽå‡»æ€å½’å±ž
let lastAttackerOnMe = null;     // æœ€åŽä¸€æ¬¡æ”»å‡»æœ¬çŽ©å®¶çš„ playerId

const _nameAdj = ["Iron", "Ghost", "Shadow", "Storm", "Silent", "Rapid", "Neon", "Steel", "Dark", "Void"];
const _nameNoun = ["Wolf", "Fox", "Eagle", "Hawk", "Viper", "Tiger", "Bear", "Crow", "Lynx", "Cobra"];
// ç”Ÿæˆéšæœºè‹±æ–‡æˆ˜æ–—åï¼ˆå½¢å®¹è¯ + åè¯ï¼‰
function randomName() {
    return _nameAdj[Math.floor(Math.random() * _nameAdj.length)]
        + _nameNoun[Math.floor(Math.random() * _nameNoun.length)];
}

// Race → Class → name, then boot Danger systems
function waitForName() {
    const savedName = localStorage.getItem("mp_name");
    const selectUi = setupRaceClassSelectUI();
    // Mixamo capsule only for controller; visual is grudge6 after attach
    selectedModelUrl = CHARACTER_LIST[2]?.url ?? CHARACTER_LIST[0].url;

    return new Promise((resolve) => {
        const input = document.getElementById("name-input");
        const btn = document.getElementById("name-confirm");
        const overlay = document.getElementById("name-overlay");

        if (input) {
            input.value = savedName || randomName();
            input.select();
        }

        const confirm = () => {
            // Step: race → class → enter
            if (selectUi.advanceOrReady && !selectUi.advanceOrReady()) {
                return;
            }
            myName = (input?.value.trim() || randomName()).slice(0, 16);
            const raceId = selectUi.getRaceId?.() || localStorage.getItem("mv_race_id") || "western-kingdoms";
            const classId = selectUi.getClassId?.() || localStorage.getItem("mv_class_id") || "warrior";
            localStorage.setItem("mp_name", myName);
            localStorage.setItem("mv_race_id", raceId);
            localStorage.setItem("mv_class_id", classId);
            localStorage.setItem("mp_char_idx", "2");
            window.__mvRaceId = raceId;
            window.__mvClassId = classId;
            if (overlay) overlay.style.display = "none";
            resolve();
        };
        btn?.addEventListener("click", confirm);
        input?.addEventListener("keydown", (e) => {
            if (e.key === "Enter") confirm();
        });
    });
}

// æ‰“å¼€èŠå¤©è¾“å…¥æ¡†ï¼Œæš‚åœæ¸¸æˆè¾“å…¥
function openChat() {
    if (isChatting || isDead || !localPlayer || mainPanelOpen) return;
    isChatting = true;
    localPlayer.offAllEvent();      // å…ˆè§£ç»‘ï¼Œå†é‡Šæ”¾é”ï¼Œå‡å°‘æ¼äº‹ä»¶çª—å£
    document.exitPointerLock?.();
    const wrap = document.getElementById("chat-input-wrap");
    const input = document.getElementById("chat-input");
    wrap.style.display = "flex";
    input.value = "";
    const prefix = document.getElementById("chat-prefix");
    if (prefix) prefix.textContent = myName + ":";
    setTimeout(() => input.focus(), 20);
}

// å…³é—­èŠå¤©è¾“å…¥æ¡†ï¼Œæ¢å¤æ¸¸æˆè¾“å…¥
function closeChat(send) {
    if (!isChatting) return;
    const input = document.getElementById("chat-input");
    if (send) {
        const text = input.value.trim().slice(0, 80);
        if (text && Date.now() - lastChatTime > CHAT_COOLDOWN) {
            lastChatTime = Date.now();
            set(ref(db, `rooms/${roomId}/chat/${Date.now()}_${playerId}`), {
                name: myName, text, t: Date.now(),
            });
        }
    }
    document.getElementById("chat-input-wrap").style.display = "none";
    input.value = "";
    isChatting = false;
    localPlayer?.onAllEvent();
}

// åœ¨å±å¹•ä¸Šæ˜¾ç¤ºä¸€æ¡èŠå¤©æ¶ˆæ¯ï¼ˆæœ€å¤šä¿ç•™ 5 æ¡ï¼Œ8 ç§’åŽæ¶ˆå¤±ï¼‰
function addChatMessage(name, text) {
    const box = document.getElementById("chat-messages");
    if (!box) return;
    while (box.children.length >= 5) box.removeChild(box.firstChild);
    const el = document.createElement("div");
    el.className = "chat-msg";
    el.innerHTML = `<span class="chat-name">${name}</span>: ${text}`;
    box.appendChild(el);
    setTimeout(() => el.parentNode && el.parentNode.removeChild(el), 8000);
}

// è§¦å‘æœ¬åœ°çŽ©å®¶æ­»äº¡ï¼šåœæ­¢è¾“å…¥ã€æ’­æ­»äº¡åŠ¨ç”»ã€æŽ¨é€æ­»äº¡çŠ¶æ€åˆ° Firebase
function triggerDeath() {
    if (isDead) return;
    // Warlords grudge6 classes always allow death; legacy noGun freefly chars skip
    if (PLAYER_MODEL.noGun && !USE_WARLORDS_ISLAND) return;
    isDead = true;
    localDeaths++;
    updateKillBar();
    const killerName = remotePlayers.get(lastAttackerOnMe)?.name ?? "?";
    addKillFeedEntry(killerName, myName);
    document.exitPointerLock?.();
    localPlayer.offAllEvent();
    if (weapon._isReloading) weapon._cancelReload();
    weapon.switchMode("normal");
    localPlayer.playAnimation("death", { force: true, fade: 0.2 });
    sendState();
}

// æœ¬åœ°çŽ©å®¶å¤æ´»ï¼šé‡ç½®è¡€é‡ã€æ¢å¤è¾“å…¥ã€ä¼ é€åˆ°ä¸‹ä¸€ä¸ªå‡ºç”Ÿç‚¹ã€æŽ¨é€å¤æ´»çŠ¶æ€åˆ° Firebase
function triggerRespawn() {
    isDead = false;
    myHp = 100;
    updateMyHPUI();
    document.getElementById("death-overlay").style.display = "none";

    // æŒ‰é¡ºåºé€‰ä¸‹ä¸€ä¸ªå‡ºç”Ÿç‚¹å¹¶ä¼ é€
    spawnIndex = (spawnIndex + 1) % SPAWN_POINTS.length;
    const respawnPos = SPAWN_POINTS[spawnIndex];
    const capsule = localPlayer._player?.getPlayerCapsule();
    if (capsule) capsule.position.copy(respawnPos);

    weapon?.resetAmmo();
    localPlayer.onAllEvent();
    localPlayer.playPlayerAnimationByName(PLAYER_MODEL.idleAnim, 0.3);
    sendState();
}

// ==================== è¿œç¨‹çŽ©å®¶ ====================
const remotePlayers = new Map();

class RemotePlayer {
    constructor(id, charIdx = 2) {
        this.id = id; // è¿œç¨‹çŽ©å®¶ ID
        this.charIdx = charIdx; // è§’è‰²ç´¢å¼•
        this._charCfg = CHARACTER_LIST[charIdx] ?? CHARACTER_LIST[2]; // è§’è‰²é…ç½®
        this.model = null; // æ¨¡åž‹
        this.gunModel = null; // æžªæ¢°æ¨¡åž‹
        this.mixer = null; // åŠ¨ç”»æ··éŸ³å™¨
        this.actions = new Map(); // åŠ¨ç”»åŠ¨ä½œæ˜ å°„è¡¨
        this.currentClip = null; // å½“å‰æ’­æ”¾çš„åŠ¨ç”»åŠ¨ä½œ
        this.targetPos = new THREE.Vector3(); // ç›®æ ‡ä½ç½®
        this.targetQuat = new THREE.Quaternion(); // ç›®æ ‡æ—‹è½¬
        this.loaded = false; // æ˜¯å¦åŠ è½½å®Œæˆ
        this._isDead = false; // æ˜¯å¦æ­»äº¡
        this.kills = 0; // å‡»æ€æ•°
        this.deaths = 0; // æ­»äº¡æ•°
        this.name = ""; // æ˜¾ç¤ºåç§°
        this.nameLabelEl = null; // æ˜¾ç¤ºåç§°å…ƒç´ 
        this._headBone = null; // å¤´éª¨
        this._gunSound = null; // æžªæ¢°éŸ³æ•ˆ
        this._lastShotSeq = null; // ä¸Šä¸€æ¬¡æžªå‡»åºåˆ—
        this._platformIdx = -1; // å½“å‰æ‰€åœ¨å¹³å°ç´¢å¼•
        this._platformOffset = new THREE.Vector3(); // å¹³å°åç§»é‡
    }

    // å¼‚æ­¥åŠ è½½æ¨¡åž‹ã€åŠ¨ç”»ã€ç¢°æ’žç›’ã€æžªæ¢°ï¼›å®ŒæˆåŽ loaded = true
    async load() {
        // æ ¹æ®è§’è‰²ç´¢å¼•åŠ è½½å¯¹åº”æ¨¡åž‹
        const modelUrl = CHARACTER_LIST[this.charIdx]?.url ?? CHARACTER_LIST[2].url;
        const gltf = await gltfLoader.loadAsync(modelUrl);
        this.model = gltf.scene;
        this.model.visible = false;
        scene.add(this.model);

        // æ³¨å†Œæ‰€æœ‰åŠ¨ç”»ï¼ˆæ ‡å‡† + æžªæ¢°ï¼‰
        this.mixer = new THREE.AnimationMixer(this.model);
        for (const clip of gltf.animations) {
            const action = this.mixer.clipAction(clip);
            if (clip.name === "death") {
                action.setLoop(THREE.LoopOnce, 1);
                action.clampWhenFinished = true;
                action.setEffectiveTimeScale(2);
            } else {
                action.setLoop(THREE.LoopRepeat, Infinity);
            }
            action.setEffectiveWeight(0);
            action.play();
            this.actions.set(clip.name, action);
        }

        // noGun è§’è‰²æ— éœ€ç¢°æ’žç›’ï¼ˆä¸å‚ä¸Žæžªå‡»åˆ¤å®šï¼‰
        this._hitboxes = [];
        if (!this._charCfg.noGun) {
            const hitboxMat = HITBOX_DEBUG
                ? new THREE.MeshBasicMaterial({ color: 0x00ff88, wireframe: true })
                : new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
            for (const def of HITBOX_DEFS) {
                const bone = this.model.getObjectByName(def.bone);
                if (!bone) continue;
                const mesh = new THREE.Mesh(new THREE.BoxGeometry(def.w, def.h, def.d), hitboxMat);
                mesh.userData.playerId = this.id;
                mesh.userData.hitPart = def.part;
                mesh.userData.dmgMult = def.dmg;
                mesh.layers.set(0);
                mesh.layers.enable(2); // layer 2ï¼šå¯è¢«æ­¦å™¨å°„çº¿æ£€æµ‹
                mesh.visible = HITBOX_DEBUG;
                mesh.position.set(0, def.oy, 0);
                bone.add(mesh);
                this._hitboxes.push(mesh);
            }

            // åŠ è½½æžªæ¨¡åž‹æŒ‚åˆ°å³æ‰‹
            await this._loadGun();

            // æŒ‚è½½ç©ºé—´åŒ–æžªå£°ï¼ˆè·ç¦»è¡°å‡ï¼Œè¿œè¿‘æœ‰åˆ«ï¼‰
            if (audioListener && gunShotBuffer && this.gunModel) {
                this._gunSound = new THREE.PositionalAudio(audioListener);
                this._gunSound.setBuffer(gunShotBuffer);
                this._gunSound.setRefDistance(10);
                this._gunSound.setVolume(1.0);
                this.gunModel.add(this._gunSound);
            }
        }

        // æ’­æ”¾åˆå§‹åŠ¨ç”»å¹¶æ›´æ–°éª¨éª¼çŸ©é˜µ
        this._switchAnim(this._charCfg.idleAnim);
        this.mixer.update(0);
        this.model.updateMatrixWorld(true);

        // å°†æ¨¡åž‹å½’ä¸€åŒ–åˆ° 180 å•ä½é«˜åº¦ï¼Œå†ä¹˜é…ç½® scale
        const _bboxSize = new THREE.Vector3();
        new THREE.Box3().setFromObject(this.model).getSize(_bboxSize);
        const _modelScale = _bboxSize.y > 0 ? (180 / _bboxSize.y) : 1;
        this._baseScale = _modelScale * this._charCfg.scale;
        this.model.scale.setScalar(this._baseScale);

        this.model.traverse(child => {
            if (child.isMesh) {
                child.material.metalness = 0.0;
                child.material.roughness = 1.0;
            }
        });

        this.loaded = true;

        this._headBone = this.model.getObjectByName(this._charCfg.headBoneName) ?? null;
        this._buildNameLabel();
        this._buildChatBubble();
    }

    // åŠ è½½ AK47 æ¨¡åž‹å¹¶æŒ‚è½½åˆ°å³æ‰‹éª¨éª¼
    async _loadGun() {
        const gltf = await gltfLoader.loadAsync(BASE + "glb/ak47.glb");
        this.gunModel = gltf.scene;
        this.gunModel.scale.setScalar(0.1);
        this.gunModel.position.set(1, 26.5, 2);

        // å¯¹é½æžªç®¡æ–¹å‘ï¼ˆä¸Ž WeaponController ä¸€è‡´ï¼‰
        const alignQ = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0)
        );
        const rollQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
        this.gunModel.quaternion.copy(rollQ.multiply(alignQ));
        this.gunModel.visible = false;

        const rightHand = this.model.getObjectByName("mixamorigRightHand");
        if (rightHand) rightHand.add(this.gunModel);
    }

    // æ”¶åˆ° Firebase çŠ¶æ€åŒ…æ—¶åŒæ­¥ä½ç½®ã€æœå‘ã€åŠ¨ç”»ã€åå­—ï¼ˆæ¯ 50ms è§¦å‘ä¸€æ¬¡ï¼‰
    applyState(state) {
        if (!this.model) return; // load() å°šæœªå®Œæˆï¼Œè·³è¿‡

        if (this._isDead) {
            if (!state.dead) {
                // æ•Œäººå·²å¤æ´»ï¼šé‡ç½®æ­»äº¡çŠ¶æ€ï¼Œåˆ‡å›ž idleï¼Œç»§ç»­æ­£å¸¸åŒæ­¥
                this._isDead = false;
                this._switchAnim(this._charCfg.idleAnim);
            } else {
                return; // ä»å¤„äºŽæ­»äº¡çŠ¶æ€ï¼Œå¿½ç•¥
            }
        }

        // æ”¶åˆ°æ­»äº¡çŠ¶æ€ï¼šå®šä½åˆ°æ­»äº¡åæ ‡ï¼Œæ’­æ­»äº¡åŠ¨ç”»ï¼Œä¸å†æŽ¥å—åŽç»­æ›´æ–°
        if (state.dead && !this._isDead) {
            this._isDead = true;
            this.targetPos.set(state.x, state.y, state.z);
            this.targetQuat.set(state.qx, state.qy, state.qz, state.qw);
            this._switchAnim("death");
            // æœ€åŽä¸€å‡»æ˜¯æœ¬åœ°çŽ©å®¶åˆ™è®°å½•å‡»æ€
            if (_lastHitterOf.get(this.id) === playerId) {
                localKills++;
                _lastHitterOf.delete(this.id);
                updateKillBar();
            }
            // æ˜¾ç¤ºå‡»æ€åŠ¨æ€ï¼ˆkilledBy å¯èƒ½æ˜¯æœ¬åœ°çŽ©å®¶æˆ–å…¶ä»–è¿œç¨‹çŽ©å®¶ï¼‰
            const kbId = state.killedBy;
            const killerName = kbId === playerId
                ? myName
                : (remotePlayers.get(kbId)?.name ?? "?");
            addKillFeedEntry(killerName, this.name || this.id);
            return;
        }

        if (state.kills !== undefined) { this.kills = state.kills; updateKillBar(); }
        if (state.deaths !== undefined) this.deaths = state.deaths;

        // AntMan ç¼©æ”¾åŒæ­¥
        if (state.scale !== undefined && this._baseScale !== undefined) {
            const ratio = state.scale / this._charCfg.scale;
            this.model.scale.setScalar(this._baseScale * ratio);
        }

        this._platformIdx = state.platformIdx ?? -1;
        if (this._platformIdx >= 0) {
            this._platformOffset.set(state.pox ?? 0, state.poy ?? 0, state.poz ?? 0);
        }
        this.targetPos.set(state.x, state.y, state.z);
        this.targetQuat.set(state.qx, state.qy, state.qz, state.qw);

        // è¿œç¨‹æžªå£°ï¼šé¦–æ¬¡æ”¶åˆ°æ—¶è®°å½•åŸºå‡†å€¼ï¼ŒåŽç»­æ£€æµ‹åˆ°è®¡æ•°å™¨å¢žåŠ åˆ™æ’­æ”¾ç©ºé—´éŸ³æ•ˆ
        if (state.shotSeq !== undefined) {
            if (this._lastShotSeq === null) {
                this._lastShotSeq = state.shotSeq;
            } else if (state.shotSeq > this._lastShotSeq && this._gunSound) {
                if (this._gunSound.isPlaying) this._gunSound.stop();
                this._gunSound.play();
                this._lastShotSeq = state.shotSeq;
            }
        }

        // æžªæ¨¡åž‹æ˜¾éš
        if (this.gunModel) this.gunModel.visible = (state.weapon === "primary");

        // åŠ¨ç”»è§£æžï¼šupperAnim ä¼˜å…ˆï¼Œå¦åˆ™æŒ‰ weapon æ¨¡å¼é€‰ clip
        const resolvedClip = state.upperAnim
            ? (UPPER_CLIP_MAP[state.upperAnim] ?? state.anim)
            : (state.weapon === "primary" ? (RIFLE_ANIM_MAP[state.anim] ?? state.anim) : state.anim);

        if (resolvedClip && resolvedClip !== this.currentClip) this._switchAnim(resolvedClip);

        if (!this.model.visible) {
            // é¦–æ¬¡æ˜¾ç¤ºç›´æŽ¥å¸é™„ï¼Œé¿å…ä»ŽåŽŸç‚¹æ’å€¼è¿›åœº
            this.model.position.copy(this.targetPos);
            this.model.quaternion.copy(this.targetQuat);
            this.model.visible = true;
        }

        if (state.name && state.name !== this.name) {
            this.name = state.name;
            if (this.nameLabelEl) this.nameLabelEl.textContent = state.name;
        }
        if (state.hp !== undefined) this._lastHp = state.hp;
        updateNameLabelRelation(this.id);
        if (mainPanelOpen) renderPlayersPanel();
    }

    // æ·¡åˆ‡åˆ°æŒ‡å®šåŠ¨ç”» clipï¼ˆ0.2s è¿‡æ¸¡ï¼‰
    _switchAnim(clipName) {
        const next = this.actions.get(clipName);
        if (!next) return;
        const prev = this.currentClip ? this.actions.get(this.currentClip) : null;
        if (prev && prev !== next) prev.fadeOut(0.2);
        next.reset().setEffectiveWeight(1).fadeIn(0.2);
        this.currentClip = clipName;
    }

    // åˆ›å»ºå¤´é¡¶æ‚¬æµ®åå­— DOM æ ‡ç­¾
    _buildNameLabel() {
        const el = document.createElement("div");
        el.className = "player-name-label";
        el.textContent = this.name || "";
        document.body.appendChild(el);
        this.nameLabelEl = el;
    }

    _buildChatBubble() {
        const el = document.createElement("div");
        el.className = "player-chat-bubble";
        el.appendChild(document.getElementById("chat-bubble-tpl").content.cloneNode(true));
        document.body.appendChild(el);
        this.chatBubbleEl = el;
        this._chatTimer = null;
        this._chatActive = false;
    }

    showChatBubble(text) {
        if (!this.chatBubbleEl) return;
        this.chatBubbleEl.querySelector(".player-chat-text").textContent =
            text.length > 10 ? text.slice(0, 10) + "â€¦" : text;
        this._chatActive = true;
        clearTimeout(this._chatTimer);
        this._chatTimer = setTimeout(() => {
            this._chatActive = false;
            if (this.chatBubbleEl) this.chatBubbleEl.style.display = "none";
        }, 5000);
    }

    // æ¯å¸§ï¼šå¹³æ»‘æ’å€¼ä½ç½®/æ—‹è½¬ï¼Œé©±åŠ¨åŠ¨ç”» mixer
    tick(delta) {
        if (!this.loaded || !this.model) return;
        // ç«™åœ¨å¹³å°ä¸Šæ—¶ï¼šä¸–ç•Œåæ ‡ = æœ¬åœ°å®žæ—¶å¹³å°ä½ç½® + æ”¶åˆ°çš„ç›¸å¯¹åç§»ï¼Œæ¶ˆé™¤ç½‘ç»œå»¶è¿Ÿ
        if (this._platformIdx >= 0 && dynamicPlatforms[this._platformIdx]) {
            this.targetPos.copy(dynamicPlatforms[this._platformIdx].mesh.position).add(this._platformOffset);
        }
        this.model.position.lerp(this.targetPos, 0.3);
        this.model.quaternion.slerp(this.targetQuat, 0.3);
        this.mixer?.update(delta);
    }

    // æ¯å¸§ï¼šå°†åå­—æ ‡ç­¾æŠ•å½±åˆ°å±å¹•ï¼ˆå¤´éª¨éª¼ä¸Šæ–¹ä¸–ç•Œåæ ‡åç§»ï¼Œé€è§†è‡ªåŠ¨ç¼©æ”¾ï¼‰
    updateNameLabel(camera, renderer) {
        if (!this.nameLabelEl || !this.model?.visible) {
            if (this.nameLabelEl) this.nameLabelEl.style.display = "none";
            if (this.chatBubbleEl) this.chatBubbleEl.style.display = "none";
            return;
        }
        const worldPos = new THREE.Vector3();
        if (this._headBone) {
            this._headBone.updateWorldMatrix(true, false);
            this._headBone.getWorldPosition(worldPos);
            // åœ¨ä¸–ç•Œåæ ‡ç©ºé—´åŠ åç§»
            worldPos.y += this._charCfg.scale * 30;
        } else {
            this.model.getWorldPosition(worldPos);
            worldPos.y += this._charCfg.scale * 230;
        }
        const s = worldPos.clone().project(camera);
        if (s.z > 1) {
            this.nameLabelEl.style.display = "none";
            if (this.chatBubbleEl) this.chatBubbleEl.style.display = "none";
            return;
        }
        const x = (s.x * 0.5 + 0.5) * renderer.domElement.clientWidth;
        const y = (-s.y * 0.5 + 0.5) * renderer.domElement.clientHeight;
        this.nameLabelEl.style.display = "block";
        this.nameLabelEl.style.left = `${x}px`;
        this.nameLabelEl.style.top = `${y}px`;
        if (this.chatBubbleEl) {
            this.chatBubbleEl.style.display = this._chatActive ? "block" : "none";
            this.chatBubbleEl.style.left = `${x}px`;
            this.chatBubbleEl.style.top = `${y - 20}px`;
        }
    }

    // é‡Šæ”¾å‡ ä½•ä½“/æè´¨/DOMï¼Œå°†æ¨¡åž‹ç§»å‡ºåœºæ™¯ï¼ˆçŽ©å®¶ç¦»çº¿æ—¶è°ƒç”¨ï¼‰
    dispose() {
        if (this.model) {
            this.model.traverse(child => {
                if (child.isMesh) { child.geometry?.dispose();[child.material].flat().forEach(m => m?.dispose()); }
            });
            scene.remove(this.model);
        }
        this._hitboxes = null;
        this.mixer?.stopAllAction();
        this.model = null;
        if (this._gunSound) {
            if (this._gunSound.isPlaying) this._gunSound.stop();
            this._gunSound = null;
        }
        this.nameLabelEl?.remove();
        this.nameLabelEl = null;
        clearTimeout(this._chatTimer);
        this.chatBubbleEl?.remove();
        this.chatBubbleEl = null;
    }
}

// ==================== Firebase çŠ¶æ€åŒæ­¥ ====================
const _sendPos = new THREE.Vector3();
const _sendQuat = new THREE.Quaternion();
let lastSendTime = 0;
const SEND_INTERVAL = 17;
let currentUpperKey = null; // è·Ÿè¸ªä¸ŠåŠèº«åŠ¨ç”» key

// å°†æœ¬åœ°çŽ©å®¶å½“å‰çŠ¶æ€æŽ¨é€åˆ° Firebaseï¼ˆä½ç½®ã€æœå‘ã€åŠ¨ç”»ã€è¡€é‡ã€æ­»äº¡æ ‡å¿—ï¼‰
function sendState() {
    if (!localPlayer) return;
    const model = localPlayer.getPlayerModel();
    const capsule = localPlayer._player?.getPlayerCapsule();
    if (!model || !capsule) return;

    model.getWorldPosition(_sendPos);
    capsule.getWorldQuaternion(_sendQuat);

    // ç«™åœ¨å¹³å°ä¸Šæ—¶åªä¼ å¹³å°ç´¢å¼•å’Œç›¸å¯¹åç§»ï¼Œè¿œç¨‹ç«¯ç”¨æœ¬åœ°å®žæ—¶å¹³å°åæ ‡è¿˜åŽŸï¼Œç»•å¼€ç½‘ç»œå»¶è¿Ÿ
    let platformIdx = -1, pox = 0, poy = 0, poz = 0;
    const activePlatform = localPlayer._player?.getActiveDynamicCollider();
    if (activePlatform) {
        const idx = dynamicPlatforms.findIndex(p => p.mesh === activePlatform.source);
        if (idx >= 0) {
            platformIdx = idx;
            const platPos = dynamicPlatforms[idx].mesh.position;
            pox = +(_sendPos.x - platPos.x).toFixed(3);
            poy = +(_sendPos.y - platPos.y).toFixed(3);
            poz = +(_sendPos.z - platPos.z).toFixed(3);
        }
    }

    set(myRef, {
        x: +_sendPos.x.toFixed(3), y: +_sendPos.y.toFixed(3), z: +_sendPos.z.toFixed(3),
        qx: +_sendQuat.x.toFixed(4), qy: +_sendQuat.y.toFixed(4),
        qz: +_sendQuat.z.toFixed(4), qw: +_sendQuat.w.toFixed(4),
        anim: localPlayer._player?.getCurrentPlayerAnimationName() ?? PLAYER_MODEL.idleAnim,
        weapon: weapon?.getMode() ?? "normal",
        upperAnim: currentUpperKey ?? null,
        hp: myHp,
        dead: isDead,
        killedBy: isDead ? (lastAttackerOnMe ?? null) : null,
        charIdx: CHARACTER_LIST.findIndex(c => c.url === selectedModelUrl),
        scale: localPlayer._player?.playerModelConfig.scale,
        kills: localKills,
        deaths: localDeaths,
        name: myName,
        shotSeq: localShotSeq,
        platformIdx, pox, poy, poz,
        classId: localStorage.getItem("mv_class_id") || "warrior",
        level: loadBag()?.level || 1,
        t: Date.now(),
    });
}

// ---------- Server tab: friend / enemy social ----------
/** @type {Map<string, 'friend'|'enemy'>} */
const playerRelations = new Map();
/** Outgoing pending friend requests (targetId) */
const pendingOut = new Set();
/** Incoming pending request fromId → true */
const pendingIn = new Set();
/** Incoming already shown toast once */
const pendingInShown = new Set();
const REL_STORAGE_KEY = "mv_player_relations_v1";

function loadRelations() {
    try {
        const raw = JSON.parse(localStorage.getItem(REL_STORAGE_KEY) || "{}");
        for (const [k, v] of Object.entries(raw)) {
            if (v === "friend" || v === "enemy") playerRelations.set(k, v);
        }
    } catch { /* ignore */ }
}
function saveRelations() {
    const obj = {};
    for (const [k, v] of playerRelations) obj[k] = v;
    try { localStorage.setItem(REL_STORAGE_KEY, JSON.stringify(obj)); } catch { /* ignore */ }
}
function getRelation(targetId) {
    if (!targetId || targetId === playerId) return "self";
    // Friends first
    const byId = playerRelations.get(targetId);
    if (byId === "friend") return "friend";
    if (pendingIn.has(targetId)) return "pending_in";
    if (pendingOut.has(targetId)) return "pending_out";
    if (byId === "enemy") return "enemy";
    const name = remotePlayers.get(targetId)?.name;
    if (name) {
        const byName = playerRelations.get(`name:${name}`);
        if (byName) return byName;
    }
    return "enemy"; // default: open PvP
}
function setRelation(targetId, rel, { sync = true } = {}) {
    if (!targetId || targetId === playerId) return;
    if (rel !== "friend" && rel !== "enemy") return;
    playerRelations.set(targetId, rel);
    const name = remotePlayers.get(targetId)?.name;
    if (name) playerRelations.set(`name:${name}`, rel);
    pendingOut.delete(targetId);
    saveRelations();
    updateNameLabelRelation(targetId);
    if (sync) pushRelationRemote(targetId, rel);
    if (mainPanelOpen) refreshOpenTab();
    else renderPlayersPanel();
}
function pushRelationRemote(targetId, rel) {
    try {
        set(ref(db, `rooms/${roomId}/social/relations/${playerId}/${targetId}`), {
            rel, t: Date.now(), name: myName,
        });
        // mirror so peer can read our stance
        set(ref(db, `rooms/${roomId}/social/relations/${targetId}/${playerId}`), {
            rel, t: Date.now(), name: myName, peer: true,
        });
    } catch (e) { console.warn("[social] push relation", e); }
}
function requestFriend(targetId) {
    if (!targetId || targetId === playerId) return;
    if (getRelation(targetId) === "friend") return;
    pendingOut.add(targetId);
    try {
        set(ref(db, `rooms/${roomId}/social/requests/${targetId}/${playerId}`), {
            fromId: playerId,
            fromName: myName || playerId,
            t: Date.now(),
        });
        addRoomNotify(remotePlayers.get(targetId)?.name || targetId, "friend request sent");
    } catch (e) { console.warn("[social] request", e); }
    if (mainPanelOpen) refreshOpenTab();
}
function declareEnemy(targetId) {
    pendingOut.delete(targetId);
    try {
        remove(ref(db, `rooms/${roomId}/social/requests/${targetId}/${playerId}`));
        remove(ref(db, `rooms/${roomId}/social/requests/${playerId}/${targetId}`));
    } catch { /* ignore */ }
    setRelation(targetId, "enemy");
}
function unfriend(targetId) {
    setRelation(targetId, "enemy");
    addRoomNotify(remotePlayers.get(targetId)?.name || targetId, "unfriended");
}
function acceptFriend(fromId) {
    pendingOut.delete(fromId);
    pendingIn.delete(fromId);
    pendingInShown.delete(fromId);
    try {
        remove(ref(db, `rooms/${roomId}/social/requests/${playerId}/${fromId}`));
        remove(ref(db, `rooms/${roomId}/social/requests/${fromId}/${playerId}`));
    } catch { /* ignore */ }
    setRelation(fromId, "friend");
    addRoomNotify(remotePlayers.get(fromId)?.name || fromId, "is now your friend");
}
function declineFriend(fromId) {
    pendingOut.delete(fromId);
    pendingIn.delete(fromId);
    pendingInShown.delete(fromId);
    try {
        remove(ref(db, `rooms/${roomId}/social/requests/${playerId}/${fromId}`));
    } catch { /* ignore */ }
    setRelation(fromId, "enemy");
    addRoomNotify(remotePlayers.get(fromId)?.name || fromId, "declined — now hostile");
}

function wireMainPanelSocial() {
    setMainPanelSocialApi({
        getLocal: () => ({
            id: playerId,
            name: myName || "You",
            kills: localKills,
            deaths: localDeaths,
            hp: myHp,
        }),
        getRemotes: () =>
            [...remotePlayers.entries()].map(([id, rp]) => ({
                id,
                name: rp.name || id,
                kills: rp.kills ?? 0,
                deaths: rp.deaths ?? 0,
                hp: rp._lastHp ?? "—",
            })),
        getRelation,
        requestFriend,
        declareEnemy,
        unfriend,
        acceptFriend,
        declineFriend,
        roomLabel: () => roomId.replace(/^gltf-/, "#"),
    });
}

// Enemy areas (map zones). Inside zone → treat others as enemy for damage even if friend? 
// Soft rule: badge only for friends; hard PvP still uses friend/enemy labels.
// Zone membership can force "enemy" damage while inside (PvP zones).
const ENEMY_AREAS = [
    {
        id: "junction-core",
        name: "Junction Core",
        // Axis-aligned box around map center (SI-ish world units of this map)
        min: new THREE.Vector3(-8, 0, 6),
        max: new THREE.Vector3(12, 12, 22),
        forcePvp: true,
    },
    {
        id: "west-ridge",
        name: "West Ridge",
        min: new THREE.Vector3(-28, 8, -4),
        max: new THREE.Vector3(-14, 18, 12),
        forcePvp: true,
    },
];
let inEnemyArea = false;
let mainPanelOpen = false;

function isInEnemyArea(pos) {
    if (!pos) return null;
    for (const a of ENEMY_AREAS) {
        if (
            pos.x >= a.min.x && pos.x <= a.max.x &&
            pos.y >= a.min.y && pos.y <= a.max.y &&
            pos.z >= a.min.z && pos.z <= a.max.z
        ) return a;
    }
    return null;
}

function localCapsulePos() {
    return localPlayer?._player?.getPlayerCapsule?.()?.position ?? null;
}

function canDamageTarget(targetId) {
    if (!targetId || targetId === playerId) return false;
    const area = isInEnemyArea(localCapsulePos());
    // Force PvP inside enemy areas
    if (area?.forcePvp) return true;
    return getRelation(targetId) === "enemy";
}

function canTakeDamageFrom(attackerId) {
    if (!attackerId || attackerId === playerId) return false;
    const capsule = localPlayer?._player?.getPlayerCapsule?.();
    const area = capsule ? isInEnemyArea(capsule.position) : null;
    if (area?.forcePvp) return true;
    return getRelation(attackerId) === "enemy";
}

function updateNameLabelRelation(targetId) {
    const rp = remotePlayers.get(targetId);
    if (!rp?.nameLabelEl) return;
    const rel = getRelation(targetId);
    rp.nameLabelEl.classList.remove("rel-friend", "rel-enemy");
    if (rel === "friend") rp.nameLabelEl.classList.add("rel-friend");
    else if (rel === "enemy") rp.nameLabelEl.classList.add("rel-enemy");
}

function renderPlayersPanel() {
    // Server tab is rendered by mainPanel.js when open
    if (mainPanelOpen) {
        refreshOpenTab();
        const body = document.getElementById("mp-body");
        if (document.querySelector("#main-panel-tabs button.on")?.dataset?.tab === "inventory") {
            wireInventoryBuys(body);
        }
    }
}

function escapeHtml(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function openMainPanel() {
    const el = document.getElementById("main-panel");
    if (!el) return;
    mainPanelOpen = true;
    el.classList.add("open");
    el.setAttribute("aria-hidden", "false");
    wireMainPanelSocial();
    // Default to Server tab (roster + friend/enemy)
    const tabs = document.getElementById("main-panel-tabs");
    tabs?.querySelectorAll("button").forEach((b) => {
        b.classList.toggle("on", b.dataset.tab === "server");
    });
    renderMainPanelTab("server");
    document.exitPointerLock?.();
    localPlayer?.offAllEvent?.();
}
function closeMainPanel() {
    const el = document.getElementById("main-panel");
    if (!el) return;
    mainPanelOpen = false;
    el.classList.remove("open");
    el.setAttribute("aria-hidden", "true");
    if (!isDead && !isChatting) localPlayer?.onAllEvent?.();
}
function toggleMainPanel() {
    if (mainPanelOpen) closeMainPanel();
    else openMainPanel();
}
window.__mvCloseMainPanel = closeMainPanel;

function updateEnemyAreaBadge() {
    const badge = document.getElementById("enemy-area-badge");
    if (!badge) return;
    const capsule = localPlayer?._player?.getPlayerCapsule?.();
    const area = capsule ? isInEnemyArea(capsule.position) : null;
    const was = inEnemyArea;
    inEnemyArea = !!area;
    badge.style.display = area ? "block" : "none";
    badge.textContent = area ? `ENEMY AREA · ${area.name}` : "ENEMY AREA";
    if (inEnemyArea && !was) addRoomNotify(area.name, "entered PvP zone");
}

// Write hit only if target is enemy (or force PvP zone)
function onHitPlayer(targetId, damage) {
    if (!canDamageTarget(targetId)) return; // friend — no damage
    _lastHitterOf.set(targetId, playerId);
    set(ref(db, `rooms/${roomId}/hits/${targetId}/${Date.now()}`), { damage, by: playerId });
}

const PLAYER_STALE_MS = 60000; // no heartbeat for 60s → offline / ghost seat

// Initialize Firebase listeners: presence + stale prune + hit events
function initFirebaseSync() {
    // Prune leftovers from previous sessions that never disconnected cleanly
    void pruneAndCountLivePlayers();

    // çŽ©å®¶çŠ¶æ€ç›‘å¬
    const roomRef = ref(db, `rooms/${roomId}/players`);
    onValue(roomRef, snapshot => {
        const data = snapshot.val() ?? {};
        for (const [id, state] of Object.entries(data)) {
            if (id === playerId) continue;
            // å¿ƒè·³è¶…æ—¶ï¼šä»Ž Firebase åˆ é™¤ï¼Œè§¦å‘æœ¬åœ° dispose
            if (Date.now() - (state.t ?? 0) > PLAYER_STALE_MS) {
                remove(ref(db, `rooms/${roomId}/players/${id}`));
                continue;
            }
            if (!remotePlayers.has(id)) {
                const rp = new RemotePlayer(id, state.charIdx ?? 2);
                remotePlayers.set(id, rp);
                rp.load().then(() => {
                    rp.applyState(state);
                    addRoomNotify(state.name || id, "joined");
                });
                updateCountUI();
            } else {
                remotePlayers.get(id).applyState(state);
            }
        }
        for (const id of remotePlayers.keys()) {
            if (!data[id]) {
                const name = remotePlayers.get(id).name || id;
                remotePlayers.get(id).dispose();
                remotePlayers.delete(id);
                updateCountUI();
                addRoomNotify(name, "left");
            }
        }
    });

    // ç›‘å¬èŠå¤©æ¶ˆæ¯ï¼ˆåªæŽ¥æ”¶åŠ å…¥åŽçš„æ–°æ¶ˆæ¯ï¼‰
    const joinTime = Date.now();
    const chatRef = ref(db, `rooms/${roomId}/chat`);
    onChildAdded(chatRef, snap => {
        const { name, text, t } = snap.val();
        if (t < joinTime - 3000) return; // è¿‡æ»¤æ—©äºŽåŠ å…¥æ—¶é—´ 3 ç§’çš„åŽ†å²æ¶ˆæ¯
        addChatMessage(name, text);
        const senderId = snap.key.replace(/^\d+_/, '');
        remotePlayers.get(senderId)?.showChatBubble(text);
        if (Date.now() - t > 30000) remove(snap.ref); // æ¸…ç†è¶…è¿‡ 30 ç§’çš„æ—§æ¶ˆæ¯
    });

    // ç›‘å¬å…¶ä»–çŽ©å®¶äº§ç”Ÿçš„å¼¹ç—•ï¼ˆè‡ªå·±çš„è·³è¿‡ï¼Œå…¥åœºå‰ 3 ç§’çš„å¿½ç•¥ï¼Œè¯»å®Œå³åˆ ï¼‰
    const decalsRef = ref(db, `rooms/${roomId}/decals`);
    onChildAdded(decalsRef, snap => {
        const d = snap.val();
        if (!d || snap.key?.endsWith(`_${playerId}`)) { remove(snap.ref); return; }
        if (d.t < joinTime - 3000) { remove(snap.ref); return; }
        decalSystem?.spawnAtPoint(new THREE.Vector3(d.x, d.y, d.z), new THREE.Vector3(d.nx, d.ny, d.nz));
        remove(snap.ref);
    });

    // Hits against local player
    const myHitsRef = ref(db, `rooms/${roomId}/hits/${playerId}`);
    onChildAdded(myHitsRef, snap => {
        const { damage, by } = snap.val() || {};
        remove(snap.ref);
        // Friend label: do not take damage from that player (unless enemy area)
        if (by && !canTakeDamageFrom(by)) return;
        if (by) lastAttackerOnMe = by;
        // Friends blocked above; everyone else can damage (incl. warlords noGun)
        if (!isDead) {
            myHp = Math.max(0, myHp - (damage || 0));
            updateMyHPUI();
            if (myHp <= 0) triggerDeath();
        }
    });

    // Friend requests addressed to us
    const reqRef = ref(db, `rooms/${roomId}/social/requests/${playerId}`);
    onChildAdded(reqRef, (snap) => {
        const data = snap.val() || {};
        const fromId = data.fromId || snap.key;
        if (!fromId || fromId === playerId) return;
        if (playerRelations.get(fromId) === "friend") {
            remove(snap.ref);
            return;
        }
        pendingIn.add(fromId);
        if (!pendingInShown.has(fromId)) {
            pendingInShown.add(fromId);
            const fromName = data.fromName || remotePlayers.get(fromId)?.name || fromId;
            showFriendRequestUI(
                fromId,
                fromName,
                () => acceptFriend(fromId),
                () => declineFriend(fromId),
            );
        }
        if (mainPanelOpen) refreshOpenTab();
    });

    // Peer relations sync (they accepted / unfriended)
    const relRef = ref(db, `rooms/${roomId}/social/relations/${playerId}`);
    onValue(relRef, (snap) => {
        const data = snap.val() || {};
        for (const [otherId, st] of Object.entries(data)) {
            if (!st?.rel) continue;
            if (st.rel === "friend" || st.rel === "enemy") {
                const cur = playerRelations.get(otherId);
                if (cur !== st.rel) {
                    playerRelations.set(otherId, st.rel);
                    pendingOut.delete(otherId);
                    updateNameLabelRelation(otherId);
                }
            }
        }
        saveRelations();
        if (mainPanelOpen) refreshOpenTab();
    });
}

// ==================== UI ====================
// æ˜¾ç¤ºè¿›å‡ºæˆ¿é—´é€šçŸ¥ï¼ˆä¸Žå‡»æ€åŠ¨æ€å…±ç”¨å®¹å™¨ï¼Œ5 ç§’åŽæ¶ˆå¤±ï¼‰
function addRoomNotify(name, action) {
    const feed = document.getElementById("kill-feed");
    if (!feed) return;
    while (feed.children.length >= 3) feed.removeChild(feed.firstChild);
    const el = document.createElement("div");
    el.className = "kf-entry";
    el.style.fontSize = "12px";
    el.innerHTML = `<span style="color:#f4c542">${name}</span> <span style="color:#fff">${action}</span>`;
    feed.appendChild(el);
    setTimeout(() => el.parentNode && el.parentNode.removeChild(el), 5000);
}

// æ·»åŠ ä¸€æ¡å‡»æ€åŠ¨æ€ï¼ˆæœ€å¤šä¿ç•™ 3 æ¡ï¼Œ10 ç§’åŽè‡ªåŠ¨æ¶ˆå¤±ï¼‰
function addKillFeedEntry(killerName, victimName) {
    const feed = document.getElementById("kill-feed");
    if (!feed) return;
    while (feed.children.length >= 3) feed.removeChild(feed.firstChild);
    const entry = document.createElement("div");
    entry.className = "kf-entry";
    const gunSvg = `<svg width="42" height="18" viewBox="0 0 28 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity:0.7;vertical-align:middle"><path d="M1 5 L1 8 L7 8 L8 6.5 L7 5 Z" fill="#f4c542"/><rect x="7" y="4" width="14" height="4" rx="1" fill="#f4c542"/><path d="M12 8 L11 11 L14 11 L15 8 Z" fill="#f4c542"/><rect x="21" y="5" width="7" height="2" rx="0.5" fill="#f4c542"/></svg>`;
    entry.innerHTML = `<span class="kf-killer">${killerName}</span>${gunSvg}<span class="kf-victim">${victimName}</span>`;
    feed.appendChild(entry);
    setTimeout(() => entry.parentNode && entry.parentNode.removeChild(entry), 10000);
}

function initUI() {
    loadRelations();
    const closeBtn = document.getElementById("main-panel-close");
    const panel = document.getElementById("main-panel");
    closeBtn?.addEventListener("click", () => closeMainPanel());
    panel?.addEventListener("click", (e) => {
        if (e.target === panel) closeMainPanel();
    });
    document.querySelectorAll("#main-panel-tabs button").forEach((btn) => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("#main-panel-tabs button").forEach((b) => b.classList.remove("on"));
            btn.classList.add("on");
            const tab = btn.getAttribute("data-tab");
            const pl = document.getElementById("players-list");
            const ar = document.getElementById("areas-panel");
            if (pl) pl.style.display = tab === "players" ? "block" : "none";
            if (ar) ar.style.display = tab === "areas" ? "block" : "none";
            if (tab === "players") renderPlayersPanel();
            if (tab === "areas") renderPlayersPanel();
        });
    });
    renderPlayersPanel();
}

// æ›´æ–°åœ¨çº¿äººæ•°æ˜¾ç¤º
function updateCountUI() {
    const el = document.getElementById("mp-count");
    if (el) el.textContent = String(1 + remotePlayers.size);
}

// æ›´æ–°æœ¬åœ°çŽ©å®¶å¤´åƒè¡€é‡å¡«å……å’Œæ•°å­—æ˜¾ç¤º
function updateMyHPUI() {
    const fill = document.getElementById("avatar-hp-fill");
    const num = document.getElementById("my-hp-num");
    if (fill) {
        fill.style.height = `${myHp}%`;
        fill.style.background = myHp > 50
            ? "rgba(34,204,68,0.55)"
            : myHp > 25
                ? "rgba(255,170,0,0.65)"
                : "rgba(255,50,50,0.7)";
    }
    if (num) num.textContent = String(myHp);
    // Warlords combat frame (unit frame HP / scale meta)
    window.__mvHp = myHp;
    window.__mvMaxHp = 100;
    window.dispatchEvent(new CustomEvent("mv-hp", { detail: { hp: myHp, maxHp: 100 } }));
}

/** Show room-full UI with alternate room links (EN + ZH). */
function showRoomFull(liveCount = MAX_PLAYERS) {
    const overlay = document.getElementById("room-full-overlay");
    if (overlay) {
        overlay.style.display = "flex";
        const sub = overlay.querySelector(".rf-sub");
        if (sub) {
            sub.textContent = `Room full · ${liveCount}/${MAX_PLAYERS} live · try another room`;
        }
        const hint = overlay.querySelector(".rf-hint");
        if (hint) {
            hint.textContent = "Ghost seats are auto-pruned after 60s without heartbeat.";
        }
    } else {
        alert(`Room full (max ${MAX_PLAYERS}). Try #room2 or #room3`);
    }
    window.hideLoader?.();
}

/**
 * Count only live Firebase seats; prune stale ghosts first so room1 is not
 * permanently locked by crashed tabs that never fired onDisconnect.
 */
async function pruneAndCountLivePlayers() {
    const snap = await get(ref(db, `rooms/${roomId}/players`));
    if (!snap.exists()) return 0;
    const now = Date.now();
    const data = snap.val() || {};
    let live = 0;
    const jobs = [];
    for (const [id, state] of Object.entries(data)) {
        const t = state?.t ?? 0;
        if (now - t > PLAYER_STALE_MS) {
            jobs.push(remove(ref(db, `rooms/${roomId}/players/${id}`)));
            continue;
        }
        live += 1;
    }
    if (jobs.length) await Promise.allSettled(jobs);
    return live;
}

// ==================== è½¯æŽ’æ–¥ ====================
const _repDir = new THREE.Vector3();
// è½¯æŽ’æ–¥ï¼šé˜²æ­¢æœ¬åœ°çŽ©å®¶ä¸Žè¿œç¨‹çŽ©å®¶æ¨¡åž‹é‡å 
function applyRepulsion() {
    const capsule = localPlayer?._player?.getPlayerCapsule();
    if (!capsule) return;
    const R = PLAYER_MODEL.scale * 30 * 4;
    const S = R * 8 / 60;
    for (const rp of remotePlayers.values()) {
        if (!rp.loaded || !rp.model) continue;
        _repDir.subVectors(capsule.position, rp.targetPos).setY(0);
        const d = _repDir.length();
        if (d > 0.0001 && d < R) capsule.position.addScaledVector(_repDir.normalize(), (1 - d / R) * S);
    }
}

// ==================== AntMan èšäººæŠ€èƒ½ ====================
function antManAnimateToScale(targetScale, duration = 1) {
    if (antManScaleFrame !== null) { cancelAnimationFrame(antManScaleFrame); antManScaleFrame = null; }
    antManIsScaling = true;
    const fromScale = localPlayer?._player?.playerModelConfig.scale ?? targetScale;
    const startTime = performance.now();
    const tick = (now) => {
        const t = Math.min((now - startTime) / (duration * 1000), 1);
        localPlayer?._player?.setPlayerScale(fromScale + (targetScale - fromScale) * t);
        if (t < 1) { antManScaleFrame = requestAnimationFrame(tick); }
        else { antManScaleFrame = null; antManIsScaling = false; }
    };
    antManScaleFrame = requestAnimationFrame(tick);
}

// ==================== åŠ¨æ€å¹³å°å‡½æ•° ====================
// ä¸¤ç«¯ç¼“å…¥ã€ä¸­é—´åŒ€é€Ÿçš„ç¼“åŠ¨å‡½æ•°
function easeEndsLinearMiddle(progress, easeRatio = 0.18) {
    const ease = Math.min(Math.max(easeRatio, 0.001), 0.49);
    const maxSpeed = 1 / (1 - ease);
    if (progress < ease) return (maxSpeed * progress * progress) / (2 * ease);
    if (progress > 1 - ease) return 1 - (maxSpeed * (1 - progress) * (1 - progress)) / (2 * ease);
    return maxSpeed * (progress - ease / 2);
}

// å°† progressï¼ˆ0~1ï¼‰æ˜ å°„åˆ° X è½´è·¯å¾„ä¸Šï¼Œç»“æžœå†™å…¥ target Vector3
function setPositionOnXPath(target, progress) {
    if (!dynamicPlatformXSegments.length || dynamicPlatformXLength <= 0) return;
    let targetDistance = progress * dynamicPlatformXLength;
    for (const segment of dynamicPlatformXSegments) {
        if (targetDistance <= segment.length) {
            target.lerpVectors(segment.from, segment.to, targetDistance / segment.length);
            return;
        }
        targetDistance -= segment.length;
    }
    target.copy(dynamicPlatformXPath[dynamicPlatformXPath.length - 1]);
}

// æ¯å¸§æ›´æ–°æ‰€æœ‰åŠ¨æ€å¹³å°ä½ç½®åŠäº‘æœµæ¸²æŸ“
function updateDynamicPlatforms() {
    const t = Date.now() / 1000;
    dynamicPlatforms.forEach(({ mesh, basePosition, motion, cloud }) => {
        if (motion?.axis === "y") {
            // æ­£å¼¦å¾€è¿”ï¼šä»¥ basePosition.y ä¸ºåº•éƒ¨ï¼Œå‘ä¸Šè¿åŠ¨ distance*2 çš„èŒƒå›´
            mesh.position.copy(basePosition);
            mesh.position.y = basePosition.y + Math.sin(t * motion.speed) * motion.distance + motion.distance;
        } else if (motion?.axis === "x") {
            // æ²¿æŠ˜çº¿è·¯å¾„å¾€è¿”ï¼Œä¸¤ç«¯ç¼“åŠ¨
            const phase = (t * motion.speed / Math.PI) % 2;
            const rawProgress = phase <= 1 ? phase : 2 - phase;
            setPositionOnXPath(mesh.position, easeEndsLinearMiddle(rawProgress));
        }
        updateVolumeCloud(cloud, camera);
    });
}

// åˆ›å»ºåŠ¨æ€å¹³å°ï¼šä¸å¯è§ç¢°æ’žåœ†ç›˜ + ä½“ç§¯äº‘è§†è§‰ï¼Œæ³¨å†Œåˆ° playerController ç¢°æ’žç³»ç»Ÿ
function createDynamicPlatform({ position, radius = 0.16, cloudScale = [0.32, 0.15, 0.32], motion = null }) {
    const mesh = new THREE.Mesh(
        new THREE.CircleGeometry(radius, 32),
        new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.7, metalness: 0, roughness: 0.5, side: THREE.DoubleSide }),
    );
    mesh.position.copy(position);
    mesh.rotation.x = -Math.PI / 2;
    mesh.material.visible = false;
    scene.add(mesh);
    localPlayer._player.addDynamicCollider(mesh); // æ³¨å†Œä¸ºåŠ¨æ€ç¢°æ’žä½“ï¼ŒçŽ©å®¶å¯ç«™ç«‹

    // ä½“ç§¯äº‘ä½œä¸ºå­èŠ‚ç‚¹æŒ‚åœ¨ç¢°æ’žç›˜ä¸Šï¼Œéšå¹³å°ä¸€èµ·ç§»åŠ¨
    const cloud = createVolumeCloud({ scale: cloudScale, opacity: 0.28, steps: 80 });
    cloud.position.set(0, 0, 0);
    cloud.rotation.x = Math.PI / 2;
    mesh.add(cloud);

    dynamicPlatforms.push({ mesh, cloud, basePosition: position.clone(), motion });
}


// ==================== æ¸²æŸ“å¾ªçŽ¯ ====================
// åˆ·æ–°é¡¶éƒ¨å‡»æ€æ ï¼šå·¦ä¾§æœ¬äººå‡»æ€ï¼Œå³ä¾§æˆ¿é—´ç¬¬ä¸€å‡»æ€
function updateKillBar() {
    const myEl = document.getElementById("kb-my-kills");
    const topEl = document.getElementById("kb-top-kills");
    if (!myEl || !topEl) return;
    const topKills = Math.max(
        localKills,
        ...Array.from(remotePlayers.values()).map(rp => rp.kills)
    );
    myEl.textContent = localKills;
    topEl.textContent = topKills;
}

// åˆ·æ–°è®¡åˆ†æ¿å†…å®¹å¹¶æŽ’åºï¼ˆæŒ‰å‡»æ€é™åºï¼Œç›¸åŒåˆ™æ­»äº¡å‡åºï¼‰
function updateScoreboard() {
    const rows = [
        { name: myName, kills: localKills, deaths: localDeaths, isLocal: true },
        ...Array.from(remotePlayers.values())
            .map(rp => ({ name: rp.name || rp.id, kills: rp.kills, deaths: rp.deaths, isLocal: false })),
    ];
    rows.sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);

    const tbody = document.getElementById("sb-body");
    if (!tbody) return;
    tbody.innerHTML = "";
    rows.forEach((p, i) => {
        const tr = document.createElement("tr");
        if (p.isLocal) tr.className = "sb-local";
        tr.innerHTML = `<td>${i + 1}</td><td>${p.name}</td><td>${p.kills}</td><td>${p.deaths}</td>`;
        tbody.appendChild(tr);
    });
}

// ä¸»æ¸²æŸ“å¾ªçŽ¯ï¼ˆç”± renderer.setAnimationLoop é©±åŠ¨ï¼‰
let prevGunEngaged = false;
function animate() {
    const delta = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.getElapsedTime();

    if (localPlayer && (weapon || PLAYER_MODEL.noGun)) {
        if (!isDead) {
            const spineIK = localPlayer.spineIK;
            const gunEngaged = weapon?.isGunEngaged() ?? false;

            if (gunEngaged !== prevGunEngaged) {
                localPlayer.setThirdMouseMode(gunEngaged ? 5 : 1);
                prevGunEngaged = gunEngaged;
            }

            if (gunEngaged) spineIK?.restoreBones();
            localPlayer.update(delta);

            // èŠå¤©æœŸé—´è·³è¿‡ SpineIKï¼Œé˜²æ­¢é‡Šæ”¾æŒ‡é’ˆé”æ—¶æ¼è¿›çš„ mousemove å¯¼è‡´ä¸ŠåŠèº«çªè½¬
            if (gunEngaged && !isChatting) {
                localPlayer.applyHipsCorrection();
                localPlayer.getIsFirstPerson()
                    ? spineIK?.applyAim1P(camera, localPlayer.pitchTarget1P)
                    : spineIK?.applyAim3P(camera, true);
            }

            weapon?.update(elapsed, delta);
            applyRepulsion();


            const now = performance.now();
            if (now - lastSendTime > SEND_INTERVAL) { lastSendTime = now; sendState(); }
        } else {
            // æ­»äº¡æ—¶åªæŽ¨è¿› mixerï¼Œä¸è¿è¡ŒçŠ¶æ€æœº
            localPlayer._player?.animation?.mixer?.update(delta);
            if (localPlayer._upperMixer) localPlayer._upperMixer.update(delta);
        }
    } else {
        controls?.update();
    }

    for (const rp of remotePlayers.values()) {
        rp.tick(delta);
        rp.updateNameLabel(camera, renderer);
    }

    updateDynamicPlatforms();
    updateEnemyAreaBadge();
    if (warlords?.update) warlords.update(delta);

    renderer.render(scene, camera);
}

// ==================== åˆå§‹åŒ– ====================
// åˆå§‹åŒ–åœºæ™¯ã€æœ¬åœ°çŽ©å®¶ã€æ­¦å™¨ç³»ç»Ÿã€Firebase åŒæ­¥
async function init() {
    // Three.js production (r185+): sRGB + ACES, cap DPR, high-performance GPU
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        stencil: false,
        preserveDrawingBuffer: false,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setAnimationLoop(animate);
    document.getElementById("container").appendChild(renderer.domElement);

    // Far plane sized for Bermuda island (~800 m), not infinite draw
    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1200);

    controls = new MapControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minDistance = 2;
    controls.maxDistance = 80;

    // Hemi + key sun (few lights — production lighting budget)
    scene.add(new THREE.HemisphereLight(0xb8d0ff, 0x3a2818, 0.55));
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const dir = new THREE.DirectionalLight(0xfff1d0, 1.65);
    dir.position.set(40, 80, 30);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.near = 1;
    dir.shadow.camera.far = 200;
    const sc = dir.shadow.camera;
    sc.left = sc.bottom = -50;
    sc.right = sc.top = 50;
    scene.add(dir);
    scene.fog = new THREE.FogExp2(0x0c1018, 0.0045);

    // Background / IBL (optional HDR; solid fallback if missing)
    scene.background = new THREE.Color(0x0a0e16);
    new HDRLoader().load(
        "./img/1.hdr",
        (texture) => {
            // HDR is linear data — do not force sRGB colorSpace
            texture.mapping = THREE.EquirectangularReflectionMapping;
            scene.background = texture;
            scene.environment = texture;
        },
        undefined,
        (err) => {
            console.warn("[init] HDR optional failed — solid sky", err?.message || err);
        }
    );

    // GLTF åŠ è½½å™¨
    const draco = new DRACOLoader();
    draco.setDecoderPath("https://unpkg.com/three@0.180.0/examples/jsm/libs/draco/");
    gltfLoader.setDRACOLoader(draco);

    // Collider / visual scene: Bermuda island (Warlords) or legacy burnout
    let sceneModel = new THREE.Group();
    sceneModel.name = "scene-root";
    if (!USE_WARLORDS_ISLAND) {
        const gltf = await gltfLoader.loadAsync(BASE + "glb/burnout_revenge_-_central_route_crash_junction.glb");
        sceneModel = gltf.scene;
        sceneModel.scale.set(10, 10, 10);
        scene.add(sceneModel);
    } else {
        // Temporary ground until island attaches (grudge6 SI)
        const ground = new THREE.Mesh(
            new THREE.CircleGeometry(40, 48),
            new THREE.MeshStandardMaterial({ color: 0x2a3a28, roughness: 0.95 }),
        );
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        sceneModel.add(ground);
        scene.add(sceneModel);
    }

    // Enemy area viz (legacy map coords — still useful as danger zones near origin)
    for (const a of ENEMY_AREAS) {
        const size = new THREE.Vector3().subVectors(a.max, a.min);
        const center = new THREE.Vector3().addVectors(a.min, a.max).multiplyScalar(0.5);
        const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xff3333,
            transparent: true,
            opacity: 0.12,
            depthWrite: false,
            side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(center);
        mesh.name = `enemy-area-${a.id}`;
        mesh.userData.enemyArea = true;
        scene.add(mesh);
        const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(geo),
            new THREE.LineBasicMaterial({ color: 0xff6666, transparent: true, opacity: 0.55 }),
        );
        edges.position.copy(center);
        scene.add(edges);
    }

    // Prune ghost seats before capacity check (stale tabs used to permanently lock room1)
    const existingCount = await pruneAndCountLivePlayers();
    if (existingCount >= MAX_PLAYERS) {
        showRoomFull(existingCount);
        return;
    }
    spawnIndex = existingCount % SPAWN_POINTS.length;
    const spawnPos = USE_WARLORDS_ISLAND
        ? new THREE.Vector3(0, 2, 0)
        : SPAWN_POINTS[spawnIndex];
    camera.position.copy(spawnPos).add(new THREE.Vector3(4, 3, 6));
    controls.target.copy(spawnPos);

    // Local player: SI capsule (scale 0.01 → ~1.8 m) + grudge6 visual in warlords
    // Mixamo mesh hidden after attach; do NOT use 0.001 FPS scale (tiny capsule / void fall).
    localPlayer = new LocalPlayer({ scene, camera, controls });
    await localPlayer.init({
        playerModelConfig: {
            ...PLAYER_MODEL,
            scale: USE_WARLORDS_ISLAND ? 0.01 : PLAYER_MODEL.scale,
            // Prefer idle; gun anims unused in warlords
            noGun: USE_WARLORDS_ISLAND ? true : PLAYER_MODEL.noGun,
        },
        initPos: spawnPos,
        minCamDistance: USE_WARLORDS_ISLAND ? 2.5 : 2,
        maxCamDistance: USE_WARLORDS_ISLAND ? 18 : 220,
        enableOverShoulderView: true,
        staticCollider: sceneModel,
        // Desktop keyboard/mouse only — do not inject mobile joystick UI
        isShowMobileControls: false,
        // Free mouse — never force pointer-lock on embed/play
        mouseSensitivity: USE_WARLORDS_ISLAND ? 2.2 : 5,
    });
    if (USE_WARLORDS_ISLAND) {
        // Hide FPS mixamo immediately; grudge6 attaches later
        try {
            localPlayer.getPlayerModel?.()?.traverse((c) => { c.visible = false; });
            if (localPlayer._player?.playerModel) localPlayer._player.playerModel.visible = false;
        } catch { /* ignore */ }
        // Ensure cursor visible (embed iframes + OrbitControls)
        try {
            document.exitPointerLock?.();
            document.body.style.cursor = "crosshair";
            const ch = document.getElementById("crosshair");
            if (ch) {
                ch.style.display = "block";
                ch.style.opacity = "0.95";
            }
            if (renderer?.domElement) renderer.domElement.style.cursor = "crosshair";
        } catch { /* ignore */ }
        mountWarlordsHud();
        window.setLoaderStatus?.("Controller ready · loading world…");
    }

    // è®¾ç½®æœ¬åœ°çŽ©å®¶æè´¨
    localPlayer.getPlayerModel()?.traverse((child) => {
        if (child.isMesh) {
            child.material.metalness = 0.0;
            child.material.roughness = 1.0;
        }
    });

    localPlayer.onViewChange = (isFirstPerson) => {
        if (!localPlayer._player.playerModelHead) {
            if (isFirstPerson) {
                localPlayer._player.getPlayerModel().visible = false;
            } else {
                localPlayer._player.getPlayerModel().visible = true;
            }
        }
    };

    // æ‰“å°éª¨éª¼åï¼Œç”¨äºŽæŽ’æŸ¥ SpineIK éª¨éª¼åä¸åŒ¹é…é—®é¢˜ï¼ˆæŽ’æŸ¥å®Œå¯åˆ é™¤ï¼‰
    const boneNames = [];
    localPlayer.getPlayerModel()?.traverse(b => { if (b.isBone) boneNames.push(b.name); });

    // è¿½è¸ªä¸ŠåŠèº«åŠ¨ç”» keyï¼ˆmonkey-patchï¼Œä¸æ”¹ LocalPlayer æºç ï¼‰
    const origPlayUpper = localPlayer.playUpperBody.bind(localPlayer);
    const origStopUpper = localPlayer.stopUpperBody.bind(localPlayer);
    localPlayer.playUpperBody = (key, opts) => { currentUpperKey = key; return origPlayUpper(key, opts); };
    localPlayer.stopUpperBody = (fade) => { currentUpperKey = null; return origStopUpper(fade); };

    // HUD
    const hud = new HUD([
        { key: "1", mode: "primary", label: "Rifle" },
        { key: "4", mode: "normal", label: "Fists" },
    ]);
    hud.build();

    // éŸ³é¢‘
    audioListener = new THREE.AudioListener();
    camera.add(audioListener);

    // ç‰¹æ•ˆ
    const effects = new ShootingEffects(scene, { listener: audioListener, flashScale: 0.015, smokeSize: 0.08 });
    await effects.load(
        BASE + "img/muzzle_flash.png",
        BASE + "img/smoke.png",
        BASE + "audio/gun_shot.mp3",
        BASE + "audio/reload.mp3",
    );
    gunShotBuffer = effects._fireSound?.buffer ?? null;

    // å¼¹å­”
    decalSystem = new DecalSystem(scene, 60, 0.025);
    await decalSystem.loadMaterials(["img/bullet_hole2.png"], BASE);
    decalSystem.onSpawn = (p, n) => {
        set(ref(db, `rooms/${roomId}/decals/${Date.now()}_${playerId}`), {
            x: +p.x.toFixed(4), y: +p.y.toFixed(4), z: +p.z.toFixed(4),
            nx: +n.x.toFixed(4), ny: +n.y.toFixed(4), nz: +n.z.toFixed(4),
            t: Date.now(),
        });
    };

    // æ­¦å™¨æŽ§åˆ¶å™¨ï¼ˆnoGun è§’è‰²æ— éœ€æ­¦å™¨ç³»ç»Ÿï¼‰
    if (!PLAYER_MODEL.noGun) {
        weapon = new WeaponController({ scene, camera, localPlayer, decalSystem, effects, hud, zombieManager: null });
        await weapon.load(gltfLoader, BASE);
        weapon.setupAnimations();
        weapon.bindInput();

        const _origFireOnce = weapon._fireOnce.bind(weapon);
        weapon._fireOnce = function () { localShotSeq++; _origFireOnce(); };
    }

    // æ³¨å†Œæ­»äº¡åŠ¨ç”»ï¼šLoopOnce + é”æœ«å¸§ï¼Œæ’­å®ŒåŽæ˜¾ç¤ºæ­»äº¡é®ç½©ï¼ˆnoGun è§’è‰²æ— æ­»äº¡åŠ¨ç”»ï¼Œè·³è¿‡ï¼‰
    if (!PLAYER_MODEL.noGun) {
        localPlayer.registerAnimation("death", "death", {
            loop: false,
            clampWhenFinished: true,
            timeScale: 2,
            onFinished: () => { document.getElementById("death-overlay").style.display = "flex"; },
        });
    }

    // æ­»äº¡é®ç½©æŒ‰é’®
    document.getElementById("btn-respawn").addEventListener("click", triggerRespawn);

    // æ³¨å…¥å¤šäººå‘½ä¸­å›žè°ƒï¼ˆnoGun è§’è‰²æ— æ­¦å™¨ï¼Œè·³è¿‡ï¼‰
    if (weapon) {
        weapon.onHitPlayer = onHitPlayer;
        localPlayer.setGunEngagedGetter(() => weapon.isGunEngaged());
        hud.update(weapon.getMode());
    }

    document.addEventListener("contextmenu", e => e.preventDefault());

    // Enter é”®æ‰“å¼€/å‘é€èŠå¤©ï¼ŒEsc å–æ¶ˆ
    document.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            e.preventDefault();
            isChatting ? closeChat(true) : openChat();
        }
        if (e.key === "Escape" && isChatting) {
            e.preventDefault();
            closeChat(false);
        }
    });

    // Tab = scoreboard; K = Players main panel
    const scoreboardEl = document.getElementById("scoreboard");
    document.addEventListener("keydown", e => {
        if (isChatting) return;
        if (e.key === "Tab") {
            e.preventDefault();
            if (mainPanelOpen) return;
            updateScoreboard();
            if (scoreboardEl) scoreboardEl.style.display = "flex";
        }
        // Main panel: I (inventory / players) — K still works as alias
        if ((e.code === "KeyI" || e.code === "KeyK") && !e.repeat) {
            e.preventDefault();
            toggleMainPanel();
        }
        if (e.key === "Escape" && mainPanelOpen) {
            e.preventDefault();
            closeMainPanel();
        }
    });
    document.addEventListener("keyup", e => {
        if (e.key === "Tab" && scoreboardEl) scoreboardEl.style.display = "none";
    });

    // Z é”®ï¼šAntMan èšäººç¼©æ”¾æŠ€èƒ½ï¼ˆä»… AntMan è§’è‰²å¯ç”¨ï¼‰
    document.addEventListener("keydown", e => {
        if (e.code !== "KeyZ" || PLAYER_MODEL.name !== "AntMan") return;
        if (antManIsScaling || isDead || isChatting) return;
        antManIsSmall = !antManIsSmall;
        const normalScale = CHARACTER_LIST[5].scale;
        antManAnimateToScale(antManIsSmall ? normalScale / 9 : normalScale, 1);
    });

    // Firebase sync
    initFirebaseSync();

    // UI
    initUI();
    mountMainPanelShell();
    wireMainPanelSocial();
    updateMyHPUI();
    const nameEl = document.getElementById("local-player-name");
    if (nameEl) nameEl.textContent = myName;
    window.__mvPlayerName = myName;
    window.__mvHp = myHp;
    window.__mvMaxHp = 100;
    updateMyHPUI();

    // ── Multiverse Railway (own service) — NOT gameopen-production ──────────
    // Fleet rule: each game → its own Railway. Firebase is harvest/chat optional only.
    let dangerNet = null;
    try {
        setNetStatus("Net · Multiverse Railway…", false);
        window.setLoaderStatus?.("Connecting Multiverse Railway room…");
        const roomHint = (location.hash || "#room1").slice(1) || "room1";
        const sel = loadSelection();
        const { client, ok, err, code, backend } = await connectMultiverseDanger(myName, roomHint, {
            classId: sel.classId,
            raceId: sel.raceId,
        });
        dangerNet = client;
        window.__mvDangerNet = client;
        window.__mvNetBackend = backend || "multiverse-railway";
        if (ok) {
            setNetStatus(`Net · Railway ${code || roomHint}`, true);
            let lastReport = 0;
            const reportState = () => {
                if (!dangerNet?.connected) return;
                const cap = localPlayer?._player?.getPlayerCapsule?.();
                if (!cap) return;
                const now = performance.now();
                if (now - lastReport < STATE_REPORT_MS) return;
                lastReport = now;
                const vel = localPlayer._player.getVelocity?.() || { x: 0, y: 0, z: 0 };
                const moving = Math.hypot(vel.x, vel.z) > 0.05;
                const sel2 = loadSelection();
                dangerNet.sendState({
                    px: cap.position.x,
                    py: cap.position.y,
                    pz: cap.position.z,
                    ry: cap.rotation?.y ?? 0,
                    clip: moving ? "run" : "idle",
                    weapon: sel2.classId || "none",
                    hp: myHp,
                    moving,
                    grounded: !!localPlayer._player.getIsOnGround?.(),
                    guard: "open",
                });
            };
            setInterval(reportState, STATE_REPORT_MS);
            dangerNet.on("snapshot", (players) => {
                for (const p of players || []) {
                    if (p.id === dangerNet.selfId) continue;
                    // Prefer match by remote id tag if present, else name
                    let rp = remotePlayers.get(p.id);
                    if (!rp) {
                        rp = [...remotePlayers.values()].find((r) => r.name === p.name);
                    }
                    if (rp && typeof p.px === "number") {
                        try {
                            rp.applyState?.({
                                x: p.px, y: p.py, z: p.pz,
                                ry: p.ry, name: p.name, t: Date.now(),
                            });
                        } catch { /* remote shape */ }
                    }
                }
            });
            dangerNet.on("close", () => setNetStatus("Net · Railway reconnect…", false));
            dangerNet.on("open", () => setNetStatus(`Net · Railway ${dangerNet.roomCode || "live"}`, true));
        } else {
            // Do NOT claim "Firebase multiplayer" — presence is degraded
            setNetStatus(`Net · offline (${err || "no railway"})`, false);
            console.warn(
                "[net] Multiverse Railway unavailable — start server/ on Railway. Firebase is not multiplayer authority.",
                err,
            );
        }
    } catch (e) {
        setNetStatus("Net · offline", false);
        console.warn("[net] Multiverse Railway connect failed", e);
    }

    // Warlords: Bermuda island + grudge6 + harvest + bosses + skills + soft-lock
    if (USE_WARLORDS_ISLAND) {
        try {
            window.setLoaderProgress?.(0.4, 1, "Deploying island layers…");
            warlords = await attachWarlordsWorld({
                scene,
                camera,
                renderer,
                controls,
                localPlayer,
                db,
                roomId,
                playerId,
                set,
                ref,
                onValue,
                onChildAdded,
                remove,
                flash: (msg, t) => {
                    const el = document.getElementById("combat-flash");
                    if (el) {
                        el.textContent = msg;
                        el.style.opacity = "1";
                        setTimeout(() => { el.style.opacity = "0"; }, (t || 0.8) * 1000);
                    } else {
                        addRoomNotify(msg, "");
                    }
                },
                onBossHitLocal: (dmg, name) => {
                    if (isDead) return;
                    myHp = Math.max(0, myHp - dmg);
                    updateMyHPUI();
                    addRoomNotify(name, `hits you −${dmg}`);
                    if (myHp <= 0) triggerDeath();
                },
            });
            const sel = loadSelection();
            window.__mvClassId = sel.classId;
            window.__mvRaceId = sel.raceId;
            window.setLoaderProgress?.(1, 1, "World ready");
        } catch (e) {
            console.error("[warlords] attach failed", e);
            addRoomNotify("Warlords world", "failed to load — see console");
            window.setLoaderStatus?.("World load failed — check console");
        }
    }

    window.addEventListener("resize", () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Dynamic platforms only on legacy burnout map
    if (!USE_WARLORDS_ISLAND) {
        createDynamicPlatform({ position: new THREE.Vector3(22, 2.76, 9.7), motion: { axis: "y", distance: 4, speed: 0.25 } });
        createDynamicPlatform({ position: dynamicPlatformXPath[0], motion: { axis: "x", distance: 3, speed: 0.05 } });
    }

    window.hideLoader?.();
}

waitForName().then(() => {
    const entry = CHARACTER_LIST.find(c => c.url === selectedModelUrl) ?? CHARACTER_LIST[2];
    Object.assign(PLAYER_MODEL, entry);
    return init();
});

