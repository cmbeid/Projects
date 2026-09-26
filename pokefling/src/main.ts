import './style.css';

import { busGains, cry, loadCries, setMuted, setVolumes, sfx, suspend, unlock } from './audio';
import { playMusic, preloadMusic } from './audio/music';
import { AREAS } from './data/areas';
import { nextLevel, type LevelDef } from './data/levels';
import { MENU_TRACK } from './data/music';
import { ITEM_ICONS, LAUNCHERS, TARGETS } from './data/roster';
import { loadItemIcons, loadSprites } from './render/sprites';
import {
  addItem, loadProgress, markFound, recordWin, saveProgress, takeItem, type Progress, type Volumes,
} from './state/save';
import { h } from './ui/dom';
import { levelTrack, PlayScreen, type Outcome } from './ui/play';
import { levelSelect, pauseMenu, resultPanel, settingsModal, titleScreen, type ResultInfo } from './ui/screens';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('missing #app');
const app: HTMLElement = root;

let progress: Progress = loadProgress();
setMuted(progress.muted);
setVolumes(progress.volumes);
let play: PlayScreen | null = null;
let modal: HTMLElement | null = null;

function update(next: Progress): void {
  progress = next;
  saveProgress(progress);
}

function show(screen: HTMLElement): void {
  closeModal();
  play?.stop();
  play = null;
  app.replaceChildren(screen);
}

function openModal(el: HTMLElement): void {
  closeModal();
  modal = el;
  app.append(el);
}

function closeModal(): void {
  modal?.remove();
  modal = null;
}

function click(fn: () => void): () => void {
  return () => {
    unlock();
    sfx.click();
    fn();
  };
}

function openSettings(then: () => void): void {
  let lastPreview = 0;
  openModal(settingsModal(progress.volumes, {
    change: (volumes: Volumes, which) => {
      setVolumes(volumes);
      progress = { ...progress, volumes };
      // Let the player hear what they are setting, without a wall of noise.
      const now = performance.now();
      if (now - lastPreview < 350) return;
      lastPreview = now;
      if (which === 'sfx') sfx.preview();
      else if (which === 'cries') cry(LAUNCHERS.pikachu.dex, { volume: 0.4 });
    },
    done: click(() => {
      update(progress);
      closeModal();
      then();
    }),
  }));
}

function showTitle(): void {
  playMusic(MENU_TRACK);
  show(titleScreen(progress, {
    play: click(showLevels),
    toggleMute: () => {
      unlock();
      update({ ...progress, muted: !progress.muted });
      setMuted(progress.muted);
      showTitle();
    },
    settings: click(() => openSettings(() => undefined)),
    click: () => {
      unlock();
      sfx.click();
    },
  }));
}

function showLevels(): void {
  playMusic(MENU_TRACK);
  show(levelSelect(progress, { pick: (level) => click(() => void startLevel(level))(), back: click(showTitle) }));
}

/** Everything a level draws or plays, so it can be fetched before the level starts. */
function levelAssets(level: LevelDef): { arts: string[]; dexes: number[] } {
  const defs = [...level.launchers.map((k) => LAUNCHERS[k]), ...level.targets.map((t) => TARGETS[t.kind])];
  return { arts: [...new Set(defs.map((d) => d.art))], dexes: [...new Set(defs.map((d) => d.dex))] };
}

async function startLevel(level: LevelDef): Promise<void> {
  const { arts, dexes } = levelAssets(level);
  loadCries(dexes);
  preloadMusic([levelTrack(level)]);
  // Only show a loading screen if the sprites are not already cached.
  const loading = window.setTimeout(() => show(h('div.loading', {}, 'Loading…')), 120);
  await loadSprites(arts);
  window.clearTimeout(loading);

  show(document.createElement('div'));
  const screen: PlayScreen = new PlayScreen(level, {
    onPause: () => openModal(pauseMenu({
      resume: click(() => {
        closeModal();
        screen.resume();
      }),
      restart: click(() => {
        closeModal();
        screen.restart();
      }),
      settings: click(() => openSettings(() => screen.pause())),
      levels: click(showLevels),
    })),
    onFinish: (outcome) => finish(level, screen, outcome),
    bagCount: (item) => progress.bag[item] ?? 0,
    spendItem: (item) => update(takeItem(progress, item)),
  });
  app.replaceChildren(screen.el);
  play = screen;
  screen.start();
}

function finish(level: LevelDef, screen: PlayScreen, outcome: Outcome): void {
  const before = progress.best[level.id]?.score ?? 0;
  const firstClear = outcome.won && progress.best[level.id] === undefined;
  const gained: ResultInfo['gained'] = [];
  let next = progress;

  // A hidden item is kept whether or not the level was won, but only once.
  if (outcome.collected && !next.found.includes(level.id)) {
    next = markFound(addItem(next, outcome.collected), level.id);
    gained.push({ item: outcome.collected, count: 1, why: 'Found hidden' });
  }
  if (firstClear) {
    const count = level.index === 6 ? 2 : 1;
    next = addItem(next, level.reward, count);
    gained.push({ item: level.reward, count, why: level.index === 6 ? `Beat ${AREAS[level.area]!.name}` : 'First clear' });
  }
  if (outcome.won) next = recordWin(next, level.id, outcome.score, outcome.stars);
  update(next);

  const following = nextLevel(level);
  openModal(resultPanel({
    won: outcome.won,
    score: outcome.score,
    stars: outcome.stars,
    best: Math.max(before, outcome.won ? outcome.score : 0),
    newBest: outcome.won && outcome.score > before,
    hasNext: following !== undefined,
    gained,
  }, {
    next: click(() => {
      if (following) void startLevel(following);
    }),
    retry: click(() => {
      closeModal();
      screen.restart();
    }),
    levels: click(showLevels),
  }));
}

window.addEventListener('resize', () => play?.resize());
document.addEventListener('visibilitychange', () => {
  const hidden = document.visibilityState === 'hidden';
  if (hidden) play?.pause();
  suspend(hidden);
});

// For scripts/verify-ui.ts, which checks the volume sliders reach the mixer.
(window as unknown as { __busGains: typeof busGains }).__busGains = busGains;

preloadMusic([MENU_TRACK]);
void Promise.all([loadSprites(['25', '52']), loadItemIcons(ITEM_ICONS)]).then(showTitle);
