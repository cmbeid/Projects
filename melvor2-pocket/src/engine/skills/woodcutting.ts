import type { WoodcuttingRecipe } from '../content';
import type { Game } from '../game';
import type { SkillHandler } from './types';
import { questEvent, goalMatches } from '../quests';
import { NS, all } from '../content';
import { mod } from '../bonuses';
import type { BonusContext } from '../bonuses';
import { bonusReader, recipeContext, recipeGetter, recipeList, rollItemChances } from './common';

const SKILL = 'Woodcutting';
const recipe = recipeGetter<WoodcuttingRecipe>('WoodcuttingRecipe');
/** Weak spots deal 3 + 10% of the tree's max HP (WoodcuttingActionComponent constants). */
const WEAK_SPOT_BASE = 3;
const WEAK_SPOT_HP_SHARE = 0.1;

const baseBonus = (game: Game, r: WoodcuttingRecipe) => bonusReader(game, 'WoodcuttingAction', recipeContext(SKILL, r));

interface Overgrowth { Id: string; AppliesToCategory: string; Bonuses: { Stat: { Name: string }; Value: number }[] }

/** Overgrowth stacks on a tree (from Deedree's major node): while any are left, its bonuses apply. */
export const overgrowth = (game: Game, id: string) => game.state.overgrowth?.[id] ?? 0;

/** A tree's bonuses: the global ones plus overgrowth's +1s while it has stacks. */
function bonus(game: Game, r: WoodcuttingRecipe) {
  const base = baseBonus(game, r);
  const stacked = overgrowth(game, NS + r.Id) > 0 ? all<Overgrowth>('OvergrowthEffect').filter((o) => o.AppliesToCategory === r.Category) : [];
  return (name: string, extra?: BonusContext) => base(name, extra) + stacked.reduce((s, o) => s + o.Bonuses.filter((b) => b.Stat.Name === name).reduce((t, b) => t + b.Value, 0), 0);
}

/** Each hit can spread overgrowth: one stack onto every unlocked tree of the effect's category (WoodcuttingActionComponent). */
function rollOvergrowth(game: Game, r: WoodcuttingRecipe): void {
  for (const o of all<Overgrowth>('OvergrowthEffect')) {
    const chance = mod(game, 'WoodcuttingAction', 'ApplicationChance', { ...recipeContext(SKILL, r), effect: NS + o.Id });
    if (chance <= 0 || !game.rng.chance(chance)) continue;
    for (const id of recipeList(SKILL)) {
      const t = recipe(id);
      if (t.Category !== o.AppliesToCategory || game.isDemoLocked(t.Requirements) || !game.requirementsMet(t.Requirements)) continue;
      (game.state.overgrowth ??= {})[id] = overgrowth(game, id) + 1;
    }
  }
}

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
    rollItemChances(game, r.RandomProductsPerHit, doubling, b, ['FlatOnHitItemChance', 'PercentOnHitItemChance', 'FlatOnHitItemQuantity']);

    let hp = Math.min(treeHp(game, id), max);
    let dmg = 1;
    let instant = false;
    if (hp > 1) {
      if (game.rng.chance(b('InstantCutChance'))) {
        dmg = hp;
        instant = true;
      }
      else {
        if (game.rng.chance(b('WeakSpotChance'))) {
          dmg = WEAK_SPOT_BASE + Math.floor(WEAK_SPOT_HP_SHARE * max);
          game.stat('WoodcuttingWeakSpots');
        }
        if (game.rng.chance(b('DoubleDamageChance'))) dmg *= 2;
      }
    }
    questEvent(game, 'WoodcuttingDamageTree', (d) => (goalMatches(d, 'Recipe', NS + r.Id) ? Math.min(dmg, hp) : 0));
    if (instant) questEvent(game, 'WoodcuttingInstantCut', (d) => (goalMatches(d, 'Recipe', NS + r.Id) ? 1 : 0));
    hp -= dmg;
    rollOvergrowth(game, r);
    if (hp > 0) {
      game.state.treeHp[id] = hp;
    } else {
      game.stat('WoodcuttingFells');
      rollItemChances(game, r.RandomProductsPerCut, doubling, b, ['FlatOnCutItemChance', 'PercentOnCutItemChance', 'FlatOnCutItemQuantity']);
      const q = r.Product.Quantity + Math.floor(b('FlatProductQuantity'));
      game.addItem(r.Product.Item, game.rng.chance(doubling) ? q * 2 : q);
      game.addXp(SKILL, r.BaseExperience);
      game.state.treeHp[id] = max;
      // A full cut uses up one overgrowth stack.
      if (overgrowth(game, id) > 0) game.state.overgrowth![id]--;
      questEvent(game, 'WoodcuttingCutTree', (d) => (goalMatches(d, 'Recipe', NS + r.Id) ? 1 : 0));
    }
    return interval(game, r);
  },
};
