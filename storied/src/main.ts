import './styles/base.css';
import './styles/reader.css';
import './styles/shelf.css';
import './styles/settings.css';
import { parseManifest } from './content/parse';
import type { Manifest, ManifestEntry, Story } from './content/types';
import { importLocalFolder, importLocalStory, listLocalStories, loadLocalStoryAssets, removeLocalStory } from './state/localStories';
import { loadSession } from './state/persistence';
import { applyTextSize, loadTextSize } from './state/preferences';
import { mountReader } from './ui/reader';
import { mountShelf } from './ui/shelf';
import type { AssetResolver } from './ui/theme';
import { groupFolderSelection } from './ui/folderImport';
import { buildPortableStory } from './ui/exportPortable';
import { downloadFile } from './ui/download';
import { registerServiceWorker } from './offline/registerServiceWorker';

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

/** A block's `src` inside a shipped story is relative to that story's own folder. */
function resolveStoryAsset(entry: ManifestEntry): AssetResolver {
  const folder = storyFolder(entry.path);
  const base = folder ? `./content/${folder}/` : './content/';
  return (relativeSrc) => resolveAssetPath(base, relativeSrc);
}

/**
 * A locally-imported story (format.md §14, offline.md) has no manifest
 * `path` to derive a folder from — `localManifestEntry` in `ui/shelf.ts`
 * always sets it to `''`. Its assets are either already `data:`/`blob:`
 * URIs (a portable import) or object URLs for Blobs stored in IndexedDB (a
 * folder import) — `loadLocalStoryAssets` returns an empty map for the
 * former case, so the same lookup-with-passthrough-fallback works for both.
 */
async function resolveLocalStoryAsset(storyId: string): Promise<AssetResolver> {
  const assets = await loadLocalStoryAssets(storyId);
  return (relativeSrc) => {
    if (relativeSrc.startsWith('data:') || relativeSrc.startsWith('blob:')) return relativeSrc;
    return assets.get(relativeSrc) ?? relativeSrc;
  };
}

let stopReader: (() => void) | null = null;

async function showShelf(root: HTMLElement, manifest: Manifest): Promise<void> {
  stopReader?.();
  stopReader = null;
  const entries = await listLocalStories();
  const shippedIds = new Set(manifest.stories.map((entry) => entry.id));

  mountShelf(root, manifest, resolveManifestPath, (selection) => void showStory(root, manifest, selection.entry, selection.story), {
    entries,
    onImportFile: async (file) => {
      const raw = await file.text();
      await importLocalStory(raw, shippedIds); // throws ImportError, caught by the shelf
      await showShelf(root, manifest);
    },
    onImportFolder: async (fileList) => {
      const { storyFile, assetFiles } = groupFolderSelection(fileList);
      await importLocalFolder(storyFile, assetFiles, shippedIds); // throws ImportError, caught by the shelf
      await showShelf(root, manifest);
    },
    onRemove: (id) => {
      void removeLocalStory(id).then(() => showShelf(root, manifest));
    },
  });
}

/**
 * A shipped story's display fields live on its manifest entry; a local
 * story already carries its own (format.md §14), so an empty object here
 * lets `buildPortableStory` fall through to what's already on `story`
 * unchanged — re-exporting a local story is close to a no-op.
 */
function exportDisplayFields(entry: ManifestEntry): { blurb?: string; cover?: string; tags?: string[]; estimatedMinutes?: number } {
  if (entry.path === '') return {};
  return {
    ...(entry.blurb !== undefined ? { blurb: entry.blurb } : {}),
    ...(entry.cover !== undefined ? { cover: resolveManifestPath(entry.cover) } : {}),
    ...(entry.tags !== undefined ? { tags: entry.tags } : {}),
    ...(entry.estimatedMinutes !== undefined ? { estimatedMinutes: entry.estimatedMinutes } : {}),
  };
}

async function showStory(root: HTMLElement, manifest: Manifest, entry: ManifestEntry, story: Story): Promise<void> {
  const resolveAsset = entry.path === '' ? await resolveLocalStoryAsset(story.id) : resolveStoryAsset(entry);
  stopReader = mountReader(root, story, resolveAsset, {
    initialState: loadSession(story),
    onExitToShelf: () => void showShelf(root, manifest),
    onExport: async () => {
      const portable = await buildPortableStory(story, resolveAsset, exportDisplayFields(entry));
      downloadFile(`${portable.id}.json`, JSON.stringify(portable, null, 2), 'application/json');
    },
  });
}

async function main(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) return;

  // Applied before anything mounts, so there's no flash of the default size.
  applyTextSize(loadTextSize());

  // Best-effort, and independent of everything else booting — a returning
  // visit works offline once this has registered at least once before.
  void registerServiceWorker();

  let manifest: Manifest;
  try {
    const res = await fetch('./content/index.json');
    manifest = parseManifest(await res.json());
  } catch (error) {
    root.textContent = 'Could not load the story shelf.';
    console.error(error);
    return;
  }

  await showShelf(root, manifest);
}

void main();
