/** Sheets for the barn and ranch, the request board, the travelling merchant, and placed machines. */
import { sfx } from '../audio/index';
import { CROPS } from '../data/crops';
import { ITEMS, item } from '../data/items';
import { BARN_LEVELS, RANCH_STOCK, REPUTATION, REPUTATION_NAMES, reputationLevel } from '../data/ranch';
import { JOB_TEXT, species } from '../data/species';
import { barnCapacity, barnUpgradeBlocker, buyLivestock, collectBarn, fillTrough, greenhouseBlocker, hearts, productOf, ranchBlocker, repairGreenhouse, setRole, troughCount, upgradeBarn } from '../game/barn';
import { GREENHOUSE_COST } from '../data/ranch';
import { isDone, loadBlocker, loadCost, loadMachine, machineSpeed, outputFor, pickUpMachine, powered } from '../game/machines';
import { MACHINES } from '../data/crafting';
import { buyFromMerchant, merchantHere, merchantStock } from '../game/market';
import { farmMons, partyMons, plotKey, type World } from '../game/model';
import { farmStatus } from '../game/status';
import { seedBoxCount, stockSeedBox, takeFromSeedBox } from '../game/seedbox';
import { inSeason } from '../data/crops';
import { seasonOf } from '../game/time';
import { canDeliver, deliver } from '../game/requests';
import { addSkillXp } from '../game/skills';
import { h } from './dom';
import { itemIcon } from './icons';
import { loadSprite } from './preview';
import { closeSheet, openSheet } from './sheet';

type Changed = () => void;

function gold(n: number): string {
  return `${n.toLocaleString('en')}g`;
}

function button(label: string, onclick: () => void, disabled = false, cls = ''): HTMLButtonElement {
  return h('button', { className: `btn ${cls}`, disabled, onclick }, label);
}

function row(icon: HTMLElement, name: string, detail: string, ...actions: (HTMLElement | null)[]): HTMLElement {
  return h('div.row', {}, icon, h('div.row-text', {}, h('div.row-name', {}, name), h('div.row-detail', {}, detail)), h('div.row-actions', {}, ...actions));
}

export function heartsText(friendship: number): string {
  const n = hearts(friendship);
  return '♥'.repeat(n) + '♡'.repeat(5 - n);
}

export function reputationText(world: World): string {
  const level = reputationLevel(world.reputation);
  const next = REPUTATION[level + 1];
  return `${REPUTATION_NAMES[level]} (level ${level})${next === undefined ? '' : ` · ${world.reputation}/${next} to the next`}`;
}

