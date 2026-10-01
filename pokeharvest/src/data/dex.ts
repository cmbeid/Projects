/** Rewards for filling in the Pokédex: claim one each time you've befriended this many kinds. */
export interface DexReward {
  caught: number;
  gold?: number;
  items?: Record<string, number>;
}

export const DEX_REWARDS: readonly DexReward[] = [
  { caught: 5, items: { 'great-ball': 5 } },
  { caught: 10, items: { 'rare-candy': 2 } },
  { caught: 15, items: { 'metal-coat': 3, nugget: 1 } },
  { caught: 20, gold: 5000 },
  { caught: 30, items: { 'rare-candy': 5, nugget: 2 } },
  { caught: 40, gold: 20000 },
  { caught: 50, items: { 'rare-candy': 10, nugget: 5 } },
];
