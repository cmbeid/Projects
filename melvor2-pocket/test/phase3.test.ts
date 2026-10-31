import { describe, expect, it } from 'vitest';
import { Game, msToTicks } from '../src/engine/game';
import { newState } from '../src/engine/state';
import { unlockEverything } from '../src/engine/navigation';
import { get } from '../src/engine/content';
import { successChance, type ThievingRecipe } from '../src/engine/skills/thieving';
import { huntState } from '../src/engine/skills/hunting';
import { buyPlot, harvest, harvestQuantity, isReady, plant, plotState, farmingRecipe, water } from '../src/engine/skills/farming';
import { buyAnimal, buyLand, build, animalsIn, fixRanchingLand, maintenance, repair, repairCost } from '../src/engine/skills/ranching';
import { availableMajorPicks, knowledge, unlockMajorNode, unlockedMinorNodes } from '../src/engine/skills/astrology';
import { mod } from '../src/engine/bonuses';
import { buy, shopPurchases } from '../src/engine/shop';

const id = (s: string) => `MelvorBase:${s}`;
/** Mechanics tests start with every page unlocked; progression gating has its own tests. */
const fresh = (seed = 1) => {
  const g = new Game(newState(0, seed));
  unlockEverything(g);
  return g;
};
const HOUR = 60 * 60 * 60; // ticks

describe('player health', () => {
  it('starts at Hitpoints 10 = 100 HP and auto-eats at 25%', () => {
    const g = fresh();
    expect(g.level('Hitpoints')).toBe(10);
    expect(g.maxHp()).toBe(100);
    g.addItem(id('Shrimp'), 10); // heals 15
    g.state.selectedFood = id('Shrimp');
    g.damage(80);
    // At 20 HP (≤ 25) it eats floor(80 / 15) = 5 shrimp → 95 HP.
    expect(g.hp()).toBe(95);
    expect(g.count(id('Shrimp'))).toBe(5);
  });
});

describe('thieving', () => {
  it('success is (100 + level) / (100 + perception) and gives XP on success only', () => {
    const g = fresh(5);
    const r = get<ThievingRecipe>('ThievingRecipe', id('Citizen')); // perception 32, 7 XP
    expect(successChance(g, r)).toBeCloseTo(101 / 132);
    g.addItem(id('Shrimp'), 1000);
    g.state.selectedFood = id('Shrimp');
    g.toggle('Thieving', id('Citizen'));
    g.advance(msToTicks(3000) * 300);
    const fails = g.state.stats.failures.Thieving ?? 0;
    const actions = g.state.stats.actions.Thieving;
    // Each failure adds a 2 s stun action; successes give 7 XP.
    expect(g.state.xp.Thieving).toBe(7 * (actions - 2 * fails));
    expect(g.state.gold).toBeGreaterThan(0);
  });
});

describe('hunting', () => {
  it('surveys, tracks and traps a Wild Chicken without a trap', () => {
    const g = fresh(3);
    g.toggle('Hunting', id('WildChicken'));
    g.advance(HOUR);
    expect(huntState(g, id('WildChicken')).trapped).toBeGreaterThan(0);
    expect(g.count(id('RawChicken'))).toBeGreaterThan(0);
    expect(g.state.xp.Hunting).toBeGreaterThan(0);
  });
});

describe('farming', () => {
  it('plots grow in the background and harvest for the product and XP', () => {
    const g = fresh();
    g.state.gold = 3000;
    g.addItem(id('PotatoSeed'), 3);
    expect(buyPlot(g, id('Allotment1'))).toBeNull();
    expect(g.state.gold).toBe(0);
    expect(plant(g, id('Allotment1'), id('Potato'))).toBeNull();
    water(g, id('Allotment1'));
    const p = plotState(g, id('Allotment1'))!;
    expect(isReady(g, p)).toBe(false);
    g.toggle('Woodcutting', id('NormalTree')); // something else runs meanwhile
    g.advance(1.5 * HOUR);
    expect(isReady(g, p)).toBe(true);
    const expected = harvestQuantity(farmingRecipe(id('Potato')), p);
    harvest(g, id('Allotment1'));
    expect(g.count(id('Potato'))).toBe(expected);
    expect(g.state.xp.Farming).toBe(34);
    expect(p.recipe).toBeNull();
  });
});

