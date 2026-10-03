/**
 * What the simulation tells the outside world. The engine never touches the
 * DOM or the speakers; it emits these, and the renderer, the sound and the
 * toasts listen. Tests and the bot simply do not subscribe.
 */
export type GameEvent =
  | { type: 'hit'; damage: number; crit: boolean; auto: boolean }
  | { type: 'break'; ore: string; qty: number; seam: boolean; shatter: boolean; auto: boolean }
  | { type: 'gem'; id: string }
  | { type: 'essence'; id: string }
  | { type: 'depth'; depth: number; biomeChanged: boolean }
  | { type: 'level'; level: number }
  | { type: 'sell'; coins: number }
  | { type: 'buy' }
  | { type: 'craft'; name: string }
  | { type: 'smelt'; bar: string }
  | { type: 'skill'; id: string }
  | { type: 'mission'; title: string }
  | { type: 'claim'; title: string }
  | { type: 'descent'; echoes: number }
  | { type: 'toast'; text: string }
  | { type: 'scene'; title: string; paragraphs: readonly string[] };

type Listener = (e: GameEvent) => void;
const listeners = new Set<Listener>();

export function on(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emit(e: GameEvent): void {
  for (const l of listeners) l(e);
}
