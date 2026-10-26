// Farming is passive: plots grow on the simulation clock while you do other things.
import { NS, configList, get, itemName, type Ingredients, type ItemQuantity, type Requirement } from '../content';
import type { Game } from '../game';
import type { PlotState } from '../state';
import { missingIngredients, spendIngredients } from './common';
import { mod } from '../bonuses';
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

export const isReady = (game: Game, p: PlotState) => !!p.recipe && game.state.tick >= p.readyAt;

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
  p.readyAt = game.state.tick + Math.round(r.BaseInterval * ticksPerMs);
  p.regrowsLeft = r.Regrows;
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
  const q = harvestQuantity(r, p, game);
  const doubling = mod(game, 'FarmingAction', 'DoublingChance', { entity: SKILL, recipe: NS + r.Id, category: r.Category });
  game.addItem(r.Product.Item, game.rng.chance(doubling) ? q * 2 : q);
  game.addXp(SKILL, r.BaseExperience);
  game.state.rng = game.rng.state;
  if (p.regrowsLeft > 0) {
    // Orchard trees regrow without replanting; watering and compost stay applied.
    p.regrowsLeft--;
    p.readyAt = game.state.tick + Math.round(r.RegrowInterval * ticksPerMs);
  } else {
    Object.assign(p, { recipe: null, readyAt: 0, watered: false, compost: null });
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

export function setMill(game: Game, recipeId: string | null): string | null {
  if (recipeId) {
    const r = millRecipe(recipeId);
    if (game.isDemoLocked(r.Requirements)) return 'Not in demo';
    if (!game.requirementsMet(r.Requirements)) return 'Locked';
    const missing = missingIngredients(game, r.Ingredients);
    if (missing) return missing;
  }
  game.state.mill = { recipe: recipeId, readyAt: recipeId ? game.state.tick + Math.round(GRAIN_MILL_INTERVAL_MS * ticksPerMs) : 0 };
  game.emit();
  return null;
}

export const nextMillEvent = (game: Game) => (game.state.mill.recipe ? game.state.mill.readyAt : null);

export function processMill(game: Game): void {
  const m = game.state.mill;
  while (m.recipe && game.state.tick >= m.readyAt) {
    const r = millRecipe(m.recipe);
    if (missingIngredients(game, r.Ingredients)) {
      game.notice('The Grain Mill has stopped producing.');
      m.recipe = null;
      return;
    }
    spendIngredients(game, r.Ingredients);
    game.addItem(r.Product.Item, r.Product.Quantity);
    game.addXp(SKILL, r.BaseExperience);
    m.readyAt += Math.round(GRAIN_MILL_INTERVAL_MS * ticksPerMs);
    // Like the game, the mill stops as soon as it can't afford the next batch.
    if (missingIngredients(game, r.Ingredients)) {
      game.notice('The Grain Mill has stopped producing.');
      m.recipe = null;
    }
  }
}
