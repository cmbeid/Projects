/**
 * Each map's ground, drawn once in code as 16 px pixel-art tiles into an
 * offscreen canvas, then scaled up with nearest-neighbour so it stays crisp.
 * No tilesets are shipped: every theme is a palette and a few little
 * pixel patterns.
 */
import { COLS, type MapDef, pathTiles, ROWS, type Terrain, terrainAt, type Theme, warpTiles } from '../data/maps';
import { makeRng, hashString } from '../game/rng';

export const TILE_PX = 16;

interface Palette {
  ground: string;
  groundDot: string;
  groundDark: string;
  path: string;
  pathEdge: string;
  pathDot: string;
  water: string;
  waterLight: string;
  block: string;
  blockLight: string;
  blockDark: string;
  accent: string;
}

const PALETTES: Record<Theme, Palette> = {
  forest: { ground: '#4f9a3c', groundDot: '#6cb850', groundDark: '#3e7f2f', path: '#d6b878', pathEdge: '#a8894e', pathDot: '#c4a464', water: '#3a78c8', waterLight: '#7ab0ea', block: '#2c6a2e', blockLight: '#4a8c3a', blockDark: '#1c4a20', accent: '#f0d048' },
  cave: { ground: '#7a6a58', groundDot: '#8c7c68', groundDark: '#5e5042', path: '#b09a78', pathEdge: '#806a4e', pathDot: '#a08a68', water: '#3a5a8a', waterLight: '#6a8aba', block: '#4e4238', blockLight: '#6a5c4e', blockDark: '#342c24', accent: '#c8b8f8' },
  ship: { ground: '#c49256', groundDot: '#d4a468', groundDark: '#9e7240', path: '#b83a3a', pathEdge: '#7c2424', pathDot: '#cc5050', water: '#2c6cc0', waterLight: '#72aaec', block: '#6a6a78', blockLight: '#9090a0', blockDark: '#44444e', accent: '#f8f0d0' },
  garden: { ground: '#5cb44a', groundDot: '#7ccc5c', groundDark: '#48963a', path: '#dcd4bc', pathEdge: '#aca488', pathDot: '#c8c0a8', water: '#3a88d0', waterLight: '#8ac0f0', block: '#2e7a36', blockLight: '#4c9c48', blockDark: '#1e5424', accent: '#f878a8' },
  tower: { ground: '#6a6078', groundDot: '#7a7088', groundDark: '#544a62', path: '#4a3a66', pathEdge: '#2e2444', pathDot: '#5a4a78', water: '#3a4a88', waterLight: '#6a7ab8', block: '#9a98a8', blockLight: '#c0c0cc', blockDark: '#6a6878', accent: '#b8a0e8' },
  office: { ground: '#c8cad4', groundDot: '#d8dae2', groundDark: '#a8aab8', path: '#4a6eb4', pathEdge: '#2e4a84', pathDot: '#5a80c4', water: '#3a78c8', waterLight: '#7ab0ea', block: '#4e5668', blockLight: '#6e7688', blockDark: '#343a48', accent: '#f8d040' },
  volcano: { ground: '#7a4a3a', groundDot: '#8e5a46', groundDark: '#5e382c', path: '#b0a090', pathEdge: '#7e6e60', pathDot: '#9e8e7e', water: '#e05818', waterLight: '#f8a838', block: '#4a2e26', blockLight: '#6a443a', blockDark: '#301c18', accent: '#f8d048' },
  gym: { ground: '#d4bc92', groundDot: '#e0caa2', groundDark: '#b89e74', path: '#9a6e44', pathEdge: '#6a4a2a', pathDot: '#aa7e54', water: '#3a78c8', waterLight: '#7ab0ea', block: '#5a4632', blockLight: '#7a664e', blockDark: '#3a2c1e', accent: '#58a858' },
  plateau: { ground: '#6a9a4a', groundDot: '#80b05a', groundDark: '#547e3a', path: '#c4ac7c', pathEdge: '#94804e', pathDot: '#b09a6a', water: '#3a78c8', waterLight: '#7ab0ea', block: '#7a7068', blockLight: '#9e948a', blockDark: '#524a44', accent: '#f8e070' },
  deepcave: { ground: '#3c3c5a', groundDot: '#4a4a6a', groundDark: '#2c2c46', path: '#6e6e8e', pathEdge: '#48486a', pathDot: '#7e7e9e', water: '#24487a', waterLight: '#4a78b0', block: '#26263a', blockLight: '#3e3e58', blockDark: '#181826', accent: '#b070f0' },
};

