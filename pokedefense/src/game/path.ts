/** Path geometry: distance along a path to a point on the map, in tile units. */
import { type MapDef, waypointXY } from '../data/maps';

export interface PathGeom {
  /** Tile-centre points. */
  points: { x: number; y: number }[];
  /** Distance along the path at each point; a warp adds nothing. */
  cum: number[];
  length: number;
}

export function buildPath(map: MapDef, index: number): PathGeom {
  const raw = map.paths[index]!.map(waypointXY);
  const points = raw.map((p) => ({ x: p.x + 0.5, y: p.y + 0.5 }));
  const cum = [0];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    cum.push(cum[i - 1]! + (raw[i]!.warp ? 0 : Math.hypot(b.x - a.x, b.y - a.y)));
  }
  return { points, cum, length: cum[cum.length - 1]! };
}

/** Where on the map `d` tiles along the path is, and which way it is heading. */
export function pointAt(path: PathGeom, d: number): { x: number; y: number; dx: number; dy: number } {
  const dist = Math.max(0, Math.min(path.length, d));
  // The first real (non-warp) segment that reaches `dist`.
  let i = 1;
  while (i < path.cum.length - 1 && !(path.cum[i]! > path.cum[i - 1]! && path.cum[i]! >= dist)) i += 1;
  const a = path.points[i - 1]!;
  const b = path.points[i]!;
  const len = path.cum[i]! - path.cum[i - 1]!;
  const f = len > 0 ? (dist - path.cum[i - 1]!) / len : 1;
  const dx = Math.sign(b.x - a.x);
  const dy = Math.sign(b.y - a.y);
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, dx, dy };
}
