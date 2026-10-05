import { describe, expect, it } from 'vitest';
import { runBot } from '../src/game/bot';
import { derive } from '../src/game/derive';
import { newGame } from '../src/game/engine';
import { storyIndex } from '../src/game/missions';

/**
 * The balance gate. An ordinary player — four taps a second, greedy
 * spending, the best tile it can see and no cleverness — should reach the
 * Market Ward, work through the early story, keep a contented city, make
 * regalia and let the Tide in at least once, within six hours. A change that
 * makes any of that unreachable fails here.
 */
describe('a six-hour playthrough', () => {
  it('reaches the milestones', () => {
    const s = newGame(1);
    runBot(s, 6 * 3600);
    expect(s.furthestEver).toBeGreaterThanOrEqual(17);
    expect(storyIndex(s)).toBeGreaterThanOrEqual(15);
    expect(s.counters.crafted).toBeGreaterThan(0);
    expect(s.regalia.length).toBeGreaterThan(3);
    expect(s.counters.tides).toBeGreaterThanOrEqual(1);
    expect(derive(s).city.happiness).toBeGreaterThanOrEqual(1);
    expect(s.buildings.length).toBeGreaterThan(10);
  }, 240_000);
});
