/**
 * Dumps what is inside a copy of SimTower, so the resource map in
 * `src/assets/slice.ts` can be checked against the real thing.
 *
 *     npm run extract -- /path/to/SIMTOWER.EXE
 *
 * The game file stays where it is and nothing it produces is committed: output
 * goes to `assets-private/`, which the repository ignores. The art belongs to
 * Maxis / OPeNBooK / Yoot Saito, so it is yours to look at on your own machine
 * and nobody's to redistribute.
 *
 * The inventory is the useful half. The catalogue was written against published
 * format documentation rather than a copy of the game, so if a sprite comes out
 * wrong, the inventory tells you which resource IDs actually exist and the PNGs
 * tell you what is in them.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { crop, decodeDIB, inferCellHeight, readCellStrip, type IndexedImage } from '../src/assets/dib.js';
import { hex, readResources, type ResourceTable } from '../src/assets/ne.js';
import {
  CATALOGUE,
  FLOOR_HEIGHT,
  ROOM_HEIGHT,
  SEGMENT_WIDTH,
  TYPE_BITMAP,
  TYPE_CELLS,
  TYPE_PALETTE,
  TYPE_SOUND,
  extract,
} from '../src/assets/slice.js';
import { encodePNG } from './png.js';
import { ASCII_LIMIT, analyse, ascii, candidates, parseArgs, profile } from './frames.js';
import { REPEATS_BELOW, bestPeriod, holding, periods } from '../src/assets/frames.js';
import { GLYPH_HEIGHT, drawText } from './label.js';
import { darkestIndex } from '../src/assets/palette.js';

const OUT = 'assets-private';

/**
 * The `0x80xx` codes are the standard Windows resource types with the
 * integer-id bit set; the `0xFFxx` ones are SimTower's own. Naming them keeps
 * the inventory readable and stops the standard half looking mysterious.
 */
const TYPE_NAMES = new Map([
  [0x8001, 'cursors'],
  [TYPE_BITMAP, 'bitmaps'],
  [0x8003, 'icons'],
  [0x8004, 'menus'],
  [0x8005, 'dialogs'],
  [0x8006, 'strings'],
  [0x8009, 'accelerators'],
  [0x800a, 'raw data'],
  [0x800c, 'cursor groups'],
  [0x800e, 'icon groups'],
  [0x800f, 'version info'],
  [TYPE_CELLS, 'cell strips'],
  [TYPE_PALETTE, 'palettes'],
  [TYPE_SOUND, 'sounds'],
]);

/**
 * What a resource turns out to be once decoded, in the terms that identify it.
 *
 * Size is the tell. Everything SimTower draws is a whole number of 8px segments
 * wide and 36px floors tall, so "144x36" is not a dimension so much as a name:
 * an eighteen-segment, one-floor facility. This is what lets the catalogue be
 * corrected without opening a single PNG.
 */
function shape(type: number, data: Uint8Array): string {
  if (type === TYPE_BITMAP) {
    try {
      const { width, height } = decodeDIB(data);
      return `${`${width}x${height}`.padEnd(9)} ${grid(width, height)}`;
    } catch (error) {
      return `undecodable — ${(error as Error).message}`;
    }
  }
  if (type === TYPE_CELLS) {
    const height = inferCellHeight(data.byteLength, SEGMENT_WIDTH);
    if (height === undefined) return `${data.byteLength} bytes — no whole cell height fits`;
    const width = (data.byteLength / (SEGMENT_WIDTH * height)) * SEGMENT_WIDTH;
    // Cell height is called out because it is not the floor height: strips are
    // 32 tall where a floor is 36.
    return `${`${width}x${height}`.padEnd(9)} ${grid(width, FLOOR_HEIGHT)} of ${height}px cells`;
  }
  return `${data.byteLength} bytes`;
}

function grid(width: number, height: number): string {
  const segments = width / SEGMENT_WIDTH;
  if (!Number.isInteger(segments)) return '(off-grid)';

  // Two heights are on-grid, not one. A full floor is 36; a room facade is 24,
  // the other twelve being structure the game draws itself. Reporting only the
  // first is what made the real file's facilities look like arbitrary art.
  if (height === ROOM_HEIGHT) return `${segments} seg x 1 room`;
  const floors = height / FLOOR_HEIGHT;
  if (!Number.isInteger(floors)) return `${segments} seg, ${height}px tall`;
  return `${segments} seg x ${floors} floor${floors === 1 ? '' : 's'}`;
}