export function palette(theme: Theme): Palette {
  return PALETTES[theme];
}

type Ctx = CanvasRenderingContext2D;

function px(ctx: Ctx, x: number, y: number, w: number, h: number, colour: string): void {
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, w, h);
}

function ground(ctx: Ctx, p: Palette, theme: Theme, ox: number, oy: number, rng: () => number, kind: Terrain): void {
  px(ctx, ox, oy, 16, 16, p.ground);
  if (theme === 'ship' || theme === 'office' || theme === 'gym') {
    // Planks, floor tiles or gym mats.
    if (theme === 'ship') {
      for (let y = 0; y < 16; y += 4) px(ctx, ox, oy + y, 16, 1, p.groundDark);
      px(ctx, ox + ((oy / 16) % 2 ? 5 : 11), oy, 1, 16, p.groundDark);
    } else if (theme === 'office') {
      px(ctx, ox, oy, 16, 1, p.groundDark);
      px(ctx, ox, oy, 1, 16, p.groundDark);
      px(ctx, ox + 1, oy + 1, 6, 1, p.groundDot);
    } else {
      if (((ox + oy) / 16) % 2) px(ctx, ox, oy, 16, 16, p.groundDot);
      px(ctx, ox, oy + 15, 16, 1, p.groundDark);
    }
  } else {
    for (let i = 0; i < 7; i += 1) px(ctx, ox + Math.floor(rng() * 15), oy + Math.floor(rng() * 15), 2, 1, i % 3 ? p.groundDot : p.groundDark);
    if (theme === 'forest' || theme === 'garden' || theme === 'plateau') {
      // Tufts of grass.
      for (let i = 0; i < 2; i += 1) {
        const x = ox + 2 + Math.floor(rng() * 11);
        const y = oy + 3 + Math.floor(rng() * 10);
        px(ctx, x, y, 1, 2, p.groundDark);
        px(ctx, x + 2, y, 1, 2, p.groundDark);
        px(ctx, x + 1, y - 1, 1, 3, p.groundDark);
      }
    }
  }
  if (kind === 'flowers') {
    const colours = ['#f878a8', '#f8f8f8', '#f8d048', '#f89048'];
    for (let i = 0; i < 3; i += 1) {
      const x = ox + 2 + Math.floor(rng() * 11);
      const y = oy + 2 + Math.floor(rng() * 11);
      const c = colours[Math.floor(rng() * colours.length)]!;
      px(ctx, x, y - 1, 1, 1, c);
      px(ctx, x - 1, y, 3, 1, c);
      px(ctx, x, y + 1, 1, 1, c);
      px(ctx, x, y, 1, 1, '#f8e858');
    }
  }
  if (kind === 'ledge') {
    px(ctx, ox, oy + 12, 16, 4, p.groundDark);
    px(ctx, ox, oy + 12, 16, 1, p.groundDot);
    for (let x = 1; x < 16; x += 4) px(ctx, ox + x, oy + 13, 2, 3, p.blockDark);
  }
}

function water(ctx: Ctx, p: Palette, ox: number, oy: number, rng: () => number, lava: boolean): void {
  px(ctx, ox, oy, 16, 16, p.water);
  for (let i = 0; i < 3; i += 1) {
    const x = ox + Math.floor(rng() * 11);
    const y = oy + 2 + Math.floor(rng() * 12);
    px(ctx, x, y, 4, 1, p.waterLight);
    px(ctx, x + 1, y - 1, 2, 1, p.waterLight);
  }
  if (lava) for (let i = 0; i < 3; i += 1) px(ctx, ox + Math.floor(rng() * 14), oy + Math.floor(rng() * 14), 2, 2, '#f8e070');
}

