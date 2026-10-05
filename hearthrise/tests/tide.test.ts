import { describe, expect, it } from 'vitest';
import { TIDE_FLOOR } from '../src/data/progression';
import { place, rebuildFromPlan } from '../src/game/economy';
import { newGame } from '../src/game/engine';
import { buyCharter, letTideIn, memoryGain, startingWard } from '../src/game/tide';

describe('the Tide', () => {
  it('pays nothing until enough wards are open', () => {
    const s = newGame(1);
    s.features.push('tide');
    s.maxWard = TIDE_FLOOR;
    expect(memoryGain(s)).toBe(0);
    expect(letTideIn(s)).toBe(false);
    s.maxWard = 17;
    expect(memoryGain(s)).toBeGreaterThan(0);
  });

  it('takes the city and keeps the Founder, the Memories and the plan', () => {
    const s = newGame(1);
    s.features.push('tide', 'build', 'crews');
    s.story.id = null;
    s.coins = 1e9;
    s.maxWard = s.furthestEver = 17;
    s.level = 30;
    place(s, 'tent', 0, 0, 0);
    place(s, 'gang', 0, 1, 0);
    expect(letTideIn(s)).toBe(true);
    expect(s.buildings).toEqual([]);
    expect(s.plan.length).toBe(2);
    expect(s.level).toBe(30);
    expect(s.memories).toBeGreaterThan(0);
    expect(s.maxWard).toBe(startingWard(s));
    s.coins = 1e6;
    expect(rebuildFromPlan(s)).toBe(2);
    expect(s.buildings.map((b) => b.type).sort()).toEqual(['gang', 'tent']);
  });

  it('spends Memories on the Charter', () => {
    const s = newGame(1);
    s.memories = 100;
    expect(buyCharter(s, 'maps')).toBe(true);
    s.furthestEver = 20;
    expect(startingWard(s)).toBe(3);
  });
});
