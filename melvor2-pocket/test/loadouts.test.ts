import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/game';
import { newState } from '../src/engine/state';
import { unlockEverything } from '../src/engine/navigation';
import { equip, equipped } from '../src/engine/combat/combat';
import { currentLoadout, loadoutUnlocked, swapLoadout } from '../src/engine/combat/loadouts';

const id = (s: string) => `MelvorBase:${s}`;

describe('loadouts', () => {
  it('slots 2 and 3 unlock with their shop purchases', () => {
    const g = new Game(newState(0, 1));
    unlockEverything(g);
    expect(loadoutUnlocked(g, id('Loadout1'))).toBe(true);
    expect(loadoutUnlocked(g, id('Loadout2'))).toBe(false);
    expect(swapLoadout(g, id('Loadout2'))).toBe('Locked');
    g.state.purchases[id('BattleLoadout')] = 1;
    expect(loadoutUnlocked(g, id('Loadout2'))).toBe(true);
  });

  it('switching stores the current set and restores the other from the bank', () => {
    const g = new Game(newState(0, 1));
    unlockEverything(g);
    g.state.purchases[id('BattleLoadout')] = 1;
    g.addItem(id('StoneHelmet'), 1);
    g.addItem(id('StoneBoots'), 1);
    expect(equip(g, id('StoneHelmet'))).toBeNull();
    g.state.combat.stance = id('Slash');
    // Loadout 2 starts empty: everything goes back to the bank.
    expect(swapLoadout(g, id('Loadout2'))).toBeNull();
    expect(currentLoadout(g)).toBe(id('Loadout2'));
    expect(equipped(g, id('Helmet'))).toBeUndefined();
    expect(g.count(id('StoneHelmet'))).toBe(1);
    expect(equip(g, id('StoneBoots'))).toBeNull();
    // Back to 1: helmet and stance return, boots go to the bank.
    expect(swapLoadout(g, id('Loadout1'))).toBeNull();
    expect(equipped(g, id('Helmet'))?.item).toBe(id('StoneHelmet'));
    expect(equipped(g, id('Boots'))).toBeUndefined();
    expect(g.state.combat.stance).toBe(id('Slash'));
    // And 2 remembers its boots.
    expect(swapLoadout(g, id('Loadout2'))).toBeNull();
    expect(equipped(g, id('Boots'))?.item).toBe(id('StoneBoots'));
  });
});
