import { describe, expect, it } from 'vitest';
import { combatTurn, JUMP_TURNS, startCombat } from '../src/game/combat';
import { closeCombat } from '../src/game/engine';
import { started } from './helpers';

describe('ship combat', () => {
  it('a well-armed ship beats a scavenger skiff and takes the loot', () => {
    const s = started();
    s.modules.laser = 4;
    s.modules.missile = 2;
    s.modules.shield = 3;
    const credits = s.res.credits;
    startCombat(s, 'skiff');
    for (let i = 0; i < 40 && !s.combat!.result; i++) combatTurn(s, { k: 'fire' });
    expect(s.combat!.result).toBe('win');
    closeCombat(s);
    expect(s.res.credits).toBeGreaterThan(credits);
    expect(s.report?.title).toMatch(/defeated/);
  });

  it('charging the jump drive escapes', () => {
    const s = started();
    startCombat(s, 'raider');
    for (let i = 0; i < JUMP_TURNS && !s.combat!.result; i++) combatTurn(s, { k: 'jump' });
    expect(['fled', 'lose']).toContain(s.combat!.result);
  });

  it('class abilities need that class aboard', () => {
    const s = started();
    startCombat(s, 'skiff');
    const has = new Set(s.crew.map((c) => c.cls));
    for (const cls of ['pilot', 'engineer', 'scientist', 'medic', 'soldier'] as const) {
      if (!has.has(cls)) expect(combatTurn(s, { k: 'ability', cls })).toBe(false);
    }
  });

  it('losing sends you back to the last checkpoint', () => {
    const s = started();
    const day = s.day;
    s.day += 5;
    s.res.hull = 1;
    s.modules.shield = 0;
    startCombat(s, 'boss-echo');
    for (let i = 0; i < 30 && !s.combat!.result; i++) combatTurn(s, { k: 'fire' });
    expect(s.combat!.result).toBe('lose');
    closeCombat(s);
    expect(s.screen).toBe('lost');
    expect(s.day).toBe(day);
    expect(s.stats.reloads).toBe(1);
  });
});
