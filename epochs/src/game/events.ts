/**
 * What the simulation tells the outside world. The engine never touches the
 * DOM or the speakers; it emits these, and the scene, the sound and the
 * toasts listen. Tests and the bot simply do not subscribe.
 */
import type { LineId } from '../data/types';

export type GameEvent =
  | { type: 'build'; line: LineId; plot: number; price: number }
  | { type: 'modernize'; line: LineId; plot: number }
  | { type: 'demolish'; line: LineId; plot: number }
  | { type: 'research'; id: string }
  | { type: 'wonderStage'; id: string; stage: number }
  | { type: 'wonderDone'; id: string }
  | { type: 'era'; era: number }
  | { type: 'festival' }
  | { type: 'chronicle'; id: string }
  | { type: 'answer'; id: string; choice: number }
  | { type: 'born'; n: number }
  | { type: 'starving' }
  | { type: 'shipReady' }
  | { type: 'launch'; heritage: number; world: string }
  | { type: 'toast'; text: string };

type Listener = (e: GameEvent) => void;
const listeners = new Set<Listener>();

export function on(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emit(e: GameEvent): void {
  for (const l of listeners) l(e);
}
