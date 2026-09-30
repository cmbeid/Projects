/** What's in each sheet: the Poké Mart, the shipping bin, the bag, bedtime and the morning report. */
import { sfx } from '../audio/index';
import { CROPS, crop } from '../data/crops';
import { ITEMS, MART_STOCK, item } from '../data/items';
import { JOB_TEXT, species } from '../data/species';
import { binValue, buy, martPrice, sellNow, ship, unship } from '../game/economy';
import type { DaySummary, World } from '../game/model';
import { clockText, dayOfSeason, seasonOf } from '../game/time';
import { select } from '../game/world';
import { h } from './dom';
import { itemIcon } from './icons';
import { loadSprite } from './preview';
import { closeSheet, openSheet } from './sheet';

type Changed = () => void;

function gold(n: number): string {
  return `${n.toLocaleString('en')}g`;
}

function sellables(world: World): string[] {
  return [...ITEMS.values()].filter((i) => i.kind === 'crop' && (world.inventory[i.id] ?? 0) > 0).map((i) => i.id);
}

function row(icon: HTMLElement, name: string, detail: string, ...actions: (HTMLElement | null)[]): HTMLElement {
  return h('div.row', {}, icon, h('div.row-text', {}, h('div.row-name', {}, name), h('div.row-detail', {}, detail)), h('div.row-actions', {}, ...actions));
}

function button(label: string, onclick: () => void, disabled = false, cls = ''): HTMLButtonElement {
  return h('button', { className: `btn ${cls}`, disabled, onclick }, label);
}

function empty(text: string): HTMLElement {
  return h('p.empty', {}, text);
}

export function openMart(host: HTMLElement, world: World, changed: Changed): void {
  let tab: 'buy' | 'sell' = 'buy';
  openSheet(host, 'Poké Mart', (body, refresh) => {
    const tabs = h('div.tabs', {},
      button('Buy seeds', () => { tab = 'buy'; refresh(); }, false, tab === 'buy' ? 'tab on' : 'tab'),
      button('Sell now', () => { tab = 'sell'; refresh(); }, false, tab === 'sell' ? 'tab on' : 'tab'));
    body.append(h('div.wallet', {}, `You have ${gold(world.player.gold)}`), tabs);
    const done = (ok: boolean, sound: () => void): void => {
      (ok ? sound : sfx.deny)();
      changed();
      refresh();
    };
    if (tab === 'buy') {
      for (const id of MART_STOCK) {
        const def = item(id);
        const c = crop(def.crop!);
        const price = def.buyPrice!;
        const detail = `${gold(price)} · ripe in ${c.days} days${c.regrow ? `, then every ${c.regrow}` : ''} · sells for ${gold(c.sellPrice)}`;
        body.append(row(itemIcon(id), def.name, detail,
          button('×1', () => done(buy(world, id, 1), sfx.coin), world.player.gold < price),
          button('×5', () => done(buy(world, id, 5), sfx.coin), world.player.gold < price * 5)));
      }
    } else {
      const ids = sellables(world);
      if (!ids.length) body.append(empty('Nothing to sell. Harvest some berries first!'));
      body.append(h('p.note', {}, 'The Mart pays on the spot, but the shipping bin pays full price overnight.'));
      for (const id of ids) {
        const n = world.inventory[id]!;
        body.append(row(itemIcon(id), `${item(id).name} ×${n}`, `${gold(martPrice(id))} each here`,
          button('Sell 1', () => done(sellNow(world, id, 1), sfx.sell)),
          button('All', () => done(sellNow(world, id, n), sfx.sell))));
      }
    }
  });
}

export function openBin(host: HTMLElement, world: World, changed: Changed): void {
  openSheet(host, 'Shipping bin', (body, refresh) => {
    const act = (ok: boolean): void => {
      (ok ? sfx.click : sfx.deny)();
      changed();
      refresh();
    };
    body.append(h('p.note', {}, 'Everything in the bin is collected overnight and paid for in full.'));
    const ids = sellables(world);
    body.append(h('h3', {}, 'In your bag'));
    if (!ids.length) body.append(empty('No berries to ship yet.'));
    for (const id of ids) {
      const n = world.inventory[id]!;
      body.append(row(itemIcon(id), `${item(id).name} ×${n}`, `${gold(item(id).sellPrice)} each`,
        button('Ship 1', () => act(ship(world, id, 1))),
        button('All', () => act(ship(world, id, n)), false, 'primary')));
    }
    const binned = Object.entries(world.bin);
    body.append(h('h3', {}, `In the bin · ${gold(binValue(world.bin))} tonight`));
    if (!binned.length) body.append(empty('The bin is empty.'));
    for (const [id, n] of binned) {
      body.append(row(itemIcon(id), `${item(id).name} ×${n}`, gold(item(id).sellPrice * n), button('Take back', () => act(unship(world, id, 1)))));
    }
  });
}

