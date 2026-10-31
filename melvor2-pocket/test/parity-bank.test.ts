// Bank rules from the desktop game: bank-full stop, locks, placeholders, multi-upgrades.
import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/game';
import { newState } from '../src/engine/state';
import { unlockEverything } from '../src/engine/navigation';
import { get } from '../src/engine/content';
import { upgrade, upgradesAffordable, type ItemUpgrade } from '../src/engine/items';

const id = (s: string) => `MelvorBase:${s}`;
const fresh = (seed = 1) => {
  const g = new Game(newState(0, seed));
  unlockEverything(g);
  return g;
};
/** Fill the bank to its last slot with filler items. */
const fill = (g: Game) => {
  const filler = ['Bone', 'Stone', 'Shrimp', 'RawShrimp', 'Sardine', 'RawSardine'].map(id);
  let i = 0;
  while (Object.keys(g.state.bank).length < g.bankSlots()) {
    const k = filler[i] ?? `MelvorBase:Filler${i}`;
    g.state.bank[k] = 1;
    i++;
  }
};

describe('parity: bank', () => {
  it('a full bank stops the action and logs the lost item', () => {
    const g = fresh();
    fill(g);
    g.toggle('Woodcutting', id('NormalTree'));
    expect(g.state.active?.skill).toBe('Woodcutting');
    g.advance(60 * 60);
    expect(g.state.active).toBeNull();
    expect(g.state.eventLog?.[0]?.text).toMatch(/Bank full/);
  });

  it('can keep going when the bank is full if you turn that off', () => {
    const g = fresh();
    fill(g);
    g.state.bankOptions = { keepGoingWhenFull: true };
    g.toggle('Woodcutting', id('NormalTree'));
    g.advance(60 * 60);
    expect(g.state.active?.skill).toBe('Woodcutting');
  });

  it('locked items cannot be sold', () => {
    const g = fresh();
    g.addItem(id('Bone'), 5);
    g.setBankOption('locked', id('Bone'), true);
    expect(g.sell(id('Bone'), 5)).toBe(0);
    expect(g.count(id('Bone'))).toBe(5);
    g.setBankOption('locked', id('Bone'), false);
    expect(g.sell(id('Bone'), 5)).toBeGreaterThan(0);
  });

  it('a placeholder keeps the slot when the last one goes, and frees it when removed', () => {
    const g = fresh();
    g.addItem(id('Bone'), 2);
    g.setBankOption('placeholders', id('Bone'), true);
    g.sell(id('Bone'), 2);
    expect(id('Bone') in g.state.bank).toBe(true);
    expect(g.count(id('Bone'))).toBe(0);
    g.addItem(id('Bone'), 1);
    expect(g.count(id('Bone'))).toBe(1);
    g.sell(id('Bone'), 1);
    g.setBankOption('placeholders', id('Bone'), false);
    expect(id('Bone') in g.state.bank).toBe(false);
  });

  it('upgrades can be made several at once, up to what you can afford', () => {
    const g = fresh();
    const u = get<ItemUpgrade>('ItemUpgrade', id('ThugChestKey'));
    g.addItem(id('ThugChestKeyHalfA'), 3);
    g.addItem(id('ThugChestKeyHalfB'), 2);
    expect(upgradesAffordable(g, u)).toBe(2);
    expect(upgrade(g, u, 5)).toBeNull();
    expect(g.count(id('ThugChestKey'))).toBe(2);
    expect(g.count(id('ThugChestKeyHalfA'))).toBe(1);
    expect(upgrade(g, u, 1)).not.toBeNull();
  });
});
