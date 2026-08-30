// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildPortableStory } from '../src/ui/exportPortable';
import type { Story } from '../src/content/types';

const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAbitOmMAAAAASUVORK5CYII=';

const STORY: Story = {
  formatVersion: 1,
  id: 'porch-light',
  title: 'The Porch Light',
  start: 'a',
  variables: {},
  theme: { background: { image: 'images/paper.png' } },
  nodes: {
    a: {
      blocks: [
        { type: 'text', text: 'hi' },
        { type: 'image', src: 'images/dock.png', alt: 'A dock.' },
      ],
      choices: [{ text: 'go', to: 'b' }],
    },
    b: {
      blocks: [{ type: 'text', text: 'bye' }],
      ending: { kind: 'neutral', title: 'End' },
    },
  },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('buildPortableStory', () => {
  it('leaves an already-embedded (data:) src untouched, without fetching', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const resolveAsset = () => TINY_PNG; // every path resolves straight to a data: URI already

    const portable = await buildPortableStory(STORY, resolveAsset, {});

    expect(fetchSpy).not.toHaveBeenCalled();
    const imageBlock = portable.nodes['a']?.blocks[1];
    expect(imageBlock?.type).toBe('image');
    if (imageBlock?.type === 'image') expect(imageBlock.src).toBe(TINY_PNG);
    expect(portable.theme?.background?.image).toBe(TINY_PNG);
  });

  it('fetches and embeds a real (non-data:) resolved src', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    // A fresh Response per call — STORY references two images (a node image
    // and the theme background), and a Response body can only be read once.
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response(bytes, { headers: { 'content-type': 'image/png' } }),
    );
    const resolveAsset = (relativeSrc: string) => `https://example.test/${relativeSrc}`;

    const portable = await buildPortableStory(STORY, resolveAsset, {});

    const imageBlock = portable.nodes['a']?.blocks[1];
    expect(imageBlock?.type).toBe('image');
    if (imageBlock?.type === 'image') expect(imageBlock.src).toMatch(/^data:image\/png;base64,/);
    expect(portable.theme?.background?.image).toMatch(/^data:image\/png;base64,/);
  });

  it('folds in the caller-supplied display fields', async () => {
    const resolveAsset = () => TINY_PNG;
    const portable = await buildPortableStory(STORY, resolveAsset, {
      blurb: 'A short one.',
      tags: ['short'],
      estimatedMinutes: 3,
    });
    expect(portable.blurb).toBe('A short one.');
    expect(portable.tags).toEqual(['short']);
    expect(portable.estimatedMinutes).toBe(3);
  });

  it('falls back to the story\'s own fields when display fields are omitted', async () => {
    const storyWithOwnFields: Story = { ...STORY, blurb: 'Already portable.', tags: ['folk tale'] };
    const resolveAsset = () => TINY_PNG;
    const portable = await buildPortableStory(storyWithOwnFields, resolveAsset, {});
    expect(portable.blurb).toBe('Already portable.');
    expect(portable.tags).toEqual(['folk tale']);
  });

  it('does not mutate the original story', async () => {
    const resolveAsset = () => TINY_PNG;
    const before = JSON.stringify(STORY);
    await buildPortableStory(STORY, resolveAsset, { blurb: 'x' });
    expect(JSON.stringify(STORY)).toBe(before);
  });
});
