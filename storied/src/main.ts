import './styles/base.css';
import './styles/reader.css';
import './styles/shelf.css';
import { parseManifest } from './content/parse';
import type { Manifest, ManifestEntry, Story } from './content/types';
import { loadSession } from './state/persistence';
import { mountReader } from './ui/reader';
import { mountShelf } from './ui/shelf';
import type { AssetResolver } from './ui/theme';

/** The folder a manifest entry's `path` lives in, e.g. "lighthouse". */
function storyFolder(entryPath: string): string {
  const slash = entryPath.lastIndexOf('/');
  return slash === -1 ? '' : entryPath.slice(0, slash);
}

/** Any path a manifest entry names (`path`, `cover`) is relative to `content/`. */
function resolveManifestPath(relativePath: string): string {
  return `./content/${relativePath}`;
}

/** A block's `src` inside a story is relative to that story's own folder. */
function resolveStoryAsset(entry: ManifestEntry): AssetResolver {
  const folder = storyFolder(entry.path);
  return (relativeSrc) => (folder ? `./content/${folder}/${relativeSrc}` : `./content/${relativeSrc}`);
}

let stopReader: (() => void) | null = null;

function showShelf(root: HTMLElement, manifest: Manifest): void {
  stopReader?.();
  stopReader = null;
  mountShelf(root, manifest, resolveManifestPath, ({ entry, story }) => showStory(root, manifest, entry, story));
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
