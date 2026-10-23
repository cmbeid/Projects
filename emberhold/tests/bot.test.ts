import { describe, expect, it } from 'vitest';
import { SKILL_LIST } from '../src/data/skills';
import { runBot } from '../src/game/bot';
import { combatLevel, level, newGame } from '../src/game/core';
import { rankOf } from '../src/game/modifiers';

/**
 * The balance gate: a simple bot playing eight hours has to get somewhere
 * in skills, combat and the guilds without dying. A change that walls the
 * early game fails here.
 */
describe('an eight-hour bot', () => {
  for (const seed of [7, 3]) {
    it(`makes steady progress (seed ${seed})`, () => {
      const s = newGame(seed, 0);
      runBot(s, 8 * 3600);
      const total = SKILL_LIST.reduce((a, k) => a + level(s, k.id), 0);
      expect(total).toBeGreaterThanOrEqual(300);
      expect(combatLevel(s)).toBeGreaterThanOrEqual(12);
      expect(level(s, 'woodcutting')).toBeGreaterThanOrEqual(35);
      expect(level(s, 'smithing')).toBeGreaterThanOrEqual(15);
      expect(Object.values(s.guilds).filter((g) => rankOf(g!.rep) >= 2).length).toBeGreaterThanOrEqual(5);
      expect(s.counters['deaths'] ?? 0).toBe(0);
      expect(s.quests.length).toBeGreaterThanOrEqual(2);
    });
  }
});
