/**
 * The shapes of the game's content. Everything in `src/data` is plain typed
 * data; the simulation in `src/game` reads it and never the other way round.
 */

export type ResId =
  | 'food'
  | 'wood'
  | 'stone'
  | 'metal'
  | 'knowledge'
  | 'culture'
  | 'gold'
  | 'coal'
  | 'steel'
  | 'oil'
  | 'data'
  | 'alloy';

export type JobId =
  | 'forager'
  | 'farmer'
  | 'woodcutter'
  | 'quarrier'
  | 'miner'
  | 'scholar'
  | 'artist'
  | 'merchant'
  | 'smith'
  | 'driller'
  | 'coder'
  | 'fabricator';

export type LineId =
  | 'home'
  | 'farm'
  | 'lumber'
  | 'quarry'
  | 'mine'
  | 'store'
  | 'study'
  | 'shrine'
  | 'market'
  | 'works'
  | 'power'
  | 'well'
  | 'server'
  | 'fab';

export type Bundle = Partial<Record<ResId, number>>;

export type Feature =
  | 'jobs'
  | 'research'
  | 'wonders'
  | 'chronicle'
  | 'festival'
  | 'autoAssign'
  | 'queue'
  | 'modernizeAll'
  | 'heritage';

/** What a tech, a wonder, a Heritage node or a planet does while it holds. */
export type Effect =
  /** More land on the skyline. */
  | { k: 'plots'; n: number }
  /** +x to one job's output (additive with other bonuses to that job). */
  | { k: 'job'; job: JobId; x: number }
  /** +x to every job's output. */
  | { k: 'all'; x: number }
  /** +x to storage caps. */
  | { k: 'cap'; x: number }
  /** +x to the birth rate. */
  | { k: 'growth'; x: number }
  /** Flat stability points. */
  | { k: 'stability'; n: number }
  /** −x to what each citizen eats. */
  | { k: 'eat'; x: number }
  /** −x to building costs (multiplicative with each other, never below 10%). */
  | { k: 'cost'; x: number }
  /** −x to research costs. */
  | { k: 'research'; x: number }
  /** +x to wonder construction speed. */
  | { k: 'wonderSpeed'; x: number }
  /** +x to housing in every home. */
  | { k: 'housing'; x: number }
  /** +x to the slots in every workplace. */
  | { k: 'slots'; x: number }
  /** +n hours of time away that counts. */
  | { k: 'offline'; n: number }
  /** +x to festival length. */
  | { k: 'festival'; x: number }
  /** Turns on a system or a convenience. */
  | { k: 'feature'; f: Feature }
  /** A new run starts with this much of everything the Stone Age uses, ×n. */
  | { k: 'stash'; n: number }
  /** A new run starts with this many citizens. */
  | { k: 'startPop'; n: number }
  /** A new run starts with the first n Stone Age techs known. */
  | { k: 'startTechs'; n: number }
  /** +x to Heritage earned at launch. */
  | { k: 'heritageGain'; x: number }
  /** −x to the time between Chronicle events. */
  | { k: 'eventRate'; x: number };

/** Parameters for an era's score. See `src/audio/song.ts`. */
export interface EraSong {
  bpm: number;
  /** Beats in a bar. */
  meter: 3 | 4 | 5 | 6 | 7;
  /** MIDI note of the tonic, in the melody's octave. */
  key: number;
  /** The mode, as semitones above the tonic (five or seven notes). */
  scale: readonly number[];
  /** A chord root a bar, as scale degrees, eight bars. */
  progression: readonly number[];
  /** The melody's seed: scale steps from the chord's root. */
  motif: readonly number[];
  /** Who plays: one ensemble per era, each with its own voices. */
  ensemble: Ensemble;
}

export type Ensemble = 'stone' | 'bronze' | 'classical' | 'medieval' | 'renaissance' | 'industrial' | 'modern' | 'space';

export interface EraDef {
  index: number;
  id: string;
  name: string;
  /** Calendar years the era spans, negative for BCE. */
  years: readonly [number, number];
  blurb: string;
  /** What the advance costs, besides the goals. */
  advanceCost: Bundle;
  goals: readonly Goal[];
  /** Scene colours. */
  sky: readonly [string, string];
  ground: readonly [string, string];
  road: string;
  hills: readonly [string, string];
  song: EraSong;
}

