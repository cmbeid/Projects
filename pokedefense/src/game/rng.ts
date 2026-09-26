/** A small seeded PRNG (mulberry32), so a battle replays the same from the same seed. */
export type Rng = () => number;

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickWeighted<T>(rng: Rng, items: readonly T[], weight: (item: T) => number): T {
  const total = items.reduce((sum, it) => sum + weight(it), 0);
  let r = rng() * total;
  for (const it of items) {
    r -= weight(it);
    if (r < 0) return it;
  }
  return items[items.length - 1]!;
}

/** A stable number from a string, for seeding per map and wave. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