export function openBarn(host: HTMLElement, world: World, changed: Changed): void {
  openSheet(host, BARN_LEVELS[world.barn.level]!.name, (body, refresh) => {
    const done = (ok: boolean, sound: () => void = sfx.click): void => {
      (ok ? sound : sfx.deny)();
      changed();
      refresh();
    };
    const waiting = Object.entries(world.barn.output);
    if (waiting.length) {
      body.append(h('div.collect', {},
        ...waiting.map(([id, n]) => h('span.collect-item', {}, itemIcon(id), `×${n}`)),
        button('Collect', () => {
          const got = collectBarn(world);
          addSkillXp(world, 'farming', Object.values(got).reduce((a, n) => a + n, 0));
          done(true, sfx.pickup);
        }, false, 'primary')));
    }

    // Residents.
    const residents = farmMons(world);
    body.append(h('h3', {}, `Living here · ${residents.length}/${barnCapacity(world)}`));
    body.append(h('p.note', {}, 'Pokémon you send to the farm live here and work all day, even while you\'re away. Choose who lives here from the Bag\'s Pokémon tab.'));
    if (!residents.length) body.append(h('p.empty', {}, 'Nobody lives here yet.'));
    for (const mon of residents) {
      const sp = species(mon.dex);
      const product = productOf(mon.dex);
      const detail = `${heartsText(mon.friendship)} · ${mon.fed ? 'well fed' : 'hungry!'} · ${product ? `makes ${item(product).name}` : JOB_TEXT[sp.job]}`;
      body.append(h('div.row', {}, loadSprite(mon.dex, 1, 'row-mon'), h('div.row-text', {}, h('div.row-name', {}, `${sp.name} Lv${mon.level}`), h('div.row-detail', {}, detail)),
        h('div.row-actions', {}, button('To box', () => done(!setRole(world, mon.uid, 'box'))))));
    }

    // Trough.
    const inTrough = troughCount(world);
    body.append(h('h3', {}, `Trough · ${inTrough} berr${inTrough === 1 ? 'y' : 'ies'}`));
    body.append(h('p.note', {}, `Each resident eats one berry a night, cheapest first. Fed Pokémon work at full pace, grow fonder of you, and livestock make something every morning. ${residents.length ? `Enough for ${Math.floor(inTrough / residents.length)} night${Math.floor(inTrough / residents.length) === 1 ? '' : 's'}.` : ''}`));
    const berries = CROPS.map((c) => c.id).filter((id) => (world.inventory[id] ?? 0) > 0);
    if (!berries.length) body.append(h('p.empty', {}, 'No berries in your bag to put out.'));
    for (const id of berries) {
      const n = world.inventory[id]!;
      body.append(row(itemIcon(id), `${item(id).name} ×${n}`, 'Put some in the trough',
        button('+1', () => done(fillTrough(world, id, 1))),
        button('+5', () => done(fillTrough(world, id, Math.min(5, n)))),
        button('All', () => done(fillTrough(world, id, n)))));
    }

    // The ranch counter.
    body.append(h('h3', {}, 'Ranch'), h('p.note', {}, `Livestock arrive at level 5 and move straight in. Your reputation: ${reputationText(world)}.`));
    for (const entry of RANCH_STOCK) {
      const blocker = ranchBlocker(world, entry.dex);
      const product = productOf(entry.dex);
      body.append(h('div.row', {}, loadSprite(entry.dex, 1, 'row-mon'),
        h('div.row-text', {}, h('div.row-name', {}, `${species(entry.dex).name} · ${gold(entry.price)}`), h('div.row-detail', {}, product ? `Makes ${item(product).name} when fed.` : '', blocker ? ` ${blocker}` : '')),
        h('div.row-actions', {}, button('Buy', () => {
          const where = buyLivestock(world, entry.dex);
          done(where !== null, sfx.coin);
        }, Boolean(blocker)))));
    }

    // The carpenter.
    const next = BARN_LEVELS[world.barn.level + 1];
    body.append(h('h3', {}, 'Carpenter'));
    if (!next?.cost) {
      body.append(h('p', {}, 'Your barn is as big as barns get.'));
    } else {
      const blocker = barnUpgradeBlocker(world);
      const items = Object.entries(next.cost.items).map(([id, n]) => `${n} ${item(id).name} (have ${world.inventory[id] ?? 0})`).join(', ');
      body.append(row(h('span.icon.emoji-icon', {}, '🔨'), `Build a ${next.name}`, `Room for ${next.capacity} · ${gold(next.cost.gold)} + ${items} · reputation level ${next.cost.reputation}`,
        button('Build', () => done(upgradeBarn(world), sfx.powerup), Boolean(blocker), 'primary')));
      if (blocker) body.append(h('p.note', {}, blocker));
    }
    if (!world.greenhouse) {
      const blocker = greenhouseBlocker(world);
      const items = Object.entries(GREENHOUSE_COST.items).map(([id, n]) => `${n} ${item(id).name} (have ${world.inventory[id] ?? 0})`).join(', ');
      body.append(row(h('span.icon.emoji-icon', {}, '🪴'), 'Repair the greenhouse', `Anything grows in it, all year, and crows can't get in · ${gold(GREENHOUSE_COST.gold)} + ${items} · reputation level ${GREENHOUSE_COST.reputation}`,
        button('Repair', () => done(repairGreenhouse(world), sfx.powerup), Boolean(blocker), 'primary')));
      if (blocker) body.append(h('p.note', {}, blocker));
    }
  });
}

