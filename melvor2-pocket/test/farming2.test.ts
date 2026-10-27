import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/game';
import { newState } from '../src/engine/state';
import { unlockEverything } from '../src/engine/navigation';
import { mod } from '../src/engine/bonuses';
import { buyPlot, plant, plotState } from '../src/engine/skills/farming';

const id = (s: string) => `MelvorBase:${s}`;
const HOUR = 60 * 60 * 60;
const fresh = () => {
  const g = new Game(newState(0, 1));
  unlockEverything(g);
  g.state.gold = 1e9;
  g.state.xp.Farming = 1e9;
  return g;
};

describe('flowers', () => {
  it('give their bonus for two days once grown, instead of a harvest', () => {
    const g = fresh();
    const plotId = id('Flower1');
    expect(buyPlot(g, plotId)).toBeNull();
    g.addItem(id('SunflowerSeed'), 1);
    expect(plant(g, plotId, id('Sunflower'))).toBeNull();
    const ctx = { entity: 'Farming', category: id('Allotments') };
    expect(mod(g, 'FarmingAction', 'FlatDiseaseProtection', ctx)).toBe(0);
    g.advance(24 * HOUR + 10);
    expect(plotState(g, plotId)!.providingUntil).toBeDefined();
    expect(mod(g, 'FarmingAction', 'FlatDiseaseProtection', ctx)).toBe(20);
    expect(g.count(id('NormalLog'))).toBe(0);
    g.advance(48 * HOUR);
    expect(plotState(g, plotId)!.recipe).toBeNull();
    expect(mod(g, 'FarmingAction', 'FlatDiseaseProtection', ctx)).toBe(0);
  });
});

describe('farming automation', () => {
  it('harvests and replants on its own for the automation cost', () => {
    const g = fresh();
    g.state.purchases[id('FarmhandI')] = 1;
    const plotId = id('Allotment1');
    expect(buyPlot(g, plotId)).toBeNull();
    g.addItem(id('PotatoSeed'), 30);
    g.addItem(id('Wine'), 10);
    expect(plant(g, plotId, id('Potato'))).toBeNull();
    plotState(g, plotId)!.auto = { harvest: true, replant: id('Potato') };
    g.advance(2 * HOUR);
    expect(g.count(id('Potatoes')) + g.count(id('Potato'))).toBeGreaterThan(0);
    expect(plotState(g, plotId)!.recipe).toBe(id('Potato'));
    expect(g.count(id('Wine'))).toBe(8);
  });
});
