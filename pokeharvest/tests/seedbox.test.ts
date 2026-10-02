import { describe, expect, it } from 'vitest';
import { SEED_BOX, tileAt } from '../src/data/maps';
import { seedId } from '../src/data/items';
import { intentAt, useAt } from '../src/game/farm';
import { plotKey } from '../src/game/model';
import { seedBoxCount, seedFor, stockSeedBox, takeFromSeedBox } from '../src/game/seedbox';
import { select } from '../src/game/world';
import { loadWorld, parseWorld, saveWorld } from '../src/state/save';
import { JOB_INTERVAL, seedsPerTrip, syncHelpers } from '../src/game/helpers';
import { tick, warpTo } from '../src/game/world';
import { run, stand, world } from './helpers';

const DIGLETT = 50;
const HOURS = 0.7 * 60; // real seconds per in-game hour, as in the other helper tests

/** A farm with a Ground starter and three tilled, empty plots. */
function sowField(starter = DIGLETT) {
  const w = world(starter);
  stand(w, 6, 12);
  select(w, 'hoe');
  for (const x of [5, 6, 7]) useAt(w, x, 13);
  return w;
}

function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe('seed box', () => {
  it('stands by the house, and a tap opens it', () => {
    expect(tileAt('farm', SEED_BOX.x, SEED_BOX.y)).toBe('seedbox');
    const w = world();
    stand(w, SEED_BOX.x, SEED_BOX.y + 1);
    expect(intentAt(w, SEED_BOX.x, SEED_BOX.y)).toEqual({ kind: 'use', action: 'seedbox' });
    useAt(w, SEED_BOX.x, SEED_BOX.y);
    expect(w.events.some((e) => e.kind === 'open' && e.ui === 'seedbox')).toBe(true);
  });

  it('takes seeds from the bag and gives them back, and nothing else', () => {
    const w = world();
    w.inventory[seedId('oran')] = 4;
    w.inventory.wood = 3;
    expect(stockSeedBox(w, seedId('oran'), 10)).toBe(4);
    expect(w.inventory[seedId('oran')]).toBeUndefined();
    expect(stockSeedBox(w, 'wood', 1)).toBe(0);
    expect(seedBoxCount(w)).toBe(4);
    expect(takeFromSeedBox(w, seedId('oran'), 1)).toBe(1);
    expect(w.inventory[seedId('oran')]).toBe(1);
    expect(w.seedBox[seedId('oran')]).toBe(3);
  });

  it('picks the chosen seed, else the in-season one it has most of; anything grows under glass', () => {
    const w = world(); // day 1: Spring
    w.seedBox = { [seedId('cheri')]: 2, [seedId('oran')]: 5, [seedId('rawst')]: 9 };
    expect(seedFor(w, 5, 13)).toBe(seedId('oran')); // Rawst has more, but it's a Summer berry
    expect(seedFor(w, 16, 20)).toBe(seedId('rawst')); // greenhouse soil
    w.seedChoice = seedId('cheri');
    expect(seedFor(w, 5, 13)).toBe(seedId('cheri'));
    w.seedChoice = seedId('rawst');
    expect(seedFor(w, 5, 13)).toBeNull();
    w.seedBox = {};
    w.seedChoice = 'auto';
    expect(seedFor(w, 5, 13)).toBeNull();
  });
});

describe('Ground helpers', () => {
  it('fetch seeds from the box and plant every empty plot', () => {
    const w = sowField();
    w.seedBox = { [seedId('oran')]: 2, [seedId('cheri')]: 5 };
    run(w, HOURS * 3);
    for (const x of [5, 6, 7]) expect(w.plots[plotKey(x, 13)]!.crop, `x=${x}`).toMatchObject({ id: 'cheri', growth: 0 });
    expect(w.seedBox).toEqual({ [seedId('oran')]: 2, [seedId('cheri')]: 2 });
    expect(w.events.some((e) => e.kind === 'helper' && e.text === 'Took 3 seeds')).toBe(true);
  });

  it('plant nothing from an empty box, and leave your bag alone', () => {
    const w = sowField();
    w.inventory[seedId('cheri')] = 5;
    run(w, HOURS * 3);
    for (const x of [5, 6, 7]) expect(w.plots[plotKey(x, 13)]!.crop).toBeNull();
    expect(w.inventory[seedId('cheri')]).toBe(5);
  });

  it('re-till fields gone back to grass, but never plain grass', () => {
    const w = sowField();
    delete w.plots[plotKey(6, 13)]; // as when an untended plot reverts
    run(w, HOURS * 2);
    expect(w.plots[plotKey(6, 13)]).toEqual({ watered: false, crop: null });
    expect(w.plots[plotKey(8, 13)]).toBeUndefined();
    expect(w.events.some((e) => e.kind === 'helper' && e.text === 'Dig!')).toBe(true);
  });

  it('stop working a plot you clear with the sickle', () => {
    const w = sowField();
    select(w, 'sickle');
    useAt(w, 6, 13);
    expect(w.field).not.toContain(plotKey(6, 13));
    run(w, HOURS * 2);
    expect(w.plots[plotKey(6, 13)]).toBeUndefined();
  });

  it('never share a plot, and spend one seed per plot', () => {
    const w = sowField();
    const uid = w.nextUid++;
    w.mons.push({ ...w.mons[0]!, uid });
    w.party.push(uid);
    w.seedBox = { [seedId('cheri')]: 10 };
    run(w, HOURS * 3);
    const planted = [5, 6, 7].filter((x) => w.plots[plotKey(x, 13)]!.crop);
    expect(planted).toHaveLength(3);
    expect(w.seedBox[seedId('cheri')]).toBe(7);
  });

  it('put the seed back when the plot gets planted first', () => {
    const w = sowField();
    w.seedBox = { [seedId('cheri')]: 1 };
    // Let it pick up the seed, then plant its plot ourselves.
    for (let i = 0; i < 2000 && !w.helpers[0]!.carrying.length; i += 1) run(w, 1 / 30);
    const h = w.helpers[0]!;
    expect(h.carrying).toEqual([seedId('cheri')]);
    w.plots[plotKey(h.errands[0]!.x, h.errands[0]!.y)]!.crop = { id: 'oran', growth: 0, harvests: 0, tended: false };
    for (let i = 0; i < 2000 && h.target; i += 1) run(w, 1 / 30);
    expect(w.seedBox[seedId('cheri')]).toBeGreaterThanOrEqual(1);
  });

  it('Normal types still harvest rather than sow', () => {
    const w = sowField(19); // Rattata
    w.seedBox = { [seedId('cheri')]: 5 };
    run(w, HOURS * 3);
    expect(w.seedBox[seedId('cheri')]).toBe(5);
  });
});

