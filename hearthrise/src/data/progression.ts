import type { Feature } from './types';

/**
 * Every number the economy hangs on, in one place, so the balance can be
 * tuned without hunting. `tests/bot.test.ts` plays the game against these and
 * fails if the early curve stops being reachable.
 */
export const BALANCE = {
  /** Ruins to clear in a ward before its landmark stands exposed. */
  ruinsPerWard: 20,
  /** Hit points of the first ruin; multiplied by `hpGrowth` per ward. */
  baseHp: 10,
  hpGrowth: 2.25,
  landmarkHpMult: 6,
  /**
   * Ruins get this much tougher at the start of each new district. Salvage
   * values jump by about the same, so arriving somewhere new does not make
   * the next few wards free.
   */
  districtHpJump: 15,
  /** Salvage per ruin grows by this factor per ward. */
  yieldGrowth: 1.1,
  /** Base relic chance per ruin, before luck. */
  relicChance: 0.02,
  /** XP for clearing a ruin in ward 1; multiplied by `xpGrowth` per ward. */
  baseXp: 2,
  xpGrowth: 1.26,
  /** XP for each level is `levelXp * levelGrowth ^ (level - 1)`. */
  levelXp: 20,
  levelGrowth: 1.25,
  statPointsPerLevel: 3,
  /** One passive point every this many levels. */
  passiveEvery: 3,
  baseResolve: 50,
  resolveRegen: 1.5,
  baseCrit: 5,
  baseCritMult: 2.5,
  /** Crews earn this share of the XP a tap would. */
  crewXpShare: 0.5,
  offlineHours: 8,
  /** Output multiplier when a hazard is not countered. */
  hazardPenalty: 0.4,
  /** Lantern light needed to see through the Spire's fog. */
  fogLight: 3,
  /** Each point of adjacency adds this much to a building's output. */
  adjacencyStep: 0.1,
  /** A building never drops below this share of its output, however bad its neighbours. */
  adjacencyFloor: 0.25,
  /** The tide in the Harbour: a cycle this long, flooded for the first part of it. */
  tideCycle: 90,
  tideHigh: 30,
} as const;

export interface UpgradeDef {
  id: string;
  name: string;
  text: string;
  baseCost: number;
  growth: number;
  requires?: Feature;
}

/** Bought with coin, unlimited levels. */
export const UPGRADES: readonly UpgradeDef[] = [
  { id: 'tools', name: 'Better Tools', text: '+1 base tap power, and ×2 every 10 levels.', baseCost: 8, growth: 1.16 },
  { id: 'barrows', name: 'Barrows', text: '+10% salvage from every ruin.', baseCost: 40, growth: 1.17 },
  { id: 'ledgers', name: 'Ledgers', text: '+8% coin from sales and taxes.', baseCost: 120, growth: 1.19 },
  { id: 'kilns', name: 'Hotter Kilns', text: '+25% workshop speed.', baseCost: 400, growth: 1.25, requires: 'workshops' },
  { id: 'hands', name: 'Steady Hands', text: '+1% crit chance.', baseCost: 600, growth: 1.3, requires: 'founder' },
  { id: 'foremen', name: 'Foremen', text: 'All crews ×1.25.', baseCost: 2000, growth: 1.6, requires: 'crews' },
];

export type EdictId = 'rush' | 'survey' | 'festival';

export interface EdictDef {
  id: EdictId;
  name: string;
  text: string;
  resolve: number;
  cooldown: number;
  /** Seconds the effect lasts, for the ones that last. */
  duration: number;
}

export const EDICTS: readonly EdictDef[] = [
  { id: 'rush', name: 'Work Rush', text: 'Everyone pitches in: one blow for 30× tap power.', resolve: 20, cooldown: 6, duration: 0 },
  { id: 'survey', name: 'Survey', text: 'For 20s: salvage ×2 and +30 luck.', resolve: 35, cooldown: 60, duration: 20 },
  { id: 'festival', name: 'Festival', text: 'For 15s the whole city turns out: taxes and crews ×3, and you swing 8 times a second.', resolve: 45, cooldown: 90, duration: 15 },
];

