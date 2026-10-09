import { LINE, LINE_IDS } from '../data/buildings';
import { EVENT } from '../data/chronicle';
import { ERAS } from '../data/eras';
import { HERITAGE } from '../data/heritage';
import { RESOURCE } from '../data/resources';
import { TECHS } from '../data/techs';
import type { Bundle, LineId, ResId } from '../data/types';
import { WONDERS } from '../data/wonders';
import type { GameState } from '../state/types';
import {
  autoAssign,
  build,
  buildCost,
  bundleTotal,
  canAfford,
  currentTier,
  demolish,
  freePlots,
  modernize,
  modernizeCost,
  oldestOutdated,
} from './city';
import { answer, canChoose } from './chronicle';
import { buyNode, canBuyNode, launch } from './colony';
import { derive, type Derived } from './derive';
import { tick } from './engine';
import { hasFeature } from './features';
import {
  advance,
  festivalCost,
  goalMet,
  holdFestival,
  research,
  startStage,
  techAvailable,
  techCost,
  wonderComplete,
  wonderOpen,
  wonderStageCost,
  wonderState,
} from './progress';

/**
 * A player who never plans ahead. Once a second it answers whatever the
 * Chronicle asks (first answer if it can pay), advances the era when it can,
 * researches the cheapest tech, starts wonder stages, modernizes, and builds
 * whatever is most obviously short — food, homes, storage, then any job
 * whose slots are full. Everything else it leaves to the auto-assigner, or,
 * before the Census, does the same by hand.
 *
 * `tests/bot.test.ts` holds the game to the milestones this bot reaches.
 */

export interface BotReport {
  log: string[];
  eraAt: number[];
  launches: number;
}

const WORK_ORDER: readonly LineId[] = ['study', 'lumber', 'quarry', 'mine', 'market', 'shrine', 'works', 'well', 'server', 'fab'];

function overCap(cost: Bundle, d: Derived): ResId | null {
  for (const [r, n] of Object.entries(cost) as [ResId, number][]) if (RESOURCE.get(r)!.capped && n > d.caps[r] * 0.95) return r;
  return null;
}

function wantedLines(s: GameState, d: Derived): LineId[] {
  const want: LineId[] = [];
  const era = ERAS[s.era]!;
  const add = (l: LineId): void => {
    if (!want.includes(l) && currentTier(s, l)) want.push(l);
  };
  // Goals ask for buildings of this era.
  for (const g of era.goals) if (g.k === 'line' && !goalMet(s, g, d)) add(g.line);
  const foodShort = d.net.food < Math.max(0.2, d.eat * 0.1);
  if (foodShort && d.jobs.farmer.workers >= d.jobs.farmer.slots - 1) add('farm');
  if (s.pop >= d.housing - 1) add('home');
  if (d.power.demand > d.power.supply * 0.9) add('power');
  for (const l of WORK_ORDER) {
    const tier = currentTier(s, l);
    if (!tier) continue;
    const job = d.jobs[l === 'study' ? 'scholar' : l === 'lumber' ? 'woodcutter' : l === 'quarry' ? 'quarrier' : l === 'mine' ? 'miner' : l === 'market' ? 'merchant' : l === 'shrine' ? 'artist' : l === 'works' ? 'smith' : l === 'well' ? 'driller' : l === 'server' ? 'coder' : 'fabricator'];
    if (job.workers >= job.slots) add(l);
  }
  if (!want.includes('farm') && d.jobs.farmer.workers >= d.jobs.farmer.slots && d.net.food < d.eat * 0.5) add('farm');
  // Storage when something we want will not fit, or the stores are brimming.
  for (const l of want) {
    const cost = buildCost(s, l, d);
    if (cost && overCap(cost, d)) {
      add('store');
      break;
    }
  }
  for (const id of WONDERS.filter((w) => wonderOpen(s, w) && !wonderComplete(s, w)).map((w) => w.id)) {
    const cost = wonderStageCost(s, WONDERS.find((w) => w.id === id)!, d);
    if (cost && overCap(cost, d)) add('store');
  }
  const next = ERAS[s.era]!.advanceCost;
  if (overCap(next, d)) add('store');
  return want;
}

function botJobs(s: GameState, d: Derived): void {
  // Start everyone afresh and let the assigner place them: a bot does not mind the paperwork.
  for (const id of Object.keys(s.jobs) as (keyof typeof s.jobs)[]) s.jobs[id] = 0;
  autoAssign(s, derive(s));
  void d;
  // Never starve for the sake of a library.
  const fresh = derive(s);
  if (fresh.net.food < 0 && s.res.food < fresh.caps.food * 0.2) {
    let short = Math.ceil(-fresh.net.food / 0.45) + 1;
    for (const id of ['artist', 'scholar', 'merchant', 'quarrier', 'woodcutter'] as const) {
      const take = Math.min(short, s.jobs[id]);
      s.jobs[id] -= take;
      s.jobs.forager += take;
      short -= take;
      if (short <= 0) break;
    }
  }
}

