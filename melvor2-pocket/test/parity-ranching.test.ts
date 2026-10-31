// Ranching features from the desktop: treats, removing animals, repairing every enclosure.
import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/game';
import { newState } from '../src/engine/state';
import { unlockEverything } from '../src/engine/navigation';
import { blockTreat, buyAnimal, buyLand, build, animalsIn, happiness, maintenance, removeAllAnimals, removeAnimal, repairAll } from '../src/engine/skills/ranching';
import { buy, shopPurchases } from '../src/engine/shop';

const id = (s: string) => `MelvorBase:${s}`;
const DAY = 24 * 60 * 60 * 60; // ticks

/** A coop on Land1 with two chickens. */
function ranch(seed = 1) {
  const g = new Game(newState(0, seed));
  unlockEverything(g);
  for (const [it, q] of [['OakLog', 750], ['Stone', 750], ['MoltenGlass', 750], ['NormalLog', 250], ['Grain', 5000]] as const) g.addItem(id(it), q);
  g.state.gold = 1e6;
  g.state.xp.Ranching = 1e9;
  g.state.xp.Farming = 1e9;
  buy(g, shopPurchases().find((s) => s.Id === 'GrainMill')!);
  buyLand(g, id('Land1'));
  build(g, id('Land1'), id('ChickenCoopI'));
  return g;
}

describe('parity: ranching', () => {
  it('treats are given on arrival and daily, and add satisfaction', () => {
    const g = ranch();
    g.addItem(id('Corn'), 1);
    expect(buyAnimal(g, id('Land1'), id('Chicken'))).toBeNull();
    const [a] = animalsIn(g, id('Land1'));
    expect(a.treats?.[id('Corn')]).toBe(true);
    expect(g.count(id('Corn'))).toBe(0);
    const treated = happiness(g, a);
    // No corn left: the next daily treat time leaves it without, and it's less happy.
    g.advance(DAY + 60);
    expect(a.treats?.[id('Corn')]).toBe(false);
    expect(happiness(g, a)).toBeLessThan(treated);
  });

  it('blocked treats are never handed out', () => {
    const g = ranch();
    g.addItem(id('Corn'), 5);
    blockTreat(g, id('Corn'), true);
    buyAnimal(g, id('Land1'), id('Chicken'));
    expect(g.count(id('Corn'))).toBe(5);
  });

  it('animals can be removed, one or all, with no refund', () => {
    const g = ranch();
    buyAnimal(g, id('Land1'), id('Chicken'));
    buyAnimal(g, id('Land1'), id('Chicken'));
    const gold = g.state.gold;
    removeAnimal(g, animalsIn(g, id('Land1'))[0].id);
    expect(animalsIn(g, id('Land1')).length).toBe(1);
    removeAllAnimals(g, id('Land1'));
    expect(animalsIn(g, id('Land1')).length).toBe(0);
    expect(g.state.gold).toBe(gold);
  });

  it('repair all fixes every worn enclosure', () => {
    const g = ranch();
    buyAnimal(g, id('Land1'), id('Chicken'));
    g.state.ranching.maintenance![id('Land1')].value = 0.5;
    g.addItem(id('NormalLog'), 1000);
    g.addItem(id('OakLog'), 1000);
    g.addItem(id('Stone'), 1000);
    expect(repairAll(g)).toBeNull();
    expect(maintenance(g, id('Land1'))).toBe(1);
  });
});
