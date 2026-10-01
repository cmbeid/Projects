/**
 * The bot farmer (src/game/bot.ts) plays through the same commands the UI
 * uses. A week must come out ahead with each starter, and a whole year,
 * through every season, must keep growing.
 */
import { describe, expect, it } from 'vitest';
import { botDay } from '../src/game/bot';
import { DAYS_PER_SEASON, seasonOf } from '../src/game/time';
import { createWorld } from '../src/game/world';

describe('the bot farmer', () => {
  for (const starter of [1, 4, 7]) {
    it(`makes money in a week with starter #${starter}`, () => {
      const w = createWorld(42, starter);
      const start = w.player.gold;
      for (let day = 0; day < 7; day += 1) botDay(w);
      expect(w.stats.harvested).toBeGreaterThan(15);
      expect(w.player.gold).toBeGreaterThan(start);
    });
  }

  it('farms through a whole year', () => {
    const w = createWorld(7, 7);
    const goldAt: number[] = [];
    for (let day = 0; day < DAYS_PER_SEASON * 4; day += 1) {
      if (day % DAYS_PER_SEASON === 0) goldAt.push(w.player.gold);
      botDay(w);
    }
    expect(seasonOf(w.day)).toBe('Spring');
    expect(w.day).toBe(DAYS_PER_SEASON * 4 + 1);
    // Every season ends richer than it began.
    goldAt.push(w.player.gold);
    for (let i = 1; i < goldAt.length; i += 1) expect(goldAt[i], `season ${i}`).toBeGreaterThan(goldAt[i - 1]!);
  });
});
