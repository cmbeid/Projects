import { describe, expect, it } from 'vitest';
import { defaultState } from '../src/core/save.js';
import { resolveOfflineProgress } from '../src/core/offline.js';
import { effectiveStats } from '../src/systems/stats.js';
import { CREW } from '../src/data/crew.js';
import { fishForRegion } from '../src/data/fish.js';
import { rarityWeights } from '../src/systems/fishing.js';
import { catchValue, sizeClassForPercentile } from '../src/systems/economy.js';
import { averageModifier } from '../src/systems/weather.js';

function stateWithCrew() {
  const state = defaultState();
  state.seed = 424242;
  state.crew = [
    { id: 'deckhand_pell', level: 1, region: 'marrow_cove', timerMs: 0 },
    { id: 'netter_maura', level: 1, region: 'marrow_cove', timerMs: 0 },
  ];
  return state;
}

// Independent numerical-integration cross-check of the closed-form resolver:
// walks the window in fine steps and accumulates fractional "catch progress"
// per crew member using the same weather modifiers, converging to the same
// integral the analytic per-slot sum computes. If the closed-form value
// diverged from this (e.g. because it silently ignored weather and used a
// flat multiplier), the two would disagree well outside float tolerance.
function simulateExpectedCoin(state, fromMs, toMs, stepMs = 15_000) {
  const stats = effectiveStats(state);
  let coin = 0;
  for (const hired of state.crew) {
    const def = CREW.find((c) => c.id === hired.id);
    const intervalMs = (def.baseIntervalMs * def.levelIntervalMult(hired.level)) / stats.crewSpeedMult;
    let progress = 0;
    for (let t = fromMs; t < toMs; t += stepMs) {
      const dt = Math.min(stepMs, toMs - t);
      const biteMult = averageModifier(state.seed, t, t + dt, 'bite') * def.rarityBias.bite;
      progress += (dt / intervalMs) * biteMult;
      while (progress >= 1) {
        progress -= 1;
        const valueMult = averageModifier(state.seed, t, t + dt, 'value');
        const rarityMult = averageModifier(state.seed, t, t + dt, 'rarity') * def.rarityBias.rarity;
        const pool = fishForRegion(hired.region);
        const weights = rarityWeights(rarityMult);
        const countByRarity = {};
        for (const f of pool) countByRarity[f.rarity] = (countByRarity[f.rarity] ?? 0) + 1;
        const totalWeight = Object.entries(countByRarity).reduce((sum, [r]) => sum + (weights[r] ?? 0), 0);
        let expected = 0;
        for (const f of pool) {
          const p = (weights[f.rarity] ?? 0) / totalWeight / countByRarity[f.rarity];
          expected += p * catchValue({ fish: f, kg: f.avgKg, sizeClass: sizeClassForPercentile(0.5), marketMult: stats.marketPriceMult, weatherValueMult: valueMult });
        }
        coin += expected * stats.crewYieldMult * def.levelYieldMult(hired.level);
      }
    }
  }
  return coin;
}

describe('resolveOfflineProgress', () => {
  it('matches the numerical-integration cross-check within tolerance over 4h', () => {
    const state = stateWithCrew();
    const now = 10_000_000_000;
    state.lastSeenAt = now - 4 * 3600 * 1000;
    const expected = simulateExpectedCoin(state, state.lastSeenAt, now);

    const summary = resolveOfflineProgress(state, now);

    expect(summary.coinEarned).toBeGreaterThan(0);
    expect(Math.abs(summary.coinEarned - expected) / expected).toBeLessThan(0.05);
  });

  it('resolves a 12-hour absence in well under 50ms', () => {
    const state = stateWithCrew();
    const now = 20_000_000_000;
    state.lastSeenAt = now - 12 * 3600 * 1000;
    const start = performance.now();
    resolveOfflineProgress(state, now);
    expect(performance.now() - start).toBeLessThan(50);
  });

  it('truncates gains at the offline cap', () => {
    const state = stateWithCrew();
    const now = 30_000_000_000;
    const cap = effectiveStats(state).offlineCapHours;
    state.lastSeenAt = now - (cap + 10) * 3600 * 1000;
    const summary = resolveOfflineProgress(state, now);
    expect(summary.elapsedMs).toBe(cap * 3600 * 1000);
    expect(summary.cappedMs).toBeGreaterThan(0);
  });

  it('two windows with different weather composition yield different rates', () => {
    const stateA = stateWithCrew();
    const nowA = 1_000_000;
    stateA.lastSeenAt = nowA - 3 * 3600 * 1000;
    const summaryA = resolveOfflineProgress(stateA, nowA);

    const stateB = stateWithCrew();
    const nowB = 5_000_000_000; // a much later, differently-seeded-in-time window
    stateB.lastSeenAt = nowB - 3 * 3600 * 1000;
    const summaryB = resolveOfflineProgress(stateB, nowB);

    expect(summaryA.coinEarned).not.toBe(summaryB.coinEarned);
  });

  it('returns no yield when no crew is assigned', () => {
    const state = defaultState();
    const now = 1_000_000;
    state.lastSeenAt = now - 3600 * 1000;
    const summary = resolveOfflineProgress(state, now);
    expect(summary.coinEarned).toBe(0);
  });
});
