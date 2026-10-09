import '@fontsource/jersey-10/400.css';
import '@fontsource/tiny5/400.css';
import './styles/main.css';
import { newGame } from './game/engine';
import { applyOffline, type OfflineReport } from './game/offline';
import { loadAtlas } from './sprites/atlas';
import { loadLocal, saveLocal } from './state/persistence';
import { App } from './ui/app';

async function boot(): Promise<void> {
  const root = document.getElementById('app')!;
  await Promise.all([loadAtlas(), document.fonts?.ready]);
  const now = Date.now();
  let state = loadLocal();
  let offline: OfflineReport | null = null;
  if (state) offline = applyOffline(state, (now - state.savedAt) / 1000);
  else state = newGame((Math.random() * 2 ** 31) | 0, now);
  saveLocal(state, now);
  new App(root, state, offline);
  // A handle for the browser checks in scripts/verify-ui.ts.
  (window as unknown as { __epochs: unknown }).__epochs = state;
}

boot().catch((err: unknown) => {
  console.error(err);
  document.getElementById('app')!.innerHTML = '<p class="fatal">The fire went out. Reload to try again.</p>';
});
