import type { Element, Pack, Recipe } from './types';
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

export const TOTAL_ELEMENTS = ELEMENTS.length;
