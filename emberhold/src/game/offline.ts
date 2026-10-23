/**
 * Time away. Replays it through `advance`, capped, and reports what changed.
 */
import { SKILLS, type SkillId } from '../data/types';
import type { GameState } from '../state/types';
import { advance } from './engine';

export const OFFLINE_CAP_HOURS = 24;

export interface OfflineReport {
  seconds: number;
  capped: boolean;
  xp: Partial<Record<SkillId, number>>;
  items: Record<string, number>;
  gp: number;
  kills: number;
  died: boolean;
}

export function applyOffline(s: GameState, seconds: number): OfflineReport | null {
  if (seconds < 5 || s.dead) return null;
  const capped = seconds > OFFLINE_CAP_HOURS * 3600;
  const secs = Math.min(seconds, OFFLINE_CAP_HOURS * 3600);
  const xp0 = { ...s.xp };
  const bank0 = { ...s.bank };
  const gp0 = s.gp;
  const kills0 = s.counters['kills'] ?? 0;
  const deaths0 = s.counters['deaths'] ?? 0;
  // Keep the clock honest even if the device clock jumped.
  advance(s, secs * 1000);
  const items: Record<string, number> = {};
  for (const k of new Set([...Object.keys(bank0), ...Object.keys(s.bank)])) {
    const d = (s.bank[k] ?? 0) - (bank0[k] ?? 0);
    if (d) items[k] = d;
  }
  const xp: Partial<Record<SkillId, number>> = {};
  for (const sk of SKILLS) {
    const d = s.xp[sk] - xp0[sk];
    if (d > 0) xp[sk] = d;
  }
  return { seconds: secs, capped, xp, items, gp: Math.floor(s.gp - gp0), kills: (s.counters['kills'] ?? 0) - kills0, died: (s.counters['deaths'] ?? 0) > deaths0 || s.dead };
}
