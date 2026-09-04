// Browser-side cache of verified edition media (IndexedDB).
//
// After SIMTOWER.EXE / EX_ passes the SHA-256 allowlist, the raw file bytes
// are kept in the player's own IndexedDB so later visits can restore the
// verified edition without re-selecting the file. Nothing ever leaves the
// browser: the cache is keyed by game mode, holds only the file the player
// picked, and is removed by "Forget" on the main menu or by clearing site
// data. A cached copy is never trusted blindly — the restore path re-runs
// the hash verification (core/ownership.js) before using it.
//
// Headless-safe: every call resolves to null/false when IndexedDB is missing
// (bun/node), and the factory is injectable for tests.

const DB_NAME = "opensky-media";
const DB_VERSION = 1;
const STORE = "verified";

// Bump when the record shape changes; older records are ignored and dropped.
export const MEDIA_CACHE_VERSION = 1;

function defaultFactory() {
  return typeof indexedDB !== "undefined" ? indexedDB : null;
}

function toArrayBuffer(bytes) {
  if (bytes instanceof ArrayBuffer) return bytes;
  if (ArrayBuffer.isView(bytes)) {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }
  throw new TypeError("Expected executable bytes");
}

function openDatabase(factory) {
  return new Promise((resolve, reject) => {
    let request;
    try {
      request = factory.open(DB_NAME, DB_VERSION);
    } catch (error) {
      reject(error);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("IndexedDB upgrade blocked by another tab"));
  });
}

function transactionResult(tx, request) {
  return new Promise((resolve, reject) => {
    let result;
    if (request) {
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
    }
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
  });
}

async function withStore(factory, access, operate) {
  const db = await openDatabase(factory);
  try {
    const tx = db.transaction(STORE, access);
    return await transactionResult(tx, operate(tx.objectStore(STORE)));
  } finally {
    db.close();
  }
}

// Persist a successfully verified file. `bytes` is an ArrayBuffer or a typed
// array view of the executable. Resolves false when caching is unavailable
// (headless, private mode, quota) — verification itself must never depend on it.
export async function saveVerifiedMedia({ mode, filename, kind, hash, bytes }, { idb = defaultFactory() } = {}) {
  if (!idb) return false;
  try {
    const record = {
      cacheVersion: MEDIA_CACHE_VERSION,
      mode: String(mode || ""),
      filename: String(filename || ""),
      kind: kind || null,
      hash: String(hash || ""),
      bytes: toArrayBuffer(bytes),
      storedAt: new Date().toISOString(),
    };
    await withStore(idb, "readwrite", (store) => store.put(record, record.mode));
    return true;
  } catch {
    return false;
  }
}

// Fetch the cached record for a mode (or null when absent, unreadable, or of
// an unknown cache version).
export async function loadVerifiedMedia(mode, { idb = defaultFactory() } = {}) {
  if (!idb) return null;
  try {
    const record = await withStore(idb, "readonly", (store) => store.get(String(mode || "")));
    if (!record || typeof record !== "object" || record.cacheVersion !== MEDIA_CACHE_VERSION) {
      return null;
    }
    return record;
  } catch {
    return null;
  }
}

// Remove the cached record for a mode (the main menu "Forget" action).
export async function clearVerifiedMedia(mode, { idb = defaultFactory() } = {}) {
  if (!idb) return false;
  try {
    await withStore(idb, "readwrite", (store) => store.delete(String(mode || "")));
    return true;
  } catch {
    return false;
  }
}

// Wrap a cached record as the { name, arrayBuffer() } file shape consumed by
// verifySimTowerFile and loadSimTowerMedia, or null for an unusable record.
export function cachedMediaFile(record) {
  if (!record || typeof record.filename !== "string") return null;
  let bytes;
  try {
    bytes = toArrayBuffer(record.bytes);
  } catch {
    return null;
  }
  return { name: record.filename, arrayBuffer: async () => bytes };
}
