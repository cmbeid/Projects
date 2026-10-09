/**
 * Every sprite in the game, drawn in code as pixel art.
 *
 * Buildings are the heart of it: fourteen lines, each with a sprite for every
 * era it is built in, all sixteen pixels wide (one plot) and as tall as the
 * era makes them. Each era has a style — materials, roofs, windows — and each
 * line has a silhouette that carries across eras, so a farm still reads as a
 * farm when it turns into a hydroponic tower. Wonders, citizens, icons and
 * scenery follow.
 *
 * `scripts/bake-sprites.ts` packs this into `atlas.png` + `atlas.json`. Edit
 * here, then run `npm run bake`.
 */
import { LINES } from '../data/buildings';
import { RESOURCES } from '../data/resources';
import type { LineId } from '../data/types';
import { WONDERS } from '../data/wonders';
import { Px } from './px';

export interface SpriteDef {
  name: string;
  w: number;
  h: number;
  /** Row-major colours as '#rrggbb', or null for transparent. */
  px: (string | null)[];
}

type Tri = readonly [string, string, string];

interface Style {
  wall: Tri;
  roof: Tri;
  trim: string;
  edge: string;
  win: string;
  lit: string;
  accent: Tri;
}

const EDGE = '#1c1418';

/** One look per era. */
export const STYLES: readonly Style[] = [
  // Stone: hide, thatch and wood.
  { wall: ['#6a4a2a', '#8e6a40', '#b48c5a'], roof: ['#7a5a20', '#a8843a', '#d4b464'], trim: '#4a3018', edge: EDGE, win: '#2a1a10', lit: '#ffb040', accent: ['#8a2a1a', '#c84a2a', '#f08a4a'] },
  // Bronze: mudbrick and glazed tile.
  { wall: ['#946238', '#c4925a', '#e8c088'], roof: ['#a87a48', '#d0a46c', '#f0cc96'], trim: '#6a4020', edge: EDGE, win: '#3a2214', lit: '#ffc860', accent: ['#1e4a8a', '#3a6ab0', '#7aa8e0'] },
  // Classical: marble and terracotta.
  { wall: ['#a09c90', '#d6d2c6', '#f4f0e6'], roof: ['#8a3a1a', '#b85a2a', '#dc8250'], trim: '#8a8478', edge: '#2a2420', win: '#3a3430', lit: '#ffd080', accent: ['#6a2a6a', '#9a4a9a', '#d08ad0'] },
  // Medieval: grey stone, timber frames and slate.
  { wall: ['#5c5a56', '#827e78', '#aca69c'], roof: ['#343c4a', '#4e5868', '#727e90'], trim: '#3a2a1a', edge: EDGE, win: '#22201e', lit: '#ffb850', accent: ['#8a1a1a', '#b83030', '#e86060'] },
  // Renaissance: ochre stucco, red tile and copper domes.
  { wall: ['#b4884a', '#dcb476', '#f4dcaa'], roof: ['#8a2a1a', '#b04a2a', '#d46a48'], trim: '#f8f0dc', edge: '#2a1a14', win: '#2a2430', lit: '#ffd890', accent: ['#2a6a5a', '#4a9a82', '#82ccb0'] },
  // Industrial: red brick, slate and soot.
  { wall: ['#6a2a1c', '#963c26', '#b85a3a'], roof: ['#26262c', '#3c3c46', '#5a5a66'], trim: '#c8b89a', edge: '#140e0e', win: '#1a1a22', lit: '#ffcc60', accent: ['#3a3a40', '#5a5a64', '#8a8a96'] },
  // Modern: concrete and glass.
  { wall: ['#62666c', '#949aa2', '#c4c8ce'], roof: ['#3a3e44', '#54585e', '#74787e'], trim: '#e0e4e8', edge: '#16181c', win: '#2a4a6e', lit: '#ffe89a', accent: ['#2a5a8a', '#4a82b8', '#8ac0ec'] },
  // Space: white panels and light.
  { wall: ['#8a94a8', '#c6cede', '#eef2fc'], roof: ['#5a6478', '#7e88a0', '#a8b2c8'], trim: '#5ae0f0', edge: '#141a28', win: '#1a2a44', lit: '#7af0ff', accent: ['#1a8aa8', '#3ac0dc', '#a8f4ff'] },
];

/** Sprite height for each line, by era. */
const HEIGHTS: Record<LineId, readonly number[]> = {
  home: [12, 14, 24, 20, 28, 32, 44, 60],
  farm: [10, 12, 16, 14, 16, 18, 30, 44],
  lumber: [12, 14, 16, 16, 20, 26, 28, 26],
  quarry: [12, 14, 14, 16, 20, 26, 28, 30],
  mine: [0, 18, 20, 22, 24, 30, 26, 64],
  store: [10, 16, 16, 18, 20, 20, 22, 28],
  study: [12, 16, 20, 30, 30, 26, 40, 30],
  shrine: [22, 18, 18, 36, 30, 24, 22, 26],
  market: [0, 14, 16, 22, 24, 28, 22, 34],
  works: [0, 0, 0, 0, 0, 30, 28, 30],
  power: [0, 0, 0, 0, 0, 34, 30, 28],
  well: [0, 0, 0, 0, 0, 0, 30, 32],
  server: [0, 0, 0, 0, 0, 0, 22, 26],
  fab: [0, 0, 0, 0, 0, 0, 0, 28],
};

const W = 16;

