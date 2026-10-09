import { LINE, tierFor } from '../data/buildings';
import { COST_GROWTH, MODERNIZE_SHARE } from '../data/progression';
import { JOB, JOBS } from '../data/resources';
import type { Bundle, JobId, LineId, ResId, TierDef } from '../data/types';
import type { GameState } from '../state/types';
import { derive, plotsTotal, bonusesOf, activeEffects, type Derived } from './derive';
import { emit } from './events';
import { rand } from './rng';

/**
 * The verbs of the city: build, modernize, pull down, and put people to
 * work. Buildings go on a random empty plot so the skyline grows like a real
 * town, not a sorted list; modernizing rebuilds the oldest one in place.
 */

export function canAfford(s: GameState, cost: Bundle): boolean {
  for (const [r, n] of Object.entries(cost) as [ResId, number][]) if (s.res[r] < n) return false;
  return true;
}

export function pay(s: GameState, cost: Bundle): void {
  for (const [r, n] of Object.entries(cost) as [ResId, number][]) s.res[r] = Math.max(0, s.res[r] - n);
}

export function scale(cost: Bundle, k: number): Bundle {
  const out: Bundle = {};
  for (const [r, n] of Object.entries(cost) as [ResId, number][]) out[r] = Math.ceil(n * k);
  return out;
}

export function bundleTotal(cost: Bundle): number {
  let t = 0;
  for (const n of Object.values(cost)) t += n ?? 0;
  return t;
}

/** The tier this line builds now, if it can be built at all. */
export function currentTier(s: GameState, line: LineId): TierDef | undefined {
  const t = tierFor(LINE.get(line)!, s.era);
  if (!t) return undefined;
  if (t.tech && !s.techs.includes(t.tech)) return undefined;
  return t;
}

export function countLine(s: GameState, line: LineId): number {
  let n = 0;
  for (const p of s.plots) if (p?.line === line) n += 1;
  return n;
}

export function buildCost(s: GameState, line: LineId, d?: Derived): Bundle | null {
  const t = currentTier(s, line);
  if (!t) return null;
  const costMult = (d ?? derive(s)).bonuses.cost;
  return scale(t.cost, COST_GROWTH ** countLine(s, line) * costMult);
}

/** Makes sure the plot array is as long as the land the city has. */
export function syncPlots(s: GameState, total?: number): void {
  const n = total ?? plotsTotal(s, bonusesOf(activeEffects(s)));
  while (s.plots.length < n) s.plots.push(null);
}

export function freePlots(s: GameState): number[] {
  const out: number[] = [];
  s.plots.forEach((p, i) => {
    if (!p) out.push(i);
  });
  return out;
}

export type BuildBlock = 'tier' | 'land' | 'cost' | null;

export function buildBlock(s: GameState, line: LineId, d?: Derived): BuildBlock {
  const cost = buildCost(s, line, d);
  if (!cost) return 'tier';
  syncPlots(s);
  if (freePlots(s).length === 0) return 'land';
  if (!canAfford(s, cost)) return 'cost';
  return null;
}

export function build(s: GameState, line: LineId): boolean {
  const d = derive(s);
  if (buildBlock(s, line, d) !== null) return false;
  const cost = buildCost(s, line, d)!;
  const t = currentTier(s, line)!;
  pay(s, cost);
  const free = freePlots(s);
  const plot = free[Math.floor(rand(s) * free.length)]!;
  s.plots[plot] = { line, era: t.era };
  s.stats.built += 1;
  emit({ type: 'build', line, plot, price: bundleTotal(cost) });
  return true;
}

/** The plot holding this line's oldest building that is older than the tier it would be rebuilt as. */
export function oldestOutdated(s: GameState, line: LineId): number {
  const t = currentTier(s, line);
  if (!t) return -1;
  let best = -1;
  s.plots.forEach((p, i) => {
    if (p?.line === line && p.era < t.era && (best < 0 || p.era < s.plots[best]!.era)) best = i;
  });
  return best;
}

export function outdatedCount(s: GameState, line: LineId): number {
  const t = currentTier(s, line);
  if (!t) return 0;
  let n = 0;
  for (const p of s.plots) if (p?.line === line && p.era < t.era) n += 1;
  return n;
}

/** Modernizing does not make the line dearer: it costs a share of the price of a new one. */
export function modernizeCost(s: GameState, line: LineId, d?: Derived): Bundle | null {
  const t = currentTier(s, line);
  if (!t) return null;
  const costMult = (d ?? derive(s)).bonuses.cost;
  const count = Math.max(0, countLine(s, line) - 1);
  return scale(t.cost, MODERNIZE_SHARE * COST_GROWTH ** count * costMult);
}

