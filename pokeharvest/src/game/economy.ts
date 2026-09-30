/** Gold: the Poké Mart's shelves, its buy-back counter, the shipping bin, and the blacksmith. */
import { MART_SELL_RATE, item } from '../data/items';
import { UPGRADE_COSTS, type UpgradableTool } from '../data/progress';
import { giveItem, takeItem } from './farm';
import { hasPerk, type World } from './model';

export function buy(world: World, id: string, count = 1): boolean {
  const def = item(id);
  if (def.buyPrice === undefined || count <= 0) return false;
  const cost = def.buyPrice * count;
  if (world.player.gold < cost) return false;
  world.player.gold -= cost;
  giveItem(world, id, count);
  return true;
}

/** What the shipping bin pays for one: berries earn more with Berry Master. */
export function sellPrice(world: World, id: string): number {
  const def = item(id);
  return Math.floor(def.sellPrice * (def.kind === 'crop' && hasPerk(world, 'berry-master') ? 1.2 : 1));
}

/** What the Mart pays on the spot for one. */
export function martPrice(world: World, id: string): number {
  return Math.floor(sellPrice(world, id) * MART_SELL_RATE);
}

export function sellNow(world: World, id: string, count = 1): boolean {
  const price = martPrice(world, id);
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

export function binValue(world: World): number {
  return Object.entries(world.bin).reduce((sum, [id, n]) => sum + sellPrice(world, id) * n, 0);
}

/** Overnight: pay for the bin and empty it. */
export function collectBin(world: World): { shipped: Record<string, number>; earned: number } {
  const shipped = world.bin;
  const earned = binValue(world);
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
