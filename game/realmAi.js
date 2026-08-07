/**
 * Lightweight enemy AI — port of Island-Crusade combat-sandbox enemyAI.ts.
 * Produces planar velocity + facing; Multiverse applies via root.position.
 */

/** @typedef {'idle'|'patrol'|'chase'|'attack'|'return'} AiState */

export function createBrain(homeX, homeZ) {
  return {
    state: /** @type {AiState} */ ("idle"),
    wanderX: homeX,
    wanderZ: homeZ,
    nextWanderAt: 0,
  };
}

function pickWander(brain, homeX, homeZ, radius, now) {
  const a = Math.random() * Math.PI * 2;
  const r = Math.random() * radius;
  brain.wanderX = homeX + Math.cos(a) * r;
  brain.wanderZ = homeZ + Math.sin(a) * r;
  brain.nextWanderAt = now + 2500 + Math.random() * 3500;
}

/**
 * @param {ReturnType<typeof createBrain>} brain
 * @param {{ aggroRange: number, attackRange: number, leash: number, speed: number, wanderRadius: number }} params
 */
export function stepBrain(
  brain,
  params,
  selfX,
  selfZ,
  homeX,
  homeZ,
  playerX,
  playerZ,
  now,
  alive,
) {
  if (!alive) {
    brain.state = "idle";
    return { vx: 0, vz: 0, moving: false, faceAngle: null, state: "idle" };
  }

  const dpx = playerX - selfX;
  const dpz = playerZ - selfZ;
  const distPlayer = Math.hypot(dpx, dpz);
  const distHome = Math.hypot(selfX - homeX, selfZ - homeZ);

  if (brain.state === "chase" || brain.state === "attack") {
    if (distHome > params.leash) brain.state = "return";
    else if (distPlayer <= params.attackRange) brain.state = "attack";
    else if (distPlayer <= params.aggroRange) brain.state = "chase";
    else brain.state = "return";
  } else if (brain.state === "return") {
    if (distHome < 1.5) brain.state = "idle";
    else if (distPlayer <= params.aggroRange * 0.8 && distHome <= params.leash) {
      brain.state = "chase";
    }
  } else if (distPlayer <= params.aggroRange && distHome <= params.leash) {
    brain.state = "chase";
  }

  switch (brain.state) {
    case "attack": {
      const faceAngle = distPlayer > 1e-3 ? Math.atan2(dpx, dpz) : null;
      return { vx: 0, vz: 0, moving: false, faceAngle, state: "attack" };
    }
    case "chase": {
      const stopAt = params.attackRange * 0.85;
      if (distPlayer <= stopAt || distPlayer < 1e-3) {
        return {
          vx: 0,
          vz: 0,
          moving: false,
          faceAngle: Math.atan2(dpx, dpz),
          state: "chase",
        };
      }
      const nx = dpx / distPlayer;
      const nz = dpz / distPlayer;
      return {
        vx: nx * params.speed,
        vz: nz * params.speed,
        moving: true,
        faceAngle: Math.atan2(dpx, dpz),
        state: "chase",
      };
    }
    case "return": {
      const dhx = homeX - selfX;
      const dhz = homeZ - selfZ;
      const d = Math.hypot(dhx, dhz) || 1;
      return {
        vx: (dhx / d) * params.speed,
        vz: (dhz / d) * params.speed,
        moving: true,
        faceAngle: Math.atan2(dhx, dhz),
        state: "return",
      };
    }
    default: {
      if (now >= brain.nextWanderAt) {
        pickWander(brain, homeX, homeZ, params.wanderRadius, now);
      }
      const dwx = brain.wanderX - selfX;
      const dwz = brain.wanderZ - selfZ;
      const d = Math.hypot(dwx, dwz);
      if (d < 0.6) return { vx: 0, vz: 0, moving: false, faceAngle: null, state: "idle" };
      const slow = params.speed * 0.4;
      return {
        vx: (dwx / d) * slow,
        vz: (dwz / d) * slow,
        moving: true,
        faceAngle: Math.atan2(dwx, dwz),
        state: "patrol",
      };
    }
  }
}

export const CAMP_AI = {
  aggroRange: 18,
  attackRange: 2.4,
  leash: 36,
  speed: 3.4,
  wanderRadius: 8,
};

export const GUARD_AI = {
  aggroRange: 12,
  attackRange: 2.2,
  leash: 22,
  speed: 2.8,
  wanderRadius: 4,
};

export const ANIMAL_AI = {
  aggroRange: 0, // passive unless wolf
  attackRange: 1.5,
  leash: 40,
  speed: 2.2,
  wanderRadius: 14,
};

export const WOLF_AI = {
  aggroRange: 14,
  attackRange: 1.6,
  leash: 30,
  speed: 4.0,
  wanderRadius: 12,
};
