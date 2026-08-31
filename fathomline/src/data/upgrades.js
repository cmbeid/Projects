import { GEAR_BASE_COST, GEAR_COST_GROWTH, STAT_BASE_COST, STAT_COST_GROWTH } from '../config.js';

function gearCost(category, tier) {
  return Math.round(GEAR_BASE_COST[category] * Math.pow(GEAR_COST_GROWTH, tier - 1));
}
function statCost(tier) {
  return Math.round(STAT_BASE_COST * Math.pow(STAT_COST_GROWTH, tier - 1));
}

// Gear ranks 1-3 of each line (ranks 4-8 arrive with Phase 3's remaining
// regions/gear ceiling). Rank 1 is the free starting item, so it costs
// nothing and is already owned in a fresh save.
export const GEAR = {
  rod: [
    { tier: 1, name: 'Bamboo Switch', cost: 0, effect: { progressFillMult: 1.0, castDistanceMult: 1.0 } },
    { tier: 2, name: 'Driftwood Rod', cost: gearCost('rod', 2), effect: { progressFillMult: 1.15, castDistanceMult: 1.1 } },
    { tier: 3, name: 'Fiberglass', cost: gearCost('rod', 3), effect: { progressFillMult: 1.3, castDistanceMult: 1.2 } },
  ],
  reel: [
    { tier: 1, name: 'Handcrank', cost: 0, effect: { zoneSizeMult: 1.0, reelSpeedMult: 1.0 } },
    { tier: 2, name: 'Spinning', cost: gearCost('reel', 2), effect: { zoneSizeMult: 1.15, reelSpeedMult: 1.1 } },
    { tier: 3, name: 'Baitcaster', cost: gearCost('reel', 3), effect: { zoneSizeMult: 1.3, reelSpeedMult: 1.2 } },
  ],
  line: [
    { tier: 1, name: 'Cotton', cost: 0, effect: { tensionMaxMult: 1.0, maxLandableKg: 3 } },
    { tier: 2, name: 'Braided', cost: gearCost('line', 2), effect: { tensionMaxMult: 1.2, maxLandableKg: 6 } },
    { tier: 3, name: 'Monofilament', cost: gearCost('line', 3), effect: { tensionMaxMult: 1.4, maxLandableKg: 12 } },
  ],
  hook: [
    { tier: 1, name: 'Bent Pin', cost: 0, effect: { rarityBiasMult: 1.0, junkReduction: 0 } },
    { tier: 2, name: 'Barbed', cost: gearCost('hook', 2), effect: { rarityBiasMult: 1.15, junkReduction: 0.04 } },
    { tier: 3, name: 'Treble', cost: gearCost('hook', 3), effect: { rarityBiasMult: 1.3, junkReduction: 0.08 } },
  ],
  boat: [
    { tier: 1, name: 'Rowboat', cost: 0, effect: { crewSlots: 1, offlineCapHours: 4 } },
  ],
};

// Tiered stat upgrades — first 4 tracks ship in Phase 1, remaining tracks
// (Phase 3) reuse the same shape.
const STAT_TRACKS = {
  castDistance: { name: 'Cast Distance', tiers: 5, effectPerTier: { castDistanceMult: 0.05 } },
  lureSpeed: { name: 'Lure Speed', tiers: 5, effectPerTier: { biteRateMult: 0.06 } },
  tensionControl: { name: 'Tension Control', tiers: 5, effectPerTier: { tensionBleedMult: 0.08 } },
  luck: { name: 'Luck', tiers: 5, effectPerTier: { rarityBiasMult: 0.04 } },
};

export const STATS = Object.fromEntries(
  Object.entries(STAT_TRACKS).map(([id, track]) => [
    id,
    {
      id,
      name: track.name,
      maxTier: track.tiers,
      tierCost: (tier) => statCost(tier),
      effectPerTier: track.effectPerTier,
    },
  ])
);

export function nextGearTier(category, currentTier) {
  return GEAR[category]?.find((g) => g.tier === currentTier + 1) ?? null;
}
