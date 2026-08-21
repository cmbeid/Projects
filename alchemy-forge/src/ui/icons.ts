import type { Element } from '../data/types';

/**
 * Renders an element's icon into a host node.
 *
 * Elements ship with an emoji today, and an optional `icon` field carrying
 * inline SVG. Everything that draws an element goes through here, so replacing
 * an emoji with custom art is a data change and nothing else.
 */
export function renderIcon(host: HTMLElement, element: Element): void {
  if (element.icon) {
    host.innerHTML = element.icon;
    host.classList.add('has-svg');
    return;
  }
  host.textContent = element.emoji;
  host.classList.remove('has-svg');
}

/** The icon as a detached span, for callers building a subtree. */
export function iconSpan(element: Element, className: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = className;
  span.setAttribute('aria-hidden', 'true');
  renderIcon(span, element);
  return span;
}
