import type { GameState } from '../state/types';

/**
 * mulberry32, with its state kept in the save. Every roll in the game draws
 * from here, so a save and a sequence of actions always replay identically —
 * which is what lets the tests and the bot assert on exact outcomes.
 */
export function rand(s: GameState): number {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Rounds `x` up or down at random, keeping the expectation exact. */
export function roundRandom(s: GameState, x: number): number {
  const floor = Math.floor(x);
  return floor + (rand(s) < x - floor ? 1 : 0);
}

export function pickWeighted<T>(s: GameState, items: readonly T[], weight: (t: T) => number): T {
  let total = 0;
  for (const it of items) total += weight(it);
  let r = rand(s) * total;
  for (const it of items) {
    r -= weight(it);
    if (r <= 0) return it;
  }
  return items[items.length - 1]!;
}

/** A small, stable string hash for seeding things like the day's contracts. */
export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}
