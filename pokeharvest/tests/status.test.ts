import { describe, expect, it } from 'vitest';
import { seedId } from '../src/data/items';
import { setRole } from '../src/game/barn';
import { nextSeed, useAt } from '../src/game/farm';
import { adopt, makeMon } from '../src/game/mon';
import { farmStatus, statusLine } from '../src/game/status';
import { select, sleep } from '../src/game/world';
import { run, stand, world } from './helpers';

const ids = (w: ReturnType<typeof world>): string[] => farmStatus(w).map((e) => e.id);

describe('farm status', () => {
  it('has nothing to say on a fresh farm', () => {
    const w = world();
    w.requests = [];
    expect(farmStatus(w)).toEqual([]);
    expect(statusLine([])).toBe('');
  });

  it('counts ripe crops and finished machines', () => {
    const w = world();
    w.requests = [];
    w.plots['5,14'] = { watered: false, crop: { id: 'cheri', growth: 99, harvests: 0, tended: false } };
    w.plots['6,14'] = { watered: false, crop: { id: 'cheri', growth: 99, harvests: 0, tended: false } };
    w.machines['8,20'] = { id: 'berry-press', output: 'oran-juice', count: 1, progress: 999, needed: 360 };
    expect(statusLine(farmStatus(w))).toBe('🍓 2 ripe · ⚙ 1 ready');
    expect(farmStatus(w)[1]!.detail).toContain('Berry Press: Oran Juice');
    delete w.plots['5,14'];
    delete w.plots['6,14'];
    expect(ids(w)).toEqual(['machines']);
  });

  it('flags barn produce, a hungry barn and requests due today', () => {
    const w = world();
    w.requests = [{ id: 1, item: 'oran', count: 3, reward: 100, reputation: 1, due: w.day }];
    w.barn.output = { 'moomoo-milk': 2 };
    const mon = makeMon(241, 5, w.rng);
    adopt(w, mon, false);
    setRole(w, mon.uid, 'farm');
    expect(ids(w)).toEqual(['barn', 'trough', 'requests']);
    w.barn.trough = { oran: 3 };
    expect(ids(w)).not.toContain('trough');
  });

  it('asks for seeds only with a sower and an empty plot to fill', () => {
    const w = world(50); // a Diglett
    w.requests = [];
    expect(ids(w)).toEqual([]);
    w.plots['5,14'] = { watered: false, crop: null };
    expect(ids(w)).toEqual(['seedbox']);
    w.seedBox = { [seedId('cheri')]: 1 };
    expect(ids(w)).toEqual([]);
  });
});

describe('smart seed hotbar', () => {
  it('moves on to the next seed that grows, instead of the hoe', () => {
    const w = world();
    w.inventory = { [seedId('cheri')]: 1, [seedId('pecha')]: 3, [seedId('rawst')]: 9 }; // Spring: Rawst is out of season
    stand(w, 6, 12);
    select(w, 'hoe');
    useAt(w, 6, 13);
    select(w, seedId('cheri'));
    useAt(w, 6, 13);
    expect(w.selected).toBe(seedId('pecha'));
  });

  it('picks any seed under glass, and the hoe when nothing would grow', () => {
    const w = world();
    w.inventory = { [seedId('rawst')]: 2 };
    expect(nextSeed(w)).toBe('hoe');
    expect(nextSeed(w, true)).toBe(seedId('rawst'));
  });
});

describe("helpers' day report", () => {
  it('logs each job and the XP, and hands it to the morning summary', () => {
    const w = world(7); // Squirtle waters
    stand(w, 6, 12);
    for (const x of [5, 6]) {
      select(w, 'hoe');
      useAt(w, x, 13);
      select(w, seedId('oran'));
      useAt(w, x, 13);
    }
    run(w, 0.7 * 60 * 2);
    const uid = w.mons[0]!.uid;
    expect(w.workLog[uid]!.jobs).toEqual({ water: 2 });
    expect(w.workLog[uid]!.xp).toBeGreaterThan(0);
    const summary = sleep(w);
    expect(summary.helpers).toEqual([{ uid, dex: 7, work: expect.objectContaining({ jobs: { water: 2 } }) }]);
    expect(w.workLog).toEqual({});
  });
});
