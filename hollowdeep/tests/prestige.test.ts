import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game/engine';
import { buyEcho, descend, echoGain } from '../src/game/prestige';
import { unlockFeature } from '../src/game/features';
import { derive } from '../src/game/derive';

describe('the Descent', () => {
  it('pays nothing until past depth 20', () => {
    const s = newGame(1);
    unlockFeature(s, 'descent');
    s.maxDepth = 20;
    expect(echoGain(s)).toBe(0);
    expect(descend(s)).toBe(false);
  });

  it('resets the run and keeps the miner', () => {
    const s = newGame(2);
    unlockFeature(s, 'descent');
    s.maxDepth = s.deepestEver = s.depth = 50;
    s.coins = 1e9;
    s.level = 30;
    s.upgrades = { sharpen: 40 };
    s.machines = { drone: 50 };
    s.inventory = { coal: 99 };
    s.fixtures = ['chute'];
    const gain = echoGain(s);
    expect(gain).toBeGreaterThan(0);
    expect(descend(s)).toBe(true);
    expect(s.echoes).toBe(gain);
    expect(s.coins).toBe(0);
    expect(s.depth).toBe(1);
    expect(s.upgrades).toEqual({});
    expect(s.machines).toEqual({});
    expect(s.inventory).toEqual({});
    expect(s.level).toBe(30);
    expect(s.fixtures).toEqual(['chute']);
    expect(s.deepestEver).toBe(50);
  });

  it('spends Echoes on permanent power', () => {
    const s = newGame(3);
    s.echoes = 10;
    const before = derive(s).tap;
    expect(buyEcho(s, 'resonance')).toBe(true);
    expect(derive(s).tap).toBeCloseTo(before * 2);
  });
});
