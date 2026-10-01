/**
 * Machines you craft and place on the farm. Load one with something it
 * takes and it works away by itself, overnight too; tap it when it's done.
 * Electric Pokémon on the farm power them, doubling their speed.
 */
import { MACHINES } from '../data/crafting';
import { item } from '../data/items';
import { MAPS, tileAt } from '../data/maps';
import { species } from '../data/species';
import { giveItem, takeItem } from './farm';
import { farmMons, hasPerk, partyMons, plotKey, type World } from './model';
import { nextRandom } from './rng';
import { addSkillXp } from './skills';

/** Whether an Electric helper is working on the farm. */
export function powered(world: World): boolean {
  const onFarm = [...farmMons(world), ...(world.map === 'farm' ? partyMons(world) : [])];
  return onFarm.some((m) => m.hp > 0 && species(m.dex).job === 'power');
}

export function machineSpeed(world: World): number {
  return (powered(world) ? 2 : 1) * (hasPerk(world, 'tinkerer') ? 1.25 : 1);
}

export function canPlace(world: World, x: number, y: number): boolean {
  const key = plotKey(x, y);
  const kind = tileAt(world.map, x, y);
  return MAPS[world.map].farmable && (kind === 'grass' || (kind === 'ghsoil' && world.greenhouse)) && !world.plots[key] && !world.machines[key];
}

export function placeMachine(world: World, id: string, x: number, y: number): boolean {
  if (item(id).kind !== 'machine' || !canPlace(world, x, y) || !takeItem(world, id, 1)) return false;
  world.machines[plotKey(x, y)] = { id, output: null, count: 0, progress: 0, needed: 0 };
  world.events.push({ kind: 'place', x, y });
  return true;
}

export function isDone(world: World, key: string): boolean {
  const m = world.machines[key];
  return Boolean(m?.output && m.progress >= m.needed);
}

/** What this machine would make from `input`, or null. */
export function outputFor(machineId: string, input: string): string | null {
  return MACHINES[machineId]?.output(input) ?? null;
}

export function loadMachine(world: World, x: number, y: number, input: string): boolean {
  const m = world.machines[plotKey(x, y)];
  if (!m || m.output) return false;
  const output = outputFor(m.id, input);
  if (!output || !takeItem(world, input, 1)) return false;
  m.output = output;
  m.count = hasPerk(world, 'bulk') && nextRandom(world.rng) < 0.3 ? 2 : 1;
  m.progress = 0;
  m.needed = MACHINES[m.id]!.minutes;
  return true;
}

export function collectMachine(world: World, x: number, y: number): boolean {
  const key = plotKey(x, y);
  const m = world.machines[key];
  if (!m || !isDone(world, key)) return false;
  giveItem(world, m.output!, m.count);
  world.events.push({ kind: 'collect', x, y, text: m.count > 1 ? `${item(m.output!).name} ×${m.count}` : item(m.output!).name });
  addSkillXp(world, 'crafting', 3);
  m.output = null;
  m.count = 0;
  m.progress = 0;
  m.needed = 0;
  return true;
}

/** Pick a machine back up. Anything finished inside comes too; anything half-made is lost. */
export function pickUpMachine(world: World, x: number, y: number): boolean {
  const key = plotKey(x, y);
  const m = world.machines[key];
  if (!m) return false;
  if (isDone(world, key)) collectMachine(world, x, y);
  delete world.machines[key];
  giveItem(world, m.id, 1);
  world.events.push({ kind: 'clear', x, y });
  return true;
}

/** Let every machine work for `minutes` of in-game time. */
export function runMachines(world: World, minutes: number): void {
  const speed = machineSpeed(world);
  for (const m of Object.values(world.machines)) {
    if (m.output && m.progress < m.needed) m.progress = Math.min(m.needed, m.progress + minutes * speed);
  }
}
