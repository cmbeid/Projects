import { GRAVITY_PER_STEP, MAX_PULL, MAX_SPEED, SLING } from './world';

export interface Vec {
  x: number;
  y: number;
}

/**
 * Where the pouch sits for a drag to `pointer`: on the line from the sling to
 * the pointer, no further than `MAX_PULL` away.
 */
export function clampPull(pointer: Vec): Vec {
  const dx = pointer.x - SLING.x;
  const dy = pointer.y - SLING.y;
  const length = Math.hypot(dx, dy);
  if (length <= MAX_PULL) return { x: dx, y: dy };
  const k = MAX_PULL / length;
  return { x: dx * k, y: dy * k };
}

/** Launch velocity, in pixels per 1/60 s, for a pull offset from the sling. */
export function launchVelocity(pull: Vec): Vec {
  const k = MAX_SPEED / MAX_PULL;
  return { x: -pull.x * k, y: -pull.y * k };
}

/**
 * Points along the flight path, one every `every` 1/60 s steps, ignoring drag
 * and collisions. Matches the simulation exactly until the first hit: Matter
 * integrates with Verlet, whose only error under constant gravity is the extra
 * half-substep of fall accounted for by the `n / 2` term (two substeps per
 * 1/60 s — see STEP_MS).
 */
export function trajectory(start: Vec, velocity: Vec, steps: number, every = 3): Vec[] {
  const points: Vec[] = [];
  for (let n = every; n <= steps; n += every) {
    points.push({
      x: start.x + velocity.x * n,
      y: start.y + velocity.y * n + 0.5 * GRAVITY_PER_STEP * (n * n + n / 2),
    });
  }
  return points;
}
