/** The shape of a farm in progress: everything the save holds. */
import type { MapId } from '../data/maps';
import type { Skill, UpgradableTool } from '../data/progress';
import type { Battle } from './battle';
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

/** One Pokémon you own. */
export interface Mon {
  uid: number;
  dex: number;
  level: number;
  /** Total experience; level L needs L³. */
  xp: number;
  hp: number;
  moves: string[];
  shiny: boolean;
}

/** A party Pokémon out on the map, following you and doing its job. */
export interface Helper extends Walker {
  uid: number;
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
  /** A tool the blacksmith finished overnight, e.g. "Copper Hoe". */
  upgraded: string | null;
}

export type GameEvent =
  | { kind: 'till' | 'water' | 'plant' | 'harvest' | 'clear' | 'refill'; x: number; y: number; text?: string }
  | { kind: 'helper'; x: number; y: number; dex: number; text: string }
  | { kind: 'hint'; x: number; y: number; text: string }
  | { kind: 'open'; ui: 'sleep' | 'bin' | 'mart' | 'smith' }
  | { kind: 'coins'; amount: number }
  | { kind: 'day'; summary: DaySummary }
  | { kind: 'skill'; skill: Skill; level: number }
  | { kind: 'warp'; map: MapId }
  | { kind: 'encounter'; dex: number; level: number };

export interface World {
  day: number;
  /** Minutes since midnight of `day`; past 24 × 60 after midnight. */
  clock: number;
  rng: Rng;
  map: MapId;
  player: Player;
  /** Every Pokémon you own. */
  mons: Mon[];
  /** Up to three uids: they follow you, work the farm and battle. The rest wait in the box. */
  party: number[];
  nextUid: number;
  helpers: Helper[];
  /** Keyed "x,y", on the farm. */
  plots: Record<string, Plot>;
  inventory: Record<string, number>;
  /** The item in hand. */
  selected: string;
  /** Waiting to be collected overnight. */
  bin: Record<string, number>;
  tools: Record<UpgradableTool, number>;
  /** A tool at the blacksmith: ready the morning after `day`. */
  upgrade: { tool: UpgradableTool; tier: number; day: number } | null;
  skills: Record<Skill, number>;
  perks: string[];
  /** Skill milestones waiting for you to pick a perk. */
  pendingPerks: { skill: Skill; level: 5 | 10 }[];
  seen: number[];
  caught: number[];
  stats: { harvested: number; earned: number; wins: number };
  /** A wild battle under way; not saved. */
  battle: Battle | null;
  /** Things that happened since the renderer last looked; not saved. */
  events: GameEvent[];
}

export const MAX_ENERGY = 100;
export const START_GOLD = 500;
export const PARTY_SIZE = 3;

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

export function monByUid(world: World, uid: number): Mon | undefined {
  return world.mons.find((m) => m.uid === uid);
}

export function partyMons(world: World): Mon[] {
  return world.party.flatMap((uid) => monByUid(world, uid) ?? []);
}

export function hasPerk(world: World, id: string): boolean {
  return world.perks.includes(id);
}
