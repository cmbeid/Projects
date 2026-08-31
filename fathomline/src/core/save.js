import { SAVE_KEY, SAVE_VERSION } from '../config.js';
import { randomSeed } from './rng.js';
import { STARTING_REGION } from '../data/regions.js';

export function defaultState() {
  return {
    version: SAVE_VERSION,
    seed: randomSeed(),
    coin: 0,
    pearls: 0,
    depthMarks: 0,
    currentRegion: STARTING_REGION,
    gear: { rod: 1, reel: 1, line: 1, hook: 1, boat: 1 },
    stats: {
      castDistance: 0, lureSpeed: 0, tensionControl: 0, luck: 0, coolerCapacity: 0,
      marketPrice: 0, baitEfficiency: 0, offlineCap: 0, crewSpeed: 0, crewYield: 0,
    },
    passives: [],
    bait: {},
    lures: [],
    crew: [], // [{ id, level, assignedRegion, lastCollectedAt }]
    cooler: [], // [{ speciesId, kg, rarity, sizeClass, variant, value, caughtAt }]
    codex: {}, // speciesId -> { discovered, variants: {}, bestKg }
    records: {},
    story: { act: 1, flags: [], choice: null },
    objectives: {},
    endless: {},
    settings: { muted: false, reducedMotion: false, assistMode: false },
    lastSeenAt: Date.now(),
  };
}

// Each entry migrates a save FROM its key version to key+1. Keyed on the
// version the save currently has, so content patches never wipe saves.
const migrations = {
  // 1: (state) => { ...state, version: 2, someNewField: default },
};

function migrate(state) {
  let s = state;
  while (migrations[s.version]) {
    s = migrations[s.version](s);
  }
  s.version = SAVE_VERSION;
  return s;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return migrate({ ...defaultState(), ...parsed });
  } catch {
    return defaultState();
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, lastSeenAt: Date.now() }));
  } catch {
    // localStorage unavailable (private mode, quota) — fail silently, next
    // successful save will catch up.
  }
}

export function exportState(state) {
  return JSON.stringify(state);
}

export function importState(json) {
  const parsed = JSON.parse(json);
  return migrate({ ...defaultState(), ...parsed });
}

export function wipeState() {
  localStorage.removeItem(SAVE_KEY);
}
