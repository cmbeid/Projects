import { describe, expect, it } from 'vitest';
import { Decimal, dec } from '../src/num/decimal';
import { advance, tap, TICK_SECONDS, MAX_STEPS_PER_CALL } from '../src/game/engine';
import { computeRates } from '../src/game/rates';
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

  it('counts depot capacity into the cap', () => {
    const w = world((s) => { s.buildings['silo'] = 3; });
    const rates = computeRates(w.state, w.index);
    expect(rates.caps.get('ore')?.toNumber()).toBeCloseTo(1_000_000 + 3 * 500, 6);
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
  expect(FIXTURE_INDEX.content.buildings.length).toBe(3);
});
