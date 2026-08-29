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
