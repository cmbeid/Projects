import { describe, expect, it } from 'vitest';
import { Decimal, dec } from '../src/num/decimal';
import { advance, tap, TICK_SECONDS, MAX_STEPS_PER_CALL } from '../src/game/engine';
import { computeRates, marginalRates } from '../src/game/rates';
import { HEAT_THRESHOLD } from '../src/data/packs/00-resources';
import type { GameState } from '../src/state/types';
import { FIXTURE_INDEX, snapshot, world } from './fixture';

describe('determinism', () => {
  /**
   * The property the whole design rests on: because the simulation runs on a
   * fixed timestep with an accumulator, one long call and many short calls are
   * not merely close — they are the same steps, so the states are identical.
   * This is what lets offline catch-up reuse the live code path.
   */
  it('one call of 10s equals a hundred calls of 0.1s, exactly', () => {
    const bulk = world((s) => { s.buildings['miner'] = 7; s.buildings['mill'] = 2; });
    const drip = world((s) => { s.buildings['miner'] = 7; s.buildings['mill'] = 2; });

    advance(bulk.state, bulk.index, bulk.cache, 10);
    for (let i = 0; i < 100; i += 1) advance(drip.state, drip.index, drip.cache, 0.1);

    expect(snapshot(bulk.state)).toBe(snapshot(drip.state));
  });

  it('is unaffected by how the same total is split up', () => {
    const a = world((s) => { s.buildings['miner'] = 3; });
    const b = world((s) => { s.buildings['miner'] = 3; });

    advance(a.state, a.index, a.cache, 6);
    for (const chunk of [0.4, 1.1, 2.0, 0.5, 2.0]) advance(b.state, b.index, b.cache, chunk);

    expect(snapshot(a.state)).toBe(snapshot(b.state));
  });

  it('carries sub-tick remainders instead of dropping them', () => {
    const w = world((s) => { s.buildings['miner'] = 1; });
    // Nine hundredths of a second is less than one tick: nothing should happen.
    advance(w.state, w.index, w.cache, 0.09);
    expect(w.state.resources.ore.isZero).toBe(true);
    // The tenth hundredth completes a tick, and it fires.
    advance(w.state, w.index, w.cache, 0.01);
    expect(w.state.resources.ore.toNumber()).toBeCloseTo(TICK_SECONDS, 10);
  });

  it('credits nothing for a zero, negative or non-finite delta', () => {
    const w = world((s) => { s.buildings['miner'] = 5; });
    for (const delta of [0, -1, -3600, NaN, Infinity]) {
      const report = advance(w.state, w.index, w.cache, delta);
      expect(report.stepsRun).toBe(0);
    }
    expect(w.state.resources.ore.isZero).toBe(true);
  });

  it('caps the steps a single call may run and reports the shortfall', () => {
    const w = world((s) => { s.buildings['miner'] = 1; });
    const seconds = (MAX_STEPS_PER_CALL + 5_000) * TICK_SECONDS;
    const report = advance(w.state, w.index, w.cache, seconds);

    expect(report.stepsRun).toBe(MAX_STEPS_PER_CALL);
    expect(report.droppedSeconds).toBeGreaterThan(0);
    // The debt is dropped, not carried, so the next call is not slower again.
    expect(w.state.accumulator).toBe(0);
  });
});

describe('the rate pipeline', () => {
  /**
   * Order of operations, pinned. Additive effects pool inside the building and
   * are applied before any multiplier:
   *   1 miner * 1/s * (1 + 1) * 3 * 5 = 30/s
   * If additive were applied after the multipliers this would read 16.
   */
  it('pools additive bonuses inside a building before anything multiplies', () => {
    const w = world((s) => {
      s.buildings['miner'] = 1;
      s.upgrades = ['add', 'mult', 'glob'];
    });
    const rates = computeRates(w.state, w.index);
    expect(rates.output.get('ore')?.toNumber()).toBeCloseTo(30, 9);
  });

  it('scales a converter’s inputs with its output, so boosts are not free', () => {
    const plain = world((s) => { s.buildings['mill'] = 1; });
    const boosted = world((s) => { s.buildings['mill'] = 1; s.upgrades = ['glob']; });

    const a = computeRates(plain.state, plain.index);
    const b = computeRates(boosted.state, boosted.index);
    // The global multiplier is on ore, not alloy, so the mill is untouched.
    expect(b.input.get('ore')?.toNumber()).toBeCloseTo(a.input.get('ore')?.toNumber() ?? 0, 9);
  });

  /**
   * Geometric, not `count * amount`: capacity(n) = amount*(growth^n-1)/(growth-1),
   * the same closed form as `sumCost`. Silo is priced in the resource it
   * stores, so this is what keeps the building's own cost curve from ever
   * outrunning what it can hold (see the soft-lock tests in purchase.test.ts):
   * at growth 1.1, three silos contribute `500*(1.1^3-1)/0.1` = 1,655, not
   * the flat 1,500 a linear count*amount would give.
   */
  it('counts depot capacity into the cap, on the same curve as its cost', () => {
    const w = world((s) => { s.buildings['silo'] = 3; });
    const rates = computeRates(w.state, w.index);
    expect(rates.caps.get('ore')?.toNumber()).toBeCloseTo(1_000_000 + 1_655, 6);
  });
});

