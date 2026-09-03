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

import { decodeDIB, inferCellHeight, readCellStrip } from '../src/assets/dib.js';
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
import { ASCII_LIMIT, analyse, ascii, candidates, parseIdTokens, profile } from './frames.js';

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
function frames(resources: ResourceTable, tokens: string[], palette: Uint8Array): void {
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

    const report = analyse(image);
    const inkTop = report.inkRows[0]?.from;
    const inkBottom = report.inkRows[report.inkRows.length - 1]?.to;

    console.log(`\n${hex(found.type)}/${hex(id)}  ${image.width}x${image.height}  background index ${report.background}`);
    console.log(`  ${report.inkColumns.length} ink runs across, widths: ${report.widths.map((w) => `${w.width}x${w.count}`).join(', ') || 'none'}`);
    if (inkTop !== undefined && inkBottom !== undefined) {
      console.log(`  ink rows ${inkTop}..${inkBottom} — figure is ${inkBottom - inkTop + 1}px tall in a ${image.height}px sheet`);
    }
    // Column starts say whether the runs are evenly spaced, which is what makes
    // a grid a grid rather than a row of differently sized things.
    console.log(`  run starts: ${report.inkColumns.slice(0, 24).map((run) => run.from).join(' ')}${report.inkColumns.length > 24 ? ' …' : ''}`);

    if (image.width <= ASCII_LIMIT) {
      for (const line of ascii(image, image.palette ?? palette, report.background)) console.log(`  |${line}`);
    } else {
      console.log(`  ${profile(image, report.background)}`);
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const all = args.includes('--all');
  const framesAt = args.indexOf('--frames');
  const framesIds = framesAt >= 0 ? parseIdTokens(args[framesAt + 1] ?? '') : [];
  const path = args.find((argument, index) => !argument.startsWith('--') && index !== framesAt + 1);

  if (!path) {
    console.error('Usage: npm run extract -- [--all] [--frames 0x82bc,0x8429] /path/to/SIMTOWER.EXE');
    console.error('\n  --all      also dump every bitmap and cell strip, named by resource ID');
    console.error('  --frames   report how the named sheets are cut into frames');
    console.error('\nA compressed SIMTOWER.EX_ has to be expanded first (expand.exe, or msexpand).');
    process.exitCode = 1;
    return;
  }

  const bytes = new Uint8Array(await readFile(path));
  const resources = readResources(bytes);
  const { palette, sprites, problems } = extract(resources);

  // Frame analysis is a focused question; printing the whole inventory over the
  // top of it just buries the answer.
  if (framesIds.length > 0) {
    frames(resources, framesIds, palette);
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
