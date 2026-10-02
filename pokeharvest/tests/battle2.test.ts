import { describe, expect, it } from 'vitest';
import { MART_STOCK } from '../src/data/items';
import { REPUTATION } from '../src/data/ranch';
import { act, startBattle, startTrainerBattle, type BattleEvent } from '../src/game/battle';
import { bestMedicine, centerStock, useMedicine } from '../src/game/medicine';
import { adopt, gainXp, makeMon, maxHp, xpForLevel } from '../src/game/mon';
import { parseWorld } from '../src/state/save';
import { world } from './helpers';

const texts = (evs: BattleEvent[]): string[] => evs.flatMap((e) => (e.kind === 'text' ? [e.text] : []));

/** A second party member, for switching and the Exp. Share. */
function withSecond(w: ReturnType<typeof world>, dex = 16, level = 5) {
  const mon = makeMon(dex, level, w.rng);
  adopt(w, mon);
  return mon;
}

describe('medicine', () => {
  it('heals by its amount, capped at full, and a Max Potion heals everything', () => {
    const w = world(1);
    const mon = w.mons[0]!;
    const max = maxHp(mon);
    w.inventory.potion = 2;
    w.inventory['max-potion'] = 1;
    mon.hp = max - 5;
    expect(useMedicine(w, 'potion', mon)).toMatch(/recovered 5 HP/);
    expect(mon.hp).toBe(max);
    expect(useMedicine(w, 'potion', mon)).toBeNull(); // full: nothing used
    expect(w.inventory.potion).toBe(1);
    mon.hp = 1;
    useMedicine(w, 'max-potion', mon);
    expect(mon.hp).toBe(max);
  });

  it('Revive only works on the fainted, and brings them back at half HP', () => {
    const w = world(1);
    const mon = w.mons[0]!;
    w.inventory.revive = 1;
    expect(useMedicine(w, 'revive', mon)).toBeNull();
    mon.hp = 0;
    expect(useMedicine(w, 'potion', mon)).toBeNull();
    expect(useMedicine(w, 'revive', mon)).toMatch(/revived/);
    expect(mon.hp).toBe(Math.floor(maxHp(mon) / 2));
    expect(w.inventory.revive).toBeUndefined();
  });

  it('picks the weakest potion that does the job', () => {
    const w = world(1);
    const mon = w.mons[0]!;
    Object.assign(w.inventory, { potion: 1, 'super-potion': 1 });
    mon.hp = maxHp(mon) - 10;
    expect(bestMedicine(w, mon)).toBe('potion');
    mon.hp = 1;
    w.mons[0]!.level = 40;
    expect(bestMedicine(w, mon)).toBe('super-potion');
  });

  it('heals in battle, on whoever you choose', () => {
    const w = world(4, 3);
    const second = withSecond(w, 16, 20);
    second.hp = 1;
    startBattle(w, 19, 2);
    w.inventory.potion = 1;
    const evs = act(w, { kind: 'item', id: 'potion', target: second.uid });
    expect(texts(evs)[0]).toBe('You used a Potion.');
    expect(second.hp).toBe(21);
    // A Revive on someone standing does nothing, and costs no turn.
    w.inventory.revive = 1;
    expect(act(w, { kind: 'item', id: 'revive', target: second.uid })).toEqual([]);
    expect(w.inventory.revive).toBe(1);
  });

  it('is sold at the Mart, and more at the Center as the town and your name grow', () => {
    const w = world();
    expect(MART_STOCK).toContain('potion');
    expect(centerStock(w)).toEqual([]);
    w.story.flags.push('center-open');
    expect(centerStock(w)).toEqual(['super-potion', 'revive']);
    w.reputation = REPUTATION[3]!;
    expect(centerStock(w)).toContain('hyper-potion');
    expect(centerStock(w)).not.toContain('max-potion');
    w.reputation = REPUTATION[4]!;
    expect(centerStock(w)).toContain('max-potion');
  });
});

