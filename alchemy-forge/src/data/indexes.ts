import type { Element, Recipe } from './types';
import { BASE_ELEMENT_IDS } from './types';

/**
 * Normalises an unordered pair of element ids into a single lookup key.
 *
 * This is the one place combination order is collapsed, so `A + B` and `B + A`
 * are guaranteed to be the same thing everywhere in the game.
 */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}+${b}` : `${b}+${a}`;
}

export interface ElementIndex {
  /** Every element, by id. */
  byId: Map<string, Element>;
  /** All elements in display order. */
  all: Element[];
  /** pairKey -> the element ids that pair produces (deduped, in author order). */
  recipeMap: Map<string, string[]>;
  /** element id -> the recipes that produce it. */
  producedBy: Map<string, Recipe[]>;
  /** element id -> the recipes that consume it as an input. */
  usedIn: Map<string, Recipe[]>;
  /** Elements that are not an input to any recipe: the leaves of the tree. */
  finalIds: Set<string>;
  /** All recipes, flattened across packs. */
  recipes: Recipe[];
}

/**
 * Builds every lookup the game needs in a single pass over the data. Called
 * once at module load; nothing downstream ever scans the raw arrays.
 */
export function buildIndex(elements: Element[], recipes: Recipe[]): ElementIndex {
  const byId = new Map<string, Element>();
  for (const element of elements) byId.set(element.id, element);

  const recipeMap = new Map<string, string[]>();
  const producedBy = new Map<string, Recipe[]>();
  const usedIn = new Map<string, Recipe[]>();
  const inputIds = new Set<string>();

  for (const recipe of recipes) {
    const key = pairKey(recipe.a, recipe.b);
    const outputs = recipeMap.get(key);
    if (outputs) {
      if (!outputs.includes(recipe.out)) outputs.push(recipe.out);
    } else {
      recipeMap.set(key, [recipe.out]);
    }

    push(producedBy, recipe.out, recipe);
    push(usedIn, recipe.a, recipe);
    if (recipe.b !== recipe.a) push(usedIn, recipe.b, recipe);

    inputIds.add(recipe.a);
    inputIds.add(recipe.b);
  }

  const finalIds = new Set<string>();
  for (const element of elements) {
    if (!inputIds.has(element.id)) finalIds.add(element.id);
  }

  return { byId, all: elements, recipeMap, producedBy, usedIn, finalIds, recipes };
}

function push<T>(map: Map<string, T[]>, key: string, value: T): void {
  const existing = map.get(key);
  if (existing) existing.push(value);
  else map.set(key, [value]);
}

/**
 * Walks the recipe graph outward from the four base elements, returning every
 * element actually obtainable in play along with how many combination steps
 * deep it sits.
 *
 * This is the backbone of the data validator: anything missing from the result
 * is content the player can never reach.
 */
export function reachableDepths(index: ElementIndex): Map<string, number> {
  const depth = new Map<string, number>();
  for (const id of BASE_ELEMENT_IDS) {
    if (index.byId.has(id)) depth.set(id, 0);
  }

  // Repeatedly combine everything known with everything known until a full
  // pass discovers nothing new. The element count is small enough (hundreds)
  // that this is instant, and it mirrors how a player actually explores.
  let frontier = [...depth.keys()];
  let currentDepth = 0;

  while (frontier.length > 0) {
    currentDepth += 1;
    const known = [...depth.keys()];
    const nextFrontier: string[] = [];

    // Only pairs involving at least one newly-reached element can yield
    // anything new, so pair the frontier against everything known.
    for (const a of frontier) {
      for (const b of known) {
        const outputs = index.recipeMap.get(pairKey(a, b));
        if (!outputs) continue;
        for (const out of outputs) {
          if (depth.has(out)) continue;
          depth.set(out, currentDepth);
          nextFrontier.push(out);
        }
      }
    }

    frontier = nextFrontier;
  }

  return depth;
}
