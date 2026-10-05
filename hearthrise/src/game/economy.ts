import { BUILDING, BUILDINGS } from '../data/buildings';
import { MATERIAL } from '../data/materials';
import { UPGRADES } from '../data/progression';
import type { BuildingDef, Stack } from '../data/types';
import type { GameState, Placed } from '../state/types';
import { derive } from './derive';
import { emit } from './events';
import { hasFeature } from './features';
import { canPlace, typeLevels } from './grid';
import { meetsRequirement } from './requirements';

/** Sum of a geometric run: `count` steps starting at `base * growth^from`. */
function series(base: number, growth: number, from: number, count: number): number {
  return Math.ceil((base * growth ** from * (growth ** count - 1)) / (growth - 1));
}

/** How many steps of a geometric run starting at `first` the purse covers. */
function affordableSteps(purse: number, first: number, growth: number, cost: (n: number) => number): number {
  if (purse < first) return 0;
  const n = Math.floor(Math.log((purse * (growth - 1)) / first + 1) / Math.log(growth));
  // Float error can overshoot by one at the boundary.
  return cost(n) <= purse ? n : Math.max(0, n - 1);
}

// --- Upgrades ----------------------------------------------------------------------

/** Price of `count` more levels of an upgrade already at `level`. */
export function upgradeCost(id: string, level: number, count = 1): number {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def) return Infinity;
  return series(def.baseCost, def.growth, level, count);
}

export function maxUpgradeLevels(s: GameState, id: string): number {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def) return 0;
  const level = s.upgrades[id] ?? 0;
  return affordableSteps(s.coins, def.baseCost * def.growth ** level, def.growth, (n) => upgradeCost(id, level, n));
}

export function upgradeAllowed(s: GameState, id: string): boolean {
  const def = UPGRADES.find((u) => u.id === id);
  return !!def && hasFeature(s, 'upgrades') && (!def.requires || hasFeature(s, def.requires));
}

export function buyUpgrade(s: GameState, id: string, count = 1): boolean {
  if (!upgradeAllowed(s, id) || count < 1) return false;
  const level = s.upgrades[id] ?? 0;
  const cost = upgradeCost(id, level, count);
  if (s.coins < cost) return false;
  s.coins -= cost;
  s.upgrades[id] = level + count;
  emit({ type: 'buy' });
  return true;
}

// --- Buildings ---------------------------------------------------------------------

export function buildingAllowed(s: GameState, def: BuildingDef): boolean {
  return hasFeature(s, 'build') && meetsRequirement(s, def.requires);
}

/** Price of `count` more levels of a type, given how many it already has across the city. */
export function levelCost(s: GameState, type: string, count = 1, from = typeLevels(s, type)): number {
  const def = BUILDING.get(type);
  if (!def) return Infinity;
  return Math.ceil(series(def.baseCost, def.growth, from, count) * buildDiscount(s));
}

/** The Architect passive takes a share off every building's price. */
export function buildDiscount(s: GameState): number {
  return Math.max(0.5, 1 - 0.06 * (s.passives['architect'] ?? 0));
}

export function hasInputs(s: GameState, inputs: readonly Stack[], times = 1): boolean {
  return inputs.every((x) => (s.inventory[x.id] ?? 0) >= x.n * times);
}

export function take(s: GameState, inputs: readonly Stack[]): void {
  for (const x of inputs) s.inventory[x.id] = (s.inventory[x.id] ?? 0) - x.n;
}

/** Whether one more of this type could be paid for (ignoring where it would go). */
export function canAffordPlace(s: GameState, type: string): boolean {
  const def = BUILDING.get(type);
  return !!def && buildingAllowed(s, def) && s.coins >= levelCost(s, type) && hasInputs(s, def.inputs);
}

export function place(s: GameState, type: string, district: number, x: number, y: number): Placed | null {
  const def = BUILDING.get(type);
  if (!def || !canAffordPlace(s, type) || !canPlace(s, type, district, x, y)) return null;
  s.coins -= levelCost(s, type);
  take(s, def.inputs);
  const b: Placed = { uid: s.nextUid++, type, district, x, y, lvl: 1 };
  s.buildings.push(b);
  s.counters.placed += 1;
  emit({ type: 'place', uid: b.uid, type_: type });
  return b;
}

function maxLevelOf(def: BuildingDef): number {
  return def.maxLevel ?? Infinity;
}

/** Levels a building could still take. */
export function headroom(b: Placed): number {
  const def = BUILDING.get(b.type);
  return def ? maxLevelOf(def) - b.lvl : 0;
}

export function upgradeBuilding(s: GameState, uid: number, count = 1): boolean {
  const b = s.buildings.find((x) => x.uid === uid);
  if (!b || count < 1 || headroom(b) < count) return false;
  const def = BUILDING.get(b.type)!;
  if (!buildingAllowed(s, def)) return false;
  const cost = levelCost(s, b.type, count);
  if (s.coins < cost) return false;
  s.coins -= cost;
  b.lvl += count;
  emit({ type: 'buy' });
  return true;
}

/** Levels of a type the coin on hand would buy, if any can be had at all. */
export function maxTypeLevels(s: GameState, type: string): number {
  const def = BUILDING.get(type);
  if (!def) return 0;
  const room = s.buildings.filter((b) => b.type === type).reduce((a, b) => a + headroom(b), 0);
  const from = typeLevels(s, type);
  const first = levelCost(s, type, 1, from);
  return Math.min(room, affordableSteps(s.coins, first, def.growth, (n) => levelCost(s, type, n, from)));
}

/**
 * Builds up every standing building of a type by `count` levels in all,
 * always raising the lowest first. The price does not care which one gets
 * the level; spreading them keeps every one worth looking at.
 */
