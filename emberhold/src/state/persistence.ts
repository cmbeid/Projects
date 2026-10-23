/**
 * Saves are JSON in localStorage, with an export string (base64) for moving
 * between devices. Older saves are filled in from a new game, field by
 * field, so adding state never breaks a save.
 */
import { newGame, SAVE_VERSION } from '../game/core';
import type { GameState } from './types';

export const STORAGE_KEY = 'emberhold-save';

export function serialize(s: GameState): string {
  return JSON.stringify(s);
}

export function deserialize(text: string): GameState | null {
  try {
    const raw = JSON.parse(text) as Partial<GameState>;
    if (!raw || typeof raw !== 'object' || typeof raw.xp !== 'object') return null;
    return migrate(raw);
  } catch {
    return null;
  }
}

/** Fills in anything a save made by an older build doesn't have. */
export function migrate(raw: Partial<GameState>): GameState {
  const fresh = newGame(raw.rng ?? 1, raw.createdAt ?? Date.now(), raw.mode ?? 'standard');
  const s = { ...fresh, ...raw } as GameState;
  s.xp = { ...fresh.xp, ...raw.xp };
  s.settings = { ...fresh.settings, ...raw.settings };
  s.farm = { ...fresh.farm, ...raw.farm };
  if (!raw.bank) {
    s.bank = fresh.bank;
    s.bankOrder = fresh.bankOrder;
  }
  for (const k of Object.keys(s.bank)) if (!s.bankOrder.includes(k)) s.bankOrder.push(k);
  s.bankOrder = s.bankOrder.filter((k) => k in s.bank);
  if (!s.loadouts?.length) s.loadouts = [{}];
  if (s.loadout >= s.loadouts.length) s.loadout = 0;
  s.version = SAVE_VERSION;
  return s;
}

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

export function saveLocal(s: GameState, now = Date.now()): void {
  s.savedAt = now;
  try {
    localStorage.setItem(STORAGE_KEY, serialize(s));
  } catch {
    // Private mode or full storage: the game still runs, it just won't keep.
  }
}

export function clearLocal(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
