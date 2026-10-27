import { describe, expect, it } from 'vitest';
import { Game, msToTicks } from '../src/engine/game';
import { newState } from '../src/engine/state';
import { unlockEverything } from '../src/engine/navigation';
import { mod } from '../src/engine/bonuses';
import { checkGuild, describeTask, isDone, isSupported, points, rankIndex, ranksFor, tasksFor, totalPoints, taskKey } from '../src/engine/guild';
import { all } from '../src/engine/content';

const id = (s: string) => `MelvorBase:${s}`;
const fresh = () => {
  const g = new Game(newState(0, 1));
  unlockEverything(g);
  return g;
};

describe('Mastery Guild', () => {
  it('Woodcutting Task 1: cut 200 Normal Trees from real actions, worth 1 point', () => {
    const g = fresh();
    const task = tasksFor('Woodcutting').find((t) => t.Id === 'WoodcuttingTask1')!;
    expect(describeTask(task)).toBe('Cut 200 Normal Tree');
    g.toggle('Woodcutting', id('NormalTree'));
    g.advance(msToTicks(1000) * 3 * 199);
    expect(isDone(g, task)).toBe(false);
    g.advance(msToTicks(1000) * 3);
    expect(isDone(g, task)).toBe(true);
    expect(points(g, 'Woodcutting')).toBeGreaterThanOrEqual(1);
  });

  it('condition tasks complete from state (Woodcutting level 10)', () => {
    const g = fresh();
    const task = tasksFor('Woodcutting').find((t) => t.ConditionGoal?.Type === id('Level'))!;
    expect(isDone(g, task)).toBe(false);
    g.state.xp.Woodcutting = 1e9;
    checkGuild(g);
    expect(isDone(g, task)).toBe(true);
  });

  it('ranks at 40% / 60% of the skill total unlock the rank bonuses (+10% Woodcutting XP at Apprentice)', () => {
    const g = fresh();
    expect(totalPoints('Woodcutting')).toBe(59);
    expect(ranksFor('Woodcutting').map((r) => r.PointPercentRequired)).toEqual([0, 0.4, 0.6]);
    expect(mod(g, 'Experience', 'PercentXPGained', { entity: 'Woodcutting' })).toBe(0);
    // Finish tasks until 24 points (ceil(59 × 0.4)).
    for (const t of tasksFor('Woodcutting')) {
      if (points(g, 'Woodcutting') >= 24) break;
      g.state.guild.done[taskKey(t)] = true;
    }
    g.bonusesChanged();
    expect(rankIndex(g, 'Woodcutting')).toBe(1);
    expect(mod(g, 'Experience', 'PercentXPGained', { entity: 'Woodcutting' })).toBeCloseTo(0.1);
  });

  it('nearly every demo task can be progressed in this build', () => {
    const tasks = all<{ Id: string }>('MasteryGuildTask');
    const skills = ['Cooking', 'Crafting', 'Firemaking', 'Fishing', 'Fletching', 'Mining', 'Runecrafting', 'Smithing', 'Woodcutting', 'Farming', 'Ranching', 'Hunting', 'Beastcrafting', 'Thieving', 'Slayer', 'Attack', 'Strength', 'Defence', 'Hitpoints', 'Ranged', 'Magic', 'Prayer'];
    const owned = skills.flatMap((s) => tasksFor(s));
    expect(owned.length).toBe(834);
    expect(owned.filter((t) => !isSupported(t)).length).toBeLessThanOrEqual(30);
    expect(tasks.length).toBe(860);
  });
});

describe('guild requirement types', () => {
  it('understands equipped items, rare species, journal levels and ranching counts', async () => {
    const { Game } = await import('../src/engine/game');
    const { newState } = await import('../src/engine/state');
    const { equip } = await import('../src/engine/combat/combat');
    const g = new Game(newState(0, 1));
    const req = (Type: string, Data: Record<string, unknown>) => g.requirementMet({ Type: `MelvorBase:${Type}`, Data } as never);
    expect(req('EquipmentItemEquipped', { Item: 'MelvorBase:StoneHelmet' })).toBe(false);
    g.addItem('MelvorBase:StoneHelmet', 1);
    equip(g, 'MelvorBase:StoneHelmet');
    expect(req('EquipmentItemEquipped', { Item: 'MelvorBase:StoneHelmet' })).toBe(true);
    expect(req('HuntingUniqueRareSpeciesFound', { Count: 1 })).toBe(false);
    g.state.stats.raresFound = { 'MelvorBase:Something': true };
    expect(req('HuntingUniqueRareSpeciesFound', { Count: 1 })).toBe(true);
    expect(req('RanchingAnimalStatistic', { Animal: 'MelvorBase:Chicken', Value: 100 })).toBe(false);
    g.state.stats.ranchHoursAlive = { 'MelvorBase:Chicken': 120 };
    expect(req('RanchingAnimalStatistic', { Animal: 'MelvorBase:Chicken', Value: 100 })).toBe(true);
  });
});
