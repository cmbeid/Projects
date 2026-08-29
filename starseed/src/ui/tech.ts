import { formatDecimal } from '../num/format';
import { Decimal } from '../num/decimal';
import type { ContentIndex } from '../data/indexes';
import type { Effect } from '../data/types';
import type { Store } from '../state/store';
import type { Ticker } from './ticker';
import { el } from './ticker';

/**
 * The Tech panel: upgrades on top, then the automation ladder.
 *
 * Automation is given its own section and names what it retires, because "you
 * never have to tap again" is the actual reward and burying it in a list of
 * percentage bonuses wastes it.
 */
export function renderTech(store: Store, ticker: Ticker, mount: HTMLElement): void {
  mount.replaceChildren();

  const upgrades = store.availableUpgrades();
  mount.append(el('h2', 'panel-title', 'Upgrades'));

  if (upgrades.length === 0) {
    mount.append(el('p', 'empty', 'Nothing new to research. Build more.'));
  } else {
    const list = el('div', 'upgrade-list');
    for (const upgrade of upgrades) {
      const card = el('button', 'upgrade');
      card.type = 'button';
      card.addEventListener('click', () => store.buyUpgrade(upgrade.id));

      const head = el('div', 'upgrade-head');
      head.append(el('span', 'upgrade-icon', upgrade.emoji));
      head.append(el('span', 'upgrade-name', upgrade.name));
      const resource = store.index.content.resources.find((r) => r.id === upgrade.cost.resource);
      head.append(
        el(
          'span',
          'upgrade-price',
          `${formatDecimal(Decimal.from(upgrade.cost.amount))} ${resource?.emoji ?? ''}`,
        ),
      );
      card.append(head);
      card.append(el('div', 'upgrade-blurb', upgrade.blurb));
      for (const effect of upgrade.effects) {
        card.append(el('div', 'upgrade-effect', describeEffect(effect, store.index)));
      }

      ticker.flag(card, 'is-affordable', () =>
        store.get().resources[upgrade.cost.resource].gte(Decimal.from(upgrade.cost.amount)),
      );
      list.append(card);
    }
    mount.append(list);
  }

  const owned = store.get().automation;
  const available = store.availableAutomation();
  if (owned.length === 0 && available.length === 0) return;

  mount.append(el('h2', 'panel-title', 'Automation'));

  for (const id of owned) {
    const automation = store.index.automationById.get(id);
    if (!automation) continue;

    const row = el('div', 'automation owned');
    const head = el('div', 'automation-head');
    head.append(el('span', 'automation-icon', automation.emoji));
    head.append(el('span', 'automation-name', automation.name));

    const toggle = el('button', 'automation-toggle');
    toggle.type = 'button';
    toggle.addEventListener('click', () => store.toggleAutomation(id));
    ticker.text(toggle, () => (store.get().automationOn[id] === false ? 'Off' : 'On'));
    ticker.flag(toggle, 'is-on', () => store.get().automationOn[id] !== false);
    head.append(toggle);

    row.append(head);
    row.append(el('div', 'automation-retires', `Retired: ${automation.retires}`));
    mount.append(row);
  }

  for (const automation of available) {
    const card = el('button', 'automation');
    card.type = 'button';
    card.addEventListener('click', () => store.buyAutomation(automation.id));

    const head = el('div', 'automation-head');
    head.append(el('span', 'automation-icon', automation.emoji));
    head.append(el('span', 'automation-name', automation.name));
    const resource = store.index.content.resources.find((r) => r.id === automation.cost.resource);
    head.append(
      el(
        'span',
        'automation-price',
        `${formatDecimal(Decimal.from(automation.cost.amount))} ${resource?.emoji ?? ''}`,
      ),
    );
    card.append(head);
    card.append(el('div', 'automation-blurb', automation.blurb));
    card.append(el('div', 'automation-retires', `Retires: ${automation.retires}`));

    ticker.flag(card, 'is-affordable', () =>
      store.get().resources[automation.cost.resource].gte(Decimal.from(automation.cost.amount)),
    );
    mount.append(card);
  }
}

/** What an upgrade actually does, in the same terms `rates.ts` computes it in. */
function describeEffect(effect: Effect, index: ContentIndex): string {
  switch (effect.kind) {
    case 'additive': {
      const building = index.buildingById.get(effect.building);
      return `+${Math.round(effect.amount * 100)}% ${building?.name ?? effect.building} output`;
    }
    case 'multiplier': {
      const building = index.buildingById.get(effect.building);
      return `${formatPercent(effect.factor)} ${building?.name ?? effect.building} output`;
    }
    case 'global': {
      const resource = index.content.resources.find((r) => r.id === effect.resource);
      return `${formatPercent(effect.factor)} ${resource?.name ?? effect.resource} production`;
    }
    case 'capacity': {
      const resource = index.content.resources.find((r) => r.id === effect.resource);
      return `${formatPercent(effect.factor)} ${resource?.name ?? effect.resource} storage`;
    }
    case 'cooling':
      return `${formatPercent(effect.factor)} heat generated`;
    case 'tap':
      return `${formatPercent(effect.factor)} tap yield`;
  }
}

/** A factor as the percent change it represents: 2 → "+100%", 0.8 → "-20%". */
function formatPercent(factor: number): string {
  const pct = Math.round((factor - 1) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}
