import { describe, expect, it } from 'vitest';
import { Game, MAX_OFFLINE_MS, TICK_MS, msToTicks } from '../src/engine/game';
import { newState } from '../src/engine/state';
import { unlockEverything } from '../src/engine/navigation';
import { LEVEL_CAP, levelForXp, xpForLevel } from '../src/engine/xp';
import { woodcutting } from '../src/engine/skills/woodcutting';
import { mining } from '../src/engine/skills/mining';
import { fishing } from '../src/engine/skills/fishing';
import { firemaking } from '../src/engine/skills/firemaking';
import type { FishingRecipe } from '../src/engine/content';

const id = (s: string) => `MelvorBase:${s}`;
/** Mechanics tests start with every page unlocked; progression gating has its own tests. */
const fresh = (seed = 1) => {
  const g = new Game(newState(0, seed));
  unlockEverything(g);
  return g;
};

describe('experience table', () => {
  it('matches the game curve', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(83);
    expect(xpForLevel(10)).toBe(1154);
    expect(xpForLevel(60)).toBe(273740);
  });

  it('caps the level at 60 while XP keeps growing', () => {
    expect(levelForXp(xpForLevel(60) - 1)).toBe(59);
    expect(levelForXp(1e9)).toBe(LEVEL_CAP);
  });
});

describe('ticks', () => {
  it('converts intervals like the game (60 ticks per second)', () => {
    expect(TICK_MS).toBeCloseTo(16.6667, 3);
    expect(msToTicks(1000)).toBe(60);
    expect(msToTicks(1500)).toBe(90);
  });
});

describe('woodcutting', () => {
  it('gives the log and XP once per cut, after BaseMaxHealth hits', () => {
    const g = fresh();
    const tree = id('NormalTree'); // 3 HP, 1000 ms, 3 XP, 1 log
    g.toggle('Woodcutting', tree);
    g.advance(msToTicks(1000) * 2);
    expect(g.count(id('NormalLog'))).toBe(0);
    g.advance(msToTicks(1000));
    expect(g.count(id('NormalLog'))).toBe(1);
    expect(g.state.xp.Woodcutting).toBe(3);
    g.advance(msToTicks(1000) * 300);
    expect(g.count(id('NormalLog'))).toBe(101);
  });

  it('blocks trees above your level and demo-locked trees', () => {
    const g = fresh();
    expect(g.blockReason('Woodcutting', id('OakTree'))).toBe('Level too low');
    expect(g.blockReason('Woodcutting', id('YewTree'))).toBe('Not in demo');
    expect(woodcutting.recipes()).toContain(id('NormalTree'));
  });
});

describe('mining', () => {
  it('breaks a rock within ceil(1/p) hits and only then gives XP', () => {
    const g = fresh(7);
    const stone = id('Stone'); // p = 0.4, so at most 3 hits per break
    g.toggle('Mining', stone);
    const hit = msToTicks(mining.interval(g, stone));
    g.advance(hit * 3);
    expect(g.count(id('Stone'))).toBeGreaterThanOrEqual(1);
    expect(g.state.xp.Mining).toBe(3 * g.count(id('Stone')));
  });
});

describe('fishing', () => {
  it('catches fish or junk every action and always gives XP', () => {
    const g = fresh(3);
    const spot = id('ShallowPools');
    g.toggle('Fishing', spot);
    g.advance(msToTicks(8000) * 50);
    const fishActions = g.state.stats.actions.Fishing;
    expect(fishActions).toBeGreaterThan(40);
    expect(g.state.xp.Fishing).toBe(8 * fishActions);
    expect(g.count(id('RawShrimp')) + g.count(id('Junk'))).toBeGreaterThanOrEqual(fishActions);
    expect((fishing.recipe(spot) as FishingRecipe).Location).toBe(id('ShallowShores'));
  });
});

describe('firemaking', () => {
  it('burns logs until they run out, then stops', () => {
    const g = fresh();
    const log = id('NormalLog');
    expect(g.blockReason('Firemaking', log)).toMatch(/^Need/);
    g.addItem(log, 5);
    g.toggle('Firemaking', log);
    g.advance(msToTicks(firemaking.interval(g, log)) * 10);
    expect(g.count(log)).toBe(0);
    expect(g.state.xp.Firemaking).toBe(6 * 5);
    expect(g.state.active).toBeNull();
  });
});

describe('offline progress', () => {
  it('gives the same result as running online for the same time', () => {
    const online = fresh(42);
    const offline = fresh(42);
    for (const g of [online, offline]) g.toggle('Woodcutting', id('NormalTree'));
    const ms = 2 * 60 * 60 * 1000;
    // Uneven online frame times, as a real browser produces.
    for (let t = 0, i = 0; t < ms; i++) {
      const step = Math.min(ms - t, 16 + (i % 7) * 3.3);
      online.advanceMs(step);
      t += step;
    }
    const summary = offline.catchUp(ms);
    expect(summary?.ms).toBe(ms);
    expect(offline.state.bank).toEqual(online.state.bank);
    expect(offline.state.xp).toEqual(online.state.xp);
    expect(offline.state.rng).toBe(online.state.rng);
  });

  it('caps offline time at 24 hours', () => {
    const g = fresh();
    g.toggle('Woodcutting', id('NormalTree'));
    const s = g.catchUp(3 * MAX_OFFLINE_MS);
    expect(s?.ms).toBe(MAX_OFFLINE_MS);
    expect(s?.elapsed).toBe(3 * MAX_OFFLINE_MS);
  });

  it('summarises offline time per skill, like the desktop', () => {
    const g = fresh(3);
    g.toggle('Woodcutting', id('NormalTree'));
    const s = g.catchUp(g.state.lastUpdate + 60 * 60 * 1000)!;
    expect(s.active).toBe('Woodcutting');
    const wc = s.groups.Woodcutting;
    expect(wc.xp).toBe(s.xp.Woodcutting);
    expect(wc.gained[id('NormalLogs')] ?? Object.values(wc.gained)[0]).toBeGreaterThan(0);
    expect(wc.levels?.[1]).toBeGreaterThan(wc.levels?.[0] ?? 99);
    expect(s.inactiveMs).toBe(0);
  });

  it('survives a JSON save round trip mid-action', () => {
    const g = fresh(9);
    g.toggle('Mining', id('Stone'));
    g.advance(1234);
    const restored = new Game(JSON.parse(JSON.stringify(g.state)));
    g.advance(5000);
    restored.advance(5000);
    expect(restored.state).toEqual(g.state);
  });
});
