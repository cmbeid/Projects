// Save-file integrity hash (CORE agent) — tamper-evidence for .tower saves.
// Pure JS, zero deps. FNV-1a 32-bit over the canonical XML string (excluding
// the hash attribute), salted with OPENSKYWEB_SAVE_SALT (dev fallback so
// headless tests/CI need no env). Headless-safe: process/env read is guarded.

export const DEV_SAVE_SALT = "openskyweb-dev-salt";

export function getSaveSalt() {
  if (typeof process !== "undefined" && process.env && process.env.OPENSKYWEB_SAVE_SALT) {
    return process.env.OPENSKYWEB_SAVE_SALT;
  }
  return DEV_SAVE_SALT;
}

export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function computeSaveHash(xmlWithoutHash, salt = getSaveSalt()) {
  return fnv1a(salt + "\u0000" + xmlWithoutHash);
}

// Insert the hash attribute as the FIRST attribute of the root <tower ...> tag.
export function injectSaveHash(xml, salt = getSaveSalt()) {
  const tag = "<tower";
  const idx = xml.indexOf(tag);
  if (idx < 0) return xml;
  const hash = computeSaveHash(xml, salt);
  return xml.slice(0, idx + tag.length) + ` hash="${hash}"` + xml.slice(idx + tag.length);
}

// Returns { valid, legacy, hash, computed }. legacy=true when no hash attribute.
export function verifySaveHash(text, salt = getSaveSalt()) {
  const m = /<tower hash="([0-9a-fA-F]+)"/.exec(text);
  if (!m) return { valid: true, legacy: true, hash: null, computed: null };
  const stored = m[1].toLowerCase();
  const withoutHash = text.replace(/<tower hash="[0-9a-fA-F]+"/, "<tower");
  const computed = computeSaveHash(withoutHash, salt);
  return { valid: computed === stored, legacy: false, hash: stored, computed };
}
