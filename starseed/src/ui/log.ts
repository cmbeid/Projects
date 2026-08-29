import { formatCount, formatDecimal, formatDuration } from '../num/format';
import type { Store } from '../state/store';
import type { Ticker } from './ticker';
import { el } from './ticker';

/**
 * The narrative feed, the milestone checklist, and a few run statistics.
 *
 * Two different things read the same unlock machinery: a milestone is "you
 * got here", shown as a short pip, while a log entry is "here is what that
 * meant" — the fragment worth reading, not just checking off. Log entries
 * never toast; they are found by opening this panel, not interrupted for.
 */
export function renderLog(store: Store, ticker: Ticker, mount: HTMLElement): void {
  mount.replaceChildren();

  mount.append(el('h2', 'panel-title', 'Log'));

  const unlocked = new Set(store.get().log);
  const fragments = store.index.content.log.filter((entry) => unlocked.has(entry.id)).reverse();

  if (fragments.length === 0) {
    mount.append(el('p', 'empty', 'Nothing has happened yet. Mine something.'));
  } else {
    const feed = el('div', 'log-feed');
    for (const fragment of fragments) {
      const entry = el('div', 'log-entry');
      entry.append(el('div', 'log-name', fragment.title));
      entry.append(el('div', 'log-blurb', fragment.text));
      feed.append(entry);
    }
    mount.append(feed);
  }

  mount.append(el('h2', 'panel-title', 'Milestones'));

  const reached = new Set(store.get().milestones);
  const milestones = store.index.content.milestones.filter((m) => reached.has(m.id)).reverse();

  if (milestones.length > 0) {
    const list = el('ul', 'milestone-list');
    for (const milestone of milestones) {
      list.append(el('li', 'milestone-item', `${milestone.name} — ${milestone.blurb}`));
    }
    mount.append(list);
  }

  const remaining = store.index.content.milestones.length - milestones.length;
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

  // Split run from all-time the moment prestige exists: after a Relaunch,
  // `lifetime` is what *this* run has made, and labelling it "all time" would
  // read as progress being lost.
  line('Time played', () => formatDuration(store.get().stats.playedSeconds));
  line('This run', () => formatDuration(store.get().stats.runSeconds));
  line('Taps', () => formatCount(store.get().stats.taps));
  line('Ore, this run', () => formatDecimal(store.get().lifetime.ore));
  line('Alloy, this run', () => formatDecimal(store.get().lifetime.alloy));
  line('Compute, this run', () => formatDecimal(store.get().lifetime.compute));

  if (store.get().prestige.relaunches > 0) {
    line('Ore, all time', () => formatDecimal(store.get().totals.ore));
    line('Alloy, all time', () => formatDecimal(store.get().totals.alloy));
    line('Compute, all time', () => formatDecimal(store.get().totals.compute));
    line('Relaunches', () => formatCount(store.get().prestige.relaunches));
    line('Schematics earned', () => formatDecimal(store.get().prestige.schematicsEarned));
  }
  mount.append(stats);
}