describe('shop and ranching', () => {
  it('buys the Grain Mill, builds a coop and raises chickens that produce hourly', () => {
    const g = fresh(2);
    for (const [it, q] of [['OakLog', 750], ['Stone', 750], ['MoltenGlass', 750], ['NormalLog', 250], ['Grain', 1000]] as const) g.addItem(id(it), q);
    g.state.gold = 5000 + 2 * 6000;
    g.state.xp.Ranching = 1e9;
    g.state.xp.Farming = 1e9; // the Grain Mill needs Farming 10
    const mill = shopPurchases().find((s) => s.Id === 'GrainMill')!;
    expect(buy(g, mill)).toBeNull();
    expect(buyLand(g, id('Land1'))).toBeNull();
    expect(build(g, id('Land1'), id('ChickenCoopI'))).toBeNull();
    expect(buyAnimal(g, id('Land1'), id('Chicken'))).toBeNull();
    expect(buyAnimal(g, id('Land1'), id('Chicken'))).toBeNull();
    expect(buyAnimal(g, id('Land1'), id('Chicken'))).toBe('Enclosure is full');
    g.advance(10 * HOUR);
    expect(g.count(id('Egg'))).toBeGreaterThan(0);
    expect(g.count(id('Grain'))).toBe(1000 - 2 * 10 * 10);
    expect(animalsIn(g, id('Land1')).every((a) => a.variant !== id('ChickenChild'))).toBe(true);
  });
});

describe('two enclosures of the same kind', () => {
  it('keep their own animals and upkeep', () => {
    const g = fresh();
    g.state.gold = 1e9;
    for (const [it, n] of [['NormalLog', 10000], ['Grain', 10000]] as const) g.addItem(id(it), n);
    g.state.purchases[id('GrainMill')] = 1;
    g.state.xp.Ranching = 1e7;
    for (const l of ['Land1', 'Land2']) {
      expect(buyLand(g, id(l))).toBeNull();
      expect(build(g, id(l), id('ChickenCoopI'))).toBeNull();
    }
    expect(buyAnimal(g, id('Land1'), id('Chicken'))).toBeNull();
    expect(buyAnimal(g, id('Land1'), id('Chicken'))).toBeNull();
    expect(buyAnimal(g, id('Land1'), id('Chicken'))).toBe('Enclosure is full');
    expect(buyAnimal(g, id('Land2'), id('Chicken'))).toBeNull();
    expect(animalsIn(g, id('Land1'))).toHaveLength(2);
    expect(animalsIn(g, id('Land2'))).toHaveLength(1);
    g.advance(10 * HOUR + 10);
    expect(repair(g, id('Land1'))).toBeNull();
    expect(maintenance(g, id('Land1'))).toBe(1);
    expect(maintenance(g, id('Land2'))).toBeCloseTo(0.9, 5);
  });

  it('repairs saves that kept animals by enclosure kind', () => {
    const g = fresh();
    const st = g.state.ranching;
    st.land = [{ land: id('Land1'), enclosure: id('ChickenCoopI') }, { land: id('Land2'), enclosure: id('ChickenCoopI') }];
    st.maintenance = { [id('ChickenCoopI')]: { value: 0.8, nextAt: 99 } };
    for (let i = 0; i < 3; i++) st.animals.push({ id: i, animal: id('Chicken'), enclosure: id('ChickenCoopI'), variant: id('ChickenChild'), bornAt: 0, grownAt: 1, diesAt: 9e9, nextProductAt: 1, hunger: 1, petDueAt: 0 });
    fixRanchingLand(st);
    expect(st.animals.map((a) => a.land)).toEqual([id('Land1'), id('Land1'), id('Land2')]);
    expect(st.maintenance).toEqual({ [id('Land1')]: { value: 0.8, nextAt: 99 }, [id('Land2')]: { value: 0.8, nextAt: 99 } });
  });
});

