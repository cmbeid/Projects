import type { MiningRecipe } from '../content';
import type { Game } from '../game';
import type { SkillHandler } from './types';
import { questEvent, goalMatches } from '../quests';
import { NS } from '../content';
import { bonusReader, recipeContext, recipeGetter, recipeList, rollItemChances } from './common';

const SKILL = 'Mining';
const recipe = recipeGetter<MiningRecipe>('MiningRecipe');
const BREAK_THRESHOLD = 0.9999;

const bonus = (game: Game, r: MiningRecipe) => bonusReader(game, 'MiningAction', recipeContext(SKILL, r));

export function breakChance(r: MiningRecipe, game?: Game): number {
  const pct = game ? bonus(game, r)('PercentIncreaseRockBreakChance') : 0;
  return Math.min(1, Math.max(0, r.BaseProductChance * (1 + pct)));
}

function interval(game: Game, r: MiningRecipe): number {
  const b = bonus(game, r);
  return Math.max(250, Math.floor((r.BaseInterval + b('FlatInterval')) * (1 + b('PercentInterval'))));
}

export const mining: SkillHandler = {
  skill: SKILL,
  recipes: () => recipeList(SKILL),
  recipe,
  interval: (game, id) => interval(game, recipe(id)),
  fire(game, id) {
    const r = recipe(id);
    const b = bonus(game, r);
    const doubling = b('DoublingChance');
    const p = breakChance(r, game);
    rollItemChances(game, r.RandomProductsPerHit, doubling, b('FlatOnHitItemChance'), b('PercentOnHitItemChance'));

    // Each hit either breaks the rock outright (chance p) or adds p to its prospecting progress.
    const minimum = b('FlatMinimumProspecting');
    let broke = game.rng.chance(p);
    if (!broke) {
      const progress = (game.state.rockProgress[id] ?? minimum) + p;
      broke = progress >= BREAK_THRESHOLD;
      game.state.rockProgress[id] = broke ? minimum : progress;
    } else {
      game.state.rockProgress[id] = minimum;
    }
    if (broke) {
      let q = r.Product.Quantity + Math.floor(b('FlatProductQuantity'));
      if (game.rng.chance(b('AdditionalProductQuantityChance'))) q++;
      if (game.rng.chance(doubling)) q *= 2;
      let xpMult = 1;
      if (game.rng.chance(b('ShatterChance'))) {
        q *= 3;
        xpMult = 2;
      }
      game.addItem(r.Product.Item, q);
      game.addXp(SKILL, r.BaseExperience * xpMult);
      questEvent(game, 'MiningMineRock', (d) => (goalMatches(d, 'Recipe', NS + r.Id) && goalMatches(d, 'Category', r.Category) ? 1 : 0));
    }
    return interval(game, r);
  },
};
