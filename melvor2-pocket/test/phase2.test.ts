import { describe, expect, it } from 'vitest';
import { Game, msToTicks } from '../src/engine/game';
import { newState } from '../src/engine/state';
import { stepsLeft } from '../src/engine/skills/artisan';
import { successChance } from '../src/engine/skills/cooking';
import { get, type CookingRecipe } from '../src/engine/content';

const id = (s: string) => `MelvorBase:${s}`;
const fresh = (seed = 1) => new Game(newState(0, seed));
const step = msToTicks(2000);

describe('artisan skills', () => {
  it('Smithing: needs every step before the item, and only spends ingredients at the end', () => {
    const g = fresh();
    g.addItem(id('Stone'), 4); // Stone Sword: 2 Stone, 2 steps of 2 s, 6 XP
    g.toggle('Smithing', id('StoneSword'));
    g.advance(step);
    expect(g.count(id('StoneSword'))).toBe(0);
    expect(g.count(id('Stone'))).toBe(4);
    expect(stepsLeft(g, id('StoneSword'))).toBe(1);
    g.advance(step);
    expect(g.count(id('StoneSword'))).toBe(1);
    expect(g.count(id('Stone'))).toBe(2);
    expect(g.state.xp.Smithing).toBe(6);
    g.advance(step * 10);
    expect(g.count(id('StoneSword'))).toBe(2);
    expect(g.count(id('Stone'))).toBe(0);
    expect(g.state.active).toBeNull();
  });

  it('keeps step progress per recipe when you switch away', () => {
    const g = fresh();
    g.addItem(id('Stone'), 10);
    g.toggle('Smithing', id('StoneSword'));
    g.advance(step);
    g.stop();
    expect(stepsLeft(g, id('StoneSword'))).toBe(1);
  });

  it('Fletching, Crafting and Runecrafting make their products', () => {
    const g = fresh();
    g.addItem(id('NormalLog'), 1);
    g.toggle('Fletching', id('ArrowShaft'));
    g.advance(step);
    expect(g.count(id('ArrowShaft'))).toBe(20);

    g.addItem(id('RuneEssence'), 3);
    g.toggle('Runecrafting', id('AirRune'));
    g.advance(step * 3);
    expect(g.count(id('AirRune'))).toBe(3);

    g.addItem(id('Leather'), 1);
    g.toggle('Crafting', id('LeatherVambraces'));
    g.advance(step * 2);
    expect(g.count(id('LeatherVambraces'))).toBe(1);
  });

  it('refuses to start without ingredients', () => {
    const g = fresh();
    expect(g.blockReason('Smithing', id('StoneSword'))).toMatch(/^Need 2/);
  });
});

describe('cooking', () => {
  it('success chance follows (69 + level) / (69 + difficulty)', () => {
    const g = fresh();
    const shrimp = get<CookingRecipe>('CookingRecipe', id('Shrimp')); // difficulty 31
    expect(successChance(g, shrimp)).toBeCloseTo(70 / 100);
    g.state.xp.Cooking = 1e9; // level 60
    expect(successChance(g, shrimp)).toBe(1);
  });

  it('spends the raw fish on success and failure, and only successes give food and XP', () => {
    const g = fresh(11);
    g.addItem(id('RawShrimp'), 200);
    g.toggle('Cooking', id('Shrimp'));
    g.advance(msToTicks(3000) * 200);
    const cooked = g.count(id('Shrimp'));
    const failed = g.state.stats.failures.Cooking ?? 0;
    expect(g.count(id('RawShrimp'))).toBe(0);
    expect(cooked + failed).toBe(200);
    expect(g.state.xp.Cooking).toBe(5 * cooked);
    expect(cooked / 200).toBeGreaterThan(0.6); // starts at 70%, rising as Cooking levels up
  });
});

describe('herblore', () => {
  it('is entirely locked in the demo', () => {
    const g = fresh();
    const h = g.handler('Herblore');
    expect(h.recipes().length).toBe(152);
    expect(h.recipes().every((r) => g.blockReason('Herblore', r) === 'Not in demo')).toBe(true);
  });
});
