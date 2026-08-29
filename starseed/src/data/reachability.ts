import type { Content, Unlock } from './types';
import { DIRECTIVE_SLOTS } from './packs/05-prestige';

/**
 * "Can a player actually get there?" — separate from `validate.ts`, which asks
 * only whether the tables are internally consistent.
 *
 * Both produce errors for the same report, but they fail for different reasons:
 * a dangling id is a typo, whereas an unreachable unlock is usually a design
 * mistake in the gates themselves, and the two want reading apart.
 */
export function reachabilityErrors(content: Content): string[] {
  return [...unreachable(content), ...loadoutErrors(content)];
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
  const reachablePerks = new Set<string>();
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
      // A player can always relaunch again, so the only question a relaunch
      // gate raises is whether the perk behind it is buyable.
      case 'relaunches':
        return true;
      case 'perk':
        return reachablePerks.has(unlock.perk);
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
    // Perks gate only on other perks, so this sweep also catches a cycle in
    // `requires` — a pair that each name the other never becomes reachable.
    for (const perk of content.perks) {
      if (reachablePerks.has(perk.id)) continue;
      if (!perk.requires.every((id) => reachablePerks.has(id))) continue;
      reachablePerks.add(perk.id);
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
  for (const entry of content.log) {
    if (!satisfiable(entry.unlock)) {
      errors.push(`log entry "${entry.id}" can never be unlocked`);
    }
  }
  for (const perk of content.perks) {
    if (!reachablePerks.has(perk.id)) {
      errors.push(`perk "${perk.id}" can never be bought — its requirements cycle`);
    }
  }
  for (const directive of content.directives) {
    if (!satisfiable(directive.unlock)) {
      errors.push(`directive "${directive.id}" can never be unlocked`);
    }
  }
  return errors;
}

/**
 * A loadout the player cannot legally fill is the one content bug in this
 * layer that would strand them at the prestige screen with no way forward.
 *
 * Directives are exclusive by family, so filling three slots needs three
 * families open at the moment of the *first* Relaunch — when nothing gated on
 * having already relaunched, or on a perk, is available yet.
 */
function loadoutErrors(content: Content): string[] {
  const errors: string[] = [];
  const atFirstRelaunch = content.directives.filter((d) => d.unlock.kind === 'always');
  const families = new Set(atFirstRelaunch.map((d) => d.family));

  if (families.size < DIRECTIVE_SLOTS) {
    errors.push(
      `only ${families.size} directive famil${families.size === 1 ? 'y' : 'ies'} are open at the ` +
        `first Relaunch, which cannot fill ${DIRECTIVE_SLOTS} slots`,
    );
  }
  return errors;
}
