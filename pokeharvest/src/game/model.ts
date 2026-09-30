/** The shape of a farm in progress: everything the save holds. */
import type { Point } from './path';
import type { Rng } from './rng';

export type Dir = 'up' | 'down' | 'left' | 'right';

export interface CropState {
  id: string;
  /** Watered nights so far; ripe once it reaches the crop's `days`. */
  growth: number;
  harvests: number;
  /** A Grass helper looked after it today: it grows faster tonight. */
  tended: boolean;
}

/** A tilled tile. No entry in `World.plots` means untilled grass. */
export interface Plot {
  watered: boolean;
  crop: CropState | null;
}

export interface Walker {
  /** Tile coordinates; fractional while walking. */
  x: number;
  y: number;
  path: Point[];
  facing: Dir;
}

export interface Player extends Walker {
  energy: number;
  maxEnergy: number;
  gold: number;
  /** Charges left in the watering can. */
  water: number;
  /** A tile to use once the walk there ends. */
  pending: Point | null;
}

export interface Helper extends Walker {
  dex: number;
  /** In-game minutes until it looks for its next job. */
  cooldown: number;
  /** The plot it is walking to work on. */
  target: Point | null;
}

export interface DaySummary {
  day: number;
  shipped: Record<string, number>;
  earned: number;
  grown: number;
  ripe: number;
  crowAte: string | null;
  dried: number;
  passedOut: boolean;
  lost: number;
}

export type GameEvent =
  | { kind: 'till' | 'water' | 'plant' | 'harvest' | 'clear' | 'refill'; x: number; y: number; text?: string }
  | { kind: 'helper'; x: number; y: number; dex: number; text: string }
  | { kind: 'hint'; x: number; y: number; text: string }
  | { kind: 'open'; ui: 'sleep' | 'bin' | 'mart' }
  | { kind: 'coins'; amount: number }
  | { kind: 'day'; summary: DaySummary };

export interface World {
  day: number;
  /** Minutes since midnight of `day`; past 24 × 60 after midnight. */
  clock: number;
  rng: Rng;
  player: Player;
  helpers: Helper[];
  /** Keyed "x,y". */
  plots: Record<string, Plot>;
  inventory: Record<string, number>;
  /** The item in hand. */
  selected: string;
  /** Waiting to be collected overnight. */
  bin: Record<string, number>;
  stats: { harvested: number; earned: number };
  /** Things that happened since the renderer last looked; not saved. */
  events: GameEvent[];
}

export const CAN_SIZE = 20;
export const MAX_ENERGY = 100;
export const START_GOLD = 500;

export function plotKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function parseKey(key: string): Point {
  const [x, y] = key.split(',').map(Number) as [number, number];
  return { x, y };
}

/** The tile a walker is on (or nearly on). */
export function tileOf(w: Walker): Point {
  return { x: Math.round(w.x), y: Math.round(w.y) };
}
