/**
 * The bench by the farmhouse. Sit on it and the day runs faster: handy for
 * waiting on crops, machines and your Pokémon. Any tap or step gets you up,
 * and you stand up by yourself at midnight so you don't nod off out there.
 */
import { BENCH } from '../data/maps';
import { tileOf, type World } from './model';

/** How much faster time runs while you sit. */
export const BENCH_SPEED = 6;
/** You get up at midnight: bedtime. */
export const BENCH_UNTIL = 24 * 60;

export function seated(world: World): boolean {
  return world.player.seat !== null;
}

/** Sit on the bench from where you stand. False if it's too late. */
export function sitDown(world: World): boolean {
  const p = world.player;
  if (p.seat || world.clock >= BENCH_UNTIL) return false;
  p.seat = tileOf(p);
  p.x = BENCH.x;
  p.y = BENCH.y;
  p.path = [];
  p.pending = null;
  p.facing = 'down';
  world.events.push({ kind: 'sit', x: BENCH.x, y: BENCH.y, text: `Time ×${BENCH_SPEED}` });
  return true;
}

/** Get up, back onto the tile you sat down from. `text` floats over you as you go. */
export function standUp(world: World, text?: string): boolean {
  const p = world.player;
  if (!p.seat) return false;
  world.events.push({ kind: 'stand', x: p.seat.x, y: p.seat.y, ...(text ? { text } : {}) });
  p.x = p.seat.x;
  p.y = p.seat.y;
  p.seat = null;
  p.path = [];
  p.pending = null;
  return true;
}
