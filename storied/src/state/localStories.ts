/**
 * Stories imported from a local file, per format.md §14 — kept entirely in
 * this browser, never sent anywhere. Each is stored as the exact raw JSON
 * text the user picked, under its own key, plus a small ordered index so the
 * shelf can list them without scanning every localStorage key.
 *
 * This mirrors `persistence.ts`'s posture: never throw on bad storage state,
 * drop what can't be trusted, and let the shelf keep working regardless.
 */
import { ContentParseError, parseStory } from '../content/parse';
import { validateStory } from '../content/validate';
import type { Story } from '../content/types';

const INDEX_KEY = 'storied:local:index';

function storyKey(id: string): string {
  return `storied:local:story:${id}`;
}

export interface LocalStory {
  id: string;
  raw: string;
  story: Story;
}

export class ImportError extends Error {}

function readIndex(): string[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeIndex(ids: readonly string[]): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(ids));
  } catch {
    // Storage full, disabled, or private browsing — the import that called
    // this will surface its own failure separately.
  }
}

/** Every locally-imported story that's still readable. A corrupt entry is dropped, not thrown. */
export function listLocalStories(): LocalStory[] {
  const out: LocalStory[] = [];
  for (const id of readIndex()) {
    try {
      const raw = localStorage.getItem(storyKey(id));
      if (!raw) continue;
      out.push({ id, raw, story: parseStory(JSON.parse(raw)) });
    } catch {
      continue;
    }
  }
  return out;
}

export function removeLocalStory(id: string): void {
  try {
    localStorage.removeItem(storyKey(id));
  } catch {
    /* nothing to clean up if storage was never readable */
  }
  writeIndex(readIndex().filter((existing) => existing !== id));
}

/**
 * The first image reference that isn't a `data:` URI, as a JSON path — or
 * `null` if every one is embedded. A locally-imported story has no folder to
 * resolve a relative `src` against (format.md §14), so this is checked at
 * import time rather than left to fail silently the first time the story
 * actually renders.
 */
function findNonEmbeddedAsset(story: Story): string | null {
  if (story.cover && !story.cover.startsWith('data:')) return 'cover';
  if (story.theme?.background?.image && !story.theme.background.image.startsWith('data:')) {
    return 'theme.background.image';
  }
  for (const [nodeId, node] of Object.entries(story.nodes)) {
    for (const [i, block] of node.blocks.entries()) {
      if (block.type === 'image' && !block.src.startsWith('data:')) {
        return `nodes.${nodeId}.blocks[${i}].src`;
      }
    }
    if (node.theme?.background?.image && !node.theme.background.image.startsWith('data:')) {
      return `nodes.${nodeId}.theme.background.image`;
    }
  }
  return null;
}

/**
 * Parses, validates, and stores `raw` as a locally-imported story. Throws
 * `ImportError` with a message fit to show the user directly, and stores
 * nothing, on any failure.
 *
 * `shippedIds` guards against colliding with a *manifest* story's id, whose
 * save `persistence.ts` keys by id alone — sharing one would silently mix
 * two different stories' saves together. Re-importing the same local story
 * to update it is expected and allowed: it simply overwrites its old copy.
 */
export function importLocalStory(raw: string, shippedIds: ReadonlySet<string>): LocalStory {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ImportError('Not valid JSON.');
  }

  let story: Story;
  try {
    story = parseStory(parsed);
  } catch (error) {
    throw new ImportError(error instanceof ContentParseError ? error.message : 'Could not read this story.');
  }

  const report = validateStory(story);
  if (report.errors.length > 0) throw new ImportError(report.errors[0]!);

  if (shippedIds.has(story.id)) {
    throw new ImportError(
      `"${story.id}" is already the id of a story on the shelf — change this file's "id" and try again.`,
    );
  }

  const offending = findNonEmbeddedAsset(story);
  if (offending) {
    throw new ImportError(
      `${offending}: a locally-imported story needs every image as a data: URI (format.md §14) — there is no folder here to resolve a relative path against.`,
    );
  }

  try {
    localStorage.setItem(storyKey(story.id), raw);
  } catch {
    throw new ImportError('Could not save this story — the browser storage is full or unavailable.');
  }
  writeIndex([...readIndex().filter((existing) => existing !== story.id), story.id]);

  return { id: story.id, raw, story };
}
