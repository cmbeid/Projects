/** Gold: the Poké Mart's shelves, its buy-back counter, and the shipping bin that pays overnight. */
import { MART_SELL_RATE, item } from '../data/items';
import { giveItem, takeItem } from './farm';
import type { World } from './model';

export function buy(world: World, id: string, count = 1): boolean {
  const def = item(id);
  if (def.buyPrice === undefined || count <= 0) return false;
  const cost = def.buyPrice * count;
  if (world.player.gold < cost) return false;
  world.player.gold -= cost;
  giveItem(world, id, count);
  return true;
}

/** What the Mart pays on the spot for one. */
export function martPrice(id: string): number {
  return Math.floor(item(id).sellPrice * MART_SELL_RATE);
}

export function sellNow(world: World, id: string, count = 1): boolean {
  const price = martPrice(id);
  if (price <= 0 || !takeItem(world, id, count)) return false;
  world.player.gold += price * count;
  world.stats.earned += price * count;
  world.events.push({ kind: 'coins', amount: price * count });
  return true;
}

/** Put items in the shipping bin; they are paid for, in full, overnight. */
export function ship(world: World, id: string, count = 1): boolean {
  if (item(id).sellPrice <= 0 || !takeItem(world, id, count)) return false;
  world.bin[id] = (world.bin[id] ?? 0) + count;
  return true;
}

/** Take items back out of the bin before the day ends. */
export function unship(world: World, id: string, count = 1): boolean {
  const have = world.bin[id] ?? 0;
  if (have < count || count <= 0) return false;
  if (have === count) delete world.bin[id];
  else world.bin[id] = have - count;
  giveItem(world, id, count);
  return true;
}

export function binValue(bin: Record<string, number>): number {
  return Object.entries(bin).reduce((sum, [id, n]) => sum + item(id).sellPrice * n, 0);
}

/** Overnight: pay for the bin and empty it. */
export function collectBin(world: World): { shipped: Record<string, number>; earned: number } {
  const shipped = world.bin;
  const earned = binValue(shipped);
  world.bin = {};
  world.player.gold += earned;
  world.stats.earned += earned;
  return { shipped, earned };
}
