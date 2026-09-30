/**
 * The farm's pixel art, drawn in code: PokeAPI has Pokémon and items but no
 * tilesets. Each 16 × 16 tile is painted once into a small canvas and reused;
 * the game draws them scaled up with smoothing off.
 */
import { crop } from '../data/crops';
import type { TileKind } from '../data/maps';

export const T = 16;

type Ctx = CanvasRenderingContext2D;

function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/** A stable pseudo-random value for a position, 0–1. */
export function hash(x: number, y: number, salt = 0): number {
  let n = Math.imul(x * 374761393 + y * 668265263 + salt * 2147483647, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1103515245);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function px(g: Ctx, color: string, x: number, y: number, w = 1, h = 1): void {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
}

function grass(g: Ctx, variant: number): void {
  px(g, '#6cbf4b', 0, 0, T, T);
  for (let i = 0; i < 7; i += 1) {
    const x = Math.floor(hash(variant, i, 1) * 15);
    const y = Math.floor(hash(variant, i, 2) * 14);
    px(g, i % 2 ? '#5aa83e' : '#84d15f', x, y, 1, 2);
  }
  if (variant % 4 === 0) {
    // A little flower.
    const x = 3 + Math.floor(hash(variant, 9) * 9);
    const y = 3 + Math.floor(hash(variant, 8) * 9);
    const petal = ['#f5f0e0', '#f7d44a', '#f28bb5'][variant % 3]!;
    px(g, petal, x - 1, y, 3, 1);
    px(g, petal, x, y - 1, 1, 3);
    px(g, '#e8a13a', x, y);
  }
}

function path(g: Ctx, variant: number): void {
  px(g, '#d9b97c', 0, 0, T, T);
  for (let i = 0; i < 6; i += 1) {
    px(g, i % 2 ? '#c49a5c' : '#e8cf98', Math.floor(hash(variant, i, 3) * 15), Math.floor(hash(variant, i, 4) * 15), 2, 1);
  }
}

function water(g: Ctx, frame: number): void {
  px(g, '#3f8fd8', 0, 0, T, T);
  for (let row = 0; row < 3; row += 1) {
    const y = 3 + row * 5;
    const x = ((row * 5 + frame * 3) % 12) + 1;
    px(g, '#8cc4f2', x, y, 4, 1);
  }
}

function tree(g: Ctx, variant: number): void {
  grass(g, variant);
  px(g, '#6e4a2a', 6, 11, 4, 5);
  px(g, '#2f6b30', 1, 1, 14, 11);
  px(g, '#2f6b30', 3, 0, 10, 13);
  px(g, '#3e8a3b', 3, 2, 9, 7);
  px(g, '#52a64a', 4, 3, 4, 3);
  px(g, '#24522a', 2, 10, 12, 2);
}

function rock(g: Ctx, variant: number): void {
  grass(g, variant);
  px(g, '#6f6f78', 2, 6, 12, 8);
  px(g, '#6f6f78', 4, 4, 8, 11);
  px(g, '#9a9aa6', 4, 5, 6, 4);
  px(g, '#c0c0ca', 5, 5, 2, 2);
  px(g, '#4e4e56', 3, 13, 11, 2);
}

function bin(g: Ctx, variant: number): void {
  grass(g, variant);
  px(g, '#6e4424', 1, 5, 14, 10);
  px(g, '#a0673a', 2, 6, 12, 8);
  px(g, '#b67b48', 2, 6, 12, 2);
  px(g, '#6e4424', 2, 9, 12, 1);
  px(g, '#8a8a93', 0, 3, 16, 3);
  px(g, '#b5b5c0', 1, 3, 14, 1);
}

function mart(g: Ctx, variant: number): void {
  grass(g, variant);
  // Counter.
  px(g, '#8a5a36', 1, 9, 14, 6);
  px(g, '#c8905a', 1, 9, 14, 2);
  // Poles.
  px(g, '#e8e8f0', 1, 4, 1, 6);
  px(g, '#e8e8f0', 14, 4, 1, 6);
  // Blue-and-white awning, the Mart's colours.
  for (let x = 0; x < T; x += 1) px(g, Math.floor(x / 3) % 2 ? '#f4f4f8' : '#3a6fd8', x, 0, 1, 5);
  px(g, '#274f9e', 0, 5, 16, 1);
  // Wares.
  px(g, '#e0402c', 3, 7, 2, 2);
  px(g, '#3c6fd8', 7, 7, 2, 2);
  px(g, '#f2d23c', 11, 7, 2, 2);
}

function tall(g: Ctx, variant: number, frame: number): void {
  px(g, '#4f9a3a', 0, 0, T, T);
  // Blades that sway a pixel with the breeze.
  for (let i = 0; i < 8; i += 1) {
    const x = (i * 2 + Math.floor(hash(variant, i, 5) * 2)) % 16;
    const lean = (frame + i) % 2;
    const h = 6 + Math.floor(hash(variant, i, 6) * 5);
    px(g, i % 2 ? '#2f7a2a' : '#3e8a33', x, T - h, 2, h);
    px(g, '#7cc85a', x + lean, T - h - 1, 1, 2);
  }
  px(g, '#2a6424', 0, T - 2, T, 2);
}

function smith(g: Ctx, variant: number): void {
  grass(g, variant);
  // A little forge: stone hearth, glowing coals, and an anvil in front.
  px(g, '#6f6f78', 1, 3, 9, 9);
  px(g, '#4e4e56', 1, 11, 9, 1);
  px(g, '#8a8a93', 2, 4, 7, 2);
  px(g, '#e0402c', 3, 7, 5, 2);
  px(g, '#f7d44a', 4, 7, 2, 1);
  px(g, '#3a3a40', 2, 0, 3, 3);
  px(g, '#4a4a55', 10, 10, 6, 2);
  px(g, '#4a4a55', 12, 12, 2, 3);
  px(g, '#2e2e36', 10, 14, 6, 1);
  px(g, '#9a9aa6', 10, 10, 6, 1);
}

export function soil(g: Ctx, wet: boolean): void {
  px(g, wet ? '#5b3b24' : '#8d5d38', 0, 0, T, T);
  const line = wet ? '#472d1b' : '#74482a';
  for (let y = 2; y < T; y += 4) px(g, line, 1, y, 14, 1);
  px(g, wet ? '#6a4730' : '#a06c44', 0, 0, T, 1);
}

const cache = new Map<string, HTMLCanvasElement>();

function cached(key: string, paint: (g: Ctx) => void): HTMLCanvasElement {
  let c = cache.get(key);
  if (!c) {
    const [cv, g] = canvas(T, T);
    paint(g);
    cache.set(key, cv);
    c = cv;
  }
  return c;
}

const VARIANTS = 8;

/** The tile image for a map tile at (x, y). House tiles show grass; the house is drawn over them. */
export function tileImage(kind: TileKind, x: number, y: number, time: number): HTMLCanvasElement {
  const v = Math.floor(hash(x, y) * VARIANTS);
  switch (kind) {
    case 'path': return cached(`path${v}`, (g) => path(g, v));
    case 'water': {
      const f = (Math.floor(time / 600) + x + y) % 4;
      return cached(`water${f}`, (g) => water(g, f));
    }
    case 'tree': return cached(`tree${v}`, (g) => tree(g, v));
    case 'rock': return cached(`rock${v}`, (g) => rock(g, v));
    case 'bin': return cached(`bin${v}`, (g) => bin(g, v));
    case 'mart': return cached(`mart${v}`, (g) => mart(g, v));
    case 'smith': return cached(`smith${v}`, (g) => smith(g, v));
    case 'tall': {
      const f = (Math.floor(time / 700) + x) % 2;
      return cached(`tall${v}-${f}`, (g) => tall(g, v, f));
    }
    default: return cached(`grass${v}`, (g) => grass(g, v));
  }
}

export function soilImage(wet: boolean): HTMLCanvasElement {
  return cached(wet ? 'soil-wet' : 'soil', (g) => soil(g, wet));
}

const houses = new Map<string, HTMLCanvasElement>();

/** The farmhouse, `w` × `h` tiles, door at column `door`. */
export function houseImage(w: number, h: number, door: number): HTMLCanvasElement {
  const key = `${w},${h},${door}`;
  const hit = houses.get(key);
  if (hit) return hit;
  const W = w * T;
  const H = h * T;
  const [c, g] = canvas(W, H);
  const roofH = Math.floor(H * 0.45);
  // Walls.
  px(g, '#e9d9b6', 1, roofH, W - 2, H - roofH);
  for (let y = roofH + 3; y < H; y += 4) px(g, '#d6c29a', 1, y, W - 2, 1);
  px(g, '#8d6a44', 1, H - 2, W - 2, 2);
  // Roof: red tiles, the ridge darker.
  for (let y = 0; y < roofH + 2; y += 1) {
    const inset = Math.max(0, 3 - y);
    px(g, y % 3 === 2 ? '#a8302a' : '#cf4436', inset, y, W - inset * 2, 1);
  }
  px(g, '#7e2420', 0, roofH + 2, W, 1);
  // Chimney.
  px(g, '#8a8a93', W - 16, 0, 5, 6);
  // Door.
  const dx = door * T + 3;
  px(g, '#6e4424', dx, H - 13, 10, 13);
  px(g, '#8d5a30', dx + 1, H - 12, 8, 12);
  px(g, '#f2d23c', dx + 7, H - 6);
  // Windows, lit at night by the renderer.
  for (const col of [0, w - 1]) {
    if (col === door) continue;
    const wx = col * T + 3;
    px(g, '#6e4424', wx, roofH + 5, 10, 8);
    px(g, '#9fd3f5', wx + 1, roofH + 6, 8, 6);
    px(g, '#6e4424', wx + 4, roofH + 6, 1, 6);
  }
  houses.set(key, c);
  return c;
}

/** A crop at a growth stage (0 seed – 3 ripe), without the ripe berry icon. */
export function cropImage(id: string, stage: 0 | 1 | 2 | 3): HTMLCanvasElement {
  return cached(`crop-${id}-${stage}`, (g) => {
    const c = crop(id);
    if (stage === 0) {
      px(g, '#3a2414', 5, 8, 2, 1);
      px(g, '#3a2414', 9, 10, 2, 1);
      return;
    }
    if (stage === 1) {
      px(g, c.leaf, 7, 8, 1, 5);
      px(g, c.leaf, 5, 7, 2, 2);
      px(g, c.leaf, 8, 6, 3, 2);
      return;
    }
    // A bush, bigger when ripe.
    const top = stage === 3 ? 1 : 4;
    px(g, '#2f6b30', 3, top + 2, 10, 13 - top - 2);
    px(g, c.leaf, 4, top + 1, 8, 11 - top);
    px(g, c.leaf, 2, top + 4, 12, 6);
    px(g, '#7fcf6a', 5, top + 2, 3, 2);
    px(g, '#6e4a2a', 7, 13, 2, 2);
    if (stage === 2) {
      px(g, c.fruit, 5, 8, 1, 1);
      px(g, c.fruit, 10, 7, 1, 1);
    }
  });
}
