// Non-combat bonuses and unlocks checked against the desktop game's code (the parity pass).
import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/game';
import { newState } from '../src/engine/state';
import { unlockEverything } from '../src/engine/navigation';
import { mod } from '../src/engine/bonuses';
import { describeBlock } from '../src/engine/describe';
import { get, tryGet, type Requirement } from '../src/engine/content';
import { equipTool } from '../src/engine/items';
import { shopVisible, type ShopPurchase } from '../src/engine/shop';

const id = (s: string) => `MelvorBase:${s}`;
const fresh = (seed = 1) => {
  const g = new Game(newState(0, seed));
  unlockEverything(g);
  return g;
};
const buy = (g: Game, p: string) => {
  g.state.purchases[id(p)] = 1;
  g.bonusesChanged();
};
const purchase = (p: string) => get<ShopPurchase>('ShopPurchase', id(p));

describe('parity: bonuses and unlocks', () => {
  it('global bonuses feed their stat group: AutoEat2 raises the auto-eat threshold and describes itself', () => {
    const g = fresh();
    g.state.hp = null;
    const before = g.autoEatAt();
    buy(g, 'AutoEat2');
    expect(g.autoEatAt()).toBe(Math.round(0.3 * g.maxHp()));
    expect(g.autoEatAt()).toBeGreaterThan(before);
    expect(() => describeBlock(purchase('AutoEat2').Provides.Bonuses as never)).not.toThrow();
  });

  it('dungeon completions unlock purchases that ask for them', () => {
    const g = fresh();
    const reqs = purchase('BankSpaceCombat1').Requirements as Requirement[];
    expect(reqs.some((r) => r.Type === id('DungeonStatistic'))).toBe(true);
    const dungeon = reqs.find((r) => r.Type === id('DungeonStatistic'))!.Data as { Dungeon: string; Value: number };
    g.state.combat.dungeonsDone[dungeon.Dungeon] = dungeon.Value;
    for (const r of reqs.filter((x) => x.Type === id('DungeonStatistic'))) expect(g.requirementMet(r)).toBe(true);
  });

  it('axe bindings add bird nest chance, scoped to the nest only', () => {
    const g = fresh();
    const ctx = (item: string) => ({ entity: 'Woodcutting', item });
    expect(mod(g, 'WoodcuttingAction', 'FlatOnHitItemChance', ctx(id('BirdNest')))).toBe(0);
    buy(g, 'BasicAxeBinding');
    expect(mod(g, 'WoodcuttingAction', 'FlatOnHitItemChance', ctx(id('BirdNest')))).toBeGreaterThan(0);
    expect(mod(g, 'WoodcuttingAction', 'FlatOnHitItemChance', { entity: 'Woodcutting' })).toBe(0);
  });

  it('hunting tool upgrades apply to animals tracked with that tool', () => {
    const g = fresh();
    buy(g, 'OakTrackingStick');
    const bonus = purchase('OakTrackingStick').Provides.Bonuses!.Component![0] as { Stat: { Name: string } };
    expect(mod(g, 'HuntingAction', bonus.Stat.Name, { entity: 'Hunting', tool: id('TrackingStick') })).not.toBe(0);
  });

  it('a Tame Elk trapped meets the Elk’s species requirement', () => {
    const g = fresh();
    const req: Requirement = { Type: id('HuntingAnimalSpecies'), Data: { Species: id('TameElk'), Value: 1 } } as never;
    expect(g.requirementMet(req)).toBe(false);
    g.state.stats.speciesTrapped = { [id('TameElk')]: 1 };
    expect(g.requirementMet(req)).toBe(true);
  });

  it('consumable toolbelt items are used up: oven mitts per basic recipe cooked', () => {
    const g = fresh();
    g.addItem(id('RabbitOvenMitts'), 20);
    expect(equipTool(g, id('CookingGloves'), id('RabbitOvenMitts'))).toBeNull();
    g.addItem(id('RawShrimp'), 10);
    g.toggle('Cooking', id('Shrimp'));
    g.advance(60 * 60);
    const left = g.state.toolbelt[id('CookingGloves')]?.qty ?? 0;
    const cooked = g.count(id('Shrimp'));
    expect(cooked).toBeGreaterThan(0);
    expect(left).toBe(20 - cooked);
  });

  it('the bonfire unlock is hidden: the demo has no bonfires', () => {
    const g = fresh();
    const p = tryGet<ShopPurchase>('ShopPurchase', id('UnlockBonfire'));
    if (p) expect(shopVisible(g, p)).toBe(false);
  });
});
