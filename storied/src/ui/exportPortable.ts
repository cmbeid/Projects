/**
 * Reassembles a `Story` as a portable file (format.md §14, offline.md's
 * "export"): every image `fetch`ed through its resolver and re-encoded as a
 * `data:` URI, and the given display fields folded onto the story's own
 * top level — standing in for the manifest entry an exported file won't
 * have. Never mutates `story`; returns a new one, ready to
 * `JSON.stringify` straight to a file. In `ui/`, not `content/` — unlike
 * everything else under `content/`, this needs `fetch`, `Blob`, and
 * `FileReader`, so it isn't pure/DOM-free the way that layer otherwise is.
 *
 * Works for both directions this project ships: a *shipped* story's images
 * are ordinary `fetch`able paths and get embedded for the first time; an
 * already-*local* story's are already `data:` URIs (a portable import) or
 * Blob-backed `blob:` object URLs (a folder import) — `toDataUrl` below is
 * a no-op passthrough for the former, and a fetch-and-encode of the
 * (page-lifetime) object URL for the latter — either way the result is
 * self-contained on disk, unlike a `blob:` URL, which isn't.
 */
import type { PartialTheme, Story, StoryNode, Theme } from '../content/types';
import type { AssetResolver } from './theme';

export interface ExportDisplayFields {
  blurb?: string;
  /** Already a fetchable URL or a `data:` URI — the caller resolves it (a manifest `cover` uses a different base than a story's own node images do). */
  cover?: string;
  tags?: string[];
  estimatedMinutes?: number;
}

const BASE64_CHUNK_SIZE = 0x8000; // spreading a huge byte array into String.fromCharCode at once can overflow the call stack

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK_SIZE));
  }
  return btoa(binary);
}

async function toDataUrl(src: string): Promise<string> {
  if (src.startsWith('data:')) return src;
  const response = await fetch(src);
  const blob = await response.blob();
  const base64 = arrayBufferToBase64(await blob.arrayBuffer());
  return `data:${blob.type || 'application/octet-stream'};base64,${base64}`;
}

async function embedThemeBackground<T extends Theme | PartialTheme>(
  theme: T | undefined,
  resolveAsset: AssetResolver,
): Promise<T | undefined> {
  if (!theme?.background?.image) return theme;
  const embedded = await toDataUrl(resolveAsset(theme.background.image));
  return { ...theme, background: { ...theme.background, image: embedded } };
}

async function embedNode(node: StoryNode, resolveAsset: AssetResolver): Promise<StoryNode> {
  const blocks = await Promise.all(
    node.blocks.map(async (block) => (block.type === 'image' ? { ...block, src: await toDataUrl(resolveAsset(block.src)) } : block)),
  );
  const theme = await embedThemeBackground(node.theme, resolveAsset);
  return { ...node, blocks, ...(theme !== undefined ? { theme } : {}) };
}

export async function buildPortableStory(
  story: Story,
  resolveAsset: AssetResolver,
  display: ExportDisplayFields,
): Promise<Story> {
  const nodeEntries = await Promise.all(
    Object.entries(story.nodes).map(async ([nodeId, node]) => [nodeId, await embedNode(node, resolveAsset)] as const),
  );
  const nodes = Object.fromEntries(nodeEntries);

  const theme = await embedThemeBackground(story.theme, resolveAsset);

  const blurb = display.blurb ?? story.blurb;
  const tags = display.tags ?? story.tags;
  const estimatedMinutes = display.estimatedMinutes ?? story.estimatedMinutes;
  const rawCover = display.cover ?? story.cover;
  const cover = rawCover !== undefined ? await toDataUrl(rawCover) : undefined;

  return {
    ...story,
    ...(blurb !== undefined ? { blurb } : {}),
    ...(cover !== undefined ? { cover } : {}),
    ...(tags !== undefined ? { tags } : {}),
    ...(estimatedMinutes !== undefined ? { estimatedMinutes } : {}),
    ...(theme !== undefined ? { theme } : {}),
    nodes,
  };
}
