import { Decimal } from '../num/decimal';
import type { ResourceId } from '../data/types';
import { RESOURCE_IDS } from '../data/types';
import type { ContentIndex } from '../data/indexes';
import type { BuyMode, GameState, PrestigeState } from './types';

const STORAGE_KEY = 'starseed:save';
const SAVE_VERSION = 4;

/**
 * Versions this loader can still read.
 *
 * v1 predates prestige. v2 predates the narrative log. v3 predates per-building
 * pausing. All are migrated rather than discarded: every field a version is
 * missing has a correct default (no Schematics, no perks, no Relaunches; no log
 * entries; every owned building running, which is the honest default since
 * pausing did not exist yet to have turned one off), and throwing away a
 * player's first few hours because the save shape grew a field would be
 * indefensible. A v2 swarm genuinely has not seen fragments that did not exist
 * yet, so an empty log is not a loss — it is the truth.
 */
const READABLE_VERSIONS = [1, 2, 3, 4];

interface SaveFile {
  version: number;
  seed: number;
  resources: Record<string, string>;
  lifetime: Record<string, string>;
  totals: Record<string, string>;
  buildings: Record<string, number>;
  upgrades: string[];
  automation: string[];
  automationOn: Record<string, boolean>;
  buildingActive: Record<string, boolean>;
  milestones: string[];
  log: string[];
  prestige: {
    schematics: string;
    schematicsEarned: string;
    perks: string[];
    directives: string[];
    relaunches: number;
  };
  settings: { buyMode: BuyMode };
  stats: { playedSeconds: number; runSeconds: number; taps: number };
  lastSeen: number;
}

/**
 * What `hydrate` accepts: any shape a previous release may have written.
 *
 * Looser than `Partial<SaveFile>` on purpose — an older save is not a subset of
 * the current one, it is a different shape whose nested objects are missing
 * fields too. Every field is checked individually below regardless.
 */
export type SaveInput = Partial<Omit<SaveFile, 'stats' | 'prestige'>> & {
  stats?: Partial<SaveFile['stats']>;
  prestige?: Partial<SaveFile['prestige']>;
};

export function createInitialState(now = Date.now()): GameState {
  return {
    seed: (Math.random() * 0xffffffff) >>> 0,
    resources: zeroed(),
    lifetime: zeroed(),
    totals: zeroed(),
    buildings: {},
    upgrades: [],
    automation: [],
    automationOn: {},
    buildingActive: {},
    milestones: [],
    log: [],
    prestige: {
      schematics: Decimal.ZERO,
      schematicsEarned: Decimal.ZERO,
      perks: [],
      directives: [],
      relaunches: 0,
    },
    settings: { buyMode: 1 },
    stats: { playedSeconds: 0, runSeconds: 0, taps: 0 },
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

  let parsed: SaveInput;
  try {
    parsed = JSON.parse(raw) as SaveInput;
  } catch {
    return initial;
  }

  return hydrate(parsed, index, initial);
}

/** Split out from `loadState` so tests can exercise it without a DOM. */
export function hydrate(
  parsed: SaveInput,
  index: ContentIndex,
  initial: GameState = createInitialState(),
): GameState {
  if (typeof parsed.version !== 'number' || !READABLE_VERSIONS.includes(parsed.version)) {
    return initial;
  }

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
    // v1 had no all-time total. The run's own lifetime is the honest floor for
    // it: everything that run produced really was produced.
    state.totals[id] = readDecimal(parsed.totals?.[id]).max(state.lifetime[id]);
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
  state.log = uniqueKnown(parsed.log, (id) => index.content.log.some((entry) => entry.id === id));

  if (parsed.automationOn && typeof parsed.automationOn === 'object') {
    for (const [id, on] of Object.entries(parsed.automationOn)) {
      if (state.automation.includes(id) && typeof on === 'boolean') state.automationOn[id] = on;
    }
  }

  if (parsed.buildingActive && typeof parsed.buildingActive === 'object') {
    for (const [id, on] of Object.entries(parsed.buildingActive)) {
      if ((state.buildings[id] ?? 0) > 0 && typeof on === 'boolean') state.buildingActive[id] = on;
    }
  }

  state.prestige = readPrestige(parsed.prestige, index);

  const mode = parsed.settings?.buyMode;
  if (mode === 1 || mode === 10 || mode === 'max') state.settings.buyMode = mode;

  state.stats.playedSeconds = finiteOr(parsed.stats?.playedSeconds, 0);
  // v1 saves have no per-run clock, and every v1 save is mid-first-run by
  // definition, so the all-time figure is exactly right.
  state.stats.runSeconds = finiteOr(parsed.stats?.runSeconds, state.stats.playedSeconds);
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
    totals: stringify(state.totals),
    buildings: { ...state.buildings },
    upgrades: [...state.upgrades],
    automation: [...state.automation],
    automationOn: { ...state.automationOn },
    buildingActive: { ...state.buildingActive },
    milestones: [...state.milestones],
    log: [...state.log],
    prestige: {
      schematics: state.prestige.schematics.toString(),
      schematicsEarned: state.prestige.schematicsEarned.toString(),
      perks: [...state.prestige.perks],
      directives: [...state.prestige.directives],
      relaunches: state.prestige.relaunches,
    },
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

/**
 * Prestige is the one part of a save that is never reset, so a corrupt or
 * outdated field here would follow the player forever. Every id is filtered
 * against the current tables and every number is re-derived where it can be:
 * `schematicsEarned` can never be below what is still unspent.
 */
function readPrestige(parsed: unknown, index: ContentIndex): PrestigeState {
  const empty: PrestigeState = {
    schematics: Decimal.ZERO,
    schematicsEarned: Decimal.ZERO,
    perks: [],
    directives: [],
    relaunches: 0,
  };
  if (!parsed || typeof parsed !== 'object') return empty;
  const raw = parsed as Partial<SaveFile['prestige']>;

  const schematics = readDecimal(raw.schematics);
  return {
    schematics,
    schematicsEarned: readDecimal(raw.schematicsEarned).max(schematics),
    perks: uniqueKnown(raw.perks, (id) => index.perkById.has(id)),
    directives: uniqueKnown(raw.directives, (id) => index.directiveById.has(id)),
    relaunches: Math.floor(finiteOr(raw.relaunches, 0)),
  };
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
