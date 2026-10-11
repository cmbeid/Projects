import { BIOME } from '../data/biomes';
import { BAL } from '../data/progression';
import { SECTORS } from '../data/sectors';
import { storyForSector } from '../data/story';
import type { BiomeId, NodeKind } from '../data/types';
import type { GameState, MapNode, Planet, Sector } from '../state/types';
import { derive } from './derive';
import { planetName, starName } from './names';
import { pick, pickWeighted, randInt, seeded, type Rng } from './rng';
import { makeStation } from './station';

export const ROWS = 8;

/**
 * Lays out a sector as rows from the entry (bottom) to the gate (top), each
 * row linked to the next, with a few sideways links. Tall and narrow, so it
 * fits a phone held upright.
 */
export function generateSector(s: GameState, index: number, seed: number): Sector {
  const r = seeded(seed);
  const def = SECTORS[index]!;
  const nodes: MapNode[] = [];
  const rows: number[][] = [];
  for (let row = 0; row < ROWS; row++) {
    const count = row === 0 || row === ROWS - 1 ? 1 : randInt(r, 2, 4);
    const ids: number[] = [];
    for (let i = 0; i < count; i++) {
      const slot = (i + 0.5) / count;
      const x = count === 1 ? 0.5 : 0.12 + slot * 0.76 + (r() - 0.5) * (0.5 / count);
      const y = 1 - (row + 0.5) / ROWS + (r() - 0.5) * 0.04;
      const node: MapNode = {
        id: nodes.length,
        row,
        x,
        y,
        kind: row === 0 ? 'entry' : row === ROWS - 1 ? 'gate' : 'system',
        name: starName(r),
        links: [],
        visited: false,
        revealed: false,
        cleared: false,
        faction: def.faction,
        planets: [],
        station: null,
        mined: false,
      };
      nodes.push(node);
      ids.push(node.id);
    }
    rows.push(ids);
  }
  const link = (a: number, b: number): void => {
    if (a === b || nodes[a]!.links.includes(b)) return;
    nodes[a]!.links.push(b);
    nodes[b]!.links.push(a);
  };
  // Forward links: everyone reaches the next row, and everyone in the next row is reached.
  for (let row = 0; row < ROWS - 1; row++) {
    const here = rows[row]!;
    const next = rows[row + 1]!;
    for (const a of here) {
      const sorted = [...next].sort((p, q) => Math.abs(nodes[p]!.x - nodes[a]!.x) - Math.abs(nodes[q]!.x - nodes[a]!.x));
      link(a, sorted[0]!);
      if (sorted[1] !== undefined && r() < 0.45) link(a, sorted[1]);
    }
    for (const b of next) {
      if (!nodes[b]!.links.some((l) => nodes[l]!.row === row)) {
        const nearest = [...here].sort((p, q) => Math.abs(nodes[p]!.x - nodes[b]!.x) - Math.abs(nodes[q]!.x - nodes[b]!.x))[0]!;
        link(nearest, b);
      }
    }
    // The odd sideways hop.
    for (let i = 0; i + 1 < next.length; i++) if (r() < 0.25) link(next[i]!, next[i + 1]!);
  }

  // Kinds, from the sector's weights, with guarantees.
  const middle = nodes.filter((n) => n.row > 0 && n.row < ROWS - 1);
  const weights = Object.entries(def.kinds) as [NodeKind, number][];
  for (const n of middle) n.kind = pickWeighted(r, weights, (w) => w[1])[0];
  const ensure = (kind: NodeKind, rowsAllowed: number[], count: number): void => {
    for (let k = 0; k < count; k++) {
      const have = middle.filter((n) => n.kind === kind && rowsAllowed.includes(n.row)).length;
      if (have > k) continue;
      const pool = middle.filter((n) => rowsAllowed.includes(n.row) && n.kind !== 'station' && !(kind !== 'system' && n.kind === 'system' && middle.filter((m) => m.kind === 'system').length <= 3));
      if (pool.length) pick(r, pool).kind = kind;
    }
  };
  ensure('station', [1, 2], 1);
  ensure('station', [4, 5, 6], 1);
  ensure('system', [1, 2, 3], 2);
  ensure('system', [3, 4, 5, 6], 2);

  // Faction colour for patrols and stations.
  for (const n of nodes) {
    if (n.kind === 'patrol') n.faction = r() < 0.7 ? def.faction : pick(r, ['none', 'clans', 'concord', 'choir'] as const);
    if (n.kind === 'station') n.faction = r() < 0.75 ? def.faction : pick(r, ['none', 'clans', 'concord'] as const);
  }

  // Story pins. Each mission takes a node further up the map than the last.
  const missions = storyForSector(index);
  let minRow = 1;
  for (const m of missions) {
    const o = m.objective;
    if (o.k === 'rescue') continue;
    if (o.k === 'gate') {
      nodes[rows[ROWS - 1]![0]!]!.story = m.id;
      continue;
    }
    const wantKinds: NodeKind[] = o.k === 'land' ? ['system'] : o.k === 'deliver' ? ['station'] : o.k === 'defeat' ? ['patrol'] : ['derelict', 'anomaly', 'distress', 'nebula', 'asteroids', 'system'];
    const maxRow = o.k === 'defeat' ? ROWS - 2 : Math.min(ROWS - 2, minRow + 2);
    const lo = o.k === 'defeat' ? ROWS - 2 : minRow;
    let pool = middle.filter((n) => !n.story && n.row >= lo && n.row <= maxRow && wantKinds.includes(n.kind));
    if (!pool.length) pool = middle.filter((n) => !n.story && n.row >= lo && n.row <= maxRow && n.kind !== 'station');
    if (!pool.length) pool = middle.filter((n) => !n.story && n.row >= lo);
    const node = pick(r, pool);
    node.story = m.id;
    if (o.k === 'land') node.kind = 'system';
    if (o.k === 'deliver') node.kind = 'station';
    if (o.k === 'defeat') {
      node.kind = 'patrol';
      node.faction = def.faction;
    }
    minRow = Math.min(ROWS - 3, Math.max(minRow, node.row));
  }

  // Contents.
  for (const n of nodes) {
    if (n.kind === 'system') n.planets = makePlanets(r, n, def.biomes, index);
    if (n.kind === 'station') n.station = makeStation(s, r, n, index);
  }
  // Enough sleepers out there for the rescue missions, with some to spare.
  const planets = nodes.flatMap((n) => n.planets);
  let pods = planets.reduce((a, p) => a + p.pods, 0);
  const want = 7 + index * 3;
  for (let guard = 0; pods < want && planets.length && guard < 100; guard++) {
    pick(r, planets).pods++;
    pods++;
  }
  for (const m of missions) {
    if (m.objective.k !== 'land') continue;
    const node = nodes.find((n) => n.story === m.id)!;
    if (!node.planets.length) node.planets = makePlanets(r, node, def.biomes, index);
    const p = node.planets[0]!;
    p.biome = m.objective.biome;
    p.objective = m.id;
  }
  return { index, seed, nodes };
}

