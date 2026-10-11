import { CLASS } from '../data/crew';
import { EVENT, EVENTS } from '../data/events';
import { FACTION } from '../data/factions';
import { GEAR_DEF, RARITIES } from '../data/gear';
import { CONSUMABLE, MAT } from '../data/materials';
import { STORY_BY_ID } from '../data/story';
import type { Choice, ClassId, ConsumableId, EventDef, MatId, Outcome, ResId, StatId } from '../data/types';
import type { Crew, GameState, MapNode } from '../state/types';
import { gainMats, hasMats, payMats, randomGear } from './crafting';
import { grantXp, healCrew, hurtCrew, makeCrew, setMorale } from './crew';
import { conscious, derive, effStat } from './derive';
import { revealAll } from './galaxy';
import { addLog } from './log';
import { pick, pickWeighted, rand, stateRng } from './rng';
import { completeMission } from './story';
import { passDay } from './survival';

// ---------------------------------------------------------------- Choosing an event

export function eventsFor(s: GameState, n: MapNode): EventDef[] {
  const sector = s.sector.index;
  return EVENTS.filter(
    (e) =>
      e.kinds.includes(n.kind) &&
      (e.minSector ?? 0) <= sector &&
      (e.maxSector ?? 99) >= sector &&
      !(e.unique && s.stats.seen.includes(e.id)) &&
      (n.kind !== 'patrol' || !e.faction || e.faction === n.faction),
  );
}

export function pickEvent(s: GameState, n: MapNode): EventDef | null {
  const pool = eventsFor(s, n);
  if (!pool.length) return null;
  // Prefer ones not seen yet, so a long campaign doesn't repeat itself early.
  return pickWeighted(stateRng(s), pool, (e) => (e.weight ?? 1) * (s.stats.seen.includes(e.id) ? 0.35 : 1));
}

export function openEvent(s: GameState, id: string, source: 'event' | 'story'): void {
  s.event = { id, source, result: null, changes: [], then: null, checker: null };
  s.screen = 'event';
  if (source === 'event' && !s.stats.seen.includes(id)) s.stats.seen.push(id);
}

/** Title, text and choices for whatever event is open, story beats included. */
export function eventView(s: GameState): { title: string; text: string; choices: Choice[] } | null {
  if (!s.event) return null;
  if (s.event.source === 'story') {
    const st = STORY_BY_ID.get(s.event.id)!;
    return { title: st.title, text: st.text, choices: st.choices ?? [{ label: 'Continue', ok: { text: st.reward.text } }] };
  }
  const e = EVENT.get(s.event.id)!;
  return { title: e.title, text: e.text, choices: e.choices };
}

// ---------------------------------------------------------------- Requirements and checks

export function choiceShown(s: GameState, c: Choice): boolean {
  const q = c.req;
  if (!q) return true;
  if (q.cls && !s.crew.some((m) => m.cls === q.cls && conscious(m))) return false;
  if (q.flag && !s.story.flags.includes(q.flag)) return false;
  if (q.origin && s.origin !== q.origin) return false;
  if (q.rep) for (const [f, v] of Object.entries(q.rep)) if (s.rep[f as keyof typeof s.rep] < v) return false;
  return true;
}

export function choiceAffordable(s: GameState, c: Choice): boolean {
  const q = c.req;
  if (!q) return true;
  if (q.mats && !hasMats(s, q.mats)) return false;
  if (q.res) for (const [k, v] of Object.entries(q.res) as [ResId, number][]) if (s.res[k] < v) return false;
  if (q.items) for (const [k, v] of Object.entries(q.items) as [ConsumableId, number][]) if (s.items[k] < v) return false;
  return true;
}

export const CLASS_BONUS = 2;

/** Who would make a check, and their chance. */
export function checkOdds(s: GameState, check: NonNullable<Choice['check']>): { crew: Crew | null; skill: number; chance: number } {
  let best: Crew | null = null;
  let skill = -Infinity;
  for (const c of s.crew) {
    if (!conscious(c)) continue;
    const v = effStat(s, c, check.stat) + (check.cls && c.cls === check.cls ? CLASS_BONUS : 0);
    if (v > skill) {
      skill = v;
      best = c;
    }
  }
  if (!best) return { crew: null, skill: 0, chance: 0.05 };
  const chance = Math.max(0.05, Math.min(0.95, 0.5 + (skill - check.dc) * 0.08));
  return { crew: best, skill, chance };
}

export function statName(stat: StatId): string {
  return stat[0]!.toUpperCase() + stat.slice(1);
}

export function className(cls: ClassId): string {
  return CLASS.get(cls)!.name;
}

// ---------------------------------------------------------------- Outcomes

