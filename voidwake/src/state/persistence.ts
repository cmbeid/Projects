import { newGame, SAVE_VERSION } from '../game/engine';
import type { GameState } from './types';

export const STORAGE_KEY = 'voidwake:save';

/**
 * Fills anything a stored save is missing from a fresh game, one level of
 * nesting deep. Every field added later has a correct default in `newGame`,
 * so an old save loads instead of being thrown away.
 */
function mergeDefaults(raw: Record<string, unknown>): GameState {
  const base = newGame(1) as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(raw)) {
    const def = base[k];
    if (def && typeof def === 'object' && !Array.isArray(def) && v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = { ...(def as object), ...(v as object) };
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out as unknown as GameState;
}

export function serialize(s: GameState): string {
  return JSON.stringify(s);
}

export function deserialize(text: string): GameState | null {
  try {
    const raw = JSON.parse(text) as unknown;
    if (!raw || typeof raw !== 'object') return null;
    const obj = raw as Record<string, unknown>;
    if (typeof obj['version'] !== 'number' || obj['version'] > SAVE_VERSION) return null;
    if (typeof obj['day'] !== 'number' || !Array.isArray(obj['crew']) || !obj['sector'] || typeof obj['sector'] !== 'object') return null;
    const s = mergeDefaults(obj);
    s.version = SAVE_VERSION;
    const fresh = newGame(1);
    s.mats = { ...fresh.mats, ...s.mats };
    s.items = { ...fresh.items, ...s.items };
    s.modules = { ...fresh.modules, ...s.modules };
    for (const k of Object.keys(s.res) as (keyof typeof s.res)[]) if (!Number.isFinite(s.res[k])) s.res[k] = 0;
    return s;
  } catch {
    return null;
  }
}

/** A save as one copyable line, for moving between devices. */
export function exportSave(s: GameState): string {
  const bytes = new TextEncoder().encode(serialize({ ...s, checkpoint: null }));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function importSave(code: string): GameState | null {
  try {
    const bin = atob(code.trim());
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return deserialize(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

export function loadLocal(): GameState | null {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    return text ? deserialize(text) : null;
  } catch {
    return null;
  }
}

export function saveLocal(s: GameState, now: number): boolean {
  s.savedAt = now;
  try {
    localStorage.setItem(STORAGE_KEY, serialize(s));
    return true;
  } catch {
    // Storage full or blocked (private mode). The game still plays; it just
    // won't be there next time, which the settings panel says.
    return false;
  }
}

export function clearLocal(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}
