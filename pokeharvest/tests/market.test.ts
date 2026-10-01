import { describe, expect, it } from 'vitest';
import { crop } from '../src/data/crops';
import { binValue, sellNow, ship } from '../src/game/economy';
import { buyFromMerchant, merchantHere, merchantStock, rollMarket, saleValue, SATURATION_FREE } from '../src/game/market';
import { canDeliver, deliver, refreshRequests } from '../src/game/requests';
import { sleep } from '../src/game/world';
import { world } from './helpers';

describe('market', () => {
  it('sets each day\'s prices within 15% of normal', () => {
    const w = world();
    rollMarket(w);
    const values = Object.values(w.market);
    expect(values.length).toBeGreaterThan(10);
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0.85);
      expect(v).toBeLessThanOrEqual(1.15);
    }
  });

  it('pays less for a flood of one thing', () => {
    const w = world();
    const price = crop('cheri').sellPrice;
    expect(saleValue(w, 'cheri', SATURATION_FREE)).toBe(price * SATURATION_FREE);
    expect(saleValue(w, 'cheri', SATURATION_FREE + 10)).toBeLessThan(price * (SATURATION_FREE + 10));
    w.inventory.cheri = 40;
    ship(w, 'cheri', 40);
    const promised = binValue(w);
    const summary = sleep(w);
    expect(summary.earned).toBe(promised);
    expect(promised).toBeLessThan(price * 40);
  });

  it('counts Mart sales against the day', () => {
    const w = world();
    w.inventory.oran = 30;
    sellNow(w, 'oran', 20);
    expect(w.sold.oran).toBe(20);
    expect(saleValue(w, 'oran', 1)).toBeLessThan(crop('oran').sellPrice);
  });

  it('brings the merchant at weekends only', () => {
    const w = world();
    expect(merchantHere(w)).toBe(false);
    w.day = 6;
    expect(merchantHere(w)).toBe(true);
    const stock = merchantStock(w);
    expect(stock).toHaveLength(4);
    w.player.gold = 99999;
    expect(buyFromMerchant(w, stock[0]!.id)).toBe(true);
    expect(w.inventory[stock[0]!.id]).toBeGreaterThan(0);
  });
});

describe('requests', () => {
  it('posts three requests, pays and adds reputation when filled', () => {
    const w = world();
    expect(w.requests).toHaveLength(3);
    const r = w.requests[0]!;
    expect(canDeliver(w, r.id)).toBe(false);
    w.inventory[r.item] = r.count;
    const gold = w.player.gold;
    expect(deliver(w, r.id)).toBe(true);
    expect(w.player.gold).toBe(gold + r.reward);
    expect(w.reputation).toBe(r.reputation);
    expect(w.requests).toHaveLength(2);
  });

  it('lets requests expire, and posts new ones', () => {
    const w = world();
    w.requests.forEach((r) => (r.due = w.day));
    w.day += 1;
    expect(refreshRequests(w)).toBe(3);
    expect(w.requests).toHaveLength(3);
  });
});
