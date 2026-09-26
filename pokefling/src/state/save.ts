/**
 * Progress between visits: the best result on each level, the bag of items,
 * which hidden items have been found, and the sound settings. Kept in
 * localStorage, which can be missing or throw (private windows, blocked site
 * data), so every access is guarded and a broken store just means starting
 * fresh.
 */
import { ITEM_KEYS, type ItemKey } from '../data/roster';

const STORAGE_KEY = 'pokefling:progress';
const VERSION = 2;

export interface LevelResult {
  readonly score: number;
  readonly stars: number;
}

export interface Volumes {
  readonly sfx: number;
  readonly cries: number;
  readonly music: number;
}

export interface Progress {
  /** Best result per level, by level id (`'mt-moon-3'`). */
  readonly best: Readonly<Record<string, LevelResult>>;
  readonly bag: Readonly<Record<ItemKey, number>>;
  /** Levels whose hidden item has been collected. */
  readonly found: readonly string[];
  readonly volumes: Volumes;
  readonly muted: boolean;
}

type Store = Pick<Storage, 'getItem' | 'setItem'>;

export const DEFAULT_VOLUMES: Volumes = { sfx: 80, cries: 70, music: 50 };

/** A new player starts with one of everything, so they can find out what each does. */
export const STARTING_BAG: Readonly<Record<ItemKey, number>> = Object.fromEntries(ITEM_KEYS.map((k) => [k, 1])) as Record<
  ItemKey,
  number
>;

export const EMPTY_PROGRESS: Progress = { best: {}, bag: STARTING_BAG, found: [], volumes: DEFAULT_VOLUMES, muted: false };

function defaultStore(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

const clampVolume = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.min(100, Math.max(0, v))) : fallback;

function readBest(raw: unknown): Record<string, LevelResult> {
  const best: Record<string, LevelResult> = {};
  if (typeof raw !== 'object' || raw === null) return best;
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const r = value as Partial<LevelResult> | null;
    if (typeof r?.score === 'number' && typeof r.stars === 'number') best[id] = { score: r.score, stars: r.stars };
  }
  return best;
}

function readBag(raw: unknown): Record<ItemKey, number> {
  const bag = { ...STARTING_BAG };
  if (typeof raw !== 'object' || raw === null) return bag;
  for (const key of ITEM_KEYS) {
    const n = (raw as Record<string, unknown>)[key];
    if (typeof n === 'number' && Number.isFinite(n)) bag[key] = Math.max(0, Math.floor(n));
  }
  return bag;
}

export function loadProgress(store: Store | null = defaultStore()): Progress {
  try {
    const raw = store?.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_PROGRESS;
    const data = JSON.parse(raw) as Record<string, unknown>;
    const muted = data['muted'] === true;
    // Version 1 numbered the original twelve levels, which no longer exist;
    // only the mute switch carries over.
    if (data['version'] === 1) return { ...EMPTY_PROGRESS, muted };
    if (data['version'] !== VERSION) return EMPTY_PROGRESS;
    const v = (data['volumes'] ?? {}) as Record<string, unknown>;
    return {
      best: readBest(data['best']),
      bag: readBag(data['bag']),
      found: Array.isArray(data['found']) ? data['found'].filter((x): x is string => typeof x === 'string') : [],
      volumes: {
        sfx: clampVolume(v['sfx'], DEFAULT_VOLUMES.sfx),
        cries: clampVolume(v['cries'], DEFAULT_VOLUMES.cries),
        music: clampVolume(v['music'], DEFAULT_VOLUMES.music),
      },
      muted,
    };
  } catch {
    return EMPTY_PROGRESS;
  }
}

export function saveProgress(progress: Progress, store: Store | null = defaultStore()): void {
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, ...progress }));
  } catch {
    // Out of quota or blocked: progress lasts until the tab closes, which is
    // the best that can be done.
  }
}

/** Fold a win into the record, keeping the best score and best stars separately. */
export function recordWin(progress: Progress, levelId: string, score: number, stars: number): Progress {
  const was = progress.best[levelId];
  const next: LevelResult = {
    score: Math.max(was?.score ?? 0, score),
    stars: Math.max(was?.stars ?? 0, stars),
  };
  return { ...progress, best: { ...progress.best, [levelId]: next } };
}

export function addItem(progress: Progress, item: ItemKey, count = 1): Progress {
  return { ...progress, bag: { ...progress.bag, [item]: (progress.bag[item] ?? 0) + count } };
}

export function takeItem(progress: Progress, item: ItemKey): Progress {
  return { ...progress, bag: { ...progress.bag, [item]: Math.max(0, (progress.bag[item] ?? 0) - 1) } };
}

export function markFound(progress: Progress, levelId: string): Progress {
  return progress.found.includes(levelId) ? progress : { ...progress, found: [...progress.found, levelId] };
}

/** Levels open in order: the first always, each after it once the one before is beaten. */
export function isUnlocked(progress: Progress, order: readonly string[], levelId: string): boolean {
  const i = order.indexOf(levelId);
  if (i <= 0) return i === 0;
  return progress.best[order[i - 1]!] !== undefined;
}

export function totalStars(progress: Progress, ids?: readonly string[]): number {
  return Object.entries(progress.best)
    .filter(([id]) => !ids || ids.includes(id))
    .reduce((sum, [, r]) => sum + r.stars, 0);
}
