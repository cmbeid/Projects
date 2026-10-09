import type { Feature, JobId, LineId, ModTarget, ResId } from '../data/types';

/** One plot of land on the skyline: empty, or a building of some line, built in some era. */
export interface Plot {
  line: LineId;
  era: number;
}

export interface WonderProgress {
  /** Stages finished. */
  done: number;
  /** Seconds left on the stage being built, or 0 if none is under way. */
  left: number;
}

export interface Modifier {
  label: string;
  target: ModTarget;
  x: number;
  left: number;
}

export interface LogEntry {
  year: number;
  era: number;
  text: string;
}

export interface PendingEvent {
  id: string;
  left: number;
}

export interface World {
  name: string;
  traits: string[];
  /** 0 for the home world, then one more for every launch. */
  number: number;
}

export interface GameState {
  version: number;
  seed: number;
  rng: number;
  savedAt: number;

  era: number;
  /** Seconds since the era began; drives the calendar. */
  eraTime: number;
  /** Seconds played on this world. */
  runTime: number;

  res: Record<ResId, number>;
  pop: number;
  jobs: Record<JobId, number>;
  plots: (Plot | null)[];

  techs: string[];
  queue: string[];
  wonders: Record<string, WonderProgress>;

  modifiers: Modifier[];
  festival: number;
  /** Festivals held this era; each one costs more. */
  festivals: number;

  chronicle: {
    next: number;
    pending: PendingEvent | null;
    log: LogEntry[];
    /** Recent events, so the same one does not come round again too soon. */
    recent: string[];
  };

  world: World;
  /** Worlds on offer once the colony ship is finished; null until then. */
  offers: World[] | null;

  heritage: {
    points: number;
    earned: number;
    nodes: string[];
  };

  features: Feature[];

  settings: {
    sfx: number;
    music: number;
    muted: boolean;
    autoAssign: boolean;
    /** Jobs the auto-assigner fills first. */
    priority: JobId[];
  };

  stats: {
    totalTime: number;
    built: number;
    modernized: number;
    events: number;
    launches: number;
    peakPop: number;
    /** Highest era reached on any world. */
    bestEra: number;
  };
}
