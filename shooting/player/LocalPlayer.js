import { MathUtils, Quaternion, Vector3, AnimationMixer, AnimationClip, LoopOnce, LoopRepeat } from "three";
import { playerController } from '../../src/playerController';
import { SpineIK } from "./spineIK.js";

const spineBoneNames = ["mixamorigSpine", "mixamorigSpine1", "mixamorigSpine2"];

// è¿åŠ¨çŠ¶æ€é›†åˆï¼ˆç”¨äºŽåˆ¤æ–­ isMovingï¼‰
const locomotionStates = new Set([
    "idle",
    "walking",
    "walking_backward",
    "left_walking",
    "right_walking",
    "running",
    "jumping",
    "flyidle",
    "flying",
]);

// å…è®¸æ‰§è¡Œæˆ˜æ–—é€»è¾‘çš„è¿åŠ¨çŠ¶æ€ï¼ˆä¸ŠåŠèº«åˆ†ç¦»åŽï¼Œå¥”è·‘æ—¶ä¹Ÿå¯å¼€ç«/æ¢å¼¹ï¼‰
const combatAllowedLocomotion = new Set([
    "idle", "walking", "walking_backward", "left_walking", "right_walking", "running",
]);

const minPitchAngle = -Math.PI * (60 / 180); // ä¿¯ä»°æœ€å°è§’ï¼ˆå‘ä¸‹ï¼‰
const maxPitchAngle = Math.PI * (40 / 180);  // ä¿¯ä»°æœ€å¤§è§’ï¼ˆå‘ä¸Šï¼‰

export class LocalPlayer {
    constructor({ scene, camera, controls }) {
        // ==================== åœºæ™¯å¼•ç”¨ ====================
        this._scene = scene;
        this._camera = camera;
        this._controls = controls;

        // ==================== æ ¸å¿ƒå¯¹è±¡ ====================
        this._player = null; // playerController å®žä¾‹
        this.spineIK = null; // è„Šæ¤Ž IK å®žä¾‹

        // ==================== è¿åŠ¨çŠ¶æ€ ====================
        this.pitchTarget1P = 0; // ç¬¬ä¸€äººç§°ä¿¯ä»°ç´¯ç§¯å€¼
        this.isMoving = false; // å½“å‰å¸§æ˜¯å¦å¤„äºŽç§»åŠ¨çŠ¶æ€ï¼ˆç”± onAnimationChange æ›´æ–°ï¼‰
        this._locomotionState = "idle"; // å½“å‰è¿åŠ¨åŠ¨ç”»çŠ¶æ€å

        // ==================== é…ç½® ====================
        this._mouseSensitivity = 5;
        this._firstPersonPitchOffset = 0; // ç¬¬ä¸€äººç§°ç›¸æœºä¿¯ä»°åˆå§‹åç§»

        // ==================== å¤–éƒ¨æ³¨å…¥ ====================
        this._isGunEngagedFn = null; // ç”± WeaponController æ³¨å…¥ï¼Œåˆ¤æ–­æ˜¯å¦æŒæžª

        // ==================== ä¸ŠåŠèº«åŠ¨ç”»å±‚ ====================
        this._upperMixer = null;          // ä¸ŠåŠèº«ä¸“ç”¨ AnimationMixerï¼ˆroot = æ¨¡åž‹æ ¹èŠ‚ç‚¹ï¼‰
        this._upperBodyBoneNames = null;  // è„Šæ¤Žä»¥ä¸Šæ‰€æœ‰éª¨éª¼åç§°é›†åˆï¼Œç”¨äºŽè¿‡æ»¤ partial clip
        this._upperBodyBones = null;      // è„Šæ¤Žä»¥ä¸Šéª¨éª¼å¼•ç”¨æ•°ç»„ï¼ˆç¼“å­˜ï¼Œé¿å…æ¯å¸§ getObjectByNameï¼‰
        this._upperBoneSnapshots = null;  // ä¸» mixer éª¨éª¼å€¼å¿«ç…§
        this._upperActions = new Map();   // key â†’ AnimationAction
        this._upperState = null;          // å½“å‰ä¸ŠåŠèº«åŠ¨ä½œ

        // ==================== èµ°è·¯çž„å‡†ä¿®æ­£ ====================
        this._idleHipsQ = null; // é™æ­¢æ—¶ä¿å­˜çš„ hips æœ¬åœ°å››å…ƒæ•°ï¼Œç”¨äºŽèµ°è·¯æ—¶æŠµæ¶ˆ hips èµ°è·¯åç§»
    }

