import type { GameState } from '../state/types';
import { addLog } from './log';

/**
 * Docking writes a snapshot of the whole campaign. "Signal lost" — a
 * destroyed hull or a crew all down — rolls back to it. The snapshot is the
 * state without its own checkpoint, so they never nest.
 */
export function writeCheckpoint(s: GameState): void {
  const copy = { ...s, checkpoint: null };
  s.checkpoint = JSON.stringify(copy);
}

export function signalLost(s: GameState): void {
  if (!s.checkpoint) return;
  const cp = JSON.parse(s.checkpoint) as GameState;
  const days = Math.max(0, s.day - cp.day);
  const keep = { reloads: s.stats.reloads + 1, settings: s.settings, checkpoint: s.checkpoint, savedAt: s.savedAt };
  for (const k of Object.keys(s)) delete (s as unknown as Record<string, unknown>)[k];
  Object.assign(s, cp);
  s.checkpoint = keep.checkpoint;
  s.settings = keep.settings;
  s.savedAt = keep.savedAt;
  s.stats.reloads = keep.reloads;
  // Reroll the dice: a reload that replayed the same rolls would lose the same fight forever.
  s.rng = (s.rng ^ Math.imul(keep.reloads, 0x9e3779b1)) | 0;
  s.screen = 'lost';
  s.lost = { days };
  s.event = null;
  s.combat = null;
  s.away = null;
  addLog(s, `Signal lost. The Wren\'s log recovers from the last dock, ${days} day${days === 1 ? '' : 's'} back.`, 'warn');
}
