import { describe, expect, it } from 'vitest';
import { addItem, count, level, newGame } from '../src/game/core';
import { advance } from '../src/game/engine';
import { equip, equipFood, startCombat, startRaid, newSlayerTask, bury, currentMonster } from '../src/game/combat';
import { startAction } from '../src/game/skilling';
import {
  buildObstacle, buyAnimal, completeQuest, harvest, lightBonfire, plant, raiseStar, startAgility, startSurvey, upgradeBuilding, buy, claimGuildTasks,
} from '../src/game/systems';
import { xpFor, levelFor } from '../src/game/xp';
import { applyOffline } from '../src/game/offline';
import { deserialize, exportSave, importSave, serialize } from '../src/state/persistence';
import { mods } from '../src/game/modifiers';

const MIN = 60_000;

describe('xp curve', () => {
  it('matches the classic table', () => {
    expect(xpFor(2)).toBe(83);
    expect(xpFor(10)).toBe(1154);
    expect(xpFor(99)).toBe(13034431);
    expect(levelFor(13034431)).toBe(99);
    expect(levelFor(82)).toBe(1);
  });
});

describe('skilling', () => {
  it('chops logs and levels up', () => {
    const s = newGame(1, 0);
    expect(startAction(s, 'wc-normal')).toBeNull();
    advance(s, 10 * MIN);
    expect(count(s, 'log-normal')).toBeGreaterThan(150);
    expect(level(s, 'woodcutting')).toBeGreaterThan(10);
  });

  it('stops when inputs run out', () => {
    const s = newGame(2, 0);
    addItem(s, 'log-normal', 5);
    startAction(s, 'fm-normal');
    advance(s, MIN);
    expect(count(s, 'log-normal')).toBe(0);
    expect(s.activity).toBeNull();
  });

  it('burns some food at low level', () => {
    const s = newGame(3, 0);
    addItem(s, 'raw-shrimp', 200);
    startAction(s, 'cook-shrimp');
    advance(s, 20 * MIN);
    expect(count(s, 'burnt-food')).toBeGreaterThan(0);
    expect(count(s, 'food-shrimp')).toBeGreaterThan(100);
  });

  it('gets stunned when a pickpocket fails', () => {
    const s = newGame(4, 0);
    startAction(s, 'thieve-villager');
    advance(s, 10 * MIN);
    expect(s.counters['fail:thieving']).toBeGreaterThan(0);
    expect(s.gp).toBeGreaterThan(100);
  });

  it('makes extra runes as runecrafting rises', () => {
    const s = newGame(5, 0);
    s.xp.runecrafting = xpFor(50);
    addItem(s, 'ore-essence', 10);
    startAction(s, 'rc-air');
    advance(s, MIN);
    expect(count(s, 'rune-air')).toBeGreaterThanOrEqual(60 + 40);
  });
});

describe('farming, ranching, settlement', () => {
  it('grows and harvests a crop', () => {
    const s = newGame(6, 0);
    expect(plant(s, 'allotment', 0, 'seed-potato', 0)).toBeNull();
    expect(harvest(s, 'allotment', 0)).toBe('Not ready yet');
    advance(s, 10 * MIN);
    harvest(s, 'allotment', 0);
    expect(s.farm.allotment[0]!.seed).toBeNull();
  });

  it('ranch animals produce over time, eating feed', () => {
    const s = newGame(7, 0);
    s.gp = 10_000;
    s.xp.ranching = xpFor(10);
    expect(buyAnimal(s, 0, 'chicken')).toBeNull();
    addItem(s, 'crop-wheat', 5);
    advance(s, 30 * MIN);
    expect(count(s, 'egg')).toBe(5);
    expect(count(s, 'crop-wheat')).toBe(0);
  });

  it('builds a cottage and a lumber yard that produces', () => {
    const s = newGame(8, 0);
    s.gp = 1e6;
    s.xp.construction = xpFor(10);
    addItem(s, 'plank-normal', 500);
    addItem(s, 'nails', 500);
    addItem(s, 'stone-block', 500);
    expect(upgradeBuilding(s, 'cottage')).toBeNull();
    expect(upgradeBuilding(s, 'lumberyard')).toBeNull();
    advance(s, 60 * MIN);
    expect(count(s, 'log-oak')).toBe(30);
  });
});

