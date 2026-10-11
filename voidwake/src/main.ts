import '@fontsource/silkscreen/400.css';
import './styles/main.css';
import { newGame } from './game/engine';
import { loadAtlas } from './sprites/atlas';
import { loadLocal, saveLocal } from './state/persistence';
import { App } from './ui/app';

async function boot(): Promise<void> {
  const root = document.getElementById('app')!;
  await Promise.all([loadAtlas(), document.fonts?.ready]);
  const now = Date.now();
  const state = loadLocal() ?? newGame((Math.random() * 2 ** 31) | 0, now);
  saveLocal(state, now);
  new App(root, state);
  // A handle for the browser checks in scripts/verify-ui.ts.
  (window as unknown as { __voidwake: unknown }).__voidwake = state;
}

boot().catch((err: unknown) => {
  console.error(err);
  document.getElementById('app')!.innerHTML = '<p class="fatal">The Wren failed to wake. Reload to try again.</p>';
});
