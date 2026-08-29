import './styles/base.css';
import './styles/rail.css';
import './styles/panels.css';
import './styles/prestige.css';

import { createStore } from './state/store';
import { Layout } from './ui/layout';
import { toast } from './ui/toast';
import { showWelcomeBack } from './ui/modal';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('missing #app');

const store = createStore();
const layout = new Layout(store, root);
const ticker = layout.mount();

// Catch-up runs once, at load, inside the store's constructor — this only
// decides whether it is worth interrupting the player to say so.
const offlineSummary = store.takeOfflineSummary();
if (offlineSummary) showWelcomeBack(offlineSummary, store.index);

/**
 * The one place in the app that reads a clock. Everything below `advance` takes
 * time as a parameter, which is what keeps the engine testable and lets offline
 * catch-up reuse the identical code path in phase 6.
 */
ticker.start((delta) => {
  const report = store.advance(delta);
  for (const id of report.milestonesCrossed) {
    const milestone = store.index.content.milestones.find((m) => m.id === id);
    if (milestone) toast(`${milestone.name} — ${milestone.blurb}`);
  }
});

// Saving is debounced, so a tab that goes away needs a final flush or the last
// couple of seconds of progress are lost.
window.addEventListener('pagehide', () => store.flush());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    store.flush();
    return;
  }
  // rAF does not fire in a hidden tab, so a run left open in the background
  // is otherwise frozen until reloaded. Coming back into view is exactly the
  // moment to catch it up, the same way loading a fresh save does.
  const summary = store.resume();
  if (summary) showWelcomeBack(summary, store.index);
});
