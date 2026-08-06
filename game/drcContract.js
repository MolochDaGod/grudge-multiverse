/**
 * DRC (Danger Room Combat) contract for Multiverse — import existing fleet SSOT.
 * Do not invent a second combat/character stack.
 *
 * Characters: grudge6SSOT + characterDeploy + grudge6Loader
 * Anims:      drcAnimSsot + animPackLoader (open.grudge-studio.com/anims/baked)
 * Director:   bip001Director (gameopen AnimationDirector pattern)
 * Aim:        combatAim free-mouse (no pointer-lock)
 * VFX:        fleetVfx
 * Map:        island + mapLiteracy
 *
 * Live Open reference: https://open.grudge-studio.com/danger
 */
export const DRC_MULTIVERSE = {
  version: "2026-08-06-combat",
  openDanger: "https://open.grudge-studio.com/danger",
  animsBaked: "https://open.grudge-studio.com/anims/baked",
  kits: "https://assets.grudge-studio.com/asset-packs/toon-rts-characters/glb/characters",
  atlases: "https://assets.grudge-studio.com/textures/grudge6",
  map: "https://assets.grudge-studio.com/models/maps/bermuda.glb",
  humanHeightM: 1.8,
  units: "si_metres",
  freeMouse: true,
  alwaysCrosshair: true,
  /** Toon RTS GLB play mesh — never Mixamo person*.glb as visual */
  visual: "toon_rts_glb",
  controllerCapsule: "proxy_si_only",
  /** Fleet combat keys (epicfight CANONICAL_COMBAT) */
  combat: {
    parry: "KeyC",
    dodge: "KeyX",
    block: "KeyE",
    slide: "AltLeft",
    jump: "Space",
    skills: "KeyF Digit1-5",
  },
};

export function logDrcContract() {
  console.info(
    `[DRC] Multiverse character SSOT · kits=${DRC_MULTIVERSE.kits} · anims=${DRC_MULTIVERSE.animsBaked} · SI=${DRC_MULTIVERSE.humanHeightM}m`,
  );
}
