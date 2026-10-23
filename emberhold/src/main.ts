import './styles/main.css';
import { newGame } from './game/core';
import { applyOffline, type OfflineReport } from './game/offline';
import { loadAtlas } from './sprites/atlas';
import { loadLocal, saveLocal } from './state/persistence';
import { App } from './ui/app';

async function boot(): Promise<void> {
  const root = document.getElementById('app')!;
  await loadAtlas();
  const now = Date.now();
  let state = loadLocal();
  let offline: OfflineReport | null = null;
  const fresh = !state;
  if (state) {
    offline = applyOffline(state, (now - state.savedAt) / 1000);
  } else {
    state = newGame((Math.random() * 2 ** 31) | 0, now);
  }
  saveLocal(state, now);
  const app = new App(root, state, offline, fresh);
  // A handle for the browser checks in scripts/verify-ui.ts.
  (window as unknown as { __emberhold: unknown }).__emberhold = app.state;
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  }
}

boot().catch((err: unknown) => {
  console.error(err);
  document.getElementById('app')!.innerHTML = '<p class="fatal">The embers went out. Reload to try again.</p>';
});
