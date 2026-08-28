import { formatDecimal, formatRate } from '../num/format';
import { Decimal } from '../num/decimal';
import type { Store } from '../state/store';
import type { Ticker } from './ticker';
import { el } from './ticker';

/**
 * The resource rail: what you have, what it holds, and how fast it is moving.
 *
 * Rebuilt only when a resource unlocks. Everything inside is bound, so the
 * numbers move without the DOM being rebuilt.
 */
export function renderResources(store: Store, ticker: Ticker, mount: HTMLElement): void {
  mount.replaceChildren();

  for (const id of store.visibleResourceIds()) {
    const resource = store.index.content.resources.find((r) => r.id === id);
    if (!resource) continue;

    const row = el('div', 'resource');
    row.append(el('span', 'resource-icon', resource.emoji));

    const body = el('div', 'resource-body');
    const top = el('div', 'resource-top');
    const amount = el('span', 'resource-amount');
    const cap = el('span', 'resource-cap');
    top.append(amount, cap);

    const rate = el('div', 'resource-rate');
    body.append(top, rate);
    row.append(body);

    ticker.text(amount, () => formatDecimal(store.get().resources[id]));
    ticker.text(cap, () => ` / ${formatDecimal(store.rates().caps.get(id) ?? Decimal.ZERO)}`);
    ticker.text(rate, () => {
      const rates = store.rates();
      const gross = rates.output.get(id) ?? Decimal.ZERO;
      const spent = rates.input.get(id) ?? Decimal.ZERO;
      const net = gross.sub(spent);
      // Consumption is shown alongside the net rate, because "why is my ore
      // going down" is the first question era 2 raises.
      return spent.isPositive
        ? `${formatRate(net)}  (${formatDecimal(gross)} − ${formatDecimal(spent)})`
        : formatRate(net);
    });

    // Full storage is the thing the player most needs to notice.
    ticker.flag(row, 'is-full', () => {
      const capacity = store.rates().caps.get(id);
      return capacity !== undefined && store.get().resources[id].gte(capacity);
    });

    mount.append(row);
  }

  const heat = el('div', 'heat');
  const heatValue = el('span', 'heat-value');
  heat.append(el('span', 'heat-label', '🌡️ Thermal load '), heatValue);
  ticker.text(heatValue, () => {
    const rates = store.rates();
    const penalty = Math.round(rates.heatPenalty * 100);
    return penalty >= 100
      ? `${Math.round(rates.heat)} — nominal`
      : `${Math.round(rates.heat)} — running at ${penalty}%`;
  });
  ticker.flag(heat, 'is-hot', () => store.rates().heatPenalty < 1);
  mount.append(heat);
}
