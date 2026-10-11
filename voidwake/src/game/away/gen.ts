import { BIOME, FAUNA_DEF } from '../../data/biomes';
import type { MatId } from '../../data/types';
import type { AwayEnt, AwayState, Planet } from '../../state/types';
import { pickWeighted, randInt, seeded, type Rng } from '../rng';

export const AWAY_W = 40;
export const AWAY_H = 56;

/** Tile helpers shared by the generator, the sim and the renderer. */
export function tileAt(a: { tiles: string; w: number; h: number }, x: number, y: number): string {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix < 0 || iy < 0 || ix >= a.w || iy >= a.h) return '#';
  return a.tiles[iy * a.w + ix]!;
}

export function walkable(ch: string): boolean {
  return ch !== '#';
}

/**
 * Caves by cellular automaton: random fill, five smoothing passes, then a
 * flood fill from the landing site walls off anything unreachable. Hazard
 * ground and liquid are grown as blobs on what's left.
 */
export function generateMap(seed: number, biomeId: Planet['biome'], size: number): { tiles: string; lander: { x: number; y: number } } {
  const b = BIOME.get(biomeId)!;
  const r = seeded(seed);
  const w = AWAY_W;
  const h = AWAY_H;
  let g: boolean[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g.push(x === 0 || y === 0 || x === w - 1 || y === h - 1 || r() < b.walls - (size - 2) * 0.02);
  for (let pass = 0; pass < 5; pass++) {
    const next: boolean[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let n = 0;
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (i || j) n += x + i < 0 || y + j < 0 || x + i >= w || y + j >= h || g[(y + j) * w + x + i] ? 1 : 0;
        const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
        next.push(edge || n >= 5 || (pass < 2 && n <= 1 && r() < 0.3));
      }
    }
    g = next;
  }
  // Clear a landing pad near the bottom middle.
  const lx = Math.floor(w / 2);
  const ly = h - 6;
  for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) g[(ly + j) * w + lx + i] = false;
  // Flood fill from the pad; anything unreached becomes rock.
  const seen = new Uint8Array(w * h);
  const q = [ly * w + lx];
  seen[q[0]!] = 1;
  while (q.length) {
    const k = q.pop()!;
    const x = k % w;
    const y = (k / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const nk = ny * w + nx;
      if (!seen[nk] && !g[nk]) {
        seen[nk] = 1;
        q.push(nk);
      }
    }
  }
  const tiles: string[] = [];
  for (let k = 0; k < w * h; k++) tiles.push(seen[k] ? '.' : '#');
  // If the cave came out tiny, carve a long corridor up the middle so there's somewhere to go.
  const floor = tiles.filter((t) => t === '.').length;
  if (floor < w * h * 0.3) {
    let x = lx;
    for (let y = ly; y > 3; y--) {
      x = Math.max(3, Math.min(w - 4, x + randInt(r, -1, 1)));
      for (let i = -2; i <= 2; i++) tiles[y * w + x + i] = '.';
    }
  }
  const blob = (ch: string, share: number, avoidPad: number): void => {
    const target = Math.floor(tiles.filter((t) => t === '.').length * share);
    let placed = 0;
    let guard = 0;
    while (placed < target && guard++ < 400) {
      const cx = randInt(r, 2, w - 3);
      const cy = randInt(r, 2, h - 3);
      if (Math.hypot(cx - lx, cy - ly) < avoidPad) continue;
      const rad = randInt(r, 1, 3);
      for (let j = -rad; j <= rad; j++) {
        for (let i = -rad; i <= rad; i++) {
          if (i * i + j * j > rad * rad + r() * 2) continue;
          const k = (cy + j) * w + cx + i;
          if (tiles[k] === '.') {
            tiles[k] = ch;
            placed++;
          }
        }
      }
    }
  };
  if (b.hazardShare > 0) blob(',', b.hazardShare, 6);
  if (b.liquid !== 'none') blob('~', b.liquidShare, 6);
  return { tiles: tiles.join(''), lander: { x: lx + 0.5, y: ly + 0.5 } };
}

function floorCells(tiles: string, ok: (ch: string) => boolean): number[] {
  const out: number[] = [];
  for (let k = 0; k < tiles.length; k++) if (ok(tiles[k]!)) out.push(k);
  return out;
}

export interface PopulateOpts {
  sector: number;
  pods: number;
  ruin: boolean;
  objective: string | null;
  size: number;
}

/** Scatters deposits, caches, terminals, pods, the objective and fauna. */
export function populate(a: AwayState, seed: number, o: PopulateOpts): void {
  const r = seeded(seed ^ 0x5f3759df);
  const b = BIOME.get(a.biome)!;
  const w = a.w;
  const cells = floorCells(a.tiles, (ch) => ch === '.' || ch === ',');
  const used = new Set<number>();
  const far = (min: number): number => {
    for (let tries = 0; tries < 200; tries++) {
      const k = cells[Math.floor(r() * cells.length)]!;
      const x = (k % w) + 0.5;
      const y = Math.floor(k / w) + 0.5;
      if (used.has(k) || Math.hypot(x - a.lander.x, y - a.lander.y) < min) continue;
      used.add(k);
      return k;
    }
    const k = cells[Math.floor(r() * cells.length)]!;
    used.add(k);
    return k;
  };
  const add = (k: number, e: Omit<AwayEnt, 'id' | 'x' | 'y'>): void => {
    a.ents.push({ id: a.nextEnt++, x: (k % w) + 0.5, y: Math.floor(k / w) + 0.5, ...e });
  };
  const mats = Object.entries(b.mats) as [MatId, number][];
  const deposits = 8 + o.size * 3;
  for (let i = 0; i < deposits; i++) {
    const [mat] = pickWeighted(r, mats, (m) => m[1]);
    add(far(3), { k: 'node', mat, amt: randInt(r, 2, 4) + (mat === 'relic' ? -1 : 0) });
  }
  const caches = randInt(r, 1, 2);
  for (let i = 0; i < caches; i++) add(far(10), { k: 'cache' });
  if (o.ruin) add(far(12), { k: 'terminal' });
  for (let i = 0; i < o.pods; i++) add(far(14), { k: 'pod' });
  if (o.objective) add(far(22), { k: 'objective' });
  const fauna = 5 + o.size * 2 + o.sector * 2;
  for (let i = 0; i < fauna; i++) spawnFauna(a, r, far(9), o.sector, false);
  if (o.sector >= 1 && r() < 0.5) spawnFauna(a, r, far(18), o.sector, true);
}

export function faunaHp(base: number, sector: number, alpha: boolean): number {
  return Math.round(base * (1 + sector * 0.35) * (alpha ? 2.5 : 1));
}

function spawnFauna(a: AwayState, r: Rng, k: number, sector: number, alpha: boolean): void {
  const b = BIOME.get(a.biome)!;
  const id = b.fauna[Math.floor(r() * b.fauna.length)]!;
  const hp = faunaHp(FAUNA_DEF.get(id)!.hp, sector, alpha);
  a.ents.push({ id: a.nextEnt++, k: 'fauna', x: (k % a.w) + 0.5, y: Math.floor(k / a.w) + 0.5, fauna: id, cd: 0.5 + r(), state: 'idle', alpha, hp, maxHp: hp });
}
