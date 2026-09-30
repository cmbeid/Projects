/** A* over the tile grid, four directions, every step costing the same. */
export interface Point {
  x: number;
  y: number;
}

const DIRS: readonly Point[] = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];

/**
 * The tiles to walk, not counting `from`, ending on a tile `goal` accepts; or
 * null when no such tile can be reached. `from` itself counts, giving [].
 */
export function findPath(
  from: Point,
  goal: (p: Point) => boolean,
  heuristic: (p: Point) => number,
  passable: (p: Point) => boolean,
  limit = 4000,
): Point[] | null {
  const key = (p: Point): number => p.y * 4096 + p.x;
  const open: { p: Point; f: number; g: number }[] = [{ p: from, f: heuristic(from), g: 0 }];
  const came = new Map<number, Point | null>([[key(from), null]]);
  const cost = new Map<number, number>([[key(from), 0]]);
  let expanded = 0;
  while (open.length && expanded < limit) {
    let best = 0;
    for (let i = 1; i < open.length; i += 1) if (open[i]!.f < open[best]!.f) best = i;
    const { p, g } = open.splice(best, 1)[0]!;
    expanded += 1;
    if (goal(p)) {
      const path: Point[] = [];
      let at: Point | null | undefined = p;
      while (at && key(at) !== key(from)) {
        path.unshift(at);
        at = came.get(key(at));
      }
      return path;
    }
    for (const d of DIRS) {
      const n = { x: p.x + d.x, y: p.y + d.y };
      if (!passable(n)) continue;
      const k = key(n);
      const ng = g + 1;
      if (ng >= (cost.get(k) ?? Infinity)) continue;
      cost.set(k, ng);
      came.set(k, p);
      open.push({ p: n, g: ng, f: ng + heuristic(n) });
    }
  }
  return null;
}

export function manhattan(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** A path to `target` itself. */
export function pathTo(from: Point, target: Point, passable: (p: Point) => boolean): Point[] | null {
  return findPath(from, (p) => p.x === target.x && p.y === target.y, (p) => manhattan(p, target), passable);
}

/**
 * A path to a tile beside `target` (or onto it, if it can be stood on and
 * `onto` allows), so the walker can then use whatever is there.
 */
export function pathBeside(from: Point, target: Point, passable: (p: Point) => boolean, onto = false): Point[] | null {
  return findPath(
    from,
    (p) => manhattan(p, target) === 1 || (onto && manhattan(p, target) === 0),
    (p) => Math.max(0, manhattan(p, target) - 1),
    passable,
  );
}
