/** What's in each sheet: the Poké Mart, the shipping bin, the blacksmith, the bag, bedtime and the morning report. */
import { bestMedicine, useMedicine } from '../game/medicine';
import { sfx } from '../audio/index';
import { CROPS, crop, inSeason } from '../data/crops';
import { WEATHER_NAMES } from '../game/weather';
import { BUFF_TEXT, MART_STOCK, item, sellable } from '../data/items';
import { RECIPES } from '../data/crafting';
import { productOf, setRole } from '../game/barn';
import { craft, craftBlocker, eat, giveCandy, hasWorkbench } from '../game/craft';
import { roleOf } from '../game/model';
import { PERKS, SKILLS, SKILL_TEXT, SKILL_XP, TOOL_TEXT, UPGRADE_COSTS, type Skill, type UpgradableTool } from '../data/progress';
import { JOB_TEXT, SPECIES, species } from '../data/species';
import { TYPE_COLOURS } from '../data/types';
import { move } from '../data/moves';
import { binValue, buy, martPrice, sellNow, sellPrice, ship, startUpgrade, unship, upgradeBlocker } from '../game/economy';
import { canCapacity, takeItem, toolName } from '../game/farm';
import { syncHelpers } from '../game/helpers';
import { maxHp, xpForLevel } from '../game/mon';
import { PARTY_SIZE, type DaySummary, type Mon, type Role, type World } from '../game/model';
import { barnCapacity } from '../game/barn';
import { heartsText, reputationText } from './ranch';
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

/** What can go in the bin or back to the Mart. */
function sellables(world: World): string[] {
  return Object.keys(world.inventory).filter((id) => sellable(id));
}

/** "+8% today", from the day's market. */
function trend(world: World, id: string): string {
  const m = world.market[id];
  if (!m || m === 1) return '';
  const pct = Math.round((m - 1) * 100);
  return pct > 0 ? ` · ▲${pct}% today` : ` · ▼${-pct}% today`;
}

