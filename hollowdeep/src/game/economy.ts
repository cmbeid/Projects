import { MATERIAL } from '../data/materials';
import { MACHINES, UPGRADES } from '../data/progression';
import type { GameState } from '../state/types';
import { derive } from './derive';
import { emit } from './events';
import { hasFeature } from './features';

export function upgradeCost(id: string, level: number): number {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def) return Infinity;
  return Math.ceil(def.baseCost * def.growth ** level);
}

export function buyUpgrade(s: GameState, id: string): boolean {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def || !hasFeature(s, 'upgrades') || (def.requires && !hasFeature(s, def.requires))) return false;
  const level = s.upgrades[id] ?? 0;
  const cost = upgradeCost(id, level);
  if (s.coins < cost) return false;
  s.coins -= cost;
  s.upgrades[id] = level + 1;
  emit({ type: 'buy' });
  return true;
}

/** Price of `count` more machines when `owned` are already running. */
export function machineCost(id: string, owned: number, count = 1): number {
  const def = MACHINES.find((m) => m.id === id);
  if (!def) return Infinity;
  // Geometric series: base * g^owned * (g^count - 1) / (g - 1).
  return Math.ceil((def.baseCost * def.growth ** owned * (def.growth ** count - 1)) / (def.growth - 1));
}

export function maxAffordable(s: GameState, id: string): number {
  const def = MACHINES.find((m) => m.id === id);
  if (!def) return 0;
  const owned = s.machines[id] ?? 0;
  const first = def.baseCost * def.growth ** owned;
  if (s.coins < first) return 0;
  const n = Math.floor(Math.log((s.coins * (def.growth - 1)) / first + 1) / Math.log(def.growth));
  // Float error can overshoot by one at the boundary.
  return machineCost(id, owned, n) <= s.coins ? n : Math.max(0, n - 1);
}

export function buyMachine(s: GameState, id: string, count = 1): boolean {
  const def = MACHINES.find((m) => m.id === id);
  if (!def || !hasFeature(s, def.requires) || count < 1) return false;
  const owned = s.machines[id] ?? 0;
  const cost = machineCost(id, owned, count);
  if (s.coins < cost) return false;
  s.coins -= cost;
  s.machines[id] = owned + count;
  emit({ type: 'buy' });
  return true;
}

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

/** Sells every ore (not gems, bars or hearts — those are for the workbench). */
export function sellAllOre(s: GameState, keep = 0): number {
  const mult = derive(s).sellMult;
  let coins = 0;
  for (const [id, n] of Object.entries(s.inventory)) {
    const mat = MATERIAL.get(id);
    if (mat?.kind !== 'ore' || n <= keep) continue;
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
