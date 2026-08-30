# Storied

A phone-first reader for branching-narrative stories, driven entirely by
JSON content. The app ships no story of its own — it reads whatever it
finds in `public/content/`, so adding a story is a file drop and a
manifest line, no rebuild required.

**Playable, and unfinished.** The content pipeline, the engine, the reader
(shelf, blocks, choices, three responsive layouts, theming), saves,
resume, and settings are all built, with three demo stories on the shelf.
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
its own.

## Playing

The shelf lists every story in the manifest; a broken one shows its actual
validation error in place of its blurb rather than being silently dropped.
Pick one to start reading. Progress saves per story and resumes where you
left off; the gear icon in the reader holds text size and restarting the
current story.

**Import a story from a file.** The shelf's "Import a story…" button reads a
`.json` file straight off disk — entirely in this browser, nothing
uploaded — for a story that isn't hosted anywhere. It needs to be a
*portable* story: every image embedded as a `data:` URI rather than a
relative path, since there's no folder to resolve one against. See
`format.md` §14 for the format, and [`offline.md`](offline.md) for what a
more complete version of this (bigger stories, drag-and-drop, exporting a
story back out) would still need.

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
offline.md        what local import (§14) doesn't do yet, and what would
                    change to fix each gap — a plan, not a changelog
src/content/       types.ts, parse.ts, validate.ts — unknown JSON -> Story,
                    with a JSON path on every failure; inline.ts, the
                    {var} interpolation + emphasis renderer (no innerHTML)
src/engine/         conditions.ts, mutate.ts, session.ts — the playthrough
                    state machine, pure and DOM-free
src/state/          persistence.ts (per-story saves), preferences.ts
                    (the global text-size setting), localStories.ts
                    (stories imported from a file — format.md §14)
src/ui/             shelf.ts, reader.ts, theme.ts, settings.ts, layout.ts
scripts/            validate-content.ts (content gate), verify-ui.ts (Playwright)
tests/              parse / conditions / mutate / session / inline /
                    persistence / preferences / content / layout
public/content/     the shipped demo stories — lighthouse/, aviary/, moth-king/
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
