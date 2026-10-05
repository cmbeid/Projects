import { CHARTER, TIDE_FLOOR } from '../data/progression';
import type { GameState } from '../state/types';
import { spawnRuin } from './clearing';
import { emit } from './events';
import { hasFeature } from './features';

/** Memories the Tide would leave you with right now. */
export function memoryGain(s: GameState): number {
  if (s.maxWard <= TIDE_FLOOR) return 0;
  // Past ward 33 each ward is worth a little more than the last, so a long
  // run keeps paying for the heavier ruins it took to get there.
  const raw = ((s.maxWard - TIDE_FLOOR) / 1.2) ** 1.5 * 1.05 ** Math.max(0, s.maxWard - 33);
  return Math.floor(raw * (s.fixtures.includes('archive') ? 1.15 : 1));
}

export function charterCost(id: string, rank: number): number {
  const def = CHARTER.find((e) => e.id === id);
  if (!def) return Infinity;
  return Math.ceil(def.baseCost * def.growth ** rank);
}

export function buyCharter(s: GameState, id: string): boolean {
  const def = CHARTER.find((e) => e.id === id);
  if (!def) return false;
  const rank = s.charter[id] ?? 0;
  if (rank >= def.max) return false;
  const cost = charterCost(id, rank);
  if (s.memories < cost) return false;
  s.memories -= cost;
  s.charter[id] = rank + 1;
  return true;
}

/** The ward each run begins at, with the wards before it already standing open. */
export function startingWard(s: GameState): number {
  return Math.min(1 + 2 * (s.charter['maps'] ?? 0), s.furthestEver);
}

/**
 * The sea comes in. Coin, salvage, goods, upgrades, every building and every
 * ward go; the Founder — level, stats, passives, regalia, fixtures, recipes,
 * the story — stays on the beach with the Memories. The layout is kept as a
 * plan, so the city can be put back where it stood.
 */
export function letTideIn(s: GameState): boolean {
  const gain = memoryGain(s);
  if (!hasFeature(s, 'tide') || gain <= 0) return false;
  s.memories += gain;
  s.memoriesEarned += gain;
  s.counters.tides += 1;

  if (s.buildings.length) s.plan = s.buildings.map((b) => ({ type: b.type, district: b.district, x: b.x, y: b.y }));
  const purse = s.charter['purse'] ?? 0;
  s.coins = purse > 0 ? 500 * 5 ** purse : 0;
  s.inventory = {};
  s.upgrades = {};
  s.buildings = [];
  s.workshops = s.workshops.map(() => ({ recipe: null, progress: -1, queued: 0 }));
  s.buffs = { survey: 0, festival: 0, ink: 0, almanac: 0, overtime: 0, wine: 0, seek: 0, calm: 0 };
  s.ward = s.maxWard = startingWard(s);
  s.ruinsHere = 0;
  spawnRuin(s);
  emit({ type: 'tide', memories: gain });
  return true;
}
