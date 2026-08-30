// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import {
  ImportError,
  importLocalFolder,
  importLocalStory,
  listLocalStories,
  loadLocalStoryAssets,
  removeLocalStory,
} from '../src/state/localStories';

const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAbitOmMAAAAASUVORK5CYII=';

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

function file(name: string, content: string, type = 'application/json'): File {
  return new File([content], name, { type });
}

// jsdom doesn't implement Blob URLs at all (real browsers do) — a minimal
// stand-in so loadLocalStoryAssets has something to call.
let blobUrlCounter = 0;
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => `blob:test-url/${blobUrlCounter++}`;
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = () => {};
}

beforeEach(async () => {
  // fake-indexeddb has no bulk reset; deleting and letting the next open()
  // recreate the schema is the same reset persistence.test.ts gets for free
  // from localStorage.clear().
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('storied-local');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
});

describe('importLocalStory', () => {
  it('rejects text that is not JSON', async () => {
    await expect(importLocalStory('not json at all', new Set())).rejects.toThrow(ImportError);
  });

  it('rejects a story that fails parsing', async () => {
    await expect(importLocalStory('{"formatVersion": 1}', new Set())).rejects.toThrow(ImportError);
  });

  it('rejects a story that fails content validation', async () => {
    const broken = storyJson({ start: 'nowhere' });
    await expect(importLocalStory(broken, new Set())).rejects.toThrow(/nowhere/);
  });

  it('rejects an id that collides with a shipped story', async () => {
    await expect(importLocalStory(storyJson(), new Set(['porch-light']))).rejects.toThrow(/already the id/);
  });

  it('rejects an image with a relative (non-embedded) src', async () => {
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
    await expect(importLocalStory(withImage, new Set())).rejects.toThrow(/data: URI/);
  });

  it('accepts a story whose only image is embedded as a data: URI', async () => {
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
    const result = await importLocalStory(withImage, new Set());
    expect(result.id).toBe('porch-light');
    expect(result.kind).toBe('portable');
  });

  it('stores a valid story so it shows up in listLocalStories', async () => {
    await importLocalStory(storyJson(), new Set());
    const listed = await listLocalStories();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.story.title).toBe('The Porch Light');
  });

  it('re-importing the same id overwrites rather than duplicates', async () => {
    await importLocalStory(storyJson(), new Set());
    await importLocalStory(storyJson({ title: 'The Porch Light, Revised' }), new Set());
    const listed = await listLocalStories();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.story.title).toBe('The Porch Light, Revised');
  });
});

describe('importLocalFolder', () => {
  const storyFile = file(
    'story.json',
    JSON.stringify({
      formatVersion: 1,
      id: 'porch-light',
      title: 'The Porch Light',
      start: 'a',
      variables: {},
      nodes: {
        a: {
          blocks: [
            { type: 'text', text: 'hi' },
            { type: 'image', src: 'images/porch.png', alt: 'A porch.' },
          ],
          ending: { kind: 'neutral', title: 'End' },
        },
      },
    }),
  );

  it('accepts a story whose images are all present among the selected files', async () => {
    const assets = new Map([['images/porch.png', file('porch.png', 'fake-bytes', 'image/png')]]);
    const result = await importLocalFolder(storyFile, assets, new Set());
    expect(result.id).toBe('porch-light');
    expect(result.kind).toBe('folder');
  });

  it('rejects a story referencing an image that was not selected', async () => {
    await expect(importLocalFolder(storyFile, new Map(), new Set())).rejects.toThrow(/not found/);
  });

  it('rejects an id that collides with a shipped story', async () => {
    const assets = new Map([['images/porch.png', file('porch.png', 'fake-bytes', 'image/png')]]);
    await expect(importLocalFolder(storyFile, assets, new Set(['porch-light']))).rejects.toThrow(/already the id/);
  });

  it('stores every asset so loadLocalStoryAssets can resolve them', async () => {
    const assets = new Map([['images/porch.png', file('porch.png', 'fake-bytes', 'image/png')]]);
    await importLocalFolder(storyFile, assets, new Set());
    const loaded = await loadLocalStoryAssets('porch-light');
    expect(loaded.has('images/porch.png')).toBe(true);
    expect(loaded.get('images/porch.png')).toMatch(/^blob:/);
  });

  it('a re-import as portable clears stale assets from an earlier folder import', async () => {
    const assets = new Map([['images/porch.png', file('porch.png', 'fake-bytes', 'image/png')]]);
    await importLocalFolder(storyFile, assets, new Set());
    expect((await loadLocalStoryAssets('porch-light')).size).toBe(1);

    await importLocalStory(storyJson(), new Set());
    expect((await loadLocalStoryAssets('porch-light')).size).toBe(0);
  });
});

describe('removeLocalStory', () => {
  it('removes a story so it no longer lists', async () => {
    await importLocalStory(storyJson(), new Set());
    expect(await listLocalStories()).toHaveLength(1);
    await removeLocalStory('porch-light');
    expect(await listLocalStories()).toHaveLength(0);
  });

  it('is a no-op for an id that was never imported', async () => {
    await expect(removeLocalStory('never-existed')).resolves.not.toThrow();
  });

  it('also removes a folder import\'s stored assets', async () => {
    const storyFile = file(
      'story.json',
      JSON.stringify({
        formatVersion: 1,
        id: 'porch-light',
        title: 'The Porch Light',
        start: 'a',
        variables: {},
        nodes: { a: { blocks: [{ type: 'text', text: 'hi' }], ending: { kind: 'neutral', title: 'End' } } },
      }),
    );
    const assets = new Map([['images/porch.png', file('porch.png', 'fake-bytes', 'image/png')]]);
    await importLocalFolder(storyFile, assets, new Set());
    await removeLocalStory('porch-light');
    expect((await loadLocalStoryAssets('porch-light')).size).toBe(0);
  });
});

describe('listLocalStories', () => {
  it('is empty with nothing imported', async () => {
    expect(await listLocalStories()).toEqual([]);
  });

  it('orders oldest-imported first', async () => {
    await importLocalStory(storyJson({ id: 'first', title: 'First' }), new Set());
    await importLocalStory(storyJson({ id: 'second', title: 'Second' }), new Set());
    const listed = await listLocalStories();
    expect(listed.map((s) => s.id)).toEqual(['first', 'second']);
  });
});

describe('loadLocalStoryAssets', () => {
  it('is empty for a portable story, which has no asset records', async () => {
    await importLocalStory(storyJson(), new Set());
    expect((await loadLocalStoryAssets('porch-light')).size).toBe(0);
  });

  it('is empty for an id nothing was ever imported under', async () => {
    expect((await loadLocalStoryAssets('never-existed')).size).toBe(0);
  });
});
