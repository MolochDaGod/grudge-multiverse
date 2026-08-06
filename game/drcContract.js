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
  version: "2026-08-06",
  openDanger: "https://open.grudge-studio.com/danger",
  animsBaked: "https://open.grudge-studio.com/anims/baked",
  kits: "https://assets.grudge-studio.com/models/grudge6/races",
  atlases: "https://assets.grudge-studio.com/textures/grudge6",
  map: "https://assets.grudge-studio.com/models/maps/bermuda.glb",
  humanHeightM: 1.8,
  units: "si_metres",
  freeMouse: true,
  alwaysCrosshair: true,
  /** Production hero is grudge6 CDN kit — never Mixamo person*.glb as visual */
  visual: "grudge6_cdn_kit",
  controllerCapsule: "mixamo_scale_only",
};

export function logDrcContract() {
  console.info(
    `[DRC] Multiverse character SSOT · kits=${DRC_MULTIVERSE.kits} · anims=${DRC_MULTIVERSE.animsBaked} · SI=${DRC_MULTIVERSE.humanHeightM}m`,
  );
}
