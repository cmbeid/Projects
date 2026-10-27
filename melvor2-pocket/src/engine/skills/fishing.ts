import type { FishingRecipe } from '../content';
import type { Game } from '../game';
import type { SkillHandler } from './types';
import { bonusReader, recipeGetter, recipeList } from './common';
import { mod } from '../bonuses';
import { goalMatches, questEvent } from '../quests';
import { NS, item } from '../content';

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
    // The selected bait is used up one per catch (its bonuses were applied while it was in the bank).
    const bait = game.state.fishingBait;
    if (bait && game.count(bait) > 0 && !game.rng.chance(mod(game, 'FishingBait', 'PreservationChance', { entity: SKILL }))) game.removeItem(bait, 1);
    // A miss gives junk, unless a junk reroll bonus turns it into a fish after all.
    if ((game.rng.chance(fishChance(game, r)) || game.rng.chance(b('JunkRerollChance'))) && r.RandomProducts.length) {
      const p = game.rng.weighted(r.RandomProducts);
      const q = game.rng.intInclusive(p.MinQuantity, p.MaxQuantity);
      game.stat('FishingFishCaught');
      game.addItem(p.Item, game.rng.chance(doubling) ? q * 2 : q);
    } else {
      const q = game.rng.chance(doubling) ? 2 : 1;
      game.stat('FishingJunkCaught');
      const toGold = b('JunkToGP');
      const price = item(r.JunkItem).SellsFor;
      // With a JunkToGP bonus the junk is sold on the spot for that multiple of its price.
      if (toGold > 0 && price) game.addCurrency(price.Currency, Math.floor(price.Quantity * q * toGold));
      else game.addItem(r.JunkItem, q);
    }
    // Special items are checked rarest first; the first success wins, and a bonus can grant a second roll.
    const rollSpecial = () => {
      for (const s of [...r.SpecialProducts].sort((x, y) => x.Chance - y.Chance)) {
        if (game.rng.next() <= s.Chance * (1 + b('IncreasedSpecialProductChance'))) {
          game.addItem(s.Item, game.rng.chance(doubling) ? s.Quantity * 2 : s.Quantity);
          game.stat('FishingSpecialItemsCaught');
          return true;
        }
      }
      return false;
    };
    if (rollSpecial() && game.rng.chance(b('SecondSpecialItemChance'))) rollSpecial();
    game.addXp(SKILL, r.BaseExperience);
    questEvent(game, 'FishingFishRecipe', (d) => (goalMatches(d, 'Recipe', NS + r.Id) ? 1 : 0));
    return rollInterval(game, r);
  },
};