export type Goal =
  | { k: 'pop'; n: number }
  | { k: 'techs'; n: number }
  | { k: 'wonder'; id: string }
  | { k: 'line'; line: LineId; n: number }
  | { k: 'stability'; n: number }
  | { k: 'res'; r: ResId; n: number };

export interface ResourceDef {
  id: ResId;
  name: string;
  /** The era it first matters in. */
  era: number;
  /** Physical goods sit in storehouses and have a cap; ideas, art and money do not. */
  capped: boolean;
  /** Icon colours: dark, mid, light. */
  shades: readonly [string, string, string];
}

export interface JobDef {
  id: JobId;
  name: string;
  plural: string;
  era: number;
  /** The building line whose units hold this job's slots; null means anyone can do it, anywhere. */
  line: LineId | null;
  /** Per worker per second, at productivity 1. */
  makes: Bundle;
  /** Per worker per second, at productivity 1. */
  uses: Bundle;
  /** Power each worker draws, in the eras that have a grid. */
  power: number;
  blurb: string;
}

export interface TierDef {
  /** The era this tier is built in. */
  era: number;
  name: string;
  blurb: string;
  /** Base price; scaled by 1.15 per unit of the line already standing. */
  cost: Bundle;
  /** Citizens it houses. */
  housing: number;
  /** Job slots it holds. */
  slots: number;
  /** How much a worker in one of its slots produces, relative to tier 0. */
  prod: number;
  /** Storage it adds to every capped resource. */
  cap: number;
  /** Stability it adds. */
  stability: number;
  /** Power it supplies to the grid. */
  power: number;
  /** What it burns a second to do so. */
  fuel: Bundle;
  /** A tech it waits on, beyond reaching its era. */
  tech?: string;
}

export interface LineDef {
  id: LineId;
  name: string;
  job: JobId | null;
  /** One tier per era from `tiers[0].era` on. */
  tiers: readonly TierDef[];
}

export interface TechDef {
  id: string;
  name: string;
  era: number;
  cost: Bundle;
  requires: readonly string[];
  effects: readonly Effect[];
  blurb: string;
}

export interface WonderDef {
  id: string;
  name: string;
  era: number;
  /** The one the era's goals ask for. */
  required: boolean;
  blurb: string;
  /** Each stage's price, paid when it starts. */
  stages: readonly Bundle[];
  /** Seconds each stage takes once paid for. */
  stageTime: number;
  effects: readonly Effect[];
  /** Sprite size in pixels. */
  w: number;
  h: number;
  /** Where it stands on the far bank, 0–1 across the skyline. */
  at: number;
  tech?: string;
}

/** What one side of a Chronicle event does. Amounts scale with the city, as seconds of its own output. */
export type Outcome =
  | { k: 'gain'; r: ResId; secs: number }
  | { k: 'lose'; r: ResId; pct: number }
  | { k: 'pop'; pct: number }
  | { k: 'mod'; label: string; target: ModTarget; x: number; secs: number }
  | { k: 'insight'; secs: number };

export type ModTarget = JobId | 'all' | 'growth' | 'stability';

export interface ChoiceDef {
  label: string;
  /** Paid up front, as seconds of the city's own output of each resource. */
  pay?: readonly { r: ResId; secs: number }[];
  outcomes: readonly Outcome[];
  /** What the history book says about it. */
  log: string;
}

export interface EventDef {
  id: string;
  /** Eras it can happen in, inclusive. */
  eras: readonly [number, number];
  title: string;
  text: string;
  choices: readonly [ChoiceDef, ChoiceDef];
  /** The one taken if nobody answers. */
  fallback: 0 | 1;
}

export interface TraitDef {
  id: string;
  name: string;
  blurb: string;
  effects: readonly Effect[];
  /** Tints the sky and ground of a world that has it. */
  tint?: string;
}

export interface HeritageNode {
  id: string;
  name: string;
  cost: number;
  requires: readonly string[];
  effects: readonly Effect[];
  blurb: string;
}
