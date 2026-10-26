// Progression gating: the demo unlocks skill pages, Combat, the Bank, the Shop and Quests through "navigation option"
// requirements (e.g. Combat needs a crafted Stone Sword and 10 cooked Shrimp). Once met, an unlock stays.
import { NS, all, displayName, itemName, type Requirement } from './content';
import type { Game } from './game';

export interface NavOption { Id: string; DisplayName?: string; Requirements: Requirement[] | null }

const NAV_TYPES = ['SkillNavigationOption', 'CombatNavigationOption', 'BankNavigationOption', 'ShopNavigationOption', 'QuestsNavigationOption'];

let navCache: Map<string, NavOption> | null = null;
function navs(): Map<string, NavOption> {
  if (!navCache) {
    navCache = new Map();
    for (const t of NAV_TYPES) for (const o of all<NavOption>(t)) navCache.set(o.Id, o);
  }
  return navCache;
}

/** Combat's skills (and their tiles) open with the Combat page. */
const COMBAT_SKILLS = ['Attack', 'Strength', 'Defence', 'Hitpoints', 'Ranged', 'Magic', 'Prayer', 'Slayer'];
const navFor = (page: string) => (COMBAT_SKILLS.includes(page) ? 'Combat' : page);

export function navRequirements(page: string): Requirement[] {
  return navs().get(navFor(page))?.Requirements ?? [];
}

export function isDemoLockedPage(game: Game, page: string): boolean {
  return game.isDemoLocked(navRequirements(page));
}

/** Whether a page (skill, 'Combat', 'Bank', 'Shop', 'Quests') is open. Pages the demo doesn't gate are always open. */
export function isUnlocked(game: Game, page: string): boolean {
  const id = navFor(page);
  if (!navs().has(id)) return true;
  return !!game.state.unlocked[id];
}

/** Record any newly met unlocks. Returns true if something unlocked. */
export function checkUnlocks(game: Game): boolean {
  let changed = false;
  for (const [id, nav] of navs()) {
    if (game.state.unlocked[id] || game.isDemoLocked(nav.Requirements)) continue;
    if (!game.requirementsMet(nav.Requirements)) continue;
    game.state.unlocked[id] = true;
    changed = true;
    game.notice(`Unlocked: ${id === 'Combat' ? 'Combat' : id}!`);
  }
  return changed;
}

/** Saves from before progression gating keep access to everything the demo offers. */
export function unlockEverything(game: Game): void {
  for (const [id, nav] of navs()) if (!game.isDemoLocked(nav.Requirements)) game.state.unlocked[id] = true;
}

const words = (id: string) => id.replace(NS, '').replace(/([a-z])([A-Z])/g, '$1 $2');

/** Plain-language requirement, with progress where it's a count. */
export function describeRequirement(game: Game, r: Requirement): { text: string; done: boolean } {
  const d = r.Data as Record<string, unknown> & { Component?: { Entity: string } };
  const done = game.requirementMet(r);
  const type = r.Type.replace(NS, '');
  const value = Number(d.Value ?? 1);
  switch (type) {
    case 'Level': {
      const skill = (d.Component?.Entity ?? '').replace(NS, '');
      return { text: `${skill} level ${d.Level} (now ${game.level(skill)})`, done };
    }
    case 'ItemStatistic': {
      const item = String(d.Item);
      const stat = String(d.Statistic).replace(NS, '');
      const have = game.itemStatistic(stat, item);
      const from = stat === 'BankItemFound' ? '' : ` from ${stat.replace('ItemGained', '')}`;
      return { text: `${stat === 'BankItemFound' ? 'Find' : 'Get'} ${value} ${itemName(item, value)}${from} (${Math.min(have, value)}/${value})`, done };
    }
    case 'CurrencyStatistic':
      return { text: `Sell items for ${value.toLocaleString()} gold (${Math.min(game.state.stats.goldFromSales, value).toLocaleString()}/${value.toLocaleString()})`, done };
    case 'EnemyStatistic': {
      const enemy = String(d.Enemy);
      const have = game.state.combat.kills[enemy] ?? 0;
      return { text: `Defeat ${value} ${displayName('Enemy', enemy)} (${Math.min(have, value)}/${value})`, done };
    }
    case 'HuntingAnimalStatistic': {
      const animal = String(d.Animal);
      const have = game.state.hunting[animal]?.trapped ?? 0;
      return { text: `Trap ${value} ${displayName('HuntingAnimal', animal)} (${Math.min(have, value)}/${value})`, done };
    }
    case 'DemoLocked':
      return { text: 'Not available in the demo', done: false };
    default:
      return { text: words(r.Type), done };
  }
}