describe('enclosure maintenance', () => {
  it('wears 1% an hour while animals live there, and repairs back to full for a share of the build cost', () => {
    const g = fresh();
    g.state.gold = 1e9;
    for (const [it, n] of [['NormalLog', 10000], ['Grain', 10000]] as const) g.addItem(id(it), n);
    g.state.purchases[id('GrainMill')] = 1;
    g.state.xp.Ranching = 1e7;
    expect(buyLand(g, id('Land1'))).toBeNull();
    expect(build(g, id('Land1'), id('ChickenCoopI'))).toBeNull();
    expect(buyAnimal(g, id('Land1'), id('Chicken'))).toBeNull();
    g.advance(10 * HOUR + 10);
    expect(maintenance(g, id('Land1'))).toBeCloseTo(0.9, 5);
    const logs = g.count(id('NormalLog'));
    expect(repairCost(g, id('Land1')).Items[0].Quantity).toBeGreaterThan(0);
    expect(repair(g, id('Land1'))).toBeNull();
    expect(maintenance(g, id('Land1'))).toBe(1);
    expect(g.count(id('NormalLog'))).toBeLessThan(logs);
  });
});

describe('astrology', () => {
  it('is locked in the demo, like Herblore and Agility', () => {
    const g = fresh();
    g.toggle('Astrology', id('Deedree'));
    expect(g.state.active).toBeNull();
    expect(knowledge(g, id('Deedree'))).toBe(0);
    expect(unlockedMinorNodes(g, id('Deedree'))).toHaveLength(0);
  });

  it('can be played when the player opts in, since its data is complete', () => {
    const g = fresh();
    g.state.optIn = { Astrology: true };
    g.toggle('Astrology', id('Deedree'));
    expect(g.state.active?.skill).toBe('Astrology');
    g.advance(msToTicks(3000) * 20);
    expect(g.xp('Astrology')).toBeGreaterThan(0);
    expect(knowledge(g, id('Deedree'))).toBeGreaterThan(0);
  });

  it('earns a major node pick every few minor nodes, and its bonus applies', () => {
    const g = fresh();
    g.state.optIn = { Astrology: true };
    g.state.astrology.knowledge[id('Deedree')] = 1e9;
    const per = get<{ MinorNodesPerMajorNode: number }>('AstrologyConstellation', id('Deedree')).MinorNodesPerMajorNode;
    expect(availableMajorPicks(g, id('Deedree'))).toBe(Math.floor(unlockedMinorNodes(g, id('Deedree')).length / per));
    const before = mod(g, 'WoodcuttingAction', 'WeakSpotChance', { entity: 'Woodcutting', category: id('Trees') });
    expect(unlockMajorNode(g, id('Deedree'), id('DeedreeMajor2'))).toBeNull();
    expect(mod(g, 'WoodcuttingAction', 'WeakSpotChance', { entity: 'Woodcutting', category: id('Trees') })).toBeGreaterThan(before);
  });
});

describe('beastcrafting and agility', () => {
  it('Beastcrafting uses the step-based crafting rules', () => {
    const g = fresh();
    for (const it of ['RabbitFur', 'Leather', 'String']) g.addItem(id(it), 1);
    g.toggle('Beastcrafting', id('FurCamoHat'));
    g.advance(msToTicks(3000) * 3);
    expect(g.count(id('FurCamoHat'))).toBe(1);
  });

  it('Agility has no content in the demo', () => {
    expect(fresh().handler('Agility').recipes()).toHaveLength(0);
  });
});

describe('woodcutting overgrowth', () => {
  it("Deedree's first major node spreads overgrowth onto bushes while cutting trees", async () => {
    const { overgrowth } = await import('../src/engine/skills/woodcutting');
    const g = fresh();
    g.state.optIn = { Astrology: true };
    g.state.astrology.knowledge[id('Deedree')] = 1e9;
    g.state.xp.Woodcutting = 1e9;
    expect(unlockMajorNode(g, id('Deedree'), id('DeedreeMajor1'))).toBeNull();
    g.toggle('Woodcutting', id('NormalTree'));
    g.advance(60 * 60 * 10); // ten minutes of hits at 8% each
    const bushes = Object.keys(g.state.overgrowth ?? {});
    expect(bushes.length).toBeGreaterThan(0);
    expect(overgrowth(g, bushes[0])).toBeGreaterThan(0);
  });
});
