import { ERAS, LAST_ERA } from '../data/eras';
import { ERA_SCALE, ERA_SECONDS, FESTIVAL_BASE, FESTIVAL_GROWTH, FESTIVAL_SECS, GOLDEN_STABILITY } from '../data/progression';
import { TECH, TECHS } from '../data/techs';
import type { Bundle, Goal, TechDef, WonderDef } from '../data/types';
import { WONDER, WONDERS } from '../data/wonders';
import type { GameState } from '../state/types';
import { canAfford, countLine, pay, scale, syncPlots } from './city';
import { derive, type Derived } from './derive';
import { emit } from './events';
import { hasFeature, unlockFeature } from './features';

/**
 * Research, wonders, festivals and the advance from one era to the next:
 * the long arc of the city.
 */

// --- The calendar --------------------------------------------------------------------

/** The year, easing towards the era's end and never quite reaching it until the advance. */
export function yearOf(s: GameState): number {
  const [a, b] = ERAS[s.era]!.years;
  const k = 1 - Math.exp(-s.eraTime / ERA_SECONDS[s.era]!);
  return Math.round(a + (b - a) * k * 0.98);
}

export function yearText(year: number): string {
  return year < 0 ? `${-year} BCE` : `${year} CE`;
}

export function log(s: GameState, text: string): void {
  s.chronicle.log.push({ year: yearOf(s), era: s.era, text });
  if (s.chronicle.log.length > 250) s.chronicle.log.splice(0, s.chronicle.log.length - 250);
}

// --- Research -----------------------------------------------------------------------

export function techCost(s: GameState, t: TechDef, d?: Derived): Bundle {
  return scale(t.cost, (d ?? derive(s)).bonuses.research);
}

export function techAvailable(s: GameState, t: TechDef): boolean {
  return t.era <= s.era && !s.techs.includes(t.id) && t.requires.every((r) => s.techs.includes(r));
}

export function research(s: GameState, id: string, d?: Derived): boolean {
  const t = TECH.get(id);
  if (!t || !techAvailable(s, t)) return false;
  const cost = techCost(s, t, d);
  if (!canAfford(s, cost)) return false;
  pay(s, cost);
  learn(s, t);
  s.queue = s.queue.filter((q) => q !== id);
  return true;
}

/** Adds a tech and turns on whatever it unlocks. */
export function learn(s: GameState, t: TechDef): void {
  s.techs.push(t.id);
  for (const e of t.effects) if (e.k === 'feature') unlockFeature(s, e.f);
  syncPlots(s);
  log(s, `learned ${t.name}`);
  emit({ type: 'research', id: t.id });
}

export function toggleQueue(s: GameState, id: string): void {
  if (s.queue.includes(id)) s.queue = s.queue.filter((q) => q !== id);
  else if (!s.techs.includes(id)) s.queue.push(id);
}

/** Researches the head of the queue as soon as it can be afforded, skipping anything not yet reachable. */
export function runQueue(s: GameState, d: Derived): void {
  if (!hasFeature(s, 'queue')) return;
  s.queue = s.queue.filter((id) => !s.techs.includes(id));
  const head = s.queue.map((id) => TECH.get(id)!).find((t) => techAvailable(s, t));
  if (head) research(s, head.id, d);
}

export function eraTechs(era: number): TechDef[] {
  return TECHS.filter((t) => t.era === era);
}

export function eraTechsKnown(s: GameState, era: number): number {
  return eraTechs(era).filter((t) => s.techs.includes(t.id)).length;
}

// --- Wonders ------------------------------------------------------------------------

export function wonderState(s: GameState, id: string): { done: number; left: number } {
  return s.wonders[id] ?? { done: 0, left: 0 };
}

export function wonderComplete(s: GameState, w: WonderDef): boolean {
  return wonderState(s, w.id).done >= w.stages.length;
}

export function wonderOpen(s: GameState, w: WonderDef): boolean {
  return hasFeature(s, 'wonders') && w.era <= s.era && (!w.tech || s.techs.includes(w.tech));
}

