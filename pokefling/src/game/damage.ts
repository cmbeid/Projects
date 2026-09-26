/** Closing speeds below this, in pixels per 1/60 s, do no harm at all. */
export const DAMAGE_THRESHOLD = 2;
/** Scales velocity change into hit points. */
export const DAMAGE_SCALE = 10;

/**
 * Damage dealt to body A when it hits body B at `closingSpeed`.
 *
 * Proportional to how sharply A's own velocity changes, which is the share of
 * the closing speed that B's mass takes: a heavy block barely notices a light
 * Pokémon, a light Meowth crushed by stone takes all of it, and hitting the
 * ground (infinite mass) counts in full.
 */
export function impactDamage(closingSpeed: number, massA: number, massB: number): number {
  const excess = closingSpeed - DAMAGE_THRESHOLD;
  if (excess <= 0) return 0;
  const share = Number.isFinite(massB) ? massB / (massA + massB) : 1;
  return excess * share * DAMAGE_SCALE;
}

/** Blast falloff: full damage at the centre, none at `radius`. */
export function blastFalloff(distance: number, radius: number): number {
  return Math.max(0, 1 - distance / radius);
}
