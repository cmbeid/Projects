/** mulberry32: a tiny seeded PRNG. The state lives in the save, so a day plays out the same after a reload. */
export interface Rng {
  seed: number;
}

export function nextRandom(rng: Rng): number {
  rng.seed = (rng.seed + 0x6d2b79f5) | 0;
  let t = rng.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
