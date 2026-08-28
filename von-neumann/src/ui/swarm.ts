import { Decimal } from '../num/decimal';
import { formatCount, formatDecimal } from '../num/format';
import type { BuyMode } from '../state/types';
import type { Store } from '../state/store';
import { visibleBuildings } from '../game/unlocks';
import type { Ticker } from './ticker';
import { el } from './ticker';

const MODES: BuyMode[] = [1, 10, 'max'];

/** The Swarm panel: everything you can build, and the buttons that build it. */
export function renderSwarm(store: Store, ticker: Ticker, mount: HTMLElement): void {
  mount.replaceChildren();

  const modes = el('div', 'buy-modes');
  for (const mode of MODES) {
    const button = el('button', 'buy-mode', mode === 'max' ? 'Max' : `×${mode}`);
    button.type = 'button';
    button.addEventListener('click', () => store.setBuyMode(mode));
    ticker.flag(button, 'is-active', () => store.get().settings.buyMode === mode);
    modes.append(button);
  }
  mount.append(modes);

  const list = el('div', 'building-list');
  for (const building of visibleBuildings(store.get(), store.index)) {
    const card = el('button', 'building');
    card.type = 'button';
    card.addEventListener('click', () => store.buyBuilding(building.id));

    const head = el('div', 'building-head');
    head.append(el('span', 'building-icon', building.emoji));

    const naming = el('div', 'building-naming');
    naming.append(el('span', 'building-name', building.name));
    const count = el('span', 'building-count');
    naming.append(count);
    head.append(naming);

    const price = el('div', 'building-price');
    head.append(price);
    card.append(head);

    card.append(el('div', 'building-blurb', building.blurb));

    const effect = el('div', 'building-effect');
    card.append(effect);

    ticker.text(count, () => {
      const owned = store.get().buildings[building.id] ?? 0;
      return owned > 0 ? `× ${formatCount(owned)}` : '';
    });

    ticker.text(price, () => {
      const quote = store.quote(building.id);
      if (!quote) return '';
      const resource = store.index.content.resources.find((r) => r.id === building.cost.resource);
      const units = quote.count > 1 ? ` ×${quote.count}` : '';
      return `${formatDecimal(quote.cost)} ${resource?.emoji ?? ''}${units}`;
    });

    ticker.text(effect, () => {
      const owned = store.get().buildings[building.id] ?? 0;
      if (building.capacity) {
        return `+${formatDecimal(Decimal.from(building.capacity.amount))} storage each`;
      }
      const entry = store.rates().perBuilding.find((r) => r.building.id === building.id);
      const produced = entry && owned > 0 ? entry.output : Decimal.ZERO;
      const inputs = building.inputs
        .map((flow) => `−${formatDecimal(Decimal.from(flow.rate))} ${flow.resource}/s each`)
        .join(', ');
      const making = owned > 0 ? `making ${formatDecimal(produced)}/s` : `${building.output.rate}/s each`;
      return inputs ? `${making} · ${inputs}` : making;
    });

    // Affordability is the only thing here that changes fast enough to matter,
    // and 10Hz is more than enough for a button colour.
    ticker.flag(card, 'is-affordable', () => {
      const quote = store.quote(building.id);
      return quote !== null && quote.count > 0;
    });

    list.append(card);
  }
  mount.append(list);
}