    // ==================== åˆå§‹åŒ– ====================

    // åˆå§‹åŒ– playerControllerã€éª¨éª¼ IKã€äº‹ä»¶å›žè°ƒ
    async init(config) {
        const { mouseSensitivity = 5, ...rest } = config;
        this._mouseSensitivity = mouseSensitivity;
        this._firstPersonPitchOffset = config.playerModelConfig?.firstPersonPitchOffset
            ?? this._firstPersonPitchOffset;

        this._player = new playerController();
        await this._player.init({
            scene: this._scene,
            camera: this._camera,
            controls: this._controls,
            mouseSensitivity,
            ...rest,
        });

        // ç»‘å®šè„Šæ¤Ž & å¤´éƒ¨éª¨éª¼
        const model = this._player.getPlayerModel();
        const spineBones = spineBoneNames
            .map((n) => model?.getObjectByName(n))
            .filter(Boolean);
        const headBoneName = config.playerModelConfig?.headBoneName;
        const headBone = model?.getObjectByName(headBoneName) ?? null;
        this.spineIK = new SpineIK(spineBones, headBone);

        // ä¸ŠåŠèº« mixerï¼šroot = æ¨¡åž‹æ ¹èŠ‚ç‚¹ï¼ˆä¸Žä¸» mixer ä¸€è‡´ï¼Œè·¯å¾„è§£æžæœ€å¯é ï¼‰
        // é€šè¿‡ partial clipï¼ˆåªå«è„Šæ¤Žä»¥ä¸Šéª¨éª¼çš„ trackï¼‰æ¥é™åˆ¶å†™å…¥èŒƒå›´ï¼Œ
        // ä¸» mixer æ›´æ–°åŽå†æ›´æ–° upper mixerï¼ŒåŽè€…è¦†å†™è„Šæ¤Žä»¥ä¸Šéª¨éª¼ï¼Œä¸‹åŠèº«ä¿æŒ locomotion å€¼ã€‚
        if (spineBones.length > 0) {
            this._upperBodyBoneNames = new Set();
            this._upperBodyBones = [];
            spineBones[0].traverse(b => {
                this._upperBodyBoneNames.add(b.name);
                this._upperBodyBones.push(b);
            });
            // é¢„åˆ†é…å¿«ç…§æ•°ç»„ï¼Œé¿å…æ¯å¸§ GC
            this._upperBoneSnapshots = this._upperBodyBones.map(() => new Quaternion());
            this._upperMixer = new AnimationMixer(model);
        }

        // ç›‘å¬åŠ¨ç”»åˆ‡æ¢ï¼Œæ›´æ–° isMoving
        this._player.onAnimationChange = (name) => {
            if (locomotionStates.has(name)) this._locomotionState = name;
            this.isMoving =
                name === "walking" ||
                name === "left_walking" ||
                name === "right_walking" ||
                name === "walking_backward" ||
                name === "running";
        };

        // æŽ¥ç®¡ç¬¬ä¸€äººç§°é¼ æ ‡ç§»åŠ¨
        this._player.onTowardChange = (dx, dy, speed) => {
            if (!this._player.getIsFirstPerson()) return;

            // æ°´å¹³æœå‘
            this._player.getPlayerCapsule().rotateY(
                -dx * speed * this._mouseSensitivity
            );

            // ä¿¯ä»°è§’ç´¯ç§¯
            this.pitchTarget1P = MathUtils.clamp(
                this.pitchTarget1P + (-dy * speed * this._mouseSensitivity),
                minPitchAngle,
                maxPitchAngle
            );

            // æœªæŒæžªæ—¶ç›´æŽ¥é©±åŠ¨ç›¸æœº
            if (!this._isGunEngagedFn?.()) {
                this._camera.rotation.x = MathUtils.clamp(
                    this._camera.rotation.x + (-dy * speed * this._mouseSensitivity),
                    minPitchAngle,
                    maxPitchAngle
                );
            }
        };

        // è§†è§’åˆ‡æ¢
        this._player.onViewChange = (isFirstPerson) => {
            if (isFirstPerson) {
                if (headBoneName) {
                    console.log(headBoneName);
                    this._camera.position.z = 8;
                    this._camera.position.x = 15;
                } else {
                    this._camera.position.z = 0;
                    this._camera.position.x = 0;
                }
                this._camera.rotation.x = this._firstPersonPitchOffset;
                this._player.setEnableToward(false);
                // åŒæ­¥æŽ§åˆ¶å™¨ä¿¯ä»°è§’
                const targetPolar = this._controls.getPolarAngle() - Math.PI / 2 + Math.PI * (7.5 / 180);
                this.pitchTarget1P = targetPolar;
                // èˆªå‘è§’åç§»
                this._player.getPlayerCapsule().rotateY(-Math.PI * (17 / 180));
            } else {
                this._player.setEnableToward(true);
                // æŒæžªçž„å‡†çŠ¶æ€ä¸‹åˆ·æ–°ä¸€æ¬¡åŠ¨ç”»ï¼Œä¿è¯éª¨éª¼å¤åŽŸ
                if (this._player.getCurrentPlayerAnimationName().includes("rifle_idle_aim")) {
                    this._player.playAnimation("idle");
                }
                // åŒæ­¥ç¬¬ä¸€äººç§°ä¿¯ä»°è§’
                const targetPolar = Math.PI / 2 + this.pitchTarget1P - Math.PI * (7.5 / 180);
                this._controls.minPolarAngle = targetPolar;
                this._controls.maxPolarAngle = targetPolar;
                this._controls.update();
                this._controls.minPolarAngle = minPitchAngle + Math.PI / 2;
                this._controls.maxPolarAngle = maxPitchAngle + Math.PI / 2;
                // èˆªå‘è§’åç§»
                const delta = Math.PI * (17 / 180);
                const offset = this._camera.position.clone().sub(this._controls.target);
                offset.applyAxisAngle(new Vector3(0, 1, 0), delta);
                this._camera.position.copy(this._controls.target).add(offset);
                this._controls.update();
            }
        };

        // é™åˆ¶ç¬¬ä¸‰äººç§°ä¿¯ä»°è§’
        this._controls.minPolarAngle = minPitchAngle + Math.PI / 2;
        this._controls.maxPolarAngle = maxPitchAngle + Math.PI / 2;
    }

