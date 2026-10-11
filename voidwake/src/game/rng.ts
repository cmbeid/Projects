import type { GameState } from '../state/types';

/**
 * mulberry32, with its state kept in the save. Every roll the game makes
 * draws from here, so a save and a sequence of actions always replay the
 * same — which is what lets the tests and the bot assert exact outcomes.
 */
export function rand(s: GameState): number {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  return mix(s.rng);
}

function mix(a: number): number {
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A free-standing generator for procedural content seeded from a number. */
export type Rng = () => number;
export function seeded(seed: number): Rng {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    return mix(a);
  };
}

export function randInt(r: Rng, lo: number, hi: number): number {
  return lo + Math.floor(r() * (hi - lo + 1));
}

export function pick<T>(r: Rng, items: readonly T[]): T {
  return items[Math.floor(r() * items.length)]!;
}

export function pickWeighted<T>(r: Rng, items: readonly T[], weight: (t: T) => number): T {
  let total = 0;
  for (const it of items) total += weight(it);
  let x = r() * total;
  for (const it of items) {
    x -= weight(it);
    if (x <= 0) return it;
  }
  return items[items.length - 1]!;
}

/** The state's generator as an `Rng`, for helpers that take one. */
export function stateRng(s: GameState): Rng {
  return () => rand(s);
}

export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}
