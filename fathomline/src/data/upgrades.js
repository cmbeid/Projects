import { GEAR_BASE_COST, GEAR_COST_GROWTH, STAT_BASE_COST, STAT_COST_GROWTH } from '../config.js';

function gearCost(category, tier) {
  return Math.round(GEAR_BASE_COST[category] * Math.pow(GEAR_COST_GROWTH, tier - 1));
}
function statCost(tier) {
  return Math.round(STAT_BASE_COST * Math.pow(STAT_COST_GROWTH, tier - 1));
}

// Full 8/6/6/6/6-tier gear ladder (Phase 3). Rank 1 of each line is the free
// starting item, so it costs nothing and is already owned in a fresh save.
// `desc` is shown in the Shop panel next to each purchase.
export const GEAR = {
  rod: [
    { tier: 1, name: 'Bamboo Switch', cost: 0, desc: 'Fills reel progress at the base rate.', effect: { progressFillMult: 1.0, castDistanceMult: 1.0 } },
    { tier: 2, name: 'Driftwood Rod', cost: gearCost('rod', 2), desc: 'Reel progress fills faster; casts land a little farther.', effect: { progressFillMult: 1.15, castDistanceMult: 1.1 } },
    { tier: 3, name: 'Fiberglass', cost: gearCost('rod', 3), desc: 'Reel progress fills faster still; better cast distance.', effect: { progressFillMult: 1.3, castDistanceMult: 1.2 } },
    { tier: 4, name: 'Carbon Spire', cost: gearCost('rod', 4), desc: 'A noticeable jump in reel-progress fill rate.', effect: { progressFillMult: 1.45, castDistanceMult: 1.3 } },
    { tier: 5, name: 'Whalebone', cost: gearCost('rod', 5), desc: 'Fast, forgiving reeling on most fish.', effect: { progressFillMult: 1.6, castDistanceMult: 1.4 } },
    { tier: 6, name: 'Stormglass', cost: gearCost('rod', 6), desc: 'Handles aggressive fish AI with room to spare.', effect: { progressFillMult: 1.75, castDistanceMult: 1.5 } },
    { tier: 7, name: 'Abyssal Spine', cost: gearCost('rod', 7), desc: 'Near the top of the line — very fast progress fill.', effect: { progressFillMult: 1.9, castDistanceMult: 1.6 } },
    { tier: 8, name: 'Tideheart Rod', cost: gearCost('rod', 8), desc: 'The best rod money can buy: maximum progress fill and reach.', effect: { progressFillMult: 2.1, castDistanceMult: 1.75 } },
  ],
  reel: [
    { tier: 1, name: 'Handcrank', cost: 0, desc: 'Base catch-zone size and reel speed.', effect: { zoneSizeMult: 1.0, reelSpeedMult: 1.0 } },
    { tier: 2, name: 'Spinning', cost: gearCost('reel', 2), desc: 'A larger catch zone makes the reel minigame more forgiving.', effect: { zoneSizeMult: 1.15, reelSpeedMult: 1.1 } },
    { tier: 3, name: 'Baitcaster', cost: gearCost('reel', 3), desc: 'Bigger catch zone, faster zone response to holding/releasing.', effect: { zoneSizeMult: 1.3, reelSpeedMult: 1.2 } },
    { tier: 4, name: 'Geared Drum', cost: gearCost('reel', 4), desc: 'Comfortably wide catch zone for most species.', effect: { zoneSizeMult: 1.45, reelSpeedMult: 1.3 } },
    { tier: 5, name: 'Deepwinch', cost: gearCost('reel', 5), desc: 'Wide catch zone, snappy zone control.', effect: { zoneSizeMult: 1.6, reelSpeedMult: 1.4 } },
    { tier: 6, name: 'Leviathan Winch', cost: gearCost('reel', 6), desc: 'The largest catch zone and fastest zone control available.', effect: { zoneSizeMult: 1.8, reelSpeedMult: 1.55 } },
  ],
  line: [
    { tier: 1, name: 'Cotton', cost: 0, desc: 'Snaps under 3kg of fighting fish.', effect: { tensionMaxMult: 1.0, maxLandableKg: 3 } },
    { tier: 2, name: 'Braided', cost: gearCost('line', 2), desc: 'Higher max tension before snapping; holds up to 6kg.', effect: { tensionMaxMult: 1.2, maxLandableKg: 6 } },
    { tier: 3, name: 'Monofilament', cost: gearCost('line', 3), desc: 'More tension headroom; holds up to 12kg.', effect: { tensionMaxMult: 1.4, maxLandableKg: 12 } },
    { tier: 4, name: 'Steel Weave', cost: gearCost('line', 4), desc: 'Sturdy enough for most Region 3-4 fish; holds up to 20kg.', effect: { tensionMaxMult: 1.6, maxLandableKg: 20 } },
    { tier: 5, name: 'Kelpsilk', cost: gearCost('line', 5), desc: 'Very high tension tolerance; holds up to 32kg.', effect: { tensionMaxMult: 1.8, maxLandableKg: 32 } },
    { tier: 6, name: 'Fathomcord', cost: gearCost('line', 6), desc: 'Maximum tension tolerance; holds anything up to 50kg.', effect: { tensionMaxMult: 2.0, maxLandableKg: 50 } },
  ],
  hook: [
    { tier: 1, name: 'Bent Pin', cost: 0, desc: 'No rarity bias, no junk reduction.', effect: { rarityBiasMult: 1.0, junkReduction: 0 } },
    { tier: 2, name: 'Barbed', cost: gearCost('hook', 2), desc: 'Slightly better odds at Uncommon+ fish; a little less junk.', effect: { rarityBiasMult: 1.15, junkReduction: 0.04 } },
    { tier: 3, name: 'Treble', cost: gearCost('hook', 3), desc: 'Better rarity odds and junk reduction.', effect: { rarityBiasMult: 1.3, junkReduction: 0.08 } },
    { tier: 4, name: 'Silver', cost: gearCost('hook', 4), desc: 'Meaningfully more rare/epic catches, noticeably less junk.', effect: { rarityBiasMult: 1.45, junkReduction: 0.11 } },
    { tier: 5, name: 'Bone', cost: gearCost('hook', 5), desc: 'Strong rarity bias toward the rare tail.', effect: { rarityBiasMult: 1.6, junkReduction: 0.14 } },
    { tier: 6, name: 'Starhook', cost: gearCost('hook', 6), desc: 'The best rarity odds and lowest junk rate available.', effect: { rarityBiasMult: 1.8, junkReduction: 0.18 } },
  ],
  boat: [
    { tier: 1, name: 'Rowboat', cost: 0, desc: 'Marrow Cove only. 1 crew slot, 4h offline cap.', effect: { crewSlots: 1, offlineCapHours: 4 }, unlocksThrough: 'marrow_cove' },
    { tier: 2, name: 'Skiff', cost: gearCost('boat', 2), desc: 'Opens Reedwater Marsh & Coral Shelf. 2 crew slots, 6h offline cap.', effect: { crewSlots: 2, offlineCapHours: 6 }, unlocksThrough: 'coral_shelf' },
    { tier: 3, name: 'Trawler', cost: gearCost('boat', 3), desc: 'Opens Kelp Cathedral. 3 crew slots, 8h offline cap.', effect: { crewSlots: 3, offlineCapHours: 8 }, unlocksThrough: 'kelp_cathedral' },
    { tier: 4, name: 'Cutter', cost: gearCost('boat', 4), desc: 'Opens the Wreck of the Isolde & Frostcurrent. 4 crew slots, 10h offline cap.', effect: { crewSlots: 4, offlineCapHours: 10 }, unlocksThrough: 'frostcurrent' },
    { tier: 5, name: 'Icebreaker', cost: gearCost('boat', 5), desc: 'Opens the Ember Rift. 5 crew slots, 12h offline cap.', effect: { crewSlots: 5, offlineCapHours: 12 }, unlocksThrough: 'ember_rift' },
    { tier: 6, name: 'Deepdiver', cost: gearCost('boat', 6), desc: 'Opens the Fathom Trench. 6 crew slots, 16h offline cap.', effect: { crewSlots: 6, offlineCapHours: 16 }, unlocksThrough: 'fathom_trench' },
  ],
};

