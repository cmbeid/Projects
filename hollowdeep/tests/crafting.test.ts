import { describe, expect, it } from 'vitest';
import { newGame, tick } from '../src/game/engine';
import { craft, queueRefine, clearSlot } from '../src/game/crafting';
import { unlockFeature } from '../src/game/features';
import { derive } from '../src/game/derive';

describe('furnace', () => {
  it('smelts queued bars over time, taking ore as each batch starts', () => {
    const s = newGame(1);
    unlockFeature(s, 'refinery');
    s.inventory = { copper: 20 };
    expect(queueRefine(s, 0, 'r-copper', 5)).toBe(true);
    tick(s, 100);
    expect(s.inventory['copper-bar']).toBe(2);
    expect(s.inventory['copper']).toBe(4);
    expect(s.furnace[0]!.queued).toBe(3);
  });

  it('refunds the batch on the fire when cleared', () => {
    const s = newGame(2);
    unlockFeature(s, 'refinery');
    s.inventory = { copper: 8 };
    queueRefine(s, 0, 'r-copper', 1);
    tick(s, 0.5);
    expect(s.inventory['copper']).toBe(0);
    clearSlot(s, 0);
    expect(s.inventory['copper']).toBe(8);
  });

  it('refuses a slot that is not built yet', () => {
    const s = newGame(3);
    unlockFeature(s, 'refinery');
    s.inventory = { copper: 80 };
    expect(queueRefine(s, 1, 'r-copper', 1)).toBe(false);
  });
});

describe('workbench', () => {
  it('crafts gear, wears it, and it hits harder', () => {
    const s = newGame(4);
    unlockFeature(s, 'workbench');
    s.coins = 100;
    s.inventory = { 'copper-bar': 4 };
    const before = derive(s).tap;
    expect(craft(s, 'c-copper-pick')).toBe(true);
    expect(s.equipped.pick).not.toBeNull();
    expect(derive(s).tap).toBeGreaterThan(before);
    expect(s.coins).toBe(60);
  });

  it('builds a fixture only once', () => {
    const s = newGame(5);
    unlockFeature(s, 'workbench');
    s.deepestEver = 30;
    s.coins = 1e6;
    s.inventory = { 'silver-bar': 20, mycelite: 40 };
    expect(craft(s, 'c-filters')).toBe(true);
    expect(craft(s, 'c-filters')).toBe(false);
  });

  it('will not craft a recipe from deeper down', () => {
    const s = newGame(6);
    unlockFeature(s, 'workbench');
    s.coins = 1e12;
    s.inventory = { 'platinum-bar': 99, amethyst: 9, 'prism-heart': 9 };
    expect(craft(s, 'c-crystal-pick')).toBe(false);
  });
});
