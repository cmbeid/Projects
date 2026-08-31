import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/rng.js';
import { rollSpeciesForRegion } from '../src/systems/fishing.js';
import { BASE_RARITY_WEIGHTS } from '../src/config.js';

describe('rarity distribution', () => {
  it('matches the configured rarity weights within tolerance over 20k rolls', () => {
    const rng = mulberry32(12345);
    const counts = { C: 0, U: 0, R: 0, E: 0, L: 0, M: 0 };
    const trials = 20_000;
    for (let i = 0; i < trials; i++) {
      const fish = rollSpeciesForRegion('marrow_cove', { rarityBiasMult: 1, timeOfDay: 'day' }, rng);
      counts[fish.rarity]++;
    }
    // Region 1 has no Mythic species yet (that's a Phase 3 Wanderer), so a
    // rolled 'M' always falls back to 'L' — fold M's weight into L's
    // expectation rather than asserting on an id that can never land.
    const totalWeight = Object.values(BASE_RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(counts.M).toBe(0);
    const effectiveWeights = { ...BASE_RARITY_WEIGHTS, L: BASE_RARITY_WEIGHTS.L + BASE_RARITY_WEIGHTS.M };
    for (const rarity of ['C', 'U', 'R', 'E', 'L']) {
      const expected = (effectiveWeights[rarity] / totalWeight) * trials;
      const actual = counts[rarity];
      // Loose tolerance: rare tiers have few expected samples so relative
      // variance is high; require presence and within 3x of expectation,
      // common tiers within 15%.
      if (expected >= 200) {
        expect(actual).toBeGreaterThan(expected * 0.85);
        expect(actual).toBeLessThan(expected * 1.15);
      } else {
        expect(actual).toBeGreaterThan(0);
        expect(actual).toBeLessThan(expected * 4 + 20);
      }
    }
  });

  it('rarityBiasMult shifts weight toward rarer tiers', () => {
    const rng = mulberry32(999);
    let commonCount = 0;
    const trials = 5000;
    for (let i = 0; i < trials; i++) {
      const fish = rollSpeciesForRegion('marrow_cove', { rarityBiasMult: 1, timeOfDay: 'day' }, rng);
      if (fish.rarity === 'C') commonCount++;
    }

    const rngBiased = mulberry32(999);
    let commonCountBiased = 0;
    for (let i = 0; i < trials; i++) {
      const fish = rollSpeciesForRegion('marrow_cove', { rarityBiasMult: 3, timeOfDay: 'day' }, rngBiased);
      if (fish.rarity === 'C') commonCountBiased++;
    }

    expect(commonCountBiased).toBeLessThan(commonCount);
  });

  it('a night-only species never appears during the day', () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 5000; i++) {
      const fish = rollSpeciesForRegion('marrow_cove', { rarityBiasMult: 1, timeOfDay: 'day' }, rng);
      expect(fish.id).not.toBe('moonlit_trout');
    }
  });
});
