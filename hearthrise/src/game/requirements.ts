import { STORY } from '../data/missions';
import type { Requirement } from '../data/types';
import type { GameState } from '../state/types';

/** Position of the active mission in the story; `STORY.length` once it is over. */
export function storyIndex(s: GameState): number {
  if (!s.story.id) return STORY.length;
  const i = STORY.findIndex((m) => m.id === s.story.id);
  return i < 0 ? STORY.length : i;
}

/**
 * Recipes and buildings are learned for good: the furthest ward ever opened
 * counts, not this run's, a mission counts once it is behind you, and a
 * fixture once it is built.
 */
export function meetsRequirement(s: GameState, req: Requirement): boolean {
  if ('ward' in req) return s.furthestEver >= req.ward;
  if ('fixture' in req) return s.fixtures.includes(req.fixture);
  const i = STORY.findIndex((m) => m.id === req.mission);
  return i >= 0 && storyIndex(s) > i;
}