export function upgradeType(s: GameState, type: string, count = 1): boolean {
  const def = BUILDING.get(type);
  const mine = s.buildings.filter((b) => b.type === type);
  if (!def || !buildingAllowed(s, def) || count < 1 || !mine.length) return false;
  const room = mine.reduce((a, b) => a + headroom(b), 0);
  if (room < count) return false;
  const cost = levelCost(s, type, count);
  if (s.coins < cost) return false;
  s.coins -= cost;
  for (let i = 0; i < count; i++) {
    const low = mine.filter((b) => headroom(b) > 0).reduce((a, b) => (b.lvl < a.lvl ? b : a));
    low.lvl += 1;
  }
  emit({ type: 'buy' });
  return true;
}

/** Coin back for pulling a building down: half of what its levels would cost now. */
export function demolishRefund(s: GameState, b: Placed): number {
  const total = typeLevels(s, b.type);
  return Math.floor(levelCost(s, b.type, b.lvl, total - b.lvl) * 0.5);
}

export function demolish(s: GameState, uid: number): boolean {
  const i = s.buildings.findIndex((b) => b.uid === uid);
  if (i < 0) return false;
  const refund = demolishRefund(s, s.buildings[i]!);
  s.buildings.splice(i, 1);
  s.coins += refund;
  emit({ type: 'demolish', uid });
  return true;
}

/** Picks a building up and sets it down elsewhere, for free. */
export function move(s: GameState, uid: number, district: number, x: number, y: number): boolean {
  const b = s.buildings.find((q) => q.uid === uid);
  if (!b || !canPlace(s, b.type, district, x, y, uid)) return false;
  b.district = district;
  b.x = x;
  b.y = y;
  emit({ type: 'place', uid, type_: b.type });
  return true;
}

/**
 * Puts back what it can of the plan kept from before the last Tide: every
 * building whose ground is open again and that the purse and stores cover,
 * cheapest first. Levels are not remembered; only the layout is.
 */
export function rebuildFromPlan(s: GameState): number {
  let built = 0;
  const pending = s.plan.filter((p) => !s.buildings.some((b) => b.district === p.district && b.x === p.x && b.y === p.y));
  for (let guard = 0; guard < 500 && pending.length; guard++) {
    let best = -1;
    let bestCost = Infinity;
    for (let i = 0; i < pending.length; i++) {
      const p = pending[i]!;
      if (!canPlace(s, p.type, p.district, p.x, p.y) || !canAffordPlace(s, p.type)) continue;
      const cost = levelCost(s, p.type);
      if (cost < bestCost) {
        best = i;
        bestCost = cost;
      }
    }
    if (best < 0) break;
    const p = pending.splice(best, 1)[0]!;
    if (place(s, p.type, p.district, p.x, p.y)) built += 1;
  }
  return built;
}

/** Plan entries still waiting for their ground or their price. */
export function planPending(s: GameState): number {
  return s.plan.filter((p) => !s.buildings.some((b) => b.district === p.district && b.x === p.x && b.y === p.y && b.type === p.type)).length;
}

/**
 * Spends the coin on hand across every upgrade and every standing building,
 * always on the cheapest next level, until nothing more is affordable. New
 * buildings are not placed: where things go is the player's call.
 */
export function spendAll(s: GameState): number {
  let bought = 0;
  for (let guard = 0; guard < 100_000; guard++) {
    let best: { cost: number; buy: () => void } | null = null;
    for (const u of UPGRADES) {
      if (!upgradeAllowed(s, u.id)) continue;
      const cost = upgradeCost(u.id, s.upgrades[u.id] ?? 0);
      if (!best || cost < best.cost) best = { cost, buy: () => { s.upgrades[u.id] = (s.upgrades[u.id] ?? 0) + 1; } };
    }
    for (const def of BUILDINGS) {
      if (!buildingAllowed(s, def)) continue;
      const room = s.buildings.filter((b) => b.type === def.id && headroom(b) > 0);
      if (!room.length) continue;
      const cost = levelCost(s, def.id);
      if (!best || cost < best.cost) {
        best = { cost, buy: () => { room.reduce((a, b) => (b.lvl < a.lvl ? b : a)).lvl += 1; } };
      }
    }
    if (!best || best.cost > s.coins) break;
    s.coins -= best.cost;
    best.buy();
    bought += 1;
  }
  if (bought > 0) emit({ type: 'buy' });
  return bought;
}

// --- Selling -----------------------------------------------------------------------

export function sellValue(s: GameState, id: string, n: number): number {
  return (MATERIAL.get(id)?.value ?? 0) * n * derive(s).sellMult;
}

export function sell(s: GameState, id: string, n = s.inventory[id] ?? 0): number {
  const have = s.inventory[id] ?? 0;
  const count = Math.min(have, Math.floor(n));
  if (count <= 0) return 0;
  const coins = sellValue(s, id, count);
  s.inventory[id] = have - count;
  s.coins += coins;
  s.counters.earned += coins;
  emit({ type: 'sell', coins });
  return coins;
}

/** Sells every kind of salvage (not relics, goods or hearts — those are for building and the Drafting Hall). */
export function sellAllSalvage(s: GameState, keep = 0): number {
  const mult = derive(s).sellMult;
  let coins = 0;
  for (const [id, n] of Object.entries(s.inventory)) {
    const mat = MATERIAL.get(id);
    if (mat?.kind !== 'salvage' || n <= keep) continue;
    const count = Math.floor(n - keep);
    coins += mat.value * count * mult;
    s.inventory[id] = n - count;
  }
  if (coins > 0) {
    s.coins += coins;
    s.counters.earned += coins;
    emit({ type: 'sell', coins });
  }
  return coins;
}
