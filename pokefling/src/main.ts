import './style.css';

import { setMuted, sfx, unlock } from './audio';
import { LEVELS, type LevelDef } from './data/levels';
import { loadSprites } from './render/sprites';
import { loadProgress, recordWin, saveProgress, type Progress } from './state/save';
import { PlayScreen, type Outcome } from './ui/play';
import { levelSelect, pauseMenu, resultPanel, titleScreen } from './ui/screens';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('missing #app');
const app: HTMLElement = root;

let progress: Progress = loadProgress();
setMuted(progress.muted);
let play: PlayScreen | null = null;
let modal: HTMLElement | null = null;

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

function showTitle(): void {
  show(titleScreen(progress, {
    play: click(showLevels),
    toggleMute: () => {
      progress = { ...progress, muted: !progress.muted };
      setMuted(progress.muted);
      saveProgress(progress);
      showTitle();
    },
  }));
}

function showLevels(): void {
  show(levelSelect(progress, { pick: (level) => click(() => startLevel(level))(), back: click(showTitle) }));
}

function startLevel(level: LevelDef): void {
  show(document.createElement('div'));
  const screen = new PlayScreen(level, {
    onPause: () => openModal(pauseMenu({
      resume: click(() => {
        closeModal();
        screen.resume();
      }),
      restart: click(() => {
        closeModal();
        screen.restart();
      }),
      levels: click(showLevels),
    })),
    onFinish: (outcome) => finish(level, screen, outcome),
  });
  app.replaceChildren(screen.el);
  play = screen;
  screen.start();
}

function finish(level: LevelDef, screen: PlayScreen, outcome: Outcome): void {
  const before = progress.best[level.id]?.score ?? 0;
  if (outcome.won) {
    progress = recordWin(progress, level.id, outcome.score, outcome.stars);
    saveProgress(progress);
  }
  const next = LEVELS.find((l) => l.id === level.id + 1);
  openModal(resultPanel({
    won: outcome.won,
    score: outcome.score,
    stars: outcome.stars,
    best: Math.max(before, outcome.won ? outcome.score : 0),
    newBest: outcome.won && outcome.score > before,
    hasNext: next !== undefined,
  }, {
    next: click(() => {
      if (next) startLevel(next);
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
  if (document.visibilityState === 'hidden') play?.pause();
});

void loadSprites().then(showTitle);
