// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderInline } from '../src/content/inline';
import type { VariableTable } from '../src/content/types';

function html(text: string, vars: VariableTable = {}): string {
  const div = document.createElement('div');
  div.append(renderInline(text, vars));
  return div.innerHTML;
}

function plain(text: string, vars: VariableTable = {}): string {
  const div = document.createElement('div');
  div.append(renderInline(text, vars));
  return div.textContent ?? '';
}

describe('renderInline — plain text', () => {
  it('passes ordinary text through untouched', () => {
    expect(plain('Hello, world.')).toBe('Hello, world.');
  });

  it('handles an empty string', () => {
    expect(plain('')).toBe('');
  });
});

describe('renderInline — interpolation', () => {
  it('substitutes a string variable', () => {
    expect(plain('Name: {name}', { name: 'Vail' })).toBe('Name: Vail');
  });

  it('substitutes a number variable', () => {
    expect(plain('Trust: {trust}', { trust: 3 })).toBe('Trust: 3');
  });

  it('renders a boolean as true/false', () => {
    expect(plain('Lit: {hasLantern}', { hasLantern: true })).toBe('Lit: true');
    expect(plain('Lit: {hasLantern}', { hasLantern: false })).toBe('Lit: false');
  });

  it('joins a list with ", "', () => {
    expect(plain('Carrying {pocket}.', { pocket: ['key', 'coin'] })).toBe('Carrying key, coin.');
  });

  it('renders an undeclared variable as empty rather than throwing', () => {
    expect(() => plain('Ghost: {ghost}', {})).not.toThrow();
    expect(plain('Ghost: {ghost}.', {})).toBe('Ghost: .');
  });
});

describe('renderInline — emphasis', () => {
  it('wraps *text* in <em>', () => {
    expect(html('a *b* c')).toBe('a <em>b</em> c');
  });

  it('wraps **text** in <strong>, preferring it over single-star', () => {
    expect(html('a **b** c')).toBe('a <strong>b</strong> c');
  });

  it('wraps _text_ in <u>', () => {
    expect(html('a _b_ c')).toBe('a <u>b</u> c');
  });

  it('does not nest — markup inside a span is left literal', () => {
    expect(html('*a _b_ c*')).toBe('<em>a _b_ c</em>');
  });
});

describe('renderInline — escaping', () => {
  it('renders \\* as a literal asterisk, not emphasis', () => {
    expect(plain('\\*not bold\\*')).toBe('*not bold*');
    expect(html('\\*not bold\\*')).toBe('*not bold*');
  });

  it('renders \\{ as a literal brace, not interpolation', () => {
    expect(plain('\\{not a var\\}')).toBe('{not a var}');
  });
});

describe('renderInline — a variable value is never rescanned for markup', () => {
  it('inserts asterisks from a variable as plain text', () => {
    // This is the format.md §9 correction: interpolation and emphasis run in
    // one combined scan, so a value substituted in can't retroactively open
    // or close a markup span.
    expect(html('Note: {note} end', { note: 'wow *this*' })).toBe('Note: wow *this* end');
  });
});

describe('renderInline — HTML safety', () => {
  it('never produces markup from story text, only from the fixed emphasis syntax', () => {
    const out = html('<script>alert(1)</script>');
    expect(out).not.toContain('<script>');
    expect(plain('<script>alert(1)</script>')).toBe('<script>alert(1)</script>');
  });

  it('renders a variable containing HTML-like text as literal characters', () => {
    const out = html('{payload}', { payload: '<img src=x onerror=alert(1)>' });
    expect(out).not.toContain('<img');
    expect(plain('{payload}', { payload: '<img src=x onerror=alert(1)>' })).toBe(
      '<img src=x onerror=alert(1)>',
    );
  });
});
