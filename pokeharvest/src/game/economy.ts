/** Gold: the Poké Mart's shelves, its buy-back counter, the shipping bin, and the blacksmith. */
import { MART_SELL_RATE, item, sellable } from '../data/items';
import { UPGRADE_COSTS, type UpgradableTool } from '../data/progress';
import { giveItem, takeItem } from './farm';
import { recordSale, saleValue } from './market';
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

/** What the shipping bin would pay for the next one, rounded down. */
export function sellPrice(world: World, id: string): number {
  return saleValue(world, id, 1);
}

/** What the Mart pays on the spot for the next one. */
export function martPrice(world: World, id: string): number {
  return Math.floor(sellPrice(world, id) * MART_SELL_RATE);
}

export function sellNow(world: World, id: string, count = 1): boolean {
  if (!sellable(id) || count <= 0 || (world.inventory[id] ?? 0) < count) return false;
  const pay = Math.floor(saleValue(world, id, count) * MART_SELL_RATE);
  if (pay <= 0) return false;
  takeItem(world, id, count);
  recordSale(world, id, count);
  world.player.gold += pay;
  world.stats.earned += pay;
  world.events.push({ kind: 'coins', amount: pay });
  return true;
}

/** Put items in the shipping bin; they are paid for overnight at that day's prices. */
export function ship(world: World, id: string, count = 1): boolean {
  if (!sellable(id) || !takeItem(world, id, count)) return false;
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

export function binValue(world: World): number {
  return Object.entries(world.bin).reduce((sum, [id, n]) => sum + saleValue(world, id, n), 0);
}

/** Overnight: pay for the bin at today's prices and empty it. */
export function collectBin(world: World): { shipped: Record<string, number>; earned: number } {
  const shipped = world.bin;
  let earned = 0;
  for (const [id, n] of Object.entries(shipped)) {
    earned += saleValue(world, id, n);
    recordSale(world, id, n);
  }
  world.bin = {};
  world.player.gold += earned;
  world.stats.earned += earned;
  return { shipped, earned };
}

/** Why the blacksmith can't take this job, or null if it can. */
export function upgradeBlocker(world: World, tool: UpgradableTool): string | null {
  if (world.upgrade) return 'The blacksmith is already working on a tool.';
  const next = world.tools[tool] + 1;
  const cost = UPGRADE_COSTS[next];
  if (!cost) return 'Already the finest there is.';
  if (world.player.gold < cost.gold) return `Needs ${cost.gold}g.`;
  if ((world.inventory[cost.material] ?? 0) < cost.count) return `Needs ${cost.count} ${item(cost.material).name}.`;
  return null;
}

/** Hand a tool to the blacksmith: paid now, ready tomorrow morning. You keep using the old one until then. */
export function startUpgrade(world: World, tool: UpgradableTool): boolean {
  if (upgradeBlocker(world, tool)) return false;
  const tier = world.tools[tool] + 1;
  const cost = UPGRADE_COSTS[tier]!;
  world.player.gold -= cost.gold;
  takeItem(world, cost.material, cost.count);
  world.upgrade = { tool, tier, day: world.day };
  return true;
}
