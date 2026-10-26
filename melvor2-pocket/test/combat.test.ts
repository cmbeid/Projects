import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/game';
import { newState } from '../src/engine/state';
import {
  accuracyRating, attackInterval, combatLevel, evasionRating, hitChance, maxHit, resistance,
} from '../src/engine/combat/stats';
import { areaEnemies, bury, enemyFighter, equip, fight, newSlayerTask, playerFighter, prayerPoints, togglePrayer, unequip } from '../src/engine/combat/combat';

const id = (s: string) => `MelvorBase:${s}`;
const fresh = (seed = 1) => new Game(newState(0, seed));
const MIN = 60 * 60; // ticks

describe('combat formulas (worked by hand from the game code)', () => {
  it('player with fists vs a Golbin', () => {
    const g = fresh();
    const p = playerFighter(g);
    const e = enemyFighter(id('Golbin'));
    // Accuracy: floor((Attack 1 + 9) × (Stab bonus 0 + 64)) = 640.
    expect(accuracyRating(p)).toBe(640);
    // Golbin evasion vs stab: (Defence 1 + 9) × (StabDefence 4 + 64) = 680.
    expect(evasionRating(e, p.stance)).toBe(680);
    expect(hitChance(640, 680)).toBeCloseTo(640 / 2 / 680);
    // Max hit: floor(22 + Strength 1 + (1 + 17) × 0 / 64) = 23. Fists are a 4 s weapon.
    expect(maxHit(p)).toBe(23);
    expect(attackInterval(p)).toBe(4000);
    // Power 1 (no weapon power) vs protection 1: half the damage is resisted.
    expect(resistance(p, e)).toBeCloseTo(0.5);
  });

  it('Golbin attacking the player', () => {
    const g = fresh();
    const p = playerFighter(g);
    const e = enemyFighter(id('Golbin'));
    // floor(22 + 1 + 18 × (−50) / 64) = 8.
    expect(maxHit(e)).toBe(8);
    expect(accuracyRating(e)).toBe((2 + 9) * (11 + 64));
    expect(attackInterval(e)).toBe(2400);
    expect(e.maxHp).toBe(20);
    expect(resistance(e, p)).toBe(0);
    expect(combatLevel(p, p.style)).toBe(1);
  });

  it('equipping a Stone Sword adds its stats and power rating', () => {
    const g = fresh();
    g.addItem(id('StoneSword'), 1);
    expect(equip(g, id('StoneSword'))).toBeNull();
    const p = playerFighter(g);
    expect(attackInterval(p)).toBe(2700);
    expect(p.power).toBe(56);
    expect(maxHit(p)).toBe(Math.floor(22 + 1 + (18 * 12) / 64));
    unequip(g, id('Weapon'));
    expect(g.count(id('StoneSword'))).toBe(1);
  });
});

describe('fighting', () => {
  it('kills Golbins for loot and combat XP, eating food when low', () => {
    const g = fresh(4);
    g.addItem(id('StoneSword'), 1);
    equip(g, id('StoneSword'));
    g.addItem(id('Shrimp'), 500);
    g.state.selectedFood = id('Shrimp');
    fight(g, id('GolbinForest'), id('Golbin'));
    expect(g.state.active?.skill).toBe('Combat');
    g.advance(30 * MIN);
    const kills = g.state.combat.kills[id('Golbin')] ?? 0;
    expect(kills).toBeGreaterThan(10);
    expect(g.count(id('Bone'))).toBe(kills);
    expect(g.state.gold).toBeGreaterThanOrEqual(10 * kills);
    expect(g.xp('Attack')).toBeGreaterThan(0);
    expect(g.xp('Hitpoints')).toBeGreaterThan(1154);
    expect(g.state.active?.skill).toBe('Combat');
  });

  it('dies with no food left, loses the death penalty item roll, and stops', () => {
    const g = fresh(6);
    g.state.hp = 5;
    fight(g, id('GolbinForest'), id('Golbin'));
    g.advance(60 * MIN);
    expect(g.state.active).toBeNull();
    expect(g.state.stats.deaths).toBe(1);
    expect(g.hp()).toBe(g.maxHp());
  });

  it('ranged needs ammo; arrows are used up', () => {
    const g = fresh();
    g.addItem(id('NormalBow'), 1);
    equip(g, id('NormalBow'));
    fight(g, id('GolbinForest'), id('Golbin'));
    expect(g.state.active).toBeNull();
    g.addItem(id('StoneArrows'), 50);
    equip(g, id('StoneArrows'));
    fight(g, id('GolbinForest'), id('Golbin'));
    g.advance(5 * MIN);
    expect(g.state.equipment[id('Ammo')]?.qty ?? 0).toBeLessThan(50);
  });
});

describe('prayer and slayer', () => {
  it('burying bones gives prayer points that prayers spend each enemy turn', () => {
    const g = fresh(8);
    g.addItem(id('Bone'), 30);
    bury(g, id('Bone'), 30);
    expect(prayerPoints(g)).toBe(30);
    expect(togglePrayer(g, id('Guard'))).toBeNull();
    g.addItem(id('Shrimp'), 200);
    g.state.selectedFood = id('Shrimp');
    fight(g, id('GolbinForest'), id('Golbin'));
    g.advance(5 * MIN);
    expect(prayerPoints(g)).toBeLessThan(30);
    expect(g.xp('Prayer')).toBeGreaterThan(0);
  });

  it('slayer tasks reward Slayer XP and coins per task kill', () => {
    const g = fresh(10);
    expect(newSlayerTask(g, id('Kuren'))).toBeNull();
    const task = g.state.combat.slayer!;
    expect(task.left).toBeGreaterThanOrEqual(15);
    g.addItem(id('Shrimp'), 2000);
    g.state.selectedFood = id('Shrimp');
    g.state.xp.Attack = g.state.xp.Strength = g.state.xp.Defence = g.state.xp.Hitpoints = 1e9;
    g.state.hp = null;
    const areaId = ['GolbinForest', 'CorruptedFarmlands'].map(id).find((a) => areaEnemies(a).includes(task.enemy))!;
    fight(g, areaId, task.enemy);
    expect(g.state.active?.skill).toBe('Combat');
    g.advance(30 * MIN);
    expect(g.xp('Slayer')).toBeGreaterThan(0);
    expect(g.currency(id('SlayerCoins'))).toBeGreaterThan(0);
  });
});
