import { ERAS } from '../data/eras';
import { STARVE_RATE, EAT } from '../data/progression';
import { JOBS, RES_IDS } from '../data/resources';
import { TECHS } from '../data/techs';
import type { Feature, ResId } from '../data/types';
import type { GameState, World } from '../state/types';
import { autoAssign, fixJobs, syncPlots } from './city';
import { tickChronicle, tickModifiers, nextGap } from './chronicle';
import { bonusesOf, derive, heritageEffects, type Derived } from './derive';
import { emit } from './events';
import { hasFeature } from './features';
import { checkShip } from './colony';
import { learn, log, runQueue, tickWonders } from './progress';

export const SAVE_VERSION = 1;

const BASE_FEATURES: Feature[] = ['jobs', 'research'];

export const HOME_WORLD: World = { name: 'Home', traits: [], number: 0 };

function zero<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
}

export function newGame(seed: number, now = 0): GameState {
  const s: GameState = {
    version: SAVE_VERSION,
    seed,
    rng: seed,
    savedAt: now,
    era: 0,
    eraTime: 0,
    runTime: 0,
    res: zero(RES_IDS),
    pop: 0,
    jobs: zero(JOBS.map((j) => j.id)),
    plots: [],
    techs: [],
    queue: [],
    wonders: {},
    modifiers: [],
    festival: 0,
    festivals: 0,
    chronicle: { next: 0, pending: null, log: [], recent: [] },
    world: { ...HOME_WORLD },
    offers: null,
    heritage: { points: 0, earned: 0, nodes: [] },
    features: [...BASE_FEATURES],
    settings: { sfx: 70, music: 50, muted: false, autoAssign: true, priority: [] },
    stats: { totalTime: 0, built: 0, modernized: 0, events: 0, launches: 0, peakPop: 0, bestEra: 0 },
  };
  startRun(s);
  return s;
}

/**
 * Clears the city for a fresh start on `s.world`, keeping Heritage, the
 * settings and the lifetime stats. Used by a new game and by every launch.
 */
export function startRun(s: GameState): void {
  const b = bonusesOf(heritageEffects(s));
  s.era = 0;
  s.eraTime = 0;
  s.runTime = 0;
  s.res = zero(RES_IDS);
  const stash = 1 + b.stash;
  s.res.food = 30 * stash;
  s.res.wood = 15 * stash;
  s.res.stone = 8 * stash;
  s.pop = 4 + b.startPop;
  s.jobs = zero(JOBS.map((j) => j.id));
  s.jobs.forager = Math.floor(s.pop);
  s.plots = [];
  s.techs = [];
  s.queue = [];
  s.wonders = {};
  s.modifiers = [];
  s.festival = 0;
  s.festivals = 0;
  s.offers = null;
  s.features = [...BASE_FEATURES, ...b.features];
  s.chronicle = { next: 0, pending: null, log: [], recent: [] };
  // Heritage can teach the first few techs; they cost nothing.
  for (const t of TECHS.filter((x) => x.era === 0).slice(0, b.startTechs)) learn(s, t);
  syncPlots(s);
  const d = derive(s);
  s.chronicle.next = nextGap(s, d) * 0.5;
  s.chronicle.log = [];
  log(s, s.world.number === 0 ? 'lit a fire on the riverbank' : `landed on ${s.world.name} and lit a fire`);
}

export interface TickOptions {
  /** Chronicle events fire only while someone is watching. */
  events: boolean;
}

/** Advances the simulation by dt seconds. */
export function tick(s: GameState, dt: number, opts: TickOptions = { events: true }): Derived {
  syncPlots(s);
  const d = derive(s);

  for (const r of RES_IDS as readonly ResId[]) {
    const next = s.res[r] + d.net[r] * dt;
    s.res[r] = Math.max(0, Math.min(d.caps[r], next));
  }

  // Hunger first, then births.
  const before = Math.floor(s.pop);
  if (s.res.food <= 0 && d.net.food < 0) {
    const short = -d.net.food / (EAT * (1 - d.bonuses.eat));
    s.pop = Math.max(1, s.pop - short * STARVE_RATE * dt);
    if (Math.floor(s.pop) < before) emit({ type: 'starving' });
  } else if (s.pop < d.housing) {
    s.pop = Math.min(d.housing, s.pop + d.growth * dt);
  } else if (s.pop > d.housing) {
    // Homes pulled down: people drift away rather than vanish.
    s.pop = Math.max(d.housing, s.pop - Math.max(0.5, (s.pop - d.housing) * 0.1) * dt);
  }
  const after = Math.floor(s.pop);
  if (after > before) emit({ type: 'born', n: after - before });
  s.stats.peakPop = Math.max(s.stats.peakPop, after);

  fixJobs(s, d);
  if (s.settings.autoAssign && hasFeature(s, 'autoAssign')) autoAssign(s, d);
  else s.jobs.forager += Math.max(0, after - assignedCount(s));

  tickWonders(s, d, dt);
  tickModifiers(s, dt);
  if (opts.events) tickChronicle(s, d, dt);
  runQueue(s, d);
  checkShip(s);

  s.eraTime += dt;
  s.runTime += dt;
  s.stats.totalTime += dt;
  return d;
}

function assignedCount(s: GameState): number {
  let n = 0;
  for (const j of JOBS) n += s.jobs[j.id];
  return n;
}

/** Human-readable name of an era. */
export function eraName(era: number): string {
  return ERAS[era]?.name ?? '';
}
