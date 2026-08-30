/**
 * Stories imported from a local file, per format.md §14 — kept entirely in
 * this browser, never sent anywhere. IndexedDB-backed (offline.md: "only
 * worth doing once the size ceiling is a real problem" — it now is, since
 * `importLocalFolder` stores real image Blobs, which `localStorage` can't
 * hold at all without a base64 detour). Everything here is async as a
 * result; `main.ts` and `ui/shelf.ts` await it rather than calling it
 * synchronously the way the `localStorage`-backed version used to allow.
 *
 * Two kinds of import share one schema:
 *  - `'portable'` — a single self-contained file, every image a `data:` URI
 *    (§14). No asset records; `raw` has everything.
 *  - `'folder'` — a real `story.json` plus real image files, picked via a
 *    directory input. Each non-embedded asset is stored as its own Blob,
 *    keyed by the relative path the story references it by.
 *
 * This mirrors `persistence.ts`'s posture throughout: never throw on bad
 * storage state, drop what can't be trusted, and let the shelf keep working
 * regardless.
 */
import { ContentParseError, parseStory } from '../content/parse';
import { validateStory } from '../content/validate';
import type { AssetChecker } from '../content/validate';
import type { Story } from '../content/types';

const DB_NAME = 'storied-local';
const DB_VERSION = 1;
const STORIES_STORE = 'stories';
const ASSETS_STORE = 'assets';
const ASSETS_BY_STORY_INDEX = 'storyId';

export type LocalStoryKind = 'portable' | 'folder';

export interface LocalStory {
  id: string;
  raw: string;
  story: Story;
  kind: LocalStoryKind;
}

export class ImportError extends Error {}

interface StoredStoryRecord {
  id: string;
  raw: string;
  kind: LocalStoryKind;
  importedAt: number;
}

interface StoredAssetRecord {
  storyId: string;
  relativePath: string;
  blob: Blob;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORIES_STORE)) {
        db.createObjectStore(STORIES_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(ASSETS_STORE)) {
        const assets = db.createObjectStore(ASSETS_STORE, { keyPath: ['storyId', 'relativePath'] });
        assets.createIndex(ASSETS_BY_STORY_INDEX, 'storyId');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open local story storage.'));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed.'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted.'));
  });
}

/**
 * Every asset record for `storyId`, deleted in its own transaction — so a
 * re-import replaces cleanly rather than accumulating stale files from a
 * previous version. Deliberately its own transaction rather than sharing
 * the caller's: awaiting a wrapped Promise in the middle of a transaction,
 * with no request left pending on it at that instant, lets it auto-commit
 * before further requests are issued — the safe pattern is a burst of
 * synchronous requests per transaction, with the only `await` being the
 * final `txDone`, so a multi-step write is several small transactions
 * rather than one that spans an `await`.
 */
async function clearAssetsForStory(db: IDBDatabase, storyId: string): Promise<void> {
  const tx = db.transaction(ASSETS_STORE, 'readwrite');
  const index = tx.objectStore(ASSETS_STORE).index(ASSETS_BY_STORY_INDEX);
  const cursorRequest = index.openCursor(IDBKeyRange.only(storyId));
  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result;
    if (cursor) {
      cursor.delete();
      cursor.continue();
    }
  };
  await txDone(tx);
}

/** A message worth showing the user, distinguishing "the disk is full" from every other failure — offline.md's quota-visibility item. */
function storageFailureMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return 'Could not save this story — this browser is out of storage space for it. Removing another local story first may help.';
  }
  return 'Could not save this story — the browser storage is full or unavailable.';
}

/** Every locally-imported story that's still readable, oldest-imported first. A corrupt entry is dropped, not thrown. */
export async function listLocalStories(): Promise<LocalStory[]> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORIES_STORE, 'readonly');
    const records = await requestToPromise<StoredStoryRecord[]>(tx.objectStore(STORIES_STORE).getAll());
    db.close();

    const out: LocalStory[] = [];
    for (const record of [...records].sort((a, b) => a.importedAt - b.importedAt)) {
      try {
        out.push({ id: record.id, raw: record.raw, kind: record.kind, story: parseStory(JSON.parse(record.raw)) });
      } catch {
        continue;
      }
    }
    return out;
  } catch {
    return [];
  }
}

export async function removeLocalStory(id: string): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORIES_STORE, 'readwrite');
    tx.objectStore(STORIES_STORE).delete(id);
    await txDone(tx);
    await clearAssetsForStory(db, id);
    db.close();
  } catch {
    /* nothing to clean up if storage was never readable */
  }
}

/**
 * Every asset stored for `storyId`, as `relativePath -> object URL`. Empty
 * for a `'portable'` story (it has no asset records — every image is
 * already a `data:` URI in `raw`) and populated for a `'folder'` one. The
 * object URLs are never explicitly revoked: there are at most a handful per
 * story, and they're scoped to this page's lifetime regardless.
 */
export async function loadLocalStoryAssets(storyId: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    const db = await openDb();
    const tx = db.transaction(ASSETS_STORE, 'readonly');
    const index = tx.objectStore(ASSETS_STORE).index(ASSETS_BY_STORY_INDEX);
    const records = await requestToPromise<StoredAssetRecord[]>(index.getAll(IDBKeyRange.only(storyId)));
    db.close();
    for (const record of records) out.set(record.relativePath, URL.createObjectURL(record.blob));
  } catch {
    /* no assets to offer — resolveAsset callers fall back to the raw path */
  }
  return out;
}

