/**
 * Finding the frames in a sprite sheet by looking at it.
 *
 * Most of SimTower's sheets are a plain grid — four office states across a
 * 288px bitmap — and dividing by the state count is enough. Some are not: the
 * people sheet holds nine figures of six different widths, packed with only the
 * background between them. Cutting that on a uniform grid slices figures in
 * half, which is what made the crowd look wrong.
 *
 * A column holding nothing but the background colour is a gutter. The runs
 * between gutters are the frames, whatever width they happen to be.
 */

import type { IndexedImage } from './dib.js';

export interface Run {
  from: number;
  to: number;
}

function runsOf(flags: boolean[]): Run[] {
  const runs: Run[] = [];
  let start = -1;
  flags.forEach((set, index) => {
    if (set && start < 0) start = index;
    if (!set && start >= 0) {
      runs.push({ from: start, to: index - 1 });
      start = -1;
    }
  });
  if (start >= 0) runs.push({ from: start, to: flags.length - 1 });
  return runs;
}

/** Columns holding something other than `background`, grouped into runs. */
export function inkColumns(image: IndexedImage, background: number): Run[] {
  const flags: boolean[] = [];
  for (let x = 0; x < image.width; x += 1) {
    let ink = false;
    for (let y = 0; y < image.height && !ink; y += 1) {
      if (image.pixels[y * image.width + x] !== background) ink = true;
    }
    flags.push(ink);
  }
  return runsOf(flags);
}

/** Rows holding something other than `background`, grouped into runs. */
export function inkRows(image: IndexedImage, background: number): Run[] {
  const flags: boolean[] = [];
  for (let y = 0; y < image.height; y += 1) {
    let ink = false;
    for (let x = 0; x < image.width && !ink; x += 1) {
      if (image.pixels[y * image.width + x] !== background) ink = true;
    }
    flags.push(ink);
  }
  return runsOf(flags);
}

/** One candidate frame width, and how well the sheet repeats at it. */
export interface Period {
  /** Frame width in pixels. */
  width: number;
  /** How many frames of this width the sheet holds. */
  frames: number;
  /**
   * Fraction of pixels that disagree with the pixel one frame to the right,
   * from 0 (identical) to 1 (nothing matches). Rows of a single index are left
   * out: they agree with themselves at every lag and only dilute the score.
   */
  mismatch: number;
  /** The same, per row, top to bottom. A row with no variation reads as 0. */
  rows: number[];
}

/**
 * Below this a sheet is genuinely a row of states; above it, it is not.
 *
 * Measured, not chosen. Across eight sheets whose cut was already known, every
 * correct reading scored under 35% and every wrong one over 45%. The first
 * cutoff was 50%, and that gap is exactly what it let through: three hotel
 * sheets whose states alternate in pairs each scored best at *twice* their true
 * frame width, so the tool did not fall silent — it named a harmonic and
 * sounded sure. Refusing to answer is the only safe behaviour up there.
 */
export const REPEATS_BELOW = 0.35;

/**
 * How well a sheet repeats at each frame width it could plausibly have.
 *
 * The width of a sheet does not say how it is cut. A 288x24 bitmap is four
 * states of nine segments if it is an office and three states of twelve if it
 * is a shop; both divide into whole segments and the file says neither. Where a
 * sheet is a row of states it very nearly matches itself shifted by one frame,
 * and at any other width the walls land on each other's floors.
 *
 * Compared as indices rather than colours: a palette index is a name, not a
 * quantity, so "how far apart" two of them are means nothing and "are they the
 * same" means everything.
 *
 * This works on art with flat, strongly repeating structure — a lift car, a
 * flight of stairs, a shopfront — and does *not* work on a dense room facade,
 * where an empty office and a full one differ almost everywhere at pixel scale
 * and no width scores well. That is why the caller must treat a score above
 * `REPEATS_BELOW` as "cannot tell" and why `rows` is reported: a facade's
 * ceiling band repeats perfectly even when its floor does not, which a single
 * averaged number hides and a row profile shows.
 *
 * Candidates are the divisors of the width — a sheet of equal states divides
 * exactly — that are a whole number of segments and at least `minimum` wide.
 */
export function periods(image: IndexedImage, step: number, minimum: number): Period[] {
  // A row holding one index agrees with itself whatever the lag, so it says
  // nothing about the frame width and is left out of the average.
  const varies: boolean[] = [];
  for (let y = 0; y < image.height; y += 1) {
    const row = y * image.width;
    const first = image.pixels[row];
    let differs = false;
    for (let x = 1; x < image.width; x += 1) {
      if (image.pixels[row + x] !== first) {
        differs = true;
        break;
      }
    }
    varies.push(differs);
  }

  const results: Period[] = [];

  for (let width = minimum; width < image.width; width += step) {
    if (image.width % width !== 0) continue;

    let differing = 0;
    let compared = 0;
    const rows: number[] = [];

    for (let y = 0; y < image.height; y += 1) {
      const row = y * image.width;
      let rowDiffering = 0;
      let rowCompared = 0;
      for (let x = 0; x + width < image.width; x += 1) {
        if (image.pixels[row + x] !== image.pixels[row + x + width]) rowDiffering += 1;
        rowCompared += 1;
      }
      rows.push(rowCompared === 0 ? 0 : rowDiffering / rowCompared);
      if (varies[y] === true) {
        differing += rowDiffering;
        compared += rowCompared;
      }
    }

    results.push({
      width,
      frames: image.width / width,
      mismatch: compared === 0 ? 1 : differing / compared,
      rows,
    });
  }
  return results;
}

/**
 * Which candidate is the frame width, if any is.
 *
 * Two rules, both learned the hard way. A score above `REPEATS_BELOW` is not
 * an answer at all, however much better it is than the alternatives — that is
 * what stopped three hotel sheets being catalogued at twice their real width.
 * And among the readings that do hold, the narrowest is the frame: a sheet that
 * repeats every 64 pixels also repeats every 128, so the wide readings are
 * harmonics of the answer rather than rivals to it.
 */
export function bestPeriod(candidates: readonly Period[]): Period | undefined {
  if (candidates.length === 0) return undefined;

  const lowest = candidates.reduce((a, b) => (b.mismatch < a.mismatch ? b : a));
  if (lowest.mismatch > REPEATS_BELOW) return undefined;
  return holding(candidates, lowest)[0];
}

/** The readings close enough to the best to be the same repeat, narrowest first. */
export function holding(candidates: readonly Period[], lowest: Period): Period[] {
  return candidates.filter((entry) => entry.mismatch <= Math.max(lowest.mismatch * 1.8, 0.02));
}
