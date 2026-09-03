/**
 * Measures the frame grid of a sprite sheet instead of guessing at it.
 *
 * Every remaining question about the catalogue is the same question: where are
 * the frame boundaries, and how big is the figure inside one? Both are visible
 * in the pixels. A sheet of figures separated by background has columns that
 * are entirely background — those are the gutters, and they give the frame
 * width and count with no eyeballing at all. The rows that contain any ink give
 * the figure's real height, which is what says whether a 96x24 people sheet
 * holds 24-tall figures or 12-tall ones with headroom.
 *
 * Node only; the game never needs this.
 */

import type { IndexedImage } from '../src/assets/dib.js';
import { inkColumns, inkRows, type Run } from '../src/assets/frames.js';
import type { Palette } from '../src/assets/palette.js';

export type { Run };

export interface FrameAnalysis {
  /** Index treated as background: the sheet's own top-left pixel. */
  background: number;
  /** Runs of columns holding something other than background. */
  inkColumns: Run[];
  /** Runs of rows holding something other than background. */
  inkRows: Run[];
  /** Distinct widths among the ink column runs, commonest first. */
  widths: { width: number; count: number }[];
}

export function analyse(image: IndexedImage): FrameAnalysis {
  const background = image.pixels[0] ?? 0;
  const columns = inkColumns(image, background);

  const tally = new Map<number, number>();
  for (const run of columns) {
    const width = run.to - run.from + 1;
    tally.set(width, (tally.get(width) ?? 0) + 1);
  }

  return {
    background,
    inkColumns: columns,
    inkRows: inkRows(image, background),
    widths: [...tally.entries()]
      .map(([width, count]) => ({ width, count }))
      .sort((a, b) => b.count - a.count || a.width - b.width),
  };
}

/** Widest sheet still worth printing pixel by pixel. */
export const ASCII_LIMIT = 160;

const RAMP = ' .:-=+*#%@';

/**
 * Draws the sheet as text, shading by how bright each palette entry is.
 *
 * Background is a space, so frame gutters show as blank columns you can count.
 */
export function ascii(image: IndexedImage, palette: Palette, background: number): string[] {
  const lines: string[] = [];
  for (let y = 0; y < image.height; y += 1) {
    let line = '';
    for (let x = 0; x < image.width; x += 1) {
      const index = image.pixels[y * image.width + x] ?? 0;
      if (index === background) {
        line += ' ';
        continue;
      }
      const luma =
        (palette[index * 4] ?? 0) * 0.299 +
        (palette[index * 4 + 1] ?? 0) * 0.587 +
        (palette[index * 4 + 2] ?? 0) * 0.114;
      const step = Math.min(RAMP.length - 1, Math.max(0, Math.round((luma / 255) * (RAMP.length - 1))));
      // Inverted: dark ink prints heavy, which reads better in a terminal.
      line += RAMP[RAMP.length - 1 - step] ?? '#';
    }
    lines.push(line.replace(/\s+$/, ''));
  }
  return lines;
}

/**
 * A one-line-per-column ink profile, for sheets too wide to print.
 *
 * Each character is one column: blank for a gutter, otherwise a bar whose
 * height is how much of that column is ink.
 */
export function profile(image: IndexedImage, background: number): string {
  const bars = ' ▁▂▃▄▅▆▇█';
  let out = '';
  for (let x = 0; x < image.width; x += 1) {
    let ink = 0;
    for (let y = 0; y < image.height; y += 1) {
      if (image.pixels[y * image.width + x] !== background) ink += 1;
    }
    const step = Math.min(bars.length - 1, Math.round((ink / image.height) * (bars.length - 1)));
    out += bars[step] ?? ' ';
  }
  return out;
}

/**
 * The numbers an ID token could mean.
 *
 * npm rewrites a hex argument to its decimal value before the script ever sees
 * it — `--frames 0x82bc` arrives as `33468` — so a bare decimal has to be tried
 * as well as a hex reading. Which one was meant is then settled by looking both
 * up: at most one of them is a resource that exists.
 */
export function candidates(token: string): number[] {
  const readings: number[] = [];
  const bare = token.replace(/^0x/i, '');
  if (/^[0-9a-f]+$/i.test(bare)) readings.push(Number.parseInt(bare, 16));
  if (/^[0-9]+$/.test(token)) readings.push(Number.parseInt(token, 10));
  return [...new Set(readings)].filter((value) => Number.isFinite(value));
}

export function parseIdTokens(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** Everything the CLI takes, once the argument list has been read. */
export interface Options {
  /** The file to open. Absent means there is nothing to do but print usage. */
  path?: string;
  all: boolean;
  framesIds: string[];
  contactIds: string[];
  sweep: boolean;
  /** How much of each resource a sweep thumbnail shows, in pixels. */
  peek: number;
  window?: { from: number; to: number };
}

/**
 * Reads the argument list.
 *
 * Separated out and tested because getting it wrong is silent: the file simply
 * is not found and the usage text prints, which looks like the user's mistake.
 * It has been wrong twice. `indexOf` returns -1 for a flag that is not there,
 * and -1 + 1 is 0 — so a check meant to skip a flag's value claimed argument
 * zero instead, and `extract SIMTOWER.EXE` could not find its own filename.
 */
export function parseArgs(args: readonly string[]): Options {
  const at = (flag: string): number => args.indexOf(flag);

  const framesAt = at('--frames');
  const contactAt = at('--contact');
  const windowAt = at('--window');
  const sweepAt = at('--sweep');

  // `--sweep` takes an optional size, so whether it consumed the next argument
  // depends on whether that argument is a number.
  const sweepPeek = sweepAt >= 0 ? Number(args[sweepAt + 1]) : Number.NaN;
  const sweepTookValue = sweepAt >= 0 && Number.isFinite(sweepPeek);

  // Positions that belong to a flag rather than naming the file. Only flags
  // that are actually present contribute one.
  const consumed = new Set<number>();
  for (const position of [framesAt, contactAt, windowAt]) {
    if (position >= 0) consumed.add(position + 1);
  }
  if (sweepTookValue) consumed.add(sweepAt + 1);

  const windowArg = windowAt >= 0 ? (args[windowAt + 1] ?? '').split(',').map(Number) : [];
  const window =
    windowArg.length === 2 && windowArg.every((value) => Number.isFinite(value))
      ? { from: windowArg[0] ?? 0, to: windowArg[1] ?? 0 }
      : undefined;

  const path = args.find((argument, index) => !argument.startsWith('--') && !consumed.has(index));

  const options: Options = {
    all: args.includes('--all'),
    framesIds: framesAt >= 0 ? parseIdTokens(args[framesAt + 1] ?? '') : [],
    contactIds: contactAt >= 0 ? parseIdTokens(args[contactAt + 1] ?? '') : [],
    sweep: sweepAt >= 0,
    peek: sweepTookValue && sweepPeek > 0 ? Math.floor(sweepPeek) : 40,
  };
  if (path !== undefined) options.path = path;
  if (window !== undefined) options.window = window;
  return options;
}
