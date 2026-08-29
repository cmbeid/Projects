import { Decimal } from '../num/decimal';
import { formatCount, formatDecimal } from '../num/format';
import { RESOURCE_IDS } from '../data/types';
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

    // Two lines, in the order the decision is made: what pressing this button
    // would add, then what the stack is already doing.
    const effect = el('div', 'building-effect');
    card.append(effect);

    const owns = el('div', 'building-owned');
    card.append(owns);

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
      const marginal = store.marginal(building.id);
      if (!marginal) return '';

      // Net rates, so a converter's feedstock draw and any thermal drag it puts
      // on the rest of the swarm arrive as one honest number per resource.
      //
      // The building's own resource leads, then the rest of the ladder. Sorting
      // gains first instead reads well until it doesn't: a converter bought into
      // an overheated swarm can *lower* the resource it exists to make while
      // raising another, and burying that under a "+" is the one thing this line
      // must not do.
      const own = building.capacity?.resource ?? building.output.resource;
      const order = [own, ...RESOURCE_IDS.filter((id) => id !== own)];

      const parts: string[] = [];
      for (const id of order) {
        const change = marginal.net.get(id) ?? Decimal.ZERO;
        if (change.isPositive) parts.push(`+${formatDecimal(change)} ${id}/s`);
        else if (!change.isZero) parts.push(`−${formatDecimal(change.neg())} ${id}/s`);

        const stored = marginal.caps.get(id) ?? Decimal.ZERO;
        if (stored.isPositive) parts.push(`+${formatDecimal(stored)} ${id} storage`);
      }

      const buying = marginal.count > 1 ? `×${marginal.count} adds ` : 'adds ';
      // Net rates can land on exactly zero — a purchase whose thermal drag
      // cancels its own output. Rare, but "adds" followed by nothing is worse.
      return parts.length > 0 ? buying + parts.join(' · ') : 'adds nothing measurable';
    });

    ticker.text(owns, () => {
      const owned = store.get().buildings[building.id] ?? 0;
      if (owned === 0) return '';

      const entry = store.rates().perBuilding.find((r) => r.building.id === building.id);
      if (building.capacity) {
        const held = Decimal.from(building.capacity.amount * owned);
        return `${formatCount(owned)} holding ${formatDecimal(held)} ${building.capacity.resource}`;
      }
      if (!entry) return '';

      const drawn = entry.inputs
        .map((flow) => `−${formatDecimal(flow.rate)} ${flow.resource}/s`)
        .join(' · ');
      const making = `now ${formatDecimal(entry.output)} ${building.output.resource}/s`;
      return drawn ? `${making} · ${drawn}` : making;
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
