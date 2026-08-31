import { mulberry32, weightedPick } from '../core/rng.js';

// Weather + day/night cycle. Deterministic and slot-based (not a per-tick
// simulation) so both live play *and* the closed-form offline resolver in
// core/offline.js can ask "what was the average modifier over this whole
// elapsed window?" in O(slots-in-window) instead of O(elapsed-ms).
export const SLOT_MS = 10 * 60 * 1000; // 10 real minutes per weather slot
export const SLOTS_PER_DAY = 8; // 8 slots => 80-minute in-game day/night cycle
export const DAY_SLOTS = 4; // first half of the cycle is day, second half night

export const WEATHER_STATES = {
  clear: { weight: 50, bite: 1.0, value: 1.0, rarity: 1.0 },
  overcast: { weight: 20, bite: 1.05, value: 1.0, rarity: 1.05 },
  rain: { weight: 15, bite: 1.15, value: 1.0, rarity: 1.1 },
  fog: { weight: 10, bite: 0.9, value: 1.1, rarity: 1.15 },
  storm: { weight: 5, bite: 0.8, value: 1.25, rarity: 1.3 },
};

const DAY_NIGHT = {
  day: { bite: 1.0, value: 1.0, rarity: 1.0 },
  night: { bite: 1.1, value: 1.0, rarity: 1.2 },
};

export function slotIndexAt(ms) {
  return Math.floor(ms / SLOT_MS);
}

export function timeOfDayForSlot(slotIndex) {
  const phase = ((slotIndex % SLOTS_PER_DAY) + SLOTS_PER_DAY) % SLOTS_PER_DAY;
  return phase < DAY_SLOTS ? 'day' : 'night';
}

// Deterministic per-slot weather pick: a pure function of (seed, slotIndex),
// not a sequential RNG stream — any slot can be resolved independently in O(1).
export function weatherStateForSlot(seed, slotIndex) {
  const rng = mulberry32((seed ^ Math.imul(slotIndex + 1, 0x9e3779b9)) >>> 0);
  return weightedPick(WEATHER_STATES, rng);
}

export function modifierForSlot(seed, slotIndex, kind) {
  const weatherId = weatherStateForSlot(seed, slotIndex);
  const timeOfDay = timeOfDayForSlot(slotIndex);
  return WEATHER_STATES[weatherId][kind] * DAY_NIGHT[timeOfDay][kind];
}

export function currentConditions(seed, nowMs) {
  const slot = slotIndexAt(nowMs);
  return { weatherId: weatherStateForSlot(seed, slot), timeOfDay: timeOfDayForSlot(slot) };
}

// Time-weighted average modifier of `kind` ('bite' | 'value' | 'rarity')
// across [fromMs, toMs). Iterates only the slots the window touches, so a
// 12-hour window is ~72 slot lookups regardless of how granular a tick is.
export function averageModifier(seed, fromMs, toMs, kind) {
  if (toMs <= fromMs) return 1;
  const firstSlot = slotIndexAt(fromMs);
  const lastSlot = slotIndexAt(toMs - 1);
  const totalMs = toMs - fromMs;
  let weightedSum = 0;
  for (let slot = firstSlot; slot <= lastSlot; slot++) {
    const slotStart = slot * SLOT_MS;
    const slotEnd = slotStart + SLOT_MS;
    const overlapMs = Math.min(toMs, slotEnd) - Math.max(fromMs, slotStart);
    if (overlapMs <= 0) continue;
    weightedSum += modifierForSlot(seed, slot, kind) * overlapMs;
  }
  return weightedSum / totalMs;
}
