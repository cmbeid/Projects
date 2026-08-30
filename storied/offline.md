# Offline and local-import — what's shipped, what isn't

`format.md` §14 documents a real, working feature: the shelf can import a
single self-contained `story.json` file from disk into this browser, with no
server involved. This document is the other half — what that feature
deliberately leaves out, and what changing each of those would actually take
in this codebase. Nothing below is scheduled or promised; it's written down
so the shape of the next piece of work doesn't have to be re-derived from
scratch.

## What's shipped

- `src/state/localStories.ts` — `importLocalStory`, `listLocalStories`,
  `removeLocalStory`. Synchronous, `localStorage`-backed, one story per key
  under `storied:local:story:<id>` plus an ordered index at
  `storied:local:index`.
- `src/ui/shelf.ts` — an "Import a story…" button and hidden file input;
  imported stories render in their own "Imported on this device" section,
  each with a "Remove" button.
- `src/main.ts` — wires the shelf's `onImportFile`/`onRemove` to
  `state/localStories.ts` and re-mounts the shelf on either.
- `format.md` §14 — the format side: `data:`-URI images (required, since a
  picked file has no folder to resolve a relative path against) and four
  optional top-level story fields (`blurb`, `cover`, `tags`,
  `estimatedMinutes`) that stand in for a manifest entry.

Everything here runs entirely client-side. A locally-imported story is never
sent anywhere — it lives in this browser's `localStorage`, on this device,
in this profile, same as a save.

## What it doesn't do, and why that's a real boundary

**Size.** `localStorage` is synchronous and small — browsers commonly cap an
origin around 5–10MB. Base64 costs roughly a third more than the original
image bytes on top of that. A portable story with more than a few modest
images can hit the ceiling; today that surfaces as `importLocalStory`
throwing `ImportError('Could not save this story — the browser storage is
full or unavailable.')` — caught, shown to the user, nothing corrupted, but
also nothing recoverable in place. There's no compaction, no per-story size
shown before import, no warning as the ceiling approaches.

**Producing a portable file is manual.** §14 is explicit that there's no
tool in this repo for base64-encoding a folder of images into a `story.json`
— an author does it by hand or with an external encoder. That's a real
authoring-ergonomics gap, not an oversight; building the tool was out of
scope for making the *reader* accept the format.

**No way back out.** A story can be imported; nothing exports one. A shipped
story can't be turned into a portable file to hand to someone without the
site, and an imported story can't be pulled back out to move to another
browser or device — only the original file the user picked can do that, and
only if they kept it.

**No CLI check for a portable file.** `npm run validate` walks
`public/content/` only. An author iterating on a portable story has no fast,
scriptable feedback loop — just the in-browser import's error message, one
attempt at a time.

**Import is one file, not a folder.** The file input takes exactly one
`.json`. That matches what §14 actually requires (every asset embedded, so
there's nothing else to select) — but it also means a multi-file or
drag-a-folder flow would need a format change first, not just a UI change;
see below.

**Not offline in the network sense.** Nothing here makes the app itself work
with no connection. A first visit still needs to fetch the built JS/CSS,
and — for a *shipped* story — `content/index.json` and that story's own
`story.json` and images. Only an already-imported local story's own data
needs zero network to read, because it's already sitting in `localStorage`.
A returning visit with the network down still fails today; there's no
service worker.

## What each of those would take

None of this is ordered by priority — they're independent, and which one
matters depends entirely on which limitation above actually gets hit first.

**IndexedDB instead of `localStorage`.** Only worth doing once the size
ceiling above is a real, hit-in-practice problem rather than a theoretical
one. `state/localStories.ts`'s three exports would all become `Promise`s;
every caller changes shape with them — `main.ts`'s `showShelf` currently
mounts the shelf synchronously with `entries: listLocalStories()` already in
hand, so it would need to await the list first (or `mountShelf` would need
to accept a promise/loading state, the way `loadEntry` already handles a
manifest story's fetch-then-render). `state/persistence.ts` (saves) and
`state/preferences.ts` (text size) stay exactly as they are — they're small
and don't carry embedded images, so `localStorage` remains the right choice
for both regardless of what local-story storage does.

**Real multi-file import.** Needs a format decision first, not just a code
one: either (a) a `.zip` bundle — `story.json` plus an `images/` folder,
unpacked client-side with a small zip library, so `src: "images/dock.webp"`
keeps meaning exactly what it already means in a shipped story, and the
reader resolves it against files held in memory instead of `fetch()`; or (b)
`showDirectoryPicker()` / `<input webkitdirectory>` reading a folder
structure directly, which is close to (a) without the zip step but has
weaker cross-browser support (no Firefox/Safari support for the directory
picker as of this writing). Either way, `src` stops being "always a relative
path or always a `data:` URI" and becomes "resolve against whatever asset
source this story came from" — `resolveStoryAsset` in `main.ts` would need a
third branch alongside the manifest-relative and `data:`/`blob:` cases it
already has.

**Export.** A "Share" or "Download" action on any story (shipped or
imported) that reassembles it as a portable file: fetch each image `src` the
story references, re-encode as `data:` URIs, merge in the manifest entry's
display fields as the story's own top-level ones, then trigger a save via a
`Blob` + `URL.createObjectURL` + a synthetic `<a download>` click (the
artifact sandbox this was drafted alongside blocks that pattern for a
*published page*, but it's ordinary and unblocked in the built app itself,
served from S3/Pages like everything else here). The re-encoding step is the
real work — an async image-to-data-URI helper that doesn't yet exist
anywhere in this codebase.

**A CLI check for a portable file.** `scripts/validate-content.ts` is
structurally "walk `public/content/`, validate what's found." A sibling
script (or a flag on the existing one) that takes an arbitrary file path,
runs it through the same `parseStory`/`validateStory` pair, and reports the
same way, would close the authoring-feedback gap — this is the smallest,
most self-contained item here, since it reuses the existing parse/validate
functions untouched and just changes where the file comes from.

**True offline-first.** A materially bigger, separate feature from anything
above: a service worker (hand-rolled `sw.js`, or `vite-plugin-pwa` to
generate one) precaching the app shell and, deliberately, only the content a
visit has actually already fetched — not the whole `public/content/` catalog
sight unseen, which would defeat the "no rebuild to add a story" design in
`PLAN.md` §1 by baking a story list into a cache manifest. Real complexity
here is cache invalidation across three different deploy targets (S3,
GitHub Pages) each redeploying independently, and making sure a stale
service worker never serves a story a validate-content gate would have
rejected.

**Quota visibility.** `navigator.storage.estimate()` shown before an import
starts, and a clearer message than today's generic "storage full" when a
`setItem` actually throws mid-import — small, but blocked on nothing above;
could land any time it's worth the UI real estate on the import control.
