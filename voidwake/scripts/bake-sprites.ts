/**
 * Bakes `src/sprites/defs.ts` into a sprite atlas, plus the app icons.
 *
 *   npm run bake
 *
 * Writes `src/sprites/atlas.png` and `src/sprites/atlas.json` (both
 * committed, so a build needs no extra step) and `public/icons/*.png`. The
 * JSON carries a hash of the definitions; `tests/sprites.test.ts` fails if it
 * goes stale, so an edit to the art cannot ship un-baked.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { buildSprites, type SpriteDef } from '../src/sprites/defs';
import { spritesHash } from '../src/sprites/hash';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sprites = buildSprites();

function rgba(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Shelf packing: tallest first, rows of fixed width, a pixel of gutter so
// filtering at fractional scales never bleeds a neighbour in.
const WIDTH = 512;
const order = [...sprites].sort((a, b) => b.h - a.h || a.name.localeCompare(b.name));
const frames: Record<string, [number, number, number, number]> = {};
let x = 0;
let y = 0;
let rowH = 0;
for (const s of order) {
  if (x + s.w > WIDTH) {
    x = 0;
    y += rowH + 1;
    rowH = 0;
  }
  frames[s.name] = [x, y, s.w, s.h];
  x += s.w + 1;
  rowH = Math.max(rowH, s.h);
}
const height = y + rowH;
// A preview sheet at 4×, for looking at the art: `npm run bake -- --preview`.
const PREVIEW = process.argv.includes('--preview');

const png = new PNG({ width: WIDTH, height });
png.data.fill(0);
const byName = new Map(sprites.map((s) => [s.name, s]));
for (const [name, [fx, fy, w, h]] of Object.entries(frames)) {
  const s = byName.get(name)!;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const c = s.px[j * w + i];
      if (!c) continue;
      const o = ((fy + j) * WIDTH + fx + i) * 4;
      const [r, g, b] = rgba(c);
      png.data[o] = r;
      png.data[o + 1] = g;
      png.data[o + 2] = b;
      png.data[o + 3] = 255;
    }
  }
}

mkdirSync(resolve(root, 'src/sprites'), { recursive: true });
writeFileSync(resolve(root, 'src/sprites/atlas.png'), PNG.sync.write(png));
writeFileSync(
  resolve(root, 'src/sprites/atlas.json'),
  `${JSON.stringify({ hash: spritesHash(sprites), width: WIDTH, height, frames }, null, 0)}\n`,
);

// --- App icons -------------------------------------------------------------------

function stamp(target: PNG, s: SpriteDef, ox: number, oy: number, scale: number): void {
  for (let j = 0; j < s.h; j++) {
    for (let i = 0; i < s.w; i++) {
      const c = s.px[j * s.w + i];
      if (!c) continue;
      const [r, g, b] = rgba(c);
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const px = ox + i * scale + dx;
          const py = oy + j * scale + dy;
          if (px < 0 || py < 0 || px >= target.width || py >= target.height) continue;
          const o = (py * target.width + px) * 4;
          target.data[o] = r;
          target.data[o + 1] = g;
          target.data[o + 2] = b;
          target.data[o + 3] = 255;
        }
      }
    }
  }
}

function icon(size: number): Buffer {
  const out = new PNG({ width: size, height: size });
  // Deep space, a planet rising, and the Wren.
  let k = 7;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const o = (y * size + x) * 4;
      const t = y / size;
      const [r, g, b] = rgba(t < 0.5 ? '#0a0e1e' : '#121830');
      k = (k * 1103515245 + 12345) & 0x7fffffff;
      const star = k % 997 === 0;
      out.data[o] = star ? 230 : r;
      out.data[o + 1] = star ? 236 : g;
      out.data[o + 2] = star ? 255 : b;
      out.data[o + 3] = 255;
    }
  }
  const scale = Math.max(1, Math.floor(size / 48));
  const world = byName.get('planet-jungle-big')!;
  stamp(out, world, Math.floor(size * 0.55), Math.floor(size * 0.55), scale);
  const ship = byName.get('ship-wren')!;
  stamp(out, ship, Math.floor(size / 2 - (ship.w * scale) / 2), Math.floor(size * 0.2), scale);
  return PNG.sync.write(out);
}

mkdirSync(resolve(root, 'public/icons'), { recursive: true });
writeFileSync(resolve(root, 'public/icons/icon-192.png'), icon(192));
writeFileSync(resolve(root, 'public/icons/icon-512.png'), icon(512));
writeFileSync(resolve(root, 'public/icons/icon-64.png'), icon(64));

if (PREVIEW) {
  const k = 4;
  const big = new PNG({ width: WIDTH * k, height: height * k });
  for (let j = 0; j < height * k; j++) {
    for (let i = 0; i < WIDTH * k; i++) {
      const o = (j * WIDTH * k + i) * 4;
      const src = (Math.floor(j / k) * WIDTH + Math.floor(i / k)) * 4;
      const a = png.data[src + 3]!;
      const bg = ((i >> 4) + (j >> 4)) % 2 ? 200 : 230;
      for (let c = 0; c < 3; c++) big.data[o + c] = a ? png.data[src + c]! : bg;
      big.data[o + 3] = 255;
    }
  }
  writeFileSync(resolve(root, 'atlas-preview.png'), PNG.sync.write(big));
}

console.log(`Baked ${sprites.length} sprites into a ${WIDTH}×${height} atlas.`);