/**
 * Out of land: pull something down, but only for storage or a goal, and only
 * a building that is outdated or standing half empty — never churn.
 */
function clearRoom(s: GameState, d: Derived, want: readonly LineId[]): boolean {
  const goals = ERAS[s.era]!.goals.flatMap((g) => (g.k === 'line' && !goalMet(s, g, d) ? [g.line] : []));
  const target = want.find((l) => {
    if (l !== 'store' && !goals.includes(l)) return false;
    const cost = buildCost(s, l, d);
    return cost && !overCap(cost, d) && canAfford(s, cost);
  });
  if (!target) return false;
  let worst: LineId | null = null;
  let score = -Infinity;
  for (const l of LINE_IDS) {
    if (l === target || l === 'home' || l === 'store' || d.units[l] <= 1) continue;
    let oldest = Infinity;
    for (const p of s.plots) if (p?.line === l) oldest = Math.min(oldest, p.era);
    const job = LINE.get(l)!.job;
    const spare = job ? d.jobs[job].slots - d.jobs[job].workers : 0;
    if (oldest >= s.era && spare <= 0) continue;
    const v = (s.era - oldest) * 3 + spare;
    if (v > score) {
      score = v;
      worst = l;
    }
  }
  return worst !== null && demolish(s, worst);
}

export function botStep(s: GameState): void {
  let d = derive(s);
  const p = s.chronicle.pending;
  if (p) {
    const def = EVENT.get(p.id)!;
    answer(s, canChoose(s, def.choices[0], d) ? 0 : 1, d);
  }
  if (s.offers) {
    launch(s, 0);
    for (const n of [...HERITAGE].sort((a, b) => a.cost - b.cost)) if (canBuyNode(s, n.id)) buyNode(s, n.id);
    return;
  }
  if (advance(s, d)) d = derive(s);

  const techs = TECHS.filter((t) => techAvailable(s, t)).sort((a, b) => bundleTotal(techCost(s, a, d)) - bundleTotal(techCost(s, b, d)));
  for (const t of techs) if (research(s, t.id, d)) d = derive(s);

  for (const w of [...WONDERS].sort((a, b) => Number(b.required) - Number(a.required))) {
    if (!wonderOpen(s, w) || wonderComplete(s, w) || wonderState(s, w.id).left > 0) continue;
    if (startStage(s, w.id)) d = derive(s);
    else if (w.required) break; // save up for the one the era needs
  }

  if (hasFeature(s, 'festival') && s.res.culture > festivalCost(s) * 3) holdFestival(s, d);

  for (const l of LINE_IDS) {
    if (oldestOutdated(s, l) < 0) continue;
    const cost = modernizeCost(s, l, d);
    if (cost && canAfford(s, cost) && bundleTotal(cost) < bundleTotal(s.res as Bundle) * 0.5) modernize(s, l);
  }

  // Build the cheapest thing that is wanted, or wait for it.
  for (let i = 0; i < 4; i++) {
    d = derive(s);
    const want = wantedLines(s, d);
    if (freePlots(s).length === 0) {
      // Out of land: pull down the oldest building of the most crowded workplace line to make room.
      if (want.length === 0 || !clearRoom(s, d, want)) break;
      d = derive(s);
    }
    let best: LineId | null = null;
    let bestCost = Infinity;
    for (const l of want) {
      const cost = buildCost(s, l, d);
      if (!cost || overCap(cost, d) || !canAfford(s, cost)) continue;
      const total = bundleTotal(cost);
      if (total < bestCost) {
        bestCost = total;
        best = l;
      }
    }
    if (!best || !build(s, best)) break;
  }

  botJobs(s, derive(s));
}

/** Plays `seconds` of game time, a decision a second. */
export function runBot(s: GameState, seconds: number, step = 1): BotReport {
  const report: BotReport = { log: [], eraAt: [0], launches: 0 };
  let era = s.era;
  let launches = s.stats.launches;
  for (let t = 0; t < seconds; t += step) {
    botStep(s);
    tick(s, step);
    if (s.stats.launches !== launches) {
      launches = s.stats.launches;
      report.launches += 1;
      report.log.push(`${(t / 3600).toFixed(2)}h launched to ${s.world.name} (${s.world.traits.join(', ') || 'no traits'}), heritage ${s.heritage.earned}`);
      era = s.era;
    }
    if (s.era !== era) {
      era = s.era;
      report.eraAt[era] = report.eraAt[era] ?? t;
      report.log.push(`${(t / 3600).toFixed(2)}h ${ERAS[era]!.name}: pop ${Math.floor(s.pop)}, plots ${s.plots.filter(Boolean).length}/${s.plots.length}`);
    }
  }
  return report;
}