describe('conversion and starvation', () => {
  it('runs a converter at full rate when its input is plentiful', () => {
    const w = world((s) => {
      s.buildings['mill'] = 1;
      s.resources.ore = dec(1000);
      s.lifetime.ore = dec(1000);
    });
    advance(w.state, w.index, w.cache, 1);
    expect(w.state.resources.alloy.toNumber()).toBeCloseTo(1, 6);
    expect(w.state.resources.ore.toNumber()).toBeCloseTo(996, 6);
  });

  /**
   * A starved converter runs at a reduced rate rather than stalling, and never
   * drives a stock below zero — the thing that would silently corrupt a save.
   */
  it('throttles proportionally when input runs short', () => {
    const w = world((s) => {
      s.buildings['mill'] = 1;
      s.resources.ore = dec(2); // wants 4/s, has 2
      s.lifetime.ore = dec(2);
    });
    advance(w.state, w.index, w.cache, 1);
    expect(w.state.resources.ore.isZero).toBe(true);
    expect(w.state.resources.alloy.toNumber()).toBeCloseTo(0.5, 6);
  });

  it('never lets a resource go negative, however many consumers compete', () => {
    const w = world((s) => {
      s.buildings['mill'] = 40;
      s.resources.ore = dec(3);
      s.lifetime.ore = dec(3);
    });
    advance(w.state, w.index, w.cache, 30);
    expect(w.state.resources.ore.isPositive || w.state.resources.ore.isZero).toBe(true);
    expect(w.state.resources.alloy.isPositive).toBe(true);
  });
});

