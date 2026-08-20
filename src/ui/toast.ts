import type { Element } from '../data/types';
import { iconSpan } from './icons';

const VISIBLE_MS = 2200;
/** More than this on screen at once is unreadable, so the oldest are dropped. */
const MAX_STACKED = 3;

let host: HTMLElement | null = null;

export function initToasts(element: HTMLElement): void {
  host = element;
}

/** Announces a first-time discovery. */
export function toastDiscovery(element: Element): void {
  show(`
    <span class="toast-emoji"></span>
    <span><span class="toast-label">New discovery — </span><span class="toast-name"></span></span>
  `, element);
}

/** A plain message with no element attached. */
export function toastMessage(text: string): void {
  if (!host) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = text;
  mount(toast);
}

function show(template: string, element: Element): void {
  if (!host) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = template;

  const emoji = toast.querySelector<HTMLElement>('.toast-emoji');
  if (emoji) emoji.replaceWith(iconSpan(element, 'toast-emoji'));

  const name = toast.querySelector<HTMLElement>('.toast-name');
  if (name) name.textContent = element.name;

  mount(toast);
}

function mount(toast: HTMLElement): void {
  if (!host) return;

  host.append(toast);
  while (host.children.length > MAX_STACKED) host.firstElementChild?.remove();

  setTimeout(() => {
    toast.classList.add('is-leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
    // Belt and braces: if the animation never fires (reduced motion, hidden
    // tab), the toast still goes away.
    setTimeout(() => toast.remove(), 500);
  }, VISIBLE_MS);
}
