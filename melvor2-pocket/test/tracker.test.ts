import { describe, expect, it } from 'vitest';
import { Game, msToTicks } from '../src/engine/game';
import { newState } from '../src/engine/state';
import { unlockEverything } from '../src/engine/navigation';

const id = (s: string) => `MelvorBase:${s}`;
const HOUR = 60 * 60 * 60;

describe('stats bar rates', () => {
  it('Normal Tree: 1 log and 3 XP every 3 seconds = 1,200 logs and 3,600 XP per hour', () => {
    const g = new Game(newState(0, 1));
    unlockEverything(g);
    g.toggle('Woodcutting', id('NormalTree'));
    g.advance(msToTicks(1000) * 3 * 200);
    const r = g.tracker.rates(g.state.tick, HOUR);
    expect(r.xp.Woodcutting).toBeCloseTo(3600, -1);
    expect(r.items[id('NormalLog')]).toBeCloseTo(1200, -1);
  });

  it('stays steady between payouts instead of jumping with each action', () => {
    const g = new Game(newState(0, 1));
    unlockEverything(g);
    g.toggle('Woodcutting', id('NormalTree'));
    const seen: number[] = [];
    for (let i = 0; i < 40; i++) {
      g.advance(msToTicks(500));
      const r = g.tracker.rates(g.state.tick, HOUR);
      if (r.spanTicks > 0) seen.push(r.xp.Woodcutting);
    }
    expect(seen.length).toBeGreaterThan(30);
    for (const v of seen) expect(v).toBeCloseTo(3600, -1);
    // A sliding window that starts mid-action is just as steady.
    for (let i = 0; i < 12; i++) {
      g.advance(msToTicks(500));
      expect(g.tracker.rates(g.state.tick, msToTicks(10_000)).xp.Woodcutting).toBeCloseTo(3600, -1);
    }
  });

  it('shows ingredients being used up, and ignores selling', () => {
    const g = new Game(newState(0, 1));
    unlockEverything(g);
    g.addItem(id('NormalLog'), 100);
    g.toggle('Firemaking', id('NormalLog'));
    g.advance(msToTicks(4000) * 10);
    g.sell(id('NormalLog'), 10);
    const r = g.tracker.rates(g.state.tick, HOUR);
    expect(r.items[id('NormalLog')]).toBeCloseTo(-900, -1); // one log per 4 s
    expect(r.gold).toBe(0);
  });

  it('restarts when the action changes and skips offline catch-up', () => {
    const g = new Game(newState(0, 1));
    unlockEverything(g);
    g.toggle('Woodcutting', id('NormalTree'));
    g.advance(msToTicks(1000) * 30);
    g.toggle('Woodcutting', id('FlaxBush'));
    g.state.xp.Woodcutting = 1e9;
    g.toggle('Woodcutting', id('FlaxBush'));
    g.catchUp(g.state.lastUpdate + 60 * 60 * 1000);
    const r = g.tracker.rates(g.state.tick, HOUR);
    expect(r.items[id('NormalLog')] ?? 0).toBe(0);
  });
});