describe('pausing a building', () => {
  /**
   * The whole point: a converter running its feedstock into the ground can be
   * stopped without selling it. Neither its output nor its input draw should
   * move the world at all while paused.
   */
  it('draws nothing and makes nothing while paused', () => {
    const w = world((s) => {
      s.buildings['mill'] = 1;
      s.resources.ore = dec(1000);
      s.lifetime.ore = dec(1000);
      s.buildingActive['mill'] = false;
    });
    advance(w.state, w.index, w.cache, 10);
    expect(w.state.resources.ore.toNumber()).toBe(1000);
    expect(w.state.resources.alloy.isZero).toBe(true);
  });

  it('is the default-on state: an absent flag runs exactly like `true`', () => {
    const on = world((s) => { s.buildings['mill'] = 1; s.resources.ore = dec(100); s.lifetime.ore = dec(100); });
    const flagged = world((s) => {
      s.buildings['mill'] = 1;
      s.resources.ore = dec(100);
      s.lifetime.ore = dec(100);
      s.buildingActive['mill'] = true;
    });
    advance(on.state, on.index, on.cache, 5);
    advance(flagged.state, flagged.index, flagged.cache, 5);
    expect(snapshot(on.state)).toBe(snapshot(flagged.state));
  });

  it('does not starve a resource it never touches while paused', () => {
    const w = world((s) => {
      s.buildings['miner'] = 1;
      s.buildings['mill'] = 1;
      s.buildingActive['mill'] = false;
    });
    advance(w.state, w.index, w.cache, 10);
    // The miner keeps running; only the paused mill's own trade stops.
    expect(w.state.resources.ore.toNumber()).toBeCloseTo(10, 6);
    expect(w.state.resources.alloy.isZero).toBe(true);
  });

  it('stops contributing heat, so a paused reactor cools the rest of the swarm', () => {
    // 6 reactors at 400 heat each clears HEAT_THRESHOLD (2000), same margin the
    // existing thermal tests use.
    const hot = world((s) => { s.buildings['reactor'] = 6; s.buildings['miner'] = 1; });
    const paused = world((s) => {
      s.buildings['reactor'] = 6;
      s.buildings['miner'] = 1;
      s.buildingActive['reactor'] = false;
    });
    const hotRates = computeRates(hot.state, hot.index);
    const pausedRates = computeRates(paused.state, paused.index);

    expect(hotRates.heat).toBeCloseTo(2400, 6);
    expect(pausedRates.heat).toBe(0);
    expect(hotRates.heat).toBeGreaterThan(HEAT_THRESHOLD);
    expect(hotRates.heatPenalty).toBeLessThan(1);
    expect(pausedRates.heatPenalty).toBe(1);
  });

  it('leaves ownership, and every other building, untouched', () => {
    const w = world((s) => {
      s.buildings['mill'] = 1;
      s.buildings['miner'] = 3;
      s.buildingActive['mill'] = false;
    });
    const rates = computeRates(w.state, w.index);
    expect(w.state.buildings['mill']).toBe(1); // still owned, not sold
    expect(rates.output.get('ore')?.toNumber()).toBeCloseTo(3, 9); // the miner is unaffected
  });

  it('has no effect on a building that is not actually owned', () => {
    const owned = world((s) => { s.buildings['miner'] = 4; });
    const flaggedButUnowned = world((s) => {
      s.buildings['miner'] = 4;
      s.buildingActive['mill'] = false; // never bought
    });
    expect(computeRates(owned.state, owned.index).output.get('ore')?.toNumber()).toBeCloseTo(
      computeRates(flaggedButUnowned.state, flaggedButUnowned.index).output.get('ore')?.toNumber() ?? -1,
      9,
    );
  });

  // The determinism contract has to survive a pause toggled mid-run too, not
  // only a fixed configuration held for the whole call.
  it('stays deterministic across a pause that toggles mid-run', () => {
    const bulk = world((s) => { s.buildings['mill'] = 2; s.resources.ore = dec(1000); s.lifetime.ore = dec(1000); });
    const drip = world((s) => { s.buildings['mill'] = 2; s.resources.ore = dec(1000); s.lifetime.ore = dec(1000); });

    advance(bulk.state, bulk.index, bulk.cache, 3);
    bulk.state.buildingActive['mill'] = false;
    advance(bulk.state, bulk.index, bulk.cache, 4);
    bulk.state.buildingActive['mill'] = true;
    advance(bulk.state, bulk.index, bulk.cache, 3);

    for (let i = 0; i < 30; i += 1) advance(drip.state, drip.index, drip.cache, 0.1);
    drip.state.buildingActive['mill'] = false;
    for (let i = 0; i < 40; i += 1) advance(drip.state, drip.index, drip.cache, 0.1);
    drip.state.buildingActive['mill'] = true;
    for (let i = 0; i < 30; i += 1) advance(drip.state, drip.index, drip.cache, 0.1);

    expect(snapshot(bulk.state)).toBe(snapshot(drip.state));
  });

  it('a marginal preview on a paused building honestly says buying more adds nothing', () => {
    const w = world((s) => {
      s.buildings['mill'] = 1;
      s.resources.ore = dec(10_000);
      s.lifetime.ore = dec(10_000);
      s.buildingActive['mill'] = false;
    });
    const marginal = marginalRates(w.state, w.index, 'mill', 1);
    for (const change of marginal.net.values()) expect(change.isZero).toBe(true);
    expect(marginal.heat).toBe(0);
  });
});

describe('storage', () => {
  it('clamps at the cap, discards the overflow, and reports it', () => {
    const w = world((s) => { s.buildings['miner'] = 1_000_000; });
    const report = advance(w.state, w.index, w.cache, 5);

    const cap = computeRates(w.state, w.index).caps.get('ore') ?? Decimal.ZERO;
    expect(w.state.resources.ore.eq(cap)).toBe(true);
    expect(report.capped).toContain('ore');
  });

  it('does not credit discarded overflow towards lifetime totals', () => {
    const w = world((s) => { s.buildings['miner'] = 1_000_000; });
    advance(w.state, w.index, w.cache, 60);
    const cap = computeRates(w.state, w.index).caps.get('ore') ?? Decimal.ZERO;
    // Ore that fell on the floor never existed as far as progress is concerned.
    expect(w.state.lifetime.ore.lte(cap)).toBe(true);
  });
});

