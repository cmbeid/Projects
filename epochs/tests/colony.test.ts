import { describe, expect, it } from 'vitest';
import { WONDER } from '../src/data/wonders';
import { buyNode, checkShip, heritageFor, launch } from '../src/game/colony';
import { derive } from '../src/game/derive';
import { newGame } from '../src/game/engine';

describe('the colony ship', () => {
  it('offers three worlds when finished, and a launch starts again with Heritage', () => {
    const s = newGame(4);
    s.era = 7;
    s.pop = 900;
    s.techs.push('toolmaking', 'agriculture');
    s.wonders['colony-ship'] = { done: WONDER.get('colony-ship')!.stages.length, left: 0 };
    checkShip(s);
    expect(s.offers).toHaveLength(3);
    expect(new Set(s.offers!.map((w) => w.name)).size).toBe(3);
    const gain = heritageFor(s);
    expect(gain).toBeGreaterThan(30);
    const world = s.offers![1]!;
    expect(launch(s, 1)).toBe(true);
    expect(s.era).toBe(0);
    expect(s.world.name).toBe(world.name);
    expect(s.heritage.points).toBe(gain);
    expect(s.techs).toEqual([]);
    expect(s.offers).toBeNull();
    expect(s.stats.launches).toBe(1);
  });

  it('spends Heritage on traditions that carry to the next world', () => {
    const s = newGame(4);
    s.heritage.points = 100;
    expect(buyNode(s, 'surveyors')).toBe(false);
    expect(buyNode(s, 'seed-vault')).toBe(true);
    expect(buyNode(s, 'ancestral-tools')).toBe(true);
    expect(buyNode(s, 'surveyors')).toBe(true);
    const land = derive(s).plotsTotal;
    s.wonders['colony-ship'] = { done: 5, left: 0 };
    s.era = 7;
    checkShip(s);
    launch(s, 0);
    expect(derive(s).plotsTotal - s.world.traits.reduce((n, t) => n + (t === 'ocean' ? -4 : t === 'wide-plains' ? 6 : 0), 0)).toBe(land);
    expect(s.res.wood).toBe(30);
  });
});
