// Game-edition ownership verification.
//
// The checks are deliberately client-side and use only the file the player
// selected. Nothing is ever uploaded to a server; the verified file may be
// kept in this browser's own IndexedDB (core/media-cache.js) so it need not
// be re-selected on every visit, and cached copies are always re-verified
// here before use. A filename is not proof of ownership, so supported
// editions are identified by SHA-256 allowlists.

export const GAME_MODES = Object.freeze([
  Object.freeze({
    id: "simtower",
    label: "SimTower remake",
    enabled: true,
    requires: "SIMTOWER.EXE or SIMTOWER.EX_",
  }),
  Object.freeze({
    id: "yoottower",
    label: "YootTower remake",
    enabled: false,
    requires: "T2.EXE",
    unavailableReason: "YootTower parity is not ready yet.",
  }),
  Object.freeze({
    id: "opensky",
    label: "OpenSkyScraper (community art)",
    enabled: true,
    requires: null,
    // No original file is needed: this edition renders OpenSkyscraper's openly
    // licensed community art pack (public/assets/opensky, GPLv2). The menu
    // keeps it dev-console locked until the art pipeline is battle-tested.
    requiresLabel: "no original file required",
  }),
]);

// Known-good files from the original SimTower media currently supported by
// OpenSky. Keep a filename-specific allowlist: an EXE and its compressed EX_
// are both legitimate media, but they are different byte streams.
export const SUPPORTED_SIMTOWER_HASHES = Object.freeze({
  "SIMTOWER.EXE": Object.freeze([
    "2825a3c53f77945c63b6d72e26faa7dde5ddd56c31ca668e67a12576d7feca96",
  ]),
  "SIMTOWER.EX_": Object.freeze([
    "b3efe22b9efec71141aad0129c90c1dcc886a44d08342f8f94fc73f24fd0e736",
  ]),
});

export function gameMode(id) {
  return GAME_MODES.find((mode) => mode.id === id) || null;
}

export function basenameUpper(name = "") {
  return String(name).replace(/^.*[\\/]/, "").toUpperCase();
}

export function simTowerFileKind(name) {
  const base = basenameUpper(name);
  if (base === "SIMTOWER.EXE") return "exe";
  if (base === "SIMTOWER.EX_") return "compressed";
  return null;
}

function bytesForDigest(bytes) {
  if (bytes instanceof ArrayBuffer) return bytes;
  if (ArrayBuffer.isView(bytes)) {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }
  throw new TypeError("Expected an ArrayBuffer or typed-array view");
}

export async function sha256Hex(bytes, subtle = globalThis.crypto?.subtle) {
  if (!subtle?.digest) {
    throw new Error("SHA-256 verification is unavailable in this browser");
  }
  const digest = await subtle.digest("SHA-256", bytesForDigest(bytes));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isSupportedSimTowerHash(filename, hash, allowlist = SUPPORTED_SIMTOWER_HASHES) {
  const hashes = allowlist[basenameUpper(filename)] || [];
  return hashes.includes(String(hash).toLowerCase());
}

// `file` follows the browser File subset used here: { name, arrayBuffer() }.
// The small interface keeps the verifier straightforward to test headlessly.
export async function verifySimTowerFile(file, {
  allowlist = SUPPORTED_SIMTOWER_HASHES,
  subtle = globalThis.crypto?.subtle,
} = {}) {
  if (!file || typeof file.arrayBuffer !== "function") {
    return { valid: false, reason: "missing_file", filename: "", hash: null, kind: null };
  }

  const filename = basenameUpper(file.name);
  const kind = simTowerFileKind(filename);
  if (!kind) {
    return { valid: false, reason: "unsupported_filename", filename, hash: null, kind: null };
  }

  let hash;
  try {
    hash = await sha256Hex(await file.arrayBuffer(), subtle);
  } catch (error) {
    return { valid: false, reason: "hash_failed", filename, hash: null, kind, error };
  }

  if (!isSupportedSimTowerHash(filename, hash, allowlist)) {
    return { valid: false, reason: "unrecognized_hash", filename, hash, kind };
  }
  return { valid: true, reason: null, filename, hash, kind };
}

export async function verifyGameOwnership(modeId, file, options) {
  const mode = gameMode(modeId);
  if (!mode) return { valid: false, reason: "unknown_mode", mode: null };
  if (!mode.enabled) return { valid: false, reason: "mode_unavailable", mode };
  if (mode.id === "simtower") {
    return { ...await verifySimTowerFile(file, options), mode };
  }
  if (mode.id === "opensky") {
    // The community art edition needs no user-supplied proof; selecting it in
    // the menu is the whole gate (the menu itself dev-console locks it).
    return { valid: true, reason: null, filename: "(community art pack)", hash: null, kind: null, mode };
  }
  return { valid: false, reason: "mode_unavailable", mode };
}

export function ownershipErrorMessage(result) {
  switch (result?.reason) {
    case "missing_file":
      return "Choose your SIMTOWER.EXE or SIMTOWER.EX_ file first.";
    case "unsupported_filename":
      return "Choose SIMTOWER.EXE or SIMTOWER.EX_.";
    case "unrecognized_hash":
      return "That file is not a supported original SimTower executable.";
    case "hash_failed":
      return "Could not calculate the file's SHA-256 hash. Try a current browser over HTTPS.";
    case "mode_unavailable":
      return result.mode?.unavailableReason || "That game mode is not available yet.";
    default:
      return "Could not verify this game edition.";
  }
}
