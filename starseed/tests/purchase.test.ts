import { describe, expect, it } from 'vitest';
import { Decimal, dec } from '../src/num/decimal';
import { capacityContribution, costOf, countForMode, maxAffordable, sumCost } from '../src/game/purchase';
import type { Building } from '../src/data/types';
import { CONTENT } from '../src/data/index';

function priced(base: number, growth: number): Building {
  return {
    id: 'x', name: 'X', emoji: '', blurb: '', era: 1,
    output: { resource: 'ore', rate: 1 },
    inputs: [],
    cost: { resource: 'ore', base, growth },
    heat: 0,
    unlock: { kind: 'always' },
  };
}

/** A depot: stores what it costs, same as every shipped storage building. */
function depot(base: number, growth: number, amount: number): Building {
  return {
    ...priced(base, growth),
    output: { resource: 'ore', rate: 0 },
    capacity: { resource: 'ore', amount },
  };
}

/** The obvious, slow way — the reference the closed forms must agree with. */
function sumByLoop(building: Building, owned: number, count: number): Decimal {
  let total = Decimal.ZERO;
  for (let i = 0; i < count; i += 1) total = total.add(costOf(building, owned + i));
  return total;
}

describe('cost curves', () => {
  it('grows geometrically from the base', () => {
    const b = priced(10, 1.1);
    expect(costOf(b, 0).toNumber()).toBeCloseTo(10, 9);
    expect(costOf(b, 1).toNumber()).toBeCloseTo(11, 9);
    expect(costOf(b, 5).toNumber()).toBeCloseTo(10 * 1.1 ** 5, 6);
  });

  it('stays exact far past where a double would overflow', () => {
    const b = priced(150_000, 1.13);
    expect(costOf(b, 20_000).log10()).toBeCloseTo(
      Math.log10(150_000) + 20_000 * Math.log10(1.13),
      6,
    );
  });
});

describe('the closed-form bulk sum', () => {
  it('matches adding the units up one at a time', () => {
    for (const growth of [1.07, 1.1, 1.15]) {
      const b = priced(25, growth);
      for (const owned of [0, 1, 13, 200]) {
        for (const count of [1, 2, 10, 57]) {
          const closed = sumCost(b, owned, count);
          const looped = sumByLoop(b, owned, count);
          expect(closed.log10()).toBeCloseTo(looped.log10(), 8);
        }
      }
    }
  });

  it('is zero for a non-positive count', () => {
    const b = priced(10, 1.1);
    expect(sumCost(b, 3, 0).isZero).toBe(true);
    expect(sumCost(b, 3, -5).isZero).toBe(true);
  });
});

describe('max affordable', () => {
  /**
   * The classic off-by-one. Being one unit over budget would let the player buy
   * something they cannot pay for and drive a resource negative, so the bound
   * is checked from both sides.
   */
  it('never overspends, and never leaves an affordable unit behind', () => {
    for (const growth of [1.07, 1.1, 1.13, 1.15]) {
      const b = priced(15, growth);
      for (const owned of [0, 7, 88, 1_000]) {
        for (const budget of [dec(0), dec(14), dec(15), dec(1e3), dec(1e9), dec('1e40')]) {
          const count = maxAffordable(b, owned, budget);
          expect(count).toBeGreaterThanOrEqual(0);
          if (count > 0) expect(sumCost(b, owned, count).lte(budget)).toBe(true);
          expect(sumCost(b, owned, count + 1).gt(budget)).toBe(true);
        }
      }
    }
  });

  it('buys nothing when the next unit is out of reach', () => {
    const b = priced(100, 1.1);
    expect(maxAffordable(b, 0, dec(99))).toBe(0);
    expect(maxAffordable(b, 0, dec(100))).toBe(1);
  });

  it('handles budgets far beyond the double range', () => {
    const b = priced(15, 1.1);
    const count = maxAffordable(b, 0, Decimal.parse('1e200'));
    expect(count).toBeGreaterThan(1_000);
    expect(sumCost(b, 0, count).lte(Decimal.parse('1e200'))).toBe(true);
    expect(sumCost(b, 0, count + 1).gt(Decimal.parse('1e200'))).toBe(true);
  });

  it('refuses a zero or negative budget', () => {
    const b = priced(10, 1.1);
    expect(maxAffordable(b, 0, Decimal.ZERO)).toBe(0);
    expect(maxAffordable(b, 0, dec(-50))).toBe(0);
  });
});