describe('agility, cartography, astrology, firemaking', () => {
  it('runs a course', () => {
    const s = newGame(9, 0);
    s.gp = 1e6;
    addItem(s, 'log-normal', 100);
    expect(buildObstacle(s, 'ob-0-0')).toBeNull();
    expect(mods(s)['interval:woodcutting']).toBe(3);
    expect(startAgility(s)).toBeNull();
    advance(s, 5 * MIN);
    expect(s.counters['laps']).toBeGreaterThan(50);
  });

  it('surveys hexes and finds landmarks', () => {
    const s = newGame(10, 0);
    expect(startSurvey(s)).toBeNull();
    advance(s, 60 * MIN);
    expect(s.surveyed.length).toBeGreaterThan(4);
    expect(s.counters['poisFound']).toBeGreaterThan(0);
  });

  it('raises a star with stardust', () => {
    const s = newGame(11, 0);
    addItem(s, 'stardust', 100);
    expect(raiseStar(s, 'hearth', 0)).toBeNull();
    expect(mods(s)['skillXP:firemaking']).toBe(1);
  });

  it('lights a bonfire for a timed bonus', () => {
    const s = newGame(12, 0);
    addItem(s, 'log-normal', 10);
    expect(lightBonfire(s, 'normal')).toBeNull();
    expect(mods(s)['skillXP']).toBe(2);
    advance(s, 6 * MIN);
    expect(mods(s)['skillXP'] ?? 0).toBe(0);
  });
});

describe('combat', () => {
  it('kills chickens and gathers loot', () => {
    const s = newGame(13, 0);
    equip(s, 'bronze-dagger');
    equipFood(s, 'food-shrimp');
    expect(startCombat(s, 'farms', 'chicken')).toBeNull();
    advance(s, 10 * MIN);
    expect(s.counters['kill:chicken']).toBeGreaterThan(20);
    expect(s.loot.length).toBeGreaterThan(0);
    expect(level(s, 'attack')).toBeGreaterThan(5);
  });

  it('dies to something far too strong and loses an item', () => {
    const s = newGame(14, 0);
    s.quests.push('into-the-rift');
    equip(s, 'bronze-dagger');
    startCombat(s, 'rift', 'void-hound');
    advance(s, 5 * MIN);
    expect(s.counters['deaths']).toBe(1);
    expect(s.loadouts[0]!.weapon).toBeUndefined();
    expect(s.combat).toBeNull();
  });

  it('ends a hardcore save on death', () => {
    const s = newGame(15, 0, 'hardcore');
    s.quests.push('into-the-rift');
    startCombat(s, 'rift', 'void-hound');
    advance(s, 5 * MIN);
    expect(s.dead).toBe(true);
  });

  it('blocks a slayer area without the item', () => {
    const s = newGame(16, 0);
    expect(startCombat(s, 'crypt', 'ghost')).toMatch(/Holy Symbol/);
  });

  it('clears a dungeon with a strong character', () => {
    const s = newGame(17, 0);
    for (const k of ['attack', 'strength', 'defence', 'hitpoints'] as const) s.xp[k] = xpFor(60);
    s.hp = 600;
    addItem(s, 'adamant-sword', 1);
    equip(s, 'adamant-sword');
    for (const p of ['helmet', 'platebody', 'platelegs', 'shield'] as const) {
      addItem(s, `adamant-${p}`, 1);
      equip(s, `adamant-${p}`);
    }
    addItem(s, 'food-shark', 200);
    equipFood(s, 'food-shark');
    s.upgrades['autoeat'] = 3;
    expect(startCombat(s, 'warren')).toBeNull();
    advance(s, 20 * MIN);
    expect(s.counters['clear:warren']).toBeGreaterThan(0);
  });

  it('casts spells, using runes', () => {
    const s = newGame(18, 0);
    equip(s, 'staff');
    startCombat(s, 'farms', 'chicken');
    advance(s, 2 * MIN);
    expect(count(s, 'rune-air')).toBeLessThan(60);
    expect(s.xp.magic).toBeGreaterThan(0);
  });

  it('shoots arrows', () => {
    const s = newGame(19, 0);
    equip(s, 'normal-shortbow');
    equip(s, 'bronze-arrows');
    startCombat(s, 'farms', 'chicken');
    advance(s, 2 * MIN);
    expect(s.xp.ranged).toBeGreaterThan(0);
  });

  it('runs the Gauntlet and pays coins', () => {
    const s = newGame(20, 0);
    for (const k of ['attack', 'strength', 'defence', 'hitpoints'] as const) s.xp[k] = xpFor(40);
    startRaid(s, 'melee');
    advance(s, 60 * MIN);
    expect(s.raid).toBeNull();
    expect(s.raidCoins).toBeGreaterThan(0);
    expect(s.raidBest).toBeGreaterThan(0);
  });

  it('hands out and counts down slayer tasks', () => {
    const s = newGame(21, 0);
    expect(newSlayerTask(s, 'easy')).toBeNull();
    const m = s.slayerTask!.monster;
    expect(m).toBeTruthy();
    expect(newSlayerTask(s, 'easy')).toMatch(/already/);
  });

  it('buries bones for prayer', () => {
    const s = newGame(22, 0);
    addItem(s, 'big-bones', 10);
    expect(bury(s, 'big-bones', 10)).toBeNull();
    expect(s.prayerPoints).toBe(150);
    expect(s.xp.prayer).toBe(150);
  });

  it('picks dungeon monsters in order', () => {
    const s = newGame(23, 0);
    startCombat(s, 'warren');
    expect(currentMonster(s)!.id).toBe('goblin');
  });
});

