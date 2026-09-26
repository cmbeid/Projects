/**
 * All sixty levels, in play order. Each area's six live in their own file
 * under this folder; `tests/levels.test.ts` checks every one is well-formed
 * and stands up on its own before the first shot, and `npm run playtest`
 * checks each can be won.
 */
import { AREAS } from '../areas';
import type { LevelDef } from './types';
import { VIRIDIAN_FOREST } from './viridian-forest';
import { MT_MOON } from './mt-moon';
import { POKEMON_TOWER } from './pokemon-tower';
import { ROCKET_HIDEOUT } from './rocket-hideout';
import { SPROUT_TOWER } from './sprout-tower';
import { UNION_CAVE } from './union-cave';
import { BURNED_TOWER } from './burned-tower';
import { LAKE_OF_RAGE } from './lake-of-rage';
import { TEAM_ROCKET_HQ } from './team-rocket-hq';
import { INDIGO_PLATEAU } from './indigo-plateau';

export type { LevelDef } from './types';
export { AREAS };

export const LEVELS: readonly LevelDef[] = [
  ...VIRIDIAN_FOREST,
  ...MT_MOON,
  ...POKEMON_TOWER,
  ...ROCKET_HIDEOUT,
  ...SPROUT_TOWER,
  ...UNION_CAVE,
  ...BURNED_TOWER,
  ...LAKE_OF_RAGE,
  ...TEAM_ROCKET_HQ,
  ...INDIGO_PLATEAU,
];

export const LEVEL_ORDER: readonly string[] = LEVELS.map((l) => l.id);

export function levelById(id: string): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function levelsInArea(area: number): LevelDef[] {
  return LEVELS.filter((l) => l.area === area);
}

/** The level after this one, across area boundaries. */
export function nextLevel(level: LevelDef): LevelDef | undefined {
  return LEVELS[LEVELS.indexOf(level) + 1];
}
