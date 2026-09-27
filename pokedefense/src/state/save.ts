/**
 * Everything kept between battles, in `localStorage`: badges and stars, the
 * Pokédex, the bag, BP, held items, Trainer upgrades, the last team and the
 * sound settings.
 *
 * Loading is forgiving — anything missing or malformed falls back to its
 * default — so an old or hand-edited save never stops the game starting.
 */
import {
  BALL_KEYS, type BallKey, HELD_BY_KEY, NO_TRAINER, POWERUP_KEYS, type PowerupKey, TRAINER_KEYS, type TrainerLevels,
} from '../data/items';
import { MAPS, type MapDef } from '../data/maps';
import { previousRegion, REGIONS, type RegionId } from '../data/regions';
import { LINES, lineForDex, type TowerLine } from '../data/towers';
import type { DifficultyKey } from '../game/waves';

const KEY = 'pokedefense.save.v1';
export const TEAM_SIZE = 8;

export interface Volumes {
  sfx: number;
  cries: number;
  music: number;
}

export interface MapResult {
  normal: number;
  hard: number;
  /** Endless: most waves cleared. */
  best: number;
}

export interface Progress {
  results: Record<string, MapResult>;
  caught: number[];
  shinies: number[];
  seen: number[];
  bp: number;
  items: Record<PowerupKey, number>;
  balls: Record<BallKey, number>;
  heldOwned: string[];
  /** Held item per tower line. */
  held: Record<string, string>;
  trainer: TrainerLevels;
  team: string[];
  volumes: Volumes;
  muted: boolean;
  haptics: boolean;
  /** Show the tutorial coach and the tips under the shop. */
  hints: boolean;
  tutorialDone: boolean;
  /** Regions whose professor has already handed over the starters. */
  greeted: RegionId[];
}

export const DEFAULT_VOLUMES: Volumes = { sfx: 70, cries: 60, music: 45 };

const zero = <K extends string>(keys: readonly K[]): Record<K, number> => Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;

export function freshProgress(): Progress {
  const items = zero(POWERUP_KEYS);
  items['x-attack'] = 1;
  items['rare-candy'] = 1;
  items['tm-electric'] = 1;
  const balls = zero(BALL_KEYS);
  balls['poke-ball'] = 5;
  return {
    results: {}, caught: [], shinies: [], seen: [], bp: 0, items, balls, heldOwned: [], held: {},
    trainer: { ...NO_TRAINER }, team: ['charmander', 'squirtle', 'bulbasaur', 'pidgey'],
    volumes: { ...DEFAULT_VOLUMES }, muted: false, haptics: true, hints: true, tutorialDone: false, greeted: ['kanto'],
  };
}

interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStore(): Store | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

const num = (v: unknown, fallback = 0, max = 1e9): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : fallback);
const nums = (v: unknown): number[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is number => typeof x === 'number'))] : []);
const strs = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string'))] : []);

function counts<K extends string>(keys: readonly K[], raw: unknown, fallback: Record<K, number>): Record<K, number> {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return Object.fromEntries(keys.map((k) => [k, num(obj[k], raw ? 0 : fallback[k], 999)])) as Record<K, number>;
}

export function loadProgress(store: Store | null = defaultStore()): Progress {
  const fresh = freshProgress();
  let raw: Record<string, unknown> = {};
  try {
    const text = store?.getItem(KEY);
    if (text) raw = JSON.parse(text) as Record<string, unknown>;
  } catch {
    raw = {};
  }
  if (!raw || typeof raw !== 'object') return fresh;

  const results: Record<string, MapResult> = {};
  const rawResults = (raw.results ?? {}) as Record<string, Partial<MapResult>>;
  for (const map of MAPS) {
    const r = rawResults[map.id];
    if (r) results[map.id] = { normal: num(r.normal, 0, 3), hard: num(r.hard, 0, 3), best: num(r.best) };
  }
  const trainerRaw = (raw.trainer ?? {}) as Record<string, unknown>;
  const trainer = Object.fromEntries(TRAINER_KEYS.map((k) => [k, num(trainerRaw[k], 0, 5)])) as TrainerLevels;
  const heldOwned = strs(raw.heldOwned).filter((k) => HELD_BY_KEY.has(k));
  const held: Record<string, string> = {};
  for (const [lineId, item] of Object.entries((raw.held ?? {}) as Record<string, unknown>)) {
    if (typeof item === 'string' && heldOwned.includes(item) && LINES.some((l) => l.id === lineId)) held[lineId] = item;
  }
  const volumesRaw = (raw.volumes ?? {}) as Record<string, unknown>;
  const team = strs(raw.team).filter((id) => LINES.some((l) => l.id === id)).slice(0, TEAM_SIZE);

  return {
    results,
    caught: nums(raw.caught),
    shinies: nums(raw.shinies),
    seen: nums(raw.seen),
    bp: num(raw.bp),
    items: counts(POWERUP_KEYS, raw.items, fresh.items),
    balls: counts(BALL_KEYS, raw.balls, fresh.balls),
    heldOwned,
    held,
    trainer,
    team: team.length ? team : fresh.team,
    volumes: {
      sfx: num(volumesRaw.sfx, DEFAULT_VOLUMES.sfx, 100),
      cries: num(volumesRaw.cries, DEFAULT_VOLUMES.cries, 100),
      music: num(volumesRaw.music, DEFAULT_VOLUMES.music, 100),
    },
    muted: raw.muted === true,
    haptics: raw.haptics !== false,
    hints: raw.hints !== false,
    tutorialDone: raw.tutorialDone === true,
    greeted: Array.isArray(raw.greeted) ? strs(raw.greeted).filter((r): r is RegionId => r in REGIONS) : ['kanto'],
  };
}

