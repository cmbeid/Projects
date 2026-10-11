import { describe, expect, it } from 'vitest';
import { runBot } from '../src/game/bot';
import { newGame } from '../src/game/engine';
import { arkSections } from '../src/game/story';

/**
 * The balance gate. A bot that never plans more than one jump ahead plays
 * the campaign; if a change to the numbers stops it reaching these
 * milestones, the curve is broken for people too.
 */
describe('a simple player', () => {
  for (const seed of [7, 11, 23]) {
    it(`reaches the Ashen Expanse early and brings the Wake home (seed ${seed})`, () => {
      const s = newGame(seed);
      const report = runBot(s, 260);
      expect(report.sectorAt[2] ?? Infinity).toBeLessThan(80);
      expect(report.stuck).toBe(0);
      expect(arkSections(s)).toBe(6);
      expect(s.screen).toBe('ending');
      expect(s.colonists).toBeGreaterThanOrEqual(70);
      expect(s.stats.landings).toBeGreaterThan(20);
    });
  }
});
