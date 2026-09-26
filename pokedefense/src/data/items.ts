/**
 * Everything bought in the Poké Mart: power-ups used in battle, Poké Balls,
 * held items equipped on a tower line, and permanent Trainer upgrades. Icons
 * are PokeAPI item sprites, fetched into `public/items/`.
 */
import type { Effects } from './towers';
import type { PokeType } from './types';

export const POWERUP_KEYS = [
  'rare-candy', 'x-attack', 'x-speed', 'max-repel', 'poke-flute',
  'full-restore', 'tm-electric', 'tm-ground', 'silph-scope', 'amulet-coin',
] as const;
export type PowerupKey = (typeof POWERUP_KEYS)[number];

export interface Powerup {
  key: PowerupKey;
  name: string;
  desc: string;
  /** Needs a tap on the map after choosing it: a tower, or a spot. */
  target: 'none' | 'tower' | 'spot';
  /** Seconds before another of the same can be used. */
  cooldown: number;
  /** Seconds the effect lasts, for timed ones. */
  duration: number;
  price: number;
}

export const POWERUPS: Record<PowerupKey, Powerup> = {
  'rare-candy': { key: 'rare-candy', name: 'Rare Candy', desc: 'A free level for one tower — evolving it if it is ready.', target: 'tower', cooldown: 2, duration: 0, price: 150 },
  'x-attack': { key: 'x-attack', name: 'X Attack', desc: 'Every tower deals 50% more damage for 15 s.', target: 'none', cooldown: 30, duration: 15, price: 80 },
  'x-speed': { key: 'x-speed', name: 'X Speed', desc: 'Every tower attacks 50% faster for 15 s.', target: 'none', cooldown: 30, duration: 15, price: 80 },
  'max-repel': { key: 'max-repel', name: 'Max Repel', desc: 'Every enemy moves at half speed for 8 s.', target: 'none', cooldown: 30, duration: 8, price: 90 },
  'poke-flute': { key: 'poke-flute', name: 'Poké Flute', desc: 'Every enemy but a boss falls asleep for 4 s.', target: 'none', cooldown: 40, duration: 4, price: 120 },
  'full-restore': { key: 'full-restore', name: 'Full Restore', desc: 'Restores 5 lives.', target: 'none', cooldown: 10, duration: 0, price: 150 },
  'tm-electric': { key: 'tm-electric', name: 'TM Thunderbolt', desc: 'Tap a spot: a huge Electric strike on everything near it.', target: 'spot', cooldown: 12, duration: 0, price: 100 },
  'tm-ground': { key: 'tm-ground', name: 'TM Earthquake', desc: 'Heavy Ground damage to every enemy not flying.', target: 'none', cooldown: 25, duration: 0, price: 130 },
  'silph-scope': { key: 'silph-scope', name: 'Silph Scope', desc: 'Reveals every invisible Pokémon for 20 s.', target: 'none', cooldown: 25, duration: 20, price: 70 },
  'amulet-coin': { key: 'amulet-coin', name: 'Amulet Coin', desc: 'Double ₽ from every knockout for 30 s.', target: 'none', cooldown: 45, duration: 30, price: 100 },
};

export const BALL_KEYS = ['poke-ball', 'great-ball', 'ultra-ball', 'master-ball'] as const;
export type BallKey = (typeof BALL_KEYS)[number];

export const BALLS: Record<BallKey, { name: string; bonus: number; price: number }> = {
  'poke-ball': { name: 'Poké Ball', bonus: 1, price: 20 },
  'great-ball': { name: 'Great Ball', bonus: 1.5, price: 50 },
  'ultra-ball': { name: 'Ultra Ball', bonus: 2, price: 100 },
  'master-ball': { name: 'Master Ball', bonus: Infinity, price: 2000 },
};

export interface HeldItem {
  key: string;
  name: string;
  desc: string;
  /** Damage bonus for attacks of this type. */
  boostType?: PokeType;
  damage?: number;
  rate?: number;
  range?: number;
  effects?: Partial<Effects>;
  /** Extra ₽ per knockout, as a fraction. */
  bounty?: number;
  price: number;
}

const typeItem = (key: string, name: string, type: PokeType): HeldItem => ({
  key, name, desc: `${type[0]!.toUpperCase()}${type.slice(1)}-type attacks deal 25% more.`, boostType: type, damage: 0.25, price: 300,
});

