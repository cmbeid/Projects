import type { GameState, LogEntry } from '../state/types';

const MAX_LOG = 160;

export function addLog(s: GameState, text: string, kind: LogEntry['kind']): void {
  s.log.push({ day: s.day, text, kind });
  if (s.log.length > MAX_LOG) s.log.splice(0, s.log.length - MAX_LOG);
}
