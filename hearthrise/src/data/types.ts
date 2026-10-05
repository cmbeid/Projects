/**
 * The shapes of the game's content. Everything in `src/data/` is plain data
 * typed against these, so `scripts/validate-data.ts` can walk the whole graph
 * — every salvage reachable, every recipe craftable, every building
 * affordable, every mission completable — without running the game.
 */

export type DistrictId = 'landing' | 'harbour' | 'market' | 'foundry' | 'spire' | 'undercroft' | 'cloudline' | 'shore';
export type HazardKind = 'none' | 'tide' | 'crowd' | 'smog' | 'silence' | 'seep' | 'gale' | 'rivalry';

/** Three shades, darkest first. Sprites built from a material use all three. */
export type Shades = readonly [string, string, string];

export interface MusicParams {
  /** MIDI note of the tonic. */
  root: number;
  /** Semitone offsets of the scale the melody walks. */
  scale: readonly number[];
  /** Seconds per beat. */
  beat: number;
  /** Lowpass cutoff on the pads, in Hz. Lower is murkier. */
  filter: number;
  /** 0–1: how often a melody note is bent onto a tense interval instead. */
  unease: number;
  /** Semitones above the root for the second drone voice (7 = a fifth, 6 = a tritone). */
  droneInterval: number;
  /** 0–1: how busy the plucked ostinato under the bells is. The town gets busier; the Spire goes quiet. */
  bustle: number;
  /** A slow, deep bell under everything. On in the Spire. */
  toll?: boolean;
}

export interface District {
  id: DistrictId;
  name: string;
  /** What the city has become by the time it reaches here. */
  era: string;
  /** First ward of the district; it runs for `WARDS_PER_DISTRICT` wards (the Spire runs on for ever). */
  from: number;
  hazard: HazardKind;
  blurb: string;
  /** Rubble: outline, dark, mid, light. */
  ruin: readonly [string, string, string, string];
  /** Cleared ground, two tones for the checker. */
  ground: readonly [string, string];
  /** Scene backdrop, top to bottom. */
  sky: readonly [string, string];
  /** Particle and highlight tint. */
  glow: string;
  salvage: readonly { id: string; weight: number }[];
  relics: readonly string[];
  /** The heart-relic every landmark gives up. */
  heart: string;
  music: MusicParams;
}

export type MaterialKind = 'salvage' | 'relic' | 'good' | 'heart';

export interface Material {
  id: string;
  name: string;
  kind: MaterialKind;
  /** Coin per unit when sold. */
  value: number;
  shades: Shades;
  /** Salvage only: which pile shape the ruin shows. */
  pile?: 'timber' | 'stone' | 'metal' | 'cloth';
}

export type Slot = 'chain' | 'seal' | 'coat' | 'lantern';

export type StatKey =
  | 'dmgPct'
  | 'critChance'
  | 'critMult'
  | 'luck'
  | 'light'
  | 'smogRes'
  | 'resolve'
  | 'crewPct'
  | 'xpPct'
  | 'salvagePct'
  | 'taxPct';

export interface RegaliaBase {
  id: string;
  name: string;
  slot: Slot;
  tier: number;
  /** The material whose shades tint the sprite. */
  tint: string;
  stats: Partial<Record<StatKey, number>>;
}

export interface Stack {
  id: string;
  n: number;
}

/** A ward reached at least once (in any run), a story mission behind you, or a fixture built. */
export type Requirement = { ward: number } | { mission: string } | { fixture: FixtureId };

export interface RefineRecipe {
  id: string;
  output: string;
  inputs: readonly Stack[];
  seconds: number;
  requires: Requirement;
}

export type ConsumableId =
  | 'charge'
  | 'tea'
  | 'ink'
  | 'almanac'
  | 'overtime'
  | 'wine'
  | 'greatcharge'
  | 'seeker'
  | 'calm'
  | 'memoir'
  | 'grease'
  | 'kite';

export type FixtureId = 'seawall' | 'charter' | 'scrubbers' | 'beacons' | 'auction' | 'archive' | 'surveyor' | 'caissons' | 'windbreaks' | 'treaty';

