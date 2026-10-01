/**
 * People: a 16 × 16 sprite in four directions with a two-frame walk, drawn
 * in code from a palette. The farmer is one palette; trainers and townsfolk
 * are others (see `data/people.ts`).
 */
import type { Palette } from '../data/people';
import type { Dir } from '../game/model';
import { T } from './tiles';

const FARMER: Palette = { hat: '#d03a2a', hair: '#4a2f1f', skin: '#f2c79a', shirt: '#3a78d0', pants: '#34405a' };
const BOOT = '#3a2414';

/** A darker shade of a colour, for the cap's brim. */
function shade(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number): string => Math.floor(v * 0.75).toString(16).padStart(2, '0');
  return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`;
}

type Ctx = CanvasRenderingContext2D;

function px(g: Ctx, color: string, x: number, y: number, w = 1, h = 1): void {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
}

function paint(g: Ctx, dir: Dir, frame: number, pal: Palette): void {
  const { hat: HAT, hair: HAIR, skin: SKIN, shirt: SHIRT, pants: PANTS } = pal;
  const BRIM = shade(HAT);
  const side = dir === 'left' || dir === 'right';
  // Legs, alternating while walking.
  const lift = frame === 1 ? 1 : 0;
  if (side) {
    px(g, PANTS, 6, 11, 4, 3 - lift);
    px(g, BOOT, frame ? 5 : 7, 14 - lift, 3, 2);
  } else {
    px(g, PANTS, 5, 11, 2, 3 - lift);
    px(g, PANTS, 9, 11, 2, 3);
    px(g, BOOT, 5, 14 - lift, 2, 2);
    px(g, BOOT, 9, 14, 2, 2);
  }
  // Body and arms.
  px(g, SHIRT, 4, 7, 8, 5);
  if (!side) {
    px(g, SKIN, 3, 8 + (frame ? 1 : 0), 1, 3);
    px(g, SKIN, 12, 8 + (frame ? 0 : 1), 1, 3);
  } else {
    px(g, SKIN, 7, 8 + frame, 2, 3);
  }
  // Head.
  px(g, SKIN, 5, 2, 6, 5);
  px(g, HAIR, 4, 3, 8, 2);
  if (dir === 'down') {
    px(g, SKIN, 5, 4, 6, 3);
    px(g, '#222', 6, 5);
    px(g, '#222', 9, 5);
  } else if (dir === 'up') {
    px(g, HAIR, 5, 4, 6, 3);
  } else {
    px(g, SKIN, 5, 4, 6, 3);
    px(g, HAIR, 5, 3, 3, 3);
    px(g, '#222', 9, 5);
  }
  // Cap, brim toward the way they face.
  px(g, HAT, 4, 0, 8, 3);
  px(g, '#f4f4f8', 7, 1, 2, 1);
  if (dir === 'down') px(g, BRIM, 4, 3, 8, 1);
  if (dir === 'right') px(g, BRIM, 10, 3, 4, 1);
  if (dir === 'up') px(g, BRIM, 5, 3, 6, 1);
}

const frames = new Map<string, HTMLCanvasElement>();

export function farmerImage(dir: Dir, frame: number): HTMLCanvasElement {
  return personImage(FARMER, dir, frame);
}

export function personImage(pal: Palette, dir: Dir, frame: number): HTMLCanvasElement {
  // Left is right, mirrored.
  const key = `${pal.hat}${pal.shirt}${pal.hair}${dir}${frame}`;
  let c = frames.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = T;
    c.height = T;
    const g = c.getContext('2d')!;
    if (dir === 'left') {
      g.translate(T, 0);
      g.scale(-1, 1);
      paint(g, 'right', frame, pal);
    } else {
      paint(g, dir, frame, pal);
    }
    frames.set(key, c);
  }
  return c;
}
