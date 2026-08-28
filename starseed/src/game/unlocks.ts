import { Decimal } from '../num/decimal';
import type { Automation, Building, Resource, Unlock, Upgrade } from '../data/types';
import type { ContentIndex } from '../data/indexes';
import type { GameState } from '../state/types';

/**
 * Gates are evaluated against lifetime totals, never current stock. Spending a
 * resource must not hide content the player has already been shown — that reads
 * as a bug every single time.
 */
export function isSatisfied(unlock: Unlock, state: GameState): boolean {
  switch (unlock.kind) {
    case 'always':
      return true;
    case 'lifetime':
      return state.lifetime[unlock.resource].gte(Decimal.from(unlock.amount));
    case 'buildings':
      return (state.buildings[unlock.building] ?? 0) >= unlock.count;
    case 'upgrade':
      return state.upgrades.includes(unlock.upgrade);
    case 'automation':
      return state.automation.includes(unlock.automation);
    case 'all':
      return unlock.of.every((inner) => isSatisfied(inner, state));
  }
}

export function visibleResources(state: GameState, index: ContentIndex): Resource[] {
  return index.content.resources.filter((r) => isSatisfied(r.unlock, state));
}

export function visibleBuildings(state: GameState, index: ContentIndex): Building[] {
  return index.content.buildings.filter((b) => isSatisfied(b.unlock, state));
}

/** Unbought upgrades whose gate is open. Owned ones leave the list. */
export function availableUpgrades(state: GameState, index: ContentIndex): Upgrade[] {
  const owned = new Set(state.upgrades);
  return index.content.upgrades.filter((u) => !owned.has(u.id) && isSatisfied(u.unlock, state));
}

export function availableAutomation(state: GameState, index: ContentIndex): Automation[] {
  const owned = new Set(state.automation);
  return index.content.automation.filter((a) => !owned.has(a.id) && isSatisfied(a.unlock, state));
}

/** Milestones newly reached this tick. The caller records them. */
export function newMilestones(state: GameState, index: ContentIndex): string[] {
  const reached = new Set(state.milestones);
  return index.content.milestones
    .filter((m) => !reached.has(m.id) && isSatisfied(m.condition, state))
    .map((m) => m.id);
}
