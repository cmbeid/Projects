import type { CookingRecipe } from '../content';
import type { Game } from '../game';
import type { SkillHandler } from './types';
import { goalMatches, questEvent } from '../quests';
import { NS } from '../content';
import { LACK_OF_RESOURCES, bonusReader, missingIngredients, recipeContext, recipeGetter, recipeList, spendIngredients } from './common';

const bonus = (game: Game, r: CookingRecipe) => bonusReader(game, 'CookingAction', recipeContext('Cooking', r));

const SKILL = 'Cooking';
const recipe = recipeGetter<CookingRecipe>('CookingRecipe');

/** Chance a cook succeeds: (69 + Cooking level) / (69 + recipe difficulty), clamped to 0..1. */
export function successChance(game: Game, r: CookingRecipe): number {
  const b = bonus(game, r);
  const proficiency = Math.max(0, game.level(SKILL) + b('FlatProficiency'));
  const difficulty = Math.max(0, r.Difficulty + b('FlatDifficulty'));
  return Math.min(1, Math.max(0, (69 + proficiency) / (69 + difficulty)));
}

export const cooking: SkillHandler = {
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
    const success = game.rng.chance(successChance(game, r));
    // Ingredients are used up whether or not the cook succeeds, unless preserved.
    const preserved = game.rng.chance(b('PreservationChance')) || (!success && game.rng.chance(b('PreservationChanceOnFail')));
    if (!preserved) spendIngredients(game, r.Ingredients);
    else for (const ing of r.Ingredients.Items) questEvent(game, 'PreserveCookingItem', (d) => (goalMatches(d, 'Item', ing.Item) ? ing.Quantity : 0));
    if (success) {
      game.stat('CookingRecipesCooked');
      const roll = game.rng.next();
      let cumulative = 0;
      for (const p of [...r.Products].sort((a, b) => a.Chance - b.Chance)) {
        cumulative += p.Chance;
        if (roll > cumulative) continue;
        game.addItem(p.Item, game.rng.chance(b('DoublingChance')) ? p.Quantity * 2 : p.Quantity);
        break;
      }
      game.addXp(SKILL, r.BaseExperience);
      game.toolbeltTrigger('CookRecipe', { entity: SKILL, category: r.Category, recipe: NS + r.Id });
      questEvent(game, 'CookRecipe', (d) =>
        goalMatches(d, 'Recipe', NS + r.Id) && goalMatches(d, 'Category', r.Category) && goalMatches(d, 'Subcategory', r.Subcategory ?? undefined) ? 1 : 0,
      );
    } else {
      game.failed(SKILL, r.DisplayName);
    }
    if (missingIngredients(game, r.Ingredients)) {
      game.stop(LACK_OF_RESOURCES);
      return null;
    }
    return interval(game, r);
  },
};

function interval(game: Game, r: CookingRecipe): number {
  const b = bonus(game, r);
  return Math.max(250, Math.floor(r.BaseInterval * (1 + b('PercentInterval')) + b('FlatInterval')));
}
