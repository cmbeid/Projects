import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseManifest, parseStory } from '../src/content/parse';
import { validateManifest, validateStory } from '../src/content/validate';
import type { Story } from '../src/content/types';

const BASE: Story = {
  formatVersion: 1,
  id: 'demo',
  title: 'Demo',
  start: 'a',
  variables: { flag: false, count: 0, name: 'x', bag: [] },
  nodes: {
    a: { blocks: [{ type: 'text', text: 'hi' }], choices: [{ text: 'go', to: 'b' }] },
    b: { blocks: [{ type: 'text', text: 'bye' }], ending: { kind: 'neutral', title: 'End' } },
  },
};

function withNodes(nodes: Story['nodes'], overrides: Partial<Story> = {}): Story {
  return { ...BASE, ...overrides, nodes };
}

describe('validateStory — integrity', () => {
  it('passes a clean story with no errors or warnings', () => {
    const report = validateStory(BASE);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
  });

  it('flags a choice.to naming a node that does not exist', () => {
    const story = withNodes({
      a: { blocks: [{ type: 'text', text: 'hi' }], choices: [{ text: 'go', to: 'nowhere' }] },
    });
    const report = validateStory(story);
    expect(report.errors).toContain('nodes.a.choices[0].to: node "nowhere" does not exist');
  });

  it('flags start naming a node that does not exist', () => {
    const story = withNodes(BASE.nodes, { start: 'missing' });
    const report = validateStory(story);
    expect(report.errors.some((e) => e.startsWith('start:'))).toBe(true);
  });

  it('flags a visited condition naming a nonexistent node', () => {
    const story = withNodes({
      a: {
        blocks: [{ type: 'text', text: 'hi' }],
        choices: [{ text: 'go', to: 'b', if: { visited: 'ghost' } }],
      },
      b: BASE.nodes['b']!,
    });
    const report = validateStory(story);
    expect(report.errors.some((e) => e.includes('"ghost" does not exist'))).toBe(true);
  });

  it('flags an undeclared variable in a condition', () => {
    const story = withNodes({
      a: {
        blocks: [{ type: 'text', text: 'hi' }],
        choices: [{ text: 'go', to: 'b', if: { var: 'nope', eq: true } }],
      },
      b: BASE.nodes['b']!,
    });
    expect(validateStory(story).errors.some((e) => e.includes('"nope" is not declared'))).toBe(true);
  });

  it('flags an undeclared variable in interpolated text', () => {
    const story = withNodes({
      a: { blocks: [{ type: 'text', text: 'You have {ghost}.' }], choices: [{ text: 'go', to: 'b' }] },
      b: BASE.nodes['b']!,
    });
    expect(validateStory(story).errors.some((e) => e.includes('{ghost}'))).toBe(true);
  });

  it('does not flag an escaped interpolation', () => {
    const story = withNodes({
      a: { blocks: [{ type: 'text', text: 'Literal \\{ghost\\} brace.' }], choices: [{ text: 'go', to: 'b' }] },
      b: BASE.nodes['b']!,
    });
    expect(validateStory(story).errors).toEqual([]);
  });

  it('flags a type mismatch: eq against the wrong type', () => {
    const story = withNodes({
      a: {
        blocks: [{ type: 'text', text: 'hi' }],
        choices: [{ text: 'go', to: 'b', if: { var: 'count', eq: 'oops' } }],
      },
      b: BASE.nodes['b']!,
    });
    expect(validateStory(story).errors.some((e) => e.includes('compared against a string'))).toBe(true);
  });

  it('flags gte against a non-number variable', () => {
    const story = withNodes({
      a: {
        blocks: [{ type: 'text', text: 'hi' }],
        choices: [{ text: 'go', to: 'b', if: { var: 'name', gte: 1 } }],
      },
      b: BASE.nodes['b']!,
    });
    expect(validateStory(story).errors.some((e) => e.includes('not a number'))).toBe(true);
  });

  it('flags has against a non-list variable', () => {
    const story = withNodes({
      a: {
        blocks: [{ type: 'text', text: 'hi' }],
        choices: [{ text: 'go', to: 'b', if: { var: 'count', has: 'x' } }],
      },
      b: BASE.nodes['b']!,
    });
    expect(validateStory(story).errors.some((e) => e.includes('not a list'))).toBe(true);
  });

  it('flags add on a non-number variable', () => {
    const story = withNodes({
      a: {
        blocks: [{ type: 'text', text: 'hi' }],
        onEnter: [{ var: 'flag', op: 'add', value: 1 }],
        choices: [{ text: 'go', to: 'b' }],
      },
      b: BASE.nodes['b']!,
    });
    expect(validateStory(story).errors.some((e) => e.includes('needs a number variable'))).toBe(true);
  });

  it('flags toggle on a non-boolean variable', () => {
    const story = withNodes({
      a: {
        blocks: [{ type: 'text', text: 'hi' }],
        onEnter: [{ var: 'count', op: 'toggle' }],
        choices: [{ text: 'go', to: 'b' }],
      },
      b: BASE.nodes['b']!,
    });
    expect(validateStory(story).errors.some((e) => e.includes('needs a boolean variable'))).toBe(true);
  });

  it('flags push on a non-list variable', () => {
    const story = withNodes({
      a: {
        blocks: [{ type: 'text', text: 'hi' }],
        onEnter: [{ var: 'name', op: 'push', value: 'x' }],
        choices: [{ text: 'go', to: 'b' }],
      },
      b: BASE.nodes['b']!,
    });
    expect(validateStory(story).errors.some((e) => e.includes('needs a list variable'))).toBe(true);
  });

  it('flags set with a value of the wrong type', () => {
    const story = withNodes({
      a: {
        blocks: [{ type: 'text', text: 'hi' }],
        onEnter: [{ var: 'flag', op: 'set', value: 'nope' as unknown as boolean }],
        choices: [{ text: 'go', to: 'b' }],
      },
      b: BASE.nodes['b']!,
    });
    expect(validateStory(story).errors.some((e) => e.includes('given a string value'))).toBe(true);
  });
});

