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
 *   #  greenhouse glass  G  greenhouse soil   _  greenhouse doorway
 */
export type MapId = 'farm' | 'route1' | 'town' | 'route2' | 'route3';

export interface Warp {
  x: number;
  y: number;
  to: MapId;
  tx: number;
  ty: number;
}

/** A way blocked until the story clears it. */
export interface Gate {
  x: number;
  y: number;
  /** The story flag that opens it. */
  flag: string;
  look: 'log' | 'rocks';
  text: string;
}

export interface MapDef {
  id: MapId;
  name: string;
  rows: readonly string[];
  /** Only your own land can be tilled. */
  farmable: boolean;
  warps: readonly Warp[];
  gates?: readonly Gate[];
  /** Underground: always dim, with wild Pokémon anywhere on the floor. */
  cave?: boolean;
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
  'T..........=..########.T',
  'T..........=..#GGGGGG#.T',
  'T..........=..#GGGGGG#.T',
  'T...R......=..#GGGGGG#.T',
  'T..........=..#GGGGGG#.T',
  'T..........=..#GGGGGG#.T',
  'T..........=..###__###.T',
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
  'TTTTTTTTTTT=TTTTTTTTTTTT',
];

/** Cobblevale Town, south of Route 1: the Pokémon Center, the Mayor's Hall, the workshop and the townsfolk. */
const TOWN_ROWS: readonly string[] = [
  'TTTTTTTTTTT=TTTTTTTTTTTT',
  'T..........=...........T',
  'T.PPPPP....=....YYYYY..T',
  'T.PPPPP....=....YYYYY..T',
  'T.PPpPP....=....YYyYY..T',
  'T...=......=......=....T',
  'T...===============....T',
  'T..........=...........T',
  'T.SSSS.....=.....UUUU..T',
  'T.SSSS.....=.....UUUU..T',
  'T.SsSS.....=.....UuUU..T',
  'T..=.......=......=....T',
  'T..=.......=......=....T',
  'T..=====================',
  'T..........=...........T',
  'T..UUUU....=....UUUU...T',
  'T..UUUU....=....UUUU...T',
  'T..UuUU....=....UUuU...T',
  'T...=......=......=....T',
  'T...===============....T',
  'T..........=...........T',
  'T...T......=.......T...T',
  'T..........=...........T',
  'T....~~~~..=..RR.......T',
  'T....~~~~..=...........T',
  'T..........=...........T',
  'T..........=...........T',
  'T..........=...........T',
  'T..........=...........T',
  'T..........=...........T',
  'T..........=...........T',
  'TTTTTTTTTTT=TTTTTTTTTTTT',
];

/** Route 2, Whisperwood: a forest east of town, with Apricorn trees and fallen logs. */
const ROUTE2_ROWS: readonly string[] = [
  'TTTTTTTTTTTTTTTTTTTTTTTT',
  'TTggggTT.....%...ggggTTT',
  'T.ggggg.....&....gggggTT',
  'T.ggggg..T.......gggggTT',
  'TT.....TTT...%.........T',
  'T...........=.....TT...T',
  'T..%.gggg...=.gggg.....T',
  'T....gggg...=.gggg..&..T',
  'TT...gggg...=.gggg....TT',
  'TTT.........=.........TT',
  'TT..T...%...=...T....TTT',
  'T...........=.........TT',
  'T..gggg.....=...gggg...T',
  '=============..gggg....T',
  'T..gggg.....=..gggg..%.T',
  'T..gggg..&..=..........T',
  'TT..........=....TT....T',
  'TTT..%......=..........T',
  'T....ggggg..=..ggggg...T',
  'T....ggggg..=..ggggg...T',
  'T....ggggg..=..ggggg.&.T',
  'TT..........=.........TT',
  'T...TT..%...=...%..TT..T',
  'T...........=..........T',
  'T.gggggg....=...gggggg.T',
  'T.gggggg....=...gggggg.T',
  'T...........=..&.......T',
  'TTT...%.....=.....%..TTT',
  'TTTT........=........TTT',
  'TTTTTT......=......TTTTT',
  'TTTTTTTT...........TTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTT',
];

