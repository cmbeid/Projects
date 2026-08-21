import { BASE_ELEMENT_IDS } from '../data/types';
import type { GameState, Token } from './types';

const STORAGE_KEY = 'alchemy-forge:save';
const SAVE_VERSION = 1;

interface SaveFile {
  version: number;
  discovered: string[];
  tokens: Token[];
  settings: { sound: boolean };
  hintsUsed: number;
}

export function createInitialState(): GameState {
  return {
    discovered: [...BASE_ELEMENT_IDS],
    tokens: [],
    settings: { sound: true },
    hintsUsed: 0,
    nextUid: 1,
  };
}

/**
 * Reads the save file, discarding anything that no longer makes sense.
 *
 * Content changes between releases, so ids are filtered against the current
 * element table rather than trusted. A corrupt or unreadable save is treated
 * as a new game instead of an error — losing progress is bad, but refusing to
 * start is worse.
 */
export function loadState(knownIds: Set<string>): GameState {
  const initial = createInitialState();

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

  if (parsed.version !== SAVE_VERSION) return initial;

  const discovered = new Set<string>(BASE_ELEMENT_IDS);
  const ordered: string[] = [...BASE_ELEMENT_IDS];
  if (Array.isArray(parsed.discovered)) {
    for (const id of parsed.discovered) {
      if (typeof id !== 'string' || !knownIds.has(id) || discovered.has(id)) continue;
      discovered.add(id);
      ordered.push(id);
    }
  }

  let nextUid = 1;
  const tokens: Token[] = [];
  if (Array.isArray(parsed.tokens)) {
    for (const token of parsed.tokens) {
      if (!isValidToken(token) || !discovered.has(token.elementId)) continue;
      tokens.push({
        uid: nextUid++,
        elementId: token.elementId,
        fx: clamp01(token.fx),
        fy: clamp01(token.fy),
      });
    }
  }

  return {
    discovered: ordered,
    tokens,
    settings: { sound: parsed.settings?.sound !== false },
    hintsUsed: typeof parsed.hintsUsed === 'number' ? parsed.hintsUsed : 0,
    nextUid,
  };
}

export function saveState(state: GameState): void {
  const payload: SaveFile = {
    version: SAVE_VERSION,
    discovered: state.discovered,
    tokens: state.tokens,
    settings: state.settings,
    hintsUsed: state.hintsUsed,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage full or unavailable. The game keeps working in memory; there is
    // nothing useful to tell the player mid-drag.
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clean up if storage was never readable */
  }
}

function isValidToken(token: unknown): token is Token {
  if (typeof token !== 'object' || token === null) return false;
  const candidate = token as Partial<Token>;
  return (
    typeof candidate.elementId === 'string' &&
    typeof candidate.fx === 'number' &&
    Number.isFinite(candidate.fx) &&
    typeof candidate.fy === 'number' &&
    Number.isFinite(candidate.fy)
  );
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
