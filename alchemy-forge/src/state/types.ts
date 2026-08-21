/**
 * A token sitting on the board.
 *
 * Position is stored as a fraction of the board's width and height rather than
 * in pixels. The board changes size underneath a running game — a foldable
 * opening, a rotation, the keyboard appearing — and fractions survive all of
 * it. Pixels only exist at render time.
 */
export interface Token {
  /** Unique per token, not per element: the same element can be on the board twice. */
  uid: number;
  elementId: string;
  /** 0–1 across the board's width. */
  fx: number;
  /** 0–1 down the board's height. */
  fy: number;
}

export interface Settings {
  sound: boolean;
}

export interface GameState {
  /** Element ids the player has discovered, in discovery order. */
  discovered: string[];
  tokens: Token[];
  settings: Settings;
  /** Number of hints taken, shown in stats. */
  hintsUsed: number;
  /** Monotonic counter backing `Token.uid`. */
  nextUid: number;
}

/** What happened when two tokens were dropped on each other. */
export type CombineResult =
  | { kind: 'none' }
  | {
      kind: 'combined';
      outputs: string[];
      /** The subset of `outputs` the player had never seen before. */
      discoveries: string[];
    };
