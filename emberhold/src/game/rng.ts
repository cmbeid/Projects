import type { LootTable } from '../data/types';
import type { GameState } from '../state/types';

/** mulberry32 on the state's own seed, so a run replays the same way in tests. */
export function rand(s: GameState): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(s: GameState, min: number, max: number): number {
  return min + Math.floor(rand(s) * (max - min + 1));
}

export function chance(s: GameState, p: number): boolean {
  return p > 0 && rand(s) < p;
}

export function pick<T>(s: GameState, list: readonly T[]): T {
  return list[Math.floor(rand(s) * list.length)]!;
}

/** Rolls a loot table once. Null when nothing drops. */
export function roll(s: GameState, table: LootTable | undefined): { item: string; qty: number } | null {
  if (!table || !table.entries.length || !chance(s, table.chance)) return null;
  const total = table.entries.reduce((a, e) => a + e.weight, 0);
  let r = rand(s) * total;
  for (const e of table.entries) {
    r -= e.weight;
    if (r < 0) return { item: e.item, qty: randInt(s, e.min, e.max) };
  }
  const last = table.entries[table.entries.length - 1]!;
  return { item: last.item, qty: last.min };
}
