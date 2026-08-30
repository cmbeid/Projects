/**
 * The story picker. Prefetches every manifest entry's `story.json` so a
 * broken one can show its actual error on its own card — format.md §13:
 * "A story that fails validation still shows on the shelf, with the
 * specific error in place of the blurb, rather than being silently
 * dropped." Reuses `validateStory` itself (its `AssetChecker` is optional,
 * so this costs nothing extra to call without one) rather than re-deriving
 * a second, weaker notion of "is this story okay."
 */
import { ContentParseError, parseStory } from '../content/parse';
import { validateStory } from '../content/validate';
import type { Manifest, ManifestEntry, Story } from '../content/types';
import { hasSave } from '../state/persistence';

export interface ShelfSelection {
  entry: ManifestEntry;
  story: Story;
}

type LoadResult = { ok: true; story: Story } | { ok: false; message: string };

async function loadEntry(entry: ManifestEntry, resolveManifestAsset: (path: string) => string): Promise<LoadResult> {
  try {
    const res = await fetch(resolveManifestAsset(entry.path));
    if (!res.ok) return { ok: false, message: `Couldn't load this story (HTTP ${res.status}).` };
    const story = parseStory(await res.json());
    const report = validateStory(story);
    if (report.errors.length > 0) return { ok: false, message: report.errors[0]! };
    return { ok: true, story };
  } catch (error) {
    return { ok: false, message: error instanceof ContentParseError ? error.message : 'This story could not be read.' };
  }
}

function buildCard(entry: ManifestEntry, resolveManifestAsset: (path: string) => string): HTMLElement {
  const card = document.createElement('div');
  card.className = 'sy-card is-loading';

  if (entry.cover) {
    const cover = document.createElement('img');
    cover.className = 'sy-card-cover';
    cover.src = resolveManifestAsset(entry.cover);
    cover.alt = '';
    card.append(cover);
  }

  const body = document.createElement('div');
  body.className = 'sy-card-body';

  const title = document.createElement('h2');
  title.className = 'sy-card-title';
  title.textContent = entry.title;
  body.append(title);

  if (entry.author) {
    const author = document.createElement('p');
    author.className = 'sy-card-author';
    author.textContent = `by ${entry.author}`;
    body.append(author);
  }

  const blurb = document.createElement('p');
  blurb.className = 'sy-card-blurb';
  blurb.textContent = entry.blurb;
  body.append(blurb);

  if (entry.tags && entry.tags.length > 0) {
    const tags = document.createElement('div');
    tags.className = 'sy-card-tags';
    for (const tag of entry.tags) {
      const chip = document.createElement('span');
      chip.className = 'sy-card-tag';
      chip.textContent = tag;
      tags.append(chip);
    }
    body.append(tags);
  }

  if (entry.estimatedMinutes !== undefined) {
    const meta = document.createElement('p');
    meta.className = 'sy-card-meta';
    meta.textContent = `${entry.estimatedMinutes} min`;
    body.append(meta);
  }

  card.append(body);
  return card;
}

export function mountShelf(
  root: HTMLElement,
  manifest: Manifest,
  resolveManifestAsset: (path: string) => string,
  onSelect: (selection: ShelfSelection) => void,
): void {
  const shell = document.createElement('div');
  shell.className = 'sy-shelf';

  const heading = document.createElement('h1');
  heading.className = 'sy-shelf-title';
  heading.textContent = 'Storied';
  shell.append(heading);

  const list = document.createElement('div');
  list.className = 'sy-shelf-list';
  shell.append(list);

  if (manifest.stories.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'sy-shelf-empty';
    empty.textContent = 'No stories yet — drop one in public/content/ and add it to index.json.';
    shell.append(empty);
  }

  root.replaceChildren(shell);

  for (const entry of manifest.stories) {
    const card = buildCard(entry, resolveManifestAsset);
    list.append(card);

    void loadEntry(entry, resolveManifestAsset).then((result) => {
      card.classList.remove('is-loading');
      const blurb = card.querySelector('.sy-card-blurb');

      if (!result.ok) {
        card.classList.add('is-error');
        if (blurb) blurb.textContent = result.message;
        return;
      }

      card.classList.add('is-ready');
      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'sy-card-action';
      action.textContent = hasSave(entry.id) ? 'Continue' : 'Start';
      card.querySelector('.sy-card-body')?.append(action);

      const select = (): void => onSelect({ entry, story: result.story });
      action.addEventListener('click', (event) => {
        event.stopPropagation();
        select();
      });
      card.addEventListener('click', select);
      card.setAttribute('role', 'button');
      card.tabIndex = 0;
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          select();
        }
      });
    });
  }
}
