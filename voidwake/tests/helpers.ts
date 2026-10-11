import { createCaptain, newGame } from '../src/game/engine';
import type { GameState } from '../src/state/types';

/** A fresh campaign with a captain made and the first sector generated. */
export function started(seed = 7, origin = 'salvager'): GameState {
  const s = newGame(seed);
  createCaptain(s, 'Tester', origin);
  return s;
}
