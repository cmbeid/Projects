import { formatCount, formatDecimal, formatDuration } from '../num/format';
import type { Store } from '../state/store';
import type { Ticker } from './ticker';
import { el } from './ticker';

/**
 * Milestones reached, newest first, plus a few run statistics.
 *
 * Phase 5 hangs the narrative log off the same milestone conditions, which is
 * why this panel is already shaped as a feed rather than a checklist.
 */
export function renderLog(store: Store, ticker: Ticker, mount: HTMLElement): void {
  mount.replaceChildren();

  mount.append(el('h2', 'panel-title', 'Log'));

  const reached = new Set(store.get().milestones);
  const entries = store.index.content.milestones.filter((m) => reached.has(m.id)).reverse();

  if (entries.length === 0) {
    mount.append(el('p', 'empty', 'Nothing has happened yet. Mine something.'));
  } else {
    const feed = el('div', 'log-feed');
    for (const milestone of entries) {
      const entry = el('div', 'log-entry');
      entry.append(el('div', 'log-name', milestone.name));
      entry.append(el('div', 'log-blurb', milestone.blurb));
      feed.append(entry);
    }
    mount.append(feed);
  }

  const remaining = store.index.content.milestones.length - entries.length;
  mount.append(
    el('p', 'log-remaining', remaining > 0 ? `${remaining} still ahead of you.` : 'All reached.'),
  );

  mount.append(el('h2', 'panel-title', 'Statistics'));
  const stats = el('dl', 'stats');
  const line = (label: string, read: () => string): void => {
    stats.append(el('dt', undefined, label));
    const value = el('dd');
    ticker.text(value, read);
    stats.append(value);
  };

  line('Time played', () => formatDuration(store.get().stats.playedSeconds));
  line('Taps', () => formatCount(store.get().stats.taps));
  line('Ore, all time', () => formatDecimal(store.get().lifetime.ore));
  line('Alloy, all time', () => formatDecimal(store.get().lifetime.alloy));
  line('Compute, all time', () => formatDecimal(store.get().lifetime.compute));
  mount.append(stats);
}
