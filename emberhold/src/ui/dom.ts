/**
 * Panels are written as HTML strings and re-rendered a few times a second.
 * Replacing innerHTML that often would destroy the button under the
 * player's finger between pointerdown and click, so instead `morph` patches
 * the live DOM to match: same element, new text and attributes. A button
 * that stays in place stays the same node, and taps land.
 */

export function esc(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

const template = document.createElement('template');

export function morph(target: Element, html: string): void {
  template.innerHTML = html;
  patchChildren(target, template.content);
}

function sameKind(a: Node, b: Node): boolean {
  if (a.nodeType !== b.nodeType) return false;
  if (a.nodeType !== Node.ELEMENT_NODE) return true;
  const ea = a as Element;
  const eb = b as Element;
  return ea.tagName === eb.tagName && ea.getAttribute('data-key') === eb.getAttribute('data-key');
}

function patchChildren(live: Node, next: Node): void {
  const a = Array.from(live.childNodes);
  const b = Array.from(next.childNodes);
  for (let i = 0; i < b.length; i++) {
    const x = a[i];
    const y = b[i]!;
    if (!x) live.appendChild(y);
    else if (!sameKind(x, y)) live.replaceChild(y, x);
    else patchNode(x, y);
  }
  for (let i = b.length; i < a.length; i++) live.removeChild(a[i]!);
}

function patchNode(live: Node, next: Node): void {
  if (live.nodeType === Node.TEXT_NODE || live.nodeType === Node.COMMENT_NODE) {
    if (live.nodeValue !== next.nodeValue) live.nodeValue = next.nodeValue;
    return;
  }
  const a = live as Element;
  const b = next as Element;
  for (const attr of Array.from(a.attributes)) {
    if (!b.hasAttribute(attr.name)) a.removeAttribute(attr.name);
  }
  for (const attr of Array.from(b.attributes)) {
    if (a.getAttribute(attr.name) !== attr.value) a.setAttribute(attr.name, attr.value);
  }
  // Keep `disabled` in sync as a property too; the attribute alone lags on some browsers.
  if (a instanceof HTMLButtonElement) a.disabled = b.hasAttribute('disabled');
  patchChildren(a, b);
}
