import { describe, expect, it } from 'vitest';
import { ContentParseError, parseManifest, parseStory } from '../src/content/parse';

const MINIMAL_STORY: Record<string, any> = {
  formatVersion: 1,
  id: 'demo',
  title: 'Demo',
  start: 'a',
  variables: { seen: false },
  nodes: {
    a: {
      blocks: [{ type: 'text', text: 'Hello.' }],
      choices: [{ text: 'Go', to: 'b' }],
    },
    b: {
      blocks: [{ type: 'text', text: 'Bye.' }],
      ending: { kind: 'neutral', title: 'The End' },
    },
  },
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('parseStory — happy path', () => {
  it('parses a minimal valid story', () => {
    const story = parseStory(MINIMAL_STORY);
    expect(story.id).toBe('demo');
    expect(story.nodes['a']?.choices?.[0]?.to).toBe('b');
    expect(story.nodes['b']?.ending?.kind).toBe('neutral');
  });

  it('leaves unknown fields alone rather than failing', () => {
    const withExtra = { ...clone(MINIMAL_STORY), somethingFuture: 'ignored' };
    expect(() => parseStory(withExtra)).not.toThrow();
  });

  it('parses every block style and every condition/mutation shape', () => {
    const story = clone(MINIMAL_STORY);
    story.variables = { hasLantern: false, trust: 0, pocket: [] as string[] };
    story.nodes.a.blocks = [
      { type: 'text', text: 'Trust: {trust}, *lantern*: {hasLantern}', style: 'whisper' },
      { type: 'image', src: 'images/x.png', alt: 'x', caption: 'cap' },
    ];
    story.nodes.a.choices = [
      {
        text: 'Go',
        to: 'b',
        if: {
          all: [
            { var: 'trust', gte: 0 },
            { any: [{ var: 'hasLantern', eq: true }, { not: { visited: 'b' } }] },
            { var: 'pocket', has: 'key' },
          ],
        },
        whenLocked: 'disable',
        lockedText: 'locked',
        set: [
          { var: 'trust', op: 'add', value: 1 },
          { var: 'trust', op: 'sub', value: 1 },
          { var: 'trust', op: 'set', value: 5 },
          { var: 'hasLantern', op: 'toggle' },
          { var: 'pocket', op: 'push', value: 'key' },
          { var: 'pocket', op: 'remove', value: 'key' },
        ],
        once: true,
      },
    ];
    expect(() => parseStory(story)).not.toThrow();
  });

  it('parses a full theme block, story-level and node-level', () => {
    const story = clone(MINIMAL_STORY) as Record<string, unknown>;
    story['theme'] = {
      mode: 'light',
      palette: { bg: '#fff', accent: '#123abc' },
      font: { body: 'serif', display: 'mono', scale: 1.1 },
      background: { image: 'images/bg.png', fit: 'contain', overlay: 0.3 },
      radius: 8,
    };
    const parsed = parseStory(story);
    expect(parsed.theme?.font?.scale).toBe(1.1);
  });
});

describe('parseStory — precise, path-tagged errors', () => {
  it('rejects a non-object', () => {
    expect(() => parseStory('nope')).toThrow(ContentParseError);
  });

  it('reports the JSON path of a bad choice.to type', () => {
    const story = clone(MINIMAL_STORY) as Record<string, any>;
    story.nodes.a.choices[0].to = 42;
    try {
      parseStory(story);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ContentParseError);
      expect((error as ContentParseError).path).toBe('$.nodes.a.choices[0].to');
    }
  });

  it('rejects a node with neither choices nor ending', () => {
    const story = clone(MINIMAL_STORY) as Record<string, any>;
    delete story.nodes.b.ending;
    expect(() => parseStory(story)).toThrow(/must declare "ending"/);
  });

  it('rejects a node declaring both choices and ending', () => {
    const story = clone(MINIMAL_STORY) as Record<string, any>;
    story.nodes.b.choices = [{ text: 'Go', to: 'a' }];
    expect(() => parseStory(story)).toThrow(/must not declare "ending"/);
  });

  it('rejects an image block with empty alt', () => {
    const story = clone(MINIMAL_STORY) as Record<string, any>;
    story.nodes.a.blocks.push({ type: 'image', src: 'x.png', alt: '  ' });
    expect(() => parseStory(story)).toThrow(/alt/);
  });

  it('rejects an unknown block type', () => {
    const story = clone(MINIMAL_STORY) as Record<string, any>;
    story.nodes.a.blocks.push({ type: 'video', src: 'x.mp4' });
    expect(() => parseStory(story)).toThrow(/unknown block type/);
  });

  it('rejects a condition with zero comparison keys', () => {
    const story = clone(MINIMAL_STORY) as Record<string, any>;
    story.nodes.a.choices[0].if = { var: 'seen' };
    expect(() => parseStory(story)).toThrow(/exactly one comparison key/);
  });

  it('rejects a condition with two comparison keys', () => {
    const story = clone(MINIMAL_STORY) as Record<string, any>;
    story.nodes.a.choices[0].if = { var: 'seen', eq: true, ne: false };
    expect(() => parseStory(story)).toThrow(/exactly one comparison key/);
  });

  it('rejects an unrecognized condition shape', () => {
    const story = clone(MINIMAL_STORY) as Record<string, any>;
    story.nodes.a.choices[0].if = { nonsense: true };
    expect(() => parseStory(story)).toThrow(ContentParseError);
  });

  it('rejects an unknown mutation op', () => {
    const story = clone(MINIMAL_STORY) as Record<string, any>;
    story.nodes.a.choices[0].set = [{ var: 'seen', op: 'multiply', value: 2 }];
    expect(() => parseStory(story)).toThrow(/unknown op/);
  });

  it('rejects a variable value that is not boolean/number/string/string[]', () => {
    const story = clone(MINIMAL_STORY) as Record<string, any>;
    story.variables.bad = { nested: true };
    expect(() => parseStory(story)).toThrow(ContentParseError);
  });

  it('rejects formatVersion other than 1', () => {
    const story = clone(MINIMAL_STORY) as Record<string, any>;
    story.formatVersion = 2;
    expect(() => parseStory(story)).toThrow(/formatVersion/);
  });

  it('rejects an out-of-range enum, e.g. an unknown block style', () => {
    const story = clone(MINIMAL_STORY) as Record<string, any>;
    story.nodes.a.blocks[0].style = 'sparkly';
    expect(() => parseStory(story)).toThrow(/unknown style/);
  });

  it('never throws anything other than ContentParseError on malformed input', () => {
    const cases: unknown[] = [null, undefined, 42, [], 'x', {}, { formatVersion: 1 }];
    for (const bad of cases) {
      try {
        parseStory(bad);
        expect.unreachable(`expected ${JSON.stringify(bad)} to fail`);
      } catch (error) {
        expect(error).toBeInstanceOf(ContentParseError);
      }
    }
  });
});

