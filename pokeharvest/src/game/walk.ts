/** Moving along a path, a tile at a time. */
import type { Dir, Walker } from './model';

export function faceToward(w: Walker, dx: number, dy: number): void {
  if (Math.abs(dx) > Math.abs(dy)) w.facing = dx > 0 ? 'right' : 'left';
  else if (dy !== 0) w.facing = dy > 0 ? 'down' : 'up';
}

/** Step `w` along its path at `speed` tiles a second. Returns true once it has arrived (or had nowhere to go). */
export function walk(w: Walker, speed: number, dt: number): boolean {
  if (!w.path.length) return true;
  let budget = speed * dt;
  while (budget > 0 && w.path.length) {
    const next = w.path[0]!;
    const dx = next.x - w.x;
    const dy = next.y - w.y;
    const dist = Math.abs(dx) + Math.abs(dy);
    faceToward(w, dx, dy);
    if (dist <= budget) {
      w.x = next.x;
      w.y = next.y;
      budget -= dist;
      w.path.shift();
    } else {
      w.x += (dx / dist) * budget;
      w.y += (dy / dist) * budget;
      budget = 0;
    }
  }
  return w.path.length === 0;
}

export const DELTA: Record<Dir, { x: number; y: number }> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};
