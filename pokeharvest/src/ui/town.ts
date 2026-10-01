/** The town's buildings: the Pokémon Center, the Mayor's Hall, the workshop, and the townsfolk's homes. Also the story's journal. */
import { cry, sfx } from '../audio/index';
import { item } from '../data/items';
import { HOUSE_LINES } from '../data/people';
import { BEATS, CHAPTERS, SPEAKERS } from '../data/story';
import { healAll } from '../game/mon';
import { canChallenge } from '../game/npcs';
import { partyMons, type World } from '../game/model';
import { canDeliverToMayor, currentChapter, deliverToMayor, hasFlag, kaiReady, progress } from '../game/story';
import { buy } from '../game/economy';
import { h } from './dom';
import { say, type Say } from './dialogue';
import { itemIcon } from './icons';
import { closeSheet, openSheet } from './sheet';

type Changed = () => void;

function button(label: string, onclick: () => void, disabled = false, cls = ''): HTMLButtonElement {
  return h('button', { className: `btn ${cls}`, disabled, onclick }, label);
}

function bar(frac: number): HTMLElement {
  return h('div.meter', {}, h('div', { style: `width:${Math.max(0, Math.min(1, frac)) * 100}%;background:#3f9b3a` }));
}

/** A story beat's lines, ready for the dialogue box. */
export function beatLines(beat: string): Say[] {
  return (BEATS[beat] ?? []).map((l) => ({ name: SPEAKERS[l.speaker].name, palette: SPEAKERS[l.speaker].palette, text: l.text }));
}

export function openCenter(host: HTMLElement, world: World, openPc: () => void, changed: Changed): void {
  openSheet(host, 'Pokémon Center', (body) => {
    if (!hasFlag(world, 'center-open')) {
      body.append(h('p', {}, "The windows are boarded up. A sign says: \"Closed until further notice.\" The Mayor's Hall might know more."));
      return;
    }
    body.append(
      h('p', {}, 'Nurse Hana: "Welcome to the Pokémon Center! Shall I take your Pokémon for a rest?"'),
      h('div.buttons.stack', {},
        button('Heal my Pokémon', () => {
          healAll(world);
          sfx.levelUp();
          for (const m of partyMons(world).slice(0, 1)) cry(m.dex, { volume: 0.4 });
          changed();
          closeSheet();
          void say([{ name: 'Nurse Hana', palette: 'nurse', text: "Your Pokémon are fighting fit! We hope to see you again." }]);
        }, false, 'primary'),
        button('Use the PC (your Pokémon box)', () => { closeSheet(); openPc(); })),
    );
  });
}

export function openShop(host: HTMLElement, world: World, changed: Changed): void {
  openSheet(host, 'Cobblevale Workshop', (body, refresh) => {
    body.append(h('p.note', {}, `Building supplies. You have ${world.player.gold.toLocaleString('en')}g.`));
    for (const id of ['wood', 'workbench']) {
      const def = item(id);
      const price = def.buyPrice!;
      body.append(h('div.row', {}, itemIcon(id), h('div.row-text', {}, h('div.row-name', {}, `${def.name} · ${price}g${world.inventory[id] ? ` (have ${world.inventory[id]})` : ''}`), h('div.row-detail', {}, def.description ?? '')),
        h('div.row-actions', {},
          button('×1', () => { (buy(world, id, 1) ? sfx.coin : sfx.deny)(); changed(); refresh(); }, world.player.gold < price),
          id === 'wood' ? button('×10', () => { (buy(world, id, 10) ? sfx.coin : sfx.deny)(); changed(); refresh(); }, world.player.gold < price * 10) : null)));
    }
  });
}

export function openHall(host: HTMLElement, world: World, onKai: () => void, changed: Changed): void {
  openSheet(host, "Mayor's Hall", (body, refresh) => {
    const chapter = currentChapter(world);
    if (!chapter) {
      body.append(h('p', {}, 'Mayor Briar: "Cobblevale has never been happier. Thank you!"'));
      if (canChallenge(world, 'kai')) body.append(h('p', {}, 'Kai is here, looking for a rematch.'), h('div.buttons', {}, button('Battle Kai', () => { closeSheet(); onKai(); }, false, 'primary')));
      else body.append(h('p.note', {}, 'Kai has gone home for the week. Come back next week for a rematch.'));
      return;
    }
    body.append(h('h3', {}, `Chapter ${world.story.chapter + 1}: ${chapter.title}`), h('p', {}, chapter.summary));
    for (const o of chapter.objectives) {
      const p = progress(world, o);
      body.append(h('div.goal', {}, h('span', {}, `${p.have >= p.need ? '✓' : '○'} ${p.text}`), h('span.goal-count', {}, `${Math.min(p.have, p.need)}/${p.need}`), bar(p.have / p.need)));
    }
    const buttons = h('div.buttons.stack');
    if (canDeliverToMayor(world)) {
      buttons.append(button('Hand over what I have', () => {
        const given = deliverToMayor(world);
        const list = Object.entries(given).map(([id, n]) => `${n} ${item(id).name}`).join(', ');
        sfx.pickup();
        changed();
        refresh();
        if (list) void say([{ name: 'Mayor Briar', palette: 'mayor', text: `${list}! Thank you, that's a great help.` }]);
      }, false, 'primary'));
    }
    if (kaiReady(world)) buttons.append(button('Face Kai at the festival', () => { closeSheet(); onKai(); }, false, 'primary'));
    buttons.append(button('Talk to the Mayor', () => { closeSheet(); void say(beatLines(chapter.start)); }));
    body.append(buttons);
  });
}

export function houseLine(world: World, x: number, y: number): Say[] {
  const line = HOUSE_LINES[(x * 7 + y * 3 + world.day) % HOUSE_LINES.length]!;
  return [{ name: '', palette: null, text: line }];
}

/** The journal: every chapter so far, and what the current one asks for. */
export function openJournal(host: HTMLElement, world: World): void {
  openSheet(host, 'Journal', (body) => {
    CHAPTERS.forEach((c, i) => {
      if (i > world.story.chapter) return;
      const done = i < world.story.chapter;
      body.append(h('h3', {}, `${done ? '✓ ' : ''}Chapter ${i + 1}: ${c.title}`), h('p.note', {}, c.summary));
      if (done) return;
      for (const o of c.objectives) {
        const p = progress(world, o);
        body.append(h('div.goal', {}, h('span', {}, `${p.have >= p.need ? '✓' : '○'} ${p.text}`), h('span.goal-count', {}, `${Math.min(p.have, p.need)}/${p.need}`), bar(p.have / p.need)));
      }
    });
    if (world.story.chapter >= CHAPTERS.length) body.append(h('p.warn.ok', {}, 'The story is complete: Cobblevale is thriving. Kai is up for a rematch at the Hall each week.'));
  });
}
