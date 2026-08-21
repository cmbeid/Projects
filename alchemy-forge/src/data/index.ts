import type { Element, Pack, Recipe } from './types';
import type { ElementIndex } from './indexes';
import { buildIndex } from './indexes';
import { basePack } from './packs/00-base';
import { primordialPack } from './packs/01-primordial';
import { naturePack } from './packs/02-nature';
import { civilizationPack } from './packs/03-civilization';
import { technologyPack } from './packs/04-technology';
import { culturePack } from './packs/05-culture';
import { cosmosPack } from './packs/06-cosmos';

/**
 * Packs are merged in order. Splitting content this way keeps each themed
 * branch of the tree editable on its own, and lets the validator report which
 * bundle a problem came from.
 */
export const PACKS: Pack[] = [basePack, primordialPack, naturePack, civilizationPack, technologyPack, culturePack, cosmosPack];

export const ELEMENTS: Element[] = PACKS.flatMap((pack) => pack.elements);
export const RECIPES: Recipe[] = PACKS.flatMap((pack) => pack.recipes);

/** Every lookup table the game uses, built once at module load. */
export const INDEX = buildIndex(ELEMENTS, RECIPES);

/** The full content set, spicy elements included. */
export const FULL_INDEX = INDEX;

export const TAME_ELEMENTS: Element[] = ELEMENTS.filter((element) => !element.spicy);
export const TAME_RECIPES: Recipe[] = tameRecipes(ELEMENTS, RECIPES);

/**
 * The game with the spicy pack subtracted.
 *
 * Spicy content is authored as a strict leaf layer — nothing tame is ever
 * produced from a spicy input (the validator enforces it) — so removing it
 * leaves the rest of the tree fully reachable rather than full of holes.
 */
export const TAME_INDEX = buildIndex(TAME_ELEMENTS, TAME_RECIPES);

/** Drops every recipe that touches a spicy element on any of its three sides. */
export function tameRecipes(elements: Element[], recipes: Recipe[]): Recipe[] {
  const tameIds = new Set(elements.filter((element) => !element.spicy).map((element) => element.id));
  return recipes.filter((recipe) => tameIds.has(recipe.a) && tameIds.has(recipe.b) && tameIds.has(recipe.out));
}

let spicyEnabled = false;

/**
 * Which content set the game is currently playing with.
 *
 * Everything that reads element data goes through here rather than importing
 * a fixed index, so flipping spicy mode is a single assignment instead of a
 * rebuild or a reload.
 */
export function activeIndex(): ElementIndex {
  return spicyEnabled ? FULL_INDEX : TAME_INDEX;
}

export function setSpicyEnabled(enabled: boolean): void {
  spicyEnabled = enabled;
}

export function isSpicyEnabled(): boolean {
  return spicyEnabled;
}
