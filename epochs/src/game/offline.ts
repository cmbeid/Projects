import { OFFLINE_HOURS } from '../data/progression';
import { RES_IDS } from '../data/resources';
import type { ResId } from '../data/types';
import type { GameState } from '../state/types';
import { derive } from './derive';
import { tick } from './engine';

/**
 * Time away. The city carries on while nobody watches — fields, mines,
 * births, wonders under construction — but the Chronicle waits: nothing
 * happens to the city that you did not get to decide. Simulated in coarse
 * steps, which is plenty for rates that hold still while you are gone.
 */

export interface OfflineReport {
  seconds: number;
  counted: number;
  gained: Partial<Record<ResId, number>>;
  born: number;
}

const STEP = 5;

export function offlineCap(s: GameState): number {
  return (OFFLINE_HOURS + derive(s).bonuses.offline) * 3600;
}

export function applyOffline(s: GameState, seconds: number): OfflineReport | null {
  if (!(seconds > 30)) return null;
  const counted = Math.min(seconds, offlineCap(s));
  const before = { ...s.res };
  const popBefore = Math.floor(s.pop);
  let left = counted;
  while (left > 0) {
    const dt = Math.min(STEP, left);
    tick(s, dt, { events: false });
    left -= dt;
  }
  const gained: Partial<Record<ResId, number>> = {};
  for (const r of RES_IDS) {
    const diff = s.res[r] - before[r];
    if (Math.abs(diff) >= 1) gained[r] = diff;
  }
  return { seconds, counted, gained, born: Math.floor(s.pop) - popBefore };
}
