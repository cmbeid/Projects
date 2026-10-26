import { type Ingredients, ItemQuantityChance, NS, configList, get, itemName } from '../content';
import type { Game } from '../game';
import { type BonusContext, mod } from '../bonuses';
import type { SkillRecipe } from './types';

export function recipeList(skill: string): string[] {
  return configList(skill, 'Recipes');
}

export function recipeGetter<T extends SkillRecipe>(type: string): (id: string) => T {
  return (id) => get<T>(type, id);
}

/** Looks up bonuses for one skill action (e.g. 'WoodcuttingAction') in a recipe/category context. */
export function bonusReader(game: Game, statsType: string, ctx: BonusContext) {
  return (name: string) => mod(game, statsType, name, ctx);
}

/** Context for a recipe: its id and category, under the skill entity. */
export function recipeContext(skill: string, r: SkillRecipe): BonusContext {
  return { entity: skill, recipe: NS + r.Id, category: r.Category };
}

/** Roll each chance entry; `flatChance` / `pctChance` are the On…ItemChance bonuses. */
export function rollItemChances(game: Game, chances: ItemQuantityChance[], doubling: number, flatChance = 0, pctChance = 0): void {
  for (const c of chances) {
    if (!game.rng.chance((c.Chance + flatChance) * (1 + pctChance))) continue;
    game.addItem(c.Item, game.rng.chance(doubling) ? c.Quantity * 2 : c.Quantity);
  }
}

export const skillId = (skill: string) => NS + skill;

/** Ingredients after PercentIngredientCost bonuses: max(1, floor(qty × (1 + pct))). */
export function scaledIngredients(ing: Ingredients, pct: number): Ingredients {
  if (!pct) return ing;
  return {
    Items: ing.Items.map((i) => ({ ...i, Quantity: Math.max(1, Math.floor(i.Quantity * (1 + pct))) })),
    Currencies: ing.Currencies.map((c) => ({ ...c, Quantity: Math.max(1, Math.floor(c.Quantity * (1 + pct))) })),
  };
}

/** What's missing to pay for a recipe once, or null if you can afford it. */
export function missingIngredients(game: Game, ing: Ingredients): string | null {
  for (const i of ing.Items) {
    if (game.count(i.Item) < i.Quantity) return `Need ${i.Quantity} ${itemName(i.Item, i.Quantity)}`;
  }
  for (const c of ing.Currencies) {
    if (game.currency(c.Currency) < c.Quantity) return `Need ${c.Quantity} gold`;
  }
  return null;
}

export function spendIngredients(game: Game, ing: Ingredients): void {
  for (const i of ing.Items) game.removeItem(i.Item, i.Quantity);
  for (const c of ing.Currencies) game.addCurrency(c.Currency, -c.Quantity);
}

export const LACK_OF_RESOURCES = 'Lack of resources available.';
