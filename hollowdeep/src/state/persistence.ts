import { STORY, STORY_V1_ORDER } from '../data/missions';
import { newGame, SAVE_VERSION } from '../game/engine';
import type { GameState } from './types';

export const STORAGE_KEY = 'hollowdeep:save';

/**
 * Fills anything a stored save is missing from a fresh game, one level of
 * nesting deep. That covers every field added since the save was written —
 * each new field has a correct default in `newGame` — so an old save loads
 * rather than being thrown away.
 */
function mergeDefaults(raw: Record<string, unknown>): GameState {
  const base = newGame(1) as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(raw)) {
    const def = base[k];
    if (def && typeof def === 'object' && !Array.isArray(def) && v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = { ...(def as object), ...(v as object) };
    } else if (v !== undefined && v !== null) {
      out[k] = v;
    }
  }
  return out as unknown as GameState;
}

/**
 * Version 1 kept its story place as an index into the original 42 missions.
 * Map it to that mission's id, so missions added since never move the
 * player: anything new before their place counts as already behind them.
 */
function migrateV1(obj: Record<string, unknown>): void {
  const story = (obj['story'] ?? {}) as { index?: number; base?: number };
  const index = typeof story.index === 'number' ? story.index : 0;
  let id: string | null = STORY_V1_ORDER[index] ?? null;
  if (id === null) {
    // They had finished the old story: pick up with the first mission after its last.
    const last = STORY.findIndex((m) => m.id === STORY_V1_ORDER[STORY_V1_ORDER.length - 1]);
    id = STORY[last + 1]?.id ?? null;
  }
  obj['story'] = { id, base: typeof story.base === 'number' ? story.base : 0 };
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
    if (typeof obj['coins'] !== 'number' || typeof obj['depth'] !== 'number') return null;
    if (obj['version'] === 1) migrateV1(obj);
    const s = mergeDefaults(obj);
    s.version = SAVE_VERSION;
    if (!Number.isFinite(s.coins)) s.coins = 0;
    return s;
  } catch {
    return null;
  }
}

/** A save as one copyable line, for moving between devices. */
export function exportSave(s: GameState): string {
  const bytes = new TextEncoder().encode(serialize(s));
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

export function saveLocal(s: GameState, now: number): void {
  s.savedAt = now;
  try {
    localStorage.setItem(STORAGE_KEY, serialize(s));
  } catch {
    // Storage full or blocked (private mode). The game still plays; it just
    // will not be there next time, which the settings panel says.
  }
}

export function clearLocal(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}
