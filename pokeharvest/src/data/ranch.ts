/**
 * The barn and the town: what livestock make, how big the barn can grow,
 * what the ranch sells, and how reputation is earned and spent.
 */

/** What each Pokémon makes when it lives on the farm and is fed. */
export const PRODUCTS: Record<number, string> = {
  241: 'moomoo-milk',
  179: 'wool', 180: 'wool', 181: 'wool',
  831: 'wool', 832: 'wool',
  415: 'honey',
  113: 'lucky-egg',
  79: 'slowpoke-tail', 80: 'slowpoke-tail',
};

export interface BarnLevel {
  name: string;
  /** Pokémon that can live on the farm. */
  capacity: number;
  /** Cost to build this level from the one before. */
  cost: { gold: number; items: Record<string, number>; reputation: number } | null;
}

export const BARN_LEVELS: readonly BarnLevel[] = [
  { name: 'Shed', capacity: 3, cost: null },
  { name: 'Barn', capacity: 6, cost: { gold: 2000, items: { 'hard-stone': 10 }, reputation: 2 } },
  { name: 'Big Barn', capacity: 10, cost: { gold: 6000, items: { 'hard-stone': 10, 'metal-coat': 5 }, reputation: 3 } },
  { name: 'Deluxe Barn', capacity: 15, cost: { gold: 15000, items: { 'metal-coat': 10, nugget: 3 }, reputation: 4 } },
];

/** Pokémon the ranch counter sells, once your reputation is good enough. They arrive at level 5. */
export const RANCH_STOCK: readonly { dex: number; price: number; reputation: number }[] = [
  { dex: 831, price: 800, reputation: 1 },
  { dex: 415, price: 900, reputation: 2 },
  { dex: 241, price: 1500, reputation: 2 },
  { dex: 79, price: 1800, reputation: 3 },
  { dex: 113, price: 4000, reputation: 4 },
];

/** Reputation points needed for each level, from level 1. */
export const REPUTATION = [0, 0, 5, 15, 30, 50] as const;
export const REPUTATION_NAMES = ['', 'Newcomer', 'Neighbour', 'Trusted', 'Renowned', 'Legend'] as const;

export function reputationLevel(points: number): number {
  let level = 1;
  while (level < 5 && points >= REPUTATION[level + 1]!) level += 1;
  return level;
}

/** Friendship gained when a farm Pokémon is fed, lost when it isn't, and from a pat. */
export const FRIENDSHIP = { fed: 5, hungry: -10, pet: 3, max: 255, start: 70 } as const;

/** The travelling merchant's possible wares (prices for one), from which each weekend's stock is drawn. */
export const MERCHANT_POOL: readonly { id: string; price: number; count: number }[] = [
  { id: 'rare-candy', price: 800, count: 3 },
  { id: 'metal-coat', price: 350, count: 5 },
  { id: 'nugget', price: 1100, count: 2 },
  { id: 'hard-stone', price: 120, count: 10 },
  { id: 'sitrus-seed', price: 60, count: 10 },
  { id: 'leppa-seed', price: 38, count: 10 },
  { id: 'great-ball', price: 220, count: 5 },
  { id: 'lucky-egg', price: 450, count: 2 },
  { id: 'honey', price: 140, count: 4 },
];
