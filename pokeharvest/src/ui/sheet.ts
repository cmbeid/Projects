/**
 * Menus open as a sheet: sliding up from the bottom on a phone held upright,
 * docked down the right-hand side on anything wide. Only one at a time;
 * while one is open, the farm's clock stops.
 */
import { h } from './dom';

let current: { el: HTMLElement; onClose: () => void } | null = null;

export function sheetOpen(): boolean {
  return current !== null;
}

export function closeSheet(): void {
  const c = current;
  if (!c) return;
  current = null;
  c.el.classList.remove('open');
  setTimeout(() => c.el.remove(), 200);
  c.onClose();
}

/**
 * Show a sheet. `build` fills the body and is called again by the returned
 * `refresh` after anything in it changes.
 */
export function openSheet(
  host: HTMLElement,
  title: string,
  build: (body: HTMLElement, refresh: () => void) => void,
  opts: { onClose?: () => void; dismissable?: boolean } = {},
): () => void {
  if (current) {
    const c = current;
    current = null;
    c.el.remove();
    c.onClose();
  }
  const dismissable = opts.dismissable ?? true;
  const body = h('div.sheet-body');
  const refresh = (): void => {
    body.replaceChildren();
    build(body, refresh);
  };
  const panel = h(
    'section.sheet',
    { role: 'dialog', 'aria-label': title },
    h('header.sheet-head', {}, h('h2', {}, title), dismissable ? h('button.close', { 'aria-label': 'Close', onclick: closeSheet }, '✕') : null),
    body,
  );
  const scrim = h('div.scrim', { onclick: (e: Event) => { if (e.target === scrim && dismissable) closeSheet(); } }, panel);
  host.append(scrim);
  current = { el: scrim, onClose: opts.onClose ?? (() => undefined) };
  refresh();
  requestAnimationFrame(() => scrim.classList.add('open'));
  return refresh;
}
