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
  version: "2026-08-02",
  openDanger: "https://open.grudge-studio.com/danger",
  animsBaked: "https://open.grudge-studio.com/anims/baked",
  kits: "https://assets.grudge-studio.com/models/grudge6/races",
  humanHeightM: 1.8,
  freeMouse: true,
  alwaysCrosshair: true,
};

export function logDrcContract() {
  console.info(
    `[DRC] Multiverse uses Danger Room character/anim SSOT · packs=${DRC_MULTIVERSE.animsBaked} · kits=${DRC_MULTIVERSE.kits}`,
  );
}
