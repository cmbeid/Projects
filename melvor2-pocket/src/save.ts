// Save storage: one record in IndexedDB, with base64 export/import for moving saves between devices.
import { GameState, SAVE_VERSION, newState } from './engine/state';

const DB = 'melvor2-pocket';
const STORE = 'saves';
const KEY = 'slot1';
const CONTENT_KEY = 'content';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Fill in fields added after a save was written, so old saves keep loading. */
function migrate(s: Partial<GameState>): GameState {
  const base = newState();
  return { ...base, ...s, stats: { ...base.stats, ...s.stats }, version: SAVE_VERSION } as GameState;
}

export async function load(): Promise<GameState | null> {
  try {
    const s = await run<GameState | undefined>('readonly', (st) => st.get(KEY));
    return s ? migrate(s) : null;
  } catch {
    return null;
  }
}

export async function save(state: GameState): Promise<void> {
  await run('readwrite', (st) => st.put(structuredClone(state), KEY));
}

export async function wipe(): Promise<void> {
  await run('readwrite', (st) => st.delete(KEY));
}

export function exportSave(state: GameState): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}

export function importSave(text: string): GameState {
  const parsed = JSON.parse(decodeURIComponent(escape(atob(text.trim()))));
  if (typeof parsed !== 'object' || !parsed || !('bank' in parsed) || !('xp' in parsed)) {
    throw new Error('That does not look like a Melvor 2 Pocket save.');
  }
  return migrate(parsed);
}

/** The game's content.json, kept in this browser after you load it once. */
export async function loadStoredContent(): Promise<unknown | null> {
  try {
    return (await run<unknown>('readonly', (st) => st.get(CONTENT_KEY))) ?? null;
  } catch {
    return null;
  }
}

export async function storeContent(data: unknown): Promise<void> {
  await run('readwrite', (st) => st.put(data, CONTENT_KEY));
}

export async function forgetContent(): Promise<void> {
  await run('readwrite', (st) => st.delete(CONTENT_KEY));
}
