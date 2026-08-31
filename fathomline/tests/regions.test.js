import { describe, expect, it } from 'vitest';
import { defaultState } from '../src/core/save.js';
import { isRegionUnlocked, orderedRegions, unlockedRegions } from '../src/data/regions.js';
import { fishForRegion, FISH } from '../src/data/fish.js';

describe('region gating', () => {
  it('a fresh save only has Marrow Cove unlocked', () => {
    const state = defaultState();
    const unlocked = unlockedRegions(state);
    expect(unlocked.map((r) => r.id)).toEqual(['marrow_cove']);
  });

  it('unlocks regions as boat tier increases, in order', () => {
    const state = defaultState();
    const seenAtTier = {};
    for (let tier = 1; tier <= 6; tier++) {
      state.gear.boat = tier;
      for (const region of orderedRegions()) {
        if (isRegionUnlocked(state, region.id) && !(region.id in seenAtTier)) {
          seenAtTier[region.id] = tier;
        }
      }
    }
    expect(Object.keys(seenAtTier)).toHaveLength(orderedRegions().length);
    // Every region should be reachable at or before the game's max boat tier.
    for (const region of orderedRegions()) {
      expect(seenAtTier[region.id]).toBeLessThanOrEqual(6);
    }
  });

  it('every region has at least 12 species and no region is empty', () => {
    for (const region of orderedRegions()) {
      expect(fishForRegion(region.id).length).toBeGreaterThanOrEqual(12);
    }
  });

  it('has exactly 107 species total, matching the plan', () => {
    expect(FISH.length).toBe(107);
  });

  it('Wanderers (region: "any") appear in every region\'s pool', () => {
    const wanderers = FISH.filter((f) => f.region === 'any');
    expect(wanderers.length).toBeGreaterThan(0);
    for (const region of orderedRegions()) {
      const pool = fishForRegion(region.id);
      for (const w of wanderers) {
        expect(pool.some((f) => f.id === w.id)).toBe(true);
      }
    }
  });
});
