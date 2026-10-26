import { render } from 'preact';
import { contentLoaded, loadContent } from './engine/content';
import { loadStoredAssets, loadStoredContent } from './save';
import { loadAssetPack } from './art/assets';
import { DataLoader } from './ui/DataLoader';
import './ui/styles.css';

const AUTOSAVE_MS = 10_000;
const LOOP_MS = 100;
const root = document.getElementById('app')!;

// Local builds made next to a Steam install bundle data/content.json; deployed builds have none and load it at runtime.
const bundled = import.meta.glob('../data/content.json', { import: 'default' });

async function findContent(): Promise<boolean> {
  const local = Object.values(bundled)[0];
  const data = local ? await local() : await loadStoredContent();
  if (!data) return false;
  try {
    loadContent(data);
  } catch {
    return false;
  }
  return contentLoaded();
}

/** Game images: stored in this browser, or served next to a local build (build:local copies the pack into dist). */
async function findAssets(): Promise<void> {
  try {
    let blob = await loadStoredAssets();
    if (!blob) {
      const res = await fetch('./game-assets.pack');
      if (res.ok) blob = await res.blob();
    }
    if (blob) await loadAssetPack(blob);
  } catch {
    // No pack, or a bad one: the generated art is used.
  }
}

async function startGame() {
  await findAssets();
  // The engine and UI read game data, so they load only once it's in place.
  const [{ Game }, { load, save }, { App }] = await Promise.all([import('./engine/game'), import('./save'), import('./ui/App')]);
  type Summary = ReturnType<InstanceType<typeof Game>['catchUp']>;
  const state = await load();
  const game = new Game(state ?? undefined);
  let offline: Summary = game.catchUp();
  const setOffline = (s: Summary) => {
    offline = s;
    draw();
  };

  const persist = () => save(game.state).catch((e) => console.error('save failed', e));

  // One loop drives everything. If the browser suspended the tab, the next catchUp sees the gap as offline time.
  setInterval(() => {
    const summary = game.catchUp();
    if (summary) setOffline(summary);
    game.emit();
  }, LOOP_MS);
  setInterval(persist, AUTOSAVE_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persist();
  });
  window.addEventListener('pagehide', persist);

  const draw = () => render(<App game={game} offline={offline} onCloseOffline={() => setOffline(null)} onSave={persist} />, root);
  game.subscribe(draw);
  draw();
}

async function boot() {
  if (await findContent()) await startGame();
  else render(<DataLoader onLoaded={() => location.reload()} />, root);

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

boot();
