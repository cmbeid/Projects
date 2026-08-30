// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { ImportError, importLocalStory, listLocalStories, removeLocalStory } from '../src/state/localStories';

const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function storyJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    formatVersion: 1,
    id: 'porch-light',
    title: 'The Porch Light',
    blurb: 'A short one.',
    start: 'a',
    variables: {},
    nodes: {
      a: {
        blocks: [{ type: 'text', text: 'hi' }],
        ending: { kind: 'neutral', title: 'End' },
      },
    },
    ...overrides,
  });
}

beforeEach(() => {
  localStorage.clear();
});

describe('importLocalStory', () => {
  it('rejects text that is not JSON', () => {
    expect(() => importLocalStory('not json at all', new Set())).toThrow(ImportError);
  });

  it('rejects a story that fails parsing', () => {
    expect(() => importLocalStory('{"formatVersion": 1}', new Set())).toThrow(ImportError);
  });

  it('rejects a story that fails content validation', () => {
    const broken = storyJson({ start: 'nowhere' });
    expect(() => importLocalStory(broken, new Set())).toThrow(/nowhere/);
  });

  it('rejects an id that collides with a shipped story', () => {
    expect(() => importLocalStory(storyJson(), new Set(['porch-light']))).toThrow(/already the id/);
  });

  it('rejects an image with a relative (non-embedded) src', () => {
    const withImage = storyJson({
      nodes: {
        a: {
          blocks: [
            { type: 'image', src: 'images/porch.png', alt: 'A porch.' },
            { type: 'text', text: 'hi' },
          ],
          ending: { kind: 'neutral', title: 'End' },
        },
      },
    });
    expect(() => importLocalStory(withImage, new Set())).toThrow(/data: URI/);
  });

  it('accepts a story whose only image is embedded as a data: URI', () => {
    const withImage = storyJson({
      nodes: {
        a: {
          blocks: [
            { type: 'image', src: TINY_PNG, alt: 'A porch.' },
            { type: 'text', text: 'hi' },
          ],
          ending: { kind: 'neutral', title: 'End' },
        },
      },
    });
    const result = importLocalStory(withImage, new Set());
    expect(result.id).toBe('porch-light');
  });

  it('stores a valid story so it shows up in listLocalStories', () => {
    importLocalStory(storyJson(), new Set());
    const listed = listLocalStories();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.story.title).toBe('The Porch Light');
  });

  it('re-importing the same id overwrites rather than duplicates', () => {
    importLocalStory(storyJson(), new Set());
    importLocalStory(storyJson({ title: 'The Porch Light, Revised' }), new Set());
    const listed = listLocalStories();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.story.title).toBe('The Porch Light, Revised');
  });
});

describe('removeLocalStory', () => {
  it('removes a story so it no longer lists', () => {
    importLocalStory(storyJson(), new Set());
    expect(listLocalStories()).toHaveLength(1);
    removeLocalStory('porch-light');
    expect(listLocalStories()).toHaveLength(0);
  });

  it('is a no-op for an id that was never imported', () => {
    expect(() => removeLocalStory('never-existed')).not.toThrow();
  });
});

describe('listLocalStories', () => {
  it('is empty with nothing imported', () => {
    expect(listLocalStories()).toEqual([]);
  });

  it('skips a corrupt entry rather than throwing', () => {
    importLocalStory(storyJson(), new Set());
    localStorage.setItem('storied:local:index', JSON.stringify(['porch-light', 'ghost']));
    localStorage.setItem('storied:local:story:ghost', '{not json');
    expect(() => listLocalStories()).not.toThrow();
    expect(listLocalStories().map((s) => s.id)).toEqual(['porch-light']);
  });
});
