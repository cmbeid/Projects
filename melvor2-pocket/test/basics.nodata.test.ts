// Checks that need no game data, so they also run in CI where content.json doesn't exist.
import { describe, expect, it } from 'vitest';
import { Rng } from '../src/engine/rng';
import { LEVEL_CAP, levelForXp, xpForLevel } from '../src/engine/xp';
import { hitChance } from '../src/engine/combat/stats';
import { contentLoaded, validateContent } from '../src/engine/content';

describe('engine basics', () => {
  it('uses the game XP curve with the demo level cap', () => {
    expect(xpForLevel(2)).toBe(83);
    expect(xpForLevel(60)).toBe(273740);
    expect(levelForXp(1e12)).toBe(LEVEL_CAP);
  });

  it('seeded RNG is reproducible', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(Array.from({ length: 5 }, () => b.next()));
  });

  it('hit chance formula', () => {
    expect(hitChance(1000, 500)).toBeCloseTo(0.75);
    expect(hitChance(500, 1000)).toBeCloseTo(0.25);
  });

  it('rejects files that are not a content package', () => {
    expect(() => validateContent({ hello: 1 })).toThrow(/content\.json/);
    expect(typeof contentLoaded()).toBe('boolean');
  });
});