describe('storage contribution', () => {
  it('matches summing each unit’s contribution one at a time', () => {
    const sumByLoop = (building: Building, count: number): Decimal => {
      let total = Decimal.ZERO;
      const amount = building.capacity!.amount;
      const growth = building.cost.growth;
      for (let i = 0; i < count; i += 1) total = total.add(dec(amount).mul(dec(growth).pow(i)));
      return total;
    };

    for (const growth of [1.07, 1.1, 1.15]) {
      const d = depot(600, growth, 50_000);
      // Zero is covered separately below — log10 of a zero Decimal throws,
      // same as it does everywhere else in this codebase.
      for (const count of [1, 5, 40, 200]) {
        expect(capacityContribution(d, count).log10()).toBeCloseTo(sumByLoop(d, count).log10(), 6);
      }
    }
  });

  it('is zero for a non-positive count, or a building with no capacity', () => {
    const d = depot(600, 1.1, 50_000);
    expect(capacityContribution(d, 0).isZero).toBe(true);
    expect(capacityContribution(d, -3).isZero).toBe(true);
    expect(capacityContribution(priced(600, 1.1), 5).isZero).toBe(true);
  });

  it('grows faster than a flat count*amount, which is the whole point', () => {
    const d = depot(600, 1.1, 50_000);
    // Equal at the first unit, then the geometric curve pulls ahead — the gap
    // is what keeps the building's own cost from ever catching up to it.
    expect(capacityContribution(d, 1).toNumber()).toBeCloseTo(50_000, 6);
    expect(capacityContribution(d, 10).toNumber()).toBeGreaterThan(10 * 50_000);
  });

  /**
   * The regression this fix exists for. A depot priced in the resource it
   * stores has to keep pace with its own cost curve or every run eventually
   * reaches a unit that costs more than the player could ever hold — reported
   * directly against the deployed game, at exactly 103 Ore Depots (cost
   * 11.0M against a cap that could only ever reach 10.3M).
   *
   * Checked against the real shipped content, not a synthetic fixture, and
   * without the capacity-multiplier upgrade — the worse of the two cases —
   * across far more units than a single run plausibly reaches. If a future
   * balance pass ever retunes one of these numbers back into a trap, this is
   * what catches it.
   */
  it('keeps every shipped depot affordable no matter how many are owned', () => {
    const depots = CONTENT.buildings.filter((b) => b.capacity && b.capacity.resource === b.cost.resource);
    expect(depots.length).toBeGreaterThan(0); // fails loudly if the shape of the data ever changes

    for (const d of depots) {
      const resource = CONTENT.resources.find((r) => r.id === d.capacity!.resource)!;
      for (const owned of [0, 1, 10, 50, 100, 500, 2_000, 10_000]) {
        const cost = costOf(d, owned);
        const cap = dec(resource.baseCap).add(capacityContribution(d, owned));
        expect(cost.lte(cap)).toBe(true);
      }
    }
  });

  it('specifically fixes the reported case: 103 Ore Depots is affordable again', () => {
    const oredepot = CONTENT.buildings.find((b) => b.id === 'oredepot')!;
    const ore = CONTENT.resources.find((r) => r.id === 'ore')!;
    const cost = costOf(oredepot, 103);
    const cap = dec(ore.baseCap).add(capacityContribution(oredepot, 103));
    expect(cost.toNumber()).toBeCloseTo(11_005_197, -2);
    expect(cap.gte(cost)).toBe(true);
  });
});

describe('buy modes', () => {
  it('buys a fixed count only when the whole batch is affordable', () => {
    const b = priced(10, 1.1);
    const tenCost = sumCost(b, 0, 10);
    expect(countForMode(b, 0, tenCost, 10)).toBe(10);
    expect(countForMode(b, 0, tenCost.sub(dec(0.01)), 10)).toBe(0);
    expect(countForMode(b, 0, dec(10), 1)).toBe(1);
    expect(countForMode(b, 0, dec(9), 1)).toBe(0);
  });

  it('max agrees with maxAffordable', () => {
    const b = priced(10, 1.12);
    expect(countForMode(b, 4, dec(5_000), 'max')).toBe(maxAffordable(b, 4, dec(5_000)));
  });
});