describe('parseManifest', () => {
  const MINIMAL_MANIFEST = {
    formatVersion: 1,
    stories: [
      { id: 'demo', title: 'Demo', blurb: 'A demo.', path: 'demo/story.json' },
    ],
  };

  it('parses a minimal valid manifest', () => {
    const manifest = parseManifest(MINIMAL_MANIFEST);
    expect(manifest.stories).toHaveLength(1);
    expect(manifest.stories[0]?.id).toBe('demo');
  });

  it('parses optional fields when present', () => {
    const withExtras = clone(MINIMAL_MANIFEST);
    (withExtras.stories[0] as Record<string, unknown>)['author'] = 'A';
    (withExtras.stories[0] as Record<string, unknown>)['cover'] = 'demo/cover.png';
    (withExtras.stories[0] as Record<string, unknown>)['tags'] = ['a', 'b'];
    (withExtras.stories[0] as Record<string, unknown>)['estimatedMinutes'] = 5;
    const manifest = parseManifest(withExtras);
    expect(manifest.stories[0]?.tags).toEqual(['a', 'b']);
  });

  it('rejects a manifest missing "stories"', () => {
    expect(() => parseManifest({ formatVersion: 1 })).toThrow(ContentParseError);
  });

  it('rejects a manifest entry missing a required field', () => {
    const bad = clone(MINIMAL_MANIFEST) as Record<string, any>;
    delete bad.stories[0].blurb;
    expect(() => parseManifest(bad)).toThrow(/blurb/);
  });
});
