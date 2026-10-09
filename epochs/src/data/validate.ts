import { LINES } from './buildings';
import { EVENTS } from './chronicle';
import { ERAS } from './eras';
import { HERITAGE, HERITAGE_NODE, TRAITS } from './heritage';
import { ERA_BASE_CAP, ERA_MATS, TIER_CAP } from './progression';
import { JOBS, RESOURCE } from './resources';
import { TECH, TECHS } from './techs';
import type { Bundle, ResId } from './types';
import { WONDER, WONDERS } from './wonders';

/**
 * The content graph, checked: every price can be paid with things the city
 * can already make by then, every requirement exists and comes in time,
 * nothing waits on itself, and every era's goals can be met. Returns a list
 * of problems; empty means sound.
 */

/** The era from which a resource is actually produced: a job that makes it, in a line that is standing. */
function producibleFrom(r: ResId): number {
  let best = Infinity;
  for (const j of JOBS) {
    if (!(r in j.makes)) continue;
    let from = Math.max(j.era, RESOURCE.get(r)!.era);
    if (j.line) {
      const line = LINES.find((l) => l.id === j.line)!;
      from = Math.max(from, line.tiers[0]!.era);
    }
    best = Math.min(best, from);
  }
  return best;
}

export function validate(): string[] {
  const problems: string[] = [];
  const checkCost = (what: string, era: number, cost: Bundle): void => {
    for (const r of Object.keys(cost) as ResId[]) {
      if (!RESOURCE.has(r)) problems.push(`${what}: unknown resource ${r}`);
      else if (producibleFrom(r) > era) problems.push(`${what}: costs ${r}, which nothing makes before era ${producibleFrom(r)}`);
    }
  };

  for (const era of ERA_MATS.keys()) {
    for (const r of ERA_MATS[era]!) if (producibleFrom(r) > era) problems.push(`era ${era} prices things in ${r}, which nothing makes yet`);
  }

  for (const l of LINES) {
    l.tiers.forEach((t, i) => {
      if (i > 0 && t.era !== l.tiers[i - 1]!.era + 1) problems.push(`${l.id}: tiers skip an era at ${t.name}`);
      checkCost(`${l.id}/${t.name}`, t.era, t.cost);
      const job = JOBS.find((j) => j.id === l.job);
      if (job) for (const r of Object.keys(job.makes) as ResId[]) if (r in t.cost) problems.push(`${l.id}/${t.name}: costs ${r}, its own product`);
      // The very first of each, no storehouse built, must fit the stores.
      for (const [r, n] of Object.entries(t.cost) as [ResId, number][]) {
        if (RESOURCE.get(r)!.capped && n > ERA_BASE_CAP[t.era]!) problems.push(`${l.id}/${t.name}: ${n} ${r} will not fit an empty city's stores`);
      }
      if (t.tech) {
        const tech = TECH.get(t.tech);
        if (!tech) problems.push(`${l.id}/${t.name}: unknown tech ${t.tech}`);
        else if (tech.era > t.era) problems.push(`${l.id}/${t.name}: waits on ${t.tech} from a later era`);
      }
    });
  }

  const eraCount = new Map<number, number>();
  for (const t of TECHS) {
    eraCount.set(t.era, (eraCount.get(t.era) ?? 0) + 1);
    checkCost(`tech ${t.id}`, t.era, t.cost);
    for (const r of t.requires) {
      const req = TECH.get(r);
      if (!req) problems.push(`tech ${t.id}: unknown requirement ${r}`);
      else if (req.era !== t.era) problems.push(`tech ${t.id}: requires ${r} from another era`);
      else if (TECHS.indexOf(req) > TECHS.indexOf(t)) problems.push(`tech ${t.id}: requires ${r}, listed after it`);
    }
  }
  if (new Set(TECHS.map((t) => t.id)).size !== TECHS.length) problems.push('duplicate tech ids');

  for (const w of WONDERS) {
    w.stages.forEach((st, i) => {
      checkCost(`${w.name} stage ${i + 1}`, w.era, st);
      // Must fit with storage: the era's base plus eight storehouses.
      for (const [r, n] of Object.entries(st) as [ResId, number][]) {
        if (RESOURCE.get(r)!.capped && n > ERA_BASE_CAP[w.era]! + 8 * TIER_CAP[w.era]!) problems.push(`${w.name} stage ${i + 1}: ${n} ${r} will not fit even eight storehouses`);
      }
    });
    if (w.tech) {
      const t = TECH.get(w.tech);
      if (!t) problems.push(`${w.name}: unknown tech ${w.tech}`);
      else if (t.era > w.era) problems.push(`${w.name}: waits on a later era's tech`);
    }
  }

  for (const e of ERAS) {
    const required = WONDERS.filter((w) => w.era === e.index && w.required);
    if (required.length !== 1) problems.push(`${e.name}: has ${required.length} required wonders, wants 1`);
    checkCost(`advance from ${e.name}`, e.index, e.advanceCost);
    for (const g of e.goals) {
      if (g.k === 'wonder' && WONDER.get(g.id)?.era !== e.index) problems.push(`${e.name}: goal wonder ${g.id} is not of this era`);
      if (g.k === 'techs' && g.n > (eraCount.get(e.index) ?? 0)) problems.push(`${e.name}: asks for ${g.n} techs, has ${eraCount.get(e.index)}`);
      if (g.k === 'line' && !LINES.find((l) => l.id === g.line)?.tiers.some((t) => t.era === e.index)) problems.push(`${e.name}: asks for ${g.line} with no tier this era`);
      if (g.k === 'res' && producibleFrom(g.r) > e.index) problems.push(`${e.name}: asks for ${g.r} before it is made`);
    }
  }

  for (const ev of EVENTS) {
    const [a, b] = ev.eras;
    if (a > b || a < 0 || b >= ERAS.length) problems.push(`event ${ev.id}: bad eras`);
    for (const c of ev.choices) {
      for (const p of c.pay ?? []) if (producibleFrom(p.r) > a) problems.push(`event ${ev.id}: asks for ${p.r} in era ${a}`);
      for (const o of c.outcomes) if ((o.k === 'gain' || o.k === 'lose') && producibleFrom(o.r) > a) problems.push(`event ${ev.id}: touches ${o.r} in era ${a}`);
    }
  }
  if (new Set(EVENTS.map((e) => e.id)).size !== EVENTS.length) problems.push('duplicate event ids');

  for (const h of HERITAGE) for (const r of h.requires) if (!HERITAGE_NODE.has(r)) problems.push(`heritage ${h.id}: unknown requirement ${r}`);
  if (TRAITS.length < 6) problems.push('too few world traits to roll from');
  return problems;
}
