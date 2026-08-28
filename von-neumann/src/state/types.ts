import type { Decimal } from '../num/decimal';
import type { ResourceId } from '../data/types';

/** How many units a buy button purchases. `'max'` spends everything affordable. */
export type BuyMode = 1 | 10 | 'max';

export interface GameState {
  /** Seeds the PRNG. Nothing in eras 1-3 is random, but determinism is a
   *  contract the engine keeps from the start rather than retrofitting. */
  seed: number;

  /** Current stock. Clamped to storage; overflow is discarded. */
  resources: Record<ResourceId, Decimal>;
  /** Everything ever produced. Unlocks read this, so spending never
   *  un-reveals content the player has already seen. */
  lifetime: Record<ResourceId, Decimal>;

  buildings: Record<string, number>;
  upgrades: string[];
  automation: string[];
  /** Automators can be switched off without being refunded. */
  automationOn: Record<string, boolean>;
  milestones: string[];

  settings: { buyMode: BuyMode };
  stats: { playedSeconds: number; taps: number };

  /** Carries fractional time between calls so the fixed timestep stays exact. */
  accumulator: number;
  /** Epoch ms of the last save. Offline catch-up (phase 6) reads this. */
  lastSeen: number;
}
