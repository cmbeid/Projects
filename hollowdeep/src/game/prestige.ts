import { DESCENT_FLOOR, ECHOES } from '../data/progression';
import type { GameState } from '../state/types';
import { emit } from './events';
import { hasFeature } from './features';
import { spawnBlock } from './mining';

/** Echoes a Descent would pay right now. */
export function echoGain(s: GameState): number {
  if (s.maxDepth <= DESCENT_FLOOR) return 0;
  const raw = ((s.maxDepth - DESCENT_FLOOR) / 3) ** 1.5;
  return Math.floor(raw * (s.fixtures.includes('lens') ? 1.15 : 1));
}

export function echoCost(id: string, rank: number): number {
  const def = ECHOES.find((e) => e.id === id);
  if (!def) return Infinity;
  return Math.ceil(def.baseCost * def.growth ** rank);
}

export function buyEcho(s: GameState, id: string): boolean {
  const def = ECHOES.find((e) => e.id === id);
  if (!def) return false;
  const rank = s.echoUpgrades[id] ?? 0;
  if (rank >= def.max) return false;
  const cost = echoCost(id, rank);
  if (s.echoes < cost) return false;
  s.echoes -= cost;
  s.echoUpgrades[id] = rank + 1;
  return true;
}

export function startingDepth(s: GameState): number {
  return 1 + 5 * (s.echoUpgrades['memory'] ?? 0);
}

/**
 * Collapses the shaft. Coin, ore, bars, upgrades, machines and depth go;
 * the miner — level, stats, passives, gear, fixtures, recipes, missions —
 * comes back up with the Echoes.
 */
export function descend(s: GameState): boolean {
  const gain = echoGain(s);
  if (!hasFeature(s, 'descent') || gain <= 0) return false;
  s.echoes += gain;
  s.echoesEarned += gain;
  s.counters.descents += 1;

  const purse = s.echoUpgrades['purse'] ?? 0;
  s.coins = purse > 0 ? 500 * 5 ** purse : 0;
  s.inventory = {};
  s.upgrades = {};
  s.machines = {};
  s.furnace = s.furnace.map(() => ({ recipe: null, progress: -1, queued: 0 }));
  s.buffs = { dowse: 0, frenzy: 0, luck: 0, sage: 0 };
  s.depth = s.maxDepth = Math.min(startingDepth(s), s.deepestEver);
  s.blocksHere = 0;
  spawnBlock(s);
  emit({ type: 'descent', echoes: gain });
  return true;
}