export function modernize(s: GameState, line: LineId): boolean {
  const plot = oldestOutdated(s, line);
  if (plot < 0) return false;
  const cost = modernizeCost(s, line);
  if (!cost || !canAfford(s, cost)) return false;
  pay(s, cost);
  s.plots[plot] = { line, era: currentTier(s, line)!.era };
  s.stats.modernized += 1;
  emit({ type: 'modernize', line, plot });
  return true;
}

/** Modernizes as many as can be afforded; returns how many. */
export function modernizeAll(s: GameState, line: LineId): number {
  let n = 0;
  while (modernize(s, line)) n += 1;
  return n;
}

/** Pulls down the line's oldest building. Nothing comes back but the land. */
export function demolish(s: GameState, line: LineId): boolean {
  let best = -1;
  s.plots.forEach((p, i) => {
    if (p?.line === line && (best < 0 || p.era < s.plots[best]!.era)) best = i;
  });
  if (best < 0) return false;
  s.plots[best] = null;
  emit({ type: 'demolish', line, plot: best });
  fixJobs(s);
  return true;
}

// --- Jobs ------------------------------------------------------------------------

export function assigned(s: GameState): number {
  let n = 0;
  for (const j of JOBS) n += s.jobs[j.id];
  return n;
}

export function idle(s: GameState): number {
  return Math.max(0, Math.floor(s.pop) - assigned(s));
}

export function jobOpen(s: GameState, job: JobId, d?: Derived): boolean {
  const def = JOB.get(job)!;
  if (def.era > s.era) return false;
  const info = (d ?? derive(s)).jobs[job];
  return info.workers < info.slots;
}

/** Moves up to n people into (n > 0) or out of (n < 0) a job. Returns how many moved. */
export function assign(s: GameState, job: JobId, n: number, d?: Derived): number {
  if (n < 0) {
    const take = Math.min(s.jobs[job], -n);
    s.jobs[job] -= take;
    return -take;
  }
  const def = JOB.get(job)!;
  if (def.era > s.era) return 0;
  const info = (d ?? derive(s)).jobs[job];
  const room = info.slots === Infinity ? Infinity : Math.max(0, info.slots - s.jobs[job]);
  const give = Math.min(n, idle(s), room);
  s.jobs[job] += give;
  return give;
}

/** Keeps jobs within the slots and the people there are. */
export function fixJobs(s: GameState, d?: Derived): void {
  const info = d ?? derive(s);
  for (const j of JOBS) {
    if (j.line !== null && s.jobs[j.id] > info.jobs[j.id].slots) s.jobs[j.id] = info.jobs[j.id].slots;
  }
  let over = assigned(s) - Math.floor(s.pop);
  // Lay off the people furthest down the priority list first; foragers go before anyone.
  const order = [...JOBS.map((j) => j.id)].reverse();
  order.sort((a, b) => (a === 'forager' ? -1 : b === 'forager' ? 1 : 0));
  for (const id of order) {
    if (over <= 0) break;
    const take = Math.min(s.jobs[id], over);
    s.jobs[id] -= take;
    over -= take;
  }
}

/**
 * Puts idle people to work. Farms come first, until the city grows enough
 * to eat with a little to spare; then jobs on the priority list; then any
 * open slot, spread evenly; and foragers last of all.
 */
export function autoAssign(s: GameState, d: Derived): void {
  let free = idle(s);
  if (free <= 0) return;
  const open = (id: JobId): number => {
    const def = JOB.get(id)!;
    if (def.era > s.era || id === 'forager') return 0;
    return Math.max(0, d.jobs[id].slots - s.jobs[id]);
  };
  // Enough farmers to feed everyone, counting what the foragers already bring in.
  const farm = d.jobs.farmer;
  const perFarmer = (farm.workers > 0 ? farm.prod / farm.workers : farm.nextProd) * farm.mult;
  if (perFarmer > 0) {
    const fromOthers = d.gross.food - (farm.makes.food ?? 0);
    const want = Math.ceil(Math.max(0, d.eat * 1.15 - fromOthers) / perFarmer);
    const n = Math.min(free, open('farmer'), Math.max(0, want - s.jobs.farmer));
    s.jobs.farmer += n;
    free -= n;
  }
  for (const id of s.settings.priority) {
    const n = Math.min(free, open(id));
    s.jobs[id] += n;
    free -= n;
  }
  const rest = JOBS.map((j) => j.id).filter((id) => id !== 'forager');
  let moved = true;
  while (free > 0 && moved) {
    moved = false;
    for (const id of rest) {
      if (free > 0 && open(id) > 0) {
        s.jobs[id] += 1;
        free -= 1;
        moved = true;
      }
    }
  }
  s.jobs.forager += free;
}
