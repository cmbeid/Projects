import { describe, expect, it } from 'vitest';
import { runBot } from '../src/game/bot';
import { newGame } from '../src/game/engine';

/**
 * The balance gate. An ordinary player — four taps a second, greedy
 * spending, no cleverness — should reach the Crystal Hollows, work through
 * the early story, craft gear and make a first Descent within six hours.
 * A change that makes any of that unreachable fails here.
 */
describe('a six-hour playthrough', () => {
  it('reaches the milestones', () => {
    const s = newGame(1);
    runBot(s, 6 * 3600);
    expect(s.deepestEver).toBeGreaterThanOrEqual(51);
    expect(s.story.index).toBeGreaterThanOrEqual(15);
    expect(s.counters.crafted).toBeGreaterThan(0);
    expect(s.gear.length).toBeGreaterThan(3);
    expect(s.counters.descents).toBeGreaterThanOrEqual(1);
  });
});
