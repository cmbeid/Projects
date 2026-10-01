/**
 * The barn: Pokémon you've told to stay home. They live here, work the farm
 * all day whether you're around or not, and eat a berry each night from the
 * trough. Fed livestock make something every morning, more when they're
 * fond of you. The ranch counter sells livestock, and the carpenter builds a
 * bigger barn.
 */
import { item } from '../data/items';
import { BARN_LEVELS, FRIENDSHIP, GREENHOUSE_COST, PRODUCTS, RANCH_STOCK, reputationLevel } from '../data/ranch';
import { adopt, makeMon } from './mon';
import { PARTY_SIZE, farmMons, monByUid, roleOf, type Role, type World } from './model';
import { nextRandom } from './rng';
import { takeItem } from './farm';
import { syncHelpers } from './helpers';

export function barnCapacity(world: World): number {
  return BARN_LEVELS[world.barn.level]!.capacity;
}

/** Move a Pokémon to the party, the farm or the box. Returns why not, or null when done. */
export function setRole(world: World, uid: number, role: Role): string | null {
  const mon = monByUid(world, uid);
  if (!mon) return 'No such Pokémon.';
  const now = roleOf(world, uid);
  if (now === role) return null;
  if (now === 'party' && world.party.length <= 1) return 'Keep at least one Pokémon with you.';
  if (role === 'party' && world.party.length >= PARTY_SIZE) return `Your party is full (${PARTY_SIZE}).`;
  if (role === 'farm' && world.farm.length >= barnCapacity(world)) return `The ${BARN_LEVELS[world.barn.level]!.name.toLowerCase()} is full. The carpenter can build a bigger one.`;
  world.party = world.party.filter((u) => u !== uid);
  world.farm = world.farm.filter((u) => u !== uid);
  if (role === 'party') world.party.push(uid);
  if (role === 'farm') world.farm.push(uid);
  syncHelpers(world);
  return null;
}

export function troughCount(world: World): number {
  return Object.values(world.barn.trough).reduce((a, n) => a + n, 0);
}

/** Put berries in the trough. */
export function fillTrough(world: World, id: string, count: number): boolean {
  if (item(id).kind !== 'crop' || !takeItem(world, id, count)) return false;
  world.barn.trough[id] = (world.barn.trough[id] ?? 0) + count;
  return true;
}

/** The cheapest berry in the trough, eaten. */
function eat(world: World): boolean {
  const ids = Object.keys(world.barn.trough).sort((a, b) => item(a).sellPrice - item(b).sellPrice);
  const id = ids[0];
  if (!id) return false;
  const left = world.barn.trough[id]! - 1;
  if (left <= 0) delete world.barn.trough[id];
  else world.barn.trough[id] = left;
  return true;
}

/** Overnight: everyone in the barn eats, and fed livestock produce. */
export function feedAndProduce(world: World): { produced: Record<string, number>; hungry: number } {
  const produced: Record<string, number> = {};
  let hungry = 0;
  for (const mon of world.mons) if (!world.farm.includes(mon.uid)) mon.fed = true;
  for (const mon of farmMons(world)) {
    if (!eat(world)) {
      mon.fed = false;
      mon.friendship = Math.max(0, mon.friendship + FRIENDSHIP.hungry);
      hungry += 1;
      continue;
    }
    mon.fed = true;
    mon.friendship = Math.min(FRIENDSHIP.max, mon.friendship + FRIENDSHIP.fed);
    const product = PRODUCTS[mon.dex];
    if (!product) continue;
    // A fond Pokémon sometimes makes two; a devoted one always does.
    const extra = mon.friendship >= 200 ? 1 : mon.friendship >= 120 && nextRandom(world.rng) < 0.5 ? 1 : 0;
    produced[product] = (produced[product] ?? 0) + 1 + extra;
  }
  for (const [id, n] of Object.entries(produced)) world.barn.output[id] = (world.barn.output[id] ?? 0) + n;
  return { produced, hungry };
}