export function openBag(host: HTMLElement, world: World, changed: Changed): void {
  openSheet(host, 'Bag', (body, refresh) => {
    const p = world.player;
    body.append(h('div.stats', {},
      stat('Gold', gold(p.gold)), stat('Energy', `${p.energy}/${p.maxEnergy}`), stat('Can', `${p.water}/20`), stat('Harvested', String(world.stats.harvested))));
    const helpers = world.helpers.map((hp) => {
      const sp = species(hp.dex);
      return h('div.helper-card', {}, loadSprite(hp.dex, 1, 'helper-img'), h('div', {}, h('b', {}, sp.name), h('div.row-detail', {}, JOB_TEXT[sp.job])));
    });
    body.append(h('h3', {}, 'Helpers'), ...helpers);
    body.append(h('h3', {}, 'Items'));
    const owned = Object.entries(world.inventory);
    if (!owned.length) body.append(empty('Your bag is empty.'));
    for (const [id, n] of owned) {
      const def = item(id);
      const action = def.kind === 'seed'
        ? button(world.selected === id ? 'In hand' : 'Hold', () => { select(world, id); changed(); refresh(); }, world.selected === id)
        : null;
      const detail = def.kind === 'seed' ? `Plant on tilled soil · ${crop(def.crop!).days} days` : `Ships for ${gold(def.sellPrice)}`;
      body.append(row(itemIcon(id), `${def.name} ×${n}`, detail, action));
    }
  });
}

function stat(label: string, value: string): HTMLElement {
  return h('div.stat', {}, h('div.stat-value', {}, value), h('div.stat-label', {}, label));
}

export function openSleep(host: HTMLElement, world: World, onSleep: () => void): void {
  openSheet(host, 'Farmhouse', (body) => {
    const late = world.clock >= 24 * 60;
    body.append(
      h('p', {}, `It's ${clockText(world.clock)}. Go to bed and end the day?`),
      h('p.note', {}, late ? 'It\'s past midnight, so you\'ll wake up a little tired.' : 'Anything in the shipping bin will be paid for overnight.'),
      h('div.buttons', {}, button('Not yet', closeSheet), button('Sleep', () => { closeSheet(); onSleep(); }, false, 'primary')),
    );
  });
}

export function openSummary(host: HTMLElement, s: DaySummary, next: number, onDone: () => void): void {
  openSheet(host, s.passedOut ? 'You passed out…' : `Day ${s.day} done`, (body) => {
    if (s.passedOut) body.append(h('p', {}, `You were found collapsed in the field at 2 AM and carried home. The doctor's bill came to ${gold(s.lost)}.`));
    const shipped = Object.entries(s.shipped);
    if (shipped.length) {
      body.append(h('h3', {}, 'Shipped'));
      for (const [id, n] of shipped) body.append(row(itemIcon(id), `${item(id).name} ×${n}`, gold(item(id).sellPrice * n)));
    }
    body.append(h('div.stats', {}, stat('Earned', gold(s.earned)), stat('Crops grew', String(s.grown)), stat('Now ripe', String(s.ripe))));
    if (s.crowAte) body.append(h('p.warn', {}, `A crow ate ${/^[AEIOU]/.test(s.crowAte) ? 'an' : 'a'} ${s.crowAte} plant in the night! A Fire-type helper would scare them off.`));
    if (s.dried) body.append(h('p.note', {}, `${s.dried} empty plot${s.dried > 1 ? 's' : ''} went back to grass.`));
    body.append(h('p.note', {}, `Good morning! It's ${seasonOf(next)} ${dayOfSeason(next)}.`));
    body.append(h('div.buttons', {}, button('Start the day', closeSheet, false, 'primary')));
  }, { onClose: onDone, dismissable: false });
}

export function openHelp(host: HTMLElement, onDone: () => void = () => undefined): void {
  openSheet(host, 'How to farm', (body) => {
    const tips: [string, string][] = [
      ['hoe', 'Hold the hoe and tap grass to till it.'],
      [`${CROPS[1]!.id}-seed`, 'Hold seeds and tap tilled soil to plant.'],
      ['can', 'Hold the can and tap a crop to water it. Refill it at the pond.'],
      ['sickle', 'Tap a ripe berry to pick it. The sickle clears plants and plots.'],
    ];
    for (const [id, text] of tips) body.append(h('div.tip', {}, itemIcon(id), h('span', {}, text)));
    body.append(
      h('p', {}, 'Crops grow one day for every night they spend watered. Put berries in the shipping bin by the house to sell them overnight, then buy more seeds at the Poké Mart by the gate.'),
      h('p', {}, 'Your Pokémon helps out around the farm. When you get tired, head to the farmhouse door and sleep. Stay up past 2 AM and you\'ll pass out!'),
      h('p.note', {}, 'Keyboard: WASD or arrows to walk, Space to use, 1–8 to pick a tool.'),
      h('div.buttons', {}, button("Let's farm!", closeSheet, false, 'primary')),
    );
  }, { onClose: onDone });
}
