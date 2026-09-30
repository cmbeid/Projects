type Child = Node | string | null | undefined | false;

/** A minimal element builder: `h('button.primary', { onclick }, 'Play')`. */
export function h<K extends keyof HTMLElementTagNameMap>(
  spec: K | `${K}.${string}`,
  props: Partial<Record<string, unknown>> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const [tag, ...classes] = spec.split('.') as [K, ...string[]];
  const el = document.createElement(tag);
  if (classes.length) el.className = classes.join(' ');
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2), value as EventListener);
    } else if (key === 'style' && typeof value === 'string') {
      el.setAttribute('style', value);
    } else if (key in el) {
      (el as unknown as Record<string, unknown>)[key] = value;
    } else {
      el.setAttribute(key, String(value));
    }
  }
  for (const child of children) if (child) el.append(child);
  return el;
}

export function starsRow(count: number, of = 3, size = 'md'): HTMLElement {
  const row = h('span.stars', { 'aria-label': `${count} of ${of} stars` });
  row.classList.add(`stars-${size}`);
  for (let i = 0; i < of; i += 1) row.append(h('span.star', { className: i < count ? 'star on' : 'star' }, '★'));
  return row;
}