describe('milestones and tapping', () => {
  it('reports a milestone once, when it is crossed', () => {
    const w = world((s) => { s.buildings['miner'] = 100; });
    const first = advance(w.state, w.index, w.cache, 1);
    const second = advance(w.state, w.index, w.cache, 1);

    expect(first.milestonesCrossed).toContain('ten-ore');
    expect(second.milestonesCrossed).toEqual([]);
    expect(w.state.milestones).toEqual(['ten-ore']);
  });

  it('unlocks a log entry once, alongside the milestone that shares its condition', () => {
    const w = world((s) => { s.buildings['miner'] = 100; });
    const first = advance(w.state, w.index, w.cache, 1);
    const second = advance(w.state, w.index, w.cache, 1);

    expect(first.logUnlocked).toContain('ten-ore-log');
    expect(second.logUnlocked).toEqual([]);
    expect(w.state.log).toEqual(['ten-ore-log']);
  });

  it('credits a tap and counts it', () => {
    const w = world();
    const gained = tap(w.state, w.cache);
    expect(gained.toNumber()).toBe(1);
    expect(w.state.stats.taps).toBe(1);
    expect(w.state.lifetime.ore.toNumber()).toBe(1);
  });
});

describe('automation', () => {
  it('the auto-miner produces through the rate pipeline, so it shows in ore/s', () => {
    const w = world((s) => { s.automation = ['auto-miner']; s.automationOn = { 'auto-miner': true }; });
    const rates = computeRates(w.state, w.index);
    expect(rates.output.get('ore')?.isPositive).toBe(true);

    advance(w.state, w.index, w.cache, 1);
    expect(w.state.resources.ore.isPositive).toBe(true);
  });

  it('an automator switched off does nothing', () => {
    const w = world((s) => { s.automation = ['auto-miner']; s.automationOn = { 'auto-miner': false }; });
    advance(w.state, w.index, w.cache, 10);
    expect(w.state.resources.ore.isZero).toBe(true);
  });

  it('replication buys, and never spends below zero', () => {
    const w = world((s) => {
      s.automation = ['replication'];
      s.automationOn = { replication: true };
      s.resources.ore = dec(10_000);
      s.lifetime.ore = dec(10_000);
    });
    advance(w.state, w.index, w.cache, 30);

    expect((w.state.buildings['miner'] ?? 0) > 0).toBe(true);
    expect(w.state.resources.ore.isPositive || w.state.resources.ore.isZero).toBe(true);
  });

  it('runs identically whether the time arrives in one call or many', () => {
    const setup = (s: GameState): void => {
      s.automation = ['replication'];
      s.automationOn = { replication: true };
      s.resources.ore = dec(5_000);
      s.lifetime.ore = dec(5_000);
    };
    const bulk = world(setup);
    const drip = world(setup);

    advance(bulk.state, bulk.index, bulk.cache, 20);
    for (let i = 0; i < 200; i += 1) advance(drip.state, drip.index, drip.cache, 0.1);

    expect(snapshot(bulk.state)).toBe(snapshot(drip.state));
  });
});

it('uses the fixture, not the shipped content', () => {
  // Identity rather than a count: the point is which world these tests run in,
  // and asserting a length just breaks every time the fixture grows a building.
  expect(FIXTURE_INDEX.buildingById.has('miner')).toBe(true);
  expect(FIXTURE_INDEX.buildingById.has('probe')).toBe(false);
});

/**
 * What the Swarm panel promises a purchase will give you. It has to be the
 * difference the purchase makes to the *world*, not the new unit's own rate —
 * those are different numbers the moment thermal load starts to bite.
 */