function inventory(resources: ResourceTable): void {
  console.log('\nResources found:');
  for (const [type, byId] of [...resources.entries()].sort((a, b) => a[0] - b[0])) {
    const ids = [...byId.keys()].sort((a, b) => a - b);
    const label = TYPE_NAMES.get(type) ?? 'unknown';
    console.log(`  ${hex(type)}  ${String(ids.length).padStart(4)} ${label}`);
    // Enough of the range to recognise, without pages of hex.
    const shown = ids.slice(0, 8).map(hex).join(' ');
    const more = ids.length > 8 ? ` … ${hex(ids[ids.length - 1] ?? 0)}` : '';
    console.log(`          ${shown}${more}`);
  }
}

/**
 * The art, grouped by what shape it is.
 *
 * One line per distinct size, listing every ID that has it. A 250-entry bitmap
 * table collapses to a couple of dozen lines, and each line reads as a
 * candidate: "9 seg x 1 floor" is an office, "4 seg x 1 floor" is a lift car or
 * a hotel single, "1 seg x 1 floor" is lobby or sky.
 */
function shapes(resources: ResourceTable): void {
  for (const type of [TYPE_BITMAP, TYPE_CELLS]) {
    const byId = resources.get(type);
    if (!byId) continue;

    const groups = new Map<string, number[]>();
    for (const [id, data] of byId) {
      const key = shape(type, data);
      const bucket = groups.get(key) ?? [];
      bucket.push(id);
      groups.set(key, bucket);
    }

    console.log(`\n${hex(type)} ${TYPE_NAMES.get(type) ?? 'unknown'} by shape:`);
    // Widest first: the big sheets are the multi-state facilities, and they are
    // the ones the catalogue most needs to get right.
    const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
    for (const [key, ids] of sorted) {
      console.log(`  ${key.padEnd(34)} ${ids.sort((a, b) => a - b).map(hex).join(' ')}`);
    }
  }
}

/**
 * Dumps every bitmap and cell strip, named by type and ID rather than by what
 * the catalogue thinks it is. This is the mode to use while the catalogue is
 * still wrong: `raw-0x8002-0x85a8.png` makes no claim about being an office.
 */
async function dumpEverything(resources: ResourceTable, palette: Uint8Array): Promise<number> {
  let written = 0;
  for (const type of [TYPE_BITMAP, TYPE_CELLS]) {
    const byId = resources.get(type);
    if (!byId) continue;

    for (const [id, data] of byId) {
      try {
        const image =
          type === TYPE_BITMAP
            ? decodeDIB(data)
            : readCellStrip(data, SEGMENT_WIDTH);
        const table = image.palette ?? palette;
        await writeFile(
          join(OUT, `raw-${hex(type)}-${hex(id)}.png`),
          encodePNG(image.width, image.height, image.pixels, table),
        );
        written += 1;
      } catch {
        // Undecodable resources are already named in the shape listing.
      }
    }
  }
  return written;
}

/**
 * Reports the frame grid of specific resources.
 *
 * This is the mode that answers "how is this sheet cut" without anyone having
 * to open a PNG and describe it. Gutter columns give the frame boundaries; the
 * ink rows give the figure height inside them.
 */
