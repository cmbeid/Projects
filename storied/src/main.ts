import './styles/base.css';
import './styles/reader.css';
import { parseManifest, parseStory } from './content/parse';
import { mountReader } from './ui/reader';
import type { AssetResolver } from './ui/theme';

/** The folder a manifest entry's `path` lives in, e.g. "lighthouse". */
function storyFolder(entryPath: string): string {
  const slash = entryPath.lastIndexOf('/');
  return slash === -1 ? '' : entryPath.slice(0, slash);
}

async function main(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) return;

  const manifestRes = await fetch('./content/index.json');
  const manifest = parseManifest(await manifestRes.json());

  // No shelf yet (phase 4) — this boots straight into the first story in
  // the manifest, per PLAN.md §9's phase-3 scope.
  const entry = manifest.stories[0];
  if (!entry) {
    root.textContent = 'No stories in the manifest yet.';
    return;
  }

  const folder = storyFolder(entry.path);
  const resolveAsset: AssetResolver = (relativeSrc) =>
    folder ? `./content/${folder}/${relativeSrc}` : `./content/${relativeSrc}`;

  const storyRes = await fetch(`./content/${entry.path}`);
  const story = parseStory(await storyRes.json());

  mountReader(root, story, resolveAsset);
}

void main();
