import type { ConsumableId, Feature, FixtureId, Goal, Reward, Slot, StatKey } from '../data/types';
import type { EdictId } from '../data/progression';

export interface RegaliaItem {
  uid: number;
  base: string;
  affixes: { stat: StatKey; value: number }[];
}

export interface Ruin {
  salvage: string;
  hp: number;
  maxHp: number;
  landmark: boolean;
}

/** A building standing on the grid. (x, y) is its top-left tile in its district. */
export interface Placed {
  uid: number;
  type: string;
  district: number;
  x: number;
  y: number;
  lvl: number;
}

/** A building as remembered in the plan kept across a Tide. */
export interface PlanEntry {
  type: string;
  district: number;
  x: number;
  y: number;
}

export interface WorkshopSlot {
  recipe: string | null;
  /** Seconds into the batch on the bench, or -1 when nothing is on it. */
  progress: number;
  /** Batches still to make, including the one on the bench. */
  queued: number;
}

export interface Petition {
  id: string;
  title: string;
  goal: Goal;
  reward: Reward & { memories?: number };
  /** The goal's counter when the petition was posted; progress counts from here. */
  base: number;
  claimed: boolean;
}

export type CoreStat = 'craft' | 'vision' | 'charm' | 'grit';

/** Lifetime tallies. Never reset — missions and petitions measure against them. */
export interface Counters {
  clears: number;
  salvaged: Record<string, number>;
  relics: number;
  earned: number;
  refined: number;
  refinedBy: Record<string, number>;
  crafted: number;
  craftedBy: Record<string, number>;
  edicts: Record<string, number>;
  statsSpent: number;
  tides: number;
  /** Ruins cleared with the landmark held back. */
  farmed: number;
  placed: number;
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
  /** Wall-clock ms at the last save; time away is measured from it. */
  savedAt: number;

  coins: number;
  ward: number;
  /** The furthest ward opened this run. Every ward up to here has its row of land. */
  maxWard: number;
  furthestEver: number;
  /** Ordinary ruins cleared in this ward since arriving; the landmark comes at `ruinsPerWard`. */
  ruinsHere: number;
  ruin: Ruin;
  /** Off, you stay put and salvage; the landmark is never exposed. */
  autoAdvance: boolean;

  inventory: Record<string, number>;
  upgrades: Record<string, number>;
  buildings: Placed[];
  /** The city as it stood before the last Tide, for rebuilding. */
  plan: PlanEntry[];

  level: number;
  xp: number;
  statPoints: number;
  stats: Record<CoreStat, number>;
  passives: Record<string, number>;
  resolve: number;
  cooldowns: Record<EdictId, number>;
  /** Seconds left on each timed effect. */
  buffs: { survey: number; festival: number; ink: number; almanac: number; overtime: number; wine: number; seek: number; calm: number };
  /** Fractional swings owed by the Festival. */
  festivalCarry: number;

  regalia: RegaliaItem[];
  equipped: Record<Slot, number | null>;
  nextUid: number;
  consumables: Record<ConsumableId, number>;
  fixtures: FixtureId[];
  features: Feature[];
  workshops: WorkshopSlot[];

  /**
   * The active story mission by id (null once the story is over), and where
   * its goal's counter stood when it began. For a `visit` goal, `base` is 1
   * once the player has been there.
   */
  story: { id: string | null; base: number };
  /** Story flags earned; see `data/flags.ts`. */
  flags: string[];
  /** Ruins the crews may still clear this second. See `crewClearsPerSecond`. */
  crewBudget: number;
  counters: Counters;
  petitions: { day: string; list: Petition[] };

  memories: number;
  memoriesEarned: number;
  charter: Record<string, number>;

  settings: Settings;
}
