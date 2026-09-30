/** What's in each sheet: the Poké Mart, the shipping bin, the blacksmith, the bag, bedtime and the morning report. */
import { sfx } from '../audio/index';
import { CROPS, crop } from '../data/crops';
import { ITEMS, MART_STOCK, item } from '../data/items';
import { PERKS, SKILLS, SKILL_TEXT, SKILL_XP, TOOL_TEXT, UPGRADE_COSTS, type UpgradableTool } from '../data/progress';
import { JOB_TEXT, SPECIES, species } from '../data/species';
import { TYPE_COLOURS } from '../data/types';
import { move } from '../data/moves';
import { binValue, buy, martPrice, sellNow, sellPrice, ship, startUpgrade, unship, upgradeBlocker } from '../game/economy';
import { canCapacity, takeItem, toolName } from '../game/farm';
import { syncHelpers } from '../game/helpers';
import { maxHp, toggleParty, xpForLevel } from '../game/mon';
import { PARTY_SIZE, type DaySummary, type Mon, type World } from '../game/model';
import { choosePerk, levelOf } from '../game/skills';
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

/** What can go in the bin or back to the Mart: berries and materials. */
function sellables(world: World): string[] {
  return [...ITEMS.values()].filter((i) => (i.kind === 'crop' || i.kind === 'material') && (world.inventory[i.id] ?? 0) > 0).map((i) => i.id);
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

function tabs<T extends string>(current: T, options: readonly [T, string][], pick: (t: T) => void): HTMLElement {
  return h('div.tabs', {}, ...options.map(([id, label]) => button(label, () => pick(id), false, id === current ? 'tab on' : 'tab')));
}

function bar(frac: number, colour: string): HTMLElement {
  return h('div.meter', {}, h('div', { style: `width:${Math.max(0, Math.min(1, frac)) * 100}%;background:${colour}` }));
}

export function openMart(host: HTMLElement, world: World, changed: Changed): void {
  let tab: 'buy' | 'sell' = 'buy';
  openSheet(host, 'Poké Mart', (body, refresh) => {
    body.append(h('div.wallet', {}, `You have ${gold(world.player.gold)}`), tabs(tab, [['buy', 'Buy'], ['sell', 'Sell now']], (t) => { tab = t; refresh(); }));
    const done = (ok: boolean, sound: () => void): void => {
      (ok ? sound : sfx.deny)();
      changed();
      refresh();
    };
    if (tab === 'buy') {
      for (const id of MART_STOCK) {
        const def = item(id);
        const price = def.buyPrice!;
        let detail = `${gold(price)}`;
        if (def.kind === 'seed') {
          const c = crop(def.crop!);
          detail += ` · ripe in ${c.days} days${c.regrow ? `, then every ${c.regrow}` : ''} · sells for ${gold(sellPrice(world, c.id))}`;
        } else if (def.description) {
          detail += ` · ${def.description}`;
        }
        const have = world.inventory[id] ? ` (have ${world.inventory[id]})` : '';
        body.append(row(itemIcon(id), def.name + have, detail,
          button('×1', () => done(buy(world, id, 1), sfx.coin), world.player.gold < price),
          button('×5', () => done(buy(world, id, 5), sfx.coin), world.player.gold < price * 5)));
      }
    } else {
      const ids = sellables(world);
      body.append(h('p.note', {}, 'The Mart pays on the spot, but the shipping bin pays full price overnight.'));
      if (!ids.length) body.append(empty('Nothing to sell. Harvest some berries first!'));
      for (const id of ids) {
        const n = world.inventory[id]!;
        body.append(row(itemIcon(id), `${item(id).name} ×${n}`, `${gold(martPrice(world, id))} each here`,
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
    if (!ids.length) body.append(empty('Nothing to ship yet.'));
    for (const id of ids) {
      const n = world.inventory[id]!;
      body.append(row(itemIcon(id), `${item(id).name} ×${n}`, `${gold(sellPrice(world, id))} each`,
        button('Ship 1', () => act(ship(world, id, 1))),
        button('All', () => act(ship(world, id, n)), false, 'primary')));
    }
    const binned = Object.entries(world.bin);
    body.append(h('h3', {}, `In the bin · ${gold(binValue(world))} tonight`));
    if (!binned.length) body.append(empty('The bin is empty.'));
    for (const [id, n] of binned) {
      body.append(row(itemIcon(id), `${item(id).name} ×${n}`, gold(sellPrice(world, id) * n), button('Take back', () => act(unship(world, id, 1)))));
    }
  });
}

export function openSmith(host: HTMLElement, world: World, changed: Changed): void {
  openSheet(host, 'Blacksmith', (body, refresh) => {
    body.append(h('p.note', {}, 'Leave a tool here and it will be ready tomorrow morning. You can keep using the old one until then.'));
    if (world.upgrade) {
      body.append(h('p.warn.ok', {}, `Working on your ${toolName(world.upgrade.tool, world.upgrade.tier)}. Ready tomorrow morning!`));
    }
    for (const tool of ['hoe', 'can'] as UpgradableTool[]) {
      const tier = world.tools[tool];
      const cost = UPGRADE_COSTS[tier + 1];
      const blocker = upgradeBlocker(world, tool);
      body.append(h('h3', {}, toolName(tool, tier)), h('p.note', {}, `Now: ${TOOL_TEXT[tool][tier]}`));
      if (!cost) {
        body.append(h('p', {}, 'This is the finest there is.'));
        continue;
      }
      const have = world.inventory[cost.material] ?? 0;
      body.append(row(
        itemIcon(tool),
        toolName(tool, tier + 1),
        `${TOOL_TEXT[tool][tier + 1]} · ${gold(cost.gold)} + ${cost.count} ${item(cost.material).name} (have ${have})`,
        button('Upgrade', () => {
          if (startUpgrade(world, tool)) sfx.powerup();
          else sfx.deny();
          changed();
          refresh();
        }, Boolean(blocker), 'primary'),
      ));
      if (blocker && !world.upgrade) body.append(h('p.note', {}, blocker));
    }
    body.append(h('p.note', {}, 'Wild Pokémon on Route 1 drop Hard Stones, Metal Coats and Nuggets, especially Rock and Ground types.'));
  });
}

type BagTab = 'items' | 'pokemon' | 'farmer';

export function openBag(host: HTMLElement, world: World, changed: Changed, start: BagTab = 'items'): void {
  let tab: BagTab = start;
  openSheet(host, 'Bag', (body, refresh) => {
    body.append(tabs(tab, [['items', 'Items'], ['pokemon', 'Pokémon'], ['farmer', 'Farmer']], (t) => { tab = t; refresh(); }));
    if (tab === 'items') itemsTab(body, world, () => { changed(); refresh(); });
    else if (tab === 'pokemon') pokemonTab(body, world, () => { syncHelpers(world); changed(); refresh(); });
    else farmerTab(body, world);
  });
}

function stat(label: string, value: string): HTMLElement {
  return h('div.stat', {}, h('div.stat-value', {}, value), h('div.stat-label', {}, label));
}

function itemsTab(body: HTMLElement, world: World, changed: Changed): void {
  const p = world.player;
  body.append(h('div.stats', {}, stat('Gold', gold(p.gold)), stat('Energy', `${p.energy}/${p.maxEnergy}`), stat('Can', `${p.water}/${canCapacity(world)}`), stat('Harvested', String(world.stats.harvested))));
  const owned = Object.entries(world.inventory);
  if (!owned.length) body.append(empty('Your bag is empty.'));
  for (const [id, n] of owned) {
    const def = item(id);
    const action = def.kind === 'seed'
      ? button(world.selected === id ? 'In hand' : 'Hold', () => { select(world, id); changed(); }, world.selected === id)
      : null;
    const detail = def.kind === 'seed' ? `Plant on tilled soil · ${crop(def.crop!).days} days`
      : def.kind === 'crop' ? `Ships for ${gold(sellPrice(world, id))}${def.heals ? ' · heals in battle' : ' · offer it to calm wild Pokémon'}`
      : def.description ?? '';
    body.append(row(itemIcon(id), `${def.name} ×${n}`, detail, action));
  }
}

/** Oran or Sitrus, whichever heals this Pokémon without much waste. */
function berryFor(world: World, mon: Mon): string | null {
  const missing = maxHp(mon) - mon.hp;
  if (missing <= 0) return null;
  const options = ['oran', 'sitrus'].filter((id) => (world.inventory[id] ?? 0) > 0);
  return options.find((id) => id === 'oran' && missing <= 25) ?? options[0] ?? null;
}

function monCard(world: World, mon: Mon, changed: Changed): HTMLElement {
  const sp = species(mon.dex);
  const max = maxHp(mon);
  const lo = xpForLevel(mon.level);
  const inParty = world.party.includes(mon.uid);
  const berry = berryFor(world, mon);
  const actions = h('div.mon-actions', {},
    berry ? button(`Feed ${item(berry).name.replace(' Berry', '')}`, () => {
      const heal = item(berry).heals!;
      if (!takeItem(world, berry, 1)) return;
      mon.hp = Math.min(max, mon.hp + (heal < 1 ? Math.floor(max * heal) : heal));
      sfx.pickup();
      changed();
    }) : null,
    inParty
      ? button('To box', () => { if (toggleParty(world, mon.uid)) sfx.click(); else sfx.deny(); changed(); }, world.party.length <= 1)
      : button('To party', () => { if (toggleParty(world, mon.uid)) sfx.click(); else sfx.deny(); changed(); }, world.party.length >= PARTY_SIZE),
  );
  const evo = sp.evolves ? ` · evolves at Lv${sp.evolves.level}` : '';
  return h('div.mon-card', {},
    loadSprite(mon.dex, 1, 'mon-img'),
    h('div.mon-info', {},
      h('div.mon-title', {}, h('b', {}, `${sp.name}${mon.shiny ? ' ★' : ''}`), h('span', {}, `Lv${mon.level}`), ...sp.types.map((t) => h('span.type', { style: `background:${TYPE_COLOURS[t]}` }, t))),
      h('div.mon-bars', {}, h('span', {}, `HP ${mon.hp}/${max}`), bar(mon.hp / max, mon.hp / max > 0.5 ? '#48c050' : mon.hp / max > 0.2 ? '#f0b020' : '#e04030'), h('span', {}, 'XP'), bar((mon.xp - lo) / Math.max(1, xpForLevel(mon.level + 1) - lo), '#4aa0e8')),
      h('div.row-detail', {}, JOB_TEXT[sp.job] + evo),
      h('div.mon-moves', {}, ...mon.moves.map((id) => h('span.chip', { style: `border-color:${TYPE_COLOURS[move(id).type]}` }, move(id).name))),
      actions,
    ));
}

function pokemonTab(body: HTMLElement, world: World, changed: Changed): void {
  body.append(h('p.note', {}, `Up to ${PARTY_SIZE} Pokémon follow you, work the farm and battle. The rest wait in the box. Pokédex: seen ${world.seen.length}, befriended ${world.caught.length} of ${SPECIES.size}.`));
  body.append(h('h3', {}, 'Party'));
  for (const uid of world.party) {
    const mon = world.mons.find((m) => m.uid === uid);
    if (mon) body.append(monCard(world, mon, changed));
  }
  const boxed = world.mons.filter((m) => !world.party.includes(m.uid));
  body.append(h('h3', {}, `Box · ${boxed.length}`));
  if (!boxed.length) body.append(empty('Nobody in the box. Befriend wild Pokémon on Route 1, south of the farm gate.'));
  for (const mon of boxed) body.append(monCard(world, mon, changed));
}

function farmerTab(body: HTMLElement, world: World): void {
  for (const skill of SKILLS) {
    const level = levelOf(world, skill);
    const xp = world.skills[skill];
    const lo = SKILL_XP[level]!;
    const hi = SKILL_XP[level + 1];
    body.append(
      h('h3', {}, `${skill === 'farming' ? 'Farming' : 'Battling'} · Level ${level}`),
      hi === undefined ? h('p.note', {}, 'Mastered!') : bar((xp - lo) / (hi - lo), '#3f9b3a'),
      h('p.note', {}, SKILL_TEXT[skill]),
    );
    const taken = ([5, 10] as const).flatMap((lvl) => PERKS[skill][lvl].filter((p) => world.perks.includes(p.id)));
    for (const perk of taken) body.append(h('div.perk', {}, h('b', {}, perk.name), h('span', {}, perk.text)));
  }
  body.append(h('h3', {}, 'Tools'));
  body.append(h('p', {}, `${toolName('hoe', world.tools.hoe)}: ${TOOL_TEXT.hoe[world.tools.hoe]}`), h('p', {}, `${toolName('can', world.tools.can)}: ${TOOL_TEXT.can[world.tools.can]}`));
  body.append(h('p.note', {}, `Battles won: ${world.stats.wins} · Gold earned: ${gold(world.stats.earned)}`));
}

/** Pick one of two perks: not dismissable, since the choice is the point. */
export function openPerk(host: HTMLElement, world: World, onDone: () => void): void {
  const pending = world.pendingPerks[0];
  if (!pending) return;
  const [a, b] = PERKS[pending.skill][pending.level];
  openSheet(host, `${pending.skill === 'farming' ? 'Farming' : 'Battling'} level ${pending.level}!`, (body) => {
    body.append(h('p', {}, 'Choose a perk. This choice is for keeps.'));
    for (const perk of [a, b]) {
      body.append(h('button.perk-choice', {
        onclick: () => {
          choosePerk(world, perk.id);
          sfx.powerup();
          closeSheet();
        },
      }, h('b', {}, perk.name), h('span', {}, perk.text)));
    }
  }, { onClose: onDone, dismissable: false });
}

export function openSleep(host: HTMLElement, world: World, onSleep: () => void): void {
  openSheet(host, 'Farmhouse', (body) => {
    const late = world.clock >= 24 * 60;
    body.append(
      h('p', {}, `It's ${clockText(world.clock)}. Go to bed and end the day?`),
      h('p.note', {}, late ? "It's past midnight, so you'll wake up a little tired." : 'Anything in the shipping bin will be paid for overnight, and your Pokémon will be rested.'),
      h('div.buttons', {}, button('Not yet', closeSheet), button('Sleep', () => { closeSheet(); onSleep(); }, false, 'primary')),
    );
  });
}

export function openSummary(host: HTMLElement, world: World, s: DaySummary, onDone: () => void): void {
  openSheet(host, s.passedOut ? 'You passed out…' : `Day ${s.day} done`, (body) => {
    if (s.passedOut) body.append(h('p', {}, `You were found collapsed at 2 AM and carried home. The doctor's bill came to ${gold(s.lost)}.`));
    const shipped = Object.entries(s.shipped);
    if (shipped.length) {
      body.append(h('h3', {}, 'Shipped'));
      for (const [id, n] of shipped) body.append(row(itemIcon(id), `${item(id).name} ×${n}`, gold(sellPrice(world, id) * n)));
    }
    body.append(h('div.stats', {}, stat('Earned', gold(s.earned)), stat('Crops grew', String(s.grown)), stat('Now ripe', String(s.ripe))));
    if (s.upgraded) body.append(h('p.warn.ok', {}, `The blacksmith finished your ${s.upgraded}!`));
    if (s.crowAte) body.append(h('p.warn', {}, `A crow ate ${/^[AEIOU]/.test(s.crowAte) ? 'an' : 'a'} ${s.crowAte} plant in the night! A Fire or Flying helper would scare them off.`));
    if (s.dried) body.append(h('p.note', {}, `${s.dried} empty plot${s.dried > 1 ? 's' : ''} went back to grass.`));
    body.append(h('p.note', {}, `Good morning! It's ${seasonOf(world.day)} ${dayOfSeason(world.day)}. Your Pokémon are rested.`));
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
      ['poke-ball', 'Walk out of the farm gate to Route 1. Wild Pokémon hide in the tall grass: weaken one, then throw a ball to befriend it.'],
    ];
    for (const [id, text] of tips) body.append(h('div.tip', {}, itemIcon(id), h('span', {}, text)));
    body.append(
      h('p', {}, 'Crops grow one day for each night they spend watered. Put berries in the shipping bin by the house to sell them overnight. Buy seeds and balls at the Poké Mart by the gate, and get better tools from the blacksmith next to it.'),
      h('p', {}, "Your Pokémon help out on the farm by type: Water types water, Grass and Bug types tend, Normal, Fighting and Ground types harvest, and Fire and Flying types keep crows away. Sleep in the farmhouse before 2 AM, or you'll pass out!"),
      h('p.note', {}, 'Keyboard: WASD or arrows to walk, Space to use, 1–8 to pick a tool, B for the bag.'),
      h('div.buttons', {}, button("Let's farm!", closeSheet, false, 'primary')),
    );
  }, { onClose: onDone });
}
