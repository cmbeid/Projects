import { BASE_RARITY_WEIGHTS, BASE_BITE_TIME_MS } from '../config.js';
import { weightedPick } from '../core/rng.js';
import { fishForRegion } from '../data/fish.js';
import { rollWeight } from './economy.js';

// Rarity weights are pushed toward rarer tiers by Hook rank / Luck / weather;
// `rarityBiasMult` > 1 shifts weight from Common toward the rare tail.
export function rarityWeights(rarityBiasMult = 1) {
  const shiftableTiers = ['U', 'R', 'E', 'L', 'M'];
  const weights = { ...BASE_RARITY_WEIGHTS };
  for (const tier of shiftableTiers) {
    weights[tier] = weights[tier] * rarityBiasMult;
  }
  return weights;
}

export function eligibleFish(regionId, { timeOfDay, weatherId } = {}) {
  return fishForRegion(regionId).filter((f) => {
    if (f.conditions?.time && f.conditions.time !== timeOfDay) return false;
    if (f.conditions?.weather && weatherId && !f.conditions.weather.includes(weatherId)) return false;
    return true;
  });
}

// Rolls a species for a cast/idle catch in `regionId`. Falls back one rarity
// tier down (then to Common) if the rolled tier has no eligible species right
// now (e.g. a night-only fish rolled during the day, or a rain-only fish
// rolled under clear skies), so a bite never comes back empty-handed.
export function rollSpeciesForRegion(regionId, { rarityBiasMult = 1, timeOfDay = 'day', weatherId } = {}, rng) {
  const pool = eligibleFish(regionId, { timeOfDay, weatherId });
  const rarityOrder = ['M', 'L', 'E', 'R', 'U', 'C'];
  let rarity = weightedPick(rarityWeights(rarityBiasMult), rng);
  let candidates = pool.filter((f) => f.rarity === rarity);
  while (candidates.length === 0) {
    const idx = rarityOrder.indexOf(rarity);
    rarity = rarityOrder[Math.min(idx + 1, rarityOrder.length - 1)];
    candidates = pool.filter((f) => f.rarity === rarity);
    if (rarity === 'C' && candidates.length === 0) candidates = pool; // last resort
  }
  return candidates[Math.floor(rng() * candidates.length)];
}

export function biteTimeMs(stats) {
  return BASE_BITE_TIME_MS / (stats.biteRateMult ?? 1);
}

// Resolves a full catch (species + weight/size-class) — used by both the
// live cast flow and the offline/idle resolver so they share one formula.
export function resolveCatch(regionId, stats, conditions, rng) {
  const fish = rollSpeciesForRegion(regionId, { rarityBiasMult: stats.rarityBiasMult, timeOfDay: conditions.timeOfDay, weatherId: conditions.weatherId }, rng);
  const { kg, sizeClass } = rollWeight(fish, rng);
  return { fish, kg, sizeClass };
}
