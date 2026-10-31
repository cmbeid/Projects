// Skill-page controls from the desktop: stop after X, fishing priority, trap picker, bulk buying.
import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/game';
import { newState } from '../src/engine/state';
import { unlockEverything } from '../src/engine/navigation';
import { get } from '../src/engine/content';
import { activeTrap, chooseTrap } from '../src/engine/skills/hunting';
import { canPrioritise } from '../src/engine/skills/fishing';
import { buy, maxBuyable, purchased, type ShopPurchase } from '../src/engine/shop';

const id = (s: string) => `MelvorBase:${s}`;
const fresh = (seed = 1) => {
  const g = new Game(newState(0, seed));
  unlockEverything(g);
  return g;
};
const HOUR = 60 * 60 * 60;

describe('parity: skill controls', () => {
  it('stops after N completed actions', () => {
    const g = fresh();
    g.toggle('Woodcutting', id('NormalTree'));
    g.setStopAfter({ kind: 'actions', n: 3 });
    g.advance(HOUR);
    expect(g.state.active).toBeNull();
    expect(g.count(id('NormalLog'))).toBeGreaterThanOrEqual(3);
    expect(g.count(id('NormalLog'))).toBeLessThanOrEqual(6);
  });

  it('stops once you hold N of an item', () => {
    const g = fresh();
    g.toggle('Woodcutting', id('NormalTree'));
    g.setStopAfter({ kind: 'item', n: 5, item: id('NormalLog') });
    g.advance(HOUR);
    expect(g.state.active).toBeNull();
    expect(g.count(id('NormalLog'))).toBeGreaterThanOrEqual(5);
    expect(g.count(id('NormalLog'))).toBeLessThan(10);
  });

  it('fishing priority needs the location’s guild rank', () => {
    const g = fresh();
    expect(canPrioritise(g, id('ShallowPools'))).toBe(false);
  });

  it('uses the trap you pick, or none when hunting trapless', () => {
    const g = fresh();
    const a = get<never>('HuntingAnimal', id('WildChicken'));
    g.addItem(id('BasicSnare'), 5);
    g.addItem(id('ReinforcedSnare'), 5);
    expect(activeTrap(g, a)).toBe(id('BasicSnare'));
    chooseTrap(g, id('WildChicken'), { trap: id('ReinforcedSnare') });
    expect(activeTrap(g, a)).toBe(id('ReinforcedSnare'));
    chooseTrap(g, id('WildChicken'), { noTrap: true });
    expect(activeTrap(g, a)).toBeNull();
    g.toggle('Hunting', id('WildChicken'));
    g.advance(HOUR);
    expect(g.count(id('BasicSnare')) + g.count(id('ReinforcedSnare'))).toBe(10);
  });

  it('bulk purchases buy the chosen quantity, up to what you can afford', () => {
    const g = fresh();
    const p = get<ShopPurchase>('ShopPurchase', id('Cowhide'));
    g.addCurrency(id('GoldPieces'), 40 * 7);
    expect(maxBuyable(g, p)).toBe(7);
    expect(buy(g, p, 10)).toBeNull();
    expect(purchased(g, id('Cowhide'))).toBe(7);
    expect(g.state.gold).toBe(0);
  });
});
