import type { Feature } from './types';

/**
 * Every number the economy hangs on, in one place, so the balance can be
 * tuned without hunting. `tests/bot.test.ts` plays the game against these and
 * fails if the early curve stops being reachable.
 */
export const BALANCE = {
  /** Normal blocks to break at a depth before its seam is exposed. */
  blocksPerDepth: 10,
  /** Hit points of the first block; multiplied by `hpGrowth` per depth. */
  baseHp: 10,
  hpGrowth: 1.18,
  seamHpMult: 6,
  /**
   * Rock hit points jump by this factor at the top of each new biome. Ore
   * values jump by about the same, so arriving somewhere new does not make
   * the next twenty depths free.
   */
  biomeHpJump: 15,
  /** Ore per block grows by this factor per depth. */
  yieldGrowth: 1.04,
  /** Base gem chance per break, before luck. */
  gemChance: 0.02,
  /** XP for breaking a block at depth 1; multiplied by `xpGrowth` per depth. */
  baseXp: 2,
  xpGrowth: 1.1,
  /** XP for each level is `levelXp * levelGrowth ^ (level - 1)`. */
  levelXp: 20,
  levelGrowth: 1.25,
  statPointsPerLevel: 3,
  /** One passive skill point every this many levels. */
  passiveEvery: 3,
  baseStamina: 50,
  staminaRegen: 1.5,
  baseCrit: 5,
  baseCritMult: 2.5,
  /** Machines earn this share of the XP a tap would. */
  autoXpShare: 0.5,
  offlineHours: 8,
  /** Damage multiplier when a hazard is not countered. */
  hazardPenalty: 0.4,
  /** Lantern light needed to see properly in The Hollow. */
  darkLight: 3,
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
  { id: 'sharpen', name: 'Sharpened Pick', text: '+1 base tap damage, and ×2 every 10 levels.', baseCost: 8, growth: 1.16 },
  { id: 'cart', name: 'Bigger Cart', text: '+10% ore from every block.', baseCost: 40, growth: 1.17 },
  { id: 'haggle', name: 'Haggling', text: '+8% coin for everything you sell.', baseCost: 120, growth: 1.19 },
  { id: 'bellows', name: 'Bellows', text: '+25% refinery speed.', baseCost: 400, growth: 1.25, requires: 'refinery' },
  { id: 'grip', name: 'Steady Grip', text: '+1% crit chance.', baseCost: 600, growth: 1.3, requires: 'miner' },
  { id: 'tuning', name: 'Machine Tuning', text: 'All machines ×1.25.', baseCost: 2000, growth: 1.6, requires: 'drones' },
];

export interface MachineDef {
  id: 'drone' | 'rig' | 'excavator';
  name: string;
  text: string;
  /** Damage per second, per unit. */
  dps: number;
  baseCost: number;
  growth: number;
  requires: Feature;
}

/** Bought with coin; they hit whatever block is in front of you. */
export const MACHINES: readonly MachineDef[] = [
  { id: 'drone', name: 'Mining Drone', text: 'A little rotor with a little drill.', dps: 0.6, baseCost: 25, growth: 1.13, requires: 'drones' },
  { id: 'rig', name: 'Drill Rig', text: 'Steam and a long bit.', dps: 14, baseCost: 2500, growth: 1.14, requires: 'rig' },
  { id: 'excavator', name: 'Excavator', text: 'Treads, a bucket, and no patience.', dps: 450, baseCost: 600_000, growth: 1.15, requires: 'excavator' },
];

export type SkillId = 'power' | 'dowse' | 'frenzy';

export interface SkillDef {
  id: SkillId;
  name: string;
  text: string;
  stamina: number;
  cooldown: number;
  /** Seconds the effect lasts, for the ones that last. */
  duration: number;
}

