import type { Feature } from '../data/types';
import type { GameState } from '../state/types';

export function hasFeature(s: GameState, f: Feature): boolean {
  return s.features.includes(f);
}

export function unlockFeature(s: GameState, f: Feature): void {
  if (!s.features.includes(f)) s.features.push(f);
}
