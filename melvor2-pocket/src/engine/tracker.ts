// Rate tracker behind the bottom stats bar (like the demo's action tracker): XP, gold and item gains of the
// current action over a sliding time window. In memory only; offline catch-up isn't counted.
import { GOLD, item } from './content';

export interface TrackEvent { tick: number; kind: 'xp' | 'item' | 'gold'; id: string; amount: number }

const TICKS_PER_HOUR = 60 * 60 * 60;
/** Keep at most an hour of events. */
const MAX_WINDOW_TICKS = TICKS_PER_HOUR;

export class Tracker {
  events: TrackEvent[] = [];
  /** Tick the current action started, so short sessions aren't averaged over the whole window. */
  since = 0;
  key = '';

  /** Restart when the action (skill + recipe) changes. */
  sync(key: string, tick: number): void {
    if (key === this.key) return;
    this.key = key;
    this.since = tick;
    this.events = [];
  }

  add(e: TrackEvent): void {
    this.events.push(e);
    if (this.events.length > 5000 || e.tick - this.events[0].tick > MAX_WINDOW_TICKS) {
      const cutoff = e.tick - MAX_WINDOW_TICKS;
      this.events = this.events.filter((x) => x.tick >= cutoff).slice(-5000);
    }
  }

  /**
   * Per-hour rates over the last `windowTicks` (or since the action started, if shorter). Measured between action
   * completions, not up to "now", so the rate doesn't saw up and down as each action pays out.
   */
  rates(now: number, windowTicks: number) {
    const windowStart = Math.max(this.since, now - windowTicks);
    const inWindow = this.events.filter((e) => e.tick >= windowStart);
    // Anchor on the action's start when it's in the window; otherwise on the first payout in it (whose gains belong
    // to the action before, so they're left out).
    const fromStart = windowStart === this.since;
    const anchor = fromStart ? this.since : inWindow[0]?.tick ?? now;
    const last = inWindow.length ? inWindow[inWindow.length - 1].tick : anchor;
    const span = Math.max(0, last - anchor);
    const perHour = (n: number) => (span > 0 ? (n * TICKS_PER_HOUR) / span : 0);
    const xp: Record<string, number> = {};
    const items: Record<string, number> = {};
    let gold = 0;
    for (const e of inWindow) {
      if (!fromStart && e.tick <= anchor) continue;
      if (e.kind === 'xp') xp[e.id] = (xp[e.id] ?? 0) + e.amount;
      else if (e.kind === 'gold') gold += e.amount;
      else items[e.id] = (items[e.id] ?? 0) + e.amount;
    }
    // Value/hr: gold earned plus the sell value of items gained (or used up).
    let value = gold;
    for (const [id, n] of Object.entries(items)) value += n * (item(id).SellsFor?.Currency === GOLD ? item(id).SellsFor!.Quantity : 0);
    const map = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, perHour(v)]));
    return { spanTicks: span, xp: map(xp), items: map(items), gold: perHour(gold), value: perHour(value) };
  }
}
