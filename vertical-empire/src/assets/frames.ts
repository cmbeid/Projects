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
   * from 0 (identical) to 1 (nothing matches).
   */
  mismatch: number;
}

/**
 * How well a sheet repeats at each frame width it could plausibly have.
 *
 * The width of a sheet does not say how it is cut. A 288x24 bitmap is four
 * states of nine segments if it is an office and three states of twelve if it
 * is a shop; both divide into whole segments and the file says neither. But a
 * sheet of states is a picture of the same room several times over, so at the
 * true frame width it very nearly matches itself shifted by one frame — and at
 * any other width the walls and windows land on each other's floors.
 *
 * Compared as indices rather than colours: a palette index is a name, not a
 * quantity, so "how far apart" two of them are means nothing and "are they the
 * same" means everything.
 *
 * Candidates are the divisors of the width — a sheet of equal states divides
 * exactly — that are a whole number of segments and at least `minimum` wide.
 */
export function periods(image: IndexedImage, step: number, minimum: number): Period[] {
  const results: Period[] = [];

  for (let width = minimum; width < image.width; width += step) {
    if (image.width % width !== 0) continue;

    let differing = 0;
    let compared = 0;
    for (let y = 0; y < image.height; y += 1) {
      const row = y * image.width;
      for (let x = 0; x + width < image.width; x += 1) {
        if (image.pixels[row + x] !== image.pixels[row + x + width]) differing += 1;
        compared += 1;
      }
    }

    results.push({
      width,
      frames: image.width / width,
      mismatch: compared === 0 ? 1 : differing / compared,
    });
  }
  return results;
}
