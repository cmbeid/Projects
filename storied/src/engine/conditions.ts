/**
 * Evaluates the declarative condition language from format.md §6 against a
 * live playthrough. This is the runtime counterpart to
 * `content/validate.ts`'s static analysis of the same language — that module
 * asks "could this ever be true anywhere", this one asks "is it true right
 * now".
 */
import type { Condition, VarValue } from '../content/types';
import type { PlayState } from './types';

function valuesEqual(a: VarValue, b: VarValue): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return a === b;
}

/**
 * A variable missing from state, or the wrong type for the operator applied
 * to it, evaluates false rather than throwing — content that reaches this
 * point should already be validated (§11's error list covers both cases),
 * but a live playthrough failing closed is a better failure than a crash.
 */
export function evaluateCondition(condition: Condition, state: Pick<PlayState, 'vars' | 'visited'>): boolean {
  if ('all' in condition) return condition.all.every((c) => evaluateCondition(c, state));
  if ('any' in condition) return condition.any.some((c) => evaluateCondition(c, state));
  if ('not' in condition) return !evaluateCondition(condition.not, state);
  if ('visited' in condition) return state.visited.includes(condition.visited);

  const current = state.vars[condition.var];
  if (current === undefined) return false;

  if ('eq' in condition) return valuesEqual(current, condition.eq);
  if ('ne' in condition) return !valuesEqual(current, condition.ne);
  if ('has' in condition) return Array.isArray(current) && current.includes(condition.has);

  if (typeof current !== 'number') return false;
  if ('gt' in condition) return current > condition.gt;
  if ('gte' in condition) return current >= condition.gte;
  if ('lt' in condition) return current < condition.lt;
  return current <= condition.lte;
}
