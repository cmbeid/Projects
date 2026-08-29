import type { Content, Unlock } from './types';
import { RESOURCE_IDS } from './types';

export interface ValidationReport {
  errors: string[];
  warnings: string[];
  stats: {
    resources: number;
    buildings: number;
    upgrades: number;
    automation: number;
    milestones: number;
    byEra: Map<number, number>;
  };
}

/**
 * The content gate. Pure, so `npm test` and `npm run validate` run identically.
 *
 * Errors are things that would ship a broken game — a reference to something
 * that does not exist, or a gate no player could ever pass. Warnings are things
 * that are probably a mistake but still playable.
 */
export function validateContent(content: Content): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  const resourceIds = new Set(content.resources.map((r) => r.id));
  const buildingIds = new Set(content.buildings.map((b) => b.id));
  const upgradeIds = new Set(content.upgrades.map((u) => u.id));
  const automationIds = new Set(content.automation.map((a) => a.id));

  duplicates(content.resources.map((r) => r.id)).forEach((id) =>
    errors.push(`duplicate resource id "${id}"`),
  );
  duplicates(content.buildings.map((b) => b.id)).forEach((id) =>
    errors.push(`duplicate building id "${id}"`),
  );
  duplicates(content.upgrades.map((u) => u.id)).forEach((id) =>
    errors.push(`duplicate upgrade id "${id}"`),
  );
  duplicates(content.automation.map((a) => a.id)).forEach((id) =>
    errors.push(`duplicate automation id "${id}"`),
  );

  for (const id of RESOURCE_IDS) {
    if (!resourceIds.has(id)) errors.push(`resource "${id}" is declared in types but has no entry`);
  }

  const checkUnlock = (where: string, unlock: Unlock): void => {
    switch (unlock.kind) {
      case 'always':
        return;
      case 'lifetime':
        if (!resourceIds.has(unlock.resource)) {
          errors.push(`${where}: unlock names unknown resource "${unlock.resource}"`);
        }
        if (unlock.amount <= 0) warnings.push(`${where}: lifetime unlock of ${unlock.amount} is always true`);
        return;
      case 'buildings':
        if (!buildingIds.has(unlock.building)) {
          errors.push(`${where}: unlock names unknown building "${unlock.building}"`);
        }
        return;
      case 'upgrade':
        if (!upgradeIds.has(unlock.upgrade)) {
          errors.push(`${where}: unlock names unknown upgrade "${unlock.upgrade}"`);
        }
        return;
      case 'automation':
        if (!automationIds.has(unlock.automation)) {
          errors.push(`${where}: unlock names unknown automation "${unlock.automation}"`);
        }
        return;
      case 'all':
        unlock.of.forEach((inner) => checkUnlock(where, inner));
        return;
    }
  };

  for (const resource of content.resources) {
    checkUnlock(`resource "${resource.id}"`, resource.unlock);
    if (resource.baseCap <= 0) errors.push(`resource "${resource.id}" has a non-positive base cap`);
  }

  for (const building of content.buildings) {
    const where = `building "${building.id}"`;
    checkUnlock(where, building.unlock);

    if (!resourceIds.has(building.output.resource)) {
      errors.push(`${where}: outputs unknown resource "${building.output.resource}"`);
    }
    if (!resourceIds.has(building.cost.resource)) {
      errors.push(`${where}: priced in unknown resource "${building.cost.resource}"`);
    }
    for (const input of building.inputs) {
      if (!resourceIds.has(input.resource)) {
        errors.push(`${where}: consumes unknown resource "${input.resource}"`);
      }
      if (input.rate <= 0) errors.push(`${where}: input rate must be positive`);
    }
    if (building.capacity && !resourceIds.has(building.capacity.resource)) {
      errors.push(`${where}: stores unknown resource "${building.capacity.resource}"`);
    }

    // A flat or shrinking cost curve makes a building free at scale, which
    // ends the game the moment anyone notices.
    if (building.cost.growth <= 1) {
      errors.push(`${where}: cost growth ${building.cost.growth} is not greater than 1`);
    }
    if (building.cost.base <= 0) errors.push(`${where}: cost base must be positive`);
    if (building.output.rate === 0 && !building.capacity) {
      errors.push(`${where}: produces nothing and stores nothing`);
    }
    if (building.heat < 0) errors.push(`${where}: negative heat`);

    // A converter that eats more than it makes of the same resource is a
    // guaranteed net loss and cannot be intentional.
    for (const input of building.inputs) {
      if (input.resource === building.output.resource && input.rate >= building.output.rate) {
        errors.push(`${where}: consumes at least as much "${input.resource}" as it produces`);
      }
    }
  }

  for (const upgrade of content.upgrades) {
    const where = `upgrade "${upgrade.id}"`;
    checkUnlock(where, upgrade.unlock);
    if (!resourceIds.has(upgrade.cost.resource)) {
      errors.push(`${where}: priced in unknown resource "${upgrade.cost.resource}"`);
    }
    if (upgrade.cost.amount <= 0) errors.push(`${where}: cost must be positive`);
    if (upgrade.effects.length === 0) errors.push(`${where}: has no effects`);

    for (const effect of upgrade.effects) {
      switch (effect.kind) {
        case 'additive':
        case 'multiplier':
          if (!buildingIds.has(effect.building)) {
            errors.push(`${where}: effect names unknown building "${effect.building}"`);
          }
          if (effect.kind === 'multiplier' && effect.factor <= 1) {
            warnings.push(`${where}: multiplier of ${effect.factor} is not an improvement`);
          }
          break;
        case 'global':
        case 'capacity':
          if (!resourceIds.has(effect.resource)) {
            errors.push(`${where}: effect names unknown resource "${effect.resource}"`);
          }
          if (effect.factor <= 1) {
            warnings.push(`${where}: factor of ${effect.factor} is not an improvement`);
          }
          break;
        case 'cooling':
          if (effect.factor <= 0 || effect.factor >= 1) {
            errors.push(`${where}: cooling factor must be between 0 and 1`);
          }
          break;
        case 'tap':
          if (effect.factor <= 1) warnings.push(`${where}: tap factor is not an improvement`);
          break;
      }
    }
  }

  for (const automation of content.automation) {
    const where = `automation "${automation.id}"`;
    checkUnlock(where, automation.unlock);
    if (!resourceIds.has(automation.cost.resource)) {
      errors.push(`${where}: priced in unknown resource "${automation.cost.resource}"`);
    }
    if (automation.cost.amount <= 0) errors.push(`${where}: cost must be positive`);
  }

  for (const milestone of content.milestones) {
    checkUnlock(`milestone "${milestone.id}"`, milestone.condition);
  }

  errors.push(...unreachable(content));

  const byEra = new Map<number, number>();
  for (const building of content.buildings) {
    byEra.set(building.era, (byEra.get(building.era) ?? 0) + 1);
  }

  return {
    errors,
    warnings,
    stats: {
      resources: content.resources.length,
      buildings: content.buildings.length,
      upgrades: content.upgrades.length,
      automation: content.automation.length,
      milestones: content.milestones.length,
      byEra,
    },
  };
}

