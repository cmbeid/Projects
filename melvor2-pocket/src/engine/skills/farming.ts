// Farming is passive: plots grow on the simulation clock while you do other things.
import { NS, configList, get, itemName, tryGet, type Ingredients, type ItemQuantity, type Requirement } from '../content';
import type { Game } from '../game';
import type { PlotState } from '../state';
import { missingIngredients, spendIngredients } from './common';
import { mod } from '../bonuses';
import { goalMatches, questEvent } from '../quests';
import type { SkillRecipe } from './types';

const SKILL = 'Farming';

export interface FarmingCategory {
  Id: string;
  DisplayName: string;
  DiseaseValueAdjuster: number;
  PestValueAdjuster: number;
  CanWater: boolean;
  CanCompost: boolean;
  AttractsDisease: boolean;
  AttractsPests: boolean;
  WateringModifierTemplate: { Stat: { Name: string }; Value: number }[] | null;
  Requirements: Requirement[] | null;
}

export interface FarmingPlot { Id: string; DisplayName: string; Category: string; Costs: Ingredients; Requirements: Requirement[] | null }

export interface FarmingRecipe extends SkillRecipe {
  BaseInterval: number;
  Product: ItemQuantity;
  Ingredients: Ingredients;
  DiseaseValueAdjuster: number;
  PestValueAdjuster: number;
  Regrows: number;
  RegrowInterval: number;
  /** Flowers give these bonuses for GrownInterval once grown, instead of a harvest. */
  FreeAutoWateringRequirements?: Requirement[] | null;
  BonusesWhenGrown?: { Global?: unknown[]; Component?: unknown[] } | null;
  GrownInterval?: number;
  AutomationRequirements?: Requirement[] | null;
  AutomationCosts?: Ingredients | null;
}

interface CompostCapability { CompostModifierTemplate: { Stat: { Name: string }; Value: number }[] }

export const category = (id: string) => get<FarmingCategory>('FarmingCategory', id);
export const plot = (id: string) => get<FarmingPlot>('FarmingPlot', id);
export const farmingRecipe = (id: string) => get<FarmingRecipe>('FarmingRecipe', id);
export const plotIds = () => configList(SKILL, 'Plots');
export const categoryIds = () => configList(SKILL, 'Categories');

export const ticksPerMs = 60 / 1000;

export function plotState(game: Game, id: string): PlotState | undefined {
  return game.state.farming.plots[id];
}

export function recipesFor(categoryId: string): string[] {
  return configList(SKILL, 'Recipes').filter((r) => farmingRecipe(r).Category === categoryId);
}

/** Percent of the harvest lost to disease and pests: max(0, value - protection) for each, in percentage points. */
export function harvestPenalty(r: FarmingRecipe, p: PlotState, game?: Game): number {
  const cat = category(r.Category!);
  const disease = cat.AttractsDisease ? r.DiseaseValueAdjuster + cat.DiseaseValueAdjuster : 0;
  const pests = cat.AttractsPests ? r.PestValueAdjuster + cat.PestValueAdjuster : 0;
  const ctx = { entity: SKILL, recipe: NS + r.Id, category: r.Category };
  let diseaseProtection = game ? mod(game, 'FarmingAction', 'FlatDiseaseProtection', ctx) : 0;
  let pestProtection = game ? mod(game, 'FarmingAction', 'FlatPestProtection', ctx) : 0;
  if (p.watered) {
    for (const m of cat.WateringModifierTemplate ?? []) {
      if (m.Stat.Name === 'FlatDiseaseProtection') diseaseProtection += m.Value;
      if (m.Stat.Name === 'FlatPestProtection') pestProtection += m.Value;
    }
  }
  return Math.max(0, pests - pestProtection) + Math.max(0, disease - diseaseProtection);
}

export function compostBonus(p: PlotState): number {
  if (!p.compost) return 0;
  const cap = get<{ Capabilities: Record<string, unknown> }>('Item', p.compost).Capabilities[`${NS}Compost`] as CompostCapability;
  return cap.CompostModifierTemplate.filter((m) => m.Stat.Name === 'PercentProductQuantity').reduce((s, m) => s + m.Value, 0);
}

/** Harvest size: floor(base × (1 + compost%) × (1 − penalty/100)), at least 1. */
export function harvestQuantity(r: FarmingRecipe, p: PlotState, game?: Game): number {
  const ctx = { entity: SKILL, recipe: NS + r.Id, category: r.Category };
  const flat = game ? mod(game, 'FarmingAction', 'FlatProductQuantity', ctx) : 0;
  const pct = compostBonus(p) + (game ? mod(game, 'FarmingAction', 'PercentProductQuantity', ctx) : 0);
  return Math.max(1, Math.floor((r.Product.Quantity + flat) * (1 + pct) * (1 - harvestPenalty(r, p, game) / 100)));
}