function makePlanets(r: Rng, n: MapNode, biomes: readonly BiomeId[], sector: number): Planet[] {
  const count = randInt(r, 1, sector === 0 ? 3 : 4);
  const out: Planet[] = [];
  for (let i = 0; i < count; i++) {
    const biome = pickWeighted(r, biomes, (b) => (b === 'wreck' ? 0.6 : 1));
    out.push({
      name: planetName(r, n.name, i),
      biome,
      size: randInt(r, 1, 3),
      seed: (r() * 2 ** 31) | 0,
      scanned: false,
      landings: 0,
      pods: r() < 0.45 + (biome === 'wreck' ? 0.4 : 0) ? randInt(r, 1, 2) : 0,
      ruin: r() < 0.35 || biome === 'wreck',
    });
  }
  return out;
}

export function node(s: GameState, id = s.at): MapNode {
  return s.sector.nodes[id]!;
}

/** Hops from `from` to every node, by breadth-first search. */
export function hops(s: GameState, from: number): number[] {
  const dist = s.sector.nodes.map(() => Infinity);
  dist[from] = 0;
  const q = [from];
  while (q.length) {
    const a = q.shift()!;
    for (const b of s.sector.nodes[a]!.links) {
      if (dist[b] === Infinity) {
        dist[b] = dist[a]! + 1;
        q.push(b);
      }
    }
  }
  return dist;
}

/** Sensors reveal nodes within range of where the ship is; visited ones stay revealed. */
export function reveal(s: GameState): void {
  const range = node(s).kind === 'nebula' ? 0 : derive(s).sensor;
  const d = hops(s, s.at);
  for (const n of s.sector.nodes) if (d[n.id]! <= range) n.revealed = true;
}

export function revealAll(s: GameState): void {
  for (const n of s.sector.nodes) n.revealed = true;
}

export function canJump(s: GameState, to: number): boolean {
  if (s.screen !== 'map') return false;
  if (!node(s).links.includes(to)) return false;
  return s.res.fuel + 1e-9 >= derive(s).fuelPerJump;
}

export function biomeName(id: BiomeId): string {
  return BIOME.get(id)!.name;
}

export function landingsLeft(p: Planet): number {
  return BAL.planetLandings - p.landings;
}
