/**
 * Remembers the art the player supplied, without ever sending it anywhere.
 *
 * The original bitmaps live in a copy of SIMTOWER.EXE that belongs to the
 * player. This site never receives that file: it is read in the browser, the
 * sprites are cut out in the browser, and the result is cached in IndexedDB on
 * the player's own device so it only has to be picked once. Nothing is
 * uploaded, and nothing extracted is ever committed to this repository — the
 * art is © Maxis / OPeNBooK / Yoot Saito and is not ours to redistribute.
 */

import type { IndexedImage } from './dib.js';
import type { ExtractedSprite } from './slice.js';
import type { Palette } from './palette.js';

const DB_NAME = 'vertical-empire';
const DB_VERSION = 1;
const STORE = 'atlas';
const KEY = 'original';

/** What we keep: plain arrays, so it survives structured cloning unchanged. */
interface StoredAtlas {
  fingerprint: string;
  palette: Uint8Array;
  sprites: {
    key: string;
    transparent?: number;
    frames: { width: number; height: number; pixels: Uint8Array }[];
  }[];
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open the local cache.'));
  });
}

function run<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Local cache request failed.'));
  });
}

/**
 * A cheap content hash, enough to notice the player picked a different file.
 * Not a checksum — nothing here is trusted on the strength of it.
 */
export function fingerprint(bytes: Uint8Array): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  // Sampled rather than exhaustive: a megabyte-and-a-half executable does not
  // need hashing byte by byte to tell two files apart.
  const step = Math.max(1, Math.floor(bytes.byteLength / 4096));
  for (let i = 0; i < bytes.byteLength; i += step) {
    a = Math.imul(a ^ (bytes[i] ?? 0), 0x01000193);
    b = Math.imul(b + (bytes[i] ?? 0), 0x85ebca6b) >>> 0;
  }
  return `${bytes.byteLength.toString(16)}-${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}`;
}

export async function saveAtlas(
  fingerprintValue: string,
  palette: Palette,
  sprites: Map<string, ExtractedSprite>,
): Promise<void> {
  const stored: StoredAtlas = {
    fingerprint: fingerprintValue,
    palette,
    sprites: [...sprites.values()].map((sprite) => {
      const frames = sprite.frames.map((frame) => ({
        width: frame.width,
        height: frame.height,
        pixels: frame.pixels,
      }));
      return sprite.transparent === undefined
        ? { key: sprite.key, frames }
        : { key: sprite.key, transparent: sprite.transparent, frames };
    }),
  };

  const db = await open();
  try {
    const transaction = db.transaction(STORE, 'readwrite');
    await run(transaction.objectStore(STORE).put(stored, KEY));
  } finally {
    db.close();
  }
}

export async function loadAtlas(): Promise<
  { fingerprint: string; palette: Palette; sprites: Map<string, ExtractedSprite> } | undefined
> {
  let db: IDBDatabase;
  try {
    db = await open();
  } catch {
    // Private browsing, or storage denied. Not worth surfacing: the fallback
    // art is already on screen and the picker still works for this session.
    return undefined;
  }

  try {
    const stored = await run<StoredAtlas | undefined>(db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY));
    if (!stored) return undefined;

    const sprites = new Map<string, ExtractedSprite>();
    for (const entry of stored.sprites) {
      const frames: IndexedImage[] = entry.frames.map((frame) => ({
        width: frame.width,
        height: frame.height,
        pixels: new Uint8Array(frame.pixels),
      }));
      const sprite: ExtractedSprite = { key: entry.key, frames };
      if (entry.transparent !== undefined) sprite.transparent = entry.transparent;
      sprites.set(entry.key, sprite);
    }
    return { fingerprint: stored.fingerprint, palette: new Uint8Array(stored.palette), sprites };
  } catch {
    return undefined;
  } finally {
    db.close();
  }
}

export async function forgetAtlas(): Promise<void> {
  try {
    const db = await open();
    try {
      await run(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(KEY));
    } finally {
      db.close();
    }
  } catch {
    // Nothing cached, or no storage. Either way there is nothing to forget.
  }
}
