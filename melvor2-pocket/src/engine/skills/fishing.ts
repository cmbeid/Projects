import type { FishingRecipe } from '../content';
import type { Game } from '../game';
import type { SkillHandler } from './types';
import { bonusReader, recipeGetter, recipeList } from './common';
import { goalMatches, questEvent } from '../quests';
import { NS } from '../content';

const SKILL = 'Fishing';
const recipe = recipeGetter<FishingRecipe>('FishingRecipe');

const bonus = (game: Game, r: FishingRecipe) => bonusReader(game, 'FishingAction', { entity: SKILL, recipe: NS + r.Id, location: r.Location });
const fishChance = (game: Game, r: FishingRecipe) => {
  const b = bonus(game, r);
  return Math.min(1, Math.max(0, (r.FishChance + b('FlatFishChance')) * (1 + b('IncreasedFishChance'))));
};
function rollInterval(game: Game, r: FishingRecipe): number {
  const b = bonus(game, r);
  const lo = Math.floor((r.BaseMinInterval + b('FlatMinInterval')) * (1 + b('PercentMinInterval')));
  const hi = Math.max(lo, Math.floor((r.BaseMaxInterval + b('FlatMaxInterval')) * (1 + b('PercentMaxInterval'))));
  return Math.max(250, game.rng.range(lo, hi));
}

export const fishing: SkillHandler = {
  skill: SKILL,
  recipes: () => recipeList(SKILL),
  recipe,
  interval: (game, id) => rollInterval(game, recipe(id)),
  fire(game, id) {
    const r = recipe(id);
    const b = bonus(game, r);
    const doubling = b('DoublingChance');
    if (game.rng.chance(fishChance(game, r)) && r.RandomProducts.length) {
      const p = game.rng.weighted(r.RandomProducts);
      const q = game.rng.intInclusive(p.MinQuantity, p.MaxQuantity);
      game.addItem(p.Item, game.rng.chance(doubling) ? q * 2 : q);
    } else {
      game.addItem(r.JunkItem, game.rng.chance(doubling) ? 2 : 1);
    }
    // Special items are checked rarest first; the first success wins.
    for (const s of [...r.SpecialProducts].sort((a, b) => a.Chance - b.Chance)) {
      if (game.rng.next() <= s.Chance * (1 + b('IncreasedSpecialProductChance'))) {
        game.addItem(s.Item, s.Quantity);
        break;
      }
    }
    game.addXp(SKILL, r.BaseExperience);
    questEvent(game, 'FishingFishRecipe', (d) => (goalMatches(d, 'Recipe', NS + r.Id) ? 1 : 0));
    return rollInterval(game, r);
  },
};