/** Take everything waiting in the barn. */
export function collectBarn(world: World): Record<string, number> {
  const got = world.barn.output;
  for (const [id, n] of Object.entries(got)) world.inventory[id] = (world.inventory[id] ?? 0) + n;
  world.barn.output = {};
  return got;
}

export function barnUpgradeBlocker(world: World): string | null {
  const next = BARN_LEVELS[world.barn.level + 1];
  if (!next?.cost) return 'Your barn is as big as barns get.';
  if (reputationLevel(world.reputation) < next.cost.reputation) return `The carpenter only builds a ${next.name} for folk with reputation level ${next.cost.reputation}.`;
  if (world.player.gold < next.cost.gold) return `Needs ${next.cost.gold}g.`;
  for (const [id, n] of Object.entries(next.cost.items)) if ((world.inventory[id] ?? 0) < n) return `Needs ${n} ${item(id).name}.`;
  return null;
}

/** The carpenter builds the next barn straight away. */
export function upgradeBarn(world: World): boolean {
  if (barnUpgradeBlocker(world)) return false;
  const cost = BARN_LEVELS[world.barn.level + 1]!.cost!;
  world.player.gold -= cost.gold;
  for (const [id, n] of Object.entries(cost.items)) takeItem(world, id, n);
  world.barn.level += 1;
  return true;
}

export function ranchBlocker(world: World, dex: number): string | null {
  const entry = RANCH_STOCK.find((r) => r.dex === dex);
  if (!entry) return 'Not for sale.';
  if (reputationLevel(world.reputation) < entry.reputation) return `Needs reputation level ${entry.reputation}.`;
  if (world.player.gold < entry.price) return `Needs ${entry.price}g.`;
  return null;
}

/** Buy livestock: it moves straight into the barn if there's room, else the box. */
export function buyLivestock(world: World, dex: number): 'farm' | 'box' | null {
  if (ranchBlocker(world, dex)) return null;
  world.player.gold -= RANCH_STOCK.find((r) => r.dex === dex)!.price;
  const mon = makeMon(dex, 5, world.rng);
  adopt(world, mon, false);
  if (!setRole(world, mon.uid, 'farm') && world.farm.includes(mon.uid)) return 'farm';
  return 'box';
}

/** A pat on the head: a little friendship, once a day per Pokémon. */
export function pet(world: World, uid: number): boolean {
  const mon = monByUid(world, uid);
  if (!mon || world.petted.includes(uid)) return false;
  world.petted.push(uid);
  mon.friendship = Math.min(FRIENDSHIP.max, mon.friendship + FRIENDSHIP.pet);
  return true;
}

export function hearts(friendship: number): number {
  return Math.min(5, Math.floor(friendship / 51));
}

export function productOf(dex: number): string | null {
  return PRODUCTS[dex] ?? null;
}

export function greenhouseBlocker(world: World): string | null {
  if (world.greenhouse) return 'The greenhouse is already repaired.';
  if (reputationLevel(world.reputation) < GREENHOUSE_COST.reputation) return `The carpenter only takes this on for folk with reputation level ${GREENHOUSE_COST.reputation}.`;
  if (world.player.gold < GREENHOUSE_COST.gold) return `Needs ${GREENHOUSE_COST.gold}g.`;
  for (const [id, n] of Object.entries(GREENHOUSE_COST.items)) if ((world.inventory[id] ?? 0) < n) return `Needs ${n} ${item(id).name}.`;
  return null;
}

/** The carpenter fixes the greenhouse: its beds take any seed, all year, and crows can't get in. */
export function repairGreenhouse(world: World): boolean {
  if (greenhouseBlocker(world)) return false;
  world.player.gold -= GREENHOUSE_COST.gold;
  for (const [id, n] of Object.entries(GREENHOUSE_COST.items)) takeItem(world, id, n);
  world.greenhouse = true;
  return true;
}