export function saveProgress(p: Progress, store: Store | null = defaultStore()): void {
  try {
    store?.setItem(KEY, JSON.stringify(p));
  } catch {
    // Private mode or full: the game carries on, it just won't remember.
  }
}

// --- derived --------------------------------------------------------------------

export function badges(p: Progress): number[] {
  return MAPS.filter((m) => m.badge && (p.results[m.id]?.normal || p.results[m.id]?.hard)).map((m) => m.badge!);
}

export function cleared(p: Progress, map: MapDef): boolean {
  const r = p.results[map.id];
  return Boolean(r && (r.normal > 0 || r.hard > 0));
}

/** Kanto is always open; each later region opens once the one before has a Champion. */
export function regionUnlocked(p: Progress, id: RegionId): boolean {
  const prev = previousRegion(id);
  if (!prev) return true;
  const league = MAPS.find((m) => m.id === REGIONS[prev].league);
  return Boolean(league && cleared(p, league));
}

export function regionMaps(id: RegionId): MapDef[] {
  return MAPS.filter((m) => m.regionId === id);
}

/** In order within a region; the endless map once its League is won. */
export function mapUnlocked(p: Progress, map: MapDef): boolean {
  if (!regionUnlocked(p, map.regionId)) return false;
  const league = MAPS.find((m) => m.id === REGIONS[map.regionId].league)!;
  if (map.endless) return cleared(p, league);
  const campaign = regionMaps(map.regionId).filter((m) => !m.endless);
  const i = campaign.indexOf(map);
  return i === 0 || cleared(p, campaign[i - 1]!);
}

export function lineUnlocked(p: Progress, l: TowerLine): boolean {
  if (l.unlock.kind === 'start') return true;
  if (l.unlock.kind === 'region' && regionUnlocked(p, l.unlock.region)) return true;
  if (l.unlock.kind === 'badge' && badges(p).includes(l.unlock.badge)) return true;
  return p.caught.some((dex) => lineForDex(dex)?.id === l.id);
}

export function unlockedLines(p: Progress): TowerLine[] {
  return LINES.filter((l) => lineUnlocked(p, l));
}

export function totalStars(p: Progress): number {
  return Object.values(p.results).reduce((sum, r) => sum + r.normal + r.hard, 0);
}

/** BP earned for a battle. First clears pay double. */
export function battleReward(map: MapDef, difficulty: DifficultyKey, won: boolean, stars: number, cleared: number, firstClear: boolean): number {
  if (map.endless) return cleared * 8;
  if (!won) return cleared * 4;
  const base = 60 + 25 * map.tier + 20 * stars;
  return Math.round(base * (difficulty === 'hard' ? 1.5 : 1) * (firstClear ? 2 : 1));
}

export interface BattleOutcome {
  mapId: string;
  difficulty: DifficultyKey;
  won: boolean;
  stars: number;
  cleared: number;
  caught: { dex: number; shiny: boolean }[];
  seen: number[];
}

/** Fold a finished battle into the save. Returns the new progress and the BP earned. */
export function recordBattle(p: Progress, o: BattleOutcome): { progress: Progress; bp: number; newLines: TowerLine[] } {
  const map = MAPS.find((m) => m.id === o.mapId)!;
  const before = new Set(unlockedLines(p).map((l) => l.id));
  const prev = p.results[o.mapId] ?? { normal: 0, hard: 0, best: 0 };
  const firstClear = o.won && prev[o.difficulty] === 0;
  const bp = battleReward(map, o.difficulty, o.won, o.stars, o.cleared, firstClear);
  const results = {
    ...p.results,
    [o.mapId]: { ...prev, [o.difficulty]: Math.max(prev[o.difficulty], o.stars), best: Math.max(prev.best, o.cleared) },
  };
  const next: Progress = {
    ...p,
    results,
    bp: p.bp + bp,
    caught: [...new Set([...p.caught, ...o.caught.map((c) => c.dex)])],
    shinies: [...new Set([...p.shinies, ...o.caught.filter((c) => c.shiny).map((c) => c.dex)])],
    seen: [...new Set([...p.seen, ...o.seen, ...o.caught.map((c) => c.dex)])],
  };
  const newLines = unlockedLines(next).filter((l) => !before.has(l.id));
  return { progress: next, bp, newLines };
}
