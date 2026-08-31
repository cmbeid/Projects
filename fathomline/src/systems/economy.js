import {
  RARITY_VALUE_MULT,
  SIZE_CLASS_VALUE_MULT,
  SIZE_CLASS_THRESHOLDS,
  WEIGHT_VALUE_EXPONENT,
} from '../config.js';
import { biasedPercentile } from '../core/rng.js';

export function sizeClassForPercentile(percentile) {
  for (const { max, id } of SIZE_CLASS_THRESHOLDS) {
    if (percentile <= max) return id;
  }
  return 'Record';
}

export function rollWeight(fish, rng) {
  const percentile = biasedPercentile(rng, fish.weightBias ?? 1);
  const kg = fish.minKg + (fish.maxKg - fish.minKg) * percentile;
  return { kg, percentile, sizeClass: sizeClassForPercentile(percentile) };
}

// value = base x (kg/avgKg)^1.3 x rarityMult x sizeClassMult x marketTier x weatherValueMult
// (variantMult/prestigeMult/depthMult join this formula in Phases 4 and 6.)
export function catchValue({ fish, kg, sizeClass, marketMult = 1, weatherValueMult = 1 }) {
  const weightMult = Math.pow(kg / fish.avgKg, WEIGHT_VALUE_EXPONENT);
  const rarityMult = RARITY_VALUE_MULT[fish.rarity] ?? 1;
  const sizeMult = SIZE_CLASS_VALUE_MULT[sizeClass] ?? 1;
  return Math.round(fish.baseValue * weightMult * rarityMult * sizeMult * marketMult * weatherValueMult * 100) / 100;
}

export function addToCooler(state, coolerCapacity, entry) {
  if (state.cooler.length >= coolerCapacity) return false;
  state.cooler.push(entry);
  return true;
}

export function sellEntry(state, index) {
  const [entry] = state.cooler.splice(index, 1);
  if (!entry) return 0;
  state.coin += entry.value;
  return entry.value;
}

export function sellAll(state) {
  const total = state.cooler.reduce((sum, e) => sum + e.value, 0);
  state.coin += total;
  state.cooler.length = 0;
  return total;
}
