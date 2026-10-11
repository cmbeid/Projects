import { describe, expect, it } from 'vitest';
import { derive, maxHp } from '../src/game/derive';
import { jump } from '../src/game/engine';
import { node } from '../src/game/galaxy';
import { passDay, refine } from '../src/game/survival';
import { started } from './helpers';

describe('survival', () => {
  it('a day costs food and energy and the hydroponics give some back', () => {
    const s = started();
    const d = derive(s);
    const food = s.res.food;
    passDay(s);
    expect(s.res.food).toBeCloseTo(Math.min(d.maxFood, food + d.grow) - d.eat, 5);
    expect(s.day).toBe(2);
  });

  it('starving hurts the crew and dents morale instead of ending the game', () => {
    const s = started();
    s.res.food = 0;
    s.modules.hydro = 0;
    const hp = s.crew.map((c) => c.hp);
    passDay(s);
    s.crew.forEach((c, i) => expect(c.hp).toBeLessThan(hp[i]!));
    expect(s.screen).toBe('map');
  });

  it('a jump spends fuel and a day, and needs a link', () => {
    const s = started();
    const to = node(s).links[0]!;
    const fuel = s.res.fuel;
    expect(jump(s, to)).toBe(true);
    expect(s.res.fuel).toBeLessThan(fuel);
    expect(s.day).toBe(2);
    expect(s.at).toBe(to);
    const far = s.sector.nodes.find((n) => !node(s).links.includes(n.id) && n.id !== s.at)!;
    if (s.screen === 'map') expect(jump(s, far.id)).toBe(false);
  });

  it('no fuel, no jump', () => {
    const s = started();
    s.res.fuel = 0;
    expect(jump(s, node(s).links[0]!)).toBe(false);
  });

  it('the refinery cracks ice into fuel', () => {
    const s = started();
    s.modules.refinery = 2;
    s.mats.ice = 10;
    s.res.fuel = 1;
    expect(refine(s)).toBe(2);
    expect(s.mats.ice).toBe(6);
    expect(s.res.fuel).toBe(3);
  });

  it('medbay and rest heal', () => {
    const s = started();
    const c = s.crew[0]!;
    c.hp = 10;
    s.modules.medbay = 2;
    passDay(s);
    expect(c.hp).toBeGreaterThan(10);
    expect(c.hp).toBeLessThanOrEqual(maxHp(c));
  });
});
