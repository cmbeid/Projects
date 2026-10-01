/**
 * Prices. Each morning every berry and every good gets its own price for
 * the day, 15% either side of normal. Selling lots of one thing in a day
 * floods the market: past the first 15, each one fetches a little less.
 * At weekends a travelling merchant visits with things no shop stocks.
 */
import { inSeason } from '../data/crops';
import { ITEMS, item, marketItem } from '../data/items';
import { MERCHANT_POOL } from '../data/ranch';
import { hasPerk, type World } from './model';
import { nextRandom } from './rng';
import { seasonOf, weekdayOf } from './time';

/** Berries out of season are scarce: they fetch this much more. */
export const OUT_OF_SEASON = 1.25;

/** Units of an item you can sell in a day at full price. */
export const SATURATION_FREE = 15;
/** Each one past that pays this much less, down to `SATURATION_FLOOR`. */
export const SATURATION_STEP = 0.03;
export const SATURATION_FLOOR = 0.4;

export function rollMarket(world: World): void {
  world.market = {};
  for (const id of ITEMS.keys()) {
    if (!marketItem(id)) continue;
    world.market[id] = Math.round((0.85 + nextRandom(world.rng) * 0.3) * 100) / 100;
  }
}

/** One unit's price today, before any flooding: base, perks and the day's market. */
export function unitPrice(world: World, id: string): number {
  const def = item(id);
  let price = def.sellPrice;
  if (def.kind === 'crop' && hasPerk(world, 'berry-master')) price *= 1.2;
  if (def.kind === 'crop' && !inSeason(id, seasonOf(world.day))) price *= OUT_OF_SEASON;
  if (def.kind === 'artisan' && hasPerk(world, 'artisan')) price *= 1.25;
  return price * (world.market[id] ?? 1);
}

/** How much the k-th unit sold today is worth, as a share of the full price. */
export function saturation(k: number): number {
  return Math.max(SATURATION_FLOOR, 1 - SATURATION_STEP * Math.max(0, k - SATURATION_FREE));
}

/** What `count` more of an item would fetch today, after what's been sold already. */
export function saleValue(world: World, id: string, count: number, already = world.sold[id] ?? 0): number {
  const unit = unitPrice(world, id);
  let total = 0;
  for (let k = already + 1; k <= already + count; k += 1) total += unit * saturation(k);
  return Math.floor(total);
}

export function recordSale(world: World, id: string, count: number): void {
  world.sold[id] = (world.sold[id] ?? 0) + count;
}

export function merchantHere(world: World): boolean {
  const d = weekdayOf(world.day);
  return d === 'Sat' || d === 'Sun';
}

/** The merchant's stock today: four things from the pool, drawn once per visit. */
export function merchantStock(world: World): { id: string; price: number; left: number }[] {
  if (!merchantHere(world)) return [];
  if (world.merchant?.day !== world.day) {
    const pool = [...MERCHANT_POOL];
    const stock: { id: string; price: number; left: number }[] = [];
    while (stock.length < 4 && pool.length) {
      const pick = pool.splice(Math.floor(nextRandom(world.rng) * pool.length), 1)[0]!;
      stock.push({ id: pick.id, price: pick.price, left: pick.count });
    }
    world.merchant = { day: world.day, stock };
  }
  return world.merchant.stock;
}

export function buyFromMerchant(world: World, id: string): boolean {
  const entry = merchantStock(world).find((s) => s.id === id);
  if (!entry || entry.left <= 0 || world.player.gold < entry.price) return false;
  world.player.gold -= entry.price;
  entry.left -= 1;
  world.inventory[id] = (world.inventory[id] ?? 0) + 1;
  return true;
}