/** Route 3, Granite Pass: a cave south of town, with ore to mine. Wild Pokémon lurk anywhere on its floor. */
const ROUTE3_ROWS: readonly string[] = [
  'XXXXXXXXXXX,XXXXXXXXXXXX',
  'XXX,,,,,,,,,,,,,,,,,,XXX',
  'XX,,,$,,,,,,,,,,,$,,,,XX',
  'X,,,,,,,XXXX,,,,,,,,,,,X',
  'X,,$,,,,XXXX,,,,XX,,$,,X',
  'X,,,,,,,,,,,,,,,XX,,,,,X',
  'XXXX,,,,,,,,,,,,,,,,XXXX',
  'X,,,,,,$,,,,,,,,$,,,,,,X',
  'X,,XX,,,,,,,,,,,,,,XX,,X',
  'X,,XX,,,,,XXXX,,,,,XX,,X',
  'X,,,,,,$,,XXXX,,,$,,,,,X',
  'X,,,,,,,,,,,,,,,,,,,,,,X',
  'XXX,,,,,,,,,,,,,,,,,,XXX',
  'X,,,$,,,XXXXXXX,,,$,,,,X',
  'X,,,,,,,XXXXXXX,,,,,,,,X',
  'X,,,,,,,,,,,,,,,,,,,,,,X',
  'XX,,$,,,,,,,,,,,,,,$,,XX',
  'X,,,,,,,,XX,,,,,,,,,,,,X',
  'X,,,,,,,,XX,,,,$,,,,,,,X',
  'X,,$,,,,,,,,,,,,,,,,,,,X',
  'XXXXXX,,,,,,,,,,,,XXXXXX',
  'X,,,,,,,,,,$,,,,,,,,,,,X',
  'X,,,,XX,,,,,,,,,XX,,,,,X',
  'X,$,,XX,,,,,,,,,XX,,$,,X',
  'X,,,,,,,,,,,,,,,,,,,,,,X',
  'XXX,,,,,,,,$,,,,,,,,,XXX',
  'XXXX,,,,,,,,,,,,,,,,XXXX',
  'XXXXX,,,,,,,,,,,,,,XXXXX',
  'XXXXXX,,,,,,,,,,,,XXXXXX',
  'XXXXXXX,,,,,,,,,,XXXXXXX',
  'XXXXXXXX,,,,,,,,XXXXXXXX',
  'XXXXXXXXXXXXXXXXXXXXXXXX',
];