export interface PassiveDef {
  id: string;
  name: string;
  text: string;
  branch: 'builder' | 'planner' | 'steward';
  max: number;
}

/** Three branches; a node needs the one above it in its branch. */
export const PASSIVES: readonly PassiveDef[] = [
  { id: 'brawn', name: 'Strong Back', text: '+15% tap power per rank.', branch: 'builder', max: 5 },
  { id: 'eye', name: 'Mason’s Eye', text: '+2% crit chance per rank.', branch: 'builder', max: 5 },
  { id: 'wrecker', name: 'Wrecker', text: '+30% crit power per rank.', branch: 'builder', max: 5 },
  { id: 'landmarks', name: 'Landmark Breaker', text: '+25% power against landmarks per rank.', branch: 'builder', max: 5 },
  { id: 'gaffer', name: 'Gaffer', text: '+15% crew output per rank.', branch: 'planner', max: 5 },
  { id: 'kilnwise', name: 'Kilnwise', text: '+20% workshop speed per rank.', branch: 'planner', max: 5 },
  { id: 'nightwatch', name: 'Night Watch', text: '+1h away time and +10% away yield per rank.', branch: 'planner', max: 5 },
  { id: 'architect', name: 'Architect', text: '−6% on every building’s price per rank.', branch: 'planner', max: 5 },
  { id: 'lucky', name: 'Lucky Find', text: '+4 luck per rank.', branch: 'steward', max: 5 },
  { id: 'broker', name: 'Broker', text: '+10% sales and taxes per rank.', branch: 'steward', max: 5 },
  { id: 'scavenger', name: 'Scavenger', text: '+10% salvage per rank.', branch: 'steward', max: 5 },
  { id: 'scholar', name: 'Chronicler', text: '+12% XP per rank.', branch: 'steward', max: 5 },
];

export interface CharterDef {
  id: string;
  name: string;
  text: string;
  baseCost: number;
  growth: number;
  max: number;
}

/** The permanent tree, paid for in Memories from the Tide. */
export const CHARTER: readonly CharterDef[] = [
  { id: 'hands', name: 'Remembered Hands', text: 'Tap power ×2 per rank.', baseCost: 2, growth: 1.68, max: 40 },
  { id: 'crews', name: 'Old Crews', text: 'Crew output ×2 per rank.', baseCost: 2, growth: 1.68, max: 40 },
  { id: 'tithe', name: 'Old Tithe', text: 'Sales and taxes ×1.5 per rank.', baseCost: 3, growth: 1.68, max: 40 },
  { id: 'maps', name: 'Old Maps', text: 'Each Tide leaves 2 more wards standing per rank.', baseCost: 5, growth: 1.8, max: 16 },
  { id: 'purse', name: 'Sunken Purse', text: 'Start after each Tide with coin: 500 × 5^rank.', baseCost: 3, growth: 1.6, max: 15 },
  { id: 'lore', name: 'Lore', text: '+30% XP per rank.', baseCost: 2, growth: 1.6, max: 20 },
  { id: 'omens', name: 'Omens', text: '+6 luck per rank.', baseCost: 3, growth: 1.6, max: 20 },
  { id: 'trades', name: 'Old Trades', text: '+30% workshop speed per rank.', baseCost: 2, growth: 1.6, max: 20 },
  { id: 'patience', name: 'Patience', text: '+2h away time per rank.', baseCost: 4, growth: 1.8, max: 8 },
  { id: 'hum', name: 'The Hum', text: 'Every unspent Memory adds +2% to everything the city makes.', baseCost: 6, growth: 1, max: 1 },
];

/** A run has to open more than this many wards before the Tide pays anything. */
export const TIDE_FLOOR = 8;
