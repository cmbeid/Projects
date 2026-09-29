/**
 * The campaigns: nine places in each of nine regions, Kanto to Paldea — each ending
 * with its Gym Leader's ace, the last with the Pokémon League — and an
 * endless map per region. The maps themselves live in `maps/`, one file per
 * region; this module gathers them and holds the helpers.
 *
 * A map is a 9 × 15 grid of terrain and one or more paths. Paths are
 * waypoints in tile coordinates — straight runs between them — starting and
 * usually ending just off the grid. A `warp` waypoint is reached instantly
 * (Silph Co.'s teleport pads). The tiles a path crosses are worked out from
 * the waypoints, so the terrain grid can put anything under them — except
 * ice, which stays slippery under the path.
 *
 * Terrain:
 *   .  grass — buildable           ,  flowers — buildable
 *   =  floor / deck — buildable     h  ledge — buildable, +0.5 range
 *   s  sand — buildable             i  ice — buildable; enemies slide faster over it
 *   ~  water — only swimmers        T  tree — blocked
 *   R  rock — blocked               X  wall — blocked
 *   g  grave — blocked              L  lava — blocked
 *   B  bamboo / pillar — blocked
 */
import { ALOLA } from './maps/alola';
import { gauntletMap } from './maps/frontier';
import { GALAR } from './maps/galar';
import { HISUI } from './maps/hisui';
import { HOENN } from './maps/hoenn';
import { JOHTO } from './maps/johto';
import { KALOS } from './maps/kalos';
import { KANTO } from './maps/kanto';
import { KITAKAMI } from './maps/kitakami';
import { ORANGE } from './maps/orange';
import { PALDEA } from './maps/paldea';
import { SINNOH } from './maps/sinnoh';
import { UNOVA } from './maps/unova';
import { type BossDef, COLS, type MapDef, ROWS, TERRAIN, type Terrain, type Waypoint } from './maps/types';

export * from './maps/types';

export const MAPS: readonly MapDef[] = [...KANTO, ...JOHTO, ...HOENN, ...SINNOH, ...UNOVA, ...KALOS, ...ALOLA, ...GALAR, ...PALDEA, ...ORANGE, ...HISUI, ...KITAKAMI];

export function terrainAt(map: MapDef, x: number, y: number): Terrain {
  return TERRAIN[map.grid[y]?.[x] ?? 'X'] ?? 'grass';
}

/** The Battle Frontier's maps: outside the regions, but battles like any other. */
export const FRONTIER_MAPS: readonly MapDef[] = [gauntletMap(MAPS)];

export const MAP_BY_ID: ReadonlyMap<string, MapDef> = new Map([...MAPS, ...FRONTIER_MAPS].map((m) => [m.id, m]));

/** Every boss a map can send: its leader and partners, the Elite Four, an endless map's rotation. */
export function mapBosses(map: MapDef): BossDef[] {
  const bosses = [map.boss, ...(map.extraBosses ?? []).map((b) => b.boss), ...(map.rotation ?? [])];
  return bosses.flatMap((b) => [b, ...(b.partners ?? [])]);
}

export function mapDef(id: string): MapDef {
  const m = MAP_BY_ID.get(id);
  if (!m) throw new Error(`No map ${id}`);
  return m;
}

export function waypointXY(w: Waypoint): { x: number; y: number; warp: boolean } {
  return Array.isArray(w) ? { x: w[0], y: w[1], warp: false } : { ...(w as { x: number; y: number }), warp: true };
}

/** Every tile a path passes through, as "x,y" keys. */
export function pathTiles(map: MapDef): Set<string> {
  const tiles = new Set<string>();
  for (const path of map.paths) {
    for (let i = 1; i < path.length; i += 1) {
      const a = waypointXY(path[i - 1]!);
      const b = waypointXY(path[i]!);
      if (b.warp) {
        tiles.add(`${b.x},${b.y}`);
        continue;
      }
      const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      for (let k = 0; k <= steps; k += 1) {
        const x = a.x + Math.sign(b.x - a.x) * k;
        const y = a.y + Math.sign(b.y - a.y) * k;
        if (x >= 0 && y >= 0 && x < COLS && y < ROWS) tiles.add(`${x},${y}`);
      }
    }
  }
  return tiles;
}

/** Warp pads: where enemies vanish and reappear. */
export function warpTiles(map: MapDef): { from: { x: number; y: number }; to: { x: number; y: number } }[] {
  const out: { from: { x: number; y: number }; to: { x: number; y: number } }[] = [];
  for (const path of map.paths) {
    for (let i = 1; i < path.length; i += 1) {
      const b = waypointXY(path[i]!);
      if (b.warp) out.push({ from: waypointXY(path[i - 1]!), to: b });
    }
  }
  return out;
}
