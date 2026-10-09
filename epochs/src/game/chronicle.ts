import { EVENT, EVENTS } from '../data/chronicle';
import { ERA_SCALE, EVENT_GAP, EVENT_WAIT } from '../data/progression';
import type { ChoiceDef, EventDef, ResId } from '../data/types';
import type { GameState } from '../state/types';
import { derive, type Derived } from './derive';
import { emit } from './events';
import { hasFeature } from './features';
import { log } from './progress';
import { rand } from './rng';

/**
 * The Chronicle: every few minutes something happens to the city and it has
 * to decide what to do. Unanswered, the event resolves itself the way a
 * city with nobody in charge would. Both the event and the answer go in the
 * history book.
 */

/** A resource's output a second, for sizing an event; never so small that an event is worth nothing. */
function rateFor(s: GameState, d: Derived, r: ResId): number {
  return Math.max(d.gross[r], 0.2 * ERA_SCALE[s.era]!);
}

export function payAmounts(s: GameState, c: ChoiceDef, d: Derived): { r: ResId; n: number }[] {
  return (c.pay ?? []).map((p) => ({ r: p.r, n: Math.ceil(rateFor(s, d, p.r) * p.secs) }));
}

export function canChoose(s: GameState, c: ChoiceDef, d: Derived): boolean {
  return payAmounts(s, c, d).every((p) => s.res[p.r] >= p.n);
}

export function nextGap(s: GameState, d: Derived): number {
  const [a, b] = EVENT_GAP;
  return (a + rand(s) * (b - a)) * Math.max(0.3, 1 - d.bonuses.eventRate);
}

function pick(s: GameState): EventDef | null {
  const pool = EVENTS.filter((e) => e.eras[0] <= s.era && s.era <= e.eras[1] && !s.chronicle.recent.includes(e.id));
  if (pool.length === 0) return null;
  return pool[Math.floor(rand(s) * pool.length)]!;
}

export function tickChronicle(s: GameState, d: Derived, dt: number): void {
  if (!hasFeature(s, 'chronicle')) return;
  const c = s.chronicle;
  if (c.pending) {
    c.pending.left -= dt;
    if (c.pending.left <= 0) {
      const def = EVENT.get(c.pending.id);
      // Fall back to the other answer if the default cannot be paid for.
      const fb = def ? (canChoose(s, def.choices[def.fallback], d) ? def.fallback : ((1 - def.fallback) as 0 | 1)) : 0;
      answer(s, fb, d, true);
    }
    return;
  }
  c.next -= dt;
  if (c.next > 0) return;
  const e = pick(s);
  c.next = nextGap(s, d);
  if (!e) return;
  c.pending = { id: e.id, left: EVENT_WAIT };
  c.recent.push(e.id);
  if (c.recent.length > 8) c.recent.shift();
  emit({ type: 'chronicle', id: e.id });
}

export function answer(s: GameState, choice: 0 | 1, d?: Derived, timedOut = false): boolean {
  const p = s.chronicle.pending;
  if (!p) return false;
  const def = EVENT.get(p.id);
  if (!def) {
    s.chronicle.pending = null;
    return false;
  }
  const info = d ?? derive(s);
  const c = def.choices[choice];
  if (!canChoose(s, c, info)) {
    // Nobody can pay: the event passes with nothing done at all.
    if (!timedOut) return false;
    s.chronicle.pending = null;
    log(s, `let ${def.title.toLowerCase()} pass`);
    return true;
  }
  for (const pa of payAmounts(s, c, info)) s.res[pa.r] = Math.max(0, s.res[pa.r] - pa.n);
  for (const o of c.outcomes) {
    switch (o.k) {
      case 'gain':
        s.res[o.r] = Math.min(info.caps[o.r], s.res[o.r] + rateFor(s, info, o.r) * o.secs);
        break;
      case 'lose':
        s.res[o.r] *= 1 - o.pct;
        break;
      case 'pop': {
        const delta = Math.round(s.pop * o.pct);
        s.pop = Math.max(1, Math.min(o.pct > 0 ? Math.max(s.pop, info.housing) : s.pop, s.pop + delta));
        if (o.pct > 0 && delta > 0) emit({ type: 'born', n: delta });
        break;
      }
      case 'mod':
        s.modifiers.push({ label: o.label, target: o.target, x: o.x, left: o.secs });
        break;
      case 'insight':
        s.res.knowledge += rateFor(s, info, 'knowledge') * o.secs;
        break;
    }
  }
  s.chronicle.pending = null;
  s.stats.events += 1;
  log(s, timedOut ? `${c.log} (nobody decided)` : c.log);
  emit({ type: 'answer', id: def.id, choice });
  return true;
}

export function tickModifiers(s: GameState, dt: number): void {
  for (const m of s.modifiers) m.left -= dt;
  s.modifiers = s.modifiers.filter((m) => m.left > 0);
  if (s.festival > 0) s.festival = Math.max(0, s.festival - dt);
}