describe('stat-boost moves', () => {
  it('raise a stat, sharply for +2, up to +6', () => {
    const w = world(4, 2);
    const mon = w.mons[0]!;
    mon.moves = ['swords-dance'];
    mon.hp = 999; // don't faint while dancing
    startBattle(w, 19, 2); // a little Rattata
    expect(texts(act(w, { kind: 'move', index: 0 }))).toContain("Charmander's Attack rose sharply!");
    act(w, { kind: 'move', index: 0 });
    act(w, { kind: 'move', index: 0 });
    expect(w.battle!.stages.you.atk).toBe(6);
    expect(texts(act(w, { kind: 'move', index: 0 }))).toContain("Charmander's Attack won't go any higher!");
  });

  it('Speed stages decide who moves first, and switching resets them', () => {
    const w = world(1, 4); // a slow Bulbasaur
    withSecond(w);
    startBattle(w, 19, 5); // a fast Rattata
    const b = w.battle!;
    b.stages.you.spe = 6;
    const evs = act(w, { kind: 'move', index: 0 });
    const first = evs.find((e) => e.kind === 'attack');
    expect(first?.kind === 'attack' && first.side).toBe('you');
    act(w, { kind: 'switch', uid: w.party[1]! });
    expect(b.stages.you).toEqual({ atk: 0, def: 0, spe: 0 });
  });

  it('are learned at level 16, in place of Growl or Tail Whip', () => {
    const mon = makeMon(4, 15, { seed: 1 });
    expect(mon.moves).toContain('growl');
    while (mon.moves.length < 4) mon.moves.push('tackle');
    const lines = gainXp(mon, xpForLevel(16) - mon.xp);
    expect(lines.join(' ')).toContain('forgot Growl and learned Work Up');
    expect(mon.moves).toContain('work-up');
  });
});

describe('Exp. Share', () => {
  it('gives the rest of the party half XP, only once you have it', () => {
    for (const has of [false, true]) {
      const w = world(4, 1);
      const second = withSecond(w);
      if (has) w.inventory['exp-share'] = 1;
      startBattle(w, 10, 2);
      w.battle!.wild.hp = 1;
      const before = second.xp;
      let evs: BattleEvent[] = [];
      for (let i = 0; i < 5 && !w.battle!.over; i += 1) evs = act(w, { kind: 'move', index: 0 });
      expect(w.battle!.over).toBe('win');
      expect(second.xp > before).toBe(has);
      if (has) expect(texts(evs).some((t) => t.includes('Exp. Share'))).toBe(true);
    }
  });

  it('is handed to farms already past Chapter 2, and to no one else', () => {
    const w = world();
    w.story.chapter = 3;
    expect(parseWorld(JSON.parse(JSON.stringify({ ...w, events: [] })))!.inventory['exp-share']).toBe(1);
    w.story.chapter = 1;
    w.inventory['exp-share'] = 1;
    expect(parseWorld(JSON.parse(JSON.stringify({ ...w, events: [] })))!.inventory['exp-share']).toBeUndefined();
  });
});

describe('smarter trainers', () => {
  it('reach for a super-effective move over a resisted one', () => {
    let fire = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      const w = world(1, seed); // your Bulbasaur: weak to fire
      w.mons[0]!.hp = 999;
      startTrainerBattle(w, 'joey');
      w.battle!.wild.moves = ['vine-whip', 'ember'];
      const evs = act(w, { kind: 'move', index: 0 });
      const theirs = evs.find((e) => e.kind === 'attack' && e.side === 'wild');
      if (theirs?.kind === 'attack' && theirs.move === 'ember') fire += 1;
    }
    expect(fire).toBeGreaterThanOrEqual(13);
  });

  it('use a Potion once when low', () => {
    const w = world(1, 2);
    w.mons[0]!.moves = ['growl'];
    startTrainerBattle(w, 'joey');
    const b = w.battle!;
    b.trainer!.potions = 1;
    b.wild.hp = 1;
    expect(texts(act(w, { kind: 'move', index: 0 }))).toContain('Youngster Joey used a Potion!');
    expect(b.wild.hp).toBe(Math.min(maxHp(b.wild), 21));
    b.wild.hp = 1;
    expect(texts(act(w, { kind: 'move', index: 0 })).join(' ')).not.toContain('Potion');
  });

  it('Kai switches out of a bad matchup', () => {
    const w = world(4, 3); // your Charmander, with Ember
    w.mons[0]!.hp = 999;
    startTrainerBattle(w, 'kai');
    const b = w.battle!;
    const grass = makeMon(1, 20, w.rng);
    const water = makeMon(7, 20, w.rng);
    b.trainer!.team = [grass, water];
    b.trainer!.index = 0;
    b.wild = grass;
    const evs = act(w, { kind: 'move', index: w.mons[0]!.moves.indexOf('ember') });
    expect(texts(evs)).toContain('Kai withdrew Bulbasaur!');
    expect(b.wild).toBe(water);
  });
});
