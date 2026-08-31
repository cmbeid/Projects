import { GEAR, STATS, nextGearTier } from '../data/upgrades.js';

export function purchaseGear(state, category) {
  const currentTier = state.gear[category] ?? 1;
  const next = nextGearTier(category, currentTier);
  if (!next) return false;
  if (state.coin < next.cost) return false;
  state.coin -= next.cost;
  state.gear[category] = next.tier;
  return true;
}

export function purchaseStatTier(state, statId) {
  const track = STATS[statId];
  if (!track) return false;
  const currentTier = state.stats[statId] ?? 0;
  if (currentTier >= track.maxTier) return false;
  const cost = track.tierCost(currentTier + 1);
  if (state.coin < cost) return false;
  state.coin -= cost;
  state.stats[statId] = currentTier + 1;
  return true;
}

export function gearNextCost(state, category) {
  const next = nextGearTier(category, state.gear[category] ?? 1);
  return next ? next.cost : null;
}

export function statNextCost(state, statId) {
  const track = STATS[statId];
  const currentTier = state.stats[statId] ?? 0;
  if (!track || currentTier >= track.maxTier) return null;
  return track.tierCost(currentTier + 1);
}

export { GEAR, STATS, nextGearTier };