/** Applies an outcome and returns a line for each thing that changed. */
export function applyOutcome(s: GameState, o: Outcome, who: Crew | null): string[] {
  const lines: string[] = [];
  const d = derive(s);
  const r = stateRng(s);
  if (o.res) {
    for (const [k, v] of Object.entries(o.res) as [ResId, number][]) {
      const cap = k === 'fuel' ? d.maxFuel : k === 'food' ? d.maxFood : k === 'energy' ? d.maxEnergy : k === 'hull' ? d.maxHull : Infinity;
      const before = s.res[k];
      s.res[k] = Math.max(0, Math.min(cap, s.res[k] + v));
      const delta = Math.round((s.res[k] - before) * 10) / 10;
      if (delta) lines.push(`${delta > 0 ? '+' : ''}${delta} ${k}`);
    }
  }
  if (o.mats) {
    const gain: Partial<Record<MatId, number>> = {};
    for (const [k, v] of Object.entries(o.mats) as [MatId, number][]) {
      const real = v < 0 ? -Math.min(s.mats[k], -v) : v;
      if (real) {
        gain[k] = real;
        lines.push(`${real > 0 ? '+' : ''}${real} ${MAT.get(k)!.name}`);
      }
    }
    gainMats(s, gain);
  }
  if (o.items) {
    for (const [k, v] of Object.entries(o.items) as [ConsumableId, number][]) {
      s.items[k] = Math.max(0, s.items[k] + v);
      lines.push(`${v > 0 ? '+' : ''}${v} ${CONSUMABLE.get(k)!.name}`);
    }
  }
  if (o.hpAll) {
    for (const c of s.crew) {
      if (o.hpAll > 0) healCrew(c, o.hpAll);
      else hurtCrew(c, -o.hpAll);
    }
    lines.push(`${o.hpAll > 0 ? '+' : ''}${o.hpAll} health, all crew`);
  }
  if (o.hpOne) {
    const target = who ?? pick(r, s.crew.filter(conscious).length ? s.crew.filter(conscious) : s.crew);
    if (o.hpOne > 0) healCrew(target, o.hpOne);
    else hurtCrew(target, -o.hpOne);
    lines.push(`${o.hpOne > 0 ? '+' : ''}${o.hpOne} health, ${target.name}`);
  }
  if (o.morale) {
    for (const c of s.crew) setMorale(c, c.morale + o.morale);
    lines.push(`${o.morale > 0 ? '+' : ''}${o.morale} morale`);
  }
  if (o.rep) {
    for (const [f, v] of Object.entries(o.rep) as [keyof typeof s.rep, number][]) {
      s.rep[f] = Math.max(-100, Math.min(100, s.rep[f] + v));
      lines.push(`${v > 0 ? '+' : ''}${v} ${FACTION.get(f)!.name}`);
    }
  }
  if (o.colonists) {
    s.colonists += o.colonists;
    lines.push(`+${o.colonists} colonist${o.colonists === 1 ? '' : 's'}`);
  }
  if (o.gear) {
    const g = randomGear(s, r, s.sector.index);
    s.gear.push(g);
    lines.push(`Found: ${RARITIES[g.rarity]!.name} ${GEAR_DEF.get(g.base)!.name}`);
  }
  if (o.recruit) {
    if (s.crew.length < d.crewCap) {
      const cls = o.recruit === 'any' ? pick(r, ['pilot', 'engineer', 'scientist', 'medic', 'soldier'] as const) : o.recruit;
      const c = makeCrew(s, r, cls, Math.max(1, s.sector.index * 2));
      s.crew.push(c);
      lines.push(`${c.name} (${className(cls)}) joined the crew`);
      addLog(s, `${c.name} joined the crew.`, 'ship');
    } else {
      s.colonists += 1;
      lines.push('No berth free: they join the Wake instead (+1 colonist)');
    }
  }
  if (o.flag && !s.story.flags.includes(o.flag)) s.story.flags.push(o.flag);
  if (o.reveal) {
    revealAll(s);
    lines.push('Sector map revealed');
  }
  if (o.days) {
    // Days spent in an event pass the same way a jump's day does.
    for (let i = 0; i < o.days; i++) passDay(s);
    lines.push(`${o.days} day${o.days === 1 ? '' : 's'} passed`);
  }
  if (o.xp) lines.push(`+${o.xp} XP`, ...grantXp(s, o.xp));
  return lines;
}

export function choose(s: GameState, index: number): boolean {
  const ev = s.event;
  const view = eventView(s);
  if (!ev || !view || ev.result !== null) return false;
  const c = view.choices[index];
  if (!c || !choiceShown(s, c) || !choiceAffordable(s, c)) return false;
  if (c.pay && c.req) {
    if (c.req.mats) payMats(s, c.req.mats);
    if (c.req.res) for (const [k, v] of Object.entries(c.req.res) as [ResId, number][]) s.res[k] -= v;
    if (c.req.items) for (const [k, v] of Object.entries(c.req.items) as [ConsumableId, number][]) s.items[k] -= v;
  }
  let outcome = c.ok;
  let who: Crew | null = null;
  let prefix = '';
  if (c.check) {
    const odds = checkOdds(s, c.check);
    who = odds.crew;
    const ok = rand(s) < odds.chance;
    if (!ok && c.fail) outcome = c.fail;
    prefix = `${who ? who.name : 'Nobody'} tries (${statName(c.check.stat)}, ${Math.round(odds.chance * 100)}%): ${ok ? 'success' : 'failure'}. `;
    ev.checker = who?.id ?? null;
  }
  const lines = applyOutcome(s, outcome, who);
  ev.result = prefix + outcome.text;
  ev.changes = lines;
  ev.then = outcome.combat ? { combat: outcome.combat } : null;
  if (ev.source === 'story') ev.changes.push(...completeMission(s, ev.id));
  addLog(s, `${view.title}: ${outcome.text}`, ev.source === 'story' ? 'story' : 'event');
  return true;
}
