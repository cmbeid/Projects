import { describe, expect, it } from 'vitest';
import { crop } from '../src/data/crops';
import { seedId } from '../src/data/items';
import { canCapacity, growNight, intentAt, isRipe, stageOf, useAt } from '../src/game/farm';
import { plotKey } from '../src/game/model';
import { select } from '../src/game/world';
import { world } from './helpers';

/** A grass tile in the open field. */
const X = 5;
const Y = 14;

function planted(id = 'oran') {
  const w = world(4);
  w.inventory[seedId(id)] = 5;
  select(w, 'hoe');
  useAt(w, X, Y);
  select(w, seedId(id));
  useAt(w, X, Y);
  return w;
}

describe('farm', () => {
  it('tills, plants and uses energy and seeds', () => {
    const w = planted();
    const plot = w.plots[plotKey(X, Y)];
    expect(plot?.crop?.id).toBe('oran');
    expect(w.player.energy).toBe(97);
    expect(w.inventory[seedId('oran')]).toBe(4);
  });

  it('grows only on watered nights, and ripens', () => {
    const w = planted();
    const plot = w.plots[plotKey(X, Y)]!;
    growNight(w, true);
    expect(plot.crop!.growth).toBe(0);
    for (let n = 0; n < crop('oran').days; n += 1) {
      select(w, 'can');
      useAt(w, X, Y);
      expect(plot.watered).toBe(true);
      growNight(w, true);
      expect(plot.watered).toBe(false);
    }
    expect(isRipe(plot.crop!)).toBe(true);
    expect(stageOf(plot.crop!)).toBe(3);
    const before = w.inventory.oran ?? 0;
    useAt(w, X, Y);
    expect(w.inventory.oran! - before).toBeGreaterThanOrEqual(1);
    expect(plot.crop).toBeNull();
  });

  it('regrows Leppa after harvest', () => {
    const w = planted('leppa');
    const plot = w.plots[plotKey(X, Y)]!;
    plot.crop!.growth = crop('leppa').days;
    useAt(w, X, Y);
    expect(plot.crop).not.toBeNull();
    expect(plot.crop!.growth).toBe(crop('leppa').days - crop('leppa').regrow!);
  });

  it('uses the can up and refills it at the pond', () => {
    const w = planted();
    w.player.water = 0;
    select(w, 'can');
    expect(intentAt(w, X, Y).kind).toBe('deny');
    expect(useAt(w, 17, 3)).toBe(true);
    expect(w.player.water).toBe(canCapacity(w));
  });

  it('refuses tool work with no energy left', () => {
    const w = world();
    w.player.energy = 1;
    select(w, 'hoe');
    expect(useAt(w, X, Y)).toBe(false);
    expect(w.plots[plotKey(X, Y)]).toBeUndefined();
  });

  it("won't till the path or plant on grass", () => {
    const w = world();
    select(w, 'hoe');
    expect(useAt(w, 11, 14)).toBe(false);
    expect(intentAt(w, 11, 14).kind).toBe('walk');
    select(w, seedId('oran'));
    expect(useAt(w, X, Y)).toBe(false);
  });

  it('lets crows at unguarded crops, but not guarded ones', () => {
    let eaten = 0;
    for (let seed = 1; seed <= 50; seed += 1) {
      const w = planted();
      w.rng.seed = seed;
      if (growNight(w, false).crowAte) eaten += 1;
      const g = planted();
      g.rng.seed = seed;
      expect(growNight(g, true).crowAte).toBeNull();
    }
    expect(eaten).toBeGreaterThan(5);
    expect(eaten).toBeLessThan(30);
  });
});
