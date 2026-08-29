import type { Decimal } from '../num/decimal';
import type { ResourceId } from '../data/types';

/** How many units a buy button purchases. `'max'` spends everything affordable. */
export type BuyMode = 1 | 10 | 'max';

/**
 * Everything a Relaunch does not touch.
 *
 * Kept in its own object rather than scattered across `GameState` so the reset
 * in `prestige.ts` can be written as "replace the run, keep this" — the one
 * shape where it is obvious at a glance what survives.
 */
export interface PrestigeState {
  /** Unspent Schematics. */
  schematics: Decimal;
  /** Every Schematic ever earned, spent or not. Layer 2 is priced off this. */
  schematicsEarned: Decimal;
  /** Perk ids bought from the Schematics tree. */
  perks: string[];
  /** The loadout chosen for the run in progress. Empty on the very first run. */
  directives: string[];
  relaunches: number;
}

export interface GameState {
  /** Seeds the PRNG. Nothing in eras 1-3 is random, but determinism is a
   *  contract the engine keeps from the start rather than retrofitting. */
  seed: number;

  /** Current stock. Clamped to storage; overflow is discarded. */
  resources: Record<ResourceId, Decimal>;
  /** Everything produced **this run**. Unlocks read this, so spending never
   *  un-reveals content the player has already seen — and a Relaunch re-gates
   *  the run honestly, because the new swarm really has produced nothing yet. */
  lifetime: Record<ResourceId, Decimal>;
  /** Everything produced across every run. Statistics only; nothing gates on it. */
  totals: Record<ResourceId, Decimal>;

  buildings: Record<string, number>;
  upgrades: string[];
  automation: string[];
  /** Automators can be switched off without being refunded. */
  automationOn: Record<string, boolean>;
  milestones: string[];
  /** Narrative fragment ids unlocked so far, in unlock order. Survives a Relaunch. */
  log: string[];

  prestige: PrestigeState;

  settings: { buyMode: BuyMode };
  /** `playedSeconds` and `taps` are all-time; `runSeconds` resets on Relaunch. */
  stats: { playedSeconds: number; runSeconds: number; taps: number };

  /** Carries fractional time between calls so the fixed timestep stays exact. */
  accumulator: number;
  /** Epoch ms of the last save. Offline catch-up (phase 6) reads this. */
  lastSeen: number;
}
