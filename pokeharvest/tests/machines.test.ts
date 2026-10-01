import { describe, expect, it } from 'vitest';
import { juiceId } from '../src/data/items';
import { craft, craftBlocker, eat, giveCandy } from '../src/game/craft';
import { setRole } from '../src/game/barn';
import { collectMachine, isDone, loadMachine, machineSpeed, pickUpMachine, placeMachine, runMachines } from '../src/game/machines';
import { adopt, makeMon } from '../src/game/mon';
import { tapTile } from '../src/game/world';
import { sleep } from '../src/game/world';
import { run, stand, world } from './helpers';

function withPress() {
  const w = world();
  w.inventory['hard-stone'] = 4;
  w.inventory.oran = 5;
  expect(craft(w, 'berry-press')).toBe(true);
  expect(placeMachine(w, 'berry-press', 8, 14)).toBe(true);
  return w;
}

describe('crafting and machines', () => {
  it('crafts a machine from its recipe, and earns Crafting XP', () => {
    const w = world();
    expect(craftBlocker(w, 'berry-press')).toMatch(/Hard Stone/);
    expect(craftBlocker(w, 'loom')).toMatch(/Crafting level/);
    const p = withPress();
    expect(p.inventory.oran).toBe(2);
    expect(p.skills.crafting).toBeGreaterThan(0);
  });

  it('presses a berry into juice in six hours, and blocks the path', () => {
    const w = withPress();
    expect(loadMachine(w, 8, 14, 'hoe')).toBe(false);
    expect(loadMachine(w, 8, 14, 'oran')).toBe(true);
    expect(loadMachine(w, 8, 14, 'oran')).toBe(false);
    runMachines(w, 5 * 60);
    expect(isDone(w, '8,14')).toBe(false);
    runMachines(w, 60);
    expect(collectMachine(w, 8, 14)).toBe(true);
    expect(w.inventory[juiceId('oran')]).toBe(1);
    stand(w, 8, 12);
    tapTile(w, 8, 16);
    expect(w.player.path.some((p) => p.x === 8 && p.y === 14)).toBe(false);
  });

  it('runs twice as fast with an Electric Pokémon on the farm, and overnight', () => {
    const w = withPress();
    expect(machineSpeed(w)).toBe(1);
    const mareep = makeMon(179, 5, w.rng);
    adopt(w, mareep, false);
    setRole(w, mareep.uid, 'farm');
    expect(machineSpeed(w)).toBe(2);
    loadMachine(w, 8, 14, 'oran');
    run(w, 0.7 * 60 * 3.1);
    expect(isDone(w, '8,14')).toBe(true);
    collectMachine(w, 8, 14);
    loadMachine(w, 8, 14, 'oran');
    w.clock = 22 * 60;
    sleep(w);
    expect(isDone(w, '8,14')).toBe(true);
  });

  it('picks the machine back up with the sickle', () => {
    const w = withPress();
    expect(pickUpMachine(w, 8, 14)).toBe(true);
    expect(w.inventory['berry-press']).toBe(1);
    expect(w.machines).toEqual({});
  });
});

describe('cooking', () => {
  it('cooks at home and eats for energy and a buff', () => {
    const w = world();
    w.inventory.cheri = 2;
    w.inventory.oran = 1;
    w.map = 'route1';
    expect(craftBlocker(w, 'berry-cookie')).toMatch(/home/);
    w.map = 'farm';
    expect(craft(w, 'berry-cookie')).toBe(true);
    w.player.energy = 10;
    expect(eat(w, 'berry-cookie')).toBe(true);
    expect(w.player.energy).toBe(45);
    w.inventory['pecha-gateau'] = 1;
    eat(w, 'pecha-gateau');
    expect(w.buffs).toEqual(['swift']);
    sleep(w);
    expect(w.buffs).toEqual([]);
  });

  it('raises a level with a Rare Candy', () => {
    const w = world();
    w.inventory['rare-candy'] = 1;
    const lines = giveCandy(w, w.party[0]!);
    expect(w.mons[0]!.level).toBe(6);
    expect(lines[0]).toMatch(/level 6/);
  });
});