    // ==================== å¤–éƒ¨æ³¨å…¥ ====================

    // ç”± WeaponController æ³¨å…¥ï¼Œè®© 1P ä¿¯ä»°é©±åŠ¨èƒ½æ„ŸçŸ¥æŒæžªçŠ¶æ€
    setGunEngagedGetter(fn) {
        this._isGunEngagedFn = fn;
    }

    // ==================== ä¸»å¾ªçŽ¯ ====================

    // æ¯å¸§é©±åŠ¨åŠ¨ç”»ä¸Žç‰©ç†
    // dt é¡»ç”±ä¸»å¾ªçŽ¯ä¼ å…¥ï¼Œä¸ŠåŠèº« mixer åœ¨ä¸» mixer ä¹‹åŽæ›´æ–°æ‰èƒ½æ­£ç¡®è¦†å†™éª¨éª¼
    update(dt) {
        this._player?.update(dt);

        if (this._upperMixer && dt != null) {
            const ua = this._upperState;
            if (!ua) return;

            // Three.js PropertyMixer.apply() æœ‰å˜æ›´æ£€æµ‹ä¼˜åŒ–ï¼šä»…å½“ accu0 â‰  accu1 æ—¶
            // æ‰è°ƒç”¨ setValue() å†™å…¥éª¨éª¼ã€‚å¯¹äºŽå®Œå…¨ç›¸åŒå¸§çš„åŠ¨ç”»ï¼ˆä¸¤å¸§å€¼ä¸€è‡´ï¼‰ï¼Œ
            // ä¸¤ä¸ª accu buffer æ°¸è¿œç›¸ç­‰ï¼Œå¯¼è‡´ setValue() è¢«è·³è¿‡ï¼Œä¸» mixer çš„
            // locomotion åŠ¨ç”»é€è¿‡æ¥ã€‚ä¿®å¤ï¼šæ¯å¸§æ›´æ–°å‰æŠŠä¸¤ä¸ª accu buffer å¡«ä¸º NaNï¼Œ
            // ä½¿æ¯”è¾ƒæ°¸è¿œä¸ç›¸ç­‰ï¼Œå¼ºåˆ¶ setValue() æ¯å¸§æ‰§è¡Œï¼Œç¡®ä¿ä¸ŠåŠèº«è¦†ç›–ç”Ÿæ•ˆã€‚
            if (ua._propertyBindings) {
                for (const pm of ua._propertyBindings) {
                    if (pm?.buffer) {
                        const s = pm.valueSize;
                        pm.buffer.fill(NaN, s, s * 3); // dirty accu0 + accu1
                    }
                }
            }
            this._upperMixer.update(dt);
        }
    }

