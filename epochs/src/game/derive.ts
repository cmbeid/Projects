import { LINE, LINES } from '../data/buildings';
import { HERITAGE_NODE, TRAIT } from '../data/heritage';
import {
  BASE_HOUSING,
  BASE_PLOTS,
  ERA_BASE_CAP,
  ERA_PLOTS,
  FESTIVAL_BOOST,
  EAT,
  GROWTH_BASE,
  GROWTH_PER_HOUSING,
  STABILITY_BASE,
  STABILITY_CAP,
  STABILITY_PER_ARTIST,
  STABILITY_SIZE,
} from '../data/progression';
import { JOBS, RES_IDS, RESOURCE } from '../data/resources';
import { TECH } from '../data/techs';
import type { Effect, Feature, JobId, LineId, ResId } from '../data/types';
import { WONDER } from '../data/wonders';
import type { GameState } from '../state/types';

/**
 * Everything the city's numbers follow from, worked out from the state in
 * one pass: bonuses, housing, slots, power, stability and the net rate of
 * every resource. The tick, the panels, the bot and the offline catch-up all
 * read the same `Derived`, so they can never disagree.
 */

export interface Bonuses {
  plots: number;
  job: Record<JobId, number>;
  all: number;
  cap: number;
  growth: number;
  stability: number;
  eat: number;
  cost: number;
  research: number;
  wonderSpeed: number;
  housing: number;
  slots: number;
  offline: number;
  festival: number;
  heritageGain: number;
  eventRate: number;
  stash: number;
  startPop: number;
  startTechs: number;
  features: Feature[];
}

function zeroJobs(): Record<JobId, number> {
  return Object.fromEntries(JOBS.map((j) => [j.id, 0])) as Record<JobId, number>;
}

function zeroRes(): Record<ResId, number> {
  return Object.fromEntries(RES_IDS.map((r) => [r, 0])) as Record<ResId, number>;
}

/** Every effect in force: techs known, wonders finished, Heritage bought and the world's traits. */
export function activeEffects(s: GameState): Effect[] {
  const out: Effect[] = [];
  for (const id of s.techs) out.push(...(TECH.get(id)?.effects ?? []));
  for (const [id, w] of Object.entries(s.wonders)) {
    const def = WONDER.get(id);
    if (def && w.done >= def.stages.length) out.push(...def.effects);
  }
  out.push(...heritageEffects(s));
  for (const t of s.world.traits) out.push(...(TRAIT.get(t)?.effects ?? []));
  return out;
}

export function heritageEffects(s: GameState): Effect[] {
  return s.heritage.nodes.flatMap((id) => HERITAGE_NODE.get(id)?.effects ?? []);
}

export function bonusesOf(effects: readonly Effect[]): Bonuses {
  const b: Bonuses = {
    plots: 0,
    job: zeroJobs(),
    all: 0,
    cap: 0,
    growth: 0,
    stability: 0,
    eat: 0,
    cost: 1,
    research: 1,
    wonderSpeed: 0,
    housing: 0,
    slots: 0,
    offline: 0,
    festival: 0,
    heritageGain: 0,
    eventRate: 0,
    stash: 0,
    startPop: 0,
    startTechs: 0,
    features: [],
  };
  for (const e of effects) {
    switch (e.k) {
      case 'plots': b.plots += e.n; break;
      case 'job': b.job[e.job] += e.x; break;
      case 'all': b.all += e.x; break;
      case 'cap': b.cap += e.x; break;
      case 'growth': b.growth += e.x; break;
      case 'stability': b.stability += e.n; break;
      case 'eat': b.eat += e.x; break;
      case 'cost': b.cost *= 1 - e.x; break;
      case 'research': b.research *= 1 - e.x; break;
      case 'wonderSpeed': b.wonderSpeed += e.x; break;
      case 'housing': b.housing += e.x; break;
      case 'slots': b.slots += e.x; break;
      case 'offline': b.offline += e.n; break;
      case 'festival': b.festival += e.x; break;
      case 'feature': b.features.push(e.f); break;
      case 'stash': b.stash += e.n; break;
      case 'startPop': b.startPop += e.n; break;
      case 'startTechs': b.startTechs += e.n; break;
      case 'heritageGain': b.heritageGain += e.x; break;
      case 'eventRate': b.eventRate += e.x; break;
    }
  }
  b.cost = Math.max(0.1, b.cost);
  b.research = Math.max(0.1, b.research);
  b.eat = Math.min(0.8, b.eat);
  return b;
}