/**
 * Walks the unlock graph forward from a new game and reports anything it can
 * never reach.
 *
 * Content is only reachable if the things its gate names are themselves
 * reachable, so this repeatedly sweeps until nothing new opens up. Anything
 * still closed after that is either gated on itself or on a cycle.
 */
function unreachable(content: Content): string[] {
  const reachableBuildings = new Set<string>();
  const reachableUpgrades = new Set<string>();
  const reachableAutomation = new Set<string>();
  const producible = new Set<string>();

  const satisfiable = (unlock: Unlock): boolean => {
    switch (unlock.kind) {
      case 'always':
        return true;
      case 'lifetime':
        return producible.has(unlock.resource);
      case 'buildings':
        return reachableBuildings.has(unlock.building);
      case 'upgrade':
        return reachableUpgrades.has(unlock.upgrade);
      case 'automation':
        return reachableAutomation.has(unlock.automation);
      case 'all':
        return unlock.of.every(satisfiable);
    }
  };

  let changed = true;
  while (changed) {
    changed = false;
    for (const building of content.buildings) {
      if (reachableBuildings.has(building.id) || !satisfiable(building.unlock)) continue;
      reachableBuildings.add(building.id);
      if (building.output.rate > 0) producible.add(building.output.resource);
      changed = true;
    }
    for (const upgrade of content.upgrades) {
      if (reachableUpgrades.has(upgrade.id) || !satisfiable(upgrade.unlock)) continue;
      reachableUpgrades.add(upgrade.id);
      changed = true;
    }
    for (const automation of content.automation) {
      if (reachableAutomation.has(automation.id) || !satisfiable(automation.unlock)) continue;
      reachableAutomation.add(automation.id);
      changed = true;
    }
  }

  const errors: string[] = [];
  for (const building of content.buildings) {
    if (!reachableBuildings.has(building.id)) {
      errors.push(`building "${building.id}" can never be unlocked`);
    }
  }
  for (const upgrade of content.upgrades) {
    if (!reachableUpgrades.has(upgrade.id)) {
      errors.push(`upgrade "${upgrade.id}" can never be unlocked`);
    }
  }
  for (const automation of content.automation) {
    if (!reachableAutomation.has(automation.id)) {
      errors.push(`automation "${automation.id}" can never be unlocked`);
    }
  }
  for (const milestone of content.milestones) {
    if (!satisfiable(milestone.condition)) {
      errors.push(`milestone "${milestone.id}" can never be reached`);
    }
  }
  return errors;
}

function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) dupes.add(id);
    seen.add(id);
  }
  return [...dupes];
}