export const MAPS: Record<MapId, MapDef> = {
  farm: { id: 'farm', name: 'Your farm', rows: FARM_ROWS, farmable: true, warps: [{ x: 11, y: 31, to: 'route1', tx: 11, ty: 1 }] },
  route1: {
    id: 'route1', name: 'Route 1', rows: ROUTE1_ROWS, farmable: false,
    warps: [{ x: 11, y: 0, to: 'farm', tx: 11, ty: 30 }, { x: 11, y: 31, to: 'town', tx: 11, ty: 1 }],
    gates: [{ x: 11, y: 30, flag: 'road-open', look: 'log', text: 'A fallen tree blocks the road to town' }],
  },
  town: {
    id: 'town', name: 'Cobblevale Town', rows: TOWN_ROWS, farmable: false,
    warps: [{ x: 11, y: 0, to: 'route1', tx: 11, ty: 29 }, { x: 23, y: 13, to: 'route2', tx: 1, ty: 13 }, { x: 11, y: 31, to: 'route3', tx: 11, ty: 1 }],
    gates: [{ x: 11, y: 30, flag: 'pass-open', look: 'rocks', text: 'A rockslide blocks the way to Granite Pass' }],
  },
  route2: { id: 'route2', name: 'Whisperwood', rows: ROUTE2_ROWS, farmable: false, warps: [{ x: 0, y: 13, to: 'town', tx: 22, ty: 13 }] },
  route3: { id: 'route3', name: 'Granite Pass', rows: ROUTE3_ROWS, farmable: false, cave: true, warps: [{ x: 11, y: 0, to: 'town', tx: 11, ty: 29 }] },
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

export type TileKind =
  | 'grass' | 'tall' | 'path' | 'tree' | 'rock' | 'water' | 'house' | 'door' | 'bin' | 'mart' | 'smith'
  | 'barn' | 'barndoor' | 'board' | 'merchant' | 'glass' | 'ghsoil' | 'ghdoor'
  | 'center' | 'centerdoor' | 'hall' | 'halldoor' | 'shop' | 'shopdoor' | 'townhouse' | 'housedoor'
  | 'cavewall' | 'cavefloor' | 'apricorn' | 'log' | 'ore';

const KINDS: Record<string, TileKind> = {
  '.': 'grass', g: 'tall', '=': 'path', T: 'tree', R: 'rock', '~': 'water', H: 'house', D: 'door', B: 'bin', M: 'mart', K: 'smith',
  A: 'barn', a: 'barndoor', Q: 'board', W: 'merchant', '#': 'glass', G: 'ghsoil', _: 'ghdoor',
  P: 'center', p: 'centerdoor', Y: 'hall', y: 'halldoor', S: 'shop', s: 'shopdoor', U: 'townhouse', u: 'housedoor',
  X: 'cavewall', ',': 'cavefloor', '%': 'apricorn', '&': 'log', $: 'ore',
};

export function tileAt(map: MapId, x: number, y: number): TileKind {
  const rows = MAPS[map].rows;
  const row = rows[y];
  if (!row || x < 0 || x >= row.length) return 'tree';
  return KINDS[row[x]!] ?? 'grass';
}

/** Tiles you can walk on. Everything else is walked up to and used. */
export function walkable(kind: TileKind): boolean {
  return kind === 'grass' || kind === 'path' || kind === 'tall' || kind === 'ghsoil' || kind === 'ghdoor' || kind === 'cavefloor';
}

export function warpAt(map: MapId, x: number, y: number): Warp | undefined {
  return MAPS[map].warps.find((w) => w.x === x && w.y === y);
}

export function gateAt(map: MapId, x: number, y: number): Gate | undefined {
  return MAPS[map].gates?.find((g) => g.x === x && g.y === y);
}

export type NodeKind = 'apricorn' | 'log' | 'ore';

export interface ResourceNode {
  x: number;
  y: number;
  kind: NodeKind;
  /** Apricorn trees each grow one colour. */
  apricorn?: string;
}

const APRICORNS = ['red', 'blue', 'yellow', 'green', 'black'] as const;
const nodeCache = new Map<MapId, ResourceNode[]>();

/** Every Apricorn tree, fallen log and ore rock on a map, in reading order. */
export function nodesOn(map: MapId): ResourceNode[] {
  let nodes = nodeCache.get(map);
  if (!nodes) {
    nodes = [];
    let apricorns = 0;
    MAPS[map].rows.forEach((row, y) => [...row].forEach((ch, x) => {
      const kind = KINDS[ch];
      if (kind === 'apricorn') nodes!.push({ x, y, kind, apricorn: `${APRICORNS[apricorns++ % APRICORNS.length]}-apricorn` });
      else if (kind === 'log' || kind === 'ore') nodes!.push({ x, y, kind });
    }));
    nodeCache.set(map, nodes);
  }
  return nodes;
}

export function nodeAt(map: MapId, x: number, y: number): ResourceNode | undefined {
  return nodesOn(map).find((n) => n.x === x && n.y === y);
}

/** The doors of a building on any map, and what's behind them. */
export type DoorKind = 'center' | 'hall' | 'shop' | 'house';
export function doorAt(map: MapId, x: number, y: number): DoorKind | null {
  const kind = tileAt(map, x, y);
  return kind === 'centerdoor' ? 'center' : kind === 'halldoor' ? 'hall' : kind === 'shopdoor' ? 'shop' : kind === 'housedoor' ? 'house' : null;
}
