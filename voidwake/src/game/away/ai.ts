import type { AwayState } from '../../state/types';
import { tileAt, walkable } from './gen';
import { type AwayInput, carried, nearLander, nearestInteractable } from './sim';

/**
 * The bot's thumb. Walks a breadth-first path to the nearest thing worth
 * having, gathers until the pack is full or the air is low, then walks home.
 * Shoots whatever comes close by pressing the same button a player would.
 */
export interface AwayBotMemo {
  path: number[];
  goal: number;
  repath: number;
}

export function newMemo(): AwayBotMemo {
  return { path: [], goal: -1, repath: 0 };
}

function bfs(a: AwayState, from: number, goals: Set<number>): number[] {
  const prev = new Int32Array(a.w * a.h).fill(-2);
  prev[from] = -1;
  let q = [from];
  // Burning liquid goes in a second queue, walked only once dry ground runs out.
  let later: number[] = [];
  const hot = a.biome !== 'ocean' && a.biome !== 'ice' && a.biome !== 'jungle';
  while (q.length) {
    for (let head = 0; head < q.length; head++) {
      const k = q[head]!;
      if (goals.has(k)) {
        const path: number[] = [];
        let c = k;
        while (c !== -1) {
          path.push(c);
          c = prev[c]!;
        }
        return path.reverse();
      }
      const x = k % a.w;
      const y = (k / a.w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        const ch = tileAt(a, nx, ny);
        if (!walkable(ch)) continue;
        const nk = ny * a.w + nx;
        if (prev[nk] !== -2) continue;
        prev[nk] = k;
        if (ch === '~' && hot) later.push(nk);
        else q.push(nk);
      }
    }
    q = later;
    later = [];
  }
  return [];
}

export function awayBotInput(a: AwayState, memo: AwayBotMemo): AwayInput & { leave: boolean } {
  const out = { mx: 0, my: 0, act: false, skill: false, leave: false };
  const home = a.o2 < a.o2Max * 0.42 || a.hp < a.hpMax * 0.4 || carried(a) >= a.carryMax - 1;
  if (home && nearLander(a)) {
    out.leave = true;
    return out;
  }
  // Fight back when something is close.
  const threat = a.ents.find((e) => e.k === 'fauna' && (e.hp ?? 0) > 0 && Math.hypot(e.x - a.x, e.y - a.y) < Math.min(4, a.stats.range));
  const near = nearestInteractable(a);
  if (near && !home && !(near.k === 'node' && carried(a) >= a.carryMax - 1)) out.act = true;
  else if (threat) out.act = true;
  if (threat && a.skillCd <= 0 && (a.stats.cls === 'soldier' || a.stats.cls === 'engineer')) out.skill = true;
  if (a.stats.cls === 'medic' && a.hp < a.hpMax * 0.6 && a.skillCd <= 0) out.skill = true;
  if (a.stats.cls === 'scientist' && a.skillCd <= 0 && a.t < 1) out.skill = true;

  const me = Math.floor(a.y) * a.w + Math.floor(a.x);
  memo.repath -= 1;
  if (memo.repath <= 0 || !memo.path.length) {
    memo.repath = 15;
    const goals = new Set<number>();
    if (home) goals.add(Math.floor(a.lander.y) * a.w + Math.floor(a.lander.x));
    else {
      // Sleepers, the objective and logs first; then whatever is nearest.
      for (const e of a.ents) if (e.k === 'pod' || e.k === 'objective' || e.k === 'terminal' || e.k === 'cache') goals.add(Math.floor(e.y) * a.w + Math.floor(e.x));
      if (!goals.size) {
        for (const e of a.ents) {
          if (e.k !== 'node' || (e.amt ?? 0) <= 0) continue;
          goals.add(Math.floor(e.y) * a.w + Math.floor(e.x));
        }
      }
      if (!goals.size) goals.add(Math.floor(a.lander.y) * a.w + Math.floor(a.lander.x));
    }
    memo.path = bfs(a, me, goals);
  }
  while (memo.path.length && memo.path[0] === me) memo.path.shift();
  const next = memo.path[0];
  if (next === undefined) return out;
  const tx = (next % a.w) + 0.5;
  const ty = Math.floor(next / a.w) + 0.5;
  const dx = tx - a.x;
  const dy = ty - a.y;
  const d = Math.hypot(dx, dy) || 1;
  out.mx = dx / d;
  out.my = dy / d;
  return out;
}
