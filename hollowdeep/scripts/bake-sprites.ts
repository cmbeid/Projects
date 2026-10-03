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
const WIDTH = 256;
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
  const [r, g, b] = rgba('#120d14');
  for (let i = 0; i < size * size; i++) {
    out.data[i * 4] = r;
    out.data[i * 4 + 1] = g;
    out.data[i * 4 + 2] = b;
    out.data[i * 4 + 3] = 255;
  }
  // Rock with a vein of amethyst-blue cobalt, and the pick across it.
  const scale = Math.floor(size / 20);
  const off = Math.floor((size - 16 * scale) / 2);
  stamp(out, byName.get('rock-fungal-0')!, off, off, scale);
  stamp(out, byName.get('vein-cobalt')!, off, off, scale);
  stamp(out, byName.get('gear-crystal-pick')!, off + Math.floor(scale * 3), off - Math.floor(scale * 2), scale);
  return PNG.sync.write(out);
}

mkdirSync(resolve(root, 'public/icons'), { recursive: true });
writeFileSync(resolve(root, 'public/icons/icon-192.png'), icon(192));
writeFileSync(resolve(root, 'public/icons/icon-512.png'), icon(512));
writeFileSync(resolve(root, 'public/icons/icon-64.png'), icon(64));

console.log(`Baked ${sprites.length} sprites into a ${WIDTH}×${height} atlas.`);
