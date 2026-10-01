/**
 * The farm's pixel art, drawn in code: PokeAPI has Pokémon and items but no
 * tilesets. Each 16 × 16 tile is painted once into a small canvas and reused;
 * the game draws them scaled up with smoothing off.
 */
import { crop } from '../data/crops';
import type { TileKind } from '../data/maps';
import type { Season } from '../game/time';

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

/** The season the tiles are painted for; set each frame by the renderer. */
let season: Season = 'Spring';
/** Whether the greenhouse has been repaired. */
let repaired = false;

export function setTileState(s: Season, greenhouse: boolean): void {
  season = s;
  repaired = greenhouse;
}

/** Ground colours by season: base, dark speckle, light speckle. */
const GROUND: Record<Season, [string, string, string]> = {
  Spring: ['#6cbf4b', '#5aa83e', '#84d15f'],
  Summer: ['#5cb83c', '#4a9e30', '#7ad04e'],
  Autumn: ['#a8b048', '#d8903a', '#c8c060'],
  Winter: ['#e6eef4', '#c4d2e0', '#ffffff'],
};

/** Tree canopies by season: outline, body, highlight. */
const CANOPY: Record<Season, [string, string, string]> = {
  Spring: ['#2f6b30', '#3e8a3b', '#52a64a'],
  Summer: ['#24602a', '#2f7a30', '#44963e'],
  Autumn: ['#8a3a1a', '#c8601e', '#e8a03a'],
  Winter: ['#2a5a40', '#3a6a4a', '#f4f8fc'],
};

