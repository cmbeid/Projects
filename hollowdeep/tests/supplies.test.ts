import { describe, expect, it } from 'vitest';
import { GEAR } from '../src/data/gear';
import { CONSUMABLES, CRAFT } from '../src/data/recipes';
import { derive } from '../src/game/derive';
import { newGame, tick } from '../src/game/engine';
import { unlockFeature } from '../src/game/features';
import { useConsumable } from '../src/game/rpg';
import { deserialize } from '../src/state/persistence';

describe('late-game supplies', () => {
  it('every supply has a recipe, and every gear piece too', () => {
    for (const c of CONSUMABLES) expect(CRAFT.some((r) => r.output.kind === 'consumable' && r.output.id === c.id)).toBe(true);
    for (const g of GEAR) expect(CRAFT.some((r) => r.output.kind === 'gear' && r.output.base === g.id)).toBe(true);
  });

  it('Overdrive triples machines, then wears off', () => {
    const s = newGame(1);
    s.machines = { drone: 10 };
    const before = derive(s).autoDps;
    s.consumables.overdrive = 1;
    expect(useConsumable(s, 'overdrive')).toBe(true);
    expect(derive(s).autoDps).toBeCloseTo(before * 3);
    tick(s, 121);
    expect(derive(s).autoDps).toBeCloseTo(before);
  });

  it('Gilded doubles sale value and Veinseeker triples ore', () => {
    const s = newGame(2);
    const sell = derive(s).sellMult;
    const ore = derive(s).oreMult;
    s.consumables.gilded = 1;
    s.consumables.seeker = 1;
    useConsumable(s, 'gilded');
    useConsumable(s, 'seeker');
    expect(derive(s).sellMult).toBeCloseTo(sell * 2);
    expect(derive(s).oreMult).toBeCloseTo(ore * 3);
  });

  it('Ember Tonic refills stamina and clears cooldowns', () => {
    const s = newGame(3);
    s.stamina = 0;
    s.cooldowns = { power: 5, dowse: 50, frenzy: 80 };
    s.consumables.embertonic = 1;
    expect(useConsumable(s, 'embertonic')).toBe(true);
    expect(s.stamina).toBe(derive(s).staminaMax);
    expect(s.cooldowns).toEqual({ power: 0, dowse: 0, frenzy: 0 });
  });

  it('Stillwater lifts the gaze while it lasts', () => {
    const s = newGame(4);
    s.depth = s.maxDepth = s.deepestEver = 270;
    s.time = 1; // the light is open
    expect(derive(s).hazard.tap).toBeLessThan(1);
    s.consumables.stillwater = 1;
    useConsumable(s, 'stillwater');
    expect(derive(s).hazard.tap).toBe(1);
  });

  it('Dream Dust grants XP at once', () => {
    const s = newGame(5);
    unlockFeature(s, 'miner');
    s.consumables.dreamdust = 1;
    useConsumable(s, 'dreamdust');
    expect(s.level).toBeGreaterThan(1);
  });

  it('an older save gains the new supply and buff slots', () => {
    const s = newGame(6) as unknown as Record<string, unknown>;
    s['consumables'] = { dynamite: 3, tonic: 0, luckbrew: 0, sagebrew: 0 };
    s['buffs'] = { dowse: 0, frenzy: 0, luck: 0, sage: 0 };
    const back = deserialize(JSON.stringify(s))!;
    expect(back.consumables.dynamite).toBe(3);
    expect(back.consumables.charge).toBe(0);
    expect(back.buffs.overdrive).toBe(0);
  });
});
