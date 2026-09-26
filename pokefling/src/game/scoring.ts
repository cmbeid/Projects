import type { LevelDef } from '../data/levels';
import { MATERIALS } from '../data/materials';
import { TARGETS } from '../data/roster';

/** Paid per Pokémon still waiting by the sling when the last target falls. */
export const UNUSED_LAUNCHER_BONUS = 10_000;

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

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/**
 * Scores needed for two and three stars. One star is simply winning.
 *
 * Three stars means clearing it in `par` shots and breaking a good share of
 * the structure on the way; two stars allows a shot more and less mess.
 */
export function starThresholds(level: LevelDef): readonly [two: number, three: number] {
  const targets = targetPoints(level);
  const blocks = blockPoints(level);
  const spare = level.launchers.length - level.par;
  const three = targets + blocks * 0.4 + UNUSED_LAUNCHER_BONUS * spare;
  const two = targets + blocks * 0.2 + UNUSED_LAUNCHER_BONUS * Math.max(0, spare - 1);
  return [roundTo(two, 1000), roundTo(three, 1000)];
}

export function starsFor(level: LevelDef, score: number, won: boolean): 0 | 1 | 2 | 3 {
  if (!won) return 0;
  const [two, three] = starThresholds(level);
  if (score >= three) return 3;
  if (score >= two) return 2;
  return 1;
}
