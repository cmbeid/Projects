import { describe, expect, it } from 'vitest';
import { seedId } from '../src/data/items';
import { BARN_LEVELS } from '../src/data/ranch';
import { barnCapacity, buyLivestock, collectBarn, feedAndProduce, fillTrough, pet, setRole, upgradeBarn, barnUpgradeBlocker } from '../src/game/barn';
import { useAt } from '../src/game/farm';
import { adopt, makeMon } from '../src/game/mon';
import { plotKey, roleOf } from '../src/game/model';
import { select, sleep } from '../src/game/world';
import { run, stand, world } from './helpers';

function withFriend(dex = 241) {
  const w = world(4);
  const mon = makeMon(dex, 5, w.rng);
  adopt(w, mon, false);
  return { w, mon };
}

describe('roles', () => {
  it('moves Pokémon between party, farm and box, within limits', () => {
    const { w, mon } = withFriend(19);
    expect(roleOf(w, mon.uid)).toBe('box');
    expect(setRole(w, mon.uid, 'farm')).toBeNull();
    expect(roleOf(w, mon.uid)).toBe('farm');
    expect(w.helpers.map((h) => h.role)).toEqual(['party', 'farm']);
    expect(setRole(w, w.party[0]!, 'farm')).toMatch(/at least one/);
    for (let i = 0; i < barnCapacity(w) - 1; i += 1) {
      const m = makeMon(16, 3, w.rng);
      adopt(w, m, false);
      expect(setRole(w, m.uid, 'farm')).toBeNull();
    }
    const extra = makeMon(16, 3, w.rng);
    adopt(w, extra, false);
    expect(setRole(w, extra.uid, 'farm')).toMatch(/full/);
  });

  it('keeps farm Pokémon working while you are away on Route 1', () => {
    const w = world(4);
    const squirtle = makeMon(7, 5, w.rng);
    adopt(w, squirtle, false);
    setRole(w, squirtle.uid, 'farm');
    stand(w, 6, 12);
    for (const x of [5, 6, 7]) {
      select(w, 'hoe');
      useAt(w, x, 13);
      select(w, seedId('oran'));
      useAt(w, x, 13);
    }
    // Head out of the gate and stay away.
    stand(w, 11, 30);
    w.player.path = [{ x: 11, y: 31 }];
    run(w, 1);
    expect(w.map).toBe('route1');
    stand(w, 11, 10);
    run(w, 0.7 * 60 * 3);
    for (const x of [5, 6, 7]) expect(w.plots[plotKey(x, 13)]!.watered, `x=${x}`).toBe(true);
    expect(w.helpers.find((h) => h.uid === squirtle.uid)!.role).toBe('farm');
  });
});

describe('the barn', () => {
  it('feeds farm Pokémon from the trough, and fed livestock produce', () => {
    const { w, mon } = withFriend(241);
    setRole(w, mon.uid, 'farm');
    w.inventory.cheri = 2;
    expect(fillTrough(w, 'cheri', 2)).toBe(true);
    const night = feedAndProduce(w);
    expect(night.produced['moomoo-milk']).toBeGreaterThanOrEqual(1);
    expect(night.hungry).toBe(0);
    expect(w.barn.trough.cheri).toBe(1);
    expect(mon.friendship).toBe(75);
    const got = collectBarn(w);
    expect(w.inventory['moomoo-milk']).toBe(got['moomoo-milk']);
  });

  it('goes hungry without berries: no milk, and friendship falls', () => {
    const { w, mon } = withFriend(241);
    setRole(w, mon.uid, 'farm');
    const night = feedAndProduce(w);
    expect(night.hungry).toBe(1);
    expect(night.produced).toEqual({});
    expect(mon.fed).toBe(false);
    expect(mon.friendship).toBe(60);
  });

  it('makes more from a devoted Pokémon', () => {
    const { w, mon } = withFriend(831);
    setRole(w, mon.uid, 'farm');
    mon.friendship = 250;
    w.barn.trough.oran = 1;
    expect(feedAndProduce(w).produced.wool).toBe(2);
  });

  it('only builds a bigger barn for a known farmer', () => {
    const w = world();
    w.player.gold = 99999;
    w.inventory['hard-stone'] = 10;
    expect(barnUpgradeBlocker(w)).toMatch(/reputation/);
    w.reputation = 5;
    expect(upgradeBarn(w)).toBe(true);
    expect(barnCapacity(w)).toBe(BARN_LEVELS[1]!.capacity);
  });

  it('sells livestock that move straight into the barn', () => {
    const w = world();
    w.player.gold = 5000;
    w.reputation = 5;
    expect(buyLivestock(w, 241)).toBe('farm');
    expect(w.farm).toHaveLength(1);
    expect(buyLivestock(w, 113)).toBeNull(); // needs more reputation
  });

  it('allows one pat a day', () => {
    const { w, mon } = withFriend();
    expect(pet(w, mon.uid)).toBe(true);
    expect(pet(w, mon.uid)).toBe(false);
    sleep(w);
    expect(pet(w, mon.uid)).toBe(true);
  });
});
