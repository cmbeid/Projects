/**
 * Placeholder boot. The shelf and reader land in later phases (see PLAN.md
 * §9); for now this just proves the manifest and demo story parse and
 * validate cleanly end to end, in the browser as well as under vitest.
 */
import { parseManifest, parseStory } from './content/parse';

async function main(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) return;

  const manifestRes = await fetch('./content/index.json');
  const manifest = parseManifest(await manifestRes.json());

  const list = document.createElement('ul');
  for (const entry of manifest.stories) {
    const storyRes = await fetch(`./content/${entry.path}`);
    const story = parseStory(await storyRes.json());
    const item = document.createElement('li');
    item.textContent = `${story.title} — ${Object.keys(story.nodes).length} nodes`;
    list.append(item);
  }
  root.append(list);
}

void main();