    // ==================== ä¸ŠåŠèº«åŠ¨ç”»å±‚ ====================

    // ä»ŽæŒ‡å®š clip çš„ t=0 å¸§ç›´æŽ¥è¯»å– hips å››å…ƒæ•°
    initIdleHipsQ(clipName) {
        const clip = this._player?.animation?.clips?.find(c => c.name === clipName);
        if (!clip) { console.warn(`initIdleHipsQ: æ‰¾ä¸åˆ° "${clipName}"`); return; }
        const track = clip.tracks.find(t => t.name === 'mixamorigHips.quaternion');
        if (!track || track.values.length < 4) return;
        this._idleHipsQ = new Quaternion(track.values[0], track.values[1], track.values[2], track.values[3]);
    }

    // åœ¨ä¸ŠåŠèº« mixer ä¸Šæ³¨å†Œä¸€ä¸ªåŠ¨ç”»
    registerUpperAnimation(key, clipName, opts = {}) {
        if (!this._upperMixer || !this._upperBodyBoneNames) return;
        const clips = this._player?.animation?.clips;
        if (!clips) return;
        const clip = clips.find(c => c.name === clipName);
        if (!clip) { console.warn(`registerUpperAnimation: æ‰¾ä¸åˆ° "${clipName}"`); return; }

        // åªä¿ç•™è„Šæ¤Žä»¥ä¸Šéª¨éª¼çš„ trackï¼Œå…¶ä½™ trackï¼ˆhipsã€è…¿éƒ¨ç­‰ï¼‰ä¸¢å¼ƒ
        const upperTracks = clip.tracks.filter(t => {
            const boneName = t.name.split('.')[0];
            return this._upperBodyBoneNames.has(boneName);
        });
        const partialClip = new AnimationClip(clip.name + '_upper_' + key, clip.duration, upperTracks);

        const action = this._upperMixer.clipAction(partialClip);
        action.setLoop(opts.loop === false ? LoopOnce : LoopRepeat, Infinity);
        action.clampWhenFinished = opts.clampWhenFinished ?? false;
        const ts = opts.duration ? clip.duration / opts.duration : (opts.timeScale ?? 1);
        action.setEffectiveTimeScale(ts);
        action.enabled = true;
        action.setEffectiveWeight(0);
        this._upperActions.set(key, action);

        if (opts.onFinished) {
            this._upperMixer.addEventListener("finished", (ev) => {
                if (ev.action === action) opts.onFinished();
            });
        }
    }

