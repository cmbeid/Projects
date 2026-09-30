/**
 * Where the view looks. The tile scale is a whole number, so pixels stay
 * crisp: as big as it can be while at least MIN_COLS tiles fit across and
 * MIN_ROWS down. A phone upright shows about a dozen tiles across and follows
 * the farmer; a wide monitor shows most of the farm at once.
 */
import { T } from './tiles';

export const MIN_COLS = 11;
export const MIN_ROWS = 14;

export interface View {
  /** Canvas size in device pixels. */
  width: number;
  height: number;
  /** Device pixels per tile. */
  tile: number;
  /** Top-left of the view, in device pixels from the map's origin (negative when the map is smaller than the view). */
  ox: number;
  oy: number;
}

export function tileSize(width: number, height: number): number {
  const scale = Math.max(1, Math.floor(Math.min(width / (T * MIN_COLS), height / (T * MIN_ROWS))));
  return scale * T;
}

/**
 * Centre on (cx, cy) in tiles, clamped so the view never leaves a `cols` ×
 * `rows` map; centred when the map is smaller. `padTop` and `padBottom`
 * (device pixels) are covered by the HUD and hotbar, so the view may scroll
 * that far past the map's edges to keep its first and last rows in the open.
 */
export function follow(width: number, height: number, cx: number, cy: number, cols: number, rows: number, padTop = 0, padBottom = 0): View {
  const tile = tileSize(width, height);
  const mapW = cols * tile;
  const mapH = rows * tile;
  const axis = (view: number, map: number, centre: number, lo: number, hi: number): number => {
    const open = view - lo - hi;
    if (map <= open) return -Math.floor(lo + (open - map) / 2);
    const want = centre * tile + tile / 2 - (lo + open / 2);
    return Math.round(Math.max(-lo, Math.min(map - view + hi, want)));
  };
  return { width, height, tile, ox: axis(width, mapW, cx, 0, 0), oy: axis(height, mapH, cy, padTop, padBottom) };
}

/** The tile under a canvas point (device pixels). */
export function tileAtPoint(view: View, x: number, y: number): { x: number; y: number } {
  return { x: Math.floor((x + view.ox) / view.tile), y: Math.floor((y + view.oy) / view.tile) };
}
