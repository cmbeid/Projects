// Combat features from the desktop: imbuements, multi-hit timing, a slayer task per master.
import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/game';
import { newState } from '../src/engine/state';
import { unlockEverything } from '../src/engine/navigation';
import { attack as attackData } from '../src/engine/combat/data';
import { activeImbuement } from '../src/engine/bonuses';
import { equip, fight, hitSpacing, newSlayerTask, setImbuement, slayerTask, startSlayerTasks, type FullAttack } from '../src/engine/combat/combat';
import { migrate } from '../src/save';

const id = (s: string) => `MelvorBase:${s}`;
const fresh = (seed = 1) => {
  const g = new Game(newState(0, seed));
  unlockEverything(g);
  return g;
};
const MIN = 60 * 60;

describe('parity: combat features', () => {
  it('imbuements need a weapon of their element and pay their runes each attack turn', () => {
    const g = fresh(3);
    g.state.xp.Magic = 1e7;
    expect(setImbuement(g, id('SuffocateI'))).not.toBeNull(); // no Air weapon yet
    g.addItem(id('AirStaff'), 1);
    equip(g, id('AirStaff'));
    g.addItem(id('AirRune'), 10_000);
    g.addItem(id('BodyRune'), 20);
    g.addItem(id('MindRune'), 10_000);
    expect(setImbuement(g, id('SuffocateI'))).toBeNull();
    expect(activeImbuement(g)?.Id).toBe('SuffocateI');
    expect(g.combatEffects().length).toBeGreaterThan(0);
    g.addItem(id('Shrimp'), 500);
    g.state.selectedFood = id('Shrimp');
    let attacks = 0;
    g.events.add((e) => {
      if (e.type === 'attack') attacks++;
    });
    fight(g, id('GolbinForest'), id('Golbin'));
    g.advance(MIN);
    expect(attacks).toBeGreaterThan(0);
    expect(g.count(id('BodyRune'))).toBeLessThan(20);
    // Out of body runes: the imbuement switches off.
    g.removeItem(id('BodyRune'), g.count(id('BodyRune')));
    expect(activeImbuement(g)).toBeNull();
  });

  it('multi-hit attacks push the next turn back by the time between hits', () => {
    const atk = attackData(id('SlicingCuts')) as unknown as FullAttack;
    // Two hits 250 ms apart: one gap of 250 ms = 15 ticks.
    expect(hitSpacing(atk)).toBe(15);
    expect(hitSpacing(attackData(id('Normal')) as unknown as FullAttack)).toBe(0);
  });

  it('every unlocked master has its own task, and kills count for each', () => {
    const g = fresh(5);
    g.state.xp.Slayer = 1e7;
    startSlayerTasks(g);
    expect(slayerTask(g, id('Kuren'))).not.toBeNull();
    expect(slayerTask(g, id('Allevia'))).not.toBeNull();
    // A finished task is replaced straight away.
    g.state.combat.slayerTasks![id('Kuren')] = { enemy: id('Golbin'), left: 1 };
    g.state.xp.Attack = g.state.xp.Strength = g.state.xp.Defence = g.state.xp.Hitpoints = 1e9;
    g.state.hp = null;
    fight(g, id('GolbinForest'), id('Golbin'));
    g.advance(2 * MIN);
    expect(g.state.combat.slayerTasksDone[id('Kuren')]).toBeGreaterThanOrEqual(1);
    expect(slayerTask(g, id('Kuren'))).not.toBeNull();
    expect(newSlayerTask(g, id('Kuren'))).toMatch(/slayer coins|^$/);
  });

  it('an old single slayer task moves under its master', () => {
    const s = newState(0, 1);
    s.combat.slayer = { master: id('Kuren'), enemy: id('Golbin'), left: 7 };
    const out = migrate(JSON.parse(JSON.stringify(s)));
    expect(out.combat.slayer).toBeNull();
    expect(out.combat.slayerTasks?.[id('Kuren')]).toEqual({ enemy: id('Golbin'), left: 7, extended: undefined });
  });
});
