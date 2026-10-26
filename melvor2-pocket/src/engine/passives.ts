// Background systems that schedule their own events on the simulation clock.
import type { Game } from './game';
import { nextRanchingEvent, processRanching } from './skills/ranching';
import { nextMillEvent, processMill } from './skills/farming';

export interface PassiveHandler {
  /** Absolute tick of the next event, or null if nothing is pending. */
  nextEvent(game: Game): number | null;
  /** Handle every event due at or before the current tick. */
  process(game: Game): void;
}

export const PASSIVES: PassiveHandler[] = [
  { nextEvent: nextRanchingEvent, process: processRanching },
  { nextEvent: nextMillEvent, process: processMill },
];
