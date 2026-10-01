import { describe, expect, it } from 'vitest';
import { seedId } from '../src/data/items';
import { UPGRADE_COSTS } from '../src/data/progress';
import { startUpgrade, upgradeBlocker } from '../src/game/economy';
import { actionCost, canCapacity, useAt } from '../src/game/farm';
import { plotKey } from '../src/game/model';
import { addSkillXp, choosePerk, levelOf } from '../src/game/skills';
import { select, sleep } from '../src/game/world';
import { stand, world } from './helpers';

describe('tools', () => {
  it('upgrades overnight at the blacksmith for gold and stones', () => {
    const w = world();
    expect(upgradeBlocker(w, 'hoe')).toMatch(/Hard Stone/);
    w.inventory['hard-stone'] = 5;
    expect(startUpgrade(w, 'hoe')).toBe(true);
    expect(w.player.gold).toBe(500 - UPGRADE_COSTS[1]!.gold);
    expect(w.inventory['hard-stone']).toBeUndefined();
    expect(upgradeBlocker(w, 'can')).toMatch(/already working/);
    expect(w.tools.hoe).toBe(0);
    const summary = sleep(w);
    expect(w.tools.hoe).toBe(1);
    expect(summary.upgraded).toBe('Copper Hoe');
  });

  it('tills three in a row with a copper hoe, and a square with steel', () => {
    const w = world();
    w.tools.hoe = 1;
    stand(w, 5, 12);
    w.player.facing = 'down';
    select(w, 'hoe');
    useAt(w, 5, 13);
    expect(['5,13', '5,14', '5,15'].every((k) => w.plots[k])).toBe(true);
    w.tools.hoe = 2;
    useAt(w, 8, 21);
    expect(Object.keys(w.plots)).toHaveLength(3 + 9);
    expect(actionCost(w, 'till')).toBe(5);
  });

  it('waters an area with an upgraded can, and holds more', () => {
    const w = world();
    w.tools.can = 2;
    w.player.water = canCapacity(w);
    expect(w.player.water).toBe(40);
    for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) w.plots[plotKey(10 + dx, 20 + dy)] = { watered: false, crop: { id: 'oran', growth: 0, harvests: 0, tended: false } };
    select(w, 'can');
    useAt(w, 10, 20);
    expect(Object.values(w.plots).every((p) => p.watered)).toBe(true);
    expect(w.player.water).toBe(31);
  });
});

describe('skills', () => {
  it('levels up, raises max energy and offers perks at 5', () => {
    const w = world();
    addSkillXp(w, 'farming', 450);
    expect(levelOf(w, 'farming')).toBe(5);
    expect(w.player.maxEnergy).toBe(112);
    expect(w.pendingPerks).toEqual([{ skill: 'farming', level: 5 }]);
    expect(choosePerk(w, 'trainer')).toBe(false);
    expect(choosePerk(w, 'hardy')).toBe(true);
    expect(w.pendingPerks).toEqual([]);
    expect(actionCost(w, 'till')).toBe(2);
  });

  it('earns farming XP from work', () => {
    const w = world();
    stand(w, 5, 12);
    select(w, 'hoe');
    useAt(w, 5, 13);
    select(w, seedId('oran'));
    useAt(w, 5, 13);
    expect(w.skills.farming).toBe(2);
  });
});