export const HELD_ITEMS: readonly HeldItem[] = [
  typeItem('charcoal', 'Charcoal', 'fire'),
  typeItem('mystic-water', 'Mystic Water', 'water'),
  typeItem('miracle-seed', 'Miracle Seed', 'grass'),
  typeItem('magnet', 'Magnet', 'electric'),
  typeItem('sharp-beak', 'Sharp Beak', 'flying'),
  typeItem('soft-sand', 'Soft Sand', 'ground'),
  typeItem('hard-stone', 'Hard Stone', 'rock'),
  typeItem('twisted-spoon', 'Twisted Spoon', 'psychic'),
  typeItem('black-belt', 'Black Belt', 'fighting'),
  typeItem('spell-tag', 'Spell Tag', 'ghost'),
  typeItem('silk-scarf', 'Silk Scarf', 'normal'),
  typeItem('never-melt-ice', 'Never-Melt Ice', 'ice'),
  typeItem('dragon-fang', 'Dragon Fang', 'dragon'),
  typeItem('poison-barb', 'Poison Barb', 'poison'),
  { key: 'scope-lens', name: 'Scope Lens', desc: '+15% chance of a critical hit.', effects: { crit: 0.15 }, price: 450 },
  { key: 'quick-claw', name: 'Quick Claw', desc: 'Attacks 20% faster.', rate: 0.2, price: 500 },
  { key: 'wide-lens', name: 'Wide Lens', desc: '+0.5 tiles of range.', range: 0.5, price: 450 },
  { key: 'kings-rock', name: "King's Rock", desc: '15% chance to make the target flinch.', effects: { flinch: 0.15 }, price: 400 },
  { key: 'amulet-coin', name: 'Amulet Coin', desc: 'Its knockouts pay 50% more ₽.', bounty: 0.5, price: 400 },
];

export const HELD_BY_KEY: ReadonlyMap<string, HeldItem> = new Map(HELD_ITEMS.map((i) => [i.key, i]));

export const TRAINER_KEYS = ['wallet', 'lives', 'discount', 'interest', 'refund', 'catching', 'pouch'] as const;
export type TrainerKey = (typeof TRAINER_KEYS)[number];

export interface TrainerUpgrade {
  name: string;
  desc: (tier: number) => string;
  /** Price of each tier, in order. */
  prices: readonly number[];
}

export const TRAINER: Record<TrainerKey, TrainerUpgrade> = {
  wallet: { name: 'Big Wallet', desc: (t) => `Start every battle with ${t * 10}% more ₽.`, prices: [150, 300, 500, 800, 1200] },
  lives: { name: 'Potion Belt', desc: (t) => `${t * 2} extra lives every battle.`, prices: [200, 450, 900] },
  discount: { name: 'Pokémon Fan Club', desc: (t) => `Towers and level-ups cost ${t * 4}% less.`, prices: [250, 500, 800, 1200, 1800] },
  interest: { name: 'Bank Account', desc: (t) => `Earn ${t * 2}% interest on your ₽ after each wave (up to ${t * 40} ₽).`, prices: [300, 700, 1300] },
  refund: { name: 'Bargain Hunter', desc: (t) => `Selling refunds ${70 + t * 10}% instead of 70%.`, prices: [200, 600] },
  catching: { name: 'Catching Charm', desc: (t) => `Catch rate +${t * 15}%.`, prices: [250, 600, 1200] },
  pouch: { name: 'Ball Pouch', desc: (t) => `${t} free Poké Ball${t === 1 ? '' : 's'} every battle.`, prices: [150, 400, 800] },
};

export type TrainerLevels = Record<TrainerKey, number>;
export const NO_TRAINER: TrainerLevels = { wallet: 0, lives: 0, discount: 0, interest: 0, refund: 0, catching: 0, pouch: 0 };

/** Items that drop from knocked-out enemies: tap them before they fade. Weights. */
export const DROPS: readonly [key: PowerupKey | BallKey, weight: number][] = [
  ['poke-ball', 40], ['great-ball', 12], ['rare-candy', 14], ['x-attack', 10], ['x-speed', 10],
  ['max-repel', 6], ['amulet-coin', 4], ['tm-electric', 4],
];
/** Chance that any one knockout drops something. */
export const DROP_CHANCE = 0.025;

export const ITEM_ICONS: readonly string[] = [
  ...POWERUP_KEYS, ...BALL_KEYS, ...HELD_ITEMS.map((i) => i.key),
  'water-stone', 'thunder-stone', 'fire-stone', 'exp-share', 'lucky-egg',
].filter((k, i, all) => all.indexOf(k) === i);

export function itemIconUrl(key: string): string {
  return `items/${key}.png`;
}