/** Everything on the farm that needs you, in full: opened from the status chip. */
export function openStatus(host: HTMLElement, world: World): void {
  openSheet(host, 'Farm status', (body) => {
    const entries = farmStatus(world);
    if (!entries.length) body.append(h('p.empty', {}, 'All quiet on the farm. Nothing needs you right now.'));
    for (const e of entries) body.append(h('div.row', {}, h('span.status-icon', {}, e.icon), h('div.row-text', {}, h('div.row-detail', {}, e.detail))));
  });
}

/** The Seed Box by the house: stock it, and pick what Ground helpers plant. */
export function openSeedBox(host: HTMLElement, world: World, changed: Changed): void {
  openSheet(host, 'Seed Box', (body, refresh) => {
    const done = (ok: boolean): void => {
      (ok ? sfx.click : sfx.deny)();
      changed();
      refresh();
    };
    const total = seedBoxCount(world);
    const season = seasonOf(world.day);
    const sowers = [...partyMons(world), ...farmMons(world)].filter((m) => species(m.dex).job === 'sow');
    body.append(h('h3', {}, `In the box · ${total} seed${total === 1 ? '' : 's'}`));
    body.append(h('p.note', {}, `Ground-type Pokémon working the farm take seeds from here and plant them in empty plots. They re-till your fields too. ${sowers.length ? '' : 'No Ground-type helper yet.'}`));

    // What to plant.
    const inBox = Object.keys(world.seedBox).sort();
    const choices = ['auto', ...new Set([...inBox, ...(world.seedChoice === 'auto' ? [] : [world.seedChoice])])];
    body.append(h('div.row-actions.seed-choice', {}, ...choices.map((id) => {
      const label = id === 'auto' ? 'Auto' : `${item(id).name.replace(/ Seeds?$/, '')}${inSeason(item(id).crop!, season) ? '' : ' (greenhouse)'}`;
      return button(label, () => {
        world.seedChoice = id;
        done(true);
      }, false, world.seedChoice === id ? 'primary' : '');
    })));
    body.append(h('p.note', {}, world.seedChoice === 'auto'
      ? `Auto: they plant whichever in-season seed you've put in most of (any seed in the greenhouse).`
      : `They only plant ${item(world.seedChoice).name}${inSeason(item(world.seedChoice).crop!, season) ? '' : `, which only grows in the greenhouse in ${season}`}.`));

    if (!inBox.length) body.append(h('p.empty', {}, 'The box is empty.'));
    for (const id of inBox) {
      const n = world.seedBox[id]!;
      body.append(row(itemIcon(id), `${item(id).name} ×${n}`, inSeason(item(id).crop!, season) ? 'In season' : `Out of season: greenhouse only`,
        button('−1', () => done(takeFromSeedBox(world, id, 1) > 0)),
        button('Take all', () => done(takeFromSeedBox(world, id, n) > 0))));
    }

    // From your bag.
    body.append(h('h3', {}, 'From your bag'));
    const bagSeeds = Object.keys(world.inventory).filter((id) => ITEMS.get(id)?.kind === 'seed').sort();
    if (!bagSeeds.length) body.append(h('p.empty', {}, 'No seeds in your bag. The Poké Mart sells them.'));
    for (const id of bagSeeds) {
      const n = world.inventory[id]!;
      body.append(row(itemIcon(id), `${item(id).name} ×${n}`, 'Put some in the box',
        button('+1', () => done(stockSeedBox(world, id, 1) > 0)),
        button('+5', () => done(stockSeedBox(world, id, 5) > 0)),
        button('All', () => done(stockSeedBox(world, id, n) > 0))));
    }
  });
}

export function openBoard(host: HTMLElement, world: World, changed: Changed): void {
  openSheet(host, 'Request board', (body, refresh) => {
    body.append(h('p.note', {}, `Townsfolk post what they need. Deliver in time for a bonus and some reputation. Your reputation: ${reputationText(world)}. Reputation lets you buy livestock and build a bigger barn.`));
    if (!world.requests.length) body.append(h('p.empty', {}, 'Nothing posted. Check back tomorrow.'));
    for (const r of world.requests) {
      const have = world.inventory[r.item] ?? 0;
      const left = r.due - world.day;
      const when = left <= 0 ? 'due today' : left === 1 ? 'due tomorrow' : `due in ${left} days`;
      body.append(row(itemIcon(r.item), `${item(r.item).name} ×${r.count}`, `${gold(r.reward)} + ${r.reputation} reputation · ${when} · you have ${have}`,
        button('Deliver', () => {
          (deliver(world, r.id) ? sfx.win : sfx.deny)();
          changed();
          refresh();
        }, !canDeliver(world, r.id), 'primary')));
    }
  });
}