/** Flowers: recipes that give bonuses when grown rather than a harvest. */
export const isFlower = (r: FarmingRecipe) => !!r.BonusesWhenGrown && [...(r.BonusesWhenGrown.Global ?? []), ...(r.BonusesWhenGrown.Component ?? [])].length > 0;

/** Ready to harvest (flowers never are: they switch to giving bonuses). */
export const isReady = (game: Game, p: PlotState) => !!p.recipe && game.state.tick >= p.readyAt && !isFlower(farmingRecipe(p.recipe));

const fctx = (r: FarmingRecipe) => ({ entity: SKILL, recipe: NS + r.Id, category: r.Category });

/** Growing time with the Flat/Percent interval bonuses (e.g. Deedree's major node). */
export function growInterval(game: Game, r: FarmingRecipe, regrow = false): number {
  const base = regrow ? r.RegrowInterval : r.BaseInterval;
  return Math.max(1000, Math.floor((base + mod(game, 'FarmingAction', 'FlatInterval', fctx(r))) * (1 + mod(game, 'FarmingAction', 'PercentInterval', fctx(r)))));
}

// ---- automation -------------------------------------------------------------------------------------------------

export const automationUnlocked = (game: Game, r: FarmingRecipe) =>
  !!r.AutomationRequirements && !game.isDemoLocked(r.AutomationRequirements) && game.requirementsMet(r.AutomationRequirements);

/** What one automated step costs for a recipe, with automation cost bonuses. */
export function automationCost(game: Game, r: FarmingRecipe): Ingredients {
  const flat = mod(game, 'FarmingAction', 'FlatAutomationCost', fctx(r));
  const pct = mod(game, 'FarmingAction', 'PercentAutomationCost', fctx(r));
  const q = (n: number) => Math.max(0, Math.floor((n + flat) * (1 + pct)));
  const c = r.AutomationCosts ?? { Items: [], Currencies: [] };
  return {
    Items: c.Items.map((i) => ({ Item: i.Item, Quantity: q(i.Quantity) })).filter((i) => i.Quantity > 0),
    Currencies: c.Currencies.map((x) => ({ Currency: x.Currency, Quantity: q(x.Quantity) })).filter((x) => x.Quantity > 0),
  };
}

/** Sprinklers: once their requirement is met, automated watering costs nothing. */
export const freeWatering = (game: Game, r: FarmingRecipe) =>
  !!r.FreeAutoWateringRequirements?.length && game.requirementsMet(r.FreeAutoWateringRequirements);

function payAutomation(game: Game, r: FarmingRecipe): boolean {
  if (!automationUnlocked(game, r)) return false;
  const cost = automationCost(game, r);
  if (missingIngredients(game, cost)) return false;
  spendIngredients(game, cost);
  return true;
}

/** Earliest farming event: a flower finishing or wearing off, or an automated plot coming due. */
export function nextFarmingEvent(game: Game): number | null {
  let next: number | null = null;
  const consider = (t: number) => {
    if (next == null || t < next) next = t;
  };
  for (const p of Object.values(game.state.farming.plots)) {
    if (!p.recipe) {
      if (p.auto?.replant && (p.autoCheckedAt ?? -1) < (p.readyAt ?? 0)) consider(p.readyAt);
      continue;
    }
    const r = farmingRecipe(p.recipe);
    if (isFlower(r)) consider(p.providingUntil ?? p.readyAt);
    else if (p.auto?.harvest && (p.autoCheckedAt ?? -1) < p.readyAt) consider(p.readyAt);
  }
  return next;
}

export function processFarming(game: Game): void {
  const now = game.state.tick;
  for (const [id, p] of Object.entries(game.state.farming.plots)) {
    if (p.recipe) {
      const r = farmingRecipe(p.recipe);
      if (isFlower(r)) {
        if (p.providingUntil == null && now >= p.readyAt) {
          // Grown: the flower now gives its bonus for GrownInterval.
          p.providingUntil = p.readyAt + Math.round((r.GrownInterval ?? 0) * ticksPerMs);
          game.addXp(SKILL, r.BaseExperience);
          game.toolbeltTrigger('FarmingRecipeGrown', { entity: SKILL, category: r.Category, recipe: p.recipe ?? undefined });
          questEvent(game, 'FarmingHarvestRecipe', (d) => (goalMatches(d, 'Recipe', p.recipe ?? undefined) && goalMatches(d, 'Category', r.Category) ? 1 : 0));
          game.bonusesChanged();
        }
        if (p.providingUntil != null && now >= p.providingUntil) {
          const ended = p.providingUntil;
          Object.assign(p, { recipe: null, readyAt: ended, watered: false, compost: null, providingUntil: undefined });
          game.bonusesChanged();
        }
      } else if (p.auto?.harvest && now >= p.readyAt && (p.autoCheckedAt ?? -1) < p.readyAt) {
        p.autoCheckedAt = now;
        if (payAutomation(game, r)) harvest(game, id);
      }
    }
    // Replant straight after a harvest in the same pass (<=), but never loop on a failed attempt (nextFarmingEvent uses <).
    if (!p.recipe && p.auto?.replant && (p.autoCheckedAt ?? -1) <= p.readyAt) {
      p.autoCheckedAt = now;
      const r = farmingRecipe(p.auto.replant);
      if (!missingIngredients(game, r.Ingredients) && payAutomation(game, r) && plant(game, id, p.auto.replant) === null) {
        if (p.auto.water && category(plot(id).Category).CanWater && (freeWatering(game, r) || payAutomation(game, r))) water(game, id);
        if (p.auto.compost && category(plot(id).Category).CanCompost && game.count(p.auto.compost) > 0 && payAutomation(game, r)) compost(game, id, p.auto.compost);
      }
    }
  }
}

