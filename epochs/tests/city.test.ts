import { describe, expect, it } from 'vitest';
import { assign, build, buildCost, countLine, demolish, modernize, modernizeCost, outdatedCount } from '../src/game/city';
import { derive } from '../src/game/derive';
import { newGame, tick } from '../src/game/engine';
import { advance } from '../src/game/progress';

function rich(): ReturnType<typeof newGame> {
  const s = newGame(3);
  for (const k of Object.keys(s.res) as (keyof typeof s.res)[]) s.res[k] = 1e12;
  return s;
}

describe('the city', () => {
  it('builds on a free plot, and each one costs more', () => {
    const s = rich();
    const first = buildCost(s, 'farm')!;
    expect(build(s, 'farm')).toBe(true);
    expect(countLine(s, 'farm')).toBe(1);
    expect(buildCost(s, 'farm')!.wood!).toBeGreaterThan(first.wood!);
  });

  it('stops when the land runs out', () => {
    const s = rich();
    const land = derive(s).plotsTotal;
    for (let i = 0; i < land; i++) expect(build(s, 'home')).toBe(true);
    expect(build(s, 'home')).toBe(false);
  });

  it('cannot build what the era does not have', () => {
    const s = rich();
    expect(build(s, 'mine')).toBe(false);
    expect(build(s, 'power')).toBe(false);
  });

  it('modernizes old buildings in place after an era advance', () => {
    const s = rich();
    build(s, 'home');
    const plot = s.plots.findIndex(Boolean);
    s.era = 1;
    expect(outdatedCount(s, 'home')).toBe(1);
    expect(modernizeCost(s, 'home')).not.toBeNull();
    expect(modernize(s, 'home')).toBe(true);
    expect(s.plots[plot]).toEqual({ line: 'home', era: 1 });
    expect(outdatedCount(s, 'home')).toBe(0);
  });

  it('houses more people in a newer home', () => {
    const s = rich();
    build(s, 'home');
    const before = derive(s).housing;
    s.era = 1;
    modernize(s, 'home');
    expect(derive(s).housing).toBeGreaterThan(before);
  });

  it('puts people to work from the foragers, up to the slots', () => {
    const s = rich();
    build(s, 'farm');
    const foragers = s.jobs.forager;
    expect(assign(s, 'farmer', 10)).toBe(2);
    expect(s.jobs.farmer).toBe(2);
    expect(s.jobs.forager).toBe(foragers - 2);
    expect(assign(s, 'farmer', -1)).toBe(-1);
  });

  it('lays people off when their workplace comes down', () => {
    const s = rich();
    build(s, 'farm');
    assign(s, 'farmer', 2);
    demolish(s, 'farm');
    expect(s.jobs.farmer).toBe(0);
    tick(s, 0.1);
    expect(s.jobs.forager).toBe(Math.floor(s.pop));
  });

  it('feeds people from farms, and they grow to fill the homes', () => {
    const s = newGame(5);
    s.res.food = 100;
    for (let i = 0; i < 600; i++) tick(s, 1, { events: false });
    expect(Math.floor(s.pop)).toBe(derive(s).housing);
  });

  it('advances an era only when the goals are met', () => {
    const s = rich();
    expect(advance(s)).toBe(false);
  });
});
