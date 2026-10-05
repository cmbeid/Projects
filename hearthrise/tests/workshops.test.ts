import { describe, expect, it } from 'vitest';
import { REFINE_BY_ID } from '../src/data/recipes';
import { place } from '../src/game/economy';
import { newGame } from '../src/game/engine';
import { canCraft, craft, queueRefine, refineSeconds, tickWorkshops, workshopSlots } from '../src/game/workshops';

function shop() {
  const s = newGame(5);
  s.features.push('workshops', 'drafting', 'build');
  s.story.id = null;
  s.coins = 1e6;
  return s;
}

describe('workshops', () => {
  it('turn salvage into goods on a timer, taking it as each batch starts', () => {
    const s = shop();
    s.inventory['driftwood'] = 20;
    expect(queueRefine(s, 0, 'r-planks', 5)).toBe(true);
    tickWorkshops(s, 0.01);
    expect(s.inventory['driftwood']).toBe(12);
    tickWorkshops(s, refineSeconds(s, REFINE_BY_ID.get('r-planks')!) * 3);
    expect(s.inventory['planks']).toBe(2);
    expect(s.workshops[0]!.queued).toBe(3);
  });

  it('get a slot for every workshop built', () => {
    const s = shop();
    expect(workshopSlots(s)).toBe(1);
    s.inventory['planks'] = 10;
    place(s, 'workshop', 0, 0, 0);
    expect(workshopSlots(s)).toBe(2);
    expect(queueRefine(s, 1, 'r-planks', 1)).toBe(true);
    expect(queueRefine(s, 2, 'r-planks', 1)).toBe(false);
  });

  it('make regalia at the Drafting Hall and wear it if it is better', () => {
    const s = shop();
    s.inventory['planks'] = 4;
    expect(canCraft(s, { id: 'x', output: { kind: 'regalia', base: 'rope-chain' }, inputs: [{ id: 'planks', n: 4 }], coins: 40, requires: { ward: 1 } })).toBe(true);
    expect(craft(s, 'c-rope-chain')).toBe(true);
    expect(s.equipped.chain).toBe(s.regalia[0]!.uid);
    expect(s.inventory['planks']).toBe(0);
  });
});
