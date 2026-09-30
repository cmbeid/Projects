import { describe, expect, it } from 'vitest';
import { act, catchChance, endBattle, startBattle } from '../src/game/battle';
import { maxHp } from '../src/game/mon';
import { SPAWN } from '../src/data/maps';
import { world } from './helpers';

function fight(starter = 4, dex = 19, level = 2, seed = 5) {
  const w = world(starter, seed);
  startBattle(w, dex, level);
  return w;
}

describe('battle', () => {
  it('starts with your lead against a wild Pokémon', () => {
    const w = fight();
    expect(w.battle?.wild.dex).toBe(19);
    expect(w.battle?.active).toBe(w.party[0]);
    expect(w.seen).toContain(19);
  });

  it('wins by fighting, with XP for the winner', () => {
    const w = fight(4, 10, 2);
    const mon = w.mons[0]!;
    const before = mon.xp;
    let turns = 0;
    while (!w.battle!.over && turns < 30) {
      act(w, { kind: 'move', index: mon.moves.indexOf('ember') >= 0 ? mon.moves.indexOf('ember') : 0 });
      turns += 1;
    }
    expect(w.battle!.over).toBe('win');
    expect(mon.xp).toBeGreaterThan(before);
    expect(w.stats.wins).toBe(1);
    expect(w.skills.battling).toBeGreaterThan(0);
  });

  it('catches with a ball, sometimes', () => {
    let caught = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      const w = fight(7, 19, 2, seed);
      w.battle!.wild.hp = 1;
      const events = act(w, { kind: 'item', id: 'poke-ball' });
      expect(events.some((e) => e.kind === 'throw')).toBe(true);
      expect(w.inventory['poke-ball']).toBe(4);
      if (w.battle!.over === 'caught') {
        caught += 1;
        expect(w.mons).toHaveLength(2);
        expect(w.party).toHaveLength(2);
      }
    }
    expect(caught).toBeGreaterThan(25);
  });

  it('makes weakened and calmed Pokémon easier to catch', () => {
    const w = fight(7, 133, 8);
    const full = catchChance(w, w.battle!, 'poke-ball');
    w.battle!.wild.hp = 1;
    const low = catchChance(w, w.battle!, 'poke-ball');
    w.inventory.cheri = 1;
    act(w, { kind: 'item', id: 'cheri' });
    const calm = catchChance(w, w.battle!, 'poke-ball');
    expect(low).toBeGreaterThan(full);
    expect(calm).toBeGreaterThan(low);
    expect(catchChance(w, w.battle!, 'great-ball')).toBeGreaterThan(calm);
  });

  it('heals with an Oran Berry', () => {
    const w = fight(7);
    const mon = w.mons[0]!;
    mon.hp = 3;
    w.inventory.oran = 1;
    act(w, { kind: 'item', id: 'oran' });
    expect(mon.hp).toBeGreaterThan(3);
    expect(w.inventory.oran).toBeUndefined();
  });

  it('sends you home after a loss, with the party patched up', () => {
    const w = fight(1, 66, 10);
    w.map = 'route1';
    const mon = w.mons[0]!;
    mon.hp = 1;
    let turns = 0;
    while (!w.battle!.over && turns < 20) {
      act(w, { kind: 'move', index: 0 });
      turns += 1;
    }
    expect(w.battle!.over).toBe('lose');
    endBattle(w);
    expect(w.battle).toBeNull();
    expect(w.map).toBe('farm');
    expect(w.player.x).toBe(SPAWN.x);
    expect(w.player.gold).toBe(450);
    expect(mon.hp).toBe(Math.floor(maxHp(mon) / 2));
  });

  it('makes you switch when your Pokémon faints and another can fight', () => {
    const w = fight(1, 66, 10);
    w.mons.push({ ...w.mons[0]!, uid: 99, hp: 20 });
    w.party.push(99);
    w.mons[0]!.hp = 1;
    let turns = 0;
    while (!w.battle!.mustSwitch && !w.battle!.over && turns < 20) {
      act(w, { kind: 'move', index: 0 });
      turns += 1;
    }
    expect(w.battle!.mustSwitch).toBe(true);
    expect(act(w, { kind: 'move', index: 0 })).toEqual([]);
    act(w, { kind: 'switch', uid: 99 });
    expect(w.battle!.active).toBe(99);
    expect(w.battle!.mustSwitch).toBe(false);
  });
});
