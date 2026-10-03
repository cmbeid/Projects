import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/data/progression';
import { newGame, tick } from '../src/game/engine';
import { blockHp, damage, setDepth, tap, xpForLevel, addXp } from '../src/game/mining';
import { derive } from '../src/game/derive';
import { buyMachine, buyUpgrade, sellAllOre } from '../src/game/economy';
import { unlockFeature } from '../src/game/features';

describe('mining', () => {
  it('breaks a block after enough taps and drops ore', () => {
    const s = newGame(1);
    const taps = Math.ceil(blockHp(1, false) / derive(s).tap);
    for (let i = 0; i < taps; i++) tap(s);
    expect(s.counters.breaks).toBe(1);
    expect(Object.values(s.inventory).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });

  it('exposes a seam after ten blocks and goes deeper when it breaks', () => {
    const s = newGame(2);
    for (let i = 0; i < BALANCE.blocksPerDepth; i++) damage(s, s.block.hp, { crit: false, auto: false });
    expect(s.block.seam).toBe(true);
    damage(s, s.block.hp * 10, { crit: false, auto: false });
    expect(s.depth).toBe(2);
    expect(s.maxDepth).toBe(2);
    expect(s.inventory['loam-heart']).toBe(1);
  });

  it('never exposes a seam while farming', () => {
    const s = newGame(3);
    s.autoAdvance = false;
    for (let i = 0; i < 25; i++) damage(s, s.block.hp, { crit: false, auto: false });
    expect(s.depth).toBe(1);
    expect(s.block.seam).toBe(false);
  });

  it('cannot go below the deepest opened depth', () => {
    const s = newGame(4);
    setDepth(s, 9);
    expect(s.depth).toBe(1);
  });

  it('levels up and grants stat points', () => {
    const s = newGame(5);
    addXp(s, xpForLevel(1) + xpForLevel(2));
    expect(s.level).toBe(3);
    expect(s.statPoints).toBe(2 * BALANCE.statPointsPerLevel);
  });

  it('hits harder with Sharpened Pick', () => {
    const s = newGame(6);
    unlockFeature(s, 'upgrades');
    const before = derive(s).tap;
    s.coins = 1000;
    expect(buyUpgrade(s, 'sharpen')).toBe(true);
    expect(derive(s).tap).toBeGreaterThan(before);
  });

  it('machines mine on their own', () => {
    const s = newGame(7);
    unlockFeature(s, 'drones');
    s.coins = 1e6;
    buyMachine(s, 'drone', 20);
    for (let i = 0; i < 200; i++) tick(s, 0.1);
    expect(s.counters.breaks).toBeGreaterThan(0);
  });

  it('sells ore but keeps gems and bars', () => {
    const s = newGame(8);
    s.inventory = { coal: 10, quartz: 2, 'copper-bar': 1 };
    const coins = sellAllOre(s);
    expect(coins).toBeGreaterThan(0);
    expect(s.inventory['coal']).toBe(0);
    expect(s.inventory['quartz']).toBe(2);
    expect(s.inventory['copper-bar']).toBe(1);
  });

  it('is deterministic for a seed', () => {
    const a = newGame(42);
    const b = newGame(42);
    for (let i = 0; i < 300; i++) {
      tap(a);
      tap(b);
    }
    expect(a.inventory).toEqual(b.inventory);
    expect(a.rng).toBe(b.rng);
  });
});