function frames(
  resources: ResourceTable,
  tokens: string[],
  palette: Uint8Array,
  window?: { from: number; to: number },
): void {
  for (const token of tokens) {
    const readings = candidates(token);
    const found = readings
      .flatMap((id) => [TYPE_BITMAP, TYPE_CELLS].map((type) => ({ id, type, data: resources.get(type)?.get(id) })))
      .find((candidate) => candidate.data !== undefined);

    if (!found?.data) {
      const tried = readings.map(hex).join(' or ') || 'nothing parseable';
      console.log(`\n${token}: no bitmap or cell strip at ${tried}.`);
      continue;
    }
    const id = found.id;

    let image;
    try {
      image =
        found.type === TYPE_BITMAP
          ? decodeDIB(found.data)
          : readCellStrip(found.data, SEGMENT_WIDTH);
    } catch (error) {
      console.log(`\n${hex(id)}: ${(error as Error).message}`);
      continue;
    }

    // A 1120px strip cannot be printed, but a window into it can. The analysis
    // runs on the window too, so the numbers describe what you are looking at.
    if (window) {
      const from = Math.max(0, Math.min(image.width - 1, window.from));
      const to = Math.max(from + 1, Math.min(image.width, window.to));
      image = crop(image, from, 0, to - from, image.height);
    }

    const report = analyse(image);
    const inkTop = report.inkRows[0]?.from;
    const inkBottom = report.inkRows[report.inkRows.length - 1]?.to;

    console.log(`\n${hex(found.type)}/${hex(id)}  ${image.width}x${image.height}  background index ${report.background}`);
    console.log(`  ${report.inkColumns.length} ink runs across, widths: ${report.widths.map((entry: { width: number; count: number }) => `${entry.width}x${entry.count}`).join(', ') || 'none'}`);
    if (inkTop !== undefined && inkBottom !== undefined) {
      console.log(`  ink rows ${inkTop}..${inkBottom} — figure is ${inkBottom - inkTop + 1}px tall in a ${image.height}px sheet`);
    }
    // Column starts say whether the runs are evenly spaced, which is what makes
    // a grid a grid rather than a row of differently sized things.
    console.log(`  run starts: ${report.inkColumns.slice(0, 24).map((run: { from: number }) => run.from).join(' ')}${report.inkColumns.length > 24 ? ' …' : ''}`);

    if (image.width <= ASCII_LIMIT) {
      for (const line of ascii(image, image.palette ?? palette, report.background)) console.log(`  |${line}`);
    } else {
      console.log(`  ${profile(image, report.background)}`);
    }
  }
}

/**
 * Per-row agreement as one string, top row leftmost.
 *
 * The averaged number is what failed on room facades: an office's ceiling band
 * repeats perfectly across states and only its furniture rows do not, and the
 * mean of those two hides both. Here they are side by side, so a sheet the
 * measurement cannot score is still a sheet you can read.
 */
function bars(rows: readonly number[]): string {
  const ramp = '#%*+=-:. ';
  let out = '';
  for (const mismatch of rows) {
    const step = Math.min(ramp.length - 1, Math.max(0, Math.round(mismatch * (ramp.length - 1))));
    out += ramp[step] ?? ' ';
  }
  return out;
}

/**
 * Reports how well each sheet repeats at every frame width it could have.
 *
 * This is the mode that decides a catalogue entry's `states`. The lowest
 * mismatch is the answer, but the whole table is printed rather than a verdict:
 * a sheet with two plausible readings is worth seeing as two plausible
 * readings, and a table where nothing stands out means the sheet is not a row
 * of states at all.
 */
function report(resources: ResourceTable, tokens: string[]): void {
  for (const token of tokens) {
    const found = resolve(resources, token);
    if (!found) continue;

    const { image } = found;
    // Four segments is the narrowest thing SimTower builds — a lift car or a
    // hotel single — so nothing below that is a real frame.
    const candidates = periods(image, SEGMENT_WIDTH, SEGMENT_WIDTH * 4);
    console.log(`\n${hex(found.type)}/${hex(found.id)}  ${image.width}x${image.height}`);
    if (candidates.length === 0) {
      console.log(`  no whole-segment division below ${image.width}px — one frame`);
      continue;
    }

    const lowest = candidates.reduce((a, b) => (b.mismatch < a.mismatch ? b : a));
    const answer = bestPeriod(candidates);
    const strong = holding(candidates, lowest);

    for (const candidate of candidates) {
      const segments = candidate.width / SEGMENT_WIDTH;
      const mark = candidate === answer ? '<-' : '  ';
      console.log(
        `  ${mark} ${String(candidate.frames).padStart(3)} x ${String(candidate.width).padStart(4)}px` +
          ` = ${String(segments).padStart(3)} seg   mismatch ${(candidate.mismatch * 100).toFixed(1).padStart(5)}%` +
          `  ${bars(candidate.rows)}`,
      );
    }

    if (!answer) {
      // Not "one frame": that would be a claim. This measurement cannot tell,
      // and a dense room facade is exactly where it cannot — its states differ
      // almost everywhere at pixel scale. The row profile above is the thing to
      // read instead: a band of near-zero rows at some width is a real repeat
      // the average has drowned.
      console.log(`     no reading below ${(REPEATS_BELOW * 100).toFixed(0)}% — cannot tell from repetition alone`);
    } else if (strong.length > 1) {
      // Worth saying out loud: the arrow is a reading, not a measurement.
      console.log(`     (${strong.length} readings hold; the narrowest is the frame, the rest are multiples of it)`);
    }
  }
}

