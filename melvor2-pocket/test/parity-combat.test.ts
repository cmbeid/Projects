// Combat behaviour checked against the desktop game's code (see the parity pass in notes).
import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/game';
import { newState } from '../src/engine/state';
import { unlockEverything } from '../src/engine/navigation';
import { enemyFighter, playerFighter, darkness, ensureSpell, equip, fight, prayerPoints, spellAllowed, togglePrayer } from '../src/engine/combat/combat';
import { resistance } from '../src/engine/combat/stats';

const id = (s: string) => `MelvorBase:${s}`;
const fresh = (seed = 1) => {
  const g = new Game(newState(0, seed));
  unlockEverything(g);
  return g;
};
const MIN = 60 * 60;
const strong = (g: Game) => {
  g.state.xp.Attack = g.state.xp.Strength = g.state.xp.Defence = g.state.xp.Hitpoints = 1e9;
  g.state.hp = null;
  g.addItem(id('Shrimp'), 2000);
  g.state.selectedFood = id('Shrimp');
};

describe('parity: combat', () => {
  it('dungeon enemies drop nothing; only the dungeon reward pays out', () => {
    const g = fresh(3);
    strong(g);
    g.state.combat.kills[id('Hobgolbin')] = 15;
    fight(g, id('HobgolbinCamp'), null);
    expect(g.state.active?.skill).toBe('Combat');
    // Run until a few enemies are dead but the dungeon isn't finished.
    for (let i = 0; i < 600 && (g.state.combat.dungeonStage < 2 || (g.state.combat.dungeonsDone[id('HobgolbinCamp')] ?? 0) > 0); i++) g.advance(60);
    expect(g.state.combat.dungeonsDone[id('HobgolbinCamp')] ?? 0).toBe(0);
    expect(g.count(id('Bone'))).toBe(0);
  });

  it('darkness is the player’s alone, and lit lanterns push it back', () => {
    const g = fresh();
    expect(darkness(g, id('Murkwoods'))).toBe(36);
    g.addItem(id('SteelLanternLit'), 10);
    expect(equip(g, id('SteelLanternLit'))).toBeNull();
    expect(darkness(g, id('Murkwoods'))).toBeLessThan(36);
  });

  it('lit lanterns burn down as you are hit in dark areas', () => {
    const g = fresh(2);
    strong(g);
    g.addItem(id('SteelLanternLit'), 50);
    equip(g, id('SteelLanternLit'));
    const slot = Object.keys(g.state.equipment).find((s) => g.state.equipment[s].item === id('SteelLanternLit'))!;
    g.state.purchases[id('CopperSlayerPermit')] = 1;
    fight(g, id('Murkwoods'), null);
    expect(g.state.active?.skill).toBe('Combat');
    g.advance(5 * MIN);
    expect(g.state.equipment[slot]?.qty ?? 0).toBeLessThan(50);
  });

  it('prayers are charged on their own trigger: Strength on each of your attacks', () => {
    const g = fresh(4);
    strong(g);
    g.state.xp.Prayer = 1e7;
    g.addCurrency(id('PrayerPoints'), 1000);
    expect(togglePrayer(g, id('Strength'))).toBeNull();
    let attacks = 0;
    g.events.add((e) => {
      if (e.type === 'attack') attacks++;
    });
    fight(g, id('GolbinForest'), id('Golbin'));
    g.advance(2 * MIN);
    expect(attacks).toBeGreaterThan(5);
    expect(1000 - prayerPoints(g)).toBe(attacks);
  });

  it('spells must match the weapon’s element', () => {
    const g = fresh();
    g.state.xp.Magic = 1e6;
    g.addItem(id('AirStaff'), 1);
    expect(equip(g, id('AirStaff'))).toBeNull();
    expect(spellAllowed(g, id('AirStrike'))).toBe(true);
    expect(spellAllowed(g, id('WaterStrike'))).toBe(false);
    g.state.combat.spell = id('WaterStrike');
    ensureSpell(g);
    // The best Air spell unlocked at this Magic level.
    expect(spellAllowed(g, g.state.combat.spell!)).toBe(true);
  });

  it('the second ring slot stays locked in the demo', () => {
    const g = fresh();
    g.addItem(id('SilverTopazRing'), 2);
    equip(g, id('SilverTopazRing'));
    equip(g, id('SilverTopazRing'));
    const rings = Object.values(g.state.equipment).filter((e) => e.item === id('SilverTopazRing'));
    expect(rings.length).toBe(1);
    expect(g.count(id('SilverTopazRing'))).toBe(1);
  });

  it('resistance shifts multiply inside the 70% cap', () => {
    const g = fresh();
    const p = playerFighter(g);
    const e = enemyFighter(id('Golbin'));
    // Base 0.5; +10% flat then −50% percent: (0.5 + 0.1) × 0.5 = 0.3.
    expect(resistance(p, e, 0, 0.1, -0.5)).toBeCloseTo(0.3);
    // Capped at 0.7 before the triangle.
    expect(resistance(p, e, 0, 0.5, 0)).toBeCloseTo(0.7);
  });
});
