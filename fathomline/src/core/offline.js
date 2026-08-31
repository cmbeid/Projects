import { fishForRegion } from '../data/fish.js';
import { assignedCrew, effectiveIntervalMs } from '../systems/crew.js';
import { catchValue, sizeClassForPercentile } from '../systems/economy.js';
import { rarityWeights } from '../systems/fishing.js';
import { effectiveStats } from '../systems/stats.js';
import { averageModifier } from '../systems/weather.js';

// Closed-form expected value of one catch in `regionId`, given an already
// time-averaged rarity/value modifier for the elapsed window (see below).
// This is an *expectation*, not a per-catch roll: each species' probability
// (its rarity-tier weight, split evenly across species sharing that tier)
// is multiplied by its value at avgKg/Standard size, and summed. That
// average is a fair stand-in for "kg roll converges to avgKg, size-class
// roll converges to its distribution's center" over many idle catches,
// which is exactly the regime offline resolution runs in (dozens-to-
// thousands of catches, not one).
function expectedCatchValueForRegion(regionId, { rarityBiasMult = 1, marketMult = 1, weatherValueMult = 1 } = {}) {
  const pool = fishForRegion(regionId);
  if (pool.length === 0) return 0;
  const weights = rarityWeights(rarityBiasMult);
  const countByRarity = {};
  for (const f of pool) countByRarity[f.rarity] = (countByRarity[f.rarity] ?? 0) + 1;
  const totalWeight = Object.entries(countByRarity).reduce((sum, [rarity]) => sum + (weights[rarity] ?? 0), 0);
  if (totalWeight <= 0) return 0;

  let expected = 0;
  for (const f of pool) {
    const tierWeight = weights[f.rarity] ?? 0;
    const probability = tierWeight / totalWeight / countByRarity[f.rarity];
    const value = catchValue({
      fish: f,
      kg: f.avgKg,
      sizeClass: sizeClassForPercentile(0.5), // 'Standard' — see note above
      marketMult,
      weatherValueMult,
    });
    expected += probability * value;
  }
  return expected;
}

// Resolves everything that happened while the tab/app was closed, in one
// closed-form pass over the (small, fixed) set of weather slots the elapsed
// window touches — never a per-tick or per-catch simulation loop, so a
// 12-hour absence still resolves in well under 50ms.
//
// Reworked for Phase 2: the elapsed window is *not* collapsed to a single
// flat multiplier. Bite rate, catch value, and rarity bias are each
// time-weighted across every weather/day-night slot the window spans via
// `systems/weather.js#averageModifier`, so idle yield reflects the actual
// mix of conditions crew fished through — a 12h absence spanning several
// storms nets a different (and correctly higher-value, lower-count) result
// than 12h of clear skies, without simulating a single tick of it.
export function resolveOfflineProgress(state, nowMs) {
  const stats = effectiveStats(state);
  const offlineCapMs = stats.offlineCapHours * 3600 * 1000;
  const fromMs = state.lastSeenAt ?? nowMs;
  const rawElapsedMs = nowMs - fromMs;
  state.lastSeenAt = nowMs;
  if (rawElapsedMs <= 1000) return null;

  const elapsedMs = Math.min(rawElapsedMs, offlineCapMs);
  const windowFromMs = nowMs - elapsedMs; // most recent `elapsedMs` of the absence

  const crew = assignedCrew(state);
  if (crew.length === 0) {
    return { elapsedMs, cappedMs: rawElapsedMs - elapsedMs, coinEarned: 0, crewBreakdown: [] };
  }

  const crewBreakdown = [];
  let coinEarned = 0;

  for (const { hired, def } of crew) {
    const region = hired.region;
    const biteMult = averageModifier(state.seed, windowFromMs, nowMs, 'bite') * (def.rarityBias.bite ?? 1);
    const valueMult = averageModifier(state.seed, windowFromMs, nowMs, 'value');
    const rarityMult = averageModifier(state.seed, windowFromMs, nowMs, 'rarity') * (stats.rarityBiasMult ?? 1) * (def.rarityBias.rarity ?? 1);

    const intervalMs = effectiveIntervalMs(def, hired.level, stats.crewSpeedMult);
    const catches = (elapsedMs / intervalMs) * biteMult;
    const expectedValue = expectedCatchValueForRegion(region, {
      rarityBiasMult: rarityMult,
      marketMult: stats.marketPriceMult,
      weatherValueMult: valueMult,
    });
    const yieldMult = stats.crewYieldMult * def.levelYieldMult(hired.level);
    const coin = catches * expectedValue * yieldMult;

    coinEarned += coin;
    crewBreakdown.push({ crewId: hired.id, region, catches: Math.round(catches * 10) / 10, coin: Math.round(coin) });
  }

  coinEarned = Math.round(coinEarned);
  state.coin += coinEarned;

  return { elapsedMs, cappedMs: rawElapsedMs - elapsedMs, coinEarned, crewBreakdown };
}
