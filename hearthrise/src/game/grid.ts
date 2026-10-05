import { BUILDING } from '../data/buildings';
import { DISTRICTS, GRID_H, GRID_W, wardOfRow } from '../data/districts';
import { BALANCE } from '../data/progression';
import type { BuildingDef } from '../data/types';
import type { GameState, Placed } from '../state/types';

/**
 * The city's ground: one 6×8 grid per district, a row per ward. A row is
 * land once its ward has been opened; before that it is rubble. Buildings
 * are kept as a list with positions rather than as a grid, so a save is
 * small and a building can never be half in one place.
 */

/** Whether a tile is open ground (whatever is standing on it). */
export function tileOpen(s: GameState, district: number, x: number, y: number): boolean {
  if (district < 0 || district >= DISTRICTS.length) return false;
  if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return false;
  return wardOfRow(district, y) <= s.maxWard;
}

/** Districts with at least one row of land. */
export function openDistricts(s: GameState): number[] {
  return DISTRICTS.map((_, i) => i).filter((i) => DISTRICTS[i]!.from <= s.maxWard);
}

function covers(b: Placed, def: BuildingDef, x: number, y: number): boolean {
  return x >= b.x && x < b.x + def.w && y >= b.y && y < b.y + def.h;
}

export function buildingAt(s: GameState, district: number, x: number, y: number): Placed | null {
  for (const b of s.buildings) {
    if (b.district !== district) continue;
    const def = BUILDING.get(b.type);
    if (def && covers(b, def, x, y)) return b;
  }
  return null;
}

/** Whether `type` fits with its top-left at (x, y): every tile open and free (`ignore` may stand there, for a move). */
export function canPlace(s: GameState, type: string, district: number, x: number, y: number, ignore?: number): boolean {
  const def = BUILDING.get(type);
  if (!def) return false;
  for (let j = 0; j < def.h; j++) {
    for (let i = 0; i < def.w; i++) {
      if (!tileOpen(s, district, x + i, y + j)) return false;
      const other = buildingAt(s, district, x + i, y + j);
      if (other && other.uid !== ignore) return false;
    }
  }
  return true;
}

/** Every top-left position where `type` would fit. */
export function freeSpots(s: GameState, type: string, district: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) if (canPlace(s, type, district, x, y)) out.push({ x, y });
  return out;
}

interface Footprint {
  district: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

function footprint(b: { district: number; x: number; y: number }, def: BuildingDef): Footprint {
  return { district: b.district, x: b.x, y: b.y, w: def.w, h: def.h };
}

/** Two footprints touch along an edge (corners do not count). */
function touching(a: Footprint, b: Footprint): boolean {
  if (a.district !== b.district) return false;
  const overlapX = a.x < b.x + b.w && b.x < a.x + a.w;
  const overlapY = a.y < b.y + b.h && b.y < a.y + a.h;
  const adjX = a.x + a.w === b.x || b.x + b.w === a.x;
  const adjY = a.y + a.h === b.y || b.y + b.h === a.y;
  return (overlapY && adjX) || (overlapX && adjY);
}

/** The buildings sharing an edge with this footprint, each once. */
export function neighboursOf(s: GameState, f: Footprint, ignore?: number): Placed[] {
  const out: Placed[] = [];
  for (const n of s.buildings) {
    if (n.uid === ignore || n.district !== f.district) continue;
    const def = BUILDING.get(n.type);
    if (def && touching(f, footprint(n, def))) out.push(n);
  }
  return out;
}

/** What one neighbour is worth to a building of `def` in `district`. Crowding doubles the bad ones. */
export function likeValue(def: BuildingDef, other: BuildingDef, district: number): number {
  const v = def.likes[other.tag] ?? 0;
  return v < 0 && DISTRICTS[district]!.hazard === 'crowd' ? v * 2 : v;
}

export function adjacencyScore(s: GameState, b: Placed): number {
  const def = BUILDING.get(b.type);
  if (!def) return 0;
  let score = 0;
  for (const n of neighboursOf(s, footprint(b, def), b.uid)) score += likeValue(def, BUILDING.get(n.type)!, b.district);
  return score;
}

export function multFromScore(score: number): number {
  return Math.max(BALANCE.adjacencyFloor, 1 + BALANCE.adjacencyStep * score);
}

/** The building's output multiplier from its neighbours. */
export function adjacencyMult(s: GameState, b: Placed): number {
  return multFromScore(adjacencyScore(s, b));
}

/**
 * What placing `type` here would do: its own multiplier, and the change in
 * points it would make to each neighbour. For the ghost preview and the bot.
 */
export function previewPlacement(
  s: GameState,
  type: string,
  district: number,
  x: number,
  y: number,
  ignore?: number,
): { self: number; score: number; neighbours: { uid: number; delta: number }[] } {
  const def = BUILDING.get(type)!;
  const f: Footprint = { district, x, y, w: def.w, h: def.h };
  let score = 0;
  const neighbours: { uid: number; delta: number }[] = [];
  for (const n of neighboursOf(s, f, ignore)) {
    const nd = BUILDING.get(n.type)!;
    score += likeValue(def, nd, district);
    neighbours.push({ uid: n.uid, delta: likeValue(nd, def, district) });
  }
  return { self: multFromScore(score), score, neighbours };
}

/** The Harbour's lowest rows, which the tide reaches. */
export function tidal(b: { district: number; y: number }, def: BuildingDef): boolean {
  return DISTRICTS[b.district]!.hazard === 'tide' && b.y + def.h - 1 >= GRID_H - 2;
}

/** Gusts on the Cloudline: a cycle this long, gusting for the first part of it. */
export const GUST_CYCLE = 20;
export const GUST_LENGTH = 8;

export function gustOpen(s: GameState): boolean {
  return s.time % GUST_CYCLE < GUST_LENGTH;
}

export function tideHigh(s: GameState): boolean {
  return s.time % BALANCE.tideCycle < BALANCE.tideHigh;
}

/** A building whose ground is under water right now does no work. */
export function flooded(s: GameState, b: Placed): boolean {
  const def = BUILDING.get(b.type);
  if (!def || !tidal(b, def)) return false;
  return tideHigh(s) && !s.fixtures.includes('seawall') && s.buffs.calm <= 0;
}

/** Levels of a type across every one standing. */
export function typeLevels(s: GameState, type: string): number {
  let n = 0;
  for (const b of s.buildings) if (b.type === type) n += b.lvl;
  return n;
}

export function typeCount(s: GameState, type: string): number {
  let n = 0;
  for (const b of s.buildings) if (b.type === type) n += 1;
  return n;
}
