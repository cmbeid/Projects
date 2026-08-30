import './styles/base.css';
import './styles/reader.css';
import './styles/shelf.css';
import './styles/settings.css';
import { parseManifest } from './content/parse';
import type { Manifest, ManifestEntry, Story } from './content/types';
import { importLocalStory, listLocalStories, removeLocalStory } from './state/localStories';
import { loadSession } from './state/persistence';
import { applyTextSize, loadTextSize } from './state/preferences';
import { mountReader } from './ui/reader';
import { mountShelf } from './ui/shelf';
import type { AssetResolver } from './ui/theme';

/** The folder a manifest entry's `path` lives in, e.g. "lighthouse". */
function storyFolder(entryPath: string): string {
  const slash = entryPath.lastIndexOf('/');
  return slash === -1 ? '' : entryPath.slice(0, slash);
}

/**
 * `data:` (and `blob:`) URIs are already a complete, fetchable reference —
 * format.md §14 — so they pass through untouched instead of being prefixed
 * like a normal content-relative path.
 */
function resolveAssetPath(base: string, relativeOrEmbedded: string): string {
  if (relativeOrEmbedded.startsWith('data:') || relativeOrEmbedded.startsWith('blob:')) return relativeOrEmbedded;
  return `${base}${relativeOrEmbedded}`;
}

/** Any path a manifest entry names (`path`, `cover`) is relative to `content/`. */
function resolveManifestPath(relativePath: string): string {
  return resolveAssetPath('./content/', relativePath);
}

/** A block's `src` inside a story is relative to that story's own folder. */
function resolveStoryAsset(entry: ManifestEntry): AssetResolver {
  const folder = storyFolder(entry.path);
  const base = folder ? `./content/${folder}/` : './content/';
  return (relativeSrc) => resolveAssetPath(base, relativeSrc);
}

let stopReader: (() => void) | null = null;

function showShelf(root: HTMLElement, manifest: Manifest): void {
  stopReader?.();
  stopReader = null;
  mountShelf(root, manifest, resolveManifestPath, ({ entry, story }) => showStory(root, manifest, entry, story), {
    entries: listLocalStories(),
    onImportFile: async (file) => {
      const raw = await file.text();
      importLocalStory(raw, new Set(manifest.stories.map((entry) => entry.id))); // throws ImportError, caught by the shelf
      showShelf(root, manifest);
    },
    onRemove: (id) => {
      removeLocalStory(id);
      showShelf(root, manifest);
    },
  });
}

function showStory(root: HTMLElement, manifest: Manifest, entry: ManifestEntry, story: Story): void {
  stopReader = mountReader(root, story, resolveStoryAsset(entry), {
    initialState: loadSession(story),
    onExitToShelf: () => showShelf(root, manifest),
  });
}

async function main(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) return;

  // Applied before anything mounts, so there's no flash of the default size.
  applyTextSize(loadTextSize());

  let manifest: Manifest;
  try {
    const res = await fetch('./content/index.json');
    manifest = parseManifest(await res.json());
  } catch (error) {
    root.textContent = 'Could not load the story shelf.';
    console.error(error);
    return;
  }

  showShelf(root, manifest);
}

void main();
