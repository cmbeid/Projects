import { describe, expect, it } from 'vitest';
import { runBot } from '../src/game/bot';
import { derive } from '../src/game/derive';
import { newGame } from '../src/game/engine';

/**
 * The balance gate. A bot that never plans ahead plays for eight simulated
 * hours; if a change to the numbers stops it reaching these milestones, the
 * curve is broken for people too.
 */
describe('a simple player', () => {
  it('reaches the Industrial Age in six hours and launches a colony ship within eight', () => {
    const s = newGame(7);
    const report = runBot(s, 8 * 3600);
    const at = (era: number): number => report.eraAt[era] ?? Infinity;
    expect(at(1)).toBeLessThan(45 * 60);
    expect(at(3)).toBeLessThan(2.5 * 3600);
    expect(at(5)).toBeLessThan(6 * 3600);
    expect(s.stats.launches).toBeGreaterThanOrEqual(1);
    expect(s.heritage.earned).toBeGreaterThan(100);
    expect(s.stats.events).toBeGreaterThan(20);
    expect(derive(s).stability).toBeGreaterThan(50);
  });
});
