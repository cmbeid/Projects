import { formatDecimal, formatDuration } from '../num/format';
import type { OfflineSummary } from '../game/offline';
import type { ContentIndex } from '../data/indexes';
import { el } from './ticker';

/**
 * A single modal sheet, mounted once and reused.
 *
 * Deliberately not a component system: the game raises exactly one kind of
 * interruption at a time — a confirmation now, the welcome-back summary in
 * phase 6 — and both want the same sheet with different contents inside it.
 *
 * The backdrop dismisses, because a full-screen sheet with no obvious way out
 * is the worst thing a phone UI can do.
 */

let host: HTMLElement | null = null;
let sheet: HTMLElement | null = null;
let onClose: (() => void) | null = null;

export function mountModal(parent: HTMLElement): void {
  host = el('div', 'modal-backdrop is-hidden');
  sheet = el('div', 'modal-sheet');
  host.append(sheet);
  host.addEventListener('click', (event) => {
    if (event.target === host) closeModal();
  });
  parent.append(host);
}

export interface ModalOptions {
  title: string;
  /** Built by the caller so a modal can hold live controls, not just text. */
  body: HTMLElement;
  /** Runs when the sheet closes by any route, including the backdrop. */
  onDismiss?: () => void;
}

export function openModal(options: ModalOptions): void {
  if (!host || !sheet) return;
  onClose = options.onDismiss ?? null;

  const head = el('div', 'modal-head');
  head.append(el('h2', 'modal-title', options.title));
  const close = el('button', 'modal-close', '✕');
  close.type = 'button';
  close.addEventListener('click', () => closeModal());
  head.append(close);

  sheet.replaceChildren(head, options.body);
  host.classList.remove('is-hidden');
}

export function closeModal(): void {
  if (!host) return;
  host.classList.add('is-hidden');
  const callback = onClose;
  onClose = null;
  if (callback) callback();
}

export function isModalOpen(): boolean {
  return host !== null && !host.classList.contains('is-hidden');
}

/**
 * The welcome-back sheet.
 *
 * Says plainly when the cap bit: silently crediting less than the player was
 * away would read as a bug, and silently crediting more would read as a
 * different one.
 */
export function showWelcomeBack(summary: OfflineSummary, index: ContentIndex): void {
  const body = el('div', 'welcome-back');

  body.append(
    el(
      'p',
      undefined,
      summary.capped
        ? `Away ${formatDuration(summary.awaySeconds)} — credited the ${formatDuration(summary.creditedSeconds)} cap.`
        : `Away ${formatDuration(summary.awaySeconds)}. All of it credited.`,
    ),
  );

  const gains = [...summary.produced].filter(([, amount]) => amount.isPositive);
  if (gains.length > 0) {
    const stats = el('dl', 'stats');
    for (const [id, amount] of gains) {
      const resource = index.content.resources.find((r) => r.id === id);
      stats.append(el('dt', undefined, resource?.name ?? id));
      stats.append(el('dd', undefined, formatDecimal(amount)));
    }
    body.append(stats);
  }

  if (summary.hitStorage.length > 0) {
    const names = summary.hitStorage
      .map((id) => index.content.resources.find((r) => r.id === id)?.name ?? id)
      .join(', ');
    body.append(el('p', 'log-remaining', `${names} filled up while you were away. More storage helps.`));
  }

  const fragments = summary.logUnlocked
    .map((id) => index.content.log.find((entry) => entry.id === id))
    .filter((entry) => entry !== undefined);
  for (const fragment of fragments) {
    const entry = el('div', 'log-entry');
    entry.append(el('div', 'log-name', fragment.title));
    entry.append(el('div', 'log-blurb', fragment.text));
    body.append(entry);
  }

  const ok = el('button', 'relaunch-confirm', 'Back to it');
  ok.type = 'button';
  ok.addEventListener('click', () => closeModal());
  body.append(ok);

  openModal({ title: 'Welcome back', body });
}
