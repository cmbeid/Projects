# Storied

A phone-first reader for branching-narrative stories, driven entirely by
JSON content. The app ships no story of its own — it reads whatever it
finds in `public/content/`, so adding a story is a file drop and a
manifest line, no rebuild required.

**Playable, and unfinished.** The content pipeline, the engine, the reader
(shelf, blocks, choices, three responsive layouts, theming), saves,
resume, and settings are all built, with seven demo stories on the shelf.
See [`PLAN.md`](PLAN.md) for the design and what's left — deploy wiring is
what this covers; everything else is done.

## Running it

All commands run from this directory (`storied/`), not the repository root.

```bash
npm install
npm run dev          # dev server
```

```bash
npm run build
npm run preview      # the built app, at http://localhost:4173/
```

## Writing a story

**[`format.md`](format.md) is the whole spec** — nodes, blocks, choices,
the condition language, mutations, theming, inline text syntax, images, a
complete worked example, and a field-by-field cheat sheet. Nothing about
authoring a story requires reading this project's TypeScript.

The one-line rule: drop a folder under `public/content/` and add one entry
to `public/content/index.json`. Then check your work:

```bash
npm run validate
```

`public/content/aviary/` is worth a look alongside `format.md` — it's the
story built specifically to exercise every feature the format documents,
not just the small worked example. `public/content/moth-king/` is a
different kind of evidence: it was authored from `format.md` alone, with
neither the other stories' JSON nor any `.ts` file open, and validated
clean on the first try — the actual test of whether the spec stands on
its own. `public/content/drevash/` (41 nodes) pushes on scale and
consequence rather than spec coverage: real combat with a genuine death
ending, two mutually-exclusive romance paths, and a light/dark alignment
track that changes which of six distinct endings are even reachable —
validated clean on the first run, and every one of its seven playthrough
paths, including two exact numeric boundary cases, confirmed in a real
browser before it shipped. `public/content/fornost/` is the largest by
far (202 nodes, roughly 5× `drevash`): a full Middle-earth campaign with
a three-way approach branch, five deterministic puzzles, two romance
tracks, and eleven distinct endings, verified across nine real-browser
playthrough paths including exact-boundary and isolated-fallback checks.
`public/content/frostmere/` (200 nodes) is the first demo story with no
real-world IP behind it at all: an original snowbound murder mystery
built around evidence-gated accusation rather than an alignment track —
the player gathers clues as variables, and the climactic accusation is
only as strong as the evidence actually found, verified across nine
real-browser playthrough paths including an exact `danger` boundary and
a direct enabled/disabled assertion on the accusation hub's buttons.
`public/content/hogwarts/` (70 nodes) is back down in `drevash`'s size
class: a close branching retelling of Book 1 that leans on the Mirror of
Erised's own test of desire as its climax mechanic rather than a bolted-on
alignment meter — hand-tracing a `peril` threshold by hand before writing
any test caught a genuinely unreachable ending (a ceiling of 8 against a
gate of 9) that `npm run validate` did not flag, fixed before the
seven-path Playwright script was ever written.

## Playing

The shelf lists every story in the manifest; a broken one shows its actual
validation error in place of its blurb rather than being silently dropped.
Pick one to start reading. Progress saves per story and resumes where you
left off; the gear icon in the reader holds text size and restarting the
current story.

**Import a story from disk.** The shelf offers two buttons — "Import a
story…" for a single portable file (every image embedded as a `data:`
URI, format.md §14) and, where the browser supports a directory picker,
"Import a story folder…" for a real `story.json` plus its `images/`, no
embedding needed. Both run entirely in this browser, nothing uploaded.
Any story open in the reader can also be turned back into a portable file
from the settings sheet ("Download this story"). And once you've opened a
story while online, it stays readable with the network off entirely — see
[`offline.md`](offline.md) for exactly what that does and doesn't cover.

```bash
npm run validate:portable -- path/to/story.json   # check a portable file before sharing it
```

| Layout mode | Width | Shape |
| --- | --- | --- |
| `compact` | < 700px | Phone portrait — the Pixel Fold's cover screen lands here. |
| `medium` | 700–1023px | A centred column with more breathing room — the Fold's inner screen. |
| `wide` | ≥ 1024px | Two panes: a scene image on the left, prose and choices on the right. |

The layout reshapes live on a resize, which matters on a foldable —
folding or unfolding changes the viewport without a reload.

## Layout of the code

```
format.md         the content spec — read this first
offline.md        the local-import/offline implementation — what's shipped,
                    and the real limitations that came out of building it
src/content/       types.ts, parse.ts, validate.ts — unknown JSON -> Story,
                    with a JSON path on every failure; inline.ts, the
                    {var} interpolation + emphasis renderer (no innerHTML)
src/engine/         conditions.ts, mutate.ts, session.ts — the playthrough
                    state machine, pure and DOM-free
src/state/          persistence.ts (per-story saves), preferences.ts
                    (text size), localStories.ts (IndexedDB-backed local
                    imports — format.md §14, offline.md)
src/ui/             shelf.ts, reader.ts, theme.ts, settings.ts, layout.ts,
                    folderImport.ts (grouping a directory selection),
                    exportPortable.ts + download.ts (the export path)
src/offline/        registerServiceWorker.ts
public/sw.js        the service worker itself — plain JS, not built
scripts/            validate-content.ts / validate-portable.ts (content
                    gates), generate-sw-manifest.ts (post-build, chained
                    into `npm run build`), verify-ui.ts (Playwright)
tests/              parse / conditions / mutate / session / inline /
                    persistence / preferences / content / layout /
                    localStories / folderImport / exportPortable
public/content/     the shipped demo stories — lighthouse/, aviary/, moth-king/, drevash/, fornost/, frostmere/, hogwarts/
```

Three decisions explain most of the code:

**The engine never touches the DOM.** `startSession`/`available`/`choose`
in `src/engine/session.ts` are pure functions over a `PlayState`; the
reader's whole job is turning their output into elements and turning
clicks back into calls to `choose`. That's what makes the interesting
behaviour testable with no browser.

**Content is never HTML.** `inline.ts` builds real DOM nodes for
interpolation and the small emphasis syntax — there is no `innerHTML`
anywhere in the reader, so a story containing `<script>` renders those
characters as text, not as markup.

**A locked choice isn't a safe choice.** `whenLocked: "disable"` keeps a
choice visible-but-unclickable; it doesn't guarantee a node has a way
forward. `format.md` §5 has the full story — it's a real trap the shipped
`aviary` story hit during development, not a hypothetical.

**The service worker never precaches the story catalog.** Only the app
shell is precached at install time; `content/` is cached as a visit
actually fetches it. Baking every shipped story into the precache list
would mean a new story needs a service-worker update to ever be seen,
which defeats the one-line "drop a folder, add a manifest entry, no
rebuild" promise this whole project is built around.

## Checks

```bash
npm run typecheck    # the strict tsconfig is this repo's only static gate
npm test             # vitest
npm run validate     # content gate — dangling references, unreachable nodes,
                      # unsatisfiable conditions, missing alt text
npm run verify        # Playwright, against a running `npm run preview`
```

`npm run verify` writes `screenshots/` at all three layout modes, driving
the shelf into `aviary` and specifically down the path that used to be a
dead end (no key, both real choices locked) to confirm the escape choice
actually works. If the sandbox's Chromium doesn't match the build
Playwright pins, point at the existing one:

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium npm run verify
```