function grass(g: Ctx, variant: number): void {
  const [base, dark, light] = GROUND[season];
  px(g, base, 0, 0, T, T);
  for (let i = 0; i < 7; i += 1) {
    const x = Math.floor(hash(variant, i, 1) * 15);
    const y = Math.floor(hash(variant, i, 2) * 14);
    px(g, i % 2 ? dark : light, x, y, 1, 2);
  }
  if (variant % 4 === 0 && (season === 'Spring' || season === 'Summer')) {
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
  const [edge, body, light] = CANOPY[season];
  px(g, '#6e4a2a', 6, 11, 4, 5);
  px(g, edge, 1, 1, 14, 11);
  px(g, edge, 3, 0, 10, 13);
  px(g, body, 3, 2, 9, 7);
  px(g, light, 4, 3, 4, 3);
  if (season === 'Winter') px(g, '#f4f8fc', 2, 0, 12, 2); // snow on top
  else px(g, '#24522a', 2, 10, 12, 2);
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
  if (season === 'Winter') {
    // Frosted, snow-heavy grass.
    px(g, '#cfdbe6', 0, 0, T, T);
    for (let i = 0; i < 8; i += 1) {
      const x = (i * 2 + Math.floor(hash(variant, i, 5) * 2)) % 16;
      const h = 5 + Math.floor(hash(variant, i, 6) * 5);
      px(g, i % 2 ? '#6a8a7a' : '#86a494', x, T - h, 2, h);
      px(g, '#ffffff', x, T - h - 1, 2, 1);
    }
    return;
  }
  px(g, season === 'Autumn' ? '#8a9a3a' : '#4f9a3a', 0, 0, T, T);
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

function board(g: Ctx, variant: number): void {
  grass(g, variant);
  px(g, '#6e4424', 3, 8, 2, 8);
  px(g, '#6e4424', 11, 8, 2, 8);
  px(g, '#8d5a30', 1, 2, 14, 9);
  px(g, '#c8905a', 2, 3, 12, 7);
  // Pinned notes.
  px(g, '#fff8e7', 3, 4, 4, 3);
  px(g, '#fff8e7', 8, 5, 4, 4);
  px(g, '#e0402c', 4, 4);
  px(g, '#e0402c', 9, 5);
}

/** The travelling merchant's cart: a striped canopy when open, a covered cart on weekdays. */
function cart(g: Ctx, variant: number, open: boolean): void {
  grass(g, variant);
  px(g, '#8d5a30', 1, 8, 14, 5);
  px(g, '#6e4424', 1, 12, 14, 1);
  px(g, '#3a2414', 2, 13, 3, 3);
  px(g, '#3a2414', 11, 13, 3, 3);
  if (open) {
    for (let x = 0; x < T; x += 1) px(g, Math.floor(x / 2) % 2 ? '#f7d44a' : '#9a3ac8', x, 1, 1, 4);
    px(g, '#e8e8f0', 1, 5, 1, 3);
    px(g, '#e8e8f0', 14, 5, 1, 3);
    px(g, '#f28bb5', 3, 6, 2, 2);
    px(g, '#7cc8f2', 7, 6, 2, 2);
    px(g, '#f2c230', 11, 6, 2, 2);
  } else {
    px(g, '#a89a80', 1, 4, 14, 5);
    px(g, '#8a7c62', 1, 4, 14, 1);
  }
}

/** A greenhouse pane: clean glass in a white frame, or cracked and missing until it's repaired. */
function glass(g: Ctx, x: number, y: number): void {
  px(g, '#e8eef0', 0, 0, T, T);
  px(g, repaired ? '#a8d8f0' : '#9ab0b8', 1, 1, T - 2, T - 2);
  px(g, repaired ? '#d8f0fc' : '#c0ccd0', 2, 2, 4, 2);
  px(g, '#e8eef0', 7, 0, 2, T);
  px(g, '#e8eef0', 0, 7, T, 2);
  if (!repaired) {
    // Cracks, and a pane missing here and there.
    if (hash(x, y, 7) < 0.4) px(g, '#5a6a50', 9, 9, 6, 6);
    px(g, '#5a6a6e', 3, 10, 1, 4);
    px(g, '#5a6a6e', 4, 12, 2, 1);
    px(g, '#5a6a6e', 11, 2, 1, 3);
  }
}

/** The greenhouse floor: tidy boards when repaired, weeds through them when not. */
function ghFloor(g: Ctx, variant: number, doorway: boolean): void {
  px(g, '#b8946a', 0, 0, T, T);
  for (let y = 3; y < T; y += 4) px(g, '#9a7a52', 0, y, T, 1);
  if (!repaired && !doorway) {
    for (let i = 0; i < 4; i += 1) {
      const x = Math.floor(hash(variant, i, 11) * 14);
      const y = Math.floor(hash(variant, i, 12) * 12);
      px(g, '#5a9a3a', x, y, 1, 3);
      px(g, '#5a9a3a', x + 1, y + 1, 1, 2);
    }
  }
}

function caveFloor(g: Ctx, variant: number): void {
  px(g, '#8a7a68', 0, 0, T, T);
  for (let i = 0; i < 6; i += 1) {
    px(g, i % 2 ? '#766858' : '#9a8a76', Math.floor(hash(variant, i, 21) * 15), Math.floor(hash(variant, i, 22) * 15), 2, 1);
  }
}

function caveWall(g: Ctx, variant: number): void {
  px(g, '#4a3a2e', 0, 0, T, T);
  px(g, '#5e4a3a', 1, 1, 14, 9);
  px(g, '#6e5a48', 2, 2, 6, 3);
  px(g, '#3a2c22', 0, 12, T, 4);
  if (variant % 3 === 0) px(g, '#7e6a56', 10, 4, 3, 2);
}

/** An ore rock: grey stone flecked with copper and iron, dull once mined for the day. */
function oreRock(g: Ctx, variant: number, ready: boolean): void {
  caveFloor(g, variant);
  px(g, '#5e5e66', 2, 5, 12, 9);
  px(g, '#5e5e66', 4, 3, 8, 12);
  px(g, '#8a8a93', 4, 4, 6, 4);
  px(g, '#3e3e46', 3, 13, 11, 2);
  if (ready) {
    px(g, '#d8803a', 6, 7, 2, 2);
    px(g, '#c8c8d8', 10, 9, 2, 2);
    px(g, '#f2d23c', 8, 11, 1, 1);
  }
}

function logTile(g: Ctx, variant: number, ready: boolean): void {
  grass(g, variant);
  px(g, '#6e4a2a', 1, 8, 14, 6);
  px(g, '#8d5d38', 1, 8, 14, 2);
  px(g, '#c8905a', 13, 8, 2, 6);
  px(g, '#a0673a', 14, 10, 1, 2);
  if (ready) px(g, '#5aa83e', 4, 7, 3, 1);
}

const APRICORN_COLOURS: Record<string, string> = {
  'red-apricorn': '#e0402c', 'blue-apricorn': '#3c6fd8', 'yellow-apricorn': '#f2d23c', 'green-apricorn': '#58b85a', 'black-apricorn': '#3a3a40',
};

function apricornTree(g: Ctx, variant: number, apricorn: string, ready: boolean): void {
  tree(g, variant);
  if (!ready) return;
  const c = APRICORN_COLOURS[apricorn] ?? '#e0402c';
  for (const [x, y] of [[4, 4], [10, 3], [7, 8], [11, 8]] as const) {
    px(g, c, x, y, 2, 2);
    px(g, '#ffffff', x, y);
  }
}

/** A gate the story hasn't opened: a fallen trunk across the path, or a heap of rocks. */
function gateTile(g: Ctx, variant: number, look: 'log' | 'rocks'): void {
  path(g, variant);
  if (look === 'log') {
    px(g, '#5a3a20', 0, 6, T, 6);
    px(g, '#8d5d38', 0, 6, T, 2);
    px(g, '#c8905a', 0, 6, 2, 6);
    px(g, '#3a8a3b', 5, 4, 4, 2);
  } else {
    for (const [x, y, w] of [[1, 7, 6], [7, 5, 7], [4, 10, 8], [10, 10, 5]] as const) {
      px(g, '#6f6f78', x, y, w, 5);
      px(g, '#9a9aa6', x + 1, y, w - 2, 2);
    }
  }
}

export function nodeImage(kind: 'apricorn' | 'log' | 'ore', x: number, y: number, ready: boolean, apricorn = ''): HTMLCanvasElement {
  const v = Math.floor(hash(x, y) * VARIANTS);
  if (kind === 'apricorn') return cached(`apri${v}${apricorn}${ready}`, (g) => apricornTree(g, v, apricorn, ready));
  if (kind === 'log') return cached(`log${v}${ready}`, (g) => logTile(g, v, ready));
  return cached(`ore${v}${ready}`, (g) => oreRock(g, v, ready));
}

export function gateImage(look: 'log' | 'rocks', x: number, y: number): HTMLCanvasElement {
  const v = Math.floor(hash(x, y) * VARIANTS);
  return cached(`gate${look}${v}`, (g) => gateTile(g, v, look));
}

export function soil(g: Ctx, wet: boolean): void {
  px(g, wet ? '#5b3b24' : '#8d5d38', 0, 0, T, T);
  const line = wet ? '#472d1b' : '#74482a';
  for (let y = 2; y < T; y += 4) px(g, line, 1, y, 14, 1);
  px(g, wet ? '#6a4730' : '#a06c44', 0, 0, T, 1);
}

const cache = new Map<string, HTMLCanvasElement>();

/** Tiles painted once per season (and greenhouse state), then reused. */
function cached(name: string, paint: (g: Ctx) => void): HTMLCanvasElement {
  const key = `${season}:${repaired ? 'g' : ''}:${name}`;
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
    case 'board': return cached(`board${v}`, (g) => board(g, v));
    case 'glass': return cached(`glass${v}`, (g) => glass(g, x, y));
    case 'cavefloor': return cached(`cf${v}`, (g) => caveFloor(g, v));
    case 'cavewall': return cached(`cw${v}`, (g) => caveWall(g, v));
    case 'ghsoil':
    case 'ghdoor': return cached(`ghfloor${v}${kind}`, (g) => ghFloor(g, v, kind === 'ghdoor'));
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

/** Roof colours for each kind of building. */
export const ROOFS = { farmhouse: ['#cf4436', '#a8302a'], center: ['#e04030', '#b02a20'], hall: ['#3a6fd8', '#274f9e'], shop: ['#8d5d38', '#6e4424'], house: ['#58a840', '#3e8a33'] } as const;
export type Roof = keyof typeof ROOFS;

/** A building, `w` × `h` tiles, door at column `door`: the farmhouse, or one of the town's. */
export function houseImage(w: number, h: number, door: number, roof: Roof = 'farmhouse'): HTMLCanvasElement {
  const key = `${w},${h},${door},${roof}`;
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
  const [roofLight, roofDark] = ROOFS[roof];
  for (let y = 0; y < roofH + 2; y += 1) {
    const inset = Math.max(0, 3 - y);
    px(g, y % 3 === 2 ? roofDark : roofLight, inset, y, W - inset * 2, 1);
  }
  if (roof === 'center') {
    // A Poké Ball sign on the roof.
    const cx = Math.floor(W / 2);
    px(g, '#f4f4f8', cx - 4, 2, 8, 8);
    px(g, '#e04030', cx - 4, 2, 8, 4);
    px(g, '#2a2a30', cx - 4, 5, 8, 1);
    px(g, '#f4f4f8', cx - 1, 4, 2, 3);
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

export function cartImage(open: boolean, x: number, y: number): HTMLCanvasElement {
  const v = Math.floor(hash(x, y) * VARIANTS);
  return cached(`cart${v}${open ? 'o' : 'c'}`, (g) => cart(g, v, open));
}

const barns = new Map<string, HTMLCanvasElement>();

/** A red barn, `w` × `h` tiles, its big door at column `door`. */
export function barnImage(w: number, h: number, door: number): HTMLCanvasElement {
  const key = `${w},${h},${door}`;
  const hit = barns.get(key);
  if (hit) return hit;
  const W = w * T;
  const H = h * T;
  const [c, g] = canvas(W, H);
  const roofH = Math.floor(H * 0.4);
  px(g, '#b8402e', 1, roofH, W - 2, H - roofH);
  for (let x = 4; x < W - 2; x += 5) px(g, '#9a3424', x, roofH, 1, H - roofH);
  px(g, '#f4f4f8', 1, roofH, W - 2, 1);
  for (let y = 0; y < roofH + 1; y += 1) {
    const inset = Math.max(0, Math.round((roofH - y) * 0.9));
    px(g, y % 3 === 0 ? '#4a4a55' : '#5e5e6a', inset, y, W - inset * 2, 1);
  }
  // Hay loft window.
  px(g, '#f4f4f8', W / 2 - 4, 3, 8, 6);
  px(g, '#e8c45a', W / 2 - 3, 4, 6, 4);
  // The big door, with its white cross.
  const dx = door * T + 1;
  const dw = T - 2;
  const top = H - 14;
  px(g, '#f4f4f8', dx - 1, top - 1, dw + 2, 15);
  px(g, '#8a2a20', dx, top, dw, 14);
  for (let i = 0; i < dw; i += 1) {
    px(g, '#f4f4f8', dx + i, top + Math.round((i * 13) / dw), 1, 1);
    px(g, '#f4f4f8', dx + i, top + 13 - Math.round((i * 13) / dw), 1, 1);
  }
  barns.set(key, c);
  return c;
}

/** The four machines, drawn in code. */
export function machineImage(id: string): HTMLCanvasElement {
  return cached(`machine-${id}`, (g) => {
    if (id === 'berry-press') {
      px(g, '#6e4424', 3, 6, 10, 9);
      px(g, '#a0673a', 4, 7, 8, 7);
      px(g, '#6e4424', 4, 10, 8, 1);
      px(g, '#8a8a93', 7, 1, 2, 6);
      px(g, '#b5b5c0', 4, 1, 8, 2);
      px(g, '#c04a8a', 5, 12, 6, 2);
    } else if (id === 'preserves-jar') {
      px(g, '#c8e8f8', 4, 4, 8, 11);
      px(g, '#e8f4fc', 5, 5, 2, 8);
      px(g, '#e0402c', 5, 8, 6, 6);
      px(g, '#8d5a30', 3, 2, 10, 3);
      px(g, '#f4f4f8', 3, 4, 10, 1);
    } else if (id === 'cheese-press') {
      px(g, '#8a8a93', 2, 12, 12, 3);
      px(g, '#b5b5c0', 3, 6, 10, 6);
      px(g, '#f2d23c', 4, 7, 8, 4);
      px(g, '#5e5e66', 7, 1, 2, 5);
      px(g, '#5e5e66', 4, 1, 8, 1);
    } else {
      // Loom.
      px(g, '#8d5a30', 2, 2, 2, 13);
      px(g, '#8d5a30', 12, 2, 2, 13);
      px(g, '#6e4424', 2, 2, 12, 2);
      px(g, '#6e4424', 2, 12, 12, 2);
      for (let x = 4; x < 12; x += 2) px(g, '#f4f0e0', x, 4, 1, 8);
      px(g, '#7cc8f2', 4, 7, 8, 2);
    }
  });
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
