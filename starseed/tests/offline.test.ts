import { describe, expect, it } from 'vitest';
import { catchUp, OFFLINE_CAP_SECONDS } from '../src/game/offline';
import { world } from './fixture';

const START_MS = 1_700_000_000_000;

describe('offline catch-up', () => {
  it('credits nothing and resyncs the clock for a gap under the skip threshold', () => {
    const w = world((s) => { s.buildings['miner'] = 1; s.lastSeen = START_MS; });
    const summary = catchUp(w.state, w.index, w.cache, START_MS + 1_000);

    expect(summary).toBeNull();
    expect(w.state.resources.ore.isZero).toBe(true);
    expect(w.state.lastSeen).toBe(START_MS + 1_000);
  });

  it('credits nothing for a clock that moved backwards, and resyncs it', () => {
    const w = world((s) => { s.buildings['miner'] = 1; s.lastSeen = START_MS; });
    const summary = catchUp(w.state, w.index, w.cache, START_MS - 10_000);

    expect(summary).toBeNull();
    expect(w.state.resources.ore.isZero).toBe(true);
    expect(w.state.lastSeen).toBe(START_MS - 10_000);
  });

  it('credits the full gap when it is under the cap', () => {
    const w = world((s) => { s.buildings['miner'] = 1; s.lastSeen = START_MS; });
    const summary = catchUp(w.state, w.index, w.cache, START_MS + 60_000);

    expect(summary).not.toBeNull();
    expect(summary!.capped).toBe(false);
    expect(summary!.awaySeconds).toBeCloseTo(60, 6);
    expect(summary!.creditedSeconds).toBeCloseTo(60, 6);
    expect(w.state.resources.ore.toNumber()).toBeCloseTo(60, 6);
    expect(summary!.produced.get('ore')?.toNumber()).toBeCloseTo(60, 6);
  });

  it('caps an absurd absence and says so', () => {
    const w = world((s) => { s.buildings['miner'] = 1; s.lastSeen = START_MS; });
    const threeDaysMs = 3 * 86_400 * 1_000;
    const summary = catchUp(w.state, w.index, w.cache, START_MS + threeDaysMs);

    expect(summary).not.toBeNull();
    expect(summary!.capped).toBe(true);
    expect(summary!.awaySeconds).toBeCloseTo(3 * 86_400, 3);
    expect(summary!.creditedSeconds).toBe(OFFLINE_CAP_SECONDS);
    // The fixture miner makes 1 ore/s with no storage: this stays under the cap.
    expect(w.state.resources.ore.toNumber()).toBeCloseTo(OFFLINE_CAP_SECONDS, 3);
    expect(w.state.lastSeen).toBe(START_MS + threeDaysMs);
  });

  it('reports resources that hit their storage ceiling while away', () => {
    const w = world((s) => {
      s.buildings['miner'] = 1_000_000;
      s.lastSeen = START_MS;
    });
    const summary = catchUp(w.state, w.index, w.cache, START_MS + 10_000);

    expect(summary?.hitStorage).toContain('ore');
  });

  it('reports milestones and log entries crossed while away', () => {
    const w = world((s) => { s.buildings['miner'] = 1; s.lastSeen = START_MS; });
    const summary = catchUp(w.state, w.index, w.cache, START_MS + 15_000);

    expect(summary?.milestonesCrossed).toContain('ten-ore');
    expect(summary?.logUnlocked).toContain('ten-ore-log');
    expect(w.state.milestones).toContain('ten-ore');
    expect(w.state.log).toContain('ten-ore-log');
  });

  it('runs the same whether the cap is hit in one chunk or many, matching live play', () => {
    const bulk = world((s) => { s.buildings['miner'] = 1; s.lastSeen = START_MS; });
    const step = world((s) => { s.buildings['miner'] = 1; s.lastSeen = START_MS; });

    catchUp(bulk.state, bulk.index, bulk.cache, START_MS + OFFLINE_CAP_SECONDS * 1000);
    // Same total time, delivered as several separate "still away" checks.
    let clock = START_MS;
    for (let i = 0; i < 4; i += 1) {
      clock += (OFFLINE_CAP_SECONDS / 4) * 1000;
      catchUp(step.state, step.index, step.cache, clock);
    }

    expect(bulk.state.resources.ore.toString()).toBe(step.state.resources.ore.toString());
  });
});
