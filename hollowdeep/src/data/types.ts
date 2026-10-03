/**
 * The shapes of the game's content. Everything in `src/data/` is plain data
 * typed against these, so `scripts/validate-data.ts` can walk the whole graph
 * — every ore reachable, every recipe craftable, every mission completable —
 * without running the game.
 */

export type BiomeId = 'topsoil' | 'fungal' | 'crystal' | 'magma' | 'hollow';
export type HazardKind = 'none' | 'spore' | 'brittle' | 'heat' | 'dark';

/** Three shades, darkest first. Sprites built from a material use all three. */
export type Shades = readonly [string, string, string];

export interface MusicParams {
  /** MIDI note of the tonic. */
  root: number;
  /** Semitone offsets of the scale the melody walks. */
  scale: readonly number[];
  /** Seconds per beat. Everything is slow; this only ranges from slow to slower. */
  beat: number;
  /** Lowpass cutoff on the pads, in Hz. Lower is murkier. */
  filter: number;
  /** 0–1: how often a melody note is bent onto a tense interval instead. */
  unease: number;
  /** Semitones above the root for the second drone voice (7 = a fifth, 6 = a tritone). */
  droneInterval: number;
}

export interface Biome {
  id: BiomeId;
  name: string;
  /** First depth of the biome; it runs until the next biome's `from`. */
  from: number;
  hazard: HazardKind;
  blurb: string;
  /** Rock: outline, dark, mid, light. */
  rock: readonly [string, string, string, string];
  /** Scene backdrop, top to bottom. */
  sky: readonly [string, string];
  /** Particle and glow tint. */
  glow: string;
  ores: readonly { id: string; weight: number }[];
  gems: readonly string[];
  essence: string;
  music: MusicParams;
}

export type MaterialKind = 'ore' | 'gem' | 'bar' | 'essence';

export interface Material {
  id: string;
  name: string;
  kind: MaterialKind;
  /** Coin per unit when sold. */
  value: number;
  shades: Shades;
  /** Ores only: which vein overlay paints the rock face. */
  vein?: 'speckle' | 'streak' | 'cluster';
}

export type Slot = 'pick' | 'lantern' | 'armor' | 'charm';

export type StatKey =
  | 'dmgPct'
  | 'critChance'
  | 'critMult'
  | 'luck'
  | 'light'
  | 'heatRes'
  | 'stamina'
  | 'autoPct'
  | 'xpPct'
  | 'orePct';

export interface GearBase {
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

export type Requirement = { depth: number } | { mission: string };

export interface RefineRecipe {
  id: string;
  output: string;
  inputs: readonly Stack[];
  seconds: number;
  requires: Requirement;
}

export type ConsumableId = 'dynamite' | 'tonic' | 'luckbrew' | 'sagebrew';
export type FixtureId = 'filters' | 'coolant' | 'chute' | 'furnace2' | 'furnace3' | 'lens' | 'workshop';

export type CraftOutput =
  | { kind: 'gear'; base: string }
  | { kind: 'consumable'; id: ConsumableId; n: number }
  | { kind: 'fixture'; id: FixtureId };

export interface CraftRecipe {
  id: string;
  output: CraftOutput;
  inputs: readonly Stack[];
  coins: number;
  requires: Requirement;
}

export type Feature =
  | 'upgrades'
  | 'drones'
  | 'miner'
  | 'refinery'
  | 'workbench'
  | 'power'
  | 'dowse'
  | 'frenzy'
  | 'rig'
  | 'excavator'
  | 'passives'
  | 'contracts'
  | 'descent';

export type Goal =
  | { kind: 'depth'; n: number }
  | { kind: 'level'; n: number }
  | { kind: 'breaks'; n: number }
  | { kind: 'mine'; ore: string; n: number }
  | { kind: 'gems'; n: number }
  | { kind: 'earn'; n: number }
  | { kind: 'upgrade'; id: string; n: number }
  | { kind: 'own'; id: string; n: number }
  | { kind: 'refine'; n: number; bar?: string }
  | { kind: 'craft'; n: number; recipe?: string }
  | { kind: 'skill'; n: number; skill?: string }
  | { kind: 'stats'; n: number }
  | { kind: 'fixture'; id: FixtureId }
  | { kind: 'descend'; n: number };

export interface Reward {
  coins?: number;
  xp?: number;
  unlock?: readonly Feature[];
  items?: readonly Stack[];
  consumables?: readonly { id: ConsumableId; n: number }[];
}

export interface Mission {
  id: string;
  title: string;
  /** One or two lines of flavour, in the miner's voice. */
  text: string;
  goal: Goal;
  reward: Reward;
}