/** Bonuses from flowers: full while blooming, scaled by PercentBonusesWhileGrowing while still growing. */
export function flowerBonuses(game: Game, whileGrowing: number): { block: FarmingRecipe['BonusesWhenGrown']; times: number }[] {
  const out: { block: FarmingRecipe['BonusesWhenGrown']; times: number }[] = [];
  for (const p of Object.values(game.state.farming.plots)) {
    if (!p.recipe) continue;
    const r = farmingRecipe(p.recipe);
    if (!isFlower(r)) continue;
    if (p.providingUntil != null) out.push({ block: r.BonusesWhenGrown, times: 1 });
    else if (whileGrowing > 0) out.push({ block: r.BonusesWhenGrown, times: whileGrowing });
  }
  return out;
}

export function buyPlot(game: Game, id: string): string | null {
  const pl = plot(id);
  if (plotState(game, id)) return 'Already owned';
  if (game.isDemoLocked(pl.Requirements)) return 'Not in demo';
  if (!game.requirementsMet(pl.Requirements)) return 'Level too low';
  const missing = missingIngredients(game, pl.Costs);
  if (missing) return missing;
  spendIngredients(game, pl.Costs);
  game.state.farming.plots[id] = { recipe: null, readyAt: 0, regrowsLeft: 0, watered: false, compost: null };
  game.emit();
  return null;
}

export function plant(game: Game, plotId: string, recipeId: string): string | null {
  const p = plotState(game, plotId);
  const r = farmingRecipe(recipeId);
  if (!p) return 'Buy this plot first';
  if (p.recipe) return 'Plot is in use';
  if (game.isDemoLocked(r.Requirements)) return 'Not in demo';
  if (!game.requirementsMet(r.Requirements)) return 'Level too low';
  const missing = missingIngredients(game, r.Ingredients);
  if (missing) return missing;
  spendIngredients(game, r.Ingredients);
  p.recipe = recipeId;
  p.readyAt = game.state.tick + Math.round(growInterval(game, r) * ticksPerMs);
  p.regrowsLeft = r.Regrows;
  p.providingUntil = undefined;
  game.emit();
  return null;
}

export function water(game: Game, plotId: string): void {
  const p = plotState(game, plotId);
  if (!p || p.watered || !category(plot(plotId).Category).CanWater) return;
  p.watered = true;
  game.emit();
}

export function compost(game: Game, plotId: string, itemId: string): string | null {
  const p = plotState(game, plotId);
  if (!p || p.compost || !category(plot(plotId).Category).CanCompost) return null;
  if (!game.removeItem(itemId, 1)) return `Need ${itemName(itemId)}`;
  p.compost = itemId;
  game.emit();
  return null;
}

export function harvest(game: Game, plotId: string): void {
  const p = plotState(game, plotId);
  if (!p || !isReady(game, p)) return;
  const r = farmingRecipe(p.recipe!);
  game.itemSource = SKILL;
  const q = harvestQuantity(r, p, game);
  const doubling = mod(game, 'FarmingAction', 'DoublingChance', { entity: SKILL, recipe: NS + r.Id, category: r.Category });
  game.addItem(r.Product.Item, game.rng.chance(doubling) ? q * 2 : q);
  game.addXp(SKILL, r.BaseExperience);
  game.stat('FarmingProductsHarvested');
  // Crops "grow" (FarmingRecipeGrown) when they're collected here; scarecrows and pods protected them until then.
  game.toolbeltTrigger('FarmingRecipeGrown', { entity: SKILL, category: r.Category, recipe: p.recipe ?? undefined });
  game.itemSource = null;
  questEvent(game, 'FarmingHarvestRecipe', (d) =>
    goalMatches(d, 'Recipe', p.recipe ?? undefined) && goalMatches(d, 'Category', r.Category) ? 1 : 0,
  );
  game.state.rng = game.rng.state;
  if (p.regrowsLeft > 0) {
    // Orchard trees regrow without replanting; watering and compost stay applied.
    p.regrowsLeft--;
    p.readyAt = game.state.tick + Math.round(growInterval(game, r, true) * ticksPerMs);
  } else {
    // Compost can be preserved for the next crop by a compost preservation bonus.
    const keep = p.compost && game.rng.chance(mod(game, 'FarmingAction', 'CompostPreservationChance', fctx(r))) ? p.compost : null;
    Object.assign(p, { recipe: null, readyAt: game.state.tick, watered: false, compost: keep });
  }
  game.emit();
}

