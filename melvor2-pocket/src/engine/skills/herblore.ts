import type { HerbloreRecipe } from '../content';
import type { SkillHandler } from './types';
import { recipeGetter, recipeList } from './common';

const SKILL = 'Herblore';
const recipe = recipeGetter<HerbloreRecipe>('HerbloreRecipe');

/**
 * Every Herblore recipe is demo-locked in this build, so recipes are listed but can never start.
 * The four brewing stages (prepare, heat, stir, bottle) can be added if a later demo unlocks it.
 */
export const herblore: SkillHandler = {
  skill: SKILL,
  recipes: () => recipeList(SKILL),
  recipe,
  interval: (_game, id) => {
    const r = recipe(id);
    return r.BasePreparingInterval + r.BaseHeatingInterval + r.BaseStirringInterval + r.BaseBottlingInterval;
  },
  canStart: () => 'Not in demo',
  fire: () => null,
};