export type CraftOutput =
  | { kind: 'regalia'; base: string }
  | { kind: 'consumable'; id: ConsumableId; n: number }
  | { kind: 'fixture'; id: FixtureId };

export interface CraftRecipe {
  id: string;
  output: CraftOutput;
  inputs: readonly Stack[];
  coins: number;
  requires: Requirement;
}

/** What a building is, for adjacency: every building likes or dislikes its neighbours by tag. */
export type Tag = 'home' | 'crew' | 'trade' | 'green' | 'civic' | 'industry';

export interface BuildingDef {
  id: string;
  name: string;
  text: string;
  tag: Tag;
  /** Footprint in tiles. */
  w: number;
  h: number;
  /** Citizens housed per level (homes). */
  pop?: number;
  /** Citizens needed per level to run at full strength (workplaces). */
  jobs?: number;
  /** Clearing damage per second per level (crews). */
  dps?: number;
  /** Coin per second per level (trade). */
  tax?: number;
  /** Workshop slots added by one of these (industry). */
  slots?: number;
  /** Happiness added per level (civic). */
  cheer?: number;
  /** Adjacency: what this building gets from each neighbour carrying that tag. */
  likes: Partial<Record<Tag, number>>;
  /** Coin for the first level of the first one; every level of the type after costs `growth` times more. */
  baseCost: number;
  growth: number;
  /** Materials spent to place one (not to level it up). */
  inputs: readonly Stack[];
  /** Green spaces only have the one level. */
  maxLevel?: number;
  requires: Requirement;
  /** The art: which template the sprite is built from, and its roof and wall colours. */
  art: { shape: string; roof: string; wall: string };
}

export type Feature =
  | 'upgrades'
  | 'build'
  | 'crews'
  | 'founder'
  | 'workshops'
  | 'drafting'
  | 'rush'
  | 'survey'
  | 'festival'
  | 'passives'
  | 'petitions'
  | 'tide';

export type Goal =
  | { kind: 'ward'; n: number }
  | { kind: 'level'; n: number }
  | { kind: 'clears'; n: number }
  | { kind: 'salvage'; id: string; n: number }
  | { kind: 'relics'; n: number }
  | { kind: 'earn'; n: number }
  | { kind: 'upgrade'; id: string; n: number }
  /** Levels of a building type, summed over every one placed. */
  | { kind: 'build'; id: string; n: number }
  /** Buildings placed, ever. */
  | { kind: 'placed'; n: number }
  | { kind: 'pop'; n: number }
  /** City happiness, in percent. */
  | { kind: 'happy'; n: number }
  | { kind: 'refine'; n: number; good?: string }
  | { kind: 'craft'; n: number; recipe?: string }
  | { kind: 'edict'; n: number; edict?: string }
  | { kind: 'stats'; n: number }
  | { kind: 'fixture'; id: FixtureId }
  | { kind: 'tide'; n: number }
  /** Stand at this ward while the mission is active. */
  | { kind: 'visit'; ward: number }
  /** Clear ruins with the landmark held back (pushing off). */
  | { kind: 'farm'; n: number }
  /** Memories earned across every Tide, ever. */
  | { kind: 'memories'; n: number };

export interface Reward {
  coins?: number;
  xp?: number;
  unlock?: readonly Feature[];
  items?: readonly Stack[];
  consumables?: readonly { id: ConsumableId; n: number }[];
  /** A story flag: something in the world is now different. See `flags.ts`. */
  flag?: string;
}

export interface Mission {
  id: string;
  title: string;
  /** One or two lines of flavour, in the Founder's voice. */
  text: string;
  goal: Goal;
  reward: Reward;
  /** Shown as a short scene when the mission is claimed, one paragraph per entry. */
  scene?: readonly string[];
  /** Replaces `scene` when the player carries one of these flags; first match wins. */
  sceneIf?: readonly { flag: string; scene: readonly string[] }[];
  /** A decision made when claiming. Each option sets a flag and plays its own scene. */
  choice?: { prompt: string; options: readonly { label: string; flag: string; scene: readonly string[] }[] };
}