export interface SlotGroup {
  era: number;
  prod: number;
  n: number;
}

export interface JobInfo {
  workers: number;
  slots: number;
  /** Sum of productivity over the workers, best slots first. */
  prod: number;
  /** Productivity the next worker in would get (0 if there is no room). */
  nextProd: number;
  /** Output multiplier from bonuses, stability and festivals. */
  mult: number;
  /** 0–1: how much of the job's power and inputs it is getting. */
  supply: number;
  makes: Partial<Record<ResId, number>>;
  uses: Partial<Record<ResId, number>>;
}

export interface Derived {
  bonuses: Bonuses;
  units: Record<LineId, number>;
  /** Units of a line built in the current era. */
  current: Record<LineId, number>;
  plotsTotal: number;
  plotsUsed: number;
  housing: number;
  jobs: Record<JobId, JobInfo>;
  idle: number;
  power: { supply: number; demand: number; ratio: number };
  gross: Record<ResId, number>;
  spend: Record<ResId, number>;
  net: Record<ResId, number>;
  caps: Record<ResId, number>;
  eat: number;
  stability: number;
  stabilityParts: { label: string; n: number }[];
  stabilityMult: number;
  festival: boolean;
  growth: number;
}

/** Bonus from timed modifiers (events) on one target. */
export function modSum(s: GameState, target: string): number {
  let x = 0;
  for (const m of s.modifiers) if (m.target === target) x += m.x;
  return x;
}

export function plotsTotal(s: GameState, b: Bonuses): number {
  return Math.max(4, BASE_PLOTS + ERA_PLOTS * s.era + b.plots);
}

