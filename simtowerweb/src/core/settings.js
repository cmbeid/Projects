// Player settings (CORE agent) — pure, DOM-free options model backing the
// Options dialog. Persists to localStorage (guarded) with an injectable
// storage param so it stays headless-testable. Zero deps.

export const SETTINGS_KEY = "opensky_settings";

export const DEFAULT_SETTINGS = Object.freeze({
  masterVolume: 0.8,
  muted: true,
  musicEnabled: true,
  sfxEnabled: true,
  defaultZoom: 0.5,
  zoomStep: 2,
});

export const ZOOM_MIN = 1 / 64;
export const ZOOM_MAX = 64;

// Coerce an arbitrary object into a valid settings object (clamp + fill).
export function normalizeSettings(input = {}) {
  const s = { ...DEFAULT_SETTINGS, ...(input || {}) };
  s.masterVolume = Math.max(0, Math.min(1, Number(s.masterVolume) || 0));
  s.muted = Boolean(s.muted);
  s.musicEnabled = s.musicEnabled !== false;
  s.sfxEnabled = s.sfxEnabled !== false;
  s.defaultZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Number(s.defaultZoom) || DEFAULT_SETTINGS.defaultZoom));
  s.zoomStep = Math.max(1, Number(s.zoomStep) || DEFAULT_SETTINGS.zoomStep);
  return s;
}

function defaultStorage() {
  return typeof localStorage !== "undefined" ? localStorage : null;
}

export function loadSettings(storage = defaultStorage()) {
  if (!storage) return { ...DEFAULT_SETTINGS };
  try {
    const raw = storage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings, storage = defaultStorage()) {
  if (!storage) return false;
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)));
    return true;
  } catch {
    return false;
  }
}
