import { describe, expect, it } from 'vitest';
import { Game, milestonesBetween, type GameEvent } from '../src/engine/game';
import { newState } from '../src/engine/state';
import { xpForLevel } from '../src/engine/xp';

describe('level-up announcements', () => {
  it('signal the old and new level, skipping straight past several', () => {
    const g = new Game(newState(0, 1));
    const seen: GameEvent[] = [];
    g.events.add((e) => seen.push(e));
    g.addXp('Woodcutting', xpForLevel(5));
    expect(seen).toEqual([{ type: 'levelUp', skill: 'Woodcutting', from: 1, to: 5 }]);
  });

  it('count milestones as recipes gated on a level in the range', () => {
    expect(milestonesBetween('Woodcutting', 1, 1)).toBe(0);
    const early = milestonesBetween('Woodcutting', 1, 10);
    expect(early).toBeGreaterThan(0);
    expect(milestonesBetween('Woodcutting', 1, 60)).toBeGreaterThan(early);
    expect(milestonesBetween('Woodcutting', 1, 10)).toBe(milestonesBetween('Woodcutting', 1, 5) + milestonesBetween('Woodcutting', 5, 10));
    expect(milestonesBetween('Hitpoints', 1, 60)).toBe(0);
  });
});
