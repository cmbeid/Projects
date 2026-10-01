import { describe, expect, it } from 'vitest';
import { seedId } from '../src/data/items';
import { useAt } from '../src/game/farm';
import { STANDING_SHIFTS, payStandingJobs, rewardWork, workXp } from '../src/game/helpers';
import { xpForLevel } from '../src/game/mon';
import { select, sleep } from '../src/game/world';
import { run, stand, world } from './helpers';

const HOURS = 0.7 * 60;

/** A Squirtle starter and three thirsty Oran plots. */
function field() {
  const w = world(7);
  stand(w, 6, 12);
  for (const x of [5, 6, 7]) {
    select(w, 'hoe');
    useAt(w, x, 13);
    select(w, seedId('oran'));
    useAt(w, x, 13);
  }
  return w;
}

describe('work XP', () => {
  it('grows with level', () => {
    expect(workXp(5)).toBe(6);
    expect(workXp(20)).toBeGreaterThan(workXp(5));
  });

  it('pays a helper for each job it does', () => {
    const w = field();
    const mon = w.mons[0]!;
    const before = mon.xp;
    run(w, HOURS * 2.5);
    const jobs = w.events.filter((e) => e.kind === 'helper').length;
    expect(jobs).toBe(3);
    expect(mon.xp - before).toBe(3 * workXp(mon.level));
  });

  it('pays nothing when there is no work', () => {
    const w = world(7);
    const before = w.mons[0]!.xp;
    run(w, HOURS * 2);
    expect(w.mons[0]!.xp).toBe(before);
  });

  it('pays Ground helpers for planting and re-tilling, but not for fetching seeds', () => {
    const w = world(50); // Diglett
    stand(w, 6, 12);
    select(w, 'hoe');
    useAt(w, 5, 13);
    useAt(w, 7, 13);
    delete w.plots['7,13']; // gone back to grass
    w.seedBox = { [seedId('cheri')]: 1 };
    const mon = w.mons[0]!;
    const before = mon.xp;
    run(w, HOURS * 3);
    expect(w.plots['5,13']!.crop?.id).toBe('cheri');
    expect(w.plots['7,13']).toBeDefined();
    expect(mon.xp - before).toBe(2 * workXp(5));
  });

  it('levels up, shows it, and an evolution changes the helper on the spot', () => {
    const w = world(7);
    const mon = w.mons[0]!;
    mon.level = 15;
    mon.xp = xpForLevel(16) - 1;
    rewardWork(w, mon.uid, { x: 3, y: 3 }, 5);
    expect(mon.level).toBe(16);
    expect(mon.dex).toBe(8); // Wartortle
    expect(w.helpers[0]!.dex).toBe(8);
    const ups = w.events.filter((e) => e.kind === 'levelup');
    expect(ups.map((e) => e.kind === 'levelup' && e.evolved)).toEqual([false, true]);
  });

  it('pays guards for the night, and power helpers only when there are machines', () => {
    const w = world(4); // Charmander guards
    const before = w.mons[0]!.xp;
    payStandingJobs(w);
    expect(w.mons[0]!.xp - before).toBe(workXp(5) * STANDING_SHIFTS);

    const p = world(25); // Pikachu powers machines
    const start = p.mons[0]!.xp;
    payStandingJobs(p);
    expect(p.mons[0]!.xp).toBe(start);
    p.machines['10,20'] = { id: 'berry-press', output: null, count: 0, progress: 0, needed: 0 };
    payStandingJobs(p);
    expect(p.mons[0]!.xp - start).toBe(workXp(5) * STANDING_SHIFTS);
  });

  it('pays guards when you go to bed, but not fainted ones', () => {
    const w = world(4);
    const before = w.mons[0]!.xp;
    sleep(w);
    expect(w.mons[0]!.xp).toBeGreaterThan(before);
    const k = world(4);
    k.mons[0]!.hp = 0;
    const kb = k.mons[0]!.xp;
    sleep(k);
    expect(k.mons[0]!.xp).toBe(kb);
  });
});
