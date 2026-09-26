/**
 * The menus: title, level select, pause and results. Plain DOM overlays; the
 * canvas is only ever on screen inside a level.
 */
import { LEVELS, WORLDS, type LevelDef } from '../data/levels';
import { spriteUrl } from '../data/roster';
import { isUnlocked, totalStars, type Progress } from '../state/save';
import { h, starsRow } from './dom';

export function titleScreen(progress: Progress, actions: { play(): void; toggleMute(): void }): HTMLElement {
  const mute = h('button.icon-button', {
    'aria-label': progress.muted ? 'Unmute' : 'Mute',
    onclick: actions.toggleMute,
  }, progress.muted ? '🔇' : '🔊');
  const stars = totalStars(progress);
  return h('div.screen.title-screen', {},
    h('div.title-art', {},
      h('img.title-mon.left', { src: spriteUrl(25), alt: '' }),
      h('img.title-mon.right', { src: spriteUrl(52), alt: '' }),
    ),
    h('h1.logo', {}, 'Poké', h('span', {}, 'Fling')),
    h('p.tagline', {}, 'Pull back. Let go. Knock them out.'),
    h('button.primary.big', { onclick: actions.play }, 'Play'),
    h('p.total-stars', {}, `★ ${stars} / ${LEVELS.length * 3}`),
    h('div.corner', {}, mute),
  );
}

export function levelSelect(
  progress: Progress,
  actions: { pick(level: LevelDef): void; back(): void },
): HTMLElement {
  const worlds = WORLDS.map((name, world) => {
    const levels = LEVELS.filter((l) => l.world === world);
    return h('section.world', {},
      h('h2', {}, name),
      h('div.level-grid', {}, ...levels.map((level) => {
        const open = isUnlocked(progress, level.id);
        const best = progress.best[level.id];
        return h('button.level-tile', {
          className: `level-tile world-${world}${open ? '' : ' locked'}`,
          disabled: !open,
          'aria-label': open ? `Level ${level.id}, ${level.name}` : `Level ${level.id}, locked`,
          onclick: () => actions.pick(level),
        },
        h('span.level-num', {}, open ? String(level.id) : '🔒'),
        starsRow(best?.stars ?? 0, 3, 'sm'));
      })),
    );
  });
  return h('div.screen.levels-screen', {},
    h('header.bar', {},
      h('button.icon-button', { 'aria-label': 'Back', onclick: actions.back }, '‹'),
      h('h1', {}, 'Choose a level'),
      h('span.total-stars', {}, `★ ${totalStars(progress)}`),
    ),
    h('div.worlds', {}, ...worlds),
  );
}

export function pauseMenu(actions: { resume(): void; restart(): void; levels(): void }): HTMLElement {
  return h('div.modal-backdrop', {},
    h('div.modal', { role: 'dialog', 'aria-label': 'Paused' },
      h('h2', {}, 'Paused'),
      h('button.primary', { onclick: actions.resume }, 'Resume'),
      h('button', { onclick: actions.restart }, 'Restart'),
      h('button', { onclick: actions.levels }, 'Levels'),
    ),
  );
}

export interface ResultInfo {
  won: boolean;
  score: number;
  stars: number;
  best: number;
  newBest: boolean;
  hasNext: boolean;
}

export function resultPanel(info: ResultInfo, actions: { next(): void; retry(): void; levels(): void }): HTMLElement {
  const heading = info.won ? 'Level cleared!' : 'Out of Pokémon!';
  const buttons = [
    h('button', { onclick: actions.levels, 'aria-label': 'Levels' }, '☰'),
    h('button', { className: info.won ? '' : 'primary', onclick: actions.retry, 'aria-label': 'Retry' }, '↻'),
  ];
  if (info.won && info.hasNext) buttons.push(h('button.primary', { onclick: actions.next }, 'Next ›'));
  return h('div.modal-backdrop', {},
    h('div.modal.result', { className: `modal result ${info.won ? 'won' : 'lost'}`, role: 'dialog', 'aria-label': heading },
      h('h2', {}, heading),
      info.won ? starsRow(info.stars, 3, 'lg') : h('p.lost-art', {}, h('img', { src: spriteUrl(52), alt: '' })),
      h('p.result-score', {}, info.score.toLocaleString('en-US')),
      h('p.result-best', {}, info.newBest ? 'New best!' : `Best ${info.best.toLocaleString('en-US')}`),
      h('div.row', {}, ...buttons),
    ),
  );
}