/** One resource laid out for the sheet: wrapped into rows of at most `wrapAt`. */
interface Panel {
  label: string;
  image: IndexedImage;
  rows: number;
  width: number;
  height: number;
}

/** Rows are separated so the seams read as seams rather than as part of the art. */
const GAP = 2;

function panelFor(label: string, image: IndexedImage, wrapAt: number): Panel {
  const rows = Math.ceil(image.width / wrapAt);
  return {
    label,
    image,
    rows,
    width: Math.min(image.width, wrapAt),
    height: rows * image.height + (rows - 1) * GAP,
  };
}

/** Finds a resource by ID token, trying both readings, and decodes it. */
function resolve(
  resources: ResourceTable,
  token: string,
): { id: number; type: number; image: IndexedImage } | undefined {
  const readings = candidates(token);
  const found = readings
    .flatMap((id) => [TYPE_BITMAP, TYPE_CELLS].map((type) => ({ id, type, data: resources.get(type)?.get(id) })))
    .find((candidate) => candidate.data !== undefined);
  if (!found?.data) {
    console.log(`${token}: nothing at ${readings.map(hex).join(' or ') || 'any reading'}`);
    return undefined;
  }
  try {
    const image = found.type === TYPE_BITMAP ? decodeDIB(found.data) : readCellStrip(found.data, SEGMENT_WIDTH);
    return { id: found.id, type: found.type, image };
  } catch (error) {
    console.log(`${token}: ${(error as Error).message}`);
    return undefined;
  }
}

/**
 * Pastes panels down onto one PNG, labelled, and scales it up.
 *
 * Panels flow across into as many columns as fit the target width, so a sweep
 * of two hundred thumbnails is a page rather than a mile of ribbon. Wide panels
 * make the column wider than the target on their own, which leaves one column —
 * the stacked layout, arrived at rather than special-cased.
 */
