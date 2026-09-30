/**
 * Where the view looks. The tile scale is a whole number, so pixels stay
 * crisp: as big as it can be while at least MIN_COLS tiles fit across and
 * MIN_ROWS down. A phone upright shows about a dozen tiles across and follows
 * the farmer; a wide monitor shows most of the farm at once.
 */
import { MAP_H, MAP_W } from '../data/maps';
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

/** Centre on (cx, cy) in tiles, clamped so the view never leaves the map; centred when the map is smaller. */
export function follow(width: number, height: number, cx: number, cy: number): View {
  const tile = tileSize(width, height);
  const mapW = MAP_W * tile;
  const mapH = MAP_H * tile;
  const axis = (view: number, map: number, centre: number): number =>
    map <= view ? -Math.floor((view - map) / 2) : Math.round(Math.max(0, Math.min(map - view, centre * tile + tile / 2 - view / 2)));
  return { width, height, tile, ox: axis(width, mapW, cx), oy: axis(height, mapH, cy) };
}

/** The tile under a canvas point (device pixels). */
export function tileAtPoint(view: View, x: number, y: number): { x: number; y: number } {
  return { x: Math.floor((x + view.ox) / view.tile), y: Math.floor((y + view.oy) / view.tile) };
}
