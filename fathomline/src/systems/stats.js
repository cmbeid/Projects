import { GEAR, STATS } from '../data/upgrades.js';
import { BASE_COOLER_CAPACITY, BASE_OFFLINE_CAP_HOURS } from '../config.js';

// Every other system reads gameplay stats only through this — the seam that
// keeps gear ranks + stat tiers + passives + crew perks + weather from
// turning into scattered spaghetti across 140+ upgrades.
export function effectiveStats(state) {
  const stats = {
    progressFillMult: 1,
    castDistanceMult: 1,
    zoneSizeMult: 1,
    reelSpeedMult: 1,
    tensionMaxMult: 1,
    maxLandableKg: 3,
    rarityBiasMult: 1,
    junkReduction: 0,
    crewSlots: 1,
    offlineCapHours: BASE_OFFLINE_CAP_HOURS,
    biteRateMult: 1,
    tensionBleedMult: 1,
    coolerCapacity: BASE_COOLER_CAPACITY,
    crewSpeedMult: 1,
    crewYieldMult: 1,
    marketPriceMult: 1,
  };

  for (const [category, tier] of Object.entries(state.gear)) {
    const rank = GEAR[category]?.find((g) => g.tier === tier);
    if (!rank) continue;
    for (const [key, value] of Object.entries(rank.effect)) {
      stats[key] = key.endsWith('Mult') ? (stats[key] ?? 1) * value : value;
    }
  }

  for (const [statId, tier] of Object.entries(state.stats)) {
    const track = STATS[statId];
    if (!track || !tier) continue;
    for (const [key, perTier] of Object.entries(track.effectPerTier)) {
      stats[key] = (stats[key] ?? (key.endsWith('Mult') ? 1 : 0)) + perTier * tier;
    }
  }

  // Flat-bonus tracks (Cooler Capacity, Offline Cap) accumulate into a
  // `*Flat` key above so the generic loop above didn't need a special case;
  // fold them into the base stat here.
  stats.coolerCapacity += stats.coolerCapacityFlat ?? 0;
  stats.offlineCapHours += stats.offlineCapHoursFlat ?? 0;

  return stats;
}
