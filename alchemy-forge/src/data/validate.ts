import type { Element, Recipe } from './types';
import { BASE_ELEMENT_IDS } from './types';
import { buildIndex, pairKey, reachableDepths } from './indexes';

export interface ValidationReport {
  errors: string[];
  warnings: string[];
  stats: {
    elements: number;
    recipes: number;
    finalElements: number;
    maxDepth: number;
    depthHistogram: number[];
    unreachable: string[];
    spicyElements: number;
    spicyRecipes: number;
    tameElements: number;
    tameRecipes: number;
    tameUnreachable: string[];
  };
}

const BASE_IDS = new Set<string>(BASE_ELEMENT_IDS);

/**
 * Checks the element/recipe tables for the mistakes that are easy to make when
 * hand-authoring hundreds of recipes and impossible to spot by eye.
 *
 * The important one is reachability: an element nothing can produce is content
 * the player can never see, which no amount of playtesting reliably surfaces.
 */
export function validateData(elements: Element[], recipes: Recipe[]): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  // --- Element table integrity -------------------------------------------
  const seen = new Set<string>();
  for (const element of elements) {
    if (seen.has(element.id)) errors.push(`Duplicate element id: "${element.id}"`);
    seen.add(element.id);

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(element.id)) {
      errors.push(`Element id is not kebab-case: "${element.id}"`);
    }
    if (!element.name.trim()) errors.push(`Element "${element.id}" has no name`);
    if (!element.emoji.trim()) errors.push(`Element "${element.id}" has no emoji`);
    if (!element.blurb.trim()) errors.push(`Element "${element.id}" has no blurb`);
  }

  for (const id of BASE_ELEMENT_IDS) {
    if (!seen.has(id)) errors.push(`Missing base element: "${id}"`);
  }

  // --- Recipe table integrity --------------------------------------------
  const outputsByPair = new Map<string, Set<string>>();

  for (const recipe of recipes) {
    const label = `${recipe.a} + ${recipe.b} = ${recipe.out}`;

    for (const id of [recipe.a, recipe.b, recipe.out]) {
      if (!seen.has(id)) errors.push(`Recipe "${label}" references unknown element "${id}"`);
    }

    if (BASE_IDS.has(recipe.out)) {
      errors.push(`Recipe "${label}" produces a base element, which is always owned`);
    }
    if (recipe.out === recipe.a || recipe.out === recipe.b) {
      errors.push(`Recipe "${label}" produces one of its own inputs, so it does nothing`);
    }

    const key = pairKey(recipe.a, recipe.b);
    const outputs = outputsByPair.get(key) ?? new Set<string>();
    if (outputs.has(recipe.out)) {
      errors.push(`Duplicate recipe: "${label}" is listed more than once`);
    }
    outputs.add(recipe.out);
    outputsByPair.set(key, outputs);
  }

  // --- Spicy content is a strict leaf layer -------------------------------
  // Spicy mode is a runtime toggle, so the tame set has to stand on its own.
  // A tame element produced from a spicy input would vanish the moment the
  // toggle flipped off, which is exactly the bug this check makes impossible.
  const spicyIds = new Set(elements.filter((element) => element.spicy).map((element) => element.id));
  for (const recipe of recipes) {
    const inputIsSpicy = spicyIds.has(recipe.a) || spicyIds.has(recipe.b);
    if (inputIsSpicy && !spicyIds.has(recipe.out)) {
      errors.push(
        `Recipe "${recipe.a} + ${recipe.b} = ${recipe.out}" makes tame content from a spicy input; spicy elements must only ever produce spicy elements`,
      );
    }
  }

  // --- Reachability -------------------------------------------------------
  const index = buildIndex(elements, recipes);
  const depths = reachableDepths(index);

  const unreachable = elements.map((e) => e.id).filter((id) => !depths.has(id));
  for (const id of unreachable) {
    const element = index.byId.get(id);
    errors.push(
      `Unreachable: "${element?.name ?? id}" (${id}) cannot be produced from air/earth/fire/water`,
    );
  }

  // The same walk again with the spicy pack subtracted: the game as a player
  // who never turns spicy mode on actually sees it.
  const tameElements = elements.filter((element) => !element.spicy);
  const tameIds = new Set(tameElements.map((element) => element.id));
  const tameRecipeList = recipes.filter(
    (recipe) => tameIds.has(recipe.a) && tameIds.has(recipe.b) && tameIds.has(recipe.out),
  );
  const tameDepths = reachableDepths(buildIndex(tameElements, tameRecipeList));
  const tameUnreachable = tameElements.map((e) => e.id).filter((id) => !tameDepths.has(id));
  for (const id of tameUnreachable) {
    const element = index.byId.get(id);
    errors.push(
      `Unreachable with spicy mode off: "${element?.name ?? id}" (${id}) is only produced via spicy content`,
    );
  }

  let maxDepth = 0;
  for (const depth of depths.values()) maxDepth = Math.max(maxDepth, depth);

  const depthHistogram = new Array<number>(maxDepth + 1).fill(0);
  for (const depth of depths.values()) {
    depthHistogram[depth] = (depthHistogram[depth] ?? 0) + 1;
  }

  // --- Soft signals -------------------------------------------------------
  // A pair yielding several outputs is a supported feature, but it is far more
  // often an authoring slip: two recipes that happened to pick the same inputs.
  // Surface every one so they can be confirmed rather than discovered in play.
  const multiOutput: string[] = [];
  for (const [key, outputs] of outputsByPair) {
    if (outputs.size > 1) {
      const [a, b] = key.split('+');
      multiOutput.push(`${a} + ${b} yields ${[...outputs].join(' and ')}`);
    }
  }
  if (multiOutput.length > 0) {
    warnings.push(
      `${multiOutput.length} pair(s) produce more than one element — confirm each is deliberate:`,
      ...multiOutput.map((line) => `    ${line}`),
    );
  }

  for (const element of elements) {
    if (BASE_IDS.has(element.id)) continue;
    const routes = index.producedBy.get(element.id)?.length ?? 0;
    if (routes === 1 && (index.usedIn.get(element.id)?.length ?? 0) === 0) {
      warnings.push(
        `"${element.name}" has a single route in and leads nowhere — a dead end worth double-checking`,
      );
    }
  }

  return {
    errors,
    warnings,
    stats: {
      elements: elements.length,
      recipes: recipes.length,
      finalElements: index.finalIds.size,
      maxDepth,
      depthHistogram,
      unreachable,
      spicyElements: spicyIds.size,
      spicyRecipes: recipes.length - tameRecipeList.length,
      tameElements: tameElements.length,
      tameRecipes: tameRecipeList.length,
      tameUnreachable,
    },
  };
}
