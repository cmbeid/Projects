import { Decimal } from '../num/decimal';
import type { ContentIndex } from '../data/indexes';
import type { GameState } from '../state/types';
import type { RateCache } from './rates';
import { costOf } from './purchase';
import { availableUpgrades, isSatisfied } from './unlocks';

/** Taps per second the Auto-Miner stands in for. */
export const AUTO_TAPS_PER_SECOND = 5;

/** Fraction of a resource's cap that counts as "about to overflow". */
const OVERFLOW_MARGIN = 0.9;

/**
 * The automation ladder, running inside a simulation step.
 *
 * Every behaviour lives here rather than in the UI, which is what lets offline
 * catch-up (phase 6) apply exactly the same automation the player would have
 * seen live — the whole reason `advance` is the only code path.
 *
 * Buying invalidates the rate cache, so the next step sees the new production.
 */
export function runAutomation(state: GameState, index: ContentIndex, cache: RateCache): string[] {
  const bought: string[] = [];
  const active = (id: string): boolean =>
    state.automation.includes(id) && state.automationOn[id] !== false;

  if (active('replication') && buyCheapestProducer(state, index)) bought.push('replication');
  if (active('load-balancer') && buyNeededDepot(state, index, cache)) bought.push('load-balancer');
  if (active('procurement') && buyCheapestUpgrade(state, index)) bought.push('procurement');

  if (bought.length > 0) cache.invalidate();
  return bought;
}

/**
 * One unit of the cheapest producer that can be afforded, per step.
 *
 * Cheapest-first is deliberately naive: it is what a player does when they stop
 * thinking, which is exactly the job this retires. It also cannot overspend,
 * because it buys a single unit at its exact quoted price.
 */
function buyCheapestProducer(state: GameState, index: ContentIndex): boolean {
  let best: { id: string; cost: Decimal; resource: 'ore' | 'alloy' | 'compute' } | null = null;

  for (const building of index.content.buildings) {
    if (building.capacity) continue; // depots are the Load Balancer's job
    if (building.output.rate <= 0) continue;
    if (!isSatisfied(building.unlock, state)) continue;

    const owned = state.buildings[building.id] ?? 0;
    const cost = costOf(building, owned);
    if (state.resources[building.cost.resource].lt(cost)) continue;
    if (best === null || cost.lt(best.cost)) {
      best = { id: building.id, cost, resource: building.cost.resource };
    }
  }

  if (best === null) return false;
  state.resources[best.resource] = state.resources[best.resource].sub(best.cost);
  state.buildings[best.id] = (state.buildings[best.id] ?? 0) + 1;
  return true;
}

/** A depot, but only for a resource actually close to overflowing. */
function buyNeededDepot(state: GameState, index: ContentIndex, cache: RateCache): boolean {
  const caps = cache.get(state).caps;

  for (const resource of index.content.resources) {
    const cap = caps.get(resource.id);
    if (!cap || !cap.isPositive) continue;
    if (state.resources[resource.id].lt(cap.mulNumber(OVERFLOW_MARGIN))) continue;

    for (const depot of index.depotsOf.get(resource.id) ?? []) {
      if (!isSatisfied(depot.unlock, state)) continue;
      const owned = state.buildings[depot.id] ?? 0;
      const cost = costOf(depot, owned);
      if (state.resources[depot.cost.resource].lt(cost)) continue;

      state.resources[depot.cost.resource] = state.resources[depot.cost.resource].sub(cost);
      state.buildings[depot.id] = owned + 1;
      return true;
    }
  }
  return false;
}

/** The cheapest upgrade currently affordable. */
function buyCheapestUpgrade(state: GameState, index: ContentIndex): boolean {
  let best: { id: string; cost: Decimal; resource: 'ore' | 'alloy' | 'compute' } | null = null;

  for (const upgrade of availableUpgrades(state, index)) {
    const cost = Decimal.from(upgrade.cost.amount);
    if (state.resources[upgrade.cost.resource].lt(cost)) continue;
    if (best === null || cost.lt(best.cost)) {
      best = { id: upgrade.id, cost, resource: upgrade.cost.resource };
    }
  }

  if (best === null) return false;
  state.resources[best.resource] = state.resources[best.resource].sub(best.cost);
  state.upgrades.push(best.id);
  return true;
}
