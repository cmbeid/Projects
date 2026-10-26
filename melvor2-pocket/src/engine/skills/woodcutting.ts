import type { WoodcuttingRecipe } from '../content';
import type { Game } from '../game';
import type { SkillHandler } from './types';
import { questEvent, goalMatches } from '../quests';
import { NS } from '../content';
import { bonusReader, recipeContext, recipeGetter, recipeList, rollItemChances } from './common';

const SKILL = 'Woodcutting';
const recipe = recipeGetter<WoodcuttingRecipe>('WoodcuttingRecipe');
/** Weak spots deal 3 + 10% of the tree's max HP (WoodcuttingActionComponent constants). */
const WEAK_SPOT_BASE = 3;
const WEAK_SPOT_HP_SHARE = 0.1;

const bonus = (game: Game, r: WoodcuttingRecipe) => bonusReader(game, 'WoodcuttingAction', recipeContext(SKILL, r));

export function maxHealth(r: WoodcuttingRecipe, game?: Game): number {
  const b = game ? bonus(game, r) : () => 0;
  return Math.ceil((r.BaseMaxHealth + b('FlatMaxHealth')) * (1 + b('PercentMaxHealth')));
}

export function treeHp(game: Game, id: string): number {
  return game.state.treeHp[id] ?? maxHealth(recipe(id), game);
}

function interval(game: Game, r: WoodcuttingRecipe): number {
  const b = bonus(game, r);
  return Math.max(250, Math.floor((r.BaseInterval + b('FlatInterval')) * (1 + b('PercentInterval'))));
}

export const woodcutting: SkillHandler = {
  skill: SKILL,
  recipes: () => recipeList(SKILL),
  recipe,
  interval: (game, id) => interval(game, recipe(id)),
  fire(game, id) {
    const r = recipe(id);
    const b = bonus(game, r);
    const doubling = b('DoublingChance');
    const max = maxHealth(r, game);
    rollItemChances(game, r.RandomProductsPerHit, doubling, b('FlatOnHitItemChance'), b('PercentOnHitItemChance'));

    let hp = Math.min(treeHp(game, id), max);
    let dmg = 1;
    let instant = false;
    if (hp > 1) {
      if (game.rng.chance(b('InstantCutChance'))) {
        dmg = hp;
        instant = true;
      }
      else {
        if (game.rng.chance(b('WeakSpotChance'))) dmg = WEAK_SPOT_BASE + Math.floor(WEAK_SPOT_HP_SHARE * max);
        if (game.rng.chance(b('DoubleDamageChance'))) dmg *= 2;
      }
    }
    questEvent(game, 'WoodcuttingDamageTree', (d) => (goalMatches(d, 'Recipe', NS + r.Id) ? Math.min(dmg, hp) : 0));
    if (instant) questEvent(game, 'WoodcuttingInstantCut', (d) => (goalMatches(d, 'Recipe', NS + r.Id) ? 1 : 0));
    hp -= dmg;
    if (hp > 0) {
      game.state.treeHp[id] = hp;
    } else {
      rollItemChances(game, r.RandomProductsPerCut, doubling, b('FlatOnCutItemChance'), b('PercentOnCutItemChance'));
      const q = r.Product.Quantity + Math.floor(b('FlatProductQuantity'));
      game.addItem(r.Product.Item, game.rng.chance(doubling) ? q * 2 : q);
      game.addXp(SKILL, r.BaseExperience);
      game.state.treeHp[id] = max;
      questEvent(game, 'WoodcuttingCutTree', (d) => (goalMatches(d, 'Recipe', NS + r.Id) ? 1 : 0));
    }
    return interval(game, r);
  },
};
