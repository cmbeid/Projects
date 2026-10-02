import { describe, expect, it } from 'vitest';
import { RECIPES } from '../src/data/crafting';
import { CHAPTERS } from '../src/data/story';
import { craft, craftBlocker } from '../src/game/craft';
import { placeMachine } from '../src/game/machines';
import { levelOf } from '../src/game/skills';
import { world } from './helpers';

/** A new farm, Crafting level 1, with a Workbench out. */
function withBench() {
  const w = world();
  w.inventory.workbench = 1;
  expect(placeMachine(w, 'workbench', 5, 25)).toBe(true);
  return w;
}

describe('crafting', () => {
  it('builds an Apricorn Workshop at Crafting level 1, as Chapter 3 asks', () => {
    const w = withBench();
    expect(levelOf(w, 'crafting')).toBe(1);
    Object.assign(w.inventory, { wood: 10, 'hard-stone': 4, 'red-apricorn': 1 });
    expect(craftBlocker(w, 'apricorn-workshop')).toBeNull();
    expect(craft(w, 'apricorn-workshop')).toBe(true);
    expect(w.inventory['apricorn-workshop']).toBe(1);
  });

  it('never gates a station the story asks you to place behind a Crafting level', () => {
    const asked = CHAPTERS.flatMap((c) => c.objectives).flatMap((o) => (o.kind === 'place' ? [o.machine] : []));
    expect(asked.length).toBeGreaterThan(0);
    for (const id of asked) expect(RECIPES.find((r) => r.id === id)?.level ?? 1, id).toBe(1);
  });

  it('says why a recipe is out of reach', () => {
    const w = world();
    expect(craftBlocker(w, 'furnace')).toMatch(/Workbench/);
    const b = withBench();
    expect(craftBlocker(b, 'furnace')).toMatch(/^Needs 8 Hard Stone/);
    expect(craftBlocker(b, 'loom')).toMatch(/^Needs Crafting level 4: 0\/280 XP/);
  });
});
