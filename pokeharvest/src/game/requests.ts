/**
 * The request board: townsfolk post orders for berries and goods. Fill one
 * before its deadline for a bonus over the market price, and for reputation,
 * which the ranch and the carpenter care about.
 */
import { CROPS, inSeason } from '../data/crops';
import { ITEMS, item } from '../data/items';
import { PRODUCTS, reputationLevel } from '../data/ranch';
import { takeItem } from './farm';
import { farmMons, type World } from './model';
import { nextRandom } from './rng';
import { seasonOf } from './time';

export const MAX_REQUESTS = 3;
/** How much more than the base price a request pays. */
export const REQUEST_BONUS = 1.6;

/** What townsfolk might ask for: berries always; goods once you can make them. */
function wanted(world: World): string[] {
  const out: string[] = CROPS.filter((c) => inSeason(c.id, seasonOf(world.day))).map((c) => c.id);
  for (const m of farmMons(world)) {
    const p = PRODUCTS[m.dex];
    if (p && !out.includes(p)) out.push(p);
  }
  const machines = new Set(Object.values(world.machines).map((m) => m.id));
  for (const def of ITEMS.values()) {
    if (def.kind !== 'artisan') continue;
    const from = def.id.endsWith('-juice') ? 'berry-press' : def.id.endsWith('-jam') ? 'preserves-jar' : def.id === 'moomoo-cheese' ? 'cheese-press' : 'loom';
    if (machines.has(from)) out.push(def.id);
  }
  return out;
}

/** Each morning: drop expired requests, and post new ones up to three. Returns how many expired. */
export function refreshRequests(world: World): number {
  const before = world.requests.length;
  world.requests = world.requests.filter((r) => r.due >= world.day);
  const expired = before - world.requests.length;
  const pool = wanted(world).filter((id) => !world.requests.some((r) => r.item === id));
  while (world.requests.length < MAX_REQUESTS && pool.length) {
    const id = pool.splice(Math.floor(nextRandom(world.rng) * pool.length), 1)[0]!;
    const price = item(id).sellPrice;
    const [lo, hi] = price < 60 ? [5, 10] : price < 150 ? [3, 6] : [1, 3];
    const count = lo + Math.floor(nextRandom(world.rng) * (hi - lo + 1));
    const value = price * count;
    world.requests.push({
      id: world.nextRequestId++,
      item: id,
      count,
      reward: Math.ceil((value * REQUEST_BONUS) / 10) * 10,
      reputation: value >= 600 ? 2 : 1,
      due: world.day + 2 + Math.floor(nextRandom(world.rng) * 3),
    });
  }
  return expired;
}

export function canDeliver(world: World, id: number): boolean {
  const r = world.requests.find((q) => q.id === id);
  return Boolean(r && (world.inventory[r.item] ?? 0) >= r.count);
}

export function deliver(world: World, id: number): boolean {
  const r = world.requests.find((q) => q.id === id);
  if (!r || !takeItem(world, r.item, r.count)) return false;
  world.requests = world.requests.filter((q) => q.id !== id);
  world.player.gold += r.reward;
  world.stats.earned += r.reward;
  world.reputation += r.reputation;
  world.events.push({ kind: 'coins', amount: r.reward });
  return true;
}

export function reputation(world: World): number {
  return reputationLevel(world.reputation);
}
