/**
 * Layout mode and the board's coordinate system.
 *
 * The viewport can change size underneath a running game — a foldable opening
 * or closing, a rotation, the on-screen keyboard appearing — without any
 * navigation happening. Everything that depends on board size is funnelled
 * through here so a resize is one recalculation rather than a hunt for
 * whatever cached a pixel value.
 */

/** Below this width the inventory is a bottom drawer; at or above it, a sidebar. */
export const EXPANDED_BREAKPOINT = 700;

export type LayoutMode = 'compact' | 'expanded';

export interface BoardSize {
  width: number;
  height: number;
}

/** Rendered size of a token, in CSS pixels. Constant across layout modes. */
export const TOKEN_SIZE = 68;

/** Gap kept between a token and the board edge, so nothing sits flush. */
const EDGE_INSET = 8;

export function modeForWidth(width: number): LayoutMode {
  return width >= EXPANDED_BREAKPOINT ? 'expanded' : 'compact';
}

/**
 * Converts a fraction of the board into a top-left pixel position for a token.
 *
 * Tokens are positioned by their centre, so the returned coordinates are
 * inset by half a token and clamped to keep the whole token on the board —
 * which is what stops a token authored on a wide screen from ending up
 * half off a narrow one.
 */
export function toPixels(fx: number, fy: number, board: BoardSize): { x: number; y: number } {
  const maxX = Math.max(0, board.width - TOKEN_SIZE);
  const maxY = Math.max(0, board.height - TOKEN_SIZE);
  // Only inset when the board is actually big enough to afford it, so a very
  // small board still produces a valid (if flush) position.
  const insetX = maxX > EDGE_INSET * 2 ? EDGE_INSET : 0;
  const insetY = maxY > EDGE_INSET * 2 ? EDGE_INSET : 0;

  return {
    x: clamp(fx * board.width - TOKEN_SIZE / 2, insetX, maxX - insetX),
    y: clamp(fy * board.height - TOKEN_SIZE / 2, insetY, maxY - insetY),
  };
}

/** Converts a centre point in board pixels back into fractions. */
export function toFractions(x: number, y: number, board: BoardSize): { fx: number; fy: number } {
  return {
    fx: board.width === 0 ? 0.5 : clamp(x / board.width, 0, 1),
    fy: board.height === 0 ? 0.5 : clamp(y / board.height, 0, 1),
  };
}

/** The centre point, in board pixels, of a token at the given fractions. */
export function centerPixels(fx: number, fy: number, board: BoardSize): { x: number; y: number } {
  const { x, y } = toPixels(fx, fy, board);
  return { x: x + TOKEN_SIZE / 2, y: y + TOKEN_SIZE / 2 };
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

type ResizeListener = (size: BoardSize, mode: LayoutMode) => void;

/**
 * Watches the board element and republishes its size and the resulting layout
 * mode. One observer, one source of truth — components read the mode from here
 * instead of each measuring the window themselves and disagreeing.
 */
export class LayoutWatcher {
  private listeners = new Set<ResizeListener>();
  private observer: ResizeObserver | null = null;
  private size: BoardSize = { width: 0, height: 0 };
  private mode: LayoutMode = 'compact';

  constructor(private readonly board: HTMLElement) {}

  start(): void {
    this.measure();
    this.observer = new ResizeObserver(() => this.measure());
    this.observer.observe(this.board);
    // The board element itself does not resize when only the layout mode
    // flips, so watch the viewport too.
    window.addEventListener('resize', this.measure);
    window.addEventListener('orientationchange', this.measure);
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    window.removeEventListener('resize', this.measure);
    window.removeEventListener('orientationchange', this.measure);
  }

  getSize(): BoardSize {
    return this.size;
  }

  getMode(): LayoutMode {
    return this.mode;
  }

  subscribe(listener: ResizeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private measure = (): void => {
    const rect = this.board.getBoundingClientRect();
    const nextMode = modeForWidth(window.innerWidth);
    const changed =
      rect.width !== this.size.width || rect.height !== this.size.height || nextMode !== this.mode;
    if (!changed) return;

    this.size = { width: rect.width, height: rect.height };
    this.mode = nextMode;
    document.documentElement.dataset['layout'] = nextMode;

    for (const listener of this.listeners) listener(this.size, this.mode);
  };
}
