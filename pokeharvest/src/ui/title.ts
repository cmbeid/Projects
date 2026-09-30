/** The title screen, and picking a starter for a new farm. */
import { cry, loadCries } from '../audio/index';
import { JOB_TEXT, STARTERS, species } from '../data/species';
import { TYPE_COLOURS } from '../data/types';
import { createWorld, type World } from '../game/world';
import { loadSprite } from './preview';
import { clearSave, loadWorld } from '../state/save';
import { show } from './app';
import { h } from './dom';
import { fullscreenButton } from './fullscreen';

export function titleScreen(start: (world: World, isNew: boolean) => void): void {
  const saved = loadWorld();
  const starters = h('div.title-mons', {}, ...STARTERS.map((dex, i) => loadSprite(dex, 2, `title-mon d${i}`)));
  show(h('main.title', {},
    h('div.title-top', {}, fullscreenButton('icon-btn')),
    h('div.logo', {}, h('span.logo-poke', {}, 'Poké'), h('span.logo-harvest', {}, 'Harvest')),
    h('p.tagline', {}, 'Grow berries. Raise a farm. With a little help from your Pokémon.'),
    starters,
    h('div.title-buttons', {},
      saved ? h('button.btn.primary.big', { onclick: () => start(saved, false) }, `Continue · Day ${saved.day}`) : null,
      h('button', { className: saved ? 'btn big' : 'btn primary big', onclick: () => starterScreen(start, Boolean(saved)) }, 'New farm'),
    ),
    h('p.credit', {}, 'A fan-made game. Pokémon © Nintendo / Creatures / GAME FREAK.'),
  ));
}

function starterScreen(start: (world: World, isNew: boolean) => void, overwriting: boolean): void {
  loadCries(STARTERS);
  const cards = STARTERS.map((dex) => {
    const sp = species(dex);
    const type = sp.types[0]!;
    return h('button.starter', {
      style: `--type:${TYPE_COLOURS[type]}`,
      onclick: () => {
        cry(dex, { volume: 0.6 });
        if (overwriting) clearSave();
        start(createWorld(Math.floor(Math.random() * 2 ** 31), dex), true);
      },
    },
    loadSprite(dex, 3, 'starter-img'),
    h('div.starter-name', {}, sp.name),
    h('div.types', {}, ...sp.types.map((t) => h('span.type', { style: `background:${TYPE_COLOURS[t]}` }, t))),
    h('div.starter-job', {}, JOB_TEXT[sp.job]));
  });
  show(h('main.pick', {},
    h('h1', {}, 'Choose a partner'),
    h('p.tagline', {}, 'Your first Pokémon will live on the farm and lend a hand with the work.'),
    overwriting ? h('p.warn', {}, 'Starting a new farm replaces the one you have.') : null,
    h('div.starters', {}, ...cards),
    h('button.btn', { onclick: () => titleScreen(start) }, 'Back'),
  ));
}
