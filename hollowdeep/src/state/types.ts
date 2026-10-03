import type { ConsumableId, Feature, FixtureId, Goal, Reward, Slot, StatKey } from '../data/types';
import type { SkillId } from '../data/progression';

export interface GearItem {
  uid: number;
  base: string;
  affixes: { stat: StatKey; value: number }[];
}

export interface Block {
  ore: string;
  hp: number;
  maxHp: number;
  seam: boolean;
}

export interface FurnaceSlot {
  recipe: string | null;
  /** Seconds into the batch on the fire, or -1 when nothing is on it. */
  progress: number;
  /** Batches still to smelt, including the one on the fire. */
  queued: number;
}

export interface Contract {
  id: string;
  title: string;
  goal: Goal;
  reward: Reward & { echoes?: number };
  /** The goal's counter when the contract was posted; progress counts from here. */
  base: number;
  claimed: boolean;
}

export type CoreStat = 'str' | 'dex' | 'lck' | 'end';

/** Lifetime tallies. Never reset — missions and contracts measure against them. */
export interface Counters {
  breaks: number;
  mined: Record<string, number>;
  gems: number;
  earned: number;
  refined: number;
  crafted: number;
  craftedBy: Record<string, number>;
  skills: Record<string, number>;
  statsSpent: number;
  descents: number;
  /** Blocks broken with the seam held buried. */
  farmed: number;
}

export interface Settings {
  music: number;
  sfx: number;
  muted: boolean;
}

export interface GameState {
  version: number;
  /** mulberry32 state. Every random roll in the game comes from here. */
  rng: number;
  /** Simulated seconds this save has run. */
  time: number;
  /** Wall-clock ms at the last save; offline progress is measured from it. */
  savedAt: number;

  coins: number;
  depth: number;
  /** The deepest depth opened this run. */
  maxDepth: number;
  deepestEver: number;
  /** Normal blocks broken at this depth since arriving; the seam comes at `blocksPerDepth`. */
  blocksHere: number;
  block: Block;
  /** Off, you stay put and farm; the seam is never exposed. */
  autoAdvance: boolean;

  inventory: Record<string, number>;
  upgrades: Record<string, number>;
  machines: Record<string, number>;

  level: number;
  xp: number;
  statPoints: number;
  stats: Record<CoreStat, number>;
  passives: Record<string, number>;
  stamina: number;
  cooldowns: Record<SkillId, number>;
  /** Seconds left on each timed effect. */
  buffs: { dowse: number; frenzy: number; luck: number; sage: number };
  /** Fractional taps owed by Frenzy. */
  frenzyCarry: number;

  gear: GearItem[];
  equipped: Record<Slot, number | null>;
  nextUid: number;
  consumables: Record<ConsumableId, number>;
  fixtures: FixtureId[];
  features: Feature[];
  furnace: FurnaceSlot[];

  /**
   * The active story mission by id (null once the story is over), and where
   * its goal's counter stood when it began. For a `visit` goal, `base` is 1
   * once the player has been there.
   */
  story: { id: string | null; base: number };
  /** Story flags earned; see `data/flags.ts`. */
  flags: string[];
  /** Bargains struck; see `data/flags.ts`. */
  bargains: string[];
  /** Blocks the machines may still break this second. See `MACHINE_BREAKS_PER_SECOND`. */
  machineBudget: number;
  counters: Counters;
  contracts: { day: string; list: Contract[] };

  echoes: number;
  echoesEarned: number;
  echoUpgrades: Record<string, number>;

  settings: Settings;
}