describe('validateStory — reachability', () => {
  it('flags a node no choice ever points to', () => {
    const story = withNodes({
      a: { blocks: [{ type: 'text', text: 'hi' }], choices: [{ text: 'go', to: 'a' }] },
      orphan: { blocks: [{ type: 'text', text: 'lost' }], ending: { kind: 'neutral', title: 'x' } },
    });
    expect(validateStory(story).errors).toContain('nodes.orphan: unreachable from "a"');
  });

  it('does not flag a node only reachable through a conditional choice', () => {
    const story = withNodes({
      a: {
        blocks: [{ type: 'text', text: 'hi' }],
        choices: [{ text: 'go', to: 'b', if: { var: 'flag', eq: true } }],
      },
      b: BASE.nodes['b']!,
    });
    expect(validateStory(story).errors.some((e) => e.includes('unreachable'))).toBe(false);
  });
});

describe('validateStory — unsatisfiable-condition warning', () => {
  it('warns when a condition compares eq against a value the variable can never hold', () => {
    const story = withNodes({
      a: {
        blocks: [{ type: 'text', text: 'hi' }],
        choices: [{ text: 'go', to: 'b', if: { var: 'name', eq: 'never-set-to-this' } }],
      },
      b: BASE.nodes['b']!,
    });
    expect(validateStory(story).warnings.some((w) => w.includes('can never be true'))).toBe(true);
  });

  it('does not warn once a set mutation makes that value reachable', () => {
    const story = withNodes({
      a: {
        blocks: [{ type: 'text', text: 'hi' }],
        onEnter: [{ var: 'name', op: 'set', value: 'y' }],
        choices: [{ text: 'go', to: 'b', if: { var: 'name', eq: 'y' } }],
      },
      b: BASE.nodes['b']!,
    });
    expect(validateStory(story).warnings).toEqual([]);
  });

  it('does not warn once a relative op makes the variable untrackable', () => {
    const story = withNodes({
      a: {
        blocks: [{ type: 'text', text: 'hi' }],
        onEnter: [{ var: 'count', op: 'add', value: 1 }],
        choices: [{ text: 'go', to: 'b', if: { var: 'count', gte: 999 } }],
      },
      b: BASE.nodes['b']!,
    });
    expect(validateStory(story).warnings).toEqual([]);
  });

  it('warns on a node with a lot of text', () => {
    const story = withNodes({
      a: { blocks: [{ type: 'text', text: 'x'.repeat(1300) }], choices: [{ text: 'go', to: 'b' }] },
      b: BASE.nodes['b']!,
    });
    expect(validateStory(story).warnings.some((w) => w.includes('characters of text'))).toBe(true);
  });
});

describe('validateStory — images', () => {
  it('flags a missing image when an AssetChecker is provided', () => {
    const story = withNodes({
      a: {
        blocks: [
          { type: 'text', text: 'hi' },
          { type: 'image', src: 'images/missing.png', alt: 'x' },
        ],
        choices: [{ text: 'go', to: 'b' }],
      },
      b: BASE.nodes['b']!,
    });
    const report = validateStory(story, { imageExists: () => false });
    expect(report.errors.some((e) => e.includes('not found'))).toBe(true);
  });

  it('skips the image check entirely with no AssetChecker', () => {
    const story = withNodes({
      a: {
        blocks: [
          { type: 'text', text: 'hi' },
          { type: 'image', src: 'images/missing.png', alt: 'x' },
        ],
        choices: [{ text: 'go', to: 'b' }],
      },
      b: BASE.nodes['b']!,
    });
    expect(validateStory(story).errors).toEqual([]);
  });
});

describe('validateManifest', () => {
  it('flags a duplicate story id', () => {
    const manifest = {
      formatVersion: 1 as const,
      stories: [
        { id: 'x', title: 'X', blurb: 'x', path: 'x/story.json' },
        { id: 'x', title: 'X2', blurb: 'x2', path: 'x2/story.json' },
      ],
    };
    expect(validateManifest(manifest).errors.some((e) => e.includes('duplicate story id'))).toBe(true);
  });
});

describe('the shipped demo content', () => {
  const contentDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'content');

  it('passes the full validator with zero errors', () => {
    const manifest = parseManifest(JSON.parse(readFileSync(join(contentDir, 'index.json'), 'utf-8')));
    expect(validateManifest(manifest).errors).toEqual([]);

    for (const entry of manifest.stories) {
      const storyPath = join(contentDir, entry.path);
      const storyDir = dirname(storyPath);
      const story = parseStory(JSON.parse(readFileSync(storyPath, 'utf-8')));
      expect(story.id).toBe(entry.id);
      const report = validateStory(story, {
        imageExists: (relativeSrc) => existsSync(join(storyDir, relativeSrc)),
      });
      expect(report.errors).toEqual([]);
    }
  });
});
