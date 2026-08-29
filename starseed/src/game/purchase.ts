import { Decimal } from '../num/decimal';
import type { Building } from '../data/types';

/**
 * Geometric cost curves and their closed forms.
 *
 * Everything here is closed-form on purpose. Late in a run a building stack is
 * thousands deep, and a loop that adds one unit's cost at a time turns a
 * buy-max tap into a visible frame hitch.
 */

/** Cost of the next single unit: `base * growth^owned`. */
export function costOf(building: Building, owned: number): Decimal {
  return Decimal.from(building.cost.base).mul(Decimal.from(building.cost.growth).pow(owned));
}

/**
 * Cost of `count` consecutive units starting from `owned`.
 *
 *   S = base * growth^owned * (growth^count - 1) / (growth - 1)
 */
export function sumCost(building: Building, owned: number, count: number): Decimal {
  if (count <= 0) return Decimal.ZERO;
  const growth = building.cost.growth;
  const first = costOf(building, owned);
  const numerator = Decimal.from(growth).pow(count).sub(Decimal.ONE);
  return first.mul(numerator).div(Decimal.from(growth - 1));
}

/**
 * The largest `k` whose total cost fits inside `budget`.
 *
 *   k = floor( log(1 + budget*(growth-1) / (base*growth^owned)) / log(growth) )
 *
 * The closed form is then corrected by at most a step or two: `log` on the
 * scale this game reaches is accurate to about fifteen digits, and being one
 * unit over budget would let the player buy something they cannot pay for.
 */
export function maxAffordable(building: Building, owned: number, budget: Decimal): number {
  if (!budget.isPositive) return 0;
  const first = costOf(building, owned);
  if (budget.lt(first)) return 0;

  const growth = building.cost.growth;
  const ratio = budget.mulNumber(growth - 1).div(first);

  // Past about 1e15 the `1 +` is lost in the mantissa anyway, so skip it
  // rather than collapsing a huge Decimal to Infinity through toNumber().
  const ratioLog = ratio.log10();
  const log1p = ratioLog > 15 ? ratioLog : Math.log10(1 + ratio.toNumber());

  let count = Math.floor(log1p / Math.log10(growth));
  if (!Number.isFinite(count) || count < 0) return 0;

  while (count > 0 && sumCost(building, owned, count).gt(budget)) count -= 1;
  while (sumCost(building, owned, count + 1).lte(budget)) count += 1;
  return count;
}

/** How many units a buy mode would purchase, given what the player can pay. */
export function countForMode(
  building: Building,
  owned: number,
  budget: Decimal,
  mode: 1 | 10 | 'max',
): number {
  if (mode === 'max') return maxAffordable(building, owned, budget);
  return sumCost(building, owned, mode).lte(budget) ? mode : 0;
}
