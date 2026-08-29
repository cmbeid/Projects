/**
 * Reader preferences that apply across every story, not just one
 * playthrough — separate from `persistence.ts`, which is scoped per story
 * id. Small and defensive in the same style: a missing or corrupt value
 * just falls back to the default rather than throwing.
 */

export type TextSize = 'small' | 'normal' | 'large';

const STORAGE_KEY = 'storied:prefs:textSize';
const DEFAULT_SIZE: TextSize = 'normal';

/** Multiplies on top of a story's own --sy-font-scale (format.md §8), never replaces it. */
export const TEXT_SIZE_SCALE: Record<TextSize, number> = {
  small: 0.9,
  normal: 1,
  large: 1.15,
};

function isTextSize(value: unknown): value is TextSize {
  return value === 'small' || value === 'normal' || value === 'large';
}

export function loadTextSize(): TextSize {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isTextSize(raw) ? raw : DEFAULT_SIZE;
  } catch {
    return DEFAULT_SIZE;
  }
}

export function saveTextSize(size: TextSize): void {
  try {
    localStorage.setItem(STORAGE_KEY, size);
  } catch {
    // Storage unavailable; the setting still applies for this session.
  }
}

/** Sets `--sy-user-scale` on the document root, so it reaches the shelf and the reader alike. */
export function applyTextSize(size: TextSize): void {
  document.documentElement.style.setProperty('--sy-user-scale', String(TEXT_SIZE_SCALE[size]));
}
