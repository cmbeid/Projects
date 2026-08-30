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
import type { LocalStory } from '../state/localStories';
import { hasSave } from '../state/persistence';

export interface ShelfSelection {
  entry: ManifestEntry;
  story: Story;
}

/** What the shelf needs to render and manage locally-imported stories — see format.md §14 and offline.md. */
export interface LocalShelfOptions {
  entries: LocalStory[];
  /** Reads, validates, and stores a single portable file; rejects with a message fit to show the user. Re-mounts the shelf on success. */
  onImportFile: (file: File) => Promise<void>;
  /** Same, for a real folder (story.json plus its own images/) picked via a directory input — offline.md's "real multi-file import." */
  onImportFolder: (fileList: FileList) => Promise<void>;
  /** Deletes a locally-imported story and re-mounts the shelf. */
  onRemove: (id: string) => void;
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

/** Wires a ready card up as a clickable/keyboard-activatable target. */
function wireCardSelectable(card: HTMLElement, onSelect: () => void): void {
  card.addEventListener('click', onSelect);
  card.setAttribute('role', 'button');
  card.tabIndex = 0;
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  });
}

/**
 * A synthetic manifest entry for a locally-imported story, built from its
 * own top-level display fields (format.md §14) since it has no real
 * manifest entry. `path` is never dereferenced — no fetch, no
 * `resolveStoryAsset` folder use — because every asset such a story carries
 * is embedded; see `findNonEmbeddedAsset` in `state/localStories.ts`.
 */
function localManifestEntry(story: Story): ManifestEntry {
  return {
    id: story.id,
    title: story.title,
    ...(story.author !== undefined ? { author: story.author } : {}),
    blurb: story.blurb ?? 'Imported from a local file.',
    path: '',
    ...(story.cover !== undefined ? { cover: story.cover } : {}),
    ...(story.tags !== undefined ? { tags: story.tags } : {}),
    ...(story.estimatedMinutes !== undefined ? { estimatedMinutes: story.estimatedMinutes } : {}),
  };
}

/**
 * A card for a story imported locally — built straight from the
 * already-parsed-and-validated `Story`, not fetched or re-validated, and
 * with its own "Remove" affordance since nothing else can drop it from the
 * shelf.
 */
function buildLocalCard(
  local: LocalStory,
  resolveManifestAsset: (path: string) => string,
  onSelect: () => void,
  onRemove: () => void,
): HTMLElement {
  const { story } = local;
  const entry = localManifestEntry(story);
  const card = buildCard(entry, resolveManifestAsset);
  card.classList.add('is-ready', 'is-local');

  const badge = document.createElement('span');
  badge.className = 'sy-card-local-badge';
  badge.textContent = 'On this device';
  card.querySelector('.sy-card-body')?.prepend(badge);

  const action = document.createElement('button');
  action.type = 'button';
  action.className = 'sy-card-action';
  action.textContent = hasSave(local.id) ? 'Continue' : 'Start';

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'sy-card-remove';
  remove.textContent = 'Remove';
  remove.setAttribute('aria-label', `Remove ${story.title}`);

  const actions = document.createElement('div');
  actions.className = 'sy-card-actions';
  actions.append(action, remove);
  card.querySelector('.sy-card-body')?.append(actions);

  action.addEventListener('click', (event) => {
    event.stopPropagation();
    onSelect();
  });
  remove.addEventListener('click', (event) => {
    event.stopPropagation();
    onRemove();
  });
  wireCardSelectable(card, onSelect);

  return card;
}

/** `1_536_000` -> `"1.5 MB"`. Whole numbers under 1KB show as bytes; everything else gets one decimal place. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

/**
 * `navigator.storage.estimate()` is a rough figure, not a hard promise — it
 * covers everything this origin has stored, not just imported stories, and
 * some browsers round it heavily. Shown so a large import's odds are legible
 * before it's attempted, not as a precise budget.
 */
async function quotaSummary(): Promise<string | null> {
  if (!('storage' in navigator) || typeof navigator.storage.estimate !== 'function') return null;
  try {
    const { usage, quota } = await navigator.storage.estimate();
    if (quota === undefined) return null;
    const free = usage !== undefined ? quota - usage : quota;
    return `~${formatBytes(Math.max(free, 0))} free in this browser`;
  } catch {
    return null;
  }
}

