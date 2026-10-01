/**
 * The Seed Box by the house. You stock it from your bag; Ground-type helpers
 * take seeds out of it one at a time and plant them in empty plots.
 */
import { ITEMS } from '../data/items';
import { giveItem, plantableAt, takeItem } from './farm';
import type { World } from './model';

export function isSeed(id: string): boolean {
  return ITEMS.get(id)?.kind === 'seed';
}

/** Move up to `n` seeds from your bag into the box. Returns how many went in. */
export function stockSeedBox(world: World, id: string, n: number): number {
  if (!isSeed(id)) return 0;
  const count = Math.min(n, world.inventory[id] ?? 0);
  if (count <= 0 || !takeItem(world, id, count)) return 0;
  world.seedBox[id] = (world.seedBox[id] ?? 0) + count;
  return count;
}

/** Move up to `n` seeds from the box back to your bag. Returns how many came out. */
export function takeFromSeedBox(world: World, id: string, n: number): number {
  const count = Math.min(n, world.seedBox[id] ?? 0);
  if (count <= 0) return 0;
  removeSeed(world, id, count);
  giveItem(world, id, count);
  return count;
}

export function seedBoxCount(world: World): number {
  return Object.values(world.seedBox).reduce((a, b) => a + b, 0);
}

/** Take seeds out of the box (a helper picking one up). */
export function removeSeed(world: World, id: string, n = 1): boolean {
  const have = world.seedBox[id] ?? 0;
  if (have < n) return false;
  if (have === n) delete world.seedBox[id];
  else world.seedBox[id] = have - n;
  return true;
}

/** Put seeds back (a helper whose plot got planted while it was on the way). */
export function returnSeed(world: World, id: string, n = 1): void {
  world.seedBox[id] = (world.seedBox[id] ?? 0) + n;
}

/**
 * The seed a helper would plant at (x, y): your choice if the box has some
 * and it would grow there, else (on Auto) the box's most plentiful seed that
 * would. Null if nothing in the box fits.
 */
export function seedFor(world: World, x: number, y: number): string | null {
  const grows = (id: string): boolean => (world.seedBox[id] ?? 0) > 0 && plantableAt(world, ITEMS.get(id)!.crop!, x, y);
  if (world.seedChoice !== 'auto') return grows(world.seedChoice) ? world.seedChoice : null;
  let best: string | null = null;
  for (const id of Object.keys(world.seedBox).sort()) {
    if (grows(id) && (!best || world.seedBox[id]! > world.seedBox[best]!)) best = id;
  }
  return best;
}
