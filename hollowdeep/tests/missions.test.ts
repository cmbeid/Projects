import { describe, expect, it } from 'vitest';
import { STORY } from '../src/data/missions';
import { newGame } from '../src/game/engine';
import { claimStory, makeContracts, progress, claimContract, refreshContracts, storyIndex } from '../src/game/missions';
import { damage } from '../src/game/mining';
import { unlockFeature } from '../src/game/features';

describe('story', () => {
  it('counts only what happens after a mission starts, then unlocks its feature', () => {
    const s = newGame(1);
    expect(STORY[0]!.goal.kind).toBe('breaks');
    expect(claimStory(s)).toBe(false);
    for (let i = 0; i < 5; i++) damage(s, s.block.hp, { crit: false, auto: false });
    expect(claimStory(s)).toBe(true);
    expect(s.features).toContain('upgrades');
    expect(storyIndex(s)).toBe(1);
  });
});

describe('contracts', () => {
  it('posts the same board for the same day', () => {
    const s = newGame(2);
    unlockFeature(s, 'contracts');
    expect(makeContracts(s, '2026-10-3')).toEqual(makeContracts(s, '2026-10-3'));
    expect(makeContracts(s, '2026-10-3')).not.toEqual(makeContracts(s, '2026-10-4'));
  });

  it('pays out once when done', () => {
    const s = newGame(3);
    unlockFeature(s, 'contracts');
    refreshContracts(s, Date.UTC(2026, 9, 3, 12));
    const c = s.contracts.list.find((x) => x.goal.kind === 'breaks' || x.goal.kind === 'gems' || x.goal.kind === 'earn')!;
    expect(c).toBeDefined();
    if (c.goal.kind === 'breaks') s.counters.breaks += c.goal.n;
    if (c.goal.kind === 'gems') s.counters.gems += c.goal.n;
    if (c.goal.kind === 'earn') s.counters.earned += c.goal.n;
    expect(progress(s, c.goal, c.base).done).toBe(true);
    const coins = s.coins;
    expect(claimContract(s, c.id)).toBe(true);
    expect(s.coins).toBeGreaterThan(coins);
    expect(claimContract(s, c.id)).toBe(false);
  });
});