export function wonderStageCost(s: GameState, w: WonderDef, d?: Derived): Bundle | null {
  const st = wonderState(s, w.id);
  const base = w.stages[st.done];
  if (!base) return null;
  return scale(base, (d ?? derive(s)).bonuses.cost);
}

export function startStage(s: GameState, id: string): boolean {
  const w = WONDER.get(id);
  if (!w || !wonderOpen(s, w) || wonderComplete(s, w)) return false;
  const st = wonderState(s, id);
  if (st.left > 0) return false;
  const cost = wonderStageCost(s, w);
  if (!cost || !canAfford(s, cost)) return false;
  pay(s, cost);
  s.wonders[id] = { done: st.done, left: w.stageTime };
  return true;
}

export function tickWonders(s: GameState, d: Derived, dt: number): void {
  for (const [id, st] of Object.entries(s.wonders)) {
    if (st.left <= 0) continue;
    st.left -= dt * (1 + d.bonuses.wonderSpeed);
    if (st.left > 0) continue;
    st.left = 0;
    st.done += 1;
    const w = WONDER.get(id)!;
    if (st.done >= w.stages.length) {
      for (const e of w.effects) if (e.k === 'feature') unlockFeature(s, e.f);
      syncPlots(s);
      log(s, `finished the ${w.name}`);
      emit({ type: 'wonderDone', id });
    } else {
      emit({ type: 'wonderStage', id, stage: st.done });
    }
  }
}

export function eraWonders(era: number): WonderDef[] {
  return WONDERS.filter((w) => w.era === era);
}

// --- Festivals ----------------------------------------------------------------------

export function festivalCost(s: GameState): number {
  return Math.round(FESTIVAL_BASE * ERA_SCALE[s.era]! * FESTIVAL_GROWTH ** s.festivals);
}

export function festivalLength(d: Derived): number {
  return FESTIVAL_SECS * (1 + d.bonuses.festival) * (d.stability >= GOLDEN_STABILITY ? 2 : 1);
}

export function holdFestival(s: GameState, d?: Derived): boolean {
  if (!hasFeature(s, 'festival') || s.festival > 0) return false;
  const cost = festivalCost(s);
  if (s.res.culture < cost) return false;
  const info = d ?? derive(s);
  s.res.culture -= cost;
  s.festival = festivalLength(info);
  s.festivals += 1;
  emit({ type: 'festival' });
  return true;
}

// --- Eras ---------------------------------------------------------------------------

export function goalMet(s: GameState, g: Goal, d?: Derived): boolean {
  switch (g.k) {
    case 'pop':
      return Math.floor(s.pop) >= g.n;
    case 'techs':
      return eraTechsKnown(s, s.era) >= g.n;
    case 'wonder':
      return wonderComplete(s, WONDER.get(g.id)!);
    case 'line': {
      let n = 0;
      for (const p of s.plots) if (p?.line === g.line && p.era === s.era) n += 1;
      return n >= g.n;
    }
    case 'stability':
      return (d ?? derive(s)).stability >= g.n;
    case 'res':
      return s.res[g.r] >= g.n;
  }
}

export function goalsMet(s: GameState, d?: Derived): boolean {
  const info = d ?? derive(s);
  return ERAS[s.era]!.goals.every((g) => goalMet(s, g, info));
}

export function canAdvance(s: GameState, d?: Derived): boolean {
  return s.era < LAST_ERA && goalsMet(s, d) && canAfford(s, ERAS[s.era]!.advanceCost);
}

export function advance(s: GameState, d?: Derived): boolean {
  if (!canAdvance(s, d)) return false;
  pay(s, ERAS[s.era]!.advanceCost);
  s.era += 1;
  s.eraTime = 0;
  s.festivals = 0;
  s.stats.bestEra = Math.max(s.stats.bestEra, s.era);
  syncPlots(s);
  log(s, `entered the ${ERAS[s.era]!.name}`);
  emit({ type: 'era', era: s.era });
  return true;
}

export { countLine };