describe('meta', () => {
  it('claims guild tasks and ranks up', () => {
    const s = newGame(24, 0);
    s.xp.woodcutting = xpFor(50);
    claimGuildTasks(s);
    expect(s.guilds.woodcutting!.claimed).toContain('woodcutting-lvl-15');
    expect(mods(s)['skillXP:woodcutting']).toBeGreaterThan(0);
  });

  it('completes a quest', () => {
    const s = newGame(25, 0);
    s.counters['action:wc-normal'] = 20;
    s.counters['action:fish-shrimp'] = 10;
    s.counters['action:cook-shrimp'] = 10;
    expect(completeQuest(s, 'fresh-start')).toBeNull();
    expect(s.quests).toContain('fresh-start');
  });

  it('buys upgrades with growing prices', () => {
    const s = newGame(26, 0);
    s.gp = 100_000;
    expect(buy(s, 'axe')).toBeNull();
    expect(buy(s, 'axe')).toBeNull();
    expect(s.upgrades['axe']).toBe(2);
    expect(mods(s)['interval:woodcutting']).toBe(10);
    expect(buy(s, 'plot-allotment')).toBeNull();
    advance(s, 1000);
    expect(s.farm.allotment.length).toBe(4);
  });

  it('caps levels in Ancient Relics mode', () => {
    const s = newGame(27, 0, 'relics');
    s.xp.woodcutting = xpFor(50);
    expect(level(s, 'woodcutting')).toBe(10);
    s.relics.woodcutting = 2;
    expect(level(s, 'woodcutting')).toBe(50);
  });

  it('locks skills in Adventure mode', () => {
    const s = newGame(28, 0, 'adventure', 'fishing');
    expect(startAction(s, 'wc-normal')).toBe('Skill locked');
    expect(startAction(s, 'fish-shrimp')).toBeNull();
  });
});

describe('offline and saves', () => {
  it('applies time away and reports it', () => {
    const s = newGame(29, 0);
    startAction(s, 'mine-copper');
    const r = applyOffline(s, 3600)!;
    expect(r.items['ore-copper']).toBeGreaterThan(1000);
    expect(r.xp.mining).toBeGreaterThan(0);
  });

  it('caps offline time', () => {
    const s = newGame(30, 0);
    const r = applyOffline(s, 72 * 3600)!;
    expect(r.capped).toBe(true);
    expect(r.seconds).toBe(24 * 3600);
  });

  it('round-trips a save and an export code', () => {
    const s = newGame(31, 0);
    startAction(s, 'wc-normal');
    advance(s, MIN);
    const t = deserialize(serialize(s))!;
    expect(t.bank).toEqual(s.bank);
    const u = importSave(exportSave(s))!;
    expect(u.xp).toEqual(s.xp);
    expect(deserialize('{nope')).toBeNull();
  });

  it('fills in fields a save is missing', () => {
    const s = newGame(32, 0);
    const raw = JSON.parse(serialize(s));
    delete raw.ranch;
    delete raw.settings;
    const t = deserialize(JSON.stringify(raw))!;
    expect(t.ranch.length).toBe(2);
    expect(t.settings.sound).toBe(true);
  });
});