// Full 10-track, 50-tier stat ladder (Phase 3 adds the last 6 tracks).
const STAT_TRACKS = {
  castDistance: { name: 'Cast Distance', tiers: 5, desc: 'Casts land farther, slightly widening the fish pool at range.', effectPerTier: { castDistanceMult: 0.05 } },
  lureSpeed: { name: 'Lure Speed', tiers: 5, desc: 'Fish bite faster — shorter wait between casting and a bite.', effectPerTier: { biteRateMult: 0.06 } },
  tensionControl: { name: 'Tension Control', tiers: 5, desc: 'Tension bleeds off faster while not holding — safer reeling.', effectPerTier: { tensionBleedMult: 0.08 } },
  luck: { name: 'Luck', tiers: 5, desc: 'Better odds at Uncommon+ fish on every cast.', effectPerTier: { rarityBiasMult: 0.04 } },
  coolerCapacity: { name: 'Cooler Capacity', tiers: 6, desc: 'Holds more fish before you have to sell or discard.', effectPerTier: { coolerCapacityFlat: 4 } },
  marketPrice: { name: 'Market Price', tiers: 5, desc: 'Every sale is worth more coin.', effectPerTier: { marketPriceMult: 0.08 } },
  baitEfficiency: { name: 'Bait Efficiency', tiers: 4, desc: 'Bait lasts longer before running out (Phase 5).', effectPerTier: { baitEfficiencyMult: 0.1 } },
  offlineCap: { name: 'Offline Cap', tiers: 5, desc: 'Idle crew keep earning for longer before you have to check back in.', effectPerTier: { offlineCapHoursFlat: 1 } },
  crewSpeed: { name: 'Crew Speed', tiers: 5, desc: 'Idle crew catch fish more often.', effectPerTier: { crewSpeedMult: 0.08 } },
  crewYield: { name: 'Crew Yield', tiers: 5, desc: "Idle crew's catches are worth more coin.", effectPerTier: { crewYieldMult: 0.08 } },
};

export const STATS = Object.fromEntries(
  Object.entries(STAT_TRACKS).map(([id, track]) => [
    id,
    {
      id,
      name: track.name,
      desc: track.desc,
      maxTier: track.tiers,
      tierCost: (tier) => statCost(tier),
      effectPerTier: track.effectPerTier,
    },
  ])
);

export function nextGearTier(category, currentTier) {
  return GEAR[category]?.find((g) => g.tier === currentTier + 1) ?? null;
}
