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

/**
 * What shape the cached entry is in.
 *
 * Bumped whenever an entry written by an older build would be *wrong* rather
 * than merely thin — a mismatch is treated as nothing cached, so the player
 * picks their copy once more and everything is re-cut. Two things forced the
 * first bump: glyph sprites carry an `origin` that says where on a floor they
 * belong, and an entry without it draws every floor number at the top of its
 * floor; and sounds were not stored at all, so a cached tower stayed mute.
 *
 * The alternative — reading a stale entry and hoping — is how a cache turns a
 * fixed bug back into a live one on someone else's machine.
 */
const SCHEMA = 2;

/** What we keep: plain arrays, so it survives structured cloning unchanged. */
interface StoredAtlas {
  schema?: number;
  fingerprint: string;
  palette: Uint8Array;
  sprites: {
    key: string;
    transparent?: number;
    origin?: { x: number; y: number };
    frames: { width: number; height: number; pixels: Uint8Array }[];
  }[];
  sounds?: { id: number; bytes: Uint8Array }[];
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
  sounds: Map<number, Uint8Array> = new Map(),
): Promise<void> {
  const stored: StoredAtlas = {
    schema: SCHEMA,
    fingerprint: fingerprintValue,
    palette,
    sprites: [...sprites.values()].map((sprite) => {
      const frames = sprite.frames.map((frame) => ({
        width: frame.width,
        height: frame.height,
        pixels: frame.pixels,
      }));
      const entry: StoredAtlas['sprites'][number] = { key: sprite.key, frames };
      if (sprite.transparent !== undefined) entry.transparent = sprite.transparent;
      if (sprite.origin !== undefined) entry.origin = sprite.origin;
      return entry;
    }),
    sounds: [...sounds.entries()].map(([id, bytes]) => ({ id, bytes })),
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
  | {
      fingerprint: string;
      palette: Palette;
      sprites: Map<string, ExtractedSprite>;
      sounds: Map<number, Uint8Array>;
    }
  | undefined
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
    // Written by a build whose entries are wrong for this one. Treated as
    // nothing cached, so the art is re-cut rather than drawn from a shape that
    // has since been corrected.
    if (stored.schema !== SCHEMA) return undefined;

    const sprites = new Map<string, ExtractedSprite>();
    for (const entry of stored.sprites) {
      const frames: IndexedImage[] = entry.frames.map((frame) => ({
        width: frame.width,
        height: frame.height,
        pixels: new Uint8Array(frame.pixels),
      }));
      const sprite: ExtractedSprite = { key: entry.key, frames };
      if (entry.transparent !== undefined) sprite.transparent = entry.transparent;
      if (entry.origin !== undefined) sprite.origin = { x: entry.origin.x, y: entry.origin.y };
      sprites.set(entry.key, sprite);
    }

    const sounds = new Map<number, Uint8Array>();
    for (const entry of stored.sounds ?? []) sounds.set(entry.id, new Uint8Array(entry.bytes));

    return { fingerprint: stored.fingerprint, palette: new Uint8Array(stored.palette), sprites, sounds };
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