describe('marginal rates', () => {
  it('is the per-unit rate while the swarm is running cool', () => {
    const { state, index } = world((s) => { s.buildings['miner'] = 10; });
    const one = marginalRates(state, index, 'miner', 1);
    // The fixture miner makes 1 ore/s and has no heat, so one more is worth 1.
    expect(one.output.get('ore')!.toNumber()).toBeCloseTo(1, 9);
    expect(one.heat).toBe(0);
  });

  it('scales with the quantity being bought', () => {
    const { state, index } = world((s) => { s.buildings['miner'] = 10; });
    expect(marginalRates(state, index, 'miner', 10).output.get('ore')!.toNumber()).toBeCloseTo(10, 9);
    expect(marginalRates(state, index, 'miner', 10).count).toBe(10);
  });

  it('carries every multiplier the pipeline applies', () => {
    const { state, index } = world((s) => {
      s.buildings['miner'] = 10;
      s.upgrades = ['mult']; // miner ×3
    });
    expect(marginalRates(state, index, 'miner', 1).output.get('ore')!.toNumber()).toBeCloseTo(3, 9);
  });

  it('reports what a converter will draw, not just what it makes', () => {
    const { state, index } = world((s) => { s.buildings['miner'] = 50; s.buildings['mill'] = 2; });
    const one = marginalRates(state, index, 'mill', 1);
    expect(one.output.get('alloy')!.toNumber()).toBeCloseTo(1, 9);
    expect(one.input.get('ore')!.toNumber()).toBeCloseTo(4, 9);
    // The net is what the card shows: one more mill is +1 alloy and −4 ore.
    expect(one.net.get('alloy')!.toNumber()).toBeCloseTo(1, 9);
    expect(one.net.get('ore')!.toNumber()).toBeCloseTo(-4, 9);
  });

  /**
   * The case a per-unit figure cannot express at all: a purchase that lowers
   * the net rate of a resource it neither makes nor consumes, purely by heating
   * the swarm that does. Showing only the new unit's own output would report a
   * gain while the player watches their ore rate fall.
   */
  it('reports a resource going *down* when the heat a purchase adds costs more than it makes', () => {
    const { state, index } = world((s) => {
      s.buildings['miner'] = 5_000; // a large ore economy to be taxed
      s.buildings['reactor'] = 30; // already well past the threshold
    });
    expect(computeRates(state, index).heatPenalty).toBeLessThan(1);

    const one = marginalRates(state, index, 'reactor', 1);
    // The reactor makes ore itself, so its own 10/s is in here too; the swarm
    // it slows is far larger, and the honest net is negative.
    expect(one.net.get('ore')!.isPositive).toBe(false);
    expect(one.heat).toBeGreaterThan(0);
  });

  it('reports storage for a depot, on the same geometric curve as its cost', () => {
    const { state, index } = world((s) => { s.buildings['silo'] = 3; });
    // 3 silos hold 500*(1.1^3-1)/0.1 = 1,655; 5 hold 500*(1.1^5-1)/0.1 =
    // 3,052.55. The marginal two units add the difference, not a flat 2*500.
    expect(marginalRates(state, index, 'silo', 2).caps.get('ore')!.toNumber()).toBeCloseTo(
      1_397.55,
      2,
    );
  });

  /**
   * The reason this is a difference of totals rather than a multiplication.
   * Past the threshold a new building taxes every building already standing, so
   * what it adds is strictly less than what it produces — and a player told the
   * larger number would rightly call the smaller one a bug.
   */
  it('subtracts the thermal load a purchase imposes on everything else', () => {
    const cool = world((s) => { s.buildings['reactor'] = 1; });
    const hot = world((s) => { s.buildings['reactor'] = 20; });

    expect(computeRates(cool.state, cool.index).heatPenalty).toBe(1);
    expect(computeRates(hot.state, hot.index).heatPenalty).toBeLessThan(1);

    const coolGain = marginalRates(cool.state, cool.index, 'reactor', 1).output.get('ore')!;
    const hotGain = marginalRates(hot.state, hot.index, 'reactor', 1).output.get('ore')!;

    expect(coolGain.toNumber()).toBeCloseTo(10, 9);
    // Still worth buying, but visibly less than the 10/s the unit itself makes.
    expect(hotGain.toNumber()).toBeLessThan(10);
    expect(hotGain.isPositive).toBe(true);
    expect(hot.state.buildings['reactor']! * 400).toBeGreaterThan(HEAT_THRESHOLD);
  });

  it('leaves the state it was asked about untouched', () => {
    const { state, index } = world((s) => { s.buildings['miner'] = 4; });
    const before = snapshot(state);
    marginalRates(state, index, 'miner', 25);
    expect(snapshot(state)).toBe(before);
    expect(state.buildings['miner']).toBe(4);
  });

  it('is memoised per building and quantity, and cleared on invalidate', () => {
    const { state, index, cache } = world((s) => { s.buildings['miner'] = 10; });
    expect(cache.marginal(state, 'miner', 1)).toBe(cache.marginal(state, 'miner', 1));
    expect(cache.marginal(state, 'miner', 5)).not.toBe(cache.marginal(state, 'miner', 1));

    const stale = cache.marginal(state, 'miner', 1);
    state.upgrades = ['mult'];
    cache.invalidate();
    expect(cache.marginal(state, 'miner', 1)).not.toBe(stale);
    expect(cache.marginal(state, 'miner', 1).output.get('ore')!.toNumber()).toBeCloseTo(3, 9);
    expect(index).toBe(FIXTURE_INDEX);
  });
});