function shade(c: string, k: number): string {
  const n = parseInt(c.slice(1), 16);
  const f = (v: number): number => Math.max(0, Math.min(255, Math.round(v * k)));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// --- Shared pieces -------------------------------------------------------------------

/** A body of wall with windows, from `top` down to the ground. */
function body(p: Px, s: Style, x: number, w: number, top: number, opts: { gx?: number; gy?: number; door?: boolean; seed?: number } = {}): void {
  const h = p.h - top;
  p.wall(x, top, w, h, s.wall, s.edge);
  const gx = opts.gx ?? 3;
  const gy = opts.gy ?? 4;
  if (h > 5 && w > 4) p.windows(x + 2, top + 2, w - 3, h - 5, gx, gy, s.win, s.lit, opts.seed ?? x + top);
  if (opts.door !== false) p.rect(x + Math.floor(w / 2) - 1, p.h - 4, 2, 4, s.trim);
}

function chimney(p: Px, s: Style, x: number, top: number, h: number, w = 2): void {
  p.rect(x, top, w, h, s.wall[0]);
  p.vline(x, top, h, s.edge);
  p.hline(x, top, w, s.edge);
  p.rect(x, top + 1, w, 1, s.accent[0]);
}

function antenna(p: Px, s: Style, x: number, top: number, h: number): void {
  p.vline(x, top, h, s.edge);
  p.set(x, top, s.lit);
}

function tree(p: Px, x: number, base: number, size: number, leaf: Tri): void {
  p.vline(x, base - size, size, '#4a3018');
  p.disc(x, base - size - 1, Math.max(1, Math.floor(size / 2)), leaf[1], leaf[0]);
  p.set(x - 1, base - size - 2, leaf[2]);
}

function crops(p: Px, x: number, w: number, rows: number, c: Tri, soil: string): void {
  for (let j = 0; j < rows; j++) {
    const y = p.h - 1 - j * 2;
    p.hline(x, y, w, soil);
    for (let i = x; i < x + w; i += 2) p.set(i + (j % 2), y - 1, j % 2 ? c[1] : c[2]);
  }
}

const LEAF: Tri = ['#2a5a22', '#3e8a32', '#7ac05a'];
const GRAIN: Tri = ['#8a6a1a', '#c8a030', '#f0d870'];

// --- Lines --------------------------------------------------------------------------

type Drawer = (p: Px, s: Style, era: number) => void;

const DRAW: Record<LineId, Drawer> = {
  home(p, s, era) {
    const H = p.h;
    switch (era) {
      case 0: // A hide tent on poles.
        p.gable(1, H - 1, 14, 10, s.wall, s.edge);
        p.rect(7, H - 5, 2, 4, s.win);
        p.line(7, 1, 4, 0, s.trim);
        p.line(8, 1, 11, 0, s.trim);
        break;
      case 1: // Mudbrick, flat roof, a ladder up.
        body(p, s, 2, 12, 4, { gx: 4, gy: 5 });
        p.hline(1, 4, 14, s.roof[0]);
        p.rect(3, 2, 4, 2, s.accent[1]);
        p.vline(13, 1, 4, s.trim);
        break;
      case 2: // Insula: shops below, flats above.
        body(p, s, 1, 14, 6, { gx: 3, gy: 4 });
        p.gable(0, 6, 16, 4, s.roof, s.edge);
        p.rect(2, H - 5, 3, 5, s.accent[1]);
        p.rect(11, H - 5, 3, 5, s.accent[1]);
        break;
      case 3: // Timber frame with a jettied upper floor.
        p.wall(2, 12, 12, H - 12, ['#c8bc9c', '#e6dcc0', '#f4ecd6'], s.edge);
        p.wall(1, 7, 14, 6, ['#c8bc9c', '#e6dcc0', '#f4ecd6'], s.edge);
        for (const x of [4, 8, 11]) p.vline(x, 8, H - 9, s.trim);
        p.line(2, 8, 6, 12, s.trim);
        p.gable(0, 7, 16, 7, s.roof, s.edge);
        p.rect(7, H - 4, 2, 4, s.trim);
        p.set(5, 10, s.lit);
        break;
      case 4: // Townhouse: tall and narrow, a pediment, glass.
        body(p, s, 2, 12, 6, { gx: 3, gy: 5 });
        p.gable(1, 6, 14, 3, s.roof, s.edge);
        p.hline(2, 12, 12, s.trim);
        p.hline(2, 18, 12, s.trim);
        break;
      case 5: // Tenement: brick, chimneys, washing line.
        body(p, s, 1, 14, 5, { gx: 3, gy: 4 });
        p.hline(0, 5, 16, s.roof[1]);
        chimney(p, s, 3, 1, 4);
        chimney(p, s, 11, 2, 3);
        p.hline(1, 14, 14, s.edge);
        p.set(4, 15, '#e8e8f0');
        p.set(9, 15, '#c84a4a');
        break;
      case 6: // Apartment block: concrete bands and glass.
        body(p, s, 1, 14, 4, { gx: 2, gy: 3 });
        for (let y = 7; y < H - 4; y += 6) p.hline(1, y, 14, s.trim);
        p.rect(4, 1, 4, 3, s.roof[1]);
        antenna(p, s, 12, 0, 4);
        break;
      default: { // Arcology spire: a tapering tower with gardens.
        for (let j = 0; j < H; j++) {
          const half = Math.round(2 + (6 * j) / H);
          p.hline(8 - half, j, half * 2, j % 6 === 0 ? s.trim : s.wall[1]);
          p.set(8 - half, j, s.edge);
          p.set(7 + half, j, s.edge);
          p.set(8 - half + 1, j, s.wall[2]);
          if (j % 3 === 1) for (let i = 9 - half; i < 7 + half; i += 2) p.set(i, j, j % 9 === 1 ? s.lit : s.win);
          if (j % 12 === 6) p.hline(9 - half, j, half * 2 - 2, LEAF[1]);
        }
        antenna(p, s, 8, 0, 6);
      }
    }
  },

  farm(p, s, era) {
    const H = p.h;
    const soil = shade(s.wall[0], 0.7);
    switch (era) {
      case 0:
        crops(p, 0, 16, 3, GRAIN, soil);
        p.vline(0, H - 6, 6, s.trim);
        p.vline(15, H - 6, 6, s.trim);
        p.hline(0, H - 5, 16, s.trim);
        break;
      case 1:
        crops(p, 0, 16, 4, GRAIN, soil);
        p.hline(0, H - 1, 16, '#3a6ab0');
        p.vline(13, H - 10, 9, s.trim);
        p.line(9, H - 10, 15, H - 8, s.trim);
        break;
      case 2:
        crops(p, 0, 16, 2, LEAF, soil);
        tree(p, 3, H - 2, 6, LEAF);
        tree(p, 8, H - 2, 7, LEAF);
        tree(p, 13, H - 2, 6, LEAF);
        break;
      case 3:
        crops(p, 0, 16, 3, GRAIN, soil);
        p.wall(9, H - 7, 6, 7, s.wall, s.edge);
        p.gable(8, H - 7, 8, 4, s.roof, s.edge);
        break;
      case 4:
        crops(p, 0, 16, 3, ['#5a7a2a', '#8aa83a', '#c0d870'], soil);
        p.wall(1, H - 9, 8, 9, ['#8a3a2a', '#b85a3a', '#d8805a'], s.edge);
        p.gable(0, H - 9, 10, 5, s.roof, s.edge);
        p.rect(4, H - 5, 2, 5, s.trim);
        break;
      case 5:
        crops(p, 0, 16, 3, GRAIN, soil);
        p.wall(0, H - 8, 9, 8, s.wall, s.edge);
        p.gable(0, H - 8, 9, 4, s.roof, s.edge);
        chimney(p, s, 12, H - 14, 9);
        p.disc(12, H - 3, 2, '#3a3a40', EDGE);
        break;
      case 6:
        crops(p, 0, 16, 3, GRAIN, soil);
        p.wall(9, 4, 6, H - 4, ['#8a9098', '#b8bec6', '#dce0e6'], s.edge);
        p.dome(12, 4, 3, ['#8a9098', '#b8bec6', '#dce0e6'], s.edge);
        p.hline(9, 12, 6, s.edge);
        p.wall(1, H - 8, 7, 8, ['#8a2a1a', '#b03a2a', '#d0604a'], s.edge);
        break;
      default:
        p.wall(2, 2, 12, H - 2, ['#4a8a8a', '#7ac0c0', '#c0f0f0'], s.edge);
        for (let y = 5; y < H - 2; y += 4) {
          p.hline(3, y, 10, LEAF[1]);
          p.hline(3, y + 1, 10, '#b070f0');
        }
        p.rect(4, 0, 8, 2, s.roof[1]);
        antenna(p, s, 8, 0, 2);
    }
  },

  lumber(p, s, era) {
    const H = p.h;
    const log = (x: number, y: number, w: number): void => {
      p.hline(x, y, w, '#8a5a2a');
      p.set(x, y, '#c89a5a');
      p.set(x + w - 1, y, '#4a2a14');
    };
    switch (era) {
      case 0:
        for (let j = 0; j < 3; j++) log(1 + j, H - 1 - j, 8 - j * 2);
        tree(p, 12, H - 1, 7, LEAF);
        p.line(10, H - 1, 6, H - 6, s.trim);
        break;
      case 1:
      case 2:
        for (let j = 0; j < 4; j++) log(0 + j, H - 1 - j, 9 - j * 2);
        p.wall(9, H - 8, 6, 8, s.wall, s.edge);
        p.gable(8, H - 8, 8, 3 + era, s.roof, s.edge);
        break;
      case 3:
        p.rect(0, H - 4, 16, 4, shade(s.wall[0], 0.6));
        p.hline(2, H - 7, 12, '#8a5a2a');
        p.vline(3, H - 10, 10, s.trim);
        p.vline(12, H - 10, 10, s.trim);
        p.vline(8, H - 12, 9, '#c8c8d0');
        break;
      case 4: // Water sawmill.
        p.wall(0, H - 12, 11, 12, s.wall, s.edge);
        p.gable(0, H - 12, 11, 6, s.roof, s.edge);
        p.disc(12, H - 6, 4, '#6a4a2a', EDGE);
        for (let a = 0; a < 8; a++) p.set(12 + Math.round(Math.cos(a) * 3), H - 6 + Math.round(Math.sin(a) * 3), '#c89a5a');
        p.rect(10, H - 2, 6, 2, '#3a6ab0');
        break;
      case 5:
        body(p, s, 0, 12, 10, { gx: 4, gy: 5 });
        p.hline(0, 10, 12, s.roof[1]);
        chimney(p, s, 13, 0, H);
        for (let j = 0; j < 3; j++) log(1, H - 1 - j, 6);
        break;
      case 6: // Pulp mill: tanks and pipes.
        body(p, s, 0, 9, 10, { gx: 3, gy: 4 });
        p.wall(10, 6, 5, H - 6, ['#7a7e86', '#a4aab2', '#ccd0d6'], s.edge);
        p.dome(12, 6, 2, ['#7a7e86', '#a4aab2', '#ccd0d6'], s.edge);
        p.hline(8, 12, 3, s.edge);
        break;
      default: // Bio-timber vat.
        p.wall(1, 8, 14, H - 8, ['#2a6a4a', '#4aa070', '#8ae0a8'], s.edge);
        p.dome(8, 8, 6, ['#6aa0c0', '#9ad0f0', '#d0f4ff'], s.edge);
        tree(p, 8, 8, 3, LEAF);
        p.hline(2, H - 6, 12, s.trim);
    }
  },

  quarry(p, s, era) {
    const H = p.h;
    const stone: Tri = ['#5a5a64', '#8a8a96', '#bcbcc8'];
    const block = (x: number, y: number, w: number, h: number, t: Tri = stone): void => {
      p.wall(x, y, w, h, t, s.edge);
    };
    switch (era) {
      case 0:
        block(0, H - 8, 7, 8, ['#a8a8a0', '#d8d8d0', '#f4f4ec']);
        block(8, H - 4, 4, 4, stone);
        block(12, H - 3, 3, 3, stone);
        break;
      case 1:
      case 2: {
        const t: Tri = era === 2 ? ['#b8b4aa', '#e6e2d8', '#fffcf4'] : stone;
        block(0, H - 10, 9, 10, t);
        p.hline(1, H - 6, 7, t[0]);
        block(10, H - 4, 5, 4, t);
        p.line(11, H - 4, 14, H - 12, s.trim);
        break;
      }
      case 3: // Masons' yard: a lodge and blocks.
        p.wall(0, H - 10, 9, 10, ['#c8bc9c', '#e6dcc0', '#f4ecd6'], s.edge);
        p.gable(0, H - 10, 9, 5, s.roof, s.edge);
        block(10, H - 4, 5, 4);
        block(11, H - 7, 3, 3);
        break;
      case 4: // Brickworks: bottle kilns.
        for (const x of [4, 11]) {
          for (let j = 0; j < 14; j++) {
            const half = j < 10 ? 3 + Math.round(Math.sin((j / 10) * Math.PI) * 1) : 2;
            p.hline(x - half, H - 1 - j, half * 2, j % 3 ? s.wall[1] : s.wall[0]);
          }
          chimney(p, s, x - 1, H - 20, 6);
        }
        break;
      case 5: // Cement works: silos.
        body(p, s, 0, 8, H - 12, { gx: 3, gy: 4 });
        p.wall(9, 4, 6, H - 4, ['#8a8a8e', '#b4b4b8', '#dadade'], s.edge);
        p.dome(12, 4, 3, ['#8a8a8e', '#b4b4b8', '#dadade'], s.edge);
        p.line(7, H - 12, 10, 6, s.edge);
        break;
      case 6: // Concrete plant: drum and conveyor.
        p.wall(0, 6, 7, H - 6, s.wall, s.edge);
        p.disc(11, H - 8, 4, '#d8a830', EDGE);
        p.line(4, 6, 13, H - 14, s.edge);
        p.rect(8, H - 3, 7, 3, s.roof[1]);
        break;
      default: // Regolith printer: a gantry over a half-printed wall.
        p.rect(1, 4, 14, 2, s.wall[1]);
        p.vline(1, 4, H - 4, s.edge);
        p.vline(14, 4, H - 4, s.edge);
        p.rect(6, 6, 3, 4, s.accent[1]);
        p.set(7, 10, s.lit);
        block(3, H - 10, 10, 10, ['#8a6a5a', '#b08a78', '#d8b8a4']);
    }
  },

  mine(p, s, era) {
    const H = p.h;
    const frame = (c: string, top: number): void => {
      p.line(3, H - 1, 7, top, c);
      p.line(12, H - 1, 8, top, c);
      p.hline(4, top + 6, 8, c);
      p.disc(7, top + 1, 2, s.accent[1], EDGE);
    };
    switch (era) {
      case 1:
        p.rect(0, H - 3, 16, 3, '#6a5a4a');
        p.disc(8, H - 3, 3, '#1a1210');
        p.line(4, H - 3, 8, H - 12, s.trim);
        p.line(12, H - 3, 8, H - 12, s.trim);
        p.set(8, H - 9, '#2a8a6a');
        p.set(13, H - 2, '#2a8a6a');
        break;
      case 2:
      case 3:
        frame(s.trim, 2);
        p.rect(0, H - 4, 16, 4, '#5a4a3a');
        p.rect(6, H - 4, 4, 4, '#1a1210');
        break;
      case 4: // Deep mine: an engine house.
        p.wall(0, H - 16, 9, 16, s.wall, s.edge);
        p.gable(0, H - 16, 9, 4, s.roof, s.edge);
        chimney(p, s, 10, 0, H);
        p.line(9, H - 12, 15, H - 6, s.trim);
        break;
      case 5: // Colliery: a steel winding tower.
        frame('#3a3a44', 1);
        p.wall(0, H - 8, 6, 8, s.wall, s.edge);
        p.rect(9, H - 5, 7, 5, '#1a1a1e');
        p.set(10, H - 6, '#3a3a3a');
        p.set(13, H - 6, '#3a3a3a');
        break;
      case 6: // Strip mine: an excavator.
        p.rect(0, H - 4, 16, 4, '#7a6a5a');
        p.wall(2, H - 12, 8, 7, ['#b08a20', '#e0b030', '#f8d870'], s.edge);
        p.line(9, H - 10, 15, H - 18, '#3a3a40');
        p.rect(13, H - 18, 3, 3, '#3a3a40');
        p.rect(1, H - 5, 10, 2, '#2a2a2e');
        break;
      default: // Asteroid tether: a cable to the sky and a landing cradle.
        p.vline(8, 0, H - 8, s.trim);
        p.vline(7, 0, H - 8, s.edge);
        p.disc(8, 6, 3, '#6a5a50', EDGE);
        p.wall(2, H - 10, 12, 10, s.wall, s.edge);
        p.hline(3, H - 6, 10, s.trim);
    }
  },

  store(p, s, era) {
    const H = p.h;
    switch (era) {
      case 0:
        p.rect(1, H - 3, 14, 3, '#5a4a3a');
        p.disc(5, H - 4, 2, '#8a8a90', EDGE);
        p.disc(10, H - 4, 3, '#a8a8b0', EDGE);
        p.gable(3, H - 3, 10, 5, s.roof, s.edge);
        break;
      case 1: // Granary on stilts.
        p.wall(2, 6, 12, H - 10, s.wall, s.edge);
        p.dome(8, 6, 6, s.roof, s.edge);
        p.vline(3, H - 4, 4, s.trim);
        p.vline(12, H - 4, 4, s.trim);
        break;
      case 2:
        body(p, s, 1, 14, 6, { gx: 5, gy: 6, door: false });
        p.gable(0, 6, 16, 4, s.roof, s.edge);
        p.rect(6, H - 6, 4, 6, s.trim);
        break;
      case 3: // Tithe barn.
        p.wall(0, 9, 16, H - 9, s.wall, s.edge);
        p.gable(0, 9, 16, 8, s.roof, s.edge);
        p.rect(6, H - 7, 4, 7, s.trim);
        break;
      case 4:
        body(p, s, 0, 16, 6, { gx: 4, gy: 5, door: false });
        p.gable(0, 6, 16, 5, s.roof, s.edge);
        p.rect(6, H - 6, 4, 6, '#5a3a1a');
        p.vline(8, 0, 4, s.trim);
        break;
      case 5: // Rail depot.
        p.wall(0, 6, 16, H - 8, s.wall, s.edge);
        p.hline(0, 6, 16, s.roof[1]);
        p.rect(1, H - 2, 14, 1, '#4a4a50');
        p.rect(2, H - 7, 12, 5, '#3a5a3a');
        p.set(4, H - 1, EDGE);
        p.set(11, H - 1, EDGE);
        break;
      case 6: // Distribution centre: a big box with loading bays.
        p.wall(0, 6, 16, H - 6, s.wall, s.edge);
        p.hline(0, 6, 16, s.trim);
        for (const x of [2, 7, 12]) p.rect(x, H - 5, 3, 5, s.roof[0]);
        p.rect(3, 9, 10, 2, s.accent[1]);
        break;
      default: // Orbital depot: a landing pad and a capsule.
        p.wall(1, H - 8, 14, 8, s.wall, s.edge);
        p.hline(0, H - 8, 16, s.trim);
        p.wall(5, 4, 6, H - 12, s.wall, s.edge);
        p.dome(8, 4, 3, s.wall, s.edge);
        p.set(8, H - 14, s.lit);
    }
  },

  study(p, s, era) {
    const H = p.h;
    switch (era) {
      case 0: // A fire and the stones round it.
        p.disc(8, H - 4, 3, '#ff8a1a');
        p.disc(8, H - 5, 1, '#fff0a0');
        p.line(5, H - 1, 11, H - 3, '#6a4a2a');
        p.line(5, H - 3, 11, H - 1, '#6a4a2a');
        p.rect(0, H - 3, 3, 3, '#8a8a96');
        p.rect(13, H - 4, 3, 4, '#8a8a96');
        p.set(8, H - 9, '#888');
        break;
      case 1:
        body(p, s, 1, 14, 6, { gx: 4, gy: 5 });
        p.hline(0, 6, 16, s.roof[0]);
        p.rect(3, 3, 3, 3, s.accent[1]);
        p.rect(10, 3, 3, 3, s.accent[1]);
        break;
      case 2: // Academy: a colonnade.
        p.rect(0, H - 2, 16, 2, s.wall[1]);
        p.rect(0, 7, 16, 2, s.wall[1]);
        for (const x of [1, 5, 10, 14]) p.rect(x, 9, 2, H - 11, s.wall[2]);
        p.gable(0, 7, 16, 5, s.roof, s.edge);
        p.hline(0, 8, 16, s.edge);
        break;
      case 3: // Monastery: a bell tower.
        p.wall(0, 14, 10, H - 14, s.wall, s.edge);
        p.gable(0, 14, 10, 5, s.roof, s.edge);
        p.wall(10, 4, 6, H - 4, s.wall, s.edge);
        p.gable(10, 4, 6, 4, s.roof, s.edge);
        p.disc(13, 8, 1, '#c8a030');
        p.rect(3, H - 8, 4, 4, s.lit);
        break;
      case 4: // University with a dome.
        body(p, s, 0, 16, 12, { gx: 3, gy: 5 });
        p.dome(8, 12, 5, s.accent, s.edge);
        p.vline(8, 5, 3, s.edge);
        p.hline(0, 12, 16, s.trim);
        break;
      case 5: // Laboratory: brick and a glass roof.
        body(p, s, 0, 13, 8, { gx: 3, gy: 4 });
        p.gable(0, 8, 13, 4, ['#7aa0c0', '#a8c8e0', '#d8ecf8'], s.edge);
        chimney(p, s, 13, 2, H - 2);
        p.set(14, 1, '#7af07a');
        break;
      case 6: // Research institute: a glass slab and a radio dish.
        body(p, s, 1, 12, 8, { gx: 2, gy: 3 });
        p.disc(13, 5, 3, '#e0e4e8', EDGE);
        p.vline(13, 8, H - 8, s.edge);
        break;
      default: // Quantum lab: a sphere held in a frame.
        p.wall(1, H - 12, 14, 12, s.wall, s.edge);
        p.disc(8, 9, 7, '#2a3a6a', s.edge);
        p.disc(8, 9, 3, s.lit);
        p.hline(1, 9, 14, s.trim);
    }
  },

  shrine(p, s, era) {
    const H = p.h;
    switch (era) {
      case 0: { // A carved totem.
        const faces = ['#c84a2a', '#3a6ab0', '#d8a830'];
        for (let j = 0; j < 4; j++) {
          const y = 2 + j * 5;
          p.wall(5, y, 6, 5, ['#6a4a2a', '#8e6a40', '#b48c5a'], s.edge);
          p.set(6, y + 2, faces[j % 3]!);
          p.set(9, y + 2, faces[j % 3]!);
          p.hline(7, y + 3, 2, EDGE);
        }
        p.line(1, 3, 5, 5, '#b48c5a');
        p.line(14, 3, 10, 5, '#b48c5a');
        break;
      }
      case 1: // Step shrine.
        for (let j = 0; j < 4; j++) p.wall(1 + j * 2, H - 4 - j * 4, 14 - j * 4, 4, s.wall, s.edge);
        p.rect(7, 1, 2, 2, s.accent[1]);
        break;
      case 2: { // Theatre: a half bowl of seats.
        for (let j = 0; j < 8; j++) p.hline(j, H - 1 - j * 2, 16 - j * 2, j % 2 ? s.wall[1] : s.wall[2]);
        p.rect(6, H - 4, 4, 4, s.accent[1]);
        break;
      }
      case 3: // Chapel with a spire.
        p.wall(0, 18, 16, H - 18, s.wall, s.edge);
        p.gable(0, 18, 16, 6, s.roof, s.edge);
        p.wall(5, 8, 6, 10, s.wall, s.edge);
        p.gable(5, 8, 6, 8, s.roof, s.edge);
        p.disc(8, H - 9, 2, s.accent[1], s.edge);
        p.rect(7, H - 4, 2, 4, s.trim);
        break;
      case 4: // Opera house.
        body(p, s, 0, 16, 14, { gx: 3, gy: 5 });
        p.dome(8, 14, 6, s.accent, s.edge);
        p.rect(7, 4, 2, 4, '#d8a830');
        for (const x of [2, 6, 10, 13]) p.vline(x, 15, H - 15, s.trim);
        break;
      case 5: // Music hall: a marquee of bulbs.
        body(p, s, 0, 16, 6, { gx: 3, gy: 4 });
        p.rect(1, H - 10, 14, 3, '#c83a3a');
        for (let i = 1; i < 15; i += 2) p.set(i, H - 11, '#ffe880');
        p.hline(0, 6, 16, s.trim);
        break;
      case 6: // Stadium: a bowl and floodlights.
        for (let j = 0; j < 7; j++) p.hline(j < 4 ? 0 : j - 3, H - 1 - j * 2, j < 4 ? 16 : 16 - (j - 3) * 2, j % 2 ? s.wall[1] : s.wall[2]);
        p.vline(1, 0, H - 4, s.edge);
        p.vline(14, 0, H - 4, s.edge);
        p.rect(0, 0, 3, 2, '#fff6c0');
        p.rect(13, 0, 3, 2, '#fff6c0');
        p.rect(4, H - 3, 8, 3, '#3a8a3a');
        break;
      default: // Holo-arena: a glowing dome.
        p.wall(0, H - 8, 16, 8, s.wall, s.edge);
        p.dome(8, H - 8, 7, ['#2a8aa8', '#4ac0e0', '#b0f4ff'], s.edge);
        p.set(5, H - 12, '#ffffff');
        p.set(10, H - 10, '#f0a0ff');
    }
  },

  market(p, s, era) {
    const H = p.h;
    const awning = (x: number, y: number, w: number, a: string, b: string): void => {
      for (let i = 0; i < w; i++) {
        p.set(x + i, y, i % 2 ? a : b);
        p.set(x + i, y + 1, i % 2 ? a : b);
      }
      p.hline(x, y + 2, w, EDGE);
    };
    switch (era) {
      case 1:
        awning(0, H - 9, 16, s.accent[1], '#f0e0c0');
        p.vline(1, H - 7, 7, s.trim);
        p.vline(14, H - 7, 7, s.trim);
        p.rect(3, H - 4, 10, 4, s.wall[1]);
        p.set(5, H - 5, '#d8743a');
        p.set(9, H - 5, '#3e8a32');
        break;
      case 2: // Agora stoa.
        p.rect(0, 5, 16, 2, s.wall[1]);
        for (const x of [1, 4, 7, 10, 13]) p.vline(x, 7, H - 8, s.wall[2]);
        p.rect(0, H - 1, 16, 1, s.wall[0]);
        p.gable(0, 5, 16, 3, s.roof, s.edge);
        break;
      case 3: // Market hall on posts.
        p.wall(0, 6, 16, 8, ['#c8bc9c', '#e6dcc0', '#f4ecd6'], s.edge);
        for (const x of [0, 5, 10, 15]) p.vline(x, 14, H - 14, s.trim);
        p.gable(0, 6, 16, 6, s.roof, s.edge);
        awning(2, H - 6, 12, s.accent[1], '#f0e0c0');
        break;
      case 4: // Counting house.
        body(p, s, 1, 14, 6, { gx: 3, gy: 5 });
        p.gable(0, 6, 16, 4, s.roof, s.edge);
        p.disc(8, 4, 1, '#d8a830');
        awning(1, H - 8, 14, '#2a5a3a', '#f0e0c0');
        break;
      case 5: // Exchange: columns and a clock.
        body(p, s, 0, 16, 8, { gx: 4, gy: 6, door: false });
        for (const x of [1, 5, 10, 14]) p.vline(x, 9, H - 9, s.trim);
        p.gable(0, 8, 16, 5, s.roof, s.edge);
        p.disc(8, 6, 2, '#f0e8c8', s.edge);
        break;
      case 6: // Shopping mall.
        p.wall(0, 6, 16, H - 6, s.wall, s.edge);
        p.rect(1, H - 6, 14, 5, s.win);
        p.rect(2, 8, 12, 3, '#d84a6a');
        p.hline(0, 6, 16, s.trim);
        break;
      default: // Data exchange: a ticker tower.
        p.wall(3, 0, 10, H, s.wall, s.edge);
        for (let y = 3; y < H - 4; y += 4) {
          p.hline(4, y, 8, '#2ae07a');
          p.set(4 + ((y * 3) % 8), y, '#e04a4a');
        }
        p.rect(0, H - 6, 16, 6, s.roof[1]);
    }
  },

  works(p, s, era) {
    const H = p.h;
    switch (era) {
      case 5: // Steelworks: a converter, glowing.
        body(p, s, 0, 10, 12, { gx: 3, gy: 4 });
        p.hline(0, 12, 10, s.roof[1]);
        chimney(p, s, 11, 0, H, 3);
        p.disc(5, H - 5, 3, '#ff8a2a', EDGE);
        p.set(5, H - 6, '#fff0a0');
        break;
      case 6: // Steel plant: sheds and a rolling mill.
        p.wall(0, 8, 16, H - 8, s.wall, s.edge);
        for (let x = 0; x < 16; x += 4) p.gable(x, 8, 4, 3, s.roof, s.edge);
        chimney(p, s, 13, 0, 8);
        p.rect(2, H - 6, 9, 2, '#ff8a2a');
        break;
      default: // Nanoforge.
        p.wall(1, 10, 14, H - 10, s.wall, s.edge);
        p.disc(8, 8, 5, '#3a2a6a', s.edge);
        p.disc(8, 8, 2, '#c08aff');
        p.hline(2, H - 6, 12, s.trim);
    }
  },

  power(p, s, era) {
    const H = p.h;
    switch (era) {
      case 5: // Coal power station: two stacks.
        body(p, s, 0, 16, 14, { gx: 3, gy: 4 });
        p.hline(0, 14, 16, s.roof[1]);
        chimney(p, s, 3, 0, 14, 3);
        chimney(p, s, 10, 2, 12, 3);
        break;
      case 6: { // Oil station: a cooling tower.
        for (let j = 0; j < H - 4; j++) {
          const t = j / (H - 4);
          const half = Math.round(5 - Math.sin(t * Math.PI) * 1.5);
          p.hline(8 - half, j, half * 2, j % 4 ? '#c4c8ce' : '#949aa2');
          p.set(8 - half, j, EDGE);
          p.set(7 + half, j, EDGE);
        }
        p.rect(0, H - 4, 16, 4, s.wall[0]);
        break;
      }
      default: // Fusion reactor: a torus.
        p.wall(0, H - 8, 16, 8, s.wall, s.edge);
        p.disc(8, H - 14, 7, s.wall[1], s.edge);
        p.disc(8, H - 14, 4, '#2a3a6a');
        p.disc(8, H - 14, 2, '#ff70ff');
        p.set(8, H - 14, '#ffffff');
    }
  },

  well(p, s, era) {
    const H = p.h;
    if (era === 6) {
      // Oil derrick and a nodding donkey.
      p.line(2, H - 1, 6, 0, '#3a3a40');
      p.line(10, H - 1, 6, 0, '#3a3a40');
      for (let y = 6; y < H; y += 6) p.hline(6 - Math.round((y / H) * 4), y, Math.round((y / H) * 8), '#3a3a40');
      p.line(9, H - 8, 15, H - 6, '#d8a830');
      p.vline(12, H - 7, 7, '#3a3a40');
      p.rect(0, H - 2, 16, 2, '#1a1a1e');
    } else {
      p.wall(0, H - 14, 16, 14, s.wall, s.edge);
      p.wall(3, 4, 4, H - 18, s.wall, s.edge);
      p.wall(9, 8, 4, H - 22, s.wall, s.edge);
      p.disc(5, 4, 2, s.lit);
      p.hline(1, H - 8, 14, s.trim);
    }
  },

  server(p, s, era) {
    const H = p.h;
    p.wall(0, 2, 16, H - 2, s.wall, s.edge);
    for (let x = 2; x < 14; x += 3) {
      p.rect(x, 4, 2, H - 6, era === 6 ? '#1a1a22' : '#1a2040');
      for (let y = 5; y < H - 3; y += 2) p.set(x + (y % 4 === 1 ? 0 : 1), y, (x + y) % 3 ? '#2ae07a' : '#e0a02a');
    }
    if (era === 7) {
      p.rect(4, 0, 8, 2, '#a8e8ff');
      p.hline(0, 2, 16, s.trim);
    }
  },

  fab(p, s) {
    const H = p.h;
    p.wall(0, 8, 16, H - 8, s.wall, s.edge);
    p.gable(0, 8, 16, 6, s.roof, s.edge);
    p.rect(3, H - 10, 10, 6, '#1a1030');
    p.rect(5, H - 8, 6, 2, '#c08aff');
    p.hline(0, 14, 16, s.trim);
    antenna(p, s, 13, 0, 3);
  },
};

// --- Wonders ------------------------------------------------------------------------

const WONDER_DRAW: Record<string, (p: Px) => void> = {
  'standing-stones'(p) {
    const s: Tri = ['#5a5a64', '#8a8a96', '#bcbcc8'];
    for (const [x, h] of [[1, 16], [7, 20], [14, 18], [21, 20], [28, 18], [34, 16]] as const) p.wall(x, p.h - h, 5, h, s, EDGE);
    p.wall(6, p.h - 23, 12, 3, s, EDGE);
    p.wall(20, p.h - 23, 12, 3, s, EDGE);
  },
  ziggurat(p) {
    const st = STYLES[1]!;
    for (let j = 0; j < 5; j++) p.wall(j * 4, p.h - 7 - j * 6, p.w - j * 8, 7, st.wall, EDGE);
    p.wall(20, 1, 8, 5, st.accent, EDGE);
    p.line(22, p.h - 1, 24, 6, st.trim);
  },
  'hanging-gardens'(p) {
    const st = STYLES[1]!;
    for (let j = 0; j < 4; j++) {
      const x = j * 4;
      const y = p.h - 8 - j * 8;
      p.wall(x, y, p.w - j * 8, 8, st.wall, EDGE);
      for (let i = x + 1; i < p.w - x - 1; i += 3) tree(p, i, y, 3, LEAF);
      p.vline(x + 2, y + 1, 7, LEAF[0]);
    }
    p.vline(p.w - 6, 4, p.h - 4, '#3a6ab0');
  },
  'great-library'(p) {
    const st = STYLES[2]!;
    p.wall(0, p.h - 4, p.w, 4, st.wall, EDGE);
    p.rect(2, 10, p.w - 4, 3, st.wall[1]);
    for (let x = 4; x < p.w - 4; x += 5) p.rect(x, 13, 2, p.h - 17, st.wall[2]);
    p.gable(2, 10, p.w - 4, 8, st.roof, EDGE);
    p.disc(p.w / 2, 7, 2, '#d8a830');
  },
  colossus(p) {
    const b: Tri = ['#6a4a1a', '#a87a2a', '#e0b050'];
    p.wall(4, p.h - 6, 18, 6, ['#8a8a96', '#b4b4c0', '#dadae4'], EDGE);
    // Legs astride the harbour mouth.
    for (let j = 0; j < 18; j++) {
      const y = p.h - 7 - j;
      p.hline(6 + Math.round(j / 4), y, 3, j % 5 ? b[1] : b[0]);
      p.hline(17 - Math.round(j / 4), y, 3, j % 5 ? b[1] : b[0]);
    }
    p.wall(9, 16, 9, 17, b, EDGE);
    p.hline(9, 28, 9, b[0]);
    p.disc(13, 12, 3, b[1], EDGE);
    p.set(12, 11, b[2]);
    p.line(8, 18, 5, 26, b[1]);
    p.line(17, 17, 22, 5, b[1]);
    p.line(18, 17, 23, 5, b[0]);
    p.disc(23, 3, 2, '#ff8a1a');
    p.set(23, 2, '#fff0a0');
  },
  cathedral(p) {
    const st = STYLES[3]!;
    p.wall(0, 28, p.w, p.h - 28, st.wall, EDGE);
    p.gable(0, 28, p.w, 8, st.roof, EDGE);
    for (const x of [2, p.w - 12]) {
      p.wall(x, 8, 10, p.h - 8, st.wall, EDGE);
      p.gable(x, 8, 10, 8, st.roof, EDGE);
      p.rect(x + 3, 14, 4, 6, st.win);
    }
    p.disc(p.w / 2, 38, 5, '#5a3aa8', EDGE);
    p.disc(p.w / 2, 38, 2, '#e8c040');
    p.rect(p.w / 2 - 2, p.h - 9, 4, 9, st.trim);
  },
  'castle-keep'(p) {
    const st = STYLES[3]!;
    p.wall(0, 18, p.w, p.h - 18, st.wall, EDGE);
    for (let x = 0; x < p.w; x += 4) p.rect(x, 16, 2, 2, st.wall[1]);
    p.wall(18, 2, 20, p.h - 2, st.wall, EDGE);
    for (let x = 18; x < 38; x += 4) p.rect(x, 0, 2, 2, st.wall[1]);
    p.rect(26, p.h - 10, 4, 10, st.trim);
    p.vline(28, 0, 2, EDGE);
    p.rect(29, 0, 4, 2, st.accent[1]);
  },
  observatory(p) {
    const st = STYLES[4]!;
    p.wall(4, 18, 32, p.h - 18, st.wall, EDGE);
    p.dome(20, 18, 14, st.accent, EDGE);
    p.rect(19, 4, 3, 14, '#1a1a2a');
    p.line(22, 6, 32, 0, '#d8a830');
    p.hline(4, 18, 32, st.trim);
  },
  'grand-canal'(p) {
    const st = STYLES[4]!;
    p.rect(0, p.h - 6, p.w, 6, '#3a6ab0');
    p.hline(0, p.h - 6, p.w, '#9ad0f0');
    for (const x of [10, 40]) {
      p.wall(x, 2, 12, p.h - 8, st.wall, EDGE);
      p.gable(x, 2, 12, 2, st.roof, EDGE);
      p.rect(x + 3, p.h - 12, 6, 6, st.win);
    }
    p.rect(30, p.h - 9, 6, 3, '#8a5a2a');
  },
  exhibition(p) {
    for (let j = 0; j < p.h; j++) {
      const half = Math.round(Math.sqrt(Math.max(0, 1 - ((p.h - j) / p.h) ** 2)) * (p.w / 2 - 1));
      for (let i = -half; i <= half; i++) p.set(p.w / 2 + i, j, (i + j) % 4 === 0 ? '#5a7a9a' : '#b8d8f0');
      p.set(p.w / 2 - half, j, EDGE);
      p.set(p.w / 2 + half, j, EDGE);
    }
    p.hline(0, p.h - 1, p.w, EDGE);
    p.vline(p.w / 2, 0, p.h, '#5a7a9a');
  },
  'iron-bridge'(p) {
    const c = '#6a3a2a';
    p.hline(0, 10, p.w, c);
    p.hline(0, 11, p.w, EDGE);
    for (let i = 0; i < p.w; i++) {
      const y = Math.round(12 + Math.sin((i / (p.w - 1)) * Math.PI) * -10 + 10);
      p.set(i, y, c);
      if (i % 4 === 0) p.vline(i, 12, Math.max(0, y - 12), c);
    }
    p.rect(0, 12, 3, p.h - 12, '#8a8a96');
    p.rect(p.w - 3, 12, 3, p.h - 12, '#8a8a96');
  },
  'sky-tower'(p) {
    const st = STYLES[6]!;
    for (let j = 0; j < p.h; j++) {
      const half = Math.max(1, Math.round(2 + (8 * j) / p.h));
      p.hline(p.w / 2 - half, j, half * 2, j % 5 === 0 ? st.trim : st.accent[1]);
      p.set(p.w / 2 - half, j, EDGE);
      p.set(p.w / 2 + half - 1, j, EDGE);
    }
    p.rect(p.w / 2 - 4, 20, 8, 4, st.wall[2]);
    p.vline(p.w / 2, 0, 6, '#ff4a4a');
  },
  'grand-dam'(p) {
    for (let j = 0; j < p.h; j++) {
      const inset = Math.round((j / p.h) * 6);
      p.hline(inset, j, p.w - inset * 2, j % 6 === 0 ? '#9aa0a8' : '#c4c8ce');
      p.set(inset, j, EDGE);
      p.set(p.w - inset - 1, j, EDGE);
    }
    p.rect(20, p.h - 8, 16, 8, '#8ac0ec');
    p.hline(0, 0, p.w, EDGE);
  },
  'space-elevator'(p) {
    p.vline(p.w / 2, 0, p.h, '#c6cede');
    p.vline(p.w / 2 - 1, 0, p.h, EDGE);
    p.wall(2, p.h - 12, 12, 12, STYLES[7]!.wall, EDGE);
    p.wall(5, 30, 6, 8, STYLES[7]!.wall, EDGE);
    p.set(8, 33, '#7af0ff');
    p.disc(p.w / 2, 3, 2, '#7af0ff');
  },
  'colony-ship'(p) {
    const st = STYLES[7]!;
    p.wall(2, p.h - 6, p.w - 4, 6, st.roof, EDGE);
    p.vline(8, 10, p.h - 16, EDGE);
    p.vline(p.w - 9, 10, p.h - 16, EDGE);
    for (let j = 0; j < 14; j++) {
      const y = 14 + j;
      const half = Math.round(Math.sqrt(1 - ((j - 7) / 8) ** 2) * 26);
      p.hline(p.w / 2 - half, y, half * 2, j % 4 === 0 ? st.wall[0] : st.wall[1]);
      p.set(p.w / 2 - half, y, EDGE);
      p.set(p.w / 2 + half - 1, y, EDGE);
    }
    for (let x = 12; x < p.w - 12; x += 4) p.set(x, 20, st.lit);
    p.rect(p.w - 8, 17, 4, 6, '#ff9a3a');
    p.wall(p.w / 2 - 4, 8, 8, 6, st.wall, EDGE);
  },
};

// --- Citizens -----------------------------------------------------------------------

/** What people wear in each era: [shirt, legs, hat or hair]. */
const CLOTHES: readonly [string, string, string][] = [
  ['#8e6a40', '#6a4a2a', '#3a2214'],
  ['#e8dcc0', '#c4925a', '#1a1a1a'],
  ['#f4f0e6', '#d6d2c6', '#5a3a1a'],
  ['#5a6a3a', '#4a3a2a', '#8a2a1a'],
  ['#8a2a3a', '#2a2a3a', '#2a2a2a'],
  ['#3a3a4a', '#2a2a30', '#1a1a1a'],
  ['#3a6ab0', '#2a2a40', '#5a3a1a'],
  ['#eef2fc', '#c6cede', '#3ac0dc'],
];
const SKINS = ['#f0c8a0', '#c89060', '#8a5a3a'];

function citizen(era: number, frame: number, skin: string): Px {
  const [shirt, legs, hat] = CLOTHES[era]!;
  const p = new Px(5, 9);
  p.rect(1, 0, 3, 1, hat);
  p.rect(1, 1, 3, 2, skin);
  p.set(3, 1, hat);
  p.rect(0, 3, 5, 3, shirt);
  p.set(0, 5, skin);
  p.set(4, 5, skin);
  if (frame === 0) {
    p.rect(1, 6, 1, 3, legs);
    p.rect(3, 6, 1, 3, legs);
  } else {
    p.rect(2, 6, 1, 3, legs);
    p.set(1, 8, legs);
    p.set(3, 7, legs);
  }
  if (era === 7) p.rect(1, 1, 3, 1, '#a8f4ff');
  return p;
}

// --- Icons --------------------------------------------------------------------------

const ICONS: Record<string, readonly string[]> = {
  food: ['...33....', '..3223...', '.322223..', '.2222221.', '.2222221.', '.1222211.', '..12211..', '...111...', '.........'],
  wood: ['.........', '.........', '.1222223.', '12322222o', '12322222o', '.1222223.', '.........', '.........', '.........'],
  stone: ['.........', '...333...', '..32222..', '.3222221.', '.2222211.', '.2221111.', '..11111..', '.........', '.........'],
  knowledge: ['.........', '.3333333.', '.3222223.', '.3211123.', '.3222223.', '.3211123.', '.3222223.', '.1111111.', '.........'],
  culture: ['....3....', '...323...', '..32223..', '.3222223.', '..12221..', '...121...', '...121...', '..11111..', '.........'],
  metal: ['.........', '.........', '..33333..', '.3222221.', '.2222211.', '.1111111.', '.........', '.........', '.........'],
  gold: ['.........', '..3333...', '.322223..', '.3211123.', '.3212123.', '.3211123.', '.122221..', '..1111...', '.........'],
  coal: ['.........', '...33....', '..3221...', '.322211..', '.2221111.', '..11111..', '.........', '.........', '.........'],
  steel: ['.........', '..3333333', '.3222221.', '3222221..', '1111111..', '.........', '.........', '.........', '.........'],
  oil: ['....3....', '...323...', '..32223..', '..32221..', '.3222211.', '.2222211.', '..12211..', '...111...', '.........'],
  data: ['.........', '.3.3.3.3.', '.........', '.2.2.2.2.', '.........', '.3.3.3.3.', '.........', '.1.1.1.1.', '.........'],
  alloy: ['....3....', '...323...', '..32223..', '.3222221.', '..12221..', '...121...', '....1....', '.........', '.........'],
};

const EXTRA_ICONS: Record<string, { rows: readonly string[]; pal: Record<string, string> }> = {
  people: {
    rows: ['...33....', '..3223...', '..3223...', '...22....', '..1111...', '.111111..', '.1.11.1..', '..1..1...', '..1..1...'],
    pal: { '1': '#5a7ab0', '2': '#e8b088', '3': '#4a2a14' },
  },
  land: {
    rows: ['.........', '.........', '....3....', '...333...', '..1...1..', '.1.....1.', '222222222', '211212112', '.........'],
    pal: { '1': '#6a4a2a', '2': '#6a8a3a', '3': '#c84a2a' },
  },
  stability: {
    rows: ['.........', '.33...33.', '3223.3223', '322232223', '.3222223.', '..32223..', '...323...', '....3....', '.........'],
    pal: { '2': '#e85a7a', '3': '#8a1a3a' },
  },
  power: {
    rows: ['.....33..', '....33...', '...33....', '..33333..', '....33...', '...33....', '..33.....', '.3.......', '.........'],
    pal: { '3': '#ffd84a' },
  },
  heritage: {
    rows: ['....3....', '...323...', '3333233333', '.3222223.', '..32223..', '.3223223.', '.323.323.', '.33...33.', '.........'].map((r) => r.slice(0, 9)),
    pal: { '2': '#a8f4ff', '3': '#3ac0dc' },
  },
  clock: {
    rows: ['..33333..', '.3222223.', '322212223', '322212223', '322211223', '322222223', '.3222223.', '..33333..', '.........'],
    pal: { '1': '#1c1418', '2': '#f4f0e6', '3': '#8a6a40' },
  },
};

/** An emblem per era for the header: a fire, an axe, a column, a castle, a quill, a gear, a bulb, a rocket. */
const ERA_ICONS: readonly { rows: readonly string[]; pal: Record<string, string> }[] = [
  { rows: ['....3.....', '...323....', '..32123...', '..32123..3', '.3211123.3', '.3211123..', '..32223...', '.44.44.44.', '..44444...', '..........'], pal: { '1': '#fff0a0', '2': '#ffb030', '3': '#e0501a', '4': '#6a4a2a' } },
  { rows: ['..........', '..3333....', '.322223...', '.32222333.', '..3333.4..', '......4...', '.....4....', '....4.....', '...4......', '..........'], pal: { '2': '#e0a050', '3': '#8a4a1a', '4': '#6a4a2a' } },
  { rows: ['3333333333', '.22222222.', '..2.22.2..', '..2.22.2..', '..2.22.2..', '..2.22.2..', '..2.22.2..', '..2.22.2..', '.22222222.', '3333333333'], pal: { '2': '#f4f0e6', '3': '#a09c90' } },
  { rows: ['3.3....3.3', '333....333', '232.33.232', '222.22.222', '2222222222', '2222222222', '2222112222', '2222112222', '2222112222', '3333333333'], pal: { '1': '#3a2a1a', '2': '#a8a49c', '3': '#5c5a56' } },
  { rows: ['........33', '.......332', '......332.', '.....332..', '....332...', '...332....', '..332.....', '.31.......', '.1........', '1.........'], pal: { '1': '#2a2430', '2': '#f4dcaa', '3': '#b4884a' } },
  { rows: ['...3333...', '.33222233.', '.32211223.', '3221..1223', '321....123', '321....123', '3221..1223', '.32211223.', '.33222233.', '...3333...'], pal: { '1': '#3a3a40', '2': '#8a8a96', '3': '#5a5a64' } },
  { rows: ['...3333...', '..322223..', '.32222223.', '.32222223.', '.32211223.', '..322223..', '...3223...', '...4444...', '...4444...', '....44....'], pal: { '1': '#ffffff', '2': '#ffe89a', '3': '#c8a030', '4': '#5a5a64' } },
  { rows: ['....33....', '...3223...', '...3223...', '...3113...', '...3223...', '..322223..', '.32222223.', '.33.44.33.', '....44....', '...4..4...'], pal: { '1': '#3ac0dc', '2': '#eef2fc', '3': '#5a6478', '4': '#ff9a3a' } },
];

// --- Scenery ------------------------------------------------------------------------

function cloud(): Px {
  return Px.from(
    [
      '......2222......',
      '....22333322....',
      '..2233333333222.',
      '.233333333333332',
      '2333333333333332',
      '.22222222222222.',
    ],
    { '2': '#d8e0ec', '3': '#ffffff' },
  );
}

function scaffold(): Px {
  const p = new Px(8, 8);
  p.hline(0, 0, 8, '#8a6a3a');
  p.hline(0, 4, 8, '#8a6a3a');
  p.vline(0, 0, 8, '#8a6a3a');
  p.vline(7, 0, 8, '#8a6a3a');
  p.line(0, 0, 7, 7, '#6a4a2a');
  return p;
}

// --- Assembly -----------------------------------------------------------------------

function toDef(name: string, p: Px): SpriteDef {
  return { name, w: p.w, h: p.h, px: p.px };
}

export function buildingSprite(line: LineId, era: number): string {
  return `bld-${line}-${era}`;
}

export function buildSprites(): SpriteDef[] {
  const out: SpriteDef[] = [];
  for (const line of LINES) {
    for (const t of line.tiers) {
      const h = HEIGHTS[line.id][t.era]!;
      const p = new Px(W, h);
      DRAW[line.id](p, STYLES[t.era]!, t.era);
      out.push(toDef(buildingSprite(line.id, t.era), p));
    }
  }
  for (const w of WONDERS) {
    const p = new Px(w.w, w.h);
    WONDER_DRAW[w.id]!(p);
    out.push(toDef(`wonder-${w.id}`, p));
  }
  for (let era = 0; era < CLOTHES.length; era++) {
    SKINS.forEach((skin, k) => {
      for (const f of [0, 1]) out.push(toDef(`citizen-${era}-${k}-${f}`, citizen(era, f, skin)));
    });
  }
  for (const r of RESOURCES) {
    const [d, m, l] = r.shades;
    out.push(toDef(`res-${r.id}`, Px.from(ICONS[r.id]!, { '1': d, '2': m, '3': l, o: EDGE })));
  }
  for (const [name, icon] of Object.entries(EXTRA_ICONS)) out.push(toDef(`icon-${name}`, Px.from(icon.rows, icon.pal)));
  ERA_ICONS.forEach((icon, i) => out.push(toDef(`era-${i}`, Px.from(icon.rows, icon.pal))));
  out.push(toDef('cloud', cloud()));
  out.push(toDef('scaffold', scaffold()));
  return out;
}
