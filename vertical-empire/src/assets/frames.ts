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
