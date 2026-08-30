/**
 * format.md §8: maps a story or node theme onto CSS custom properties on a
 * scoped root element, filling in the app's own defaults for anything the
 * theme omits and applying the clamps §8 promises (`parse.ts` only checks
 * that these are finite numbers — range-checking a value belongs at the
 * point it's applied, not baked into the parser).
 */
import type { FontId, PartialTheme, Theme, ThemePalette } from '../content/types';

const DARK_PALETTE: Required<ThemePalette> = {
  bg: '#0b0f14',
  surface: '#141b24',
  text: '#e8eef7',
  dim: '#8b9bb0',
  accent: '#d9a441',
  choiceBg: '#1a2430',
};

const LIGHT_PALETTE: Required<ThemePalette> = {
  bg: '#f7f3ec',
  surface: '#ffffff',
  text: '#1c1a16',
  dim: '#6b6558',
  accent: '#8a5a2c',
  choiceBg: '#efe9df',
};

const FONT_STACKS: Record<FontId, string> = {
  serif: 'Georgia, "Iowan Old Style", "Palatino Linotype", serif',
  sans: '-apple-system, system-ui, "Segoe UI", Roboto, sans-serif',
  mono: '"SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace',
  display: 'Georgia, "Times New Roman", serif',
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * A node's `theme` merges over the story's key by key — §8: "set only the
 * keys that should change" — so an override naming only `palette.accent`
 * leaves every other palette color, and every font/background field, alone.
 * `background` is the one whole-object field: a node with its own
 * background image is a full scene change, not a partial one.
 */
export function mergeTheme(base: Theme, override: PartialTheme | undefined): Theme {
  if (!override) return base;
  const mode = override.mode ?? base.mode;
  const radius = override.radius ?? base.radius;
  const background = override.background ?? base.background;
  return {
    ...(mode !== undefined ? { mode } : {}),
    palette: { ...base.palette, ...override.palette },
    font: { ...base.font, ...override.font },
    ...(background !== undefined ? { background } : {}),
    ...(radius !== undefined ? { radius } : {}),
  };
}

/** Resolves a theme-relative path (an image `src`) to a fetchable URL. */
export type AssetResolver = (relativePath: string) => string;

/**
 * Writes every §8 token onto `root` as a `--sy-*` custom property. The
 * cross-fade PLAN.md §4 asks for when a node's override applies isn't
 * animating these variables directly (transitioning color-typed custom
 * properties has inconsistent browser support) — `styles/reader.css` puts a
 * `transition` on the concrete properties that consume them instead, so the
 * fade happens as a side effect of a plain CSS variable swap.
 */
export function applyTheme(root: HTMLElement, theme: Theme | undefined, resolveAsset: AssetResolver): void {
  const mode = theme?.mode ?? 'dark';
  const defaults = mode === 'light' ? LIGHT_PALETTE : DARK_PALETTE;
  const palette = { ...defaults, ...theme?.palette };

  root.style.setProperty('--sy-bg', palette.bg);
  root.style.setProperty('--sy-surface', palette.surface);
  root.style.setProperty('--sy-text', palette.text);
  root.style.setProperty('--sy-dim', palette.dim);
  root.style.setProperty('--sy-accent', palette.accent);
  root.style.setProperty('--sy-choice-bg', palette.choiceBg);

  const bodyFont = theme?.font?.body ?? 'sans';
  const displayFont = theme?.font?.display ?? 'sans';
  const scale = clamp(theme?.font?.scale ?? 1, 0.85, 1.3);
  root.style.setProperty('--sy-font-body', FONT_STACKS[bodyFont]);
  root.style.setProperty('--sy-font-display', FONT_STACKS[displayFont]);
  root.style.setProperty('--sy-font-scale', String(scale));

  const radius = clamp(theme?.radius ?? 14, 0, 32);
  root.style.setProperty('--sy-radius', `${radius}px`);

  root.dataset['mode'] = mode;

  const background = theme?.background;
  if (background?.image) {
    root.style.setProperty('--sy-bg-image', `url("${resolveAsset(background.image)}")`);
    root.style.setProperty('--sy-bg-fit', background.fit ?? 'cover');
    root.style.setProperty('--sy-bg-overlay', String(clamp(background.overlay ?? 0.5, 0, 0.9)));
    root.style.setProperty('--sy-bg-overlay-rgb', mode === 'light' ? '255,255,255' : '0,0,0');
    root.dataset['hasBgImage'] = 'true';
  } else {
    root.style.removeProperty('--sy-bg-image');
    delete root.dataset['hasBgImage'];
  }
}
