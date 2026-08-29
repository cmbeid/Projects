/**
 * format.md §9: interpolation and emphasis, in one left-to-right scan rather
 * than two passes — so a variable's own value is inserted as an opaque text
 * run and never rescanned for markup. Never uses `innerHTML`: every run
 * becomes a real text node or element, so `<script>` in content renders as
 * the literal characters, not as markup. `inline.test.ts` pins that as a
 * security property, not just a behaviour.
 */
import type { VarValue, VariableTable } from './types';

const TOKEN_RE =
  /\\([*_{}])|\*\*([\s\S]+?)\*\*|\*([\s\S]+?)\*|_([\s\S]+?)_|\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

function stringifyVar(value: VarValue | undefined): string {
  if (value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

export function renderInline(text: string, vars: VariableTable): DocumentFragment {
  const fragment = document.createDocumentFragment();
  let lastIndex = 0;

  for (const match of text.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) fragment.append(document.createTextNode(text.slice(lastIndex, index)));

    const [, escaped, bold, italic, underline, varName] = match;
    if (escaped !== undefined) {
      fragment.append(document.createTextNode(escaped));
    } else if (bold !== undefined) {
      const strong = document.createElement('strong');
      strong.textContent = bold;
      fragment.append(strong);
    } else if (italic !== undefined) {
      const em = document.createElement('em');
      em.textContent = italic;
      fragment.append(em);
    } else if (underline !== undefined) {
      const u = document.createElement('u');
      u.textContent = underline;
      fragment.append(u);
    } else if (varName !== undefined) {
      fragment.append(document.createTextNode(stringifyVar(vars[varName])));
    }

    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) fragment.append(document.createTextNode(text.slice(lastIndex)));

  return fragment;
}
