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

import { hex, readResources, type ResourceTable } from '../src/assets/ne.js';
import { CATALOGUE, TYPE_BITMAP, TYPE_CELLS, TYPE_PALETTE, TYPE_SOUND, extract } from '../src/assets/slice.js';
import { encodePNG } from './png.js';

const OUT = 'assets-private';

const TYPE_NAMES = new Map([
  [TYPE_BITMAP, 'bitmaps'],
  [TYPE_CELLS, 'cell strips'],
  [TYPE_PALETTE, 'palettes'],
  [TYPE_SOUND, 'sounds'],
]);

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

async function main(): Promise<void> {
  const path = process.argv[2];
  if (!path) {
    console.error('Usage: npm run extract -- /path/to/SIMTOWER.EXE');
    console.error('\nA compressed SIMTOWER.EX_ has to be expanded first (expand.exe, or msexpand).');
    process.exitCode = 1;
    return;
  }

  const bytes = new Uint8Array(await readFile(path));
  const resources = readResources(bytes);
  inventory(resources);

  const { palette, sprites, problems } = extract(resources);
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

  console.log(`\nWrote ${written} image${written === 1 ? '' : 's'} to ${OUT}/`);
  console.log(`Catalogue: ${sprites.size} of ${CATALOGUE.length} entries extracted.`);

  if (problems.length > 0) {
    console.log('\nNot found — correct these in src/assets/slice.ts against the inventory above:');
    for (const problem of problems) console.log(`  ${problem.key.padEnd(10)} ${problem.reason}`);
  }
}

main().catch((error: unknown) => {
  console.error(`\n${(error as Error).message}`);
  process.exitCode = 1;
});
