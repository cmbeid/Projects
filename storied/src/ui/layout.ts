/**
 * The reader's three layout modes and the live breakpoint watcher — see
 * format.md's implied shell shapes and PLAN.md §4. `modeForWidth` mirrors
 * `alchemy-forge/src/ui/layout.ts`'s pattern (a pure function plus a
 * dedicated test); the watcher itself follows `starseed/src/ui/layout.ts`'s
 * `matchMedia` approach rather than alchemy-forge's `ResizeObserver` one,
 * since the mode here depends only on viewport width, not a measured
 * element's box.
 */

export type LayoutMode = 'compact' | 'medium' | 'wide';

/** Below this: phone portrait, one column, choice deck at the bottom. */
export const MEDIUM_BREAKPOINT = 700;
/** At or above this: two panes — image and chrome left, text and choices right. */
export const WIDE_BREAKPOINT = 1024;

export function modeForWidth(width: number): LayoutMode {
  if (width >= WIDE_BREAKPOINT) return 'wide';
  if (width >= MEDIUM_BREAKPOINT) return 'medium';
  return 'compact';
}

/**
 * Calls `onChange` immediately with the current mode, then again every time
 * either breakpoint is crossed — including a fold or unfold that changes the
 * viewport with no navigation and no reload. Returns an unsubscribe function.
 */
export function watchLayout(onChange: (mode: LayoutMode) => void): () => void {
  const mediumQuery = window.matchMedia(`(min-width: ${MEDIUM_BREAKPOINT}px)`);
  const wideQuery = window.matchMedia(`(min-width: ${WIDE_BREAKPOINT}px)`);

  const apply = (): void => onChange(modeForWidth(window.innerWidth));
  mediumQuery.addEventListener('change', apply);
  wideQuery.addEventListener('change', apply);
  apply();

  return () => {
    mediumQuery.removeEventListener('change', apply);
    wideQuery.removeEventListener('change', apply);
  };
}
