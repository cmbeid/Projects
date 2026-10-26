import { describe, expect, it } from 'vitest';
import { Game, msToTicks } from '../src/engine/game';
import { newState } from '../src/engine/state';
import { mod } from '../src/engine/bonuses';
import { equipTool, open, unequipTool } from '../src/engine/items';
import { advanceQuest, currentTask, quest, startQuest } from '../src/engine/quests';
import { setMill } from '../src/engine/skills/farming';
import { buy, shopPurchases, shopVisible } from '../src/engine/shop';

const id = (s: string) => `MelvorBase:${s}`;
const fresh = (seed = 1) => new Game(newState(0, seed));

describe('bonuses', () => {
  it('toolbelt items add their bonuses to the right skill and location only', () => {
    const g = fresh();
    g.addItem(id('SteadfastNet'), 1); // +3% Fishing doubling at specific locations
    expect(equipTool(g, id('FishingTool'), id('SteadfastNet'))).toBeNull();
    const shores = { entity: 'Fishing', location: id('ShallowShores') };
    expect(mod(g, 'FishingAction', 'DoublingChance', shores)).toBeCloseTo(0.03);
    expect(mod(g, 'FishingAction', 'DoublingChance', { entity: 'Fishing', location: id('NotAPlace') })).toBe(0);
    expect(mod(g, 'WoodcuttingAction', 'DoublingChance', { entity: 'Woodcutting' })).toBe(0);
    unequipTool(g, id('FishingTool'));
    expect(mod(g, 'FishingAction', 'DoublingChance', shores)).toBe(0);
    expect(g.count(id('SteadfastNet'))).toBe(1);
  });

  it('XP bonuses scale XP gains', () => {
    const g = fresh();
    g.addItem(id('SeashellNecklace'), 1); // +4% Fishing XP
    expect(equipTool(g, id('FishingUtility1'), id('SeashellNecklace'))).toBeNull();
    g.addXp('Fishing', 100);
    expect(g.state.xp.Fishing).toBeCloseTo(104);
    g.addXp('Mining', 100);
    expect(g.state.xp.Mining).toBe(100);
  });

  it('the bank holds 100 kinds of item until slots are bought', () => {
    const g = fresh();
    expect(g.bankSlots()).toBe(100);
    const ids = shopPurchases().slice(0, 0); // keep TS happy about the import
    expect(ids).toHaveLength(0);
    for (let i = 0; i < 100; i++) g.state.bank[`test:${i}`] = 1;
    expect(g.addItem(id('Stone'), 1)).toBe(false);
    expect(g.addItem('test:5', 1)).toBe(true);
    g.state.xp.Fishing = 1e9;
    g.state.gold = 5000;
    const slots = shopPurchases().find((p) => p.Id === 'BankSpaceFishing1')!;
    expect(buy(g, slots)).toBeNull();
    expect(g.bankSlots()).toBe(120);
    expect(g.addItem(id('Stone'), 1)).toBe(true);
  });

  it('legacy tool purchases are hidden from the shop', () => {
    const g = fresh();
    expect(shopPurchases().filter((p) => /Pickaxe$/.test(p.Id)).some((p) => shopVisible(g, p))).toBe(false);
  });
});

describe('items', () => {
  it('opens geodes for their fixed and weighted drops', () => {
    const g = fresh(3);
    g.addItem(id('Geode'), 5);
    open(g, id('Geode'), 5);
    expect(g.count(id('Geode'))).toBe(0);
    expect(g.count(id('GeodeDust'))).toBe(50);
  });
});

describe('quests', () => {
  it('Pointy Preparation: hand in arrows, then the next tasks, and get the rewards', () => {
    const g = fresh();
    const q = quest(id('MQ1'));
    expect(startQuest(g, id('MQ1'))).toBeNull();
    expect(startQuest(g, id('MQ2'))).toBe('Complete the previous quest first');
    expect(advanceQuest(g, id('MQ1'))).toMatch(/^Need 24/);
    // Give everything any task in this quest asks for, and complete goals by direct progress.
    let guard = 0;
    while (!g.state.quests[id('MQ1')].done && guard++ < 20) {
      const t = currentTask(g, id('MQ1'))!;
      for (const c of t.Costs?.Items ?? []) g.addItem(c.Item, c.Quantity);
      for (const goal of t.Goals) g.state.quests[id('MQ1')].progress[goal.Data.Id] = goal.Data.MaxProgress;
      expect(advanceQuest(g, id('MQ1'))).toBeNull();
    }
    expect(g.state.quests[id('MQ1')].done).toBe(true);
    for (const r of q.Rewards!.Items) expect(g.count(r.Item)).toBeGreaterThanOrEqual(r.Quantity);
    expect(startQuest(g, id('MQ2'))).toBeNull();
  });

  it('quest goals advance from real actions (Boarish Bonfire wood debris appears only during its task)', () => {
    const g = fresh();
    const debris = id('WoodDebris');
    const r = g.handler('Woodcutting').recipe(debris);
    expect(g.requirementsMet(r.DisplayRequirements)).toBe(false);
    g.state.quests[id('MQ3')] = { step: 0, task: 0, progress: {}, done: false };
    expect(g.requirementsMet(r.DisplayRequirements)).toBe(true);
    g.state.xp.Woodcutting = 1e9;
    g.toggle('Woodcutting', debris);
    g.advance(msToTicks(1000) * 40);
    // The first task needs one Wood Debris cut and one Stone Debris mined; the cut counts now.
    expect(g.state.quests[id('MQ3')].progress['0']).toBe(1);
    expect(g.state.quests[id('MQ3')].step).toBe(0);
  });
});

describe('grain mill', () => {
  it('mills wheat into flour every 5 minutes in the background', () => {
    const g = fresh();
    g.state.xp.Farming = 1e9;
    g.state.purchases[id('GrainMill')] = 1;
    g.addItem(id('Wheat'), 30);
    expect(setMill(g, id('Flour'))).toBeNull();
    g.advance(60 * 60 * 16); // 16 minutes
    expect(g.count(id('Flour'))).toBe(150);
    expect(g.count(id('Wheat'))).toBe(0);
    expect(g.state.mill.recipe).toBeNull();
  });
});
