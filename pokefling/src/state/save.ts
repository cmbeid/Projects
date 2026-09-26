/**
 * Progress between visits: the best result on each level, and the mute
 * switch. Kept in localStorage, which can be missing or throw (private
 * windows, blocked site data), so every access is guarded and a broken store
 * just means starting fresh.
 */

const STORAGE_KEY = 'pokefling:progress';
const VERSION = 1;

export interface LevelResult {
  readonly score: number;
  readonly stars: number;
}

export interface Progress {
  readonly best: Readonly<Record<number, LevelResult>>;
  readonly muted: boolean;
}

type Store = Pick<Storage, 'getItem' | 'setItem'>;

export const EMPTY_PROGRESS: Progress = { best: {}, muted: false };

function defaultStore(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadProgress(store: Store | null = defaultStore()): Progress {
  try {
    const raw = store?.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_PROGRESS;
    const data = JSON.parse(raw) as { version?: number; best?: unknown; muted?: unknown };
    if (data.version !== VERSION || typeof data.best !== 'object' || data.best === null) return EMPTY_PROGRESS;
    const best: Record<number, LevelResult> = {};
    for (const [id, value] of Object.entries(data.best as Record<string, unknown>)) {
      const r = value as Partial<LevelResult> | null;
      if (typeof r?.score === 'number' && typeof r.stars === 'number') best[Number(id)] = { score: r.score, stars: r.stars };
    }
    return { best, muted: data.muted === true };
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
export function recordWin(progress: Progress, levelId: number, score: number, stars: number): Progress {
  const was = progress.best[levelId];
  const next: LevelResult = {
    score: Math.max(was?.score ?? 0, score),
    stars: Math.max(was?.stars ?? 0, stars),
  };
  return { ...progress, best: { ...progress.best, [levelId]: next } };
}

/** The first level is always open; each after it opens when the one before is beaten. */
export function isUnlocked(progress: Progress, levelId: number): boolean {
  return levelId <= 1 || progress.best[levelId - 1] !== undefined;
}

export function totalStars(progress: Progress): number {
  return Object.values(progress.best).reduce((sum, r) => sum + r.stars, 0);
}
