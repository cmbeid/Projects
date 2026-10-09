/**
 * Draws every building by line (rows) and era (columns), then the wonders,
 * at 4×, for looking at the art: `npm run sheet -- out.png`.
 */
import { writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { LINES } from '../src/data/buildings';
import { WONDERS } from '../src/data/wonders';
import { buildSprites, buildingSprite } from '../src/sprites/defs';

const sprites = new Map(buildSprites().map((s) => [s.name, s]));
const K = 4;
const CELL = 24;
const ROW = 66;
const wonderRow = 100;
const W = 8 * CELL + 20;
const H = LINES.length * ROW + wonderRow * 5 + 40;
const png = new PNG({ width: W * K, height: H * K });
const put = (x: number, y: number, c: [number, number, number]): void => {
  for (let j = 0; j < K; j++) for (let i = 0; i < K; i++) {
    const o = ((y * K + j) * W * K + x * K + i) * 4;
    png.data[o] = c[0]; png.data[o + 1] = c[1]; png.data[o + 2] = c[2]; png.data[o + 3] = 255;
  }
};
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(x, y, [200, 220, 235]);
const draw = (name: string, x: number, base: number): void => {
  const s = sprites.get(name);
  if (!s) return;
  for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) {
    const c = s.px[j * s.w + i];
    if (!c) continue;
    const n = parseInt(c.slice(1), 16);
    put(x + i, base - s.h + j, [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
  }
};
LINES.forEach((l, r) => {
  const base = (r + 1) * ROW;
  for (let x = 0; x < W; x++) put(x, base, [90, 120, 60]);
  for (const t of l.tiers) draw(buildingSprite(l.id, t.era), 4 + t.era * CELL, base);
});
let x = 2;
let base = LINES.length * ROW + wonderRow;
for (const w of WONDERS) {
  if (x + w.w > W) { x = 2; base += wonderRow; }
  draw(`wonder-${w.id}`, x, base);
  x += w.w + 4;
}
writeFileSync(process.argv[2]!, PNG.sync.write(png));
