// Save storage: one record in IndexedDB, with base64 export/import for moving saves between devices.
import { GameState, SAVE_VERSION, newState } from './engine/state';
import { fixRanchingLand } from './engine/skills/ranching';

const DB = 'melvor2-pocket';
const STORE = 'saves';
const KEY = 'slot1';
const CONTENT_KEY = 'content';
const ASSETS_KEY = 'assets';

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
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    // Writes resolve once committed: a reload straight after a big Blob write would otherwise abort it.
    if (mode === 'readwrite') tx.oncomplete = () => resolve(req.result);
    else req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.onabort = () => reject(tx.error ?? new Error('Storage write was aborted.'));
  });
}

/** Fill in fields added after a save was written, so old saves keep loading. */
export function migrate(s: Partial<GameState>): GameState {
  const base = newState();
  const legacy = (s.version ?? 1) < 2;
  const out = { ...base, ...s, stats: { ...base.stats, ...s.stats }, version: SAVE_VERSION, legacyUnlockAll: legacy || s.legacyUnlockAll } as GameState;
  fixRanchingLand(out.ranching);
  // One slayer task per master now: move an old single task under its master.
  const old = out.combat.slayer;
  if (old) {
    if (old.left > 0) (out.combat.slayerTasks ??= {})[old.master] ??= { enemy: old.enemy, left: old.left, extended: old.extended };
    out.combat.slayer = null;
  }
  return out;
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

/** The optional game-assets.pack (game images), kept in this browser as a Blob. */
export async function loadStoredAssets(): Promise<Blob | null> {
  try {
    return (await run<Blob | undefined>('readonly', (st) => st.get(ASSETS_KEY))) ?? null;
  } catch {
    return null;
  }
}

export async function storeAssets(blob: Blob): Promise<void> {
  await run('readwrite', (st) => st.put(blob, ASSETS_KEY));
}

export async function forgetAssets(): Promise<void> {
  await run('readwrite', (st) => st.delete(ASSETS_KEY));
}

/** Optional sound/music packs, kept in this browser as Blobs. */
export async function loadStoredBlob(key: 'sounds' | 'music'): Promise<Blob | null> {
  try {
    return (await run<Blob | undefined>('readonly', (st) => st.get(key))) ?? null;
  } catch {
    return null;
  }
}

export async function storeBlob(key: 'sounds' | 'music', blob: Blob): Promise<void> {
  await run('readwrite', (st) => st.put(blob, key));
}

export async function forgetBlob(key: 'sounds' | 'music'): Promise<void> {
  await run('readwrite', (st) => st.delete(key));
}

/**
 * Get the latest version of the app: drop the service worker and its cached files, then reload past any HTTP cache.
 * IndexedDB (save, game data, packs) is untouched.
 */
export async function forceRefresh(): Promise<void> {
  try {
    for (const r of (await navigator.serviceWorker?.getRegistrations()) ?? []) await r.unregister();
    for (const k of await caches.keys()) await caches.delete(k);
  } catch {
    // Without service workers or caches there's nothing to clear.
  }
  const url = new URL(location.href);
  url.searchParams.set('refresh', String(Date.now()));
  location.replace(url.toString());
}
