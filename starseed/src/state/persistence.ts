import { Decimal } from '../num/decimal';
import type { ResourceId } from '../data/types';
import { RESOURCE_IDS } from '../data/types';
import type { ContentIndex } from '../data/indexes';
import type { BuyMode, GameState } from './types';

const STORAGE_KEY = 'starseed:save';
const SAVE_VERSION = 1;

interface SaveFile {
  version: number;
  seed: number;
  resources: Record<string, string>;
  lifetime: Record<string, string>;
  buildings: Record<string, number>;
  upgrades: string[];
  automation: string[];
  automationOn: Record<string, boolean>;
  milestones: string[];
  settings: { buyMode: BuyMode };
  stats: { playedSeconds: number; taps: number };
  lastSeen: number;
}

export function createInitialState(now = Date.now()): GameState {
  return {
    seed: (Math.random() * 0xffffffff) >>> 0,
    resources: zeroed(),
    lifetime: zeroed(),
    buildings: {},
    upgrades: [],
    automation: [],
    automationOn: {},
    milestones: [],
    settings: { buyMode: 1 },
    stats: { playedSeconds: 0, taps: 0 },
    accumulator: 0,
    lastSeen: now,
  };
}

/**
 * Reads the save, discarding anything that no longer makes sense.
 *
 * Content changes between releases, so every id is filtered against the current
 * tables rather than trusted, and a corrupt or unreadable save starts a new game
 * instead of throwing. Losing progress is bad; refusing to start is worse.
 */
export function loadState(index: ContentIndex, now = Date.now()): GameState {
  const initial = createInitialState(now);

  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private browsing and blocked-storage modes throw on access.
    return initial;
  }
  if (!raw) return initial;

  let parsed: Partial<SaveFile>;
  try {
    parsed = JSON.parse(raw) as Partial<SaveFile>;
  } catch {
    return initial;
  }

  return hydrate(parsed, index, initial);
}

/** Split out from `loadState` so tests can exercise it without a DOM. */
export function hydrate(
  parsed: Partial<SaveFile>,
  index: ContentIndex,
  initial: GameState = createInitialState(),
): GameState {
  if (parsed.version !== SAVE_VERSION) return initial;

  const state = initial;

  if (typeof parsed.seed === 'number' && Number.isFinite(parsed.seed)) {
    state.seed = parsed.seed >>> 0;
  }

  for (const id of RESOURCE_IDS) {
    state.resources[id] = readDecimal(parsed.resources?.[id]);
    state.lifetime[id] = readDecimal(parsed.lifetime?.[id]);
    // A stock above its lifetime total is impossible and means a tampered or
    // half-written save; trust the smaller number.
    if (state.resources[id].gt(state.lifetime[id])) {
      state.lifetime[id] = state.resources[id];
    }
  }

  if (parsed.buildings && typeof parsed.buildings === 'object') {
    for (const [id, count] of Object.entries(parsed.buildings)) {
      if (!index.buildingById.has(id)) continue;
      if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) continue;
      state.buildings[id] = Math.floor(count);
    }
  }

  state.upgrades = uniqueKnown(parsed.upgrades, (id) => index.upgradeById.has(id));
  state.automation = uniqueKnown(parsed.automation, (id) => index.automationById.has(id));
  state.milestones = uniqueKnown(parsed.milestones, (id) =>
    index.content.milestones.some((m) => m.id === id),
  );

  if (parsed.automationOn && typeof parsed.automationOn === 'object') {
    for (const [id, on] of Object.entries(parsed.automationOn)) {
      if (state.automation.includes(id) && typeof on === 'boolean') state.automationOn[id] = on;
    }
  }

  const mode = parsed.settings?.buyMode;
  if (mode === 1 || mode === 10 || mode === 'max') state.settings.buyMode = mode;

  state.stats.playedSeconds = finiteOr(parsed.stats?.playedSeconds, 0);
  state.stats.taps = finiteOr(parsed.stats?.taps, 0);
  state.lastSeen = finiteOr(parsed.lastSeen, initial.lastSeen);

  return state;
}

export function serialise(state: GameState): SaveFile {
  return {
    version: SAVE_VERSION,
    seed: state.seed,
    resources: stringify(state.resources),
    lifetime: stringify(state.lifetime),
    buildings: { ...state.buildings },
    upgrades: [...state.upgrades],
    automation: [...state.automation],
    automationOn: { ...state.automationOn },
    milestones: [...state.milestones],
    settings: { ...state.settings },
    stats: { ...state.stats },
    lastSeen: state.lastSeen,
  };
}

export function saveState(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialise(state)));
  } catch {
    // Storage full or unavailable. The game keeps running in memory, and there
    // is nothing useful to tell the player mid-tick.
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clean up if storage was never readable */
  }
}

function zeroed(): Record<ResourceId, Decimal> {
  return { ore: Decimal.ZERO, alloy: Decimal.ZERO, compute: Decimal.ZERO };
}

function stringify(values: Record<ResourceId, Decimal>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of RESOURCE_IDS) out[id] = values[id].toString();
  return out;
}

function readDecimal(text: unknown): Decimal {
  if (typeof text !== 'string') return Decimal.ZERO;
  const value = Decimal.parse(text);
  return value.isPositive ? value : Decimal.ZERO;
}

function uniqueKnown(ids: unknown, known: (id: string) => boolean): string[] {
  if (!Array.isArray(ids)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id !== 'string' || seen.has(id) || !known(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}
