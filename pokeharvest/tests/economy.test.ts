import { describe, expect, it } from 'vitest';
import { crop } from '../src/data/crops';
import { seedId } from '../src/data/items';
import { binValue, buy, martPrice, sellNow, ship, unship } from '../src/game/economy';
import { sleep } from '../src/game/world';
import { world } from './helpers';

describe('economy', () => {
  it('buys seeds when you can afford them', () => {
    const w = world();
    expect(buy(w, seedId('sitrus'), 6)).toBe(true);
    expect(w.player.gold).toBe(500 - 6 * 80);
    expect(buy(w, seedId('sitrus'), 1)).toBe(false);
    expect(buy(w, 'oran', 1)).toBe(false); // the Mart doesn't sell berries
  });

  it('pays for the bin overnight, in full', () => {
    const w = world();
    w.inventory.pecha = 3;
    expect(ship(w, 'pecha', 2)).toBe(true);
    expect(unship(w, 'pecha', 1)).toBe(true);
    expect(binValue(w.bin)).toBe(crop('pecha').sellPrice);
    const summary = sleep(w);
    expect(summary.earned).toBe(80);
    expect(w.player.gold).toBe(580);
    expect(w.bin).toEqual({});
    expect(w.inventory.pecha).toBe(2);
  });

  it('buys back on the spot for less', () => {
    const w = world();
    w.inventory.sitrus = 1;
    expect(sellNow(w, 'sitrus')).toBe(true);
    expect(w.player.gold).toBe(500 + martPrice('sitrus'));
    expect(martPrice('sitrus')).toBeLessThan(crop('sitrus').sellPrice);
    expect(sellNow(w, 'sitrus')).toBe(false);
    expect(ship(w, 'hoe')).toBe(false);
  });
});
