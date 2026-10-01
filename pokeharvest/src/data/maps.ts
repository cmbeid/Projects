/**
 * The places you can walk, one character per tile. Each is taller than
 * wide, so a phone held upright sees a good slice of it.
 *
 *   .  grass (on the farm, can be tilled)    =  path
 *   g  tall grass: wild Pokémon hide here    T  tree
 *   R  rock                                  ~  pond (refills the can)
 *   H  farmhouse wall    D  door (sleep)     B  shipping bin
 *   M  Poké Mart stall   K  blacksmith's stall
 *   A  barn wall         a  barn door        Q  request board
 *   W  travelling merchant's cart (weekends)
 */
export type MapId = 'farm' | 'route1';

export interface Warp {
  x: number;
  y: number;
  to: MapId;
  tx: number;
  ty: number;
}

export interface MapDef {
  id: MapId;
  name: string;
  rows: readonly string[];
  /** Only your own land can be tilled. */
  farmable: boolean;
  warps: readonly Warp[];
}

const FARM_ROWS: readonly string[] = [
  'TTTTTTTTTTTTTTTTTTTTTTTT',
  'T......................T',
  'T.HHHHH..........~~~...T',
  'T.HHHHH.........~~~~~..T',
  'T.HHDHH.B.Q.....~~~~~..T',
  'T...=...........~~~~...T',
  'T...=..........R.......T',
  'T...=................T.T',
  'T...========...........T',
  'T..........=.....AAAAA.T',
  'T..........=.....AAAAA.T',
  'T..........=.....AAaAA.T',
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
  'T..........=..W........T',
  'T..........=...........T',
  'T..........=.M..K......T',
  'T..........=...........T',
  'TTTTTTTTTTT=TTTTTTTTTTTT',
];

/** Route 1, south of the farm gate. The tall grass further from the farm hides stronger Pokémon. */
const ROUTE1_ROWS: readonly string[] = [
  'TTTTTTTTTTT=TTTTTTTTTTTT',
  'T..........=...........T',
  'T.gggg.....=....gggggg.T',
  'T.gggggg...=...ggggggg.T',
  'T.gggggg...=...ggggggg.T',
  'T..gggg....=....ggggg..T',
  'T..........=...........T',
  'TTT....~~~~=.......RR..T',
  'T.....~~~~~=..gggg.....T',
  'T.....~~~~.=..gggg.....T',
  'T..R.......=..gggg..T..T',
  'T..........=...........T',
  'TTTTTT.....=.....TTTTTTT',
  'T..........=...........T',
  'T.gggggg...=....gggggg.T',
  'T.gggggg...=....gggggg.T',
  'T.gggg.....=.....gggg..T',
  'T..........=...........T',
  'T...T......=......T....T',
  'T..........=...........T',
  'T.ggggg....=....ggggg..T',
  'T.ggggg....=....ggggg..T',
  'T.ggggg....=....ggggg..T',
  'T..........=...........T',
  'T....R.....=.......T...T',
  'T..........=...........T',
  'T..gggggg..=..gggggg...T',
  'T..gggggg..=..gggggg...T',
  'T..........=...........T',
  'T..........=...........T',
  'T..........=...........T',
  'TTTTTTTTTTTTTTTTTTTTTTTT',
];

export const MAPS: Record<MapId, MapDef> = {
  farm: { id: 'farm', name: 'Your farm', rows: FARM_ROWS, farmable: true, warps: [{ x: 11, y: 31, to: 'route1', tx: 11, ty: 1 }] },
  route1: { id: 'route1', name: 'Route 1', rows: ROUTE1_ROWS, farmable: false, warps: [{ x: 11, y: 0, to: 'farm', tx: 11, ty: 30 }] },
};

export const MAP_IDS = Object.keys(MAPS) as MapId[];

/** Kept for the farm's own callers. */
export const FARM = FARM_ROWS;
export const MAP_W = 24;
export const MAP_H = FARM_ROWS.length;

export function mapSize(id: MapId): { w: number; h: number } {
  const rows = MAPS[id].rows;
  return { w: rows[0]!.length, h: rows.length };
}

/** Where you wake up: just outside the farmhouse door. */
export const SPAWN = { x: 4, y: 5 } as const;
/** Where farm Pokémon gather when they've nothing to do: outside the barn door. */
export const BARNYARD = { x: 19, y: 12 } as const;

export type TileKind = 'grass' | 'tall' | 'path' | 'tree' | 'rock' | 'water' | 'house' | 'door' | 'bin' | 'mart' | 'smith' | 'barn' | 'barndoor' | 'board' | 'merchant';

const KINDS: Record<string, TileKind> = {
  '.': 'grass', g: 'tall', '=': 'path', T: 'tree', R: 'rock', '~': 'water', H: 'house', D: 'door', B: 'bin', M: 'mart', K: 'smith',
  A: 'barn', a: 'barndoor', Q: 'board', W: 'merchant',
};

export function tileAt(map: MapId, x: number, y: number): TileKind {
  const rows = MAPS[map].rows;
  const row = rows[y];
  if (!row || x < 0 || x >= row.length) return 'tree';
  return KINDS[row[x]!] ?? 'grass';
}

/** Tiles you can walk on. Everything else is walked up to and used. */
export function walkable(kind: TileKind): boolean {
  return kind === 'grass' || kind === 'path' || kind === 'tall';
}

export function warpAt(map: MapId, x: number, y: number): Warp | undefined {
  return MAPS[map].warps.find((w) => w.x === x && w.y === y);
}
