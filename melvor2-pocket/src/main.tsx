import { render } from 'preact';
import { contentLoaded, loadContent, tryGet } from './engine/content';
import { loadStoredAssets, loadStoredContent } from './save';
import { loadAssetPack } from './art/assets';
import { actionSound, levelUpSound, loadSoundPack, playSound, questSound, setMusicMood, unlockAudioOnFirstTap, weaponSound, type MusicMood } from './audio/sound';
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

/** Optional sound and music packs: stored in this browser, or served next to a local build. */
async function findSounds(): Promise<void> {
  const { loadStoredBlob } = await import('./save');
  for (const which of ['sounds', 'music'] as const) {
    try {
      let blob = await loadStoredBlob(which);
      if (!blob) {
        const res = await fetch(`./game-${which}.pack`);
        if (res.ok) blob = await res.blob();
      }
      if (blob) await loadSoundPack(blob, which);
    } catch {
      // No pack: that part stays silent.
    }
  }
}

/** After being hidden this long, coming back shows the welcome-back summary. */
const OFFLINE_AFTER_HIDDEN_MS = 3000;

async function startGame() {
  await Promise.all([findAssets(), findSounds()]);
  unlockAudioOnFirstTap();
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

  // One loop drives everything while the game is on screen. As soon as it's hidden the loop stops, and on return the
  // whole time away is run as offline progress (with its summary), not as a trickle of throttled background ticks.
  setInterval(() => {
    if (document.hidden) return;
    const summary = game.catchUp();
    if (summary) setOffline(summary);
    game.emit();
  }, LOOP_MS);
  setInterval(persist, AUTOSAVE_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      const settled = game.catchUp(); // settle up to the moment you left
      if (settled) setOffline(settled);
      persist();
      return;
    }
    const summary = game.catchUp(Date.now(), OFFLINE_AFTER_HIDDEN_MS);
    if (summary) setOffline(summary);
    game.emit();
  });
  window.addEventListener('pagehide', persist);

  const draw = () => render(<App game={game} offline={offline} onCloseOffline={() => setOffline(null)} onSave={persist} />, root);
  game.subscribe(draw);
  // Music follows combat: its own playlist while fighting, the boss track against an enemy that names one.
  // Between spawns the mood holds, so a dungeon boss's track doesn't restart each wave.
  let mood: MusicMood = 'NonCombat';
  game.subscribe(() => {
    if (game.state.active?.skill !== 'Combat') mood = 'NonCombat';
    else {
      const enemy = game.state.combat.enemy;
      if (enemy) mood = tryGet<{ OverrideMusicTrack?: string | null }>('Enemy', enemy)?.OverrideMusicTrack ? 'Boss' : 'Combat';
      else if (mood === 'NonCombat') mood = 'Combat';
    }
    setMusicMood(mood);
  });
  game.events.add((e) => {
    if (e.type === 'action' && e.skill !== 'Combat') {
      const r = game.handler(e.skill).recipe(e.recipe) as { Category?: string; Location?: string };
      playSound(actionSound(e.skill, r));
    } else if (e.type === 'attack') playSound(weaponSound(e.weaponType));
    else if (e.type === 'levelUp') playSound(levelUpSound(e.skill));
    else if (e.type === 'questComplete') playSound(questSound());
  });
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
