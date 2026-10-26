import type { ArtisanRecipe } from '../content';
import type { Game } from '../game';
import type { SkillHandler } from './types';
import { questEvent, goalMatches } from '../quests';
import { NS } from '../content';
import {
  LACK_OF_RESOURCES, bonusReader, missingIngredients, recipeContext, recipeGetter, recipeList, scaledIngredients, spendIngredients,
} from './common';

const recipe = recipeGetter<ArtisanRecipe>('ArtisanRecipe');

const bonus = (game: Game, skill: string, r: ArtisanRecipe) =>
  bonusReader(game, 'ArtisanAction', { ...recipeContext(skill, r), subcategory: r.Subcategory ?? undefined });

export function maxSteps(r: ArtisanRecipe, game?: Game, skill?: string): number {
  const flat = game && skill ? bonus(game, skill, r)('FlatSteps') : 0;
  return Math.max(1, r.Steps + flat);
}

/** Steps left before the current item is finished. Each recipe keeps its own progress. */
export function stepsLeft(game: Game, id: string): number {
  return game.state.recipeSteps[id] ?? maxSteps(recipe(id));
}

export function artisanCosts(game: Game, skill: string, r: ArtisanRecipe) {
  return scaledIngredients(r.Ingredients, bonus(game, skill, r)('PercentIngredientCost'));
}

/** Artisan intervals apply percent first, then flat: floor(base × (1 + pct) + flat). */
function interval(game: Game, skill: string, r: ArtisanRecipe): number {
  const b = bonus(game, skill, r);
  return Math.max(250, Math.floor(r.BaseInterval * (1 + b('PercentInterval')) + b('FlatInterval')));
}

/** Shared handler for the step-based crafting skills: Smithing, Fletching, Crafting, Runecrafting, Beastcrafting. */
export function artisan(skill: string): SkillHandler {
  return {
    skill,
    recipes: () => recipeList(skill),
    recipe,
    interval: (game, id) => interval(game, skill, recipe(id)),
    canStart: (game, id) => missingIngredients(game, artisanCosts(game, skill, recipe(id))),
    fire(game, id) {
      const r = recipe(id);
      const b = bonus(game, skill, r);
      const costs = artisanCosts(game, skill, r);
      // Ingredients must be on hand for every step but are only spent when the item is finished.
      if (missingIngredients(game, costs)) {
        game.stop(LACK_OF_RESOURCES);
        return null;
      }
      const max = maxSteps(r, game, skill);
      let left = Math.min(stepsLeft(game, id), max);
      left -= left > 1 && game.rng.chance(b('SkipStepChance')) ? 2 : 1;
      if (left > 0) {
        game.state.recipeSteps[id] = left;
        return interval(game, skill, r);
      }
      game.state.recipeSteps[id] = max;
      if (!game.rng.chance(b('PreservationChance'))) spendIngredients(game, costs);
      const doubling = b('DoublingChance');
      const flatQ = b('FlatProductQuantity');
      const pctQ = b('PercentProductQuantity');
      let made = 0;
      for (const p of [...r.Products].sort((a, c) => a.Chance - c.Chance)) {
        if (game.rng.next() > p.Chance) continue;
        let q = Math.max(1, Math.floor((p.Quantity + flatQ) * (1 + pctQ)));
        if (game.rng.chance(doubling)) q *= 2;
        if (game.addItem(p.Item, q)) made += q;
      }
      game.addXp(skill, r.BaseExperience);
      questEvent(game, 'ArtisanCreateRecipe', (d) =>
        d.Component?.Entity === NS + skill && goalMatches(d, 'Recipe', NS + r.Id) && goalMatches(d, 'Category', r.Category) && goalMatches(d, 'Subcategory', r.Subcategory ?? undefined)
          ? (d.UseOutputQuantity ? made : 1)
          : 0,
      );
      if (missingIngredients(game, costs)) {
        game.stop(LACK_OF_RESOURCES);
        return null;
      }
      return interval(game, skill, r);
    },
  };
}

export const smithing = artisan('Smithing');
export const fletching = artisan('Fletching');
export const crafting = artisan('Crafting');
export const runecrafting = artisan('Runecrafting');
export const beastcrafting = artisan('Beastcrafting');
