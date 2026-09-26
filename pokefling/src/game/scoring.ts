import type { LevelDef } from '../data/levels/types';
import { MATERIALS } from '../data/materials';
import { TARGETS } from '../data/roster';

/** Paid per Pokémon still waiting by the sling when the last target falls. */
export const UNUSED_LAUNCHER_BONUS = 10_000;
/** For knocking into a level's hidden item. Not counted towards stars. */
export const PICKUP_POINTS = 3000;

export function targetPoints(level: LevelDef): number {
  return level.targets.reduce((sum, t) => sum + TARGETS[t.kind].points, 0);
}

export function blockPoints(level: LevelDef): number {
  return level.blocks.reduce((sum, b) => sum + MATERIALS[b.material].points, 0);
}

/** The best score a level allows: everything broken, in a single shot. */
export function maxScore(level: LevelDef): number {
  return targetPoints(level) + blockPoints(level) + UNUSED_LAUNCHER_BONUS * (level.launchers.length - 1);
}

function ceilTo(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

/**
 * Scores needed for two and three stars. One star is simply winning.
 *
 * Three stars means clearing it in `par` shots and breaking half the
 * structure on the way; two stars allows a shot more and a quarter of the
 * mess. Either way it takes more than knocking out the targets alone.
 */
export function starThresholds(level: LevelDef): readonly [two: number, three: number] {
  const targets = targetPoints(level);
  const blocks = blockPoints(level);
  const spare = level.launchers.length - level.par;
  const two = targets + ceilTo(blocks * 0.25 + 100, 100) + UNUSED_LAUNCHER_BONUS * Math.max(0, spare - 1);
  const three = targets + ceilTo(blocks * 0.5, 100) + UNUSED_LAUNCHER_BONUS * spare;
  return [two, Math.max(three, two + 100)];
}

export function starsFor(level: LevelDef, score: number, won: boolean): 0 | 1 | 2 | 3 {
  if (!won) return 0;
  const [two, three] = starThresholds(level);
  if (score >= three) return 3;
  if (score >= two) return 2;
  return 1;
}