const SKILL_NAMES: Record<Skill, string> = { farming: 'Farming', battling: 'Battling', crafting: 'Crafting' };

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
      const season = seasonOf(world.day);
      body.append(h('p.note', {}, `${season} seeds are in. Out-of-season seeds only grow in a repaired greenhouse.`));
      for (const id of MART_STOCK.filter((i) => item(i).kind !== 'seed' || inSeason(item(i).crop!, season))) {
        const def = item(id);
        const price = def.buyPrice!;
        let detail = `${gold(price)}`;
        if (def.kind === 'seed') {
          const c = crop(def.crop!);
          detail += ` · ripe in ${c.days} days${c.regrow ? `, then every ${c.regrow}` : ''} · sells for ${gold(sellPrice(world, c.id))} · ${c.seasons.join(' & ')}`;
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
        body.append(row(itemIcon(id), `${item(id).name} ×${n}`, `${gold(martPrice(world, id))} each here${trend(world, id)}`,
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
    body.append(h('p.note', {}, "Everything in the bin is collected overnight and paid for at the day's prices. Prices change every day, and flooding the market with one thing lowers what it fetches."));
    const ids = sellables(world);
    body.append(h('h3', {}, 'In your bag'));
    if (!ids.length) body.append(empty('Nothing to ship yet.'));
    for (const id of ids) {
      const n = world.inventory[id]!;
      body.append(row(itemIcon(id), `${item(id).name} ×${n}`, `${gold(sellPrice(world, id))} each${trend(world, id)}`,
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
      const items = Object.entries(cost.items).map(([id, n]) => `${n} ${item(id).name} (have ${world.inventory[id] ?? 0})`).join(', ');
      body.append(row(
        itemIcon(tool),
        toolName(tool, tier + 1),
        `${TOOL_TEXT[tool][tier + 1]} · ${gold(cost.gold)} + ${items}`,
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

type BagTab = 'items' | 'pokemon' | 'craft' | 'farmer';

export function openBag(host: HTMLElement, world: World, changed: Changed, start: BagTab = 'items'): void {
  let tab: BagTab = start;
  openSheet(host, 'Bag', (body, refresh) => {
    body.append(tabs(tab, [['items', 'Items'], ['pokemon', 'Pokémon'], ['craft', 'Craft'], ['farmer', 'Farmer']], (t) => { tab = t; refresh(); }));
    if (tab === 'items') itemsTab(body, world, () => { changed(); refresh(); });
    else if (tab === 'pokemon') pokemonTab(body, world, () => { syncHelpers(world); changed(); refresh(); });
    else if (tab === 'craft') craftTab(body, world, () => { changed(); refresh(); });
    else farmerTab(body, world);
  });
}

function stat(label: string, value: string): HTMLElement {
  return h('div.stat', {}, h('div.stat-value', {}, value), h('div.stat-label', {}, label));
}

function itemsTab(body: HTMLElement, world: World, changed: Changed): void {
  const p = world.player;
  body.append(h('div.stats', {}, stat('Gold', gold(p.gold)), stat('Energy', `${p.energy}/${p.maxEnergy}`), stat('Can', `${p.water}/${canCapacity(world)}`), stat('Harvested', String(world.stats.harvested))));
  const all = Object.entries(world.inventory);
  if (!all.length) body.append(empty('Your bag is empty.'));
  // Key items last, under their own heading.
  const owned = all.filter(([id]) => item(id).kind !== 'key');
  const keys = all.filter(([id]) => item(id).kind === 'key');
  for (const [id, n] of [...owned, ...keys]) {
    if (keys.length && id === keys[0]![0]) body.append(h('h3', {}, 'Key items'));
    const def = item(id);
    const action = def.kind === 'seed' || def.kind === 'machine'
      ? button(world.selected === id ? 'In hand' : 'Hold', () => { select(world, id); changed(); }, world.selected === id)
      : def.kind === 'food'
        ? button('Eat', () => { (eat(world, id) ? sfx.pickup : sfx.deny)(); changed(); }, world.player.energy >= world.player.maxEnergy && !def.buff)
        : null;
    const detail = def.kind === 'seed' ? `Plant on tilled soil · ${crop(def.crop!).days} days · ${crop(def.crop!).seasons.join(' & ')}`
      : def.kind === 'crop' ? `Ships for ${gold(sellPrice(world, id))}${def.heals ? ' · heals in battle' : ' · offer it to calm wild Pokémon'}`
      : def.kind === 'food' ? `+${def.energy! >= 999 ? 'all' : def.energy} energy${def.buff ? ` · ${BUFF_TEXT[def.buff]}` : ''}`
      : def.kind === 'machine' ? `${def.description} Hold it and tap open grass to place it.`
      : def.kind === 'medicine' ? `${def.description} Use it in battle, or from the Pokémon tab.`
      : def.kind === 'product' || def.kind === 'artisan' ? `Ships for ${gold(sellPrice(world, id))}${trend(world, id)}. ${def.description ?? ''}`
      : def.description ?? '';
    body.append(row(itemIcon(id), `${def.name} ×${n}`, detail, action));
  }
}

/** Oran or Sitrus, whichever heals this Pokémon without much waste. */
function berryFor(world: World, mon: Mon): string | null {
  const missing = maxHp(mon) - mon.hp;
  if (missing <= 0 || mon.hp <= 0) return null;
  const options = ['oran', 'sitrus'].filter((id) => (world.inventory[id] ?? 0) > 0);
  return options.find((id) => id === 'oran' && missing <= 25) ?? options[0] ?? null;
}

function monCard(world: World, mon: Mon, changed: Changed): HTMLElement {
  const sp = species(mon.dex);
  const max = maxHp(mon);
  const lo = xpForLevel(mon.level);
  const role = roleOf(world, mon.uid);
  const berry = berryFor(world, mon);
  const medicine = bestMedicine(world, mon);
  const roleButton = (r: Role, label: string): HTMLButtonElement => {
    const b = button(label, () => {
      const why = setRole(world, mon.uid, r);
      if (why) {
        sfx.deny();
        note.textContent = why;
      } else {
        sfx.click();
        changed();
      }
    }, false, r === role ? 'seg on' : 'seg');
    return b;
  };
  const note = h('div.row-detail.role-note');
  const actions = h('div.mon-actions', {},
    h('div.segmented', { role: 'group', 'aria-label': 'Where it lives' }, roleButton('party', 'Party'), roleButton('farm', 'Farm'), roleButton('box', 'Box')),
    berry ? button(`Feed ${item(berry).name.replace(' Berry', '')}`, () => {
      const heal = item(berry).heals!;
      if (!takeItem(world, berry, 1)) return;
      mon.hp = Math.min(max, mon.hp + (heal < 1 ? Math.floor(max * heal) : heal));
      sfx.pickup();
      changed();
    }) : null,
    medicine ? button(`${item(medicine).revive ? 'Revive' : 'Use'} ${item(medicine).name}`, () => {
      const line = useMedicine(world, medicine, mon);
      if (!line) return;
      sfx.levelUp();
      note.textContent = line;
      changed();
    }) : null,
    (world.inventory['rare-candy'] ?? 0) > 0 && mon.level < 100 ? button('Rare Candy', () => {
      const lines = giveCandy(world, mon.uid);
      if (lines.some((l) => l.includes('evolved'))) sfx.evolve();
      else sfx.levelUp();
      note.textContent = lines.join(' ');
      changed();
    }) : null,
  );
  const evo = sp.evolves ? ` · evolves at Lv${sp.evolves.level}` : '';
  return h('div.mon-card', {},
    loadSprite(mon.dex, 1, 'mon-img'),
    h('div.mon-info', {},
      h('div.mon-title', {}, h('b', {}, `${sp.name}${mon.shiny ? ' ★' : ''}`), h('span', {}, `Lv${mon.level}`), ...sp.types.map((t) => h('span.type', { style: `background:${TYPE_COLOURS[t]}` }, t))),
      h('div.mon-bars', {}, h('span', {}, `HP ${mon.hp}/${max}`), bar(mon.hp / max, mon.hp / max > 0.5 ? '#48c050' : mon.hp / max > 0.2 ? '#f0b020' : '#e04030'), h('span', {}, 'XP'), bar((mon.xp - lo) / Math.max(1, xpForLevel(mon.level + 1) - lo), '#4aa0e8')),
      h('div.row-detail', {}, `${heartsText(mon.friendship)} · ${JOB_TEXT[sp.job]}${productOf(mon.dex) ? ` Makes ${item(productOf(mon.dex)!).name} when it lives on the farm.` : ''}${evo}`),
      h('div.mon-moves', {}, ...mon.moves.map((id) => h('span.chip', { style: `border-color:${TYPE_COLOURS[move(id).type]}` }, move(id).name))),
      actions,
      note,
    ));
}

function pokemonTab(body: HTMLElement, world: World, changed: Changed): void {
  body.append(h('p.note', {}, `Party Pokémon (up to ${PARTY_SIZE}) follow you, battle, and work the farm while you're on it. Farm Pokémon live in the barn and work all day, even while you're away; they eat from the barn's trough. The rest wait in the box. Pokédex: seen ${world.seen.length}, befriended ${world.caught.length} of ${SPECIES.size}.`));
  const section = (title: string, mons: Mon[], none: string): void => {
    body.append(h('h3', {}, title));
    if (!mons.length) body.append(empty(none));
    for (const mon of mons) body.append(monCard(world, mon, changed));
  };
  const byUid = (uids: number[]): Mon[] => uids.flatMap((u) => world.mons.find((m) => m.uid === u) ?? []);
  section(`Party · ${world.party.length}/${PARTY_SIZE}`, byUid(world.party), '');
  section(`Farm · ${world.farm.length}/${barnCapacity(world)}`, byUid(world.farm), 'Nobody lives on the farm yet. Send a Pokémon here to have it work while you\'re away.');
  section(`Box · ${world.mons.length - world.party.length - world.farm.length}`, world.mons.filter((m) => roleOf(world, m.uid) === 'box'), 'Nobody in the box. Befriend wild Pokémon on Route 1, south of the farm gate.');
}

function craftTab(body: HTMLElement, world: World, changed: Changed): void {
  body.append(h('p.note', {}, `Crafting level ${levelOf(world, 'crafting')}. Machines and stations are crafted at a Workbench on your farm${hasWorkbench(world) ? '' : " (you haven't placed one yet)"}, then placed by holding them and tapping open grass. Dishes are cooked in the farmhouse kitchen.`));
  recipeList(body, world, false, changed);
}

/** The recipes for machines and stations, or for the kitchen. */
function recipeList(body: HTMLElement, world: World, kitchen: boolean, changed: Changed): void {
  body.append(h('h3', {}, kitchen ? 'Recipes' : 'Machines and stations'));
  for (const recipe of RECIPES.filter((r) => Boolean(r.kitchen) === kitchen)) {
    const def = item(recipe.id);
    const blocker = craftBlocker(world, recipe.id);
    const inputs = Object.entries(recipe.inputs).map(([id, n]) => `${n} ${item(id).name} (${world.inventory[id] ?? 0})`).join(', ');
    const what = def.kind === 'food' ? `+${def.energy! >= 999 ? 'all' : def.energy} energy${def.buff ? `, ${BUFF_TEXT[def.buff].toLowerCase()}` : ''}` : def.description ?? '';
    const locked = levelOf(world, 'crafting') < recipe.level;
    const r = row(itemIcon(recipe.id), locked ? `${def.name} · Crafting ${recipe.level}` : def.name, `${what} · ${inputs}`,
      button(kitchen ? 'Cook' : 'Craft', () => {
        (craft(world, recipe.id) ? sfx.powerup : sfx.deny)();
        changed();
      }, Boolean(blocker), 'primary'));
    // Say why it can't be made yet, rather than just greying the button out.
    if (blocker) r.querySelector('.row-detail')?.append(h('span.row-blocker', {}, blocker));
    body.append(r);
  }
}

function farmerTab(body: HTMLElement, world: World): void {
  for (const skill of SKILLS) {
    const level = levelOf(world, skill);
    const xp = world.skills[skill];
    const lo = SKILL_XP[level]!;
    const hi = SKILL_XP[level + 1];
    body.append(
      h('h3', {}, `${SKILL_NAMES[skill]} · Level ${level}`),
      hi === undefined ? h('p.note', {}, 'Mastered!') : bar((xp - lo) / (hi - lo), '#3f9b3a'),
      h('p.note', {}, SKILL_TEXT[skill]),
    );
    const taken = ([5, 10] as const).flatMap((lvl) => PERKS[skill][lvl].filter((p) => world.perks.includes(p.id)));
    for (const perk of taken) body.append(h('div.perk', {}, h('b', {}, perk.name), h('span', {}, perk.text)));
  }
  body.append(h('h3', {}, 'Reputation'), h('p', {}, reputationText(world)));
  if (world.buffs.length) body.append(h('h3', {}, 'Today'), ...world.buffs.map((b) => h('p', {}, BUFF_TEXT[b])));
  body.append(h('h3', {}, 'Tools'));
  body.append(h('p', {}, `${toolName('hoe', world.tools.hoe)}: ${TOOL_TEXT.hoe[world.tools.hoe]}`), h('p', {}, `${toolName('can', world.tools.can)}: ${TOOL_TEXT.can[world.tools.can]}`));
  body.append(h('p.note', {}, `Battles won: ${world.stats.wins} · Gold earned: ${gold(world.stats.earned)}`));
}

/** Pick one of two perks: not dismissable, since the choice is the point. */
export function openPerk(host: HTMLElement, world: World, onDone: () => void): void {
  const pending = world.pendingPerks[0];
  if (!pending) return;
  const [a, b] = PERKS[pending.skill][pending.level];
  openSheet(host, `${SKILL_NAMES[pending.skill]} level ${pending.level}!`, (body) => {
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

export function openSleep(host: HTMLElement, world: World, onSleep: () => void, changed: Changed = () => undefined): void {
  let tab: 'sleep' | 'cook' = 'sleep';
  openSheet(host, 'Farmhouse', (body, refresh) => {
    body.append(tabs(tab, [['sleep', 'Sleep'], ['cook', 'Kitchen']], (t) => { tab = t; refresh(); }));
    if (tab === 'cook') {
      body.append(h('p.note', {}, `Cook a dish, then eat it from the Bag for energy and a buff for the day. Crafting level ${levelOf(world, 'crafting')}.`));
      recipeList(body, world, true, () => { changed(); refresh(); });
      return;
    }
    const late = world.clock >= 24 * 60;
    body.append(
      h('p', {}, `It's ${clockText(world.clock)}. Go to bed and end the day?`),
      h('p.note', {}, late ? "It's past midnight, so you'll wake up a little tired." : 'Anything in the shipping bin will be paid for overnight, and your Pokémon will be rested.'),
      h('div.buttons', {}, button('Not yet', closeSheet), button('Sleep', () => { closeSheet(); onSleep(); }, false, 'primary')),
    );
  });
}

/** How the day report names each job. */
const JOB_DONE: Record<string, string> = {
  water: 'Watered', tend: 'Tended', harvest: 'Picked', plant: 'Planted', till: 'Re-tilled', guard: 'Kept watch', power: 'Powered machines',
};

export function openSummary(host: HTMLElement, world: World, s: DaySummary, onDone: () => void): void {
  openSheet(host, s.passedOut ? 'You passed out…' : `Day ${s.day} done`, (body) => {
    if (s.passedOut) body.append(h('p', {}, `You were found collapsed at 2 AM and carried home. The doctor's bill came to ${gold(s.lost)}.`));
    const shipped = Object.entries(s.shipped);
    if (shipped.length) {
      body.append(h('h3', {}, 'Shipped'));
      for (const [id, n] of shipped) body.append(row(itemIcon(id), `${item(id).name} ×${n}`, gold(sellPrice(world, id) * n)));
    }
    body.append(h('div.stats', {}, stat('Earned', gold(s.earned)), stat('Crops grew', String(s.grown)), stat('Now ripe', String(s.ripe))));
    if (s.helpers.length) {
      body.append(h('h3', {}, 'Your Pokémon'));
      for (const { dex, work } of s.helpers) {
        const did = Object.entries(work.jobs).map(([job, n]) => (job === 'guard' || job === 'power' ? JOB_DONE[job]! : `${JOB_DONE[job] ?? job} ${n}`)).join(' · ');
        const ups = work.levels.length ? ` ${work.levels.join(' ')}` : '';
        body.append(h('div.row', {}, loadSprite(dex, 1, 'row-mon'),
          h('div.row-text', {}, h('div.row-name', {}, species(dex).name), h('div.row-detail', {}, `${did} · +${work.xp} XP${ups}`))));
      }
    }
    if (s.upgraded) body.append(h('p.warn.ok', {}, `The blacksmith finished your ${s.upgraded}!`));
    const made = Object.entries(s.produced);
    if (made.length) body.append(h('p.warn.ok', {}, `Your barn Pokémon made ${made.map(([id, n]) => `${n} ${item(id).name}`).join(', ')}. Collect it at the barn.`));
    if (s.hungry) body.append(h('p.warn', {}, `${s.hungry} Pokémon in the barn went to bed hungry. Put berries in the trough!`));
    if (s.expired) body.append(h('p.note', {}, `${s.expired} request${s.expired > 1 ? 's' : ''} on the board ran out of time.`));
    if (s.crowAte) body.append(h('p.warn', {}, `A crow ate ${/^[AEIOU]/.test(s.crowAte) ? 'an' : 'a'} ${s.crowAte} plant in the night! A Fire or Flying helper would scare them off.`));
    if (s.dried) body.append(h('p.note', {}, `${s.dried} empty plot${s.dried > 1 ? 's' : ''} went back to grass.`));
    if (s.newSeason) body.append(h('p.warn.ok', {}, `${seasonOf(world.day)} is here! New seeds are in at the Mart, and new Pokémon are out on Route 1.`));
    if (s.withered) body.append(h('p.warn', {}, `${s.withered} crop${s.withered > 1 ? 's' : ''} withered as the season changed.`));
    body.append(h('p.note', {}, `Good morning! It's ${seasonOf(world.day)} ${dayOfSeason(world.day)}, ${WEATHER_NAMES[world.weather].toLowerCase()}${world.weather === 'rain' || world.weather === 'storm' ? ': the rain has watered your crops' : ''}. Tomorrow: ${WEATHER_NAMES[world.tomorrow].toLowerCase()}. Your Pokémon are rested.`));
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
      ['moomoo-milk', "Send Pokémon to live in the barn and they'll work the farm all day, even while you're away. Keep the trough full of berries and livestock make milk, wool, honey and more."],
      ['berry-press', 'Craft machines in the Bag, then place them on the farm: they turn berries and goods into things worth much more.'],
    ];
    for (const [id, text] of tips) body.append(h('div.tip', {}, itemIcon(id), h('span', {}, text)));
    body.append(
      h('p', {}, 'Each season has its own berries; crops still out when their season ends wither, and rain waters everything for you. A repaired greenhouse grows anything all year. Crops grow one day for each night they spend watered. Put berries in the shipping bin by the house to sell them overnight; prices change daily. Buy seeds and balls at the Poké Mart by the gate, and better tools from the blacksmith next to it. The request board by the house pays extra and earns reputation, and a merchant visits at weekends.'),
      h('p', {}, "Your Pokémon help out on the farm by type: Water types water, Grass and Bug types tend, Normal, Fighting and Ground types harvest, Fire and Flying types keep crows away, and Electric types power machines. Tap one to give it a pat. Sleep in the farmhouse before 2 AM, or you'll pass out!"),
      h('p.note', {}, 'Keyboard: WASD or arrows to walk, Space to use, 1–8 to pick a tool, B for the bag.'),
      h('div.buttons', {}, button("Let's farm!", closeSheet, false, 'primary')),
    );
  }, { onClose: onDone });
}
