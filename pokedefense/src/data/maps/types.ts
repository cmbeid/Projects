/** Shared shapes for map data. The terrain legend is in `../maps.ts`. */
import type { TrackId } from '../music';
import type { RegionId } from '../regions';
import type { Ability } from '../species';
import type { PokeType } from '../types';

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
  | 'santalune' | 'glittering' | 'mastery' | 'coumarine' | 'lumiose' | 'laverre' | 'anistar' | 'frostcavern' | 'kalosleague' | 'terminus'
  // Alola
  | 'verdant' | 'brooklet' | 'wela' | 'lushjungle' | 'hokulani' | 'megamart' | 'poni' | 'ulaula' | 'alolaleague' | 'altar'
  // Galar
  | 'turffield' | 'hulbury' | 'motostoke' | 'stowonside' | 'ballonlea' | 'circhester' | 'spikemuth' | 'hammerlocke' | 'wyndon' | 'weald'
  // Paldea
  | 'cortondo' | 'artazon' | 'levincia' | 'cascarrafa' | 'medali' | 'montenevera' | 'alfornada' | 'glaseado' | 'paldealeague' | 'areazero'
  // Orange Islands
  | 'valencia' | 'pinkan' | 'mikan' | 'navel' | 'trovita' | 'kumquat' | 'shamouti' | 'mandarin' | 'pummelo' | 'shrine'
  // Hisui
  | 'obsidian' | 'crimson' | 'cobalt' | 'highlands' | 'alabaster' | 'jubilife' | 'lakevalor' | 'coronet' | 'temple' | 'origin'
  // Kitakami and Blueberry Academy
  | 'mossui' | 'loyalty' | 'onimountain' | 'barrens' | 'timeless' | 'coastal' | 'polar' | 'crystalpool' | 'blueberry' | 'underdepths'
  // The Battle Frontier
  | 'gauntlet';

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
  /** Hisui: the chance each one is an Alpha — bigger, far tougher, and worth three times the ₽. */
  alpha?: number;
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
  /** A Totem Pokémon (Alola): tougher allies nearby, and it calls two more when hurt. */
  totem?: boolean;
  /** Dynamaxed (Galar): giant, with half again the HP, sending out Max Move shockwaves for its first 30 s. */
  dynamax?: boolean;
  /** Terastallized (Paldea): it has only this type. */
  tera?: PokeType;
  /** A frenzied Noble (Hisui): at two-thirds and one-third HP it shields itself and stuns towers around it. */
  frenzy?: boolean;
  /** Changes as it's worn down (Ogerpon's masks): below `at` of its HP it takes this Tera type and/or form. */
  phases?: readonly BossPhase[];
}

export interface BossPhase {
  /** Fraction of max HP it changes below. */
  at: number;
  tera?: PokeType;
  dex?: number;
  /** Shown on the boss bar, e.g. "Wellspring Mask". */
  name?: string;
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
  /** A challenge's rules (the Orange Crew's, and the Battle Frontier's). */
  rules?: MapRules;
}

/**
 * Rules a challenge sets on a battle: which towers may come, how many, and
 * what help is allowed. The Orange Islands' leaders set them on their maps;
 * the Battle Frontier sets them on any map.
 */
export interface MapRules {
  /** Only lines of these types may be placed. */
  types?: readonly PokeType[];
  /** At most this many towers on the field at once. */
  maxTowers?: number;
  /** No power-ups (Poké Balls are still allowed). */
  noItems?: boolean;
  /** Only Pokémon that can swim may be placed. */
  swimmersOnly?: boolean;
  /** Towers are placed already at this level (rentals). */
  startLevel?: number;
  /** Start with this many lives instead of your own. */
  lives?: number;
  /** Scales every Pokémon's HP (the Battle Tower's longer streaks). */
  hpMul?: number;
  /** Replaces the map's last boss (the Battle Tower's Tycoon). */
  boss?: BossDef;
  /** Shown on the map card and when the battle starts. */
  label?: string;
}

export const warp = (x: number, y: number): Waypoint => ({ x, y, warp: true });
