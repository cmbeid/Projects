/**
 * mulberry32 — small, fast, and seeded from state rather than the clock, so a
 * test can replay an exact sequence.
 *
 * Nothing in eras 1-3 uses randomness. It exists now so the engine's
 * determinism contract is true from the beginning instead of being bolted on
 * once something needs a dice roll.
 */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