async function paste(
  panels: Panel[],
  palette: Uint8Array,
  scale: number,
  name: string,
  index = false,
): Promise<void> {
  if (panels.length === 0) return;

  // Every panel shares the first one's palette. A PNG carries one table, and in
  // practice all of SimTower's art comes from the same one.
  const table = panels[0]?.image.palette ?? palette;
  const ink = brightestIndex(table);
  const paper = darkestIndex(table);

  const LABEL = GLYPH_HEIGHT + 3;
  const PAD = 4;
  const TARGET = 560;
  // Past this the page is taller than anything will show it at full size, and
  // a thumbnail you cannot read is not a thumbnail. Split instead of shrink.
  const MAX_ROWS = 14;

  const cellWidth = Math.max(...panels.map((panel) => panel.width));
  const cellHeight = Math.max(...panels.map((panel) => panel.height));
  const columns = Math.max(1, Math.floor(TARGET / (cellWidth + PAD)));
  const perPage = columns * MAX_ROWS;
  const pages = Math.ceil(panels.length / perPage);

  for (let page = 0; page < pages; page += 1) {
    const slice = panels.slice(page * perPage, (page + 1) * perPage);
    const rowCount = Math.ceil(slice.length / columns);

    const sheetWidth = columns * (cellWidth + PAD) + PAD;
    const sheetHeight = rowCount * (LABEL + cellHeight + PAD) + PAD;
    // Filled with paper first, so short rows, the gaps between them and any
    // unused corner of the grid read as blank sheet rather than as index zero.
    const sheet = new Uint8Array(sheetWidth * sheetHeight).fill(paper);

    for (const [index, panel] of slice.entries()) {
      const left = PAD + (index % columns) * (cellWidth + PAD);
      let top = PAD + Math.floor(index / columns) * (LABEL + cellHeight + PAD);

      drawText(sheet, sheetWidth, sheetHeight, panel.label, left, top, ink);
      top += LABEL;

      const { image } = panel;
      for (let row = 0; row < panel.rows; row += 1) {
        const rowTop = top + row * (image.height + GAP);
        const width = Math.min(panel.width, image.width - row * panel.width);
        for (let y = 0; y < image.height; y += 1) {
          const from = y * image.width + row * panel.width;
          sheet.set(image.pixels.subarray(from, from + width), (rowTop + y) * sheetWidth + left);
        }
      }
    }

    // Nearest-neighbour, so the pixels stay square and countable.
    const bigWidth = sheetWidth * scale;
    const bigHeight = sheetHeight * scale;
    const big = new Uint8Array(bigWidth * bigHeight);
    for (let row = 0; row < bigHeight; row += 1) {
      for (let column = 0; column < bigWidth; column += 1) {
        big[row * bigWidth + column] = sheet[Math.floor(row / scale) * sheetWidth + Math.floor(column / scale)] ?? 0;
      }
    }

    const file = pages === 1 ? `${name}.png` : `${name}-${page + 1}.png`;
    await writeFile(join(OUT, file), encodePNG(bigWidth, bigHeight, big, table));
    console.log(`\n${OUT}/${file}  ${bigWidth}x${bigHeight}, ${slice.length} panel${slice.length === 1 ? '' : 's'}`);

    // The same grid as text. A 3x5 glyph survives being looked at but not being
    // resized, and an ID misread by one digit sends the catalogue somewhere
    // wrong — so the reading order is printed too, and the pixels only have to
    // show what the art is, not which one it is.
    if (index) {
      for (let row = 0; row < rowCount; row += 1) {
        const labels = slice.slice(row * columns, (row + 1) * columns).map((panel) => panel.label);
        console.log(`  row ${String(row + 1).padStart(2)}: ${labels.join(' ')}`);
      }
    }
  }
}

/**
 * Writes one PNG holding every sheet asked for, labelled and legible.
 *
 * Two problems, one answer. A 1120x32 strip is technically an image and
 * practically a sliver, so it gets wrapped into rows and scaled up. And looking
 * at resources one file at a time costs a round trip each, so they all go on
 * one sheet with their IDs written next to them — which beats zipping a folder
 * of them, and means the image explains itself wherever it ends up.
 */
async function contact(
  resources: ResourceTable,
  tokens: string[],
  palette: Uint8Array,
  wrapAt: number,
  scale: number,
): Promise<void> {
  await mkdir(OUT, { recursive: true });

  const panels: Panel[] = [];
  for (const token of tokens) {
    const found = resolve(resources, token);
    if (!found) continue;
    panels.push(
      panelFor(`${hex(found.type)}/${hex(found.id)}  ${found.image.width}x${found.image.height}`, found.image, wrapAt),
    );
    console.log(`  ${hex(found.id)}  ${found.image.width}x${found.image.height}`);
  }

  await paste(panels, palette, scale, 'contact-sheet');
}

/**
 * Every bitmap and cell strip in the file, thumbnailed onto one page.
 *
 * Identifying art an ID at a time is a round trip per guess, and the guesses
 * are what keep being wrong. A corner of each resource is enough to recognise
 * it — a marble band is not a brick frontage is not a hotel room — so the sweep
 * crops each to its top-left `peek` square, labels it with its ID and lays the
 * lot out as a grid. One image, and the whole catalogue can be checked at once.
 */