/** True if this browser's file input supports picking a whole directory (offline.md: no Firefox support as of this writing). */
function supportsDirectoryPicker(): boolean {
  return 'webkitdirectory' in document.createElement('input');
}

/**
 * One button wired to a hidden file input, sharing the same busy/error
 * presentation — the two forms `buildImportControl` offers (a single
 * portable file, or a whole folder) differ only in the input's own
 * attributes and which `local` callback its `change` event calls.
 */
function buildImportButton(
  label: string,
  configureInput: (input: HTMLInputElement) => void,
  runImport: (input: HTMLInputElement) => Promise<void>,
  error: HTMLElement,
): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sy-import-button';
  button.textContent = label;

  const input = document.createElement('input');
  input.type = 'file';
  input.hidden = true;
  configureInput(input);

  button.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    error.hidden = true;
    button.disabled = true;
    const originalLabel = button.textContent;
    button.textContent = 'Importing…';

    runImport(input)
      .catch((reason: unknown) => {
        error.textContent = reason instanceof Error ? reason.message : 'Could not import this.';
        error.hidden = false;
        button.disabled = false;
        button.textContent = originalLabel;
      })
      .finally(() => {
        input.value = ''; // lets the same file/folder be picked again after fixing an error
      });
    // On success, the caller's import function re-mounts the shelf itself —
    // this instance's DOM (including these very listeners) is about to be
    // replaced, so there's nothing else to reset here.
  });

  const holder = document.createElement('span');
  holder.append(button, input);
  return holder;
}

/** The "Import a story…" controls — a file button, and (where supported) a folder one — per format.md §14 and offline.md. */
function buildImportControl(local: LocalShelfOptions): HTMLElement {
  const section = document.createElement('div');
  section.className = 'sy-import';

  const buttons = document.createElement('div');
  buttons.className = 'sy-import-buttons';

  const quota = document.createElement('p');
  quota.className = 'sy-import-quota';
  void quotaSummary().then((summary) => {
    if (summary) quota.textContent = summary;
  });

  const error = document.createElement('p');
  error.className = 'sy-import-error';
  error.hidden = true;

  buttons.append(
    buildImportButton(
      'Import a story…',
      (input) => {
        input.accept = 'application/json,.json';
      },
      async (input) => {
        const file = input.files?.[0];
        if (!file) return;
        await local.onImportFile(file);
      },
      error,
    ),
  );

  if (supportsDirectoryPicker()) {
    buttons.append(
      buildImportButton(
        'Import a story folder…',
        (input) => {
          input.webkitdirectory = true;
          input.multiple = true;
        },
        async (input) => {
          if (!input.files || input.files.length === 0) return;
          await local.onImportFolder(input.files);
        },
        error,
      ),
    );
  }

  section.append(buttons, quota, error);
  return section;
}

export function mountShelf(
  root: HTMLElement,
  manifest: Manifest,
  resolveManifestAsset: (path: string) => string,
  onSelect: (selection: ShelfSelection) => void,
  local: LocalShelfOptions,
): void {
  const shell = document.createElement('div');
  shell.className = 'sy-shelf';

  const heading = document.createElement('h1');
  heading.className = 'sy-shelf-title';
  heading.textContent = 'Storied';
  shell.append(heading);

  shell.append(buildImportControl(local));

  const list = document.createElement('div');
  list.className = 'sy-shelf-list';
  shell.append(list);

  if (manifest.stories.length === 0 && local.entries.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'sy-shelf-empty';
    empty.textContent = 'No stories yet — drop one in public/content/ and add it to index.json, or import one.';
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
      wireCardSelectable(card, select);
    });
  }

  if (local.entries.length > 0) {
    const localHeading = document.createElement('h2');
    localHeading.className = 'sy-shelf-subheading';
    localHeading.textContent = 'Imported on this device';
    shell.append(localHeading);

    const localList = document.createElement('div');
    localList.className = 'sy-shelf-list';
    shell.append(localList);

    for (const localStory of local.entries) {
      const select = (): void => onSelect({ entry: localManifestEntry(localStory.story), story: localStory.story });
      const card = buildLocalCard(localStory, resolveManifestAsset, select, () => local.onRemove(localStory.id));
      localList.append(card);
    }
  }
}
