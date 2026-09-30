import { describe, expect, it } from 'vitest';
import { seedId } from '../src/data/items';
import { growNight, useAt } from '../src/game/farm';
import { guarded } from '../src/game/helpers';
import { plotKey } from '../src/game/model';
import { select } from '../src/game/world';
import { run, stand, world } from './helpers';

function field(starter: number) {
  const w = world(starter);
  stand(w, 6, 12);
  for (const x of [5, 6, 7]) {
    select(w, 'hoe');
    useAt(w, x, 13);
    select(w, seedId('oran'));
    useAt(w, x, 13);
  }
  return w;
}

describe('helpers', () => {
  it('Squirtle waters every thirsty crop in time', () => {
    const w = field(7);
    run(w, 0.7 * 60 * 2.5); // two and a half in-game hours
    for (const x of [5, 6, 7]) expect(w.plots[plotKey(x, 13)]!.watered, `x=${x}`).toBe(true);
    expect(w.events.some((e) => e.kind === 'helper')).toBe(true);
  });

  it('Bulbasaur tends watered crops so they grow faster', () => {
    const w = field(1);
    for (const x of [5, 6, 7]) {
      select(w, 'can');
      useAt(w, x, 13);
    }
    run(w, 0.7 * 60 * 2.5);
    growNight(w, true);
    for (const x of [5, 6, 7]) expect(w.plots[plotKey(x, 13)]!.crop!.growth).toBe(1.5);
  });

  it('only Fire helpers guard', () => {
    expect(guarded(world(4))).toBe(true);
    expect(guarded(world(1))).toBe(false);
    expect(guarded(world(7))).toBe(false);
  });

  it('follows the farmer', () => {
    const w = world(4);
    stand(w, 10, 20);
    run(w, 6);
    const h = w.helpers[0]!;
    expect(Math.abs(Math.round(h.x) - 10) + Math.abs(Math.round(h.y) - 20)).toBeLessThanOrEqual(2);
  });
});
