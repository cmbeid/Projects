import { Decimal } from '../num/decimal';
import { formatCount, formatDecimal, formatDuration } from '../num/format';
import { DIRECTIVE_SLOTS, RELAUNCH_MINIMUM } from '../data/index';
import type { Directive } from '../data/types';
import type { Store } from '../state/store';
import { closeModal, openModal } from './modal';
import { toast } from './toast';
import type { Ticker } from './ticker';
import { el } from './ticker';

/**
 * The Prestige panel: what a Relaunch is worth, the loadout it will fly with,
 * and the Schematics tree it feeds.
 *
 * The panel leads with the *cost* — the run you are about to end — rather than
 * the reward, because the one thing a prestige screen must never do is let
 * someone reset by accident.
 */
export function renderPrestige(store: Store, ticker: Ticker, mount: HTMLElement): void {
  mount.replaceChildren();

  renderRelaunch(store, ticker, mount);
  renderLoadout(store, mount);
  renderTree(store, ticker, mount);
}

function renderRelaunch(store: Store, ticker: Ticker, mount: HTMLElement): void {
  mount.append(el('h2', 'panel-title', 'Relaunch'));

  const card = el('div', 'relaunch');
  const payout = el('div', 'relaunch-payout');
  const detail = el('div', 'relaunch-detail');
  card.append(payout, detail);

  ticker.text(payout, () => `${formatDecimal(store.pendingSchematics())} 📐 Schematics`);
  ticker.text(detail, () => {
    if (store.canRelaunch()) {
      return `for ${formatDecimal(store.runValue())} of production this run, counted in ore.`;
    }
    const needed = store.valueForFirstSchematics().sub(store.runValue()).max(Decimal.ZERO);
    // Naming the shortfall rather than just disabling the button is the whole
    // difference between a locked door and a goal. Counted in ore-equivalent,
    // so refining and thinking move the bar as well as digging does.
    return `${formatDecimal(needed)} more production — alloy and compute count for more — for the ${RELAUNCH_MINIMUM} Schematics a Relaunch needs.`;
  });
  mount.append(card);

  const button = el('button', 'relaunch-button', 'Relaunch');
  button.type = 'button';
  button.addEventListener('click', () => {
    if (store.canRelaunch()) openRelaunchModal(store);
  });
  ticker.flag(button, 'is-affordable', () => store.canRelaunch());
  mount.append(button);

  const held = el('p', 'relaunch-held');
  ticker.text(held, () => {
    const prestige = store.get().prestige;
    const runs = prestige.relaunches;
    const runLabel = runs === 1 ? '1 system behind you' : `${formatCount(runs)} systems behind you`;
    return `${formatDecimal(prestige.schematics)} 📐 unspent · ${runLabel} · this run ${formatDuration(store.get().stats.runSeconds)}`;
  });
  mount.append(held);
}

/**
 * The loadout in force, and — before the first Relaunch — what it will be.
 *
 * Shown outside the modal too, because a directive is only a meaningful choice
 * if the player can see what it is doing to the run they are in.
 */
function renderLoadout(store: Store, mount: HTMLElement): void {
  const chosen = store.get().prestige.directives;
  mount.append(el('h2', 'panel-title', 'Directives'));

  if (chosen.length === 0) {
    mount.append(
      el(
        'p',
        'empty',
        `Chosen at each Relaunch: ${DIRECTIVE_SLOTS} from different families. This run flies without any.`,
      ),
    );
    return;
  }

  const list = el('div', 'directive-list');
  for (const id of chosen) {
    const directive = store.index.directiveById.get(id);
    if (directive) list.append(directiveCard(directive, 'active'));
  }
  mount.append(list);
}

