import type { ElementIndex } from '../data/indexes';
import { pairKey } from '../data/indexes';
import type { CombineResult } from '../state/types';

/**
 * Looks up what two elements make, and reports which of the results are new.
 *
 * Pure: it reads the discovered set but never changes it, so the caller stays
 * in control of when state actually moves.
 */
export function combine(
  index: ElementIndex,
  discovered: ReadonlySet<string>,
  a: string,
  b: string,
): CombineResult {
  const outputs = index.recipeMap.get(pairKey(a, b));
  if (!outputs || outputs.length === 0) return { kind: 'none' };

  const discoveries = outputs.filter((id) => !discovered.has(id));
  return { kind: 'combined', outputs: [...outputs], discoveries };
}

export interface Hint {
  /** The recipe inputs, in a stable order for display. */
  inputs: [string, string];
  /** How many undiscovered elements this pair would unlock. */
  newCount: number;
}

/**
 * Picks a combination the player can make right now but has not made yet.
 *
 * Prefers recipes whose inputs were discovered most recently, which keeps
 * hints pointing at the frontier the player is actually working on instead of
 * sending them back to air and water.
 */
export function pickHint(
  index: ElementIndex,
  discoveredOrder: readonly string[],
): Hint | null {
  const rank = new Map<string, number>();
  discoveredOrder.forEach((id, position) => rank.set(id, position));

  let best: Hint | null = null;
  let bestScore = -1;

  for (const [key, outputs] of index.recipeMap) {
    const [a, b] = key.split('+') as [string, string];

    const rankA = rank.get(a);
    const rankB = rank.get(b);
    if (rankA === undefined || rankB === undefined) continue;

    const unlocks = outputs.filter((id) => !rank.has(id));
    if (unlocks.length === 0) continue;

    // Later-discovered inputs score higher, so hints follow the player forward.
    const score = Math.max(rankA, rankB);
    if (score > bestScore) {
      bestScore = score;
      best = { inputs: [a, b], newCount: unlocks.length };
    }
  }

  return best;
}

/** Discovery progress, for the counter and the stats panel. */
export function progress(index: ElementIndex, discovered: ReadonlySet<string>) {
  const total = index.all.length;
  // Counted against the index rather than straight off the set: with spicy
  // mode off the save can still hold discoveries this index does not contain,
  // and "512 / 495" is not a progress bar anyone trusts.
  let found = 0;
  let finalsFound = 0;
  for (const id of discovered) {
    if (!index.byId.has(id)) continue;
    found += 1;
    if (index.finalIds.has(id)) finalsFound += 1;
  }

  return {
    found,
    total,
    percent: total === 0 ? 0 : Math.round((found / total) * 100),
    finalsFound,
    finalsTotal: index.finalIds.size,
  };
}

/**
 * The recipes that produce an element, split by whether the player has already
 * found that particular route. Undiscovered routes are returned so the
 * encyclopedia can show that more exist without revealing them.
 */
export function routesTo(
  index: ElementIndex,
  discovered: ReadonlySet<string>,
  elementId: string,
): { known: Array<[string, string]>; hiddenCount: number } {
  const recipes = index.producedBy.get(elementId) ?? [];
  const known: Array<[string, string]> = [];
  let hiddenCount = 0;

  for (const recipe of recipes) {
    if (discovered.has(recipe.a) && discovered.has(recipe.b)) {
      known.push([recipe.a, recipe.b]);
    } else {
      hiddenCount += 1;
    }
  }

  return { known, hiddenCount };
}
