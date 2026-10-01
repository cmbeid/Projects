/** The shape of a farm in progress: everything the save holds. */
import type { Weather } from '../data/encounters';
import type { Buff } from '../data/items';
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
  /** 0–255: grows when a farm Pokémon is fed and patted; more of it means more produce. */
  friendship: number;
  /** Ate from the trough last night: works at full pace, and livestock produce. */
  fed: boolean;
}

export type Role = 'party' | 'farm' | 'box';

/** A party Pokémon out on the map, following you and doing its job. */
export interface Helper extends Walker {
  uid: number;
  dex: number;
  /** Party Pokémon follow you; farm Pokémon stay home and work even while you're away. */
  role: 'party' | 'farm';
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
  /** What the barn's Pokémon made overnight. */
  produced: Record<string, number>;
  /** Farm Pokémon who went to bed hungry. */
  hungry: number;
  /** Requests that ran out of time. */
  expired: number;
  /** Outdoor crops lost because their season ended. */
  withered: number;
  /** A new season started this morning. */
  newSeason: boolean;
}

/** A placed machine. */
export interface Machine {
  id: string;
  /** What it's making, if anything, and how far along (in-game minutes). */
  output: string | null;
  count: number;
  progress: number;
  needed: number;
}

/** A town request on the board: deliver `count` of `item` by the end of day `due`. */
export interface Request {
  id: number;
  item: string;
  count: number;
  reward: number;
  reputation: number;
  due: number;
}

export interface Barn {
  level: number;
  /** Berries put out for the farm Pokémon: each eats one a night. */
  trough: Record<string, number>;
  /** Produce waiting to be collected. */
  output: Record<string, number>;
}

export type GameEvent =
  | { kind: 'till' | 'water' | 'plant' | 'harvest' | 'clear' | 'refill'; x: number; y: number; text?: string }
  | { kind: 'helper'; x: number; y: number; dex: number; text: string }
  | { kind: 'hint'; x: number; y: number; text: string }
  | { kind: 'open'; ui: 'sleep' | 'bin' | 'mart' | 'smith' | 'barn' | 'board' | 'merchant' }
  | { kind: 'machine'; x: number; y: number }
  | { kind: 'place' | 'collect' | 'pet'; x: number; y: number; text?: string }
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
  /** Up to three uids: they follow you, work the farm and battle. */
  party: number[];
  /** Uids living in the barn, working the farm all day. Anyone in neither list waits in the box. */
  farm: number[];
  barn: Barn;
  /** Placed machines, keyed "x,y", on the farm. */
  machines: Record<string, Machine>;
  /** Today's price multiplier for each market item. */
  market: Record<string, number>;
  /** How many of each item you've sold today: flooding the market lowers the price. */
  sold: Record<string, number>;
  reputation: number;
  requests: Request[];
  nextRequestId: number;
  /** The travelling merchant's stock, for the weekend day it was drawn. */
  merchant: { day: number; stock: { id: string; price: number; left: number }[] } | null;
  /** Food buffs, until you sleep. */
  buffs: Buff[];
  /** Pokémon patted today. */
  petted: number[];
  weather: Weather;
  /** Tomorrow's weather, as forecast. */
  tomorrow: Weather;
  /** The greenhouse has been repaired: anything grows in it, all year. */
  greenhouse: boolean;
  /** Pokédex milestones already claimed (by caught count). */
  dexClaimed: number[];
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

export function farmMons(world: World): Mon[] {
  return world.farm.flatMap((uid) => monByUid(world, uid) ?? []);
}

export function roleOf(world: World, uid: number): Role {
  return world.party.includes(uid) ? 'party' : world.farm.includes(uid) ? 'farm' : 'box';
}

export function hasBuff(world: World, buff: Buff): boolean {
  return world.buffs.includes(buff);
}

export function hasPerk(world: World, id: string): boolean {
  return world.perks.includes(id);
}