function renderTree(store: Store, ticker: Ticker, mount: HTMLElement): void {
  mount.append(el('h2', 'panel-title', 'Schematics'));

  const owned = new Set(store.get().prestige.perks);
  const available = store.availablePerks();

  if (owned.size === 0 && available.length === 0) {
    mount.append(el('p', 'empty', 'Relaunch once, and the tree opens.'));
    return;
  }

  const list = el('div', 'perk-list');

  for (const perk of store.index.content.perks) {
    if (!owned.has(perk.id)) continue;
    const row = el('div', 'perk is-owned');
    row.append(perkHead(perk.emoji, perk.name, 'Bought'));
    row.append(el('div', 'perk-blurb', perk.blurb));
    list.append(row);
  }

  for (const perk of available) {
    const card = el('button', 'perk');
    card.type = 'button';
    card.addEventListener('click', () => {
      if (store.buyPerk(perk.id)) toast(`${perk.name} — ${perk.blurb}`);
    });
    card.append(perkHead(perk.emoji, perk.name, `${formatCount(perk.cost)} 📐`));
    card.append(el('div', 'perk-blurb', perk.blurb));
    ticker.flag(card, 'is-affordable', () =>
      store.get().prestige.schematics.gte(Decimal.from(perk.cost)),
    );
    list.append(card);
  }

  mount.append(list);

  // Locked nodes are named but not detailed: the shape of the tree ahead is
  // information, the exact contents of it are a spoiler.
  const reachable = new Set([...owned, ...available.map((p) => p.id)]);
  const locked = store.index.content.perks.filter((p) => !reachable.has(p.id));
  if (locked.length > 0) {
    mount.append(
      el('p', 'log-remaining', `${locked.length} more behind what you have not bought yet.`),
    );
  }
}

function perkHead(emoji: string, name: string, trailing: string): HTMLElement {
  const head = el('div', 'perk-head');
  head.append(el('span', 'perk-icon', emoji));
  head.append(el('span', 'perk-name', name));
  head.append(el('span', 'perk-price', trailing));
  return head;
}

/** `active` marks a directive flying on the current run; `idle` is a pick in the picker. */
function directiveCard(directive: Directive, state: 'active' | 'idle'): HTMLElement {
  const card = el('div', `directive${state === 'active' ? ' is-picked' : ''}`);
  const head = el('div', 'directive-head');
  head.append(el('span', 'directive-icon', directive.emoji));
  head.append(el('span', 'directive-name', directive.name));
  head.append(el('span', 'directive-family', directive.family));
  card.append(head);
  card.append(el('div', 'directive-blurb', directive.blurb));
  return card;
}

/**
 * The confirmation, which is also the picker.
 *
 * One screen rather than two: the loadout *is* the decision, and asking "are
 * you sure?" separately from "what will you take?" would put the irreversible
 * step behind a question the player has already stopped reading.
 */
function openRelaunchModal(store: Store): void {
  const chosen: string[] = [];
  const body = el('div', 'relaunch-modal');

  const summary = el('p', 'relaunch-summary');
  summary.textContent =
    `This ends the run. The swarm, everything it built and everything it learned stay behind; ` +
    `you keep ${formatDecimal(store.pendingSchematics())} Schematics, the tree, and the log.`;
  body.append(summary);

  const slots = el('p', 'relaunch-slots');
  body.append(slots);

  const list = el('div', 'directive-list');
  const cards = new Map<string, HTMLElement>();
  const directives = store.availableDirectives();

  const refresh = (): void => {
    const legal = store.legalLoadout(chosen);
    slots.textContent = `${legal.length} of ${DIRECTIVE_SLOTS} slots filled — one directive per family.`;
    const takenFamilies = new Set(
      legal.map((id) => store.index.directiveById.get(id)?.family).filter(Boolean),
    );
    for (const directive of directives) {
      const card = cards.get(directive.id);
      if (!card) continue;
      const picked = legal.includes(directive.id);
      // A pick blocked by its family reads as unavailable rather than merely
      // unselected, so the exclusivity rule is visible before it bites.
      const blocked = !picked && takenFamilies.has(directive.family);
      const full = !picked && legal.length >= DIRECTIVE_SLOTS;
      card.classList.toggle('is-picked', picked);
      card.classList.toggle('is-blocked', blocked || full);
    }
  };

  for (const directive of directives) {
    const card = directiveCard(directive, 'idle');
    card.addEventListener('click', () => {
      const at = chosen.indexOf(directive.id);
      if (at >= 0) chosen.splice(at, 1);
      else chosen.push(directive.id);
      refresh();
    });
    cards.set(directive.id, card);
    list.append(card);
  }
  body.append(list);

  const confirm = el('button', 'relaunch-confirm', 'Fire the seed probe');
  confirm.type = 'button';
  confirm.addEventListener('click', () => {
    const report = store.relaunch(chosen);
    closeModal();
    if (report) {
      toast(`Relaunched. ${formatDecimal(report.schematics)} Schematics banked.`);
    }
  });
  body.append(confirm);

  // Fewer directives than slots is legal — the pool starts small and the
  // player may simply not want a third. The button never blocks on it.
  refresh();
  openModal({ title: 'Relaunch', body });
}
