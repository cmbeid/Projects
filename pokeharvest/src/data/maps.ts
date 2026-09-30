/**
 * The farm, one character per tile. Taller than wide, so a phone held
 * upright sees a good slice of it.
 *
 *   .  grass (can be tilled)     =  path
 *   T  tree                      R  rock
 *   ~  pond (refills the can)    H  farmhouse wall
 *   D  farmhouse door (sleep)    B  shipping bin
 *   M  Poké Mart stall
 */
export const FARM: readonly string[] = [
  'TTTTTTTTTTTTTTTTTTTTTTTT',
  'T......................T',
  'T.HHHHH..........~~~...T',
  'T.HHHHH.........~~~~~..T',
  'T.HHDHH.B.......~~~~~..T',
  'T...=...........~~~~...T',
  'T...=..........R.......T',
  'T...=................T.T',
  'T...========...........T',
  'T..........=...........T',
  'T..........=......R....T',
  'T..........=...........T',
  'T..........=...........T',
  'T..........=...........T',
  'T..........=...........T',
  'TT.........=..........TT',
  'T..........=...........T',
  'T..........=...........T',
  'T..........=...........T',
  'T..........=...........T',
  'T...R......=...........T',
  'T..........=...........T',
  'T..........=...........T',
  'T..........=...........T',
  'T..........=...........T',
  'T..........=...........T',
  'T..........=.........R.T',
  'T..........=...........T',
  'T..........=...........T',
  'T..........=.M.........T',
  'T..........=...........T',
  'TTTTTTTTTTT=TTTTTTTTTTTT',
];

export const MAP_W = 24;
export const MAP_H = FARM.length;

/** Where you wake up: just outside the door. */
export const SPAWN = { x: 4, y: 5 } as const;

export type TileKind = 'grass' | 'path' | 'tree' | 'rock' | 'water' | 'house' | 'door' | 'bin' | 'mart';

const KINDS: Record<string, TileKind> = {
  '.': 'grass', '=': 'path', T: 'tree', R: 'rock', '~': 'water', H: 'house', D: 'door', B: 'bin', M: 'mart',
};

export function tileAt(x: number, y: number): TileKind {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return 'tree';
  return KINDS[FARM[y]![x]!] ?? 'grass';
}

/** Tiles you can walk on. Everything else is walked up to and used. */
export function walkable(kind: TileKind): boolean {
  return kind === 'grass' || kind === 'path';
}
