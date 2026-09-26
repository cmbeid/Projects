/**
 * The menus: title, level select, settings, pause and results. Plain DOM
 * overlays; the canvas is only ever on screen inside a level.
 */
import { AREAS } from '../data/areas';
import { LEVEL_ORDER, levelsInArea, type LevelDef } from '../data/levels';
import { ITEMS, itemUrl, spriteUrl, TARGETS, type ItemKey } from '../data/roster';
import { isUnlocked, totalStars, type Progress, type Volumes } from '../state/save';
import { h, starsRow } from './dom';
import { fullscreenButton } from './fullscreen';

export function titleScreen(
  progress: Progress,
  actions: { play(): void; toggleMute(): void; settings(): void; click(): void },
): HTMLElement {
  const mute = h('button.icon-button', {
    'aria-label': progress.muted ? 'Unmute' : 'Mute',
    onclick: actions.toggleMute,
  }, progress.muted ? '🔇' : '🔊');
  const gear = h('button.icon-button', { 'aria-label': 'Settings', onclick: actions.settings }, '⚙️');
  return h('div.screen.title-screen', {},
    h('div.title-art', {},
      h('img.title-mon.left', { src: spriteUrl('25'), alt: '' }),
      h('img.title-mon.right', { src: spriteUrl('52'), alt: '' }),
    ),
    h('h1.logo', {}, 'Poké', h('span', {}, 'Fling')),
    h('p.tagline', {}, 'Pull back. Let go. Knock them out.'),
    h('button.primary.big', { onclick: actions.play }, 'Play'),
    h('p.total-stars', {}, `★ ${totalStars(progress, LEVEL_ORDER)} / ${LEVEL_ORDER.length * 3}`),
    h('div.corner', {}, fullscreenButton('icon-button', actions.click), gear, mute),
  );
}

export function levelSelect(
  progress: Progress,
  actions: { pick(level: LevelDef): void; back(): void },
): HTMLElement {
  const sections = AREAS.map((area, index) => {
    const levels = levelsInArea(index);
    const ids = levels.map((l) => l.id);
    const open = isUnlocked(progress, LEVEL_ORDER, ids[0]!);
    const boss = TARGETS[area.boss];
    return h('section.area', { className: `area area-${area.theme}${open ? '' : ' locked'}` },
      h('header.area-head', {},
        h('img.area-icon', { src: spriteUrl(boss.art), alt: '' }),
        h('div.area-title', {},
          h('h2', {}, area.name),
          h('p', {}, `${area.region} · ${area.blurb}`),
        ),
        h('span.area-stars', {}, `★ ${totalStars(progress, ids)}/${ids.length * 3}`),
      ),
      h('div.level-grid', {}, ...levels.map((level) => {
        const unlocked = isUnlocked(progress, LEVEL_ORDER, level.id);
        const best = progress.best[level.id];
        const boss = level.index === 6;
        return h('button.level-tile', {
          className: `level-tile${unlocked ? '' : ' locked'}${boss ? ' boss' : ''}`,
          disabled: !unlocked,
          'data-level': level.id,
          'aria-label': unlocked ? `${area.name} ${level.index}, ${level.name}` : `${area.name} ${level.index}, locked`,
          onclick: () => actions.pick(level),
        },
        h('span.level-num', {}, unlocked ? (boss ? '👑' : String(level.index)) : '🔒'),
        starsRow(best?.stars ?? 0, 3, 'sm'));
      })),
    );
  });
  const screen = h('div.screen.levels-screen', {},
    h('header.bar', {},
      h('button.icon-button', { 'aria-label': 'Back', onclick: actions.back }, '‹'),
      h('h1', {}, 'Choose a level'),
      h('span.total-stars', {}, `★ ${totalStars(progress, LEVEL_ORDER)}`),
    ),
    h('div.worlds', {}, ...sections),
  );
  // Open at the newest level the player can reach.
  requestAnimationFrame(() => {
    const tiles = [...screen.querySelectorAll<HTMLButtonElement>('.level-tile:not(.locked)')];
    tiles[tiles.length - 1]?.scrollIntoView({ block: 'center' });
  });
  return screen;
}

export function settingsModal(
  volumes: Volumes,
  actions: { change(next: Volumes, which: keyof Volumes): void; done(): void },
): HTMLElement {
  let current = { ...volumes };
  const slider = (key: keyof Volumes, label: string): HTMLElement => {
    const value = h('output.slider-value', {}, `${current[key]}`);
    const input = h('input', {
      type: 'range', min: '0', max: '100', step: '1', value: String(current[key]), 'aria-label': label,
      oninput: (e: Event) => {
        const v = Number((e.target as HTMLInputElement).value);
        current = { ...current, [key]: v };
        value.textContent = String(v);
        actions.change(current, key);
      },
    });
    return h('label.slider', {}, h('span.slider-label', {}, label), input, value);
  };
  return h('div.modal-backdrop', {},
    h('div.modal.settings', { role: 'dialog', 'aria-label': 'Settings' },
      h('h2', {}, 'Settings'),
      slider('music', 'Music'),
      slider('cries', 'Pokémon cries'),
      slider('sfx', 'Sound effects'),
      h('button.primary', { onclick: actions.done }, 'Done'),
    ),
  );
}

export function pauseMenu(actions: { resume(): void; restart(): void; settings(): void; levels(): void }): HTMLElement {
  return h('div.modal-backdrop', {},
    h('div.modal', { role: 'dialog', 'aria-label': 'Paused' },
      h('h2', {}, 'Paused'),
      h('button.primary', { onclick: actions.resume }, 'Resume'),
      h('button', { onclick: actions.restart }, 'Restart'),
      h('button', { onclick: actions.settings }, 'Settings'),
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
  /** Items gained this attempt: the hidden one, and the first-clear reward. */
  gained: { item: ItemKey; count: number; why: string }[];
}

export function resultPanel(info: ResultInfo, actions: { next(): void; retry(): void; levels(): void }): HTMLElement {
  const heading = info.won ? 'Level cleared!' : 'Out of Pokémon!';
  const buttons = [
    h('button', { onclick: actions.levels, 'aria-label': 'Levels' }, '☰'),
    h('button', { className: info.won ? '' : 'primary', onclick: actions.retry, 'aria-label': 'Retry' }, '↻'),
  ];
  if (info.won && info.hasNext) buttons.push(h('button.primary', { onclick: actions.next }, 'Next ›'));
  const gained = info.gained.length
    ? h('ul.gained', {}, ...info.gained.map((g) => h('li', {},
      h('img.item-icon', { src: itemUrl(g.item), alt: '' }),
      h('span', {}, `${ITEMS[g.item].name}${g.count > 1 ? ` ×${g.count}` : ''}`),
      h('small', {}, g.why),
    )))
    : null;
  return h('div.modal-backdrop', {},
    h('div.modal.result', { className: `modal result ${info.won ? 'won' : 'lost'}`, role: 'dialog', 'aria-label': heading },
      h('h2', {}, heading),
      info.won ? starsRow(info.stars, 3, 'lg') : h('p.lost-art', {}, h('img', { src: spriteUrl('52'), alt: '' })),
      h('p.result-score', {}, info.score.toLocaleString('en-US')),
      h('p.result-best', {}, info.newBest ? 'New best!' : `Best ${info.best.toLocaleString('en-US')}`),
      gained,
      h('div.row', {}, ...buttons),
    ),
  );
}