describe('seed box saves', () => {
  it('keeps the box, the choice and your fields, with carried seeds back in the box', () => {
    const w = sowField();
    w.seedBox = { [seedId('cheri')]: 3 };
    w.seedChoice = seedId('cheri');
    w.helpers[0]!.carrying = [seedId('oran'), seedId('oran')];
    const store = memory();
    saveWorld(w, store);
    const back = loadWorld(store)!;
    expect(back.seedBox).toEqual({ [seedId('cheri')]: 3, [seedId('oran')]: 2 });
    expect(back.seedChoice).toBe(seedId('cheri'));
    expect([...back.field].sort()).toEqual(['5,13', '6,13', '7,13']);
  });

  it('counts an old save\'s plots as fields, and hands back what stood where the box is', () => {
    const w = sowField();
    const raw = JSON.parse(JSON.stringify({ ...w, events: [], helpers: [] })) as Record<string, unknown>;
    delete raw.field;
    delete raw.seedBox;
    delete raw.seedChoice;
    raw.seedBox = { wood: 2 };
    (raw.plots as Record<string, unknown>)['12,4'] = { watered: false, crop: { id: 'pecha', growth: 1, harvests: 0, tended: false } };
    (raw.machines as Record<string, unknown>)['12,4'] = { id: 'furnace', output: null, count: 0, progress: 0, needed: 0 };
    const back = parseWorld(raw)!;
    expect([...back.field].sort()).toEqual(['5,13', '6,13', '7,13']);
    expect(back.seedBox).toEqual({});
    expect(back.seedChoice).toBe('auto');
    expect(back.plots['12,4']).toBeUndefined();
    expect(back.machines['12,4']).toBeUndefined();
    expect(back.inventory[seedId('pecha')]).toBe(1);
    expect(back.inventory.furnace).toBe(1);
  });
});

describe('sowing trips', () => {
  it('carry more seeds as they level', () => {
    expect([1, 19, 20, 34, 35, 100].map(seedsPerTrip)).toEqual([3, 3, 4, 4, 5, 5]);
  });

  it('plant a trip\'s worth from one visit to the box, then rest once', () => {
    const w = sowField();
    useAt(w, 8, 13); // a fourth plot: more than a level-5 Diglett carries
    w.seedBox = { [seedId('cheri')]: 10 };
    const h = w.helpers[0]!;
    let visits = 0;
    let rests = 0;
    let wasCarrying = false;
    let wasResting = false;
    for (let i = 0; i < 30 * HOURS * 0.9; i += 1) {
      tick(w, 1 / 30);
      if (h.carrying.length && !wasCarrying) visits += 1;
      wasCarrying = h.carrying.length > 0;
      const resting = !h.target && h.rest === JOB_INTERVAL;
      if (resting && !wasResting) rests += 1;
      wasResting = resting;
    }
    expect(visits).toBe(1);
    expect(rests).toBe(1);
    expect([5, 6, 7, 8].filter((x) => w.plots[plotKey(x, 13)]!.crop)).toHaveLength(3);
    expect(w.seedBox[seedId('cheri')]).toBe(7);
  });

  it('take no more than the box holds', () => {
    const w = sowField();
    w.seedBox = { [seedId('cheri')]: 2 };
    run(w, HOURS * 0.9);
    expect([5, 6, 7].filter((x) => w.plots[plotKey(x, 13)]!.crop)).toHaveLength(2);
    expect(w.seedBox).toEqual({});
  });

  it('two sowers split the plots between them', () => {
    const w = sowField();
    for (const x of [8, 9, 10]) useAt(w, x, 13);
    const uid = w.nextUid++;
    w.mons.push({ ...w.mons[0]!, uid });
    w.party.push(uid);
    syncHelpers(w);
    w.seedBox = { [seedId('cheri')]: 10 };
    for (let i = 0; i < 2000 && w.helpers.some((h) => !h.errands.length); i += 1) tick(w, 1 / 30);
    const [a, b] = w.helpers.map((h) => h.errands.map((p) => plotKey(p.x, p.y)));
    expect(a!.length + b!.length).toBe(6);
    expect(a!.filter((k) => b!.includes(k))).toEqual([]);
  });

  it('give every carried seed back when called away', () => {
    const w = sowField();
    w.seedBox = { [seedId('cheri')]: 5 };
    for (let i = 0; i < 2000 && !w.helpers[0]!.carrying.length; i += 1) tick(w, 1 / 30);
    expect(w.helpers[0]!.carrying).toHaveLength(3);
    warpTo(w, 'route1', 11, 1);
    expect(w.helpers[0]!.carrying).toEqual([]);
    expect(w.seedBox[seedId('cheri')]).toBe(5);
  });
});
