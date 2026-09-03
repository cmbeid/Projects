/**
 * Where a lift car is, at a given moment.
 *
 * There is no simulation behind this: a car's position is a pure function of
 * the clock and the bank's index, a slow triangle wave up and down its span
 * with a per-bank offset so no two are ever in step. That is enough to look
 * alive and costs nothing to keep.
 *
 * It lives here, rather than inside the renderer that used to own it, because
 * two things now need the answer — the scene draws the car, and the sound wants
 * to know when it reaches a floor. Two copies of a triangle wave would agree
 * today and drift the first time one of them was tuned, and a chime that plays
 * where the car visibly is not is worse than no chime.
 */

/**
 * Cheap deterministic noise.
 *
 * Pedestrians and lift timings need to look unplanned without needing to *be*
 * simulated, and a hash keeps the scene reproducible from frame to frame and
 * screenshot to screenshot.
 */
export function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 0x1_0000_0000;
}

/** How long one round trip takes, in milliseconds, for the bank at `index`. */
export function tripPeriod(index: number): number {
  return 9_000 + hash(index) * 6_000;
}

/**
 * The car's level, fractional so it sits between floors rather than snapping.
 *
 * `level` and `span` describe the bank; `index` is its position in the tower's
 * placement list, which is what makes two banks side by side move differently.
 */
export function carLevel(
  bank: { level: number; span: number },
  index: number,
  elapsed: number,
): number {
  if (bank.span < 2) return bank.level;
  const period = tripPeriod(index);
  const phase = ((elapsed + hash(index + 7) * period) % period) / period;
  // A triangle: up for half the period, down for the other half.
  const travel = 1 - Math.abs(1 - phase * 2);
  return bank.level + travel * (bank.span - 1);
}

/**
 * The floor a car is currently at, or `undefined` while it is between floors.
 *
 * This is the arrival detector. Rounding the fractional level would report a
 * floor for the whole time the car is nearer to it than to its neighbours,
 * which at these speeds is most of the trip — so "at a floor" has to mean
 * *close* to one, and `TOLERANCE` is what close means. Caller compares against
 * the previous frame's answer to turn that into an event.
 */
export const TOLERANCE = 0.12;

export function carAtFloor(
  bank: { level: number; span: number },
  index: number,
  elapsed: number,
): number | undefined {
  if (bank.span < 2) return undefined;
  const level = carLevel(bank, index, elapsed);
  const nearest = Math.round(level);
  return Math.abs(level - nearest) <= TOLERANCE ? nearest : undefined;
}
