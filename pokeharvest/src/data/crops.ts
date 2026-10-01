/**
 * What grows on the farm, and when. Growth counts nights spent watered. Out
 * of season a crop won't take outdoors, and one still in the ground when its
 * season ends withers; the greenhouse grows anything, any time.
 */
import type { Season } from '../game/time';

export interface Crop {
  id: string;
  name: string;
  /** Watered nights from seed to ripe. */
  days: number;
  /** After a harvest, ripe again this many watered nights later; otherwise the plant is used up. */
  regrow?: number;
  seedPrice: number;
  sellPrice: number;
  seasons: readonly Season[];
  /** PokeAPI item icon of the ripe berry. */
  icon: string;
  /** Leaf and berry colours for the growing plant. */
  leaf: string;
  fruit: string;
}

function c(id: string, name: string, days: number, seedPrice: number, sellPrice: number, seasons: Season[], leaf: string, fruit: string, regrow?: number): Crop {
  return { id, name: `${name} Berry`, days, seedPrice, sellPrice, seasons, icon: `${id}-berry`, leaf, fruit, ...(regrow ? { regrow } : {}) };
}

export const CROPS: readonly Crop[] = [
  c('cheri', 'Cheri', 3, 15, 32, ['Spring'], '#4d9a3a', '#e0402c'),
  c('oran', 'Oran', 4, 20, 45, ['Spring', 'Summer'], '#3f8f4a', '#3c6fd8'),
  c('pecha', 'Pecha', 6, 30, 80, ['Spring'], '#5aa044', '#f28bb5'),
  c('leppa', 'Leppa', 8, 50, 110, ['Spring', 'Summer'], '#3b8a3b', '#e8672c', 3),
  c('rawst', 'Rawst', 5, 35, 75, ['Summer'], '#4a9a40', '#3fb8a8'),
  c('razz', 'Razz', 4, 40, 55, ['Summer'], '#3f8f4a', '#d8303c', 3),
  c('wiki', 'Wiki', 7, 60, 130, ['Summer'], '#4f9440', '#a060d0'),
  c('sitrus', 'Sitrus', 10, 80, 200, ['Summer', 'Autumn'], '#4f9440', '#f2d23c'),
  c('persim', 'Persim', 5, 35, 80, ['Autumn'], '#5a9038', '#f08a50'),
  c('nanab', 'Nanab', 4, 45, 50, ['Autumn'], '#4a8a3a', '#f0d070', 2),
  c('bluk', 'Bluk', 6, 50, 110, ['Autumn'], '#3f8040', '#6040c0'),
  c('lum', 'Lum', 12, 120, 330, ['Autumn'], '#3a7a3a', '#7cc85a'),
  c('aspear', 'Aspear', 5, 45, 95, ['Winter'], '#5a8a6a', '#f2e050'),
  c('chesto', 'Chesto', 7, 60, 140, ['Winter'], '#4a7a6a', '#6050c8'),
];

const BY_ID = new Map(CROPS.map((cr) => [cr.id, cr]));

export function crop(id: string): Crop {
  const cr = BY_ID.get(id);
  if (!cr) throw new Error(`unknown crop ${id}`);
  return cr;
}

export function isCrop(id: string): boolean {
  return BY_ID.has(id);
}

export function inSeason(id: string, season: Season): boolean {
  return crop(id).seasons.includes(season);
}
