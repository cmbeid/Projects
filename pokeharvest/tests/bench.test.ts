import { describe, expect, it } from 'vitest';
import { BENCH, tileAt } from '../src/data/maps';
import { seedId } from '../src/data/items';
import { BENCH_SPEED, BENCH_UNTIL } from '../src/game/bench';
import { useAt } from '../src/game/farm';
import { JOB_INTERVAL, restProgress } from '../src/game/helpers';
import { actFacing, select, step, tapTile, tick } from '../src/game/world';
import { loadWorld, saveWorld } from '../src/state/save';
import { run, stand, world } from './helpers';

function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

/** Standing just below the bench, then tap it. */
function seated() {
  const w = world();
  stand(w, BENCH.x, BENCH.y + 1);
  tapTile(w, BENCH.x, BENCH.y);
  return w;
}

describe('bench', () => {
  it('stands by the house', () => {
    expect(tileAt('farm', BENCH.x, BENCH.y)).toBe('bench');
  });

  it('sits you down, and time runs faster', () => {
    const w = seated();
    expect(w.player.seat).toEqual({ x: BENCH.x, y: BENCH.y + 1 });
    expect([w.player.x, w.player.y]).toEqual([BENCH.x, BENCH.y]);
    const before = w.clock;
    tick(w, 0.7); // one in-game minute, normally
    expect(w.clock - before).toBeCloseTo(BENCH_SPEED);
  });

  it('a tap, a step or the A button gets you up where you sat down', () => {
    for (const getUp of [(w: ReturnType<typeof world>) => tapTile(w, 1, 1), (w: ReturnType<typeof world>) => step(w, 'left'), (w: ReturnType<typeof world>) => actFacing(w)]) {
      const w = seated();
      getUp(w);
      expect(w.player.seat).toBeNull();
      expect([w.player.x, w.player.y]).toEqual([BENCH.x, BENCH.y + 1]);
      expect(w.player.path).toEqual([]);
      const before = w.clock;
      tick(w, 0.7);
      expect(w.clock - before).toBeCloseTo(1);
    }
  });

  it('gets you up at midnight, and won\'t seat you after', () => {
    const w = seated();
    w.clock = BENCH_UNTIL - 1;
    run(w, 1);
    expect(w.player.seat).toBeNull();
    expect(w.events.some((e) => e.kind === 'stand' && e.text)).toBe(true);
    tapTile(w, BENCH.x, BENCH.y);
    expect(w.player.seat).toBeNull();
  });

  it('crops and helpers keep pace with the fast clock', () => {
    const w = seated();
    w.mons[0]!.dex = 50; // a Diglett, who sows
    w.helpers[0]!.dex = 50;
    for (const x of [3, 4, 5]) w.plots[`${x},14`] = { watered: false, crop: null };
    w.seedBox = { [seedId('cheri')]: 9 };
    run(w, 0.7 * 60 * 3 / BENCH_SPEED); // three in-game hours, sitting down
    expect(w.player.seat).not.toBeNull();
    expect(w.seedBox[seedId('cheri')]).toBeLessThan(9);
  });

  it('saves you standing beside it', () => {
    const w = seated();
    const store = memory();
    saveWorld(w, store);
    const back = loadWorld(store)!;
    expect(back.player.seat).toBeNull();
    expect([back.player.x, back.player.y]).toEqual([BENCH.x, BENCH.y + 1]);
  });
});

describe('rest bar', () => {
  it('fills up between jobs and empties after each one', () => {
    const w = world(7); // Squirtle, who waters
    stand(w, 6, 12);
    select(w, 'hoe');
    useAt(w, 6, 13);
    select(w, seedId('oran'));
    useAt(w, 6, 13);
    const h = w.helpers[0]!;
    const start = restProgress(w, h)!;
    expect(start.progress).toBeCloseTo(0);
    expect(start.hungry).toBe(false);
    run(w, 0.7 * 5);
    expect(restProgress(w, h)!.progress).toBeGreaterThan(start.progress);
    // Once it's off to water, no bar; after, a fresh one for the full half hour.
    for (let i = 0; i < 3000 && !h.target; i += 1) tick(w, 1 / 30);
    expect(restProgress(w, h)).toBeNull();
    for (let i = 0; i < 3000 && h.target; i += 1) tick(w, 1 / 30);
    expect(h.rest).toBe(JOB_INTERVAL);
    expect(restProgress(w, h)!.progress).toBeLessThan(0.1);
  });

  it('shows hungry helpers, and nothing for those without a crop job', () => {
    const w = world(7);
    w.mons[0]!.fed = false;
    expect(restProgress(w, w.helpers[0]!)!.hungry).toBe(true);
    const fire = world(4); // Charmander guards: no timer to show
    expect(restProgress(fire, fire.helpers[0]!)).toBeNull();
    w.clock = 23 * 60;
    expect(restProgress(w, w.helpers[0]!)).toBeNull();
  });
});
