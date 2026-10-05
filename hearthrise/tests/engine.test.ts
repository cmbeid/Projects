import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/data/progression';
import { crewClearsPerSecond, damage, ruinHp, tap } from '../src/game/clearing';
import { place } from '../src/game/economy';
import { newGame, tick } from '../src/game/engine';
import { tileOpen } from '../src/game/grid';

describe('clearing', () => {
  it('clears ruins with taps, and a landmark opens the next ward and its row', () => {
    const s = newGame(1);
    for (let i = 0; i < 5; i++) {
      while (s.counters.clears <= i) tap(s);
    }
    expect(s.counters.clears).toBe(5);
    expect(Object.values(s.inventory).reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(5);
    s.ruinsHere = BALANCE.ruinsPerWard - 1;
    s.ruin.hp = 0.001;
    tap(s);
    expect(s.ruin.landmark).toBe(true);
    expect(tileOpen(s, 0, 0, 1)).toBe(false);
    damage(s, s.ruin.hp + 1, { crit: false, auto: false });
    expect(s.maxWard).toBe(2);
    expect(s.ward).toBe(2);
    expect(tileOpen(s, 0, 0, 1)).toBe(true);
    expect(s.inventory['hearthstone']).toBe(1);
  });

  it('holds the landmark back while salvaging', () => {
    const s = newGame(1);
    s.autoAdvance = false;
    s.ruinsHere = BALANCE.ruinsPerWard + 5;
    s.ruin.hp = 0.001;
    tap(s);
    expect(s.ruin.landmark).toBe(false);
    expect(s.counters.farmed).toBe(1);
  });

  it('caps how many ruins the crews can carry away a second', () => {
    const s = newGame(1);
    s.features.push('build', 'crews');
    s.story.id = null;
    s.coins = 1e9;
    place(s, 'tent', 0, 0, 0);
    const gang = place(s, 'gang', 0, 1, 0)!;
    gang.lvl = 1e6;
    const before = s.counters.clears;
    for (let i = 0; i < 20; i++) tick(s, 0.05);
    expect(s.counters.clears - before).toBeLessThanOrEqual(crewClearsPerSecond(s) + 1);
  });

  it('gets heavier ward by ward, and much heavier at a new district', () => {
    expect(ruinHp(2, false)).toBeGreaterThan(ruinHp(1, false));
    expect(ruinHp(9, false) / ruinHp(8, false)).toBeGreaterThan(BALANCE.districtHpJump);
  });

  it('collects taxes as time passes', () => {
    const s = newGame(1);
    s.features.push('build');
    s.story.id = null;
    s.coins = 1e6;
    place(s, 'tent', 0, 0, 0);
    place(s, 'stall', 0, 1, 0);
    const coins = s.coins;
    tick(s, 10);
    expect(s.coins).toBeGreaterThan(coins);
  });

  it('replays identically from the same seed', () => {
    const a = newGame(42);
    const b = newGame(42);
    for (let i = 0; i < 300; i++) {
      tap(a);
      tap(b);
    }
    expect(a).toEqual(b);
  });
});
