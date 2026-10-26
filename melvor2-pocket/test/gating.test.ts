import { describe, expect, it } from 'vitest';
import { Game, msToTicks } from '../src/engine/game';
import { newState } from '../src/engine/state';
import { describeRequirement, isUnlocked, navRequirements } from '../src/engine/navigation';

const id = (s: string) => `MelvorBase:${s}`;
const fresh = () => new Game(newState(0, 1));

describe('progression gating (navigation options)', () => {
  it('a new character starts with only Woodcutting', () => {
    const g = fresh();
    expect(isUnlocked(g, 'Woodcutting')).toBe(true);
    for (const page of ['Fishing', 'Mining', 'Combat', 'Bank', 'Shop', 'Quests', 'Attack', 'Farming']) expect(isUnlocked(g, page)).toBe(false);
    g.toggle('Fishing', id('ShallowPools'));
    expect(g.state.active).toBeNull();
  });

  it('cutting trees unlocks the Bank (3 logs), then Fishing and Mining (Woodcutting 2)', () => {
    const g = fresh();
    g.toggle('Woodcutting', id('NormalTree'));
    g.advance(msToTicks(1000) * 3 * 3);
    expect(isUnlocked(g, 'Bank')).toBe(true);
    expect(isUnlocked(g, 'Fishing')).toBe(false);
    g.advance(msToTicks(1000) * 3 * 30);
    expect(g.level('Woodcutting')).toBeGreaterThanOrEqual(2);
    expect(isUnlocked(g, 'Fishing')).toBe(true);
    expect(isUnlocked(g, 'Mining')).toBe(true);
  });

  it('Combat needs a Stone Sword from Smithing and 10 Shrimp from Cooking', () => {
    const g = fresh();
    g.state.unlocked.Smithing = g.state.unlocked.Cooking = true;
    const describe = () => navRequirements('Combat').map((r) => describeRequirement(g, r));
    expect(describe().map((d) => d.done)).toEqual([false, false]);
    g.addItem(id('Stone'), 2);
    g.toggle('Smithing', id('StoneSword'));
    g.advance(msToTicks(2000) * 2);
    expect(describe()[0].done).toBe(true);
    expect(isUnlocked(g, 'Combat')).toBe(false);
    // Bought or looted swords don't count: it has to come from Smithing.
    g.state.xp.Cooking = 1e9;
    g.addItem(id('RawShrimp'), 10);
    g.toggle('Cooking', id('Shrimp'));
    g.advance(msToTicks(3000) * 10);
    expect(isUnlocked(g, 'Combat')).toBe(true);
    expect(isUnlocked(g, 'Attack')).toBe(true);
  });

  it('the Shop opens after selling 250 gold of items', () => {
    const g = fresh();
    g.addItem(id('NormalLog'), 100);
    g.sell(id('NormalLog'), 80);
    expect(isUnlocked(g, 'Shop')).toBe(false);
    g.sell(id('NormalLog'), 20);
    expect(g.state.stats.goldFromSales).toBe(300);
    expect(isUnlocked(g, 'Shop')).toBe(true);
  });

  it('Astrology, Herblore and Agility stay locked in the demo', () => {
    const g = fresh();
    for (const page of ['Astrology', 'Herblore', 'Agility']) expect(describeRequirement(g, navRequirements(page)[0]).text).toMatch(/demo/);
  });

  it('saves from before gating keep everything unlocked', () => {
    const s = newState(0, 1);
    s.legacyUnlockAll = true;
    const g = new Game(s);
    expect(isUnlocked(g, 'Combat')).toBe(true);
    expect(isUnlocked(g, 'Ranching')).toBe(true);
    expect(isUnlocked(g, 'Astrology')).toBe(false);
  });
});
