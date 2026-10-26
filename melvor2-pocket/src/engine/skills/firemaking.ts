import type { FiremakingRecipe } from '../content';
import type { Game } from '../game';
import type { SkillHandler } from './types';
import { questEvent, goalMatches } from '../quests';
import { NS } from '../content';
import {
  LACK_OF_RESOURCES, bonusReader, missingIngredients, recipeContext, recipeGetter, recipeList, rollItemChances, spendIngredients,
} from './common';

const SKILL = 'Firemaking';
const recipe = recipeGetter<FiremakingRecipe>('FiremakingRecipe');
const bonus = (game: Game, r: FiremakingRecipe) => bonusReader(game, 'FiremakingAction', recipeContext(SKILL, r));
const interval = (game: Game, r: FiremakingRecipe) => {
  const b = bonus(game, r);
  return Math.max(250, Math.floor((r.BaseInterval + b('FlatInterval')) * (1 + b('PercentInterval'))));
};

export const firemaking: SkillHandler = {
  skill: SKILL,
  recipes: () => recipeList(SKILL),
  recipe,
  interval: (game, id) => interval(game, recipe(id)),
  canStart: (game, id) => missingIngredients(game, recipe(id).Ingredients),
  fire(game, id) {
    const r = recipe(id);
    if (missingIngredients(game, r.Ingredients)) {
      game.stop(LACK_OF_RESOURCES);
      return null;
    }
    const b = bonus(game, r);
    if (!game.rng.chance(b('PreservationChance'))) spendIngredients(game, r.Ingredients);
    rollItemChances(game, r.Products, b('DoublingChance'));
    if (r.CurrencyReward) game.addCurrency(r.CurrencyReward.Currency, r.CurrencyReward.Quantity);
    game.addXp(SKILL, r.BaseExperience);
    questEvent(game, 'FiremakingBurnRecipe', (d) => (goalMatches(d, 'Recipe', NS + r.Id) ? 1 : 0));
    if (missingIngredients(game, r.Ingredients)) {
      game.stop(LACK_OF_RESOURCES);
      return null;
    }
    return interval(game, r);
  },
};
