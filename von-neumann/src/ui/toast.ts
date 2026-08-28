import { el } from './ticker';

const VISIBLE_MS = 2_600;

let host: HTMLElement | null = null;

export function mountToasts(parent: HTMLElement): void {
  host = el('div', 'toasts');
  parent.append(host);
}

/** A transient line for things worth noticing but not worth interrupting for. */
export function toast(message: string): void {
  if (!host) return;
  const node = el('div', 'toast', message);
  host.append(node);
  setTimeout(() => node.classList.add('is-leaving'), VISIBLE_MS - 300);
  setTimeout(() => node.remove(), VISIBLE_MS);
}