export const SKILLS: readonly SkillDef[] = [
  { id: 'power', name: 'Power Strike', text: 'One blow for 30× tap damage.', stamina: 20, cooldown: 6, duration: 0 },
  { id: 'dowse', name: 'Dowse', text: 'For 20s: ore ×2 and +30 luck.', stamina: 35, cooldown: 60, duration: 20 },
  { id: 'frenzy', name: 'Frenzy', text: 'For 10s you swing 12 times a second on your own.', stamina: 45, cooldown: 90, duration: 10 },
];

export interface PassiveDef {
  id: string;
  name: string;
  text: string;
  branch: 'brawn' | 'machinist' | 'prospector';
  max: number;
}

/** Three branches; a node needs the one above it in its branch. */
export const PASSIVES: readonly PassiveDef[] = [
  { id: 'heavy', name: 'Heavy Swing', text: '+15% tap damage per rank.', branch: 'brawn', max: 5 },
  { id: 'keen', name: 'Keen Eye', text: '+2% crit chance per rank.', branch: 'brawn', max: 5 },
  { id: 'brutal', name: 'Brutal', text: '+30% crit damage per rank.', branch: 'brawn', max: 5 },
  { id: 'seambreaker', name: 'Seambreaker', text: '+25% damage to seams per rank.', branch: 'brawn', max: 5 },
  { id: 'oiled', name: 'Oiled Gears', text: '+15% machine output per rank.', branch: 'machinist', max: 5 },
  { id: 'tinker', name: 'Tinker', text: '+20% refinery speed per rank.', branch: 'machinist', max: 5 },
  { id: 'nightshift', name: 'Night Shift', text: '+1h offline time and +10% offline yield per rank.', branch: 'machinist', max: 5 },
  { id: 'overclock', name: 'Overclock', text: 'Machines can crit at half your crit chance, +1 rank = +10%.', branch: 'machinist', max: 5 },
  { id: 'lucky', name: 'Lucky Strike', text: '+4 luck per rank.', branch: 'prospector', max: 5 },
  { id: 'assayer', name: 'Assayer', text: '+10% sell value per rank.', branch: 'prospector', max: 5 },
  { id: 'geologist', name: 'Geologist', text: '+10% ore yield per rank.', branch: 'prospector', max: 5 },
  { id: 'scholar', name: 'Scholar', text: '+12% XP per rank.', branch: 'prospector', max: 5 },
];

export interface EchoDef {
  id: string;
  name: string;
  text: string;
  baseCost: number;
  growth: number;
  max: number;
}

/** The permanent tree, paid for in Echoes from a Descent. */
export const ECHOES: readonly EchoDef[] = [
  { id: 'resonance', name: 'Resonant Pick', text: 'Tap damage ×2 per rank.', baseCost: 2, growth: 1.68, max: 40 },
  { id: 'ghosts', name: 'Ghost Hands', text: 'Machine output ×2 per rank.', baseCost: 2, growth: 1.68, max: 40 },
  { id: 'ledger', name: 'Old Ledger', text: 'Sell value ×1.5 per rank.', baseCost: 3, growth: 1.68, max: 40 },
  { id: 'memory', name: 'Deep Memory', text: 'Each Descent starts 5 depths deeper per rank.', baseCost: 5, growth: 1.8, max: 20 },
  { id: 'purse', name: 'Buried Purse', text: 'Start each Descent with coin: 500 × 5^rank.', baseCost: 3, growth: 1.6, max: 15 },
  { id: 'study', name: 'Quick Study', text: '+30% XP per rank.', baseCost: 2, growth: 1.6, max: 20 },
  { id: 'omen', name: 'Omen', text: '+6 luck per rank.', baseCost: 3, growth: 1.6, max: 20 },
  { id: 'embers', name: 'Ember Memory', text: '+30% refinery speed per rank.', baseCost: 2, growth: 1.6, max: 20 },
  { id: 'longnight', name: 'Long Night', text: '+2h offline time per rank.', baseCost: 4, growth: 1.8, max: 8 },
  { id: 'hum', name: 'The Hum', text: 'Every unspent Echo adds +2% to all damage.', baseCost: 6, growth: 1, max: 1 },
];

/** Depth a run has to reach before a Descent pays anything. */
export const DESCENT_FLOOR = 20;