async function sweep(resources: ResourceTable, palette: Uint8Array, peek: number, scale: number): Promise<void> {
  await mkdir(OUT, { recursive: true });

  const panels: Panel[] = [];
  for (const type of [TYPE_BITMAP, TYPE_CELLS]) {
    const byId = resources.get(type);
    if (!byId) continue;
    for (const id of [...byId.keys()].sort((a, b) => a - b)) {
      const data = byId.get(id);
      if (!data) continue;
      let image;
      try {
        image = type === TYPE_BITMAP ? decodeDIB(data) : readCellStrip(data, SEGMENT_WIDTH);
      } catch {
        continue; // Undecodable resources are already named in the shape listing.
      }
      const corner = crop(image, 0, 0, Math.min(peek, image.width), Math.min(peek, image.height));
      // The ID alone: the full label does not fit a thumbnail, and the shape
      // listing already gives the sizes.
      panels.push(panelFor(hex(id), corner, peek));
    }
  }

  console.log(`Sweeping ${panels.length} resources at ${peek}px.`);
  await paste(panels, palette, scale, 'sweep', true);
}

/** Brightest palette entry, for label text that will read against the darkest. */
function brightestIndex(palette: Uint8Array): number {
  let best = 0;
  let bestLuma = -1;
  for (let i = 0; i < 256; i += 1) {
    const luma =
      (palette[i * 4] ?? 0) * 0.299 + (palette[i * 4 + 1] ?? 0) * 0.587 + (palette[i * 4 + 2] ?? 0) * 0.114;
    if (luma > bestLuma) {
      bestLuma = luma;
      best = i;
    }
  }
  return best;
}

async function main(): Promise<void> {
  const { path, all, framesIds, contactIds, periodIds, sweep: sweeping, peek, window } = parseArgs(process.argv.slice(2));

  if (!path) {
    console.error('Usage: npm run extract -- [--all] [--frames 0x82bc,0x8429] /path/to/SIMTOWER.EXE');
    console.error('\n  --all      also dump every bitmap and cell strip, named by resource ID');
    console.error('  --frames   report how the named sheets are cut into frames');
    console.error('  --window   with --frames, look at just these columns, e.g. 0,160');
    console.error('  --contact  write one wrapped, labelled, scaled-up PNG of the named sheets');
    console.error('  --sweep    thumbnail every bitmap and cell strip onto one labelled page');
    console.error('  --period   measure how the named sheets divide into equal frames');
    console.error('\nA compressed SIMTOWER.EX_ has to be expanded first (expand.exe, or msexpand).');
    process.exitCode = 1;
    return;
  }

  const bytes = new Uint8Array(await readFile(path));
  const resources = readResources(bytes);
  const { palette, sprites, problems } = extract(resources);

  // Frame analysis is a focused question; printing the whole inventory over the
  // top of it just buries the answer.
  if (sweeping) {
    await sweep(resources, palette, peek, 2);
    return;
  }

  if (contactIds.length > 0) {
    await contact(resources, contactIds, palette, 160, 3);
    return;
  }

  if (periodIds.length > 0) {
    report(resources, periodIds);
    return;
  }

  if (framesIds.length > 0) {
    frames(resources, framesIds, palette, window);
    return;
  }

  inventory(resources);
  shapes(resources);
  await mkdir(OUT, { recursive: true });

  let written = 0;
  for (const sprite of sprites.values()) {
    for (const [index, frame] of sprite.frames.entries()) {
      // A sheet's own palette wins where it has one; cell strips have none and
      // fall back to the game's main table.
      const table = frame.palette ?? palette;
      const name = sprite.frames.length === 1 ? `${sprite.key}.png` : `${sprite.key}-${index}.png`;
      await writeFile(join(OUT, name), encodePNG(frame.width, frame.height, frame.pixels, table));
      written += 1;
    }
  }
  if (all) written += await dumpEverything(resources, palette);

  console.log(`\nWrote ${written} image${written === 1 ? '' : 's'} to ${OUT}/`);
  console.log(`Catalogue: ${sprites.size} of ${CATALOGUE.length} entries extracted.`);

  if (problems.length > 0) {
    console.log('\nNot found — correct these in src/assets/slice.ts against the shapes above:');
    for (const problem of problems) console.log(`  ${problem.key.padEnd(10)} ${problem.reason}`);
  }
}

main().catch((error: unknown) => {
  console.error(`\n${(error as Error).message}`);
  process.exitCode = 1;
});
