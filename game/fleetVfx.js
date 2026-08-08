/**
 * Fleet weapon skill VFX — slash / bolt / nova / fire (SI metres).
 * Fire attack: compact stream + core + impact from CastingAbilities fire pattern
 * (path travel + detonation) scaled for ~1.8 m heroes — NOT 100× giants.
 */
import * as THREE from "three";

/** Human yardstick — all VFX sizes relative to this. */
export const VFX_SI_HUMAN_M = 1.8;

export class FleetSkillVfx {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
  }

  /**
   * @param {'slash'|'bolt'|'nova'|'fire'} kind
   * @param {THREE.Vector3} origin feet / cast point
   * @param {THREE.Vector3} [dir] ground-plane aim
   * @param {number} [color]
   */
  play(kind, origin, dir = new THREE.Vector3(0, 0, 1), color, opts = {}) {
    if (kind === "slash") this.slash(origin, dir, color ?? 0x9fe8ff);
    else if (kind === "bolt") this.bolt(origin, dir, color ?? 0x7ec8ff);
    else if (kind === "nova") this.nova(origin, color ?? 0xc478ff, opts.radius);
    else if (kind === "blast") this.blast(origin, color ?? 0xff8844, opts.radius ?? 4.5);
    else if (kind === "gap") this.gapTrail(origin, dir, color ?? 0xaaccff, opts.dist ?? 5);
    else if (kind === "fire") this.fire(origin, dir, color ?? 0xff6622);
    else this.slash(origin, dir, color ?? 0xffe08a);
  }

  /** Melee arc — radius ~ arm reach (1.1 m), not building-sized. */
  slash(origin, dir, color) {
    const geo = new THREE.TorusGeometry(1.1, 0.06, 6, 24, Math.PI * 1.2);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(origin).add(new THREE.Vector3(0, 1.1, 0));
    const yaw = Math.atan2(dir.x, dir.z);
    mesh.rotation.set(0.4, yaw, 0.2);
    this.scene.add(mesh);
    this.active.push({ mesh, t: 0, life: 0.35, kind: "slash" });
  }

  /** Magic bolt — 0.12 m core, ~28 m/s travel. */
  bolt(origin, dir, color) {
    const geo = new THREE.SphereGeometry(0.12, 10, 10);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(origin).add(new THREE.Vector3(0, 1.2, 0));
    const d = dir.clone().normalize();
    this.scene.add(mesh);
    this.active.push({ mesh, t: 0, life: 0.55, kind: "bolt", vel: d.multiplyScalar(28) });
  }

  nova(origin, color, radius = 3.5) {
    const geo = new THREE.RingGeometry(0.2, 0.35, 32);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(origin).add(new THREE.Vector3(0, 0.15, 0));
    this.scene.add(mesh);
    this.active.push({ mesh, t: 0, life: 0.55, kind: "nova", scale: 1, targetScale: Math.max(2, radius) });
  }

  /**
   * AoE blast — expanding sphere + ground ring (SI metres, human-scale).
   * Used for cleave / meteor / rampage / frost nova impacts.
   */
  blast(origin, color, radius = 4.5) {
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 14, 14),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    core.position.copy(origin).add(new THREE.Vector3(0, 0.9, 0));
    this.scene.add(core);
    this.active.push({
      mesh: core,
      t: 0,
      life: 0.42,
      kind: "blast_core",
      targetScale: Math.max(2.5, radius * 0.85),
    });

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.25, 0.55, 36),
      new THREE.MeshBasicMaterial({
        color: 0xffeeaa,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(origin).add(new THREE.Vector3(0, 0.08, 0));
    this.scene.add(ring);
    this.active.push({ mesh: ring, t: 0, life: 0.55, kind: "blast_ring", targetScale: radius });

    const light = new THREE.PointLight(color, 2.2, radius * 2.5, 2);
    light.position.copy(core.position);
    this.scene.add(light);
    this.active.push({ mesh: light, t: 0, life: 0.4, kind: "blast_light", isLight: true });
  }

  /** MM gap-close trail — elongated dash ribbon along travel dir. */
  gapTrail(origin, dir, color, dist = 5) {
    const d = dir.clone().normalize();
    if (d.lengthSq() < 1e-6) d.set(0, 0, 1);
    const len = Math.max(1.5, Math.min(12, dist));
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.18, len, 8, 1, true),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    const hand = origin.clone().add(new THREE.Vector3(0, 1.0, 0)).add(d.clone().multiplyScalar(len * 0.4));
    mesh.position.copy(hand);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    this.scene.add(mesh);
    this.active.push({ mesh, t: 0, life: 0.32, kind: "gap" });
  }

  /**
   * Fire bending-style attack (CastingAbilities FireAbility reduced):
   * hand-height stream core + outer glow + SI impact scorch.
   * Stream length ~3.5 m, core radius ~0.18 m (human scale).
   */
  fire(origin, dir, color) {
    const d = dir.clone().normalize();
    if (d.lengthSq() < 1e-6) d.set(0, 0, 1);

    const hand = origin.clone().add(new THREE.Vector3(0, 1.15, 0)).add(d.clone().multiplyScalar(0.45));
    const streamLen = 3.5;
    const coreR = 0.18;
    const glowR = 0.32;

    // Core fireball
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(coreR, 12, 12),
      new THREE.MeshBasicMaterial({
        color: color ?? 0xff6622,
        transparent: true,
        opacity: 0.95,
      }),
    );
    core.position.copy(hand);
    this.scene.add(core);

    // Outer heat glow
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(glowR, 10, 10),
      new THREE.MeshBasicMaterial({
        color: 0xffaa44,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
    glow.position.copy(hand);
    this.scene.add(glow);

    // Stream hull (elongated toward aim — ribbon stand-in)
    const stream = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.22, streamLen, 8, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xff4400,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    stream.position.copy(hand).add(d.clone().multiplyScalar(streamLen * 0.45));
    // Align cylinder +Y to direction
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    stream.quaternion.copy(q);
    this.scene.add(stream);

    const light = new THREE.PointLight(color ?? 0xff6622, 1.6, 10, 2);
    light.position.copy(hand);
    this.scene.add(light);

    const speed = 22; // m/s — SI, not FPS-cm
    this.active.push({
      mesh: core,
      glow,
      stream,
      light,
      t: 0,
      life: 0.65,
      kind: "fire",
      vel: d.multiplyScalar(speed),
      impactAt: hand.clone().add(d.clone().normalize().multiplyScalar(streamLen + 1.2)),
      hit: false,
    });
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i];
      a.t += dt;
      const u = a.t / a.life;
      if (a.kind === "slash") {
        a.mesh.scale.setScalar(1 + u * 1.8);
        a.mesh.material.opacity = 0.9 * (1 - u);
      } else if (a.kind === "bolt") {
        a.mesh.position.addScaledVector(a.vel, dt);
        a.mesh.material.opacity = 1 - u;
      } else if (a.kind === "nova") {
        const ts = a.targetScale || 6;
        a.scale = 1 + u * ts;
        a.mesh.scale.setScalar(a.scale);
        a.mesh.material.opacity = 0.85 * (1 - u);
      } else if (a.kind === "blast_core") {
        const ts = a.targetScale || 4;
        a.mesh.scale.setScalar(1 + u * ts);
        if (a.mesh.material) a.mesh.material.opacity = 0.9 * (1 - u);
      } else if (a.kind === "blast_ring") {
        const ts = a.targetScale || 4;
        a.mesh.scale.setScalar(1 + u * ts);
        if (a.mesh.material) a.mesh.material.opacity = 0.8 * (1 - u);
      } else if (a.kind === "blast_light") {
        if (a.mesh.intensity != null) a.mesh.intensity = 2.2 * (1 - u);
      } else if (a.kind === "gap") {
        if (a.mesh.material) a.mesh.material.opacity = 0.65 * (1 - u);
        a.mesh.scale.set(1 - u * 0.4, 1, 1 - u * 0.4);
      } else if (a.kind === "fire") {
        a.mesh.position.addScaledVector(a.vel, dt);
        a.glow?.position.copy(a.mesh.position);
        a.light?.position.copy(a.mesh.position);
        // shrink stream opacity; core flies
        if (a.stream) {
          a.stream.material.opacity = 0.55 * (1 - u);
          a.stream.scale.set(1 - u * 0.3, 1 - u * 0.15, 1 - u * 0.3);
        }
        a.mesh.material.opacity = 0.95 * (1 - u * 0.4);
        if (a.glow) a.glow.material.opacity = 0.35 * (1 - u);
        if (a.light) a.light.intensity = 1.6 * (1 - u);

        // SI impact burst ~1.2 m radius (not 12 m)
        if (!a.hit && (a.t > a.life * 0.85 || a.mesh.position.distanceTo(a.impactAt) < 0.6)) {
          a.hit = true;
          const burst = new THREE.Mesh(
            new THREE.SphereGeometry(0.55, 12, 12),
            new THREE.MeshBasicMaterial({
              color: 0xffaa66,
              transparent: true,
              opacity: 0.75,
              depthWrite: false,
            }),
          );
          burst.position.copy(a.mesh.position);
          this.scene.add(burst);
          this.active.push({
            mesh: burst,
            t: 0,
            life: 0.28,
            kind: "fire_burst",
            scale: 1,
          });
          // ground scorch ring (SI)
          const scorch = new THREE.Mesh(
            new THREE.RingGeometry(0.25, 0.85, 24),
            new THREE.MeshBasicMaterial({
              color: 0x331100,
              transparent: true,
              opacity: 0.55,
              side: THREE.DoubleSide,
              depthWrite: false,
            }),
          );
          scorch.rotation.x = -Math.PI / 2;
          scorch.position.set(a.mesh.position.x, a.mesh.position.y - 1.0, a.mesh.position.z);
          this.scene.add(scorch);
          this.active.push({ mesh: scorch, t: 0, life: 0.9, kind: "scorch" });
        }
      } else if (a.kind === "fire_burst") {
        a.scale = 1 + u * 2.2;
        a.mesh.scale.setScalar(a.scale);
        a.mesh.material.opacity = 0.75 * (1 - u);
      } else if (a.kind === "scorch") {
        a.mesh.material.opacity = 0.55 * (1 - u);
      }

      if (a.t >= a.life) {
        this.scene.remove(a.mesh);
        if (!a.isLight) {
          a.mesh.geometry?.dispose?.();
          a.mesh.material?.dispose?.();
        }
        if (a.glow) {
          this.scene.remove(a.glow);
          a.glow.geometry?.dispose?.();
          a.glow.material?.dispose?.();
        }
        if (a.stream) {
          this.scene.remove(a.stream);
          a.stream.geometry?.dispose?.();
          a.stream.material?.dispose?.();
        }
        if (a.light) this.scene.remove(a.light);
        this.active.splice(i, 1);
      }
    }
  }
}

/** Map skill kind → VFX kind (fleet skill kinds). */
export function vfxKindForSkill(skill) {
  const k = skill?.kind || "";
  const id = skill?.id || "";
  const name = skill?.name || "";
  const blob = `${k} ${id} ${name} ${skill?.school || ""} ${skill?.projectile || ""}`.toLowerCase();
  // Nature thorns use dedicated mesh projectile — skip generic bolt flash
  if (/thorn|vine|bramble|nature/.test(blob) && skill?.projectile === "thorn") return "thorn";
  // Fire / flame first (CastingAbilities fire + mage fire)
  if (/fire|flame|burn|meteor|inferno|pyro|ember/.test(blob)) return "fire";
  // AoE blast (full shell) vs soft nova ring
  if (/meteor|storm|rain|rampage|explode|blast|nuke|tempest/.test(blob)) return "blast";
  if (k.includes("aoe") || k.includes("nova") || /nova|cleave|volley|bramble/.test(blob)) {
    return "nova";
  }
  // Ranged / magic bolt
  if (k.includes("ranged") || k.includes("magic") || /bolt|arrow|shot|cast|missile/.test(blob)) {
    return "bolt";
  }
  return "slash";
}
