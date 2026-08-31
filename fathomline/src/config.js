export const GAME_TITLE = 'Fathomline';
export const SAVE_KEY = 'fathomline.save.v1';
export const SAVE_VERSION = 1;
export const AUTOSAVE_INTERVAL_MS = 15_000;

export const TICK_MS = 1000 / 30;

// -- Casting / biting --------------------------------------------------
export const BASE_BITE_TIME_MS = 4000;
export const BASE_HOOK_WINDOW_MS = 900;

// -- Reel minigame -------------------------------------------------------
export const MINIGAME = {
  baseZoneSize: 0.28, // fraction of track height
  baseTensionMax: 100,
  baseTensionHoldGain: 34, // per second while holding
  baseTensionStruggleGain: 18, // per second while fish AI is aggressive
  baseTensionBleed: 26, // per second while not holding
  baseFillRate: 42, // % progress per second while marker is inside zone
  baseDrainRate: 22, // % progress per second while marker is outside zone
  assistZoneBonus: 0.4,
  assistTensionCut: 0.4,
};

// -- Economy --------------------------------------------------------------
export const WEIGHT_VALUE_EXPONENT = 1.3;
export const RARITY_VALUE_MULT = { C: 1, U: 1.8, R: 3.5, E: 7, L: 16, M: 40 };
export const SIZE_CLASS_VALUE_MULT = { Runt: 0.6, Standard: 1, Large: 1.4, Trophy: 2.2, Record: 4 };

export const SIZE_CLASS_THRESHOLDS = [
  { max: 0.15, id: 'Runt' },
  { max: 0.7, id: 'Standard' },
  { max: 0.92, id: 'Large' },
  { max: 0.99, id: 'Trophy' },
  { max: 1, id: 'Record' },
];

export const BASE_RARITY_WEIGHTS = { C: 60, U: 25, R: 10, E: 4, L: 0.9, M: 0.1 };

// -- Cooler / offline -------------------------------------------------------
export const BASE_COOLER_CAPACITY = 12;
export const BASE_OFFLINE_CAP_HOURS = 4;

// -- Gear cost curves -------------------------------------------------------
// Rebalanced after early playtesting: the original costs let a player buy
// every Phase 1/2 upgrade in a few minutes of real play. Base costs roughly
// tripled and growth nudged up so progression has room to breathe now that
// Phase 3 adds gear tiers 4-8 and boat tiers 2-6 to chase.
export const GEAR_BASE_COST = { rod: 110, reel: 170, line: 150, hook: 140, boat: 900 };
export const GEAR_COST_GROWTH = 3.4;
export const STAT_BASE_COST = 60;
export const STAT_COST_GROWTH = 1.62;

// -- Crew -------------------------------------------------------------------
export const CREW_BASE_INTERVAL_MS = 25_000;
