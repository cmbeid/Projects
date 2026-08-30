# Offline and local import

`format.md` §14 documents the content side: a story can be a single
self-contained file, or a real folder, imported straight from disk with no
server involved. This document is the implementation side — what's built,
where, and the limitations that survived building it. Everything the
original draft of this document proposed is now shipped; what's left below
is what turned out to still be imperfect once it was real, not a schedule.

## What's shipped

**Local storage — IndexedDB.** `src/state/localStories.ts`: `importLocalStory`
(a portable file), `importLocalFolder` (a real folder), `listLocalStories`,
`removeLocalStory`, `loadLocalStoryAssets`. Two object stores — `stories`
(the raw JSON text, keyed by id) and `assets` (image Blobs for a folder
import, keyed by story id + relative path) — replacing the original
`localStorage` version now that real image Blobs need somewhere to live
that isn't a base64 detour. `persistence.ts` (saves) and `preferences.ts`
(text size) are untouched and still `localStorage` — small, no embedded
images, no reason to move.

**Real folder import.** `src/ui/folderImport.ts` groups a directory
`<input>`'s selection (`webkitdirectory`) into a `story.json` plus a
`relativePath -> File` map; `importLocalFolder` validates it with a real
`AssetChecker` built from that map (mirrors `scripts/validate-content.ts`'s
on-disk check) rather than requiring `data:` URIs. Chose the directory
picker over a `.zip` bundle specifically to avoid a runtime dependency —
this repo's one hard constraint is zero of those. The real cost: no
Firefox support (`webkitdirectory` isn't implemented there), so
`ui/shelf.ts` feature-detects it and simply doesn't show the folder-import
button when it's unavailable — the single-file portable path still works
everywhere.

**Export.** `src/ui/exportPortable.ts`'s `buildPortableStory` re-encodes
every image (`fetch` + `Blob.arrayBuffer()` + manual base64, not
`FileReader` — see the comment there for why) into a `data:` URI and folds
in the display fields a manifest entry would otherwise own, so a shipped
*or* local story can be turned back into one portable file. Wired into the
reader's settings sheet as "Download this story"
(`src/ui/settings.ts` + `src/ui/download.ts`'s `<a download>` trigger).

**A CLI check for a portable file.** `npm run validate:portable -- <path>`
(`scripts/validate-portable.ts`) runs the same `parseStory`/`validateStory`
pair and the same "every image must be a `data:` URI" rule the browser
importer enforces, against an arbitrary file outside `public/content/` —
reusing `findNonEmbeddedAsset`, exported from `localStories.ts` for exactly
this, rather than a second copy of the rule.

**Quota visibility.** `ui/shelf.ts`'s import control shows a rough
`navigator.storage.estimate()`-based free-space figure, and a storage
failure during import (`QuotaExceededError` specifically) gets a clearer
message than the old generic one — see `storageFailureMessage` in
`localStories.ts`.

**True offline-first.** `public/sw.js` (hand-rolled — no build step
processes `public/`, so it's plain browser JS, not the app's own
TypeScript) precaches the app shell into a versioned
`storied-shell-<hash>` cache; `scripts/generate-sw-manifest.ts` runs after
`vite build` (chained into `npm run build`) and writes
`dist/sw-manifest.json` by reading the *built* `index.html` for its actual
`<script src>`/`<link href>` values, so it adapts if Vite's output layout
ever changes, and hashes those files' own bytes for the version — a
rebuild with no real change doesn't force a new cache. `content/` is
deliberately **not** precached — a separate, unversioned
`storied-content` cache fills in as a visit actually fetches
`content/index.json` and any `story.json`/image, network-first so a
redeploy shows up immediately when online and the last-fetched copy serves
when it can't. Registered from `main.ts` via
`src/offline/registerServiceWorker.ts`, best-effort and silent on failure.
No workflow changes were needed to ship it: `sw.js` and
`sw-manifest.json` land outside `dist/assets/`, which `deploy-storied.yml`
was already syncing as `no-cache` — exactly right for a file a browser
needs to re-check on every visit to notice an update at all.

## What's still not perfect

Real limitations found while building the above, not aspirational gaps —
worth knowing about, not necessarily worth chasing.

**No zip, no Firefox folder import.** The directory-picker choice above is
a real tradeoff, not a stopgap: a `.zip` bundle would work everywhere but
needs a parsing library, which this repo has never taken on. A Firefox
author is limited to the portable (embedded-image) path.

**Export can fail offline.** `buildPortableStory` re-fetches a shipped
story's images to embed them — normally instant, since the reader already
rendered them, but if a story's shelf card was never opened (so its cover
was never fetched) and the device is offline, that one fetch fails.
Surfaces as a friendly error in the settings sheet, not a crash — but it's
a real edge, not a hypothetical one.

**IndexedDB still has a ceiling.** Real image Blobs raise the practical
limit far past the old `localStorage` one, but it's not infinite, and nothing
here does compaction, shows a per-story size, or warns as a folder
selection approaches the limit — only after a write actually fails.
`navigator.storage.estimate()` is the whole mitigation, and it's a rough
figure browsers round differently.

**Shell updates aren't instant.** The service worker's cache-first shell
relies on the browser's own periodic byte-diff of `sw.js` to notice a
redeploy — standard behavior for this pattern, not a bug, but it means an
open tab can go a while before it notices a new build exists.

**Offline only covers what was fetched online at least once.** Content
caching is network-first, not a proactive prefetch — a device offline on
its very first visit to a story it's never opened can't read it. This is
deliberate (see `PLAN.md` §1: no rebuild to add a story means no baked-in
catalog to precache either), but it's worth being explicit that "offline"
here means "offline after," not "offline from the start."

**Not an installable PWA.** The service worker makes a normal browser tab
work offline; there's no `manifest.webmanifest`, no home-screen icon, no
standalone display mode. A smaller, separate addition from anything above,
and out of scope here.
