import { describe, expect, it } from 'vitest';
import { canCraft, canUpgrade, craft, upgrade } from '../src/game/crafting';
import { canLearn, equip, grantXp, learn } from '../src/game/crew';
import { derive, effStat } from '../src/game/derive';
import { seeded } from '../src/game/rng';
import { started } from './helpers';

describe('crew', () => {
  it('XP levels everyone up and hands out points', () => {
    const s = started();
    const c = s.crew[0]!;
    grantXp(s, 500);
    expect(c.level).toBeGreaterThan(2);
    expect(c.skillPts).toBeGreaterThan(0);
  });

  it('skills need the level, the class and the one before', () => {
    const s = started();
    const eng = s.crew.find((c) => c.cls === 'engineer')!;
    eng.level = 5;
    eng.skillPts = 3;
    expect(canLearn(eng, 'eng-shield')).toBe(false);
    expect(learn(eng, 'eng-weld')).toBe(true);
    expect(canLearn(eng, 'eng-shield')).toBe(true);
    expect(canLearn(eng, 'pil-jink')).toBe(false);
  });

  it('gear changes stats', () => {
    const s = started();
    const c = s.crew[0]!;
    const before = effStat(s, c, 'wits');
    const g = { uid: 999, base: 'm-wits', rarity: 0, affixes: [] };
    s.gear.push(g);
    equip(s, c, 999);
    expect(effStat(s, c, 'wits')).toBe(before + 2);
  });
});

describe('fabricator and shipyard', () => {
  it('smelts alloy and makes gear', () => {
    const s = started();
    s.mats.ore = 8;
    expect(canCraft(s, 'r-alloy')).toBe(true);
    const alloy = s.mats.alloy;
    craft(s, seeded(1), 'r-alloy');
    expect(s.mats.alloy).toBe(alloy + 1);
    s.mats.alloy = 10;
    s.mats.ore = 10;
    const n = s.gear.length;
    expect(craft(s, seeded(1), 'r-t-satchel')).toBeTruthy();
    expect(s.gear.length).toBe(n + 1);
  });

  it('respects the fabricator tier', () => {
    const s = started();
    for (const k of Object.keys(s.mats) as (keyof typeof s.mats)[]) s.mats[k] = 99;
    expect(canCraft(s, 'r-exotic')).toBe(false);
    s.modules.fabricator = 3;
    expect(canCraft(s, 'r-exotic')).toBe(true);
  });

  it('upgrades a module when you can pay', () => {
    const s = started();
    expect(canUpgrade(s, 'plating')).toBe(false);
    s.mats.alloy = 10;
    s.mats.ore = 20;
    s.res.credits = 200;
    const hull = derive(s).maxHull;
    expect(upgrade(s, 'plating')).toBe(true);
    expect(derive(s).maxHull).toBeGreaterThan(hull);
  });
});