export function openMerchant(host: HTMLElement, world: World, changed: Changed): void {
  openSheet(host, 'Travelling merchant', (body, refresh) => {
    if (!merchantHere(world)) {
      body.append(h('p', {}, 'The cart is covered up. A note on it says: "Back on Saturday!"'));
      return;
    }
    body.append(h('p.note', {}, "Rare things from far away, this weekend only. You have " + gold(world.player.gold) + '.'));
    for (const s of merchantStock(world)) {
      const def = item(s.id);
      body.append(row(itemIcon(s.id), `${def.name} · ${gold(s.price)}`, `${s.left} left${def.description ? ` · ${def.description}` : ''}`,
        button('Buy', () => {
          (buyFromMerchant(world, s.id) ? sfx.coin : sfx.deny)();
          changed();
          refresh();
        }, s.left <= 0 || world.player.gold < s.price)));
    }
  });
}

export function openMachine(host: HTMLElement, world: World, x: number, y: number, changed: Changed): void {
  const key = plotKey(x, y);
  const m0 = world.machines[key];
  if (!m0) return;
  openSheet(host, item(m0.id).name, (body, refresh) => {
    const m = world.machines[key];
    if (!m) {
      closeSheet();
      return;
    }
    const speed = machineSpeed(world, m.id);
    const type = MACHINES[m.id]?.poweredBy;
    const name = type === 'fire' ? 'A Fire' : 'An Electric';
    const power = !type ? '' : powered(world, m.id)
      ? `${name} Pokémon on the farm is powering it: twice as fast${m.id === 'furnace' ? ', and no wood needed' : ''}!`
      : `${name} Pokémon working on the farm would make it run twice as fast${m.id === 'furnace' ? ' with no wood' : ''}.`;
    body.append(h('p.note', {}, `${item(m.id).description ?? ''} ${power}`));
    if (m.id === 'workbench') {
      body.append(h('p', {}, "Craft machines and stations in the Bag's Craft tab while this stands on your farm."));
    }
    if (m.output && !isDone(world, key)) {
      const minutes = Math.ceil((m.needed - m.progress) / speed);
      body.append(h('p', {}, `Making ${item(m.output).name}… about ${minutes >= 60 ? `${Math.round(minutes / 60)} hours` : `${minutes} minutes`} to go.`));
    } else if (!m.output && m.id !== 'workbench') {
      const inputs = [...ITEMS.keys()].filter((id) => (world.inventory[id] ?? 0) > 0 && outputFor(m.id, id));
      body.append(h('h3', {}, 'Put something in'));
      if (!inputs.length) body.append(h('p.empty', {}, 'Nothing in your bag that this machine takes.'));
      for (const id of inputs) {
        const out = outputFor(m.id, id)!;
        const cost = loadCost(world, m.id, id)!;
        const blocker = loadBlocker(world, x, y, id);
        const uses = `${cost.uses > 1 ? `${cost.uses} make` : 'Makes'} ${item(out).name} (${gold(item(out).sellPrice)})${cost.fuel ? ` · burns 1 ${item(cost.fuel).name}` : ''}`;
        body.append(row(itemIcon(id), `${item(id).name} ×${world.inventory[id]}`, blocker ? `${uses} · ${blocker}` : uses,
          button('Load', () => {
            (loadMachine(world, x, y, id) ? sfx.place : sfx.deny)();
            changed();
            refresh();
          }, Boolean(blocker), 'primary')));
      }
    }
    body.append(h('div.buttons', {}, button('Pick it up', () => {
      pickUpMachine(world, x, y);
      sfx.click();
      changed();
      closeSheet();
    })));
    body.append(h('p.note', {}, 'Picking it up loses anything half-made. You can also tap it with the sickle.'));
  });
}