/**
 * The first image reference that isn't a `data:` URI, as a JSON path — or
 * `null` if every one is embedded. A locally-imported *portable* story has
 * no folder to resolve a relative `src` against (format.md §14), so this is
 * checked at import time rather than left to fail silently the first time
 * the story actually renders. Exported so `scripts/validate-portable.ts`
 * enforces the exact same rule the browser importer does.
 */
export function findNonEmbeddedAsset(story: Story): string | null {
  if (story.cover && !story.cover.startsWith('data:')) return 'cover';
  if (story.theme?.background?.image && !story.theme.background.image.startsWith('data:')) {
    return 'theme.background.image';
  }
  for (const [nodeId, node] of Object.entries(story.nodes)) {
    for (const [i, block] of node.blocks.entries()) {
      if (block.type === 'image' && !block.src.startsWith('data:')) {
        return `nodes.${nodeId}.blocks[${i}].src`;
      }
    }
    if (node.theme?.background?.image && !node.theme.background.image.startsWith('data:')) {
      return `nodes.${nodeId}.theme.background.image`;
    }
  }
  return null;
}

/**
 * Parses, validates, and stores `raw` as a locally-imported *portable*
 * story (format.md §14 — every image already a `data:` URI). Throws
 * `ImportError` with a message fit to show the user directly, and stores
 * nothing, on any failure.
 *
 * `shippedIds` guards against colliding with a *manifest* story's id, whose
 * save `persistence.ts` keys by id alone — sharing one would silently mix
 * two different stories' saves together. Re-importing the same local story
 * to update it is expected and allowed: it simply overwrites its old copy.
 */
export async function importLocalStory(raw: string, shippedIds: ReadonlySet<string>): Promise<LocalStory> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ImportError('Not valid JSON.');
  }

  let story: Story;
  try {
    story = parseStory(parsed);
  } catch (error) {
    throw new ImportError(error instanceof ContentParseError ? error.message : 'Could not read this story.');
  }

  const report = validateStory(story);
  if (report.errors.length > 0) throw new ImportError(report.errors[0]!);

  if (shippedIds.has(story.id)) {
    throw new ImportError(
      `"${story.id}" is already the id of a story on the shelf — change this file's "id" and try again.`,
    );
  }

  const offending = findNonEmbeddedAsset(story);
  if (offending) {
    throw new ImportError(
      `${offending}: a locally-imported story needs every image as a data: URI (format.md §14) — there is no folder here to resolve a relative path against. Importing a real folder instead avoids this — see the "Import a story folder…" option.`,
    );
  }

  try {
    const db = await openDb();
    // A story that used to be a folder import and is now re-imported as
    // portable shouldn't leave its old asset Blobs orphaned.
    await clearAssetsForStory(db, story.id);
    const tx = db.transaction(STORIES_STORE, 'readwrite');
    const record: StoredStoryRecord = { id: story.id, raw, kind: 'portable', importedAt: Date.now() };
    tx.objectStore(STORIES_STORE).put(record);
    await txDone(tx);
    db.close();
  } catch (error) {
    throw new ImportError(storageFailureMessage(error));
  }

  return { id: story.id, raw, story, kind: 'portable' };
}

/**
 * Parses, validates, and stores a story picked as a real folder (a
 * `story.json` plus its `images/`, via a directory input) — offline.md's
 * "real multi-file import." Unlike `importLocalStory`, images stay ordinary
 * relative paths; each is checked against the files actually selected
 * (mirroring `scripts/validate-content.ts`'s on-disk check) and, once
 * validated, stored as its own Blob.
 *
 * `storyFile` is the `story.json` found among `files`; `assetFiles` is
 * every other file, keyed by its path relative to the folder that was
 * selected (matching how a block's `src` is written, e.g. `images/dock.png`).
 */
export async function importLocalFolder(
  storyFile: File,
  assetFiles: ReadonlyMap<string, File>,
  shippedIds: ReadonlySet<string>,
): Promise<LocalStory> {
  const raw = await storyFile.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ImportError('story.json is not valid JSON.');
  }

  let story: Story;
  try {
    story = parseStory(parsed);
  } catch (error) {
    throw new ImportError(error instanceof ContentParseError ? error.message : 'Could not read story.json.');
  }

  const assets: AssetChecker = { imageExists: (relativeSrc) => assetFiles.has(relativeSrc) };
  const report = validateStory(story, assets);
  if (report.errors.length > 0) throw new ImportError(report.errors[0]!);

  if (shippedIds.has(story.id)) {
    throw new ImportError(
      `"${story.id}" is already the id of a story on the shelf — change this story's "id" and try again.`,
    );
  }

  try {
    const db = await openDb();
    await clearAssetsForStory(db, story.id);
    const tx = db.transaction([STORIES_STORE, ASSETS_STORE], 'readwrite');
    const assetsStore = tx.objectStore(ASSETS_STORE);
    for (const [relativePath, assetFile] of assetFiles) {
      const record: StoredAssetRecord = { storyId: story.id, relativePath, blob: assetFile };
      assetsStore.put(record);
    }
    const record: StoredStoryRecord = { id: story.id, raw, kind: 'folder', importedAt: Date.now() };
    tx.objectStore(STORIES_STORE).put(record);
    await txDone(tx);
    db.close();
  } catch (error) {
    throw new ImportError(storageFailureMessage(error));
  }

  return { id: story.id, raw, story, kind: 'folder' };
}
