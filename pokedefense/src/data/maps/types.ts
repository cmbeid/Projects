/** Shared shapes for map data. The terrain legend is in `../maps.ts`. */
import type { TrackId } from '../music';
import type { RegionId } from '../regions';
import type { Ability } from '../species';

export const COLS = 9;
export const ROWS = 15;

export type Terrain =
  | 'grass' | 'flowers' | 'floor' | 'ledge' | 'sand' | 'ice'
  | 'water' | 'tree' | 'rock' | 'wall' | 'grave' | 'lava' | 'bamboo';

export const TERRAIN: Record<string, Terrain> = {
  '.': 'grass', ',': 'flowers', '=': 'floor', h: 'ledge', s: 'sand', i: 'ice', '~': 'water',
  T: 'tree', R: 'rock', X: 'wall', g: 'grave', L: 'lava', B: 'bamboo',
};

/** Terrain a land tower can stand on. */
export const BUILDABLE: ReadonlySet<Terrain> = new Set(['grass', 'flowers', 'floor', 'ledge', 'sand', 'ice']);

export type Waypoint = readonly [x: number, y: number] | { x: number; y: number; warp: true };

export type Theme =
  // Kanto
  | 'forest' | 'cave' | 'ship' | 'garden' | 'tower' | 'office' | 'volcano' | 'gym' | 'plateau' | 'deepcave'
  // Johto
  | 'bamboo' | 'darkforest' | 'city' | 'ash' | 'cliffs' | 'lighthouse' | 'icecave' | 'dragonden' | 'mountain'
  // Hoenn
  | 'woods' | 'granite' | 'powerplant' | 'ashen' | 'dojo' | 'rainroute' | 'space' | 'sootopolis' | 'league' | 'sky'
  // Sinnoh
  | 'mine' | 'eterna' | 'veilstone' | 'marsh' | 'hearthome' | 'canalave' | 'snowpoint' | 'sunyshore' | 'sinnohleague' | 'spearpillar'
  // Unova
  | 'striaton' | 'museum' | 'pinwheel' | 'nimbasa' | 'driftveil' | 'mistralton' | 'twistmountain' | 'opelucid' | 'unovaleague' | 'chasm'
  // Kalos
  | 'santalune' | 'glittering' | 'mastery' | 'coumarine' | 'lumiose' | 'laverre' | 'anistar' | 'frostcavern' | 'kalosleague' | 'terminus';

/**
 * Weather: rain and sun boost or weaken attack types, sandstorm and hail wear
 * enemies down, and fog (Sinnoh) shortens every tower's reach but a Flying
 * type's or one holding a Wide Lens.
 */
export type Weather = 'rain' | 'sun' | 'sand' | 'hail' | 'fog';

/** A species that can turn up in a map's waves. */
export interface PoolEntry {
  dex: number;
  weight: number;
  /** First wave it can appear in. */
  from: number;
  /** Turns up alone, now and then, rather than in groups: the catch-only rarities. */
  rare?: boolean;
}

export interface BossDef {
  dex: number;
  /** HP in Caterpie units, before map scaling. */
  hp: number;
  armor?: number;
  speed?: number;
  abilities: readonly Ability[];
  /** Pokémon that come with it. */
  escort: readonly number[];
  /** Bosses that enter alongside, one down each other path (Tate & Liza, the Striaton triplets). */
  partners?: readonly BossDef[];
  /** Mega Evolves into this form (its form id) at half HP. */
  mega?: number;
}

export interface MapDef {
  id: string;
  name: string;
  regionId: RegionId;
  /** Where it is, shown under the name ("Route 2", "Goldenrod City"). */
  area: string;
  leader: string;
  /**
   * 1-based; scales HP and ₽. Each region starts a little higher than the
   * last (Johto from 3, Hoenn from 5) rather than carrying on from 9: your
   * roster grows wider from region to region, not stronger.
   */
  tier: number;
  theme: Theme;
  track: TrackId;
  bossTrack: TrackId;
  /** Played for the last boss instead, if set (a Champion). */
  finalTrack?: TrackId;
  grid: readonly string[];
  paths: readonly (readonly Waypoint[])[];
  waves: number;
  startMoney: number;
  pool: readonly PoolEntry[];
  /** Waves (1-based) whose last group is a tougher lead Pokémon. */
  miniBoss: { wave: number; dex: number; hp: number; shiny?: boolean }[];
  boss: BossDef;
  /** More bosses before the last wave (the Elite Four). */
  extraBosses?: { wave: number; trainer: string; boss: BossDef }[];
  twist: string;
  weather?: Weather;
  /** Scales every wild Pokémon's HP here, for balancing a map against its neighbours. */
  hpMul?: number;
  endless?: boolean;
  /** Endless maps: bosses that take turns with `boss`, one each 25 waves. */
  rotation?: readonly BossDef[];
  /** Badge awarded for clearing it (PokeAPI's badge number). */
  badge?: number;
}

export const warp = (x: number, y: number): Waypoint => ({ x, y, warp: true });