    // æ’­æ”¾ä¸ŠåŠèº«åŠ¨ç”»ï¼ˆä»…è¦†å†™è„Šæ¤Žä»¥ä¸Šéª¨éª¼ï¼‰
    playUpperBody(key, opts = {}) {
        if (!this._upperMixer) return;
        const next = this._upperActions.get(key);
        if (!next) { console.warn(`playUpperBody: "${key}" æœªæ³¨å†Œ`); return; }

        const fade = opts.fade ?? 0.18;
        const prev = this._upperState;

        if (!opts.force && prev === next) return;

        // ç›´æŽ¥è®¾ä¸º 1ï¼Œä»Žç¬¬ä¸€å¸§èµ·å°±ä»¥æ»¡æƒé‡è¦†ç›–ä¸» mixerã€‚
        if (prev && prev !== next) prev.fadeOut(fade);

        next.reset();
        next.setEffectiveWeight(1);
        next.play();

        this._upperState = next;
    }

    // èµ°è·¯/å¥”è·‘æ—¶ä¿®æ­£ spine[0] å››å…ƒæ•°ï¼ŒæŠµæ¶ˆ hips èµ°è·¯æ—‹è½¬åç§»
    // ä½¿ spine0 çš„ä¸–ç•Œæœå‘ç­‰æ•ˆäºŽé™æ­¢æ—¶ï¼ˆidle hips Ã— spine_localï¼‰ï¼Œ
    applyHipsCorrection() {
        if (!this._idleHipsQ || !this.spineIK?.spineBones?.length) return;
        const hipsBone = this._player?.getPlayerModel()?.getObjectByName("mixamorigHips");
        if (!hipsBone) return;

        // correction = hips_walk_localâ»Â¹ Ã— hips_idle_local
        const correction = new Quaternion().copy(hipsBone.quaternion).invert().multiply(this._idleHipsQ);
        const spine0 = this.spineIK.spineBones[0];
        spine0.quaternion.premultiply(correction);
        spine0.updateWorldMatrix(false, false);
    }

    // åœæ­¢ä¸ŠåŠèº«åŠ¨ç”»ï¼Œè®©ä¸‹åŠèº«ï¼ˆå…¨èº«ï¼‰åŠ¨ç”»å®Œå…¨æŽ¥ç®¡
    stopUpperBody(fade = 0.18) {
        if (!this._upperState) return;
        this._upperState.fadeOut(fade);
        this._upperState = null;
    }

    // ==================== å·¥å…·æ–¹æ³• ====================

    isCombatLocomotionAllowed() { return combatAllowedLocomotion.has(this._locomotionState); }

    // ==================== playerController ä»£ç† ====================

    getIsFirstPerson() { return this._player?.getIsFirstPerson() ?? false; }
    getIsFlying() { return this._player?.getIsFlying() ?? false; }
    getPosition() { return this._player?.getPosition?.() ?? null; }
    getFirstPersonPitchOffset() { return this._firstPersonPitchOffset; }
    getPlayerModel() { return this._player?.getPlayerModel(); }
    getCollider() { return this._player?.getCollider?.() ?? null; }
    getCenterScreenRaycastHit() { return this._player?.getCenterScreenRaycastHit() ?? null; }
    playAnimation(name, opts) { return this._player?.playAnimation(name, opts); }
    registerAnimation(key, clipName, opts) { return this._player?.registerAnimation(key, clipName, opts); }
    registerLocomotionSet(...a) { return this._player?.registerLocomotionSet(...a); }
    switchLocomotionSet(name) { return this._player?.switchLocomotionSet(name); }
    setMaxCamDistance(d) { return this._player?.setMaxCamDistance(d); }
    setPlayerSpeed(s) { return this._player?.setPlayerSpeed(s); }
    setEnableToward(v) { return this._player?.setEnableToward(v); }
    setThirdMouseMode(mode) { return this._player?.setThirdMouseMode(mode); }
    onAllEvent() { return this._player?.onAllEvent(); }
    offAllEvent() { return this._player?.offAllEvent(); }
    onViewChange(isFirstPerson) { return this._player?.onViewChange(isFirstPerson); }
}

