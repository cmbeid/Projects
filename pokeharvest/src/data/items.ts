/**
 * Everything that can sit in the bag. Tools are always owned and never
 * counted. Berries, balls and materials use PokeAPI's icons; tools and seed
 * packets are drawn (see `ui/icons.ts`).
 */
import { CROPS } from './crops';

export type ItemKind = 'tool' | 'seed' | 'crop' | 'ball' | 'material';
export type Tool = 'hoe' | 'can' | 'sickle';

export interface Item {
  id: string;
  name: string;
  kind: ItemKind;
  /** What the shipping bin pays. 0 for things that can't be sold. */
  sellPrice: number;
  /** What a shop charges, when one stocks it. */
  buyPrice?: number;
  /** For seeds and crops, the crop they belong to. */
  crop?: string;
  /** PokeAPI icon name, when there is one. */
  icon?: string;
  /** Berries: HP restored in battle (as a share of max HP when below 1). */
  heals?: number;
  /** Balls: how much they multiply the catch rate. */
  ball?: number;
  description?: string;
}

export const TOOLS: readonly Tool[] = ['hoe', 'can', 'sickle'];

const HEALS: Record<string, number> = { oran: 20, sitrus: 0.3 };

const OTHER: Item[] = [
  { id: 'hoe', name: 'Hoe', kind: 'tool', sellPrice: 0 },
  { id: 'can', name: 'Watering Can', kind: 'tool', sellPrice: 0 },
  { id: 'sickle', name: 'Sickle', kind: 'tool', sellPrice: 0 },
  { id: 'poke-ball', name: 'Poké Ball', kind: 'ball', sellPrice: 50, buyPrice: 100, icon: 'poke-ball', ball: 1, description: 'Throw it at a weakened wild Pokémon to befriend it.' },
  { id: 'great-ball', name: 'Great Ball', kind: 'ball', sellPrice: 150, buyPrice: 300, icon: 'great-ball', ball: 1.5, description: 'A better ball: half again as likely to work.' },
  { id: 'hard-stone', name: 'Hard Stone', kind: 'material', sellPrice: 40, icon: 'hard-stone', description: 'Wild Pokémon drop it. The blacksmith makes copper tools from it.' },
  { id: 'metal-coat', name: 'Metal Coat', kind: 'material', sellPrice: 120, icon: 'metal-coat', description: 'An uncommon drop. The blacksmith makes steel tools from it.' },
  { id: 'nugget', name: 'Nugget', kind: 'material', sellPrice: 300, icon: 'nugget', description: 'A rare drop. The blacksmith makes gold tools from it.' },
];

export const ITEMS: ReadonlyMap<string, Item> = new Map(
  [
    ...OTHER,
    ...CROPS.map((c): Item => ({ id: seedId(c.id), name: `${c.name.replace(' Berry', '')} Seeds`, kind: 'seed', sellPrice: Math.floor(c.seedPrice / 2), buyPrice: c.seedPrice, crop: c.id, icon: c.icon })),
    ...CROPS.map((c): Item => ({ id: c.id, name: c.name, kind: 'crop', sellPrice: c.sellPrice, crop: c.id, icon: c.icon, ...(HEALS[c.id] ? { heals: HEALS[c.id] } : {}) })),
  ].map((i) => [i.id, i]),
);

export function seedId(cropId: string): string {
  return `${cropId}-seed`;
}

export function item(id: string): Item {
  const i = ITEMS.get(id);
  if (!i) throw new Error(`unknown item ${id}`);
  return i;
}

/** Every PokeAPI item icon the game draws. */
export const ITEM_ICONS: readonly string[] = [...new Set([...ITEMS.values()].flatMap((i) => (i.icon ? [i.icon] : [])))];

export function itemIconUrl(icon: string): string {
  return `items/${icon}.png`;
}

/** What the Poké Mart stocks, in shelf order. */
export const MART_STOCK: readonly string[] = [...CROPS.map((c) => seedId(c.id)), 'poke-ball', 'great-ball'];

/** The Mart buys things on the spot, but for less than the shipping bin pays overnight. */
export const MART_SELL_RATE = 0.6;