export function derive(s: GameState): Derived {
  const bonuses = bonusesOf(activeEffects(s));
  const units = {} as Record<LineId, number>;
  const current = {} as Record<LineId, number>;
  for (const l of LINES) {
    units[l.id] = 0;
    current[l.id] = 0;
  }

  let housing = BASE_HOUSING;
  let capAdd = 0;
  let shrineStab = 0;
  let powerSupply = 0;
  const fuelNeed = zeroRes();
  const slotGroups = new Map<JobId, SlotGroup[]>();
  let plotsUsed = 0;

  for (const p of s.plots) {
    if (!p) continue;
    plotsUsed += 1;
    units[p.line] += 1;
    if (p.era === s.era) current[p.line] += 1;
    const line = LINE.get(p.line)!;
    const t = line.tiers.find((x) => x.era === p.era) ?? line.tiers[0]!;
    housing += t.housing * (1 + bonuses.housing);
    capAdd += t.cap;
    shrineStab += t.stability;
    if (t.power > 0) {
      powerSupply += t.power;
      for (const [r, n] of Object.entries(t.fuel) as [ResId, number][]) fuelNeed[r] += n;
    }
    if (line.job && t.slots > 0) {
      const list = slotGroups.get(line.job) ?? [];
      const g = list.find((x) => x.era === p.era);
      if (g) g.n += t.slots;
      else list.push({ era: p.era, prod: t.prod, n: t.slots });
      slotGroups.set(line.job, list);
    }
  }
  housing = Math.floor(housing);

  const caps = zeroRes();
  for (const r of RES_IDS) {
    caps[r] = RESOURCE.get(r)!.capped ? Math.floor((ERA_BASE_CAP[s.era]! + capAdd) * (1 + bonuses.cap)) : Infinity;
  }

  // Stability, before it feeds back into output.
  const pop = Math.floor(s.pop);
  let assigned = 0;
  for (const j of JOBS) assigned += s.jobs[j.id];
  const idle = Math.max(0, pop - assigned);
  const parts: { label: string; n: number }[] = [
    { label: 'Base', n: STABILITY_BASE },
    { label: 'Culture buildings', n: shrineStab },
    { label: 'Artists', n: s.jobs.artist * STABILITY_PER_ARTIST },
    { label: 'Techs, wonders and Heritage', n: bonuses.stability },
    { label: 'Events', n: modSum(s, 'stability') },
    { label: 'City size', n: -STABILITY_SIZE * Math.sqrt(pop) },
    { label: 'Idle hands', n: -Math.min(20, idle * 0.5) },
  ];
  const stability = Math.max(0, parts.reduce((a, p) => a + p.n, 0));
  const stabilityMult = 0.5 + Math.min(stability, STABILITY_CAP) / 200;
  const festival = s.festival > 0;

  // Jobs: fill the best slots first.
  const jobs = {} as Record<JobId, JobInfo>;
  const allMod = bonuses.all + modSum(s, 'all');
  for (const j of JOBS) {
    const workers = s.jobs[j.id];
    let slots = 0;
    let prod = 0;
    let nextProd = 0;
    if (j.line === null) {
      slots = Infinity;
      prod = workers;
      nextProd = 1;
    } else {
      const groups = (slotGroups.get(j.id) ?? []).sort((a, b) => b.prod - a.prod);
      let left = workers;
      for (const g of groups) {
        const n = Math.floor(g.n * (1 + bonuses.slots));
        slots += n;
        const take = Math.min(left, n);
        prod += take * g.prod;
        left -= take;
        if (nextProd === 0 && take < n) nextProd = g.prod;
      }
    }
    const mult = Math.max(0, (1 + allMod + bonuses.job[j.id] + modSum(s, j.id)) * stabilityMult * (festival ? 1 + FESTIVAL_BOOST : 1));
    jobs[j.id] = { workers, slots, prod, nextProd, mult, supply: 1, makes: {}, uses: {} };
  }

  // Power: the grid, if there is one.
  let powerDemand = 0;
  for (const j of JOBS) powerDemand += j.power * Math.min(jobs[j.id].workers, jobs[j.id].slots);

  // First pass: what everything would make with full supply, to judge inputs by.
  const potential = zeroRes();
  for (const j of JOBS) {
    const info = jobs[j.id];
    for (const [r, n] of Object.entries(j.makes) as [ResId, number][]) {
      if (RESOURCE.get(r)!.era > s.era) continue;
      potential[r] += n * info.prod * info.mult;
    }
  }

  // Power stations burn fuel; if the fuel runs dry they run as far as what comes in allows.
  let fuelSupply = 1;
  for (const [r, need] of Object.entries(fuelNeed) as [ResId, number][]) {
    if (need <= 0) continue;
    if (s.res[r] < 1) fuelSupply = Math.min(fuelSupply, potential[r] / need);
  }
  fuelSupply = Math.max(0, Math.min(1, fuelSupply));
  const supplyNow = powerSupply * fuelSupply;
  const powerRatio = powerDemand <= 0 ? 1 : Math.min(1, supplyNow / powerDemand);

  const gross = zeroRes();
  const spend = zeroRes();
  for (const r of RES_IDS) spend[r] += fuelNeed[r] * fuelSupply;

  for (const j of JOBS) {
    const info = jobs[j.id];
    let supply = j.power > 0 ? powerRatio : 1;
    for (const [r, n] of Object.entries(j.uses) as [ResId, number][]) {
      const need = n * info.prod * info.mult;
      if (need > 0 && s.res[r] < 1) supply = Math.min(supply, potential[r] / need);
    }
    supply = Math.max(0, Math.min(1, supply));
    info.supply = supply;
    for (const [r, n] of Object.entries(j.makes) as [ResId, number][]) {
      if (RESOURCE.get(r)!.era > s.era) continue;
      const v = n * info.prod * info.mult * supply;
      info.makes[r] = v;
      gross[r] += v;
    }
    for (const [r, n] of Object.entries(j.uses) as [ResId, number][]) {
      const v = n * info.prod * info.mult * supply;
      info.uses[r] = v;
      spend[r] += v;
    }
  }

  const eat = pop * EAT * (1 - bonuses.eat);
  spend.food += eat;

  const net = zeroRes();
  for (const r of RES_IDS) net[r] = gross[r] - spend[r];

  const growthMult = Math.max(0, 1 + bonuses.growth + modSum(s, 'growth'));
  const growth = (GROWTH_BASE + GROWTH_PER_HOUSING * housing) * growthMult * (stability < 30 ? 0.5 : 1);

  return {
    bonuses,
    units,
    current,
    plotsTotal: plotsTotal(s, bonuses),
    plotsUsed,
    housing,
    jobs,
    idle,
    power: { supply: supplyNow, demand: powerDemand, ratio: powerRatio },
    gross,
    spend,
    net,
    caps,
    eat,
    stability,
    stabilityParts: parts,
    stabilityMult,
    festival,
    growth,
  };
}

/** The job each line staffs, for the panels. */
export function jobOfLine(line: LineId): JobId | null {
  return LINE.get(line)?.job ?? null;
}