export const compostItems = () => ['Compost', 'Fertiliser', 'SuperCompost'].map((s) => NS + s);

// ---- Grain Mill -------------------------------------------------------------------------------

export interface GrainMillRecipe extends SkillRecipe { Product: ItemQuantity; Ingredients: Ingredients }

/** FarmingGrainMillComponent: each batch takes 5 minutes. */
export const GRAIN_MILL_INTERVAL_MS = 300_000;
export const millRecipeIds = () => configList(SKILL, 'GrainMillRecipes');
export const millRecipe = (id: string) => get<GrainMillRecipe>('GrainMillRecipe', id);

// The mill works from its own storage, as on the desktop: you deposit Wheat, Sugarcane, Corn and Flax into it (up to
// 6,000 of each, more with storage bonuses) and its products go to the bank.
const BASE_MILL_STACK = 6000;
export const millStorageItems = () => tryGet<{ StorageItems: string[] }>('GrainMill', `${NS}GrainMill`)?.StorageItems ?? [];
export const millCapacity = (game: Game) => Math.max(1, BASE_MILL_STACK + Math.floor(mod(game, 'GrainMillInventory', 'FlatMaxStackQuantity', { entity: SKILL })));
export const milled = (game: Game, item: string) => game.state.mill.storage?.[item] ?? 0;

/** Move as much of an item as fits from the bank into the mill. Returns how many moved. */
export function depositToMill(game: Game, item: string, quantity = Infinity): number {
  if (!millStorageItems().includes(item)) return 0;
  const n = Math.max(0, Math.min(quantity, game.count(item), millCapacity(game) - milled(game, item)));
  if (!n) return 0;
  game.removeItem(item, n);
  (game.state.mill.storage ??= {})[item] = milled(game, item) + n;
  game.emit();
  return n;
}

export function withdrawFromMill(game: Game, item: string): void {
  const n = milled(game, item);
  if (!n) return;
  delete game.state.mill.storage![item];
  game.addItem(item, n);
  game.emit();
}

const millMissing = (game: Game, ing: Ingredients) => {
  const short = ing.Items.find((i) => milled(game, i.Item) < i.Quantity);
  return short ? `Deposit ${short.Quantity} ${itemName(short.Item, short.Quantity)} into the mill` : null;
};
const millSpend = (game: Game, ing: Ingredients) => {
  for (const i of ing.Items) game.state.mill.storage![i.Item] = milled(game, i.Item) - i.Quantity;
};

export function setMill(game: Game, recipeId: string | null): string | null {
  if (recipeId) {
    const r = millRecipe(recipeId);
    if (game.isDemoLocked(r.Requirements)) return 'Not in demo';
    if (!game.requirementsMet(r.Requirements)) return 'Locked';
    const missing = millMissing(game, r.Ingredients);
    if (missing) return missing;
  }
  game.state.mill = { ...game.state.mill, recipe: recipeId, readyAt: recipeId ? game.state.tick + Math.round(GRAIN_MILL_INTERVAL_MS * ticksPerMs) : 0 };
  game.emit();
  return null;
}

export const nextMillEvent = (game: Game) => (game.state.mill.recipe ? game.state.mill.readyAt : null);

export function processMill(game: Game): void {
  const m = game.state.mill;
  while (m.recipe && game.state.tick >= m.readyAt) {
    const r = millRecipe(m.recipe);
    if (millMissing(game, r.Ingredients)) {
      game.notice('The Grain Mill has stopped producing.');
      m.recipe = null;
      return;
    }
    millSpend(game, r.Ingredients);
    // Production upgrades: +25% flour per batch each.
    const pct = mod(game, 'GrainMill', 'PercentProductQuantity', { entity: SKILL, recipe: m.recipe });
    game.addItem(r.Product.Item, Math.floor(r.Product.Quantity * (1 + pct)));
    game.addXp(SKILL, r.BaseExperience);
    m.readyAt += Math.round(GRAIN_MILL_INTERVAL_MS * ticksPerMs);
    // Like the game, the mill stops as soon as it can't afford the next batch.
    if (millMissing(game, r.Ingredients)) {
      game.notice('The Grain Mill has stopped producing.');
      m.recipe = null;
    }
  }
}
