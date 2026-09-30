/** Test helpers: a quiet world and a way to run it. */
import { createWorld, tick, type World } from '../src/game/world';

export function world(starter = 7, seed = 1): World {
  return createWorld(seed, starter);
}

/** Run the sim for `seconds` of real time in small steps. */
export function run(w: World, seconds: number, step = 1 / 30): void {
  for (let t = 0; t < seconds; t += step) tick(w, step);
}

/** Put the player somewhere, standing still. */
export function stand(w: World, x: number, y: number): void {
  Object.assign(w.player, { x, y, path: [], pending: null });
}