function blocker(ctx: Ctx, p: Palette, theme: Theme, kind: Terrain, ox: number, oy: number, rng: () => number): void {
  if (kind === 'tree') {
    px(ctx, ox + 6, oy + 11, 4, 5, '#6a4a2a');
    px(ctx, ox + 2, oy + 2, 12, 10, p.block);
    px(ctx, ox + 1, oy + 4, 14, 6, p.block);
    px(ctx, ox + 4, oy + 1, 8, 2, p.block);
    px(ctx, ox + 4, oy + 3, 4, 2, p.blockLight);
    px(ctx, ox + 3, oy + 5, 2, 2, p.blockLight);
    px(ctx, ox + 2, oy + 10, 12, 2, p.blockDark);
  } else if (kind === 'rock') {
    px(ctx, ox + 1, oy + 4, 14, 11, p.block);
    px(ctx, ox + 3, oy + 2, 10, 3, p.block);
    px(ctx, ox + 3, oy + 3, 5, 3, p.blockLight);
    px(ctx, ox + 1, oy + 13, 14, 2, p.blockDark);
    px(ctx, ox + 9, oy + 7, 1, 4, p.blockDark);
  } else if (kind === 'grave') {
    px(ctx, ox + 4, oy + 3, 8, 11, p.block);
    px(ctx, ox + 5, oy + 2, 6, 1, p.block);
    px(ctx, ox + 5, oy + 3, 2, 10, p.blockLight);
    px(ctx, ox + 7, oy + 5, 3, 1, p.blockDark);
    px(ctx, ox + 8, oy + 4, 1, 4, p.blockDark);
    px(ctx, ox + 3, oy + 13, 10, 2, p.blockDark);
  } else if (kind === 'wall') {
    px(ctx, ox, oy, 16, 16, p.block);
    px(ctx, ox, oy, 16, 3, p.blockLight);
    px(ctx, ox, oy + 14, 16, 2, p.blockDark);
    if (theme === 'office' && rng() < 0.5) {
      // A potted plant against the wall.
      px(ctx, ox + 6, oy + 9, 4, 5, '#a0603a');
      px(ctx, ox + 4, oy + 4, 8, 6, '#3a8a3a');
    }
  } else if (kind === 'lava') {
    water(ctx, p, ox, oy, rng, true);
  }
}

function pathTile(ctx: Ctx, p: Palette, ox: number, oy: number, rng: () => number, open: { n: boolean; s: boolean; e: boolean; w: boolean }): void {
  px(ctx, ox, oy, 16, 16, p.path);
  for (let i = 0; i < 4; i += 1) px(ctx, ox + 2 + Math.floor(rng() * 12), oy + 2 + Math.floor(rng() * 12), 1, 1, p.pathDot);
  if (!open.n) px(ctx, ox, oy, 16, 2, p.pathEdge);
  if (!open.s) px(ctx, ox, oy + 14, 16, 2, p.pathEdge);
  if (!open.w) px(ctx, ox, oy, 2, 16, p.pathEdge);
  if (!open.e) px(ctx, ox + 14, oy, 2, 16, p.pathEdge);
}

function warpPad(ctx: Ctx, ox: number, oy: number, colour: string): void {
  px(ctx, ox + 2, oy + 2, 12, 12, '#283048');
  px(ctx, ox + 4, oy + 4, 8, 8, colour);
  px(ctx, ox + 6, oy + 6, 4, 4, '#f8f8f8');
}

/** The whole map's ground, 16 px a tile, path included. */
export function renderGround(map: MapDef): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = COLS * TILE_PX;
  canvas.height = ROWS * TILE_PX;
  const ctx = canvas.getContext('2d')!;
  const p = PALETTES[map.theme];
  const rng = makeRng(hashString(map.id));
  const onPath = pathTiles(map);
  const isPath = (x: number, y: number): boolean => onPath.has(`${x},${y}`) || x < 0 || y < 0 || x >= COLS || y >= ROWS;

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const ox = x * TILE_PX;
      const oy = y * TILE_PX;
      const kind = terrainAt(map, x, y);
      if (onPath.has(`${x},${y}`)) {
        const here = (dx: number, dy: number): boolean => onPath.has(`${x + dx},${y + dy}`) || (isPath(x + dx, y + dy) && !(x + dx >= 0 && y + dy >= 0 && x + dx < COLS && y + dy < ROWS));
        pathTile(ctx, p, ox, oy, rng, { n: here(0, -1), s: here(0, 1), e: here(1, 0), w: here(-1, 0) });
      } else if (kind === 'water') {
        water(ctx, p, ox, oy, rng, false);
      } else if (kind === 'tree' || kind === 'rock' || kind === 'grave' || kind === 'wall' || kind === 'lava') {
        if (kind !== 'wall' && kind !== 'lava') ground(ctx, p, map.theme, ox, oy, rng, 'grass');
        blocker(ctx, p, map.theme, kind, ox, oy, rng);
      } else {
        ground(ctx, p, map.theme, ox, oy, rng, kind);
      }
    }
  }
  const colours = ['#f85888', '#58c8f8', '#f8d030'];
  warpTiles(map).forEach((w, i) => {
    const c = colours[i % colours.length]!;
    for (const pt of [w.from, w.to]) if (pt.x >= 0 && pt.y >= 0) warpPad(ctx, pt.x * TILE_PX, pt.y * TILE_PX, c);
  });
  return canvas;
}
