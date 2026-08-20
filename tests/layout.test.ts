import { describe, expect, it } from 'vitest';
import {
  EXPANDED_BREAKPOINT,
  TOKEN_SIZE,
  centerPixels,
  modeForWidth,
  toFractions,
  toPixels,
} from '../src/ui/layout';

const FOLD_COVER = { width: 412, height: 700 };
const FOLD_INNER = { width: 600, height: 640 };

describe('layout mode', () => {
  it('puts a Pixel Fold cover screen in compact', () => {
    expect(modeForWidth(412)).toBe('compact');
  });

  it('puts a Pixel Fold inner screen in expanded', () => {
    expect(modeForWidth(840)).toBe('expanded');
  });

  it('switches exactly at the breakpoint', () => {
    expect(modeForWidth(EXPANDED_BREAKPOINT - 1)).toBe('compact');
    expect(modeForWidth(EXPANDED_BREAKPOINT)).toBe('expanded');
  });
});

describe('board coordinates', () => {
  it('round-trips a centre point back to the same fractions', () => {
    const board = FOLD_INNER;
    const { x, y } = centerPixels(0.4, 0.6, board);
    const { fx, fy } = toFractions(x, y, board);
    expect(fx).toBeCloseTo(0.4, 5);
    expect(fy).toBeCloseTo(0.6, 5);
  });

  it('keeps a token fully on the board at the far edges', () => {
    for (const board of [FOLD_COVER, FOLD_INNER]) {
      const bottomRight = toPixels(1, 1, board);
      expect(bottomRight.x).toBeLessThanOrEqual(board.width - TOKEN_SIZE);
      expect(bottomRight.y).toBeLessThanOrEqual(board.height - TOKEN_SIZE);

      const topLeft = toPixels(0, 0, board);
      expect(topLeft.x).toBeGreaterThanOrEqual(0);
      expect(topLeft.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('keeps tokens on screen when the inner screen folds shut', () => {
    // A token dropped near the right edge of the unfolded screen must still be
    // visible once the viewport narrows to the cover screen. This is the whole
    // reason positions are stored as fractions.
    const fx = 0.95;
    const fy = 0.5;

    const folded = toPixels(fx, fy, FOLD_COVER);
    expect(folded.x).toBeGreaterThanOrEqual(0);
    expect(folded.x + TOKEN_SIZE).toBeLessThanOrEqual(FOLD_COVER.width);
    expect(folded.y + TOKEN_SIZE).toBeLessThanOrEqual(FOLD_COVER.height);
  });

  it('clamps fractions that arrive out of range', () => {
    const board = FOLD_COVER;
    expect(toFractions(-500, -500, board)).toEqual({ fx: 0, fy: 0 });
    expect(toFractions(99_999, 99_999, board)).toEqual({ fx: 1, fy: 1 });
  });

  it('does not divide by zero on a board that has not been measured yet', () => {
    const empty = { width: 0, height: 0 };
    expect(toFractions(10, 10, empty)).toEqual({ fx: 0.5, fy: 0.5 });
    const pixels = toPixels(0.5, 0.5, empty);
    expect(Number.isFinite(pixels.x)).toBe(true);
    expect(Number.isFinite(pixels.y)).toBe(true);
  });
});
