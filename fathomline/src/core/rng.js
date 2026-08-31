// Seeded PRNG (mulberry32) so anything that must be reproducible (offline
// resolution, endless-depth layouts, weather cycles) can be replayed deterministically.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed() {
  return (Math.random() * 0xffffffff) >>> 0;
}

// Weighted pick from { id: weight } (or [{id, weight}]) using a supplied rng().
export function weightedPick(weights, rng) {
  const entries = Array.isArray(weights)
    ? weights.map((w) => [w.id, w.weight])
    : Object.entries(weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  for (const [id, w] of entries) {
    roll -= w;
    if (roll <= 0) return id;
  }
  return entries[entries.length - 1][0];
}

// Skewed [0,1) percentile roll: bias > 1 skews toward 0 (more small values),
// bias < 1 skews toward 1 (more large values). bias = 1 is uniform.
export function biasedPercentile(rng, bias = 1) {
  return Math.pow(rng(), bias);
}
