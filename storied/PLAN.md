# Storied — a choose-your-own-adventure framework

## Context

This repo holds standalone web projects (`alchemy-forge/`, `starseed/`), each
independent with its own `package.json` and deploy workflow. This adds a third:
a framework for reading branching-narrative stories on a phone.

The point is the **separation between engine and content**. The app ships no
story of its own — it reads JSON from a content folder and renders whatever it
finds. So the file format is the real deliverable, and `format.md` is what makes
writing future stories possible without reading any TypeScript. Everything else
exists to serve that contract.

Decided up front, with you:

- **Variables and conditions**, not pure branching. Nodes set named variables;
  choices are gated on them. This is the one thing genuinely painful to retrofit
  into a file format, so it goes in at v1.
- **Runtime fetch with a manifest.** `content/` ships as static files. Adding a
  story is a file drop and a manifest line — no rebuild, no TypeScript.
- **A library, not a single story.** A shelf screen lists every story; saves are
  per-story, so several can be in progress at once.
- **Theme tokens plus a whitelisted block-style vocabulary** — see §5.

**Name: `storied`** — it has stories, it means legendary, and a many-storeyed
thing is floors stacked up, which is what the shelf is. Three readings, one
word.

(The plan first landed on this branch under a placeholder name, `branchline`,
and was renamed before any code existed. Nothing else carries the old name.)

## 1. Stack and layout

Mirrors `starseed/` so the repo stays legible: vanilla TypeScript + DOM, **zero
runtime dependencies**, Vite 7, vitest in a node environment, `tsx` for scripts,
Playwright for a manual UI check, and `starseed/tsconfig.json` copied verbatim
(`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`).

One deliberate divergence: the other two projects author content as TypeScript
packs, type-checked into the bundle. This one authors content as JSON fetched at
runtime. That trades compile-time safety for a content pipeline a non-programmer
can use — so the parser and validator (§6) have to earn back what the compiler
stops providing.

```
storied/
├── format.md             ← THE deliverable: the content spec (§7)
├── README.md  PLAN.md
├── package.json          dev/build/preview/test/typecheck/validate/verify
├── tsconfig.json         copied from starseed
├── vite.config.ts        base:'./', vitest node env
├── index.html
├── public/
│   └── content/          the content folder, served verbatim at ./content/
│       ├── index.json    the manifest
│       └── lighthouse/
│           ├── story.json
│           └── images/
├── src/
│   ├── main.ts               boot: load manifest, route to shelf or reader
│   ├── content/
│   │   ├── types.ts          Manifest, Story, Node, Block, Choice, Condition,
│   │   │                     Mutation, Theme
│   │   ├── parse.ts          unknown -> Story, precise errors, never `as`
│   │   ├── validate.ts       pure integrity + reachability checks
│   │   ├── load.ts           fetch + cache + error surface
│   │   └── inline.ts         {var} interpolation and inline markup -> DOM (§5)
│   ├── engine/
│   │   ├── types.ts          PlayState
│   │   ├── conditions.ts     evaluate(Condition, PlayState): boolean
│   │   ├── mutate.ts         apply(Mutation[], PlayState): PlayState
│   │   └── session.ts        enter / choose / back — pure, DOM-free
│   ├── state/
│   │   ├── persistence.ts    versioned localStorage, keyed per story id
│   │   └── store.ts          subscribe/notify + debounced save
│   ├── ui/
│   │   ├── layout.ts         responsive shell, live breakpoints (§4)
│   │   ├── shelf.ts          the story picker
│   │   ├── reader.ts         node blocks + the choice deck
│   │   ├── theme.ts          theme tokens -> CSS custom properties
│   │   ├── image.ts          lazy, aspect-boxed, alt required
│   │   ├── settings.ts       text size, restart, back-to-shelf
│   │   └── modal.ts  toast.ts
│   └── styles/               base / shelf / reader / choices / themes .css
├── scripts/
│   ├── validate-content.ts   the content gate; exits non-zero (CI runs it)
│   └── verify-ui.ts          Playwright screenshots at three viewports
└── tests/
    ├── parse.test.ts  conditions.test.ts  session.test.ts  inline.test.ts
    ├── persistence.test.ts  content.test.ts  layout.test.ts
```

**Why `public/content/` and not a top-level `content/`.** Vite serves `public/`
at the site root and copies it to `dist/` untouched, so `./content/index.json`
resolves identically in dev, in `preview`, and on S3 — with no plugin, no copy
step, and nothing for the deploy workflow to special-case. A top-level folder
would need a hand-rolled vite plugin to do both jobs; not worth the moving part.

## 2. The content format, in brief

Full spec in `format.md` (§7). The shape:

**`content/index.json`** — the manifest. HTTP cannot list a directory, so this
is how the app discovers stories.

```json
{
  "formatVersion": 1,
  "stories": [
    { "id": "lighthouse", "title": "The Lighthouse at Vail", "author": "…",
      "blurb": "One sentence for the shelf card.",
      "path": "lighthouse/story.json", "cover": "lighthouse/images/cover.webp",
      "tags": ["mystery"], "estimatedMinutes": 25 }
  ]
}
```

**`content/<id>/story.json`** — one story, one file.

```json
{
  "formatVersion": 1,
  "id": "lighthouse",
  "title": "The Lighthouse at Vail",
  "start": "arrival",
  "variables": { "hasLantern": false, "trust": 0, "pocket": [] },
  "theme": { … },
  "nodes": { "arrival": { … }, "door": { … } }
}
```

**A node.**

```json
{
  "blocks": [
    { "type": "text", "text": "The dock is empty. You have *{trust}* reasons to turn back." },
    { "type": "image", "src": "images/dock.webp", "alt": "A rotting jetty in fog." },
    { "type": "text", "style": "whisper", "text": "Someone is already inside." }
  ],
  "onEnter": [ { "var": "trust", "op": "add", "value": 1 } ],
  "theme": { "accent": "#8b2f2f" },
  "choices": [
    { "text": "Knock", "to": "door" },
    { "text": "Force the window", "to": "window",
      "if": { "var": "hasLantern", "eq": true },
      "whenLocked": "disable", "lockedText": "Too dark to see the latch.",
      "set": [ { "var": "trust", "op": "sub", "value": 2 } ] }
  ]
}
```

A node with no `choices` is an ending; it declares
`"ending": { "kind": "good" | "bad" | "neutral", "title": "…" }`.

**Conditions** are declarative JSON, evaluated by `conditions.ts` — never
`eval`, never a JS expression string. Leaves are `{ "var": "x", "<op>": value }`
with `eq ne gt gte lt lte has` (`has` for list variables); `{ "visited": "node-id" }`
tests the path taken. Combinators are `{ "all": [...] }`, `{ "any": [...] }`,
`{ "not": {...} }`. Flat, finite, and fully checkable by the validator.

**Mutations** are `{ "var": "x", "op": "set|add|sub|toggle|push|remove", "value": … }`,
appearing as a node's `onEnter` or a choice's `set`. Both are ordered arrays,
applied in order — the one place composition happens, so a story's behaviour is
never ambiguous.

Everything is namespaced under a `formatVersion` so v2 can add fields without
breaking a v1 story or a v1 reader.

## 3. The engine

```ts
// src/engine/session.ts
export interface PlayState {
  storyId: string;
  nodeId: string;
  vars: Readonly<Record<string, VarValue>>;
  visited: readonly string[];      // node ids, in order
  taken: readonly string[];        // "nodeId:choiceIndex", for `once` choices
}

/** Applies a choice and returns the next state. Pure; no DOM, no clock. */
export function choose(story: Story, state: PlayState, index: number): PlayState;
/** The choices visible at the current node, each already resolved. */
export function available(story: Story, state: PlayState): ResolvedChoice[];
```

Pure and DOM-free for the same reason `starseed/src/game/engine.ts` is: it makes
the whole of the interesting behaviour testable in vitest's node environment with
no browser. The UI's only job is to render `available()` and call `choose()`.

**Back.** The reader keeps a stack of prior `PlayState` snapshots rather than
trying to invert mutations — inverting `set` is not possible in general, and a
snapshot stack is ~10 lines and always correct. Capped at 50 entries. A story can
opt out with `"allowBack": false` for stories where consequence is the point.

## 4. Responsive UI — phone portrait first

Three live breakpoints, applied through `matchMedia` rather than only at load,
because a foldable changes viewport width **without reloading** — folding the
phone shut has to reshape the layout, not orphan half of it off-screen. This is
`starseed/src/ui/layout.ts`'s reasoning, and `alchemy-forge/tests/layout.test.ts`
already tests exactly this against Pixel Fold cover and inner widths; the pure
`modeForWidth(width)` function and its test are the pattern to reuse.

| Mode | Width | Reader shape |
| --- | --- | --- |
| `compact` | < 700px | Phone portrait. One column, text measure fills the width, choice deck at the bottom in the thumb arc. Pixel Fold **cover** screen (412px) lands here. |
| `medium` | 700–1023px | Fold **inner** screen (~840px) and small tablets. Same single column but capped at a 34rem measure and centred, with a persistent header rail instead of a hidden one. |
| `wide` | ≥ 1024px | Tablet landscape. Two panes: scene image and story chrome left, text and choices right — so a large screen shows more story, not longer lines. |

Fixed regardless of mode:

- `100dvh`, `viewport-fit=cover`, and `env(safe-area-inset-*)` padding — copied
  from `starseed/src/styles/base.css`, which already gets notches and gesture
  bars right.
- **Measure is capped at ~34rem everywhere.** The single biggest readability
  decision; a tablet must not produce 140-character lines.
- A short-viewport rule (`max-height: 480px`, i.e. a phone turned landscape)
  collapses the choice deck to a scrolling list so it cannot eat the screen.
  Web has no portrait lock, so this is the honest way to handle it.
- Text-size setting (3 steps) persisted globally, and `prefers-reduced-motion`
  disables the scene cross-fade.
- Images are `aspect-ratio`-boxed from intrinsic dimensions before they load, so
  a node never reflows under the reader's thumb mid-sentence.

## 5. Styling and safety

**Theme tokens.** A story declares a constrained block that `ui/theme.ts` maps
onto CSS custom properties scoped to the reader container:

```json
"theme": {
  "mode": "dark",
  "palette": { "bg": "#0b0f14", "surface": "#141b24", "text": "#e8eef7",
               "dim": "#8b9bb0", "accent": "#d9a441", "choiceBg": "#1a2430" },
  "font": { "body": "serif", "display": "serif", "scale": 1.05 },
  "background": { "image": "images/paper.webp", "fit": "cover", "overlay": 0.55 },
  "radius": 14
}
```

Colours must parse as hex/rgb; fonts come from a fixed enum mapped to system
stacks (**no remote font URLs** — that is a third-party request from a content
file); `scale` and `overlay` are clamped. A node may carry a partial `theme` that
merges over the story's and cross-fades, which is how a scene turns red.

**Block styles, not arbitrary CSS.** A text block may name a `style` from a fixed
vocabulary the app ships CSS for: `plain`, `aside`, `letter`, `terminal`,
`whisper`, `shout`, `epigraph`. This gives authors real typographic variety while
keeping every possible output something the layout was designed for. A per-story
`.css` file was the alternative and is deliberately excluded: a single bad
selector breaks the app chrome, and it is an arbitrary-CSS injection path the
moment any story comes from someone else.

**Content is never HTML.** `inline.ts` handles `{variable}` interpolation and a
tiny inline syntax — `*emphasis*`, `**strong**`, `_underline_` — and builds **DOM
nodes directly**. There is no `innerHTML` anywhere in the reader. A story
containing `<script>` renders those characters as text. `inline.test.ts` pins
this, and it is the one test in the suite that is a security property rather than
a behaviour.

## 6. Validation — what replaces the compiler

Two layers, because JSON fetched at runtime gets no help from `tsc`:

**`src/content/parse.ts`** turns `unknown` into a `Story` with narrowing checks
and no type assertions, reporting the JSON path of the first problem
(`nodes.door.choices[1].to: expected string, got number`). A malformed story must
produce a legible message on the shelf card, never a blank screen or a thrown
stack.

**`src/content/validate.ts`** is the pure integrity pass, run by
`scripts/validate-content.ts` (exits non-zero, so CI gates on it, exactly as
`starseed/scripts/validate-data.ts` does) and again by `content.test.ts`:

- every `to` names an existing node; every node reachable from `start`
- every non-ending node has at least one choice; every ending declares a `kind`
- every `var` read or written is declared in `variables`, and types are
  consistent (no `add` against a boolean)
- every `visited` reference names a real node
- every image path exists on disk and **has non-empty `alt`**
- theme colours parse; enums are in range
- manifest entries point at files that exist; ids unique across the manifest
- *warnings*: a choice whose condition can never be true given declared starting
  values and reachable mutations; an image no node references; a node over ~1200
  characters (a phone screen's worth is ~600)

The reachability check is the interesting one and mirrors
`starseed/src/data/reachability.ts`: walk from `start`, and treat a conditional
choice as traversable if any assignment of variables reachable along the way
satisfies it. Unreachable content is the failure mode a branching story actually
has, and it is invisible without a tool.

## 7. `format.md` — the deliverable

Written **first**, in build phase 1, and treated as the contract the code
implements rather than documentation written after. Contents:

1. Where files go, and the one-line rule for adding a story
2. The manifest, field by field
3. A story file, field by field
4. Nodes and blocks, with every `type` and every `style` shown rendered
5. Choices, `if` / `whenLocked` / `set` / `once`
6. The condition language — every operator, with a truth-table example
7. Mutations — every `op`, and what it does to each variable type
8. Theming — every token, its default, and its clamp
9. Inline text syntax and interpolation
10. Images: paths, alt text, sizing, and what the reader does with them
11. A complete worked story, short but exercising every feature
12. A cheat-sheet table of every field: name, type, required, default
13. How to check your work: `npm run validate`, and what each error means

Validator error messages quote section numbers from this file, which keeps the
two from drifting: a new check needs a section to point at.

## 8. Tests

vitest, node environment, `include: ['tests/**/*.test.ts']`. Fixture-driven —
tiny stories built inside the test file, following `alchemy-forge`'s instinct of
not coupling engine tests to shipped content.

| File | What it pins down |
| --- | --- |
| `parse.test.ts` | every malformed shape produces a precise path-tagged error and never throws; unknown fields are ignored, not fatal |
| `conditions.test.ts` | every operator and combinator; unknown var; `visited`; type mismatches |
| `session.test.ts` | choice gating; `set` ordering vs `onEnter`; `once` choices; the back stack; ending detection |
| `inline.test.ts` | interpolation, emphasis, and **that HTML in content is escaped, not rendered** |
| `persistence.test.ts` | round-trip; version migration; a save whose node id no longer exists after a content edit (offer restart, never crash) |
| `content.test.ts` | the shipped demo story passes the full validator |
| `layout.test.ts` | `modeForWidth` at Fold cover (412), Fold inner (~840), and each breakpoint edge — the shape of `alchemy-forge/tests/layout.test.ts` |

`scripts/verify-ui.ts` mirrors `starseed/scripts/verify-ui.ts`: Playwright against
`http://localhost:4173/`, driving shelf → read → make a gated choice → reach an
ending, with screenshots at 390×844, 840×1000 and 1280×900, committed for review.
It seeds saves through `addInitScript` for the same reason starseed's does — a
save written after load is overwritten by the outgoing page's flush.

## 9. Build order

| Phase | Deliverable |
| --- | --- |
| 1 | Scaffold, **`format.md`**, `types.ts`, `parse.ts`, `validate.ts`, a 4-node demo story, and the gate. `npm run validate` passes on real content before any UI exists. |
| 2 | The engine: conditions, mutations, session, back stack, and their tests. Still no DOM. |
| 3 | Reader UI: blocks, choice deck, the responsive shell and its three modes, theme tokens. **Playable on a phone.** |
| 4 | Shelf, per-story saves, resume, and graceful handling of a missing or broken story. |
| 5 | Images, per-node theme overrides, block-style vocabulary, cross-fade, settings. |
| 6 | A full demo story exercising every feature in `format.md` — the format's living test, and what proves the spec is writable. |
| 7 | Deploy wiring (§10), README, `verify-ui.ts` screenshots. |

Phases 1–3 are the framework; a story is readable at the end of phase 3.

## 10. Deploy wiring

Follows the recipe the root `README.md` already documents:

1. **`.github/workflows/deploy-storied.yml`** — copy `deploy-starseed.yml` and
   change the `paths:` filter, `S3_PREFIX`, `defaults.run.working-directory`,
   `concurrency.group`, `environment.url`, `cache-dependency-path`, and the
   summary text. Its existing second sync pass (`--exclude 'assets/*'`,
   `--cache-control 'no-cache'`) already covers `dist/content/**` correctly:
   content is exactly the thing that should not be cached, since it changes
   without a rebuild.
2. **`.github/workflows/pages.yml`** — add `storied` to the `paths:` filter,
   its install/validate/test/build steps, `cp -r storied/dist/.
   _site/storied/`, and a third `<a class="card">` in the hand-maintained
   landing-page heredoc.
3. **Root `README.md`** — a row in the projects table and one in the deploying
   table for `http://s3.cmbeid.com/storied/index.html`.

No `.gitignore` changes; the root one covers `node_modules/` and `dist/` at any
depth.

## Verification

Every phase, from `storied/`:

```bash
npm run typecheck     # the strict tsconfig is this repo's only static gate
npm test              # vitest
npm run validate      # the content gate; must exit 0
```

End to end, from phase 3:

```bash
npm run dev                    # read the demo story on a phone-sized window
npm run build && npm run preview
npm run verify                 # Playwright, three viewports, screenshots
```

Specifically worth checking by hand, because no test covers the feel:

- **The fold.** In devtools, resize from 412px to 840px *without reloading* —
  the layout must reshape live, keeping the current node and scroll position.
- **The format is actually writable.** Write a short story from `format.md`
  alone, without opening any `.ts` file. Anything that requires reading the
  source is a gap in the spec, not in the author.
- **A broken story fails legibly.** Corrupt a `story.json`, delete an image,
  point a choice at a missing node: each should give a specific message on the
  shelf and leave the other stories readable.

## Status

**Phase 1 of §9 is done.** Built: the scaffold (`package.json`, `tsconfig.json`
copied from `starseed`, `vite.config.ts`, `index.html`), `format.md` in full
(13 sections), `src/content/types.ts`, `src/content/parse.ts`
(`unknown` -> `Story`/`Manifest`, every failure path-tagged, no `as` outside
the one unavoidable object-narrowing cast in `asRecord`), and
`src/content/validate.ts` — integrity checks plus two graph passes:
reachability (errors) and an unsatisfiable-condition check (warnings). The
`lighthouse` demo story under `public/content/` exercises every block style,
every condition/mutation shape, both endings, and a node-level theme
override; `npm run validate` passes on it cleanly. 46 tests across
`tests/parse.test.ts` and `tests/content.test.ts` pass, `npm run typecheck` is
clean under the strict tsconfig, and `npm run build` produces a working
`dist/` with `public/content/` copied through to `dist/content/` untouched —
confirming the §1 rationale for using `public/` rather than a top-level
`content/` holds in practice.

A minimal `src/main.ts` was added ahead of its place in the build order
(phase 3+): without it `index.html`'s module script 404s, which is a worse
starting state than a 10-line placeholder that fetches the manifest, parses
every story, and lists titles into the page. It has no styling and is not the
reader — that's still phases 3-5's work.

Two things worth knowing about `validate.ts`'s reachability check, since the
plan's own wording (§6) undersold the actual tradeoff:

- **Reachability (errors) deliberately ignores `if` conditions entirely** —
  a node behind a conditional choice is always counted reachable. This is a
  one-directional simplification, not the "walk the unlock graph, checking
  satisfiability" approach `starseed/src/data/reachability.ts` uses: it can
  never produce a false "unreachable" error (the thing that would wrongly
  block a deploy), but it also can't catch a choice that's technically
  reachable and practically never satisfiable — that's the separate,
  softer warning below.
- **The "can this condition ever be true" warning** uses a bounded,
  per-variable possible-value model (every literal a `set`/`push` ever
  assigns anywhere in the story, unioned; a relative op — `add`/`sub`/
  `toggle`/`remove`/a list `set` — marks that variable untrackable rather
  than guessed at) that only ever under-reports, never flags a condition
  that could actually be true on some real playthrough. `not` and `visited`
  aren't modeled and are always treated as satisfiable for the same reason.
  Good enough to catch the stated goal — a typo in a variable name or a
  comparison value — without the complexity of true path-sensitive analysis.

**Phase 2 is done.** Built `src/engine/`:

- `types.ts` — `PlayState`: `storyId`, `nodeId`, `vars`, `visited` (each node
  id at most once, first-visit order), `taken` (`"nodeId:choiceIndex"` for
  every `once` choice spent). Immutable — every engine function returns a new
  one.
- `conditions.ts` — `evaluateCondition`, the runtime counterpart to
  `validate.ts`'s static "could this ever be true" analysis: this one asks
  "is it true right now" against a live `vars`/`visited`. A missing variable
  or an operator applied to the wrong type evaluates `false` rather than
  throwing — validated content shouldn't hit this, but a live playthrough
  failing closed beats a crash.
- `mutate.ts` — `applyMutations`, immutable, same defensive-typing stance.
- `session.ts` — `startSession`, `available`, `choose`, plus `currentNode`,
  `isEnding`, and `allowsBack`. `choose` follows format.md §7's mutation
  order exactly (a choice's own `set` before the destination's `onEnter`) —
  pinned by a test that uses two different ops specifically so the order is
  observable, not just plausible. A `whenLocked: "hide"` choice (the
  default) that's currently locked is omitted from `available()` entirely,
  never returned locked, so the UI never has to re-derive that rule itself.

**The back stack isn't in `session.ts`.** The plan's own file-tree comment
listed "back" as part of this module, but `PlayState` has nothing to invert a
`set` mutation with, and building a general inverse was never the design —
PLAN.md §3 already says the back stack is snapshots the *reader* keeps, not
something the engine computes. What actually landed here is `allowsBack(story)`,
a one-line pure predicate for `story.allowBack`; the stack itself is phase
3's `ui/reader.ts`, once there's a caller to hold it.

73 tests pass (27 new, in `tests/conditions.test.ts` and
`tests/session.test.ts`), including a test that `choose` never mutates the
state it was handed. Typecheck, validate, and build are all still clean.

**Phase 3 is done — a story is now actually readable on a phone.** Built:

- `src/content/inline.ts` — interpolation and emphasis in one left-to-right
  scan (never `innerHTML`; `<script>` in content renders as literal text).
  This is a small, deliberate correction to format.md §9, whose wording
  originally read as if emphasis was a *second* pass over the interpolated
  result — that would let a variable's own value (e.g. an inventory item
  with a stray `*` in it) accidentally open or close markup. §9 now says the
  scan is combined, and a substituted value is always opaque text.
- `src/ui/layout.ts` — `modeForWidth` (`compact` / `medium` / `wide`) and
  `watchLayout`, following `alchemy-forge/src/ui/layout.ts`'s pure-function
  pattern for the mode and `starseed/src/ui/layout.ts`'s live `matchMedia`
  approach for the watcher, since the mode here depends only on viewport
  width, not a measured element.
- `src/ui/theme.ts` — `applyTheme` and `mergeTheme`, writing every format.md
  §8 token to `--sy-*` custom properties with the clamps §8 promises
  (`parse.ts` only checks the values are finite — range-checking belongs at
  the point a theme is applied, not in the parser). The cross-fade PLAN.md
  §4 calls for is a CSS `transition` on the properties that *consume* the
  variables, not on the variables themselves — transitioning color-typed
  custom properties has inconsistent browser support.
- `src/ui/reader.ts` — the one stateful module. Owns the back stack (an
  array of prior `PlayState`s, exactly as `engine/session.ts`'s
  `allowsBack` doc comment describes — the engine still computes nothing
  about "back"), renders blocks through `inline.ts` and applies each node's
  merged theme before painting, renders the choice deck from `available()`
  and calls `choose()` on click, and shows an ending card with no further
  action when `currentNode(...).ending` is set (no restart — still phase 5).
- `src/styles/{base,reader}.css` — every color/font/radius comes from a
  `--sy-*` property; nothing here hardcodes a story's palette.
- `src/main.ts` rewritten to boot straight into the manifest's first story
  and mount the reader — still no shelf (phase 4).

**Wide mode's "two panes" needed a real design decision the phase-3 plan
left open.** A node's blocks are one ordered array that can interleave text
and images in a specific narrative sequence, and splitting them into a
permanent "media pane" / "prose pane" would have broken that order for any
node with more than one image. What's built instead: in `wide` layout only,
the node's *first* image (if any) is pulled into a left-hand `.sy-scene`
panel and excluded from the prose column; everything else renders inline,
in its original order, exactly as it does in `compact`/`medium`. This means
`reader.ts`'s `render()` has to know the current layout mode and re-run
when it changes — `watchLayout`'s callback now triggers a full re-render,
not just a class swap.

Verified by hand with a throwaway Playwright script (not committed) driving
the built app at 390px, 840px, and 1280px: the `hasLantern`-gated choice
shows correctly disabled before the tide-pool detour and enabled after; the
`door` node's accent-color override applies; the back button restores the
tide-pool node's own choice list, not just the previous screen; the layout
mode attribute is correct at all three widths. `npm run typecheck`, `npm
test` (94 tests, 27 new — `inline.test.ts` and `layout.test.ts`), `npm run
validate`, and `npm run build` are all clean. One new dev dependency:
`jsdom`, needed for `inline.test.ts` to construct real DOM nodes outside a
browser (per-file `@vitest-environment jsdom` pragma; every other test file
stays in the faster default node environment).

**Phase 4 is done.** Built:

- `src/state/persistence.ts` — `loadSession`/`saveSession`/`clearSession`/
  `hasSave`, versioned localStorage keyed per story id
  (`storied:save:<id>`), in the same defensive posture as
  `starseed/src/state/persistence.ts`: a missing, corrupt, wrong-version, or
  stale-`nodeId` save falls back to `startSession` silently rather than
  throwing, and every saved variable is kept only if it's still the same
  kind (boolean/number/string/list) the story currently declares —
  otherwise it falls back to that variable's own starting value. `visited`
  and `taken` entries naming a node or choice that no longer exists are
  dropped rather than trusted.
- `src/ui/shelf.ts` — the story picker. Prefetches every manifest entry's
  `story.json` and runs the *real* `validateStory` on each (its
  `AssetChecker` is optional, so this costs nothing extra without one) —
  a broken story shows its actual first validator error in place of its
  blurb, per format.md §13, rather than being silently dropped or only
  discovered when tapped. A ready card shows "Continue" or "Start" from
  `hasSave`.
- `src/main.ts` rewritten around `showShelf`/`showStory`, replacing the
  "boot straight into the first story" placeholder from phase 3.
- `src/ui/reader.ts` gained an `options` parameter: `initialState` (from
  `loadSession`) to resume instead of always calling `startSession`, and
  `onExitToShelf` so the back button doubles as "leave this story" once
  its own back stack is empty, rather than just disabling there.

**Persistence writes synchronously, with no debounce.** `starseed`'s
`store.ts` debounces hard because its state changes up to 60 times a
second; a reader's state only changes on a discrete click, so there is
nothing worth batching. This is also why `src/state/store.ts` from §1's
original file tree was never built as its own module — a pub/sub `Store`
class earns its keep in `starseed` because a dozen panels all need to
react to the same tick; here `reader.ts` is still the only thing that ever
reads `PlayState`, so persistence is just a function call at the one place
state already changes (`render()`), not a class with subscribers nobody
subscribes to yet.

**The back button now serves two jobs**, decided during implementation
since phase 4's shelf made a real gap in phase 3's design obvious: with
`allowBack` true, it undoes a choice, exactly as before; once the back
stack is empty at the story's start node, the *same* button — its `title`
switches to "Back to shelf" — leaves to the shelf instead of just
disabling. A story with `allowBack: false` still gets this at the start
node (you haven't undone anything yet by leaving), and still loses the
mid-story undo everywhere else.

Verified with a throwaway Playwright script (not committed): the shelf
shows one ready card labeled "Start"; entering the story and picking the
tide-pool detour, then reloading the page from a cold `main()`, showed the
shelf again with the card now labeled "Continue," and continuing resumed
at the exact tide-pool node rather than restarting. The back button's
title read "Back to shelf" at that resumed node (an empty in-memory back
stack after a reload is correct — the stack itself was never meant to
survive a reload, only the `PlayState` is) and clicking it returned to the
shelf correctly.

105 tests pass (11 new, in `tests/persistence.test.ts`, including the save
round-trip, a corrupt/unversioned save, and a save whose `nodeId` no
longer exists after a simulated content edit). Typecheck, validate, and
build are all still clean.

Phase 5 (settings, restart, text size) is next — but images, node theme
overrides, block styles, and the theme cross-fade, all originally slated
for phase 5 in §9's table, actually landed back in phase 3, since a reader
that renders blocks at all needed them to exist. That leaves phase 5's
real remaining scope narrower than the table suggests: settings only.

**Phase 5 is done.** Built:

- `src/state/preferences.ts` — `loadTextSize`/`saveTextSize`/`applyTextSize`,
  a global (not per-story) preference: `localStorage['storied:prefs:textSize']`
  holding `'small' | 'normal' | 'large'`, defaulting and falling back the
  same defensive way `persistence.ts` does. `applyTextSize` sets
  `--sy-user-scale` on `document.documentElement`, and `main.ts` calls it
  before mounting anything so there's no flash of the wrong size.
- `src/ui/settings.ts` — the gear toggle and its sheet: three text-size
  buttons and a restart button behind a native `window.confirm`. A custom
  modal (`ui/modal.ts`, in §1's original tree) was considered and skipped —
  storied has exactly one destructive action to confirm, and `starseed`
  and `alchemy-forge` both build real modals because they have several;
  one native `confirm()` is the honest amount of infrastructure for one
  button, not a corner cut.
- `styles/reader.css` and `styles/shelf.css` now compose two font-scale
  variables rather than one: `--sy-font-scale` is the story's own authored
  scale (format.md §8), `--sy-user-scale` is this preference, and they
  multiply together — a user's text-size choice never gets overridden by a
  story's own styling, and vice versa. The shelf reads `--sy-user-scale`
  too, since it's meant to be one setting for the whole app.

**A real bug turned up in manual verification, not in a test, and got
fixed before this phase closed.** `render()`'s existing "every state change
is worth persisting" policy from phase 4 meant that restarting — clear the
save, reset to `startSession` — immediately re-saved that fresh state as
part of the very next `render()` call, so `hasSave()` stayed `true` and the
shelf kept reading "Continue" for a playthrough with zero real progress in
it. Fixed with a `{ skipSave: true }` option on `render()`, used only by
the restart path: the save stays genuinely cleared until the player
actually does something in the new attempt. Worth naming because it's
exactly the kind of thing 109 passing unit tests don't catch — nothing in
`persistence.test.ts` exercises `reader.ts`'s call sites — which is why
the throwaway-Playwright-script habit from every phase so far keeps
earning its keep.

Verified by hand: the settings sheet opens from the gear icon; picking
"large" visibly scales `.sy-reader`'s computed font size (confirmed
16px → 18.4px) and survives a reload; restarting from mid-story (after
the tide-pool detour) returns to the epigraph node, and a reload afterward
shows the shelf card correctly reading "Start" again, not "Continue."

109 tests pass (4 new, in `tests/preferences.test.ts`). Typecheck,
validate, and build are all still clean.

**Phase 6 is done — reinterpreted slightly from §9's wording.** The plan
called for "a full demo story"; what actually makes the stronger proof is
the demo *content as a whole* covering every documented feature, split
across two stories rather than crammed into one. `lighthouse` (phase 1)
stays the small, format.md §11-matching intro example; a new second story,
`public/content/aviary/` ("The Clockwork Aviary," 15 nodes), fills every
gap `lighthouse` didn't already cover — and the two together also
exercise the shelf's multi-story grid, which a single story never would.

What `aviary` adds that `lighthouse` didn't reach: the `gt`, `gte`, `lt`,
`ne`, `has`, `all`, and `not` condition operators; the `toggle` and
`remove` mutations; a `once` choice (looped back to on purpose — an
`aftermath` node returns to `reckoning`, so the choice's disappearance on
the second visit is actually observable in play, not just structurally
present); the default `whenLocked: "hide"` behavior (`lighthouse` only
ever used `"disable"`); `allowBack: false`; an image `caption`; a node
with two images (exercising wide mode's scene-pane-plus-inline split from
phase 3 with real content for the first time); `**bold**` and `_underline_`
inline syntax and an escaped `\*` literal; the `aside`, `letter`, and
`plain` block styles; `mode: "light"`; and a full story-level `theme` —
every `palette` key, `font.scale`, and `background.image`/`fit`/`overlay`
together.

**Every choice deck in `aviary` is provably non-empty at every reachable
state.** The three-way ending split at `reckoning` (`birdFree` true+high
trust → good, true+low trust → bad, false → neutral) is an exhaustive
partition over every value `birdFree`/`trust` can actually hold there, not
just three conditions that happened to seem plausible — the alternative,
discovered mid-design, was a real soft-lock: an earlier draft gated the
good ending on `mood`, and a direct path existed where reckoning was
reached with `mood` still `"calm"`, leaving zero choices visible and no
`ending` block to fall back on (the parser only treats a node as an ending
when its JSON has no `choices` at all — an empty *runtime* deck after
condition filtering isn't the same thing, and would have rendered as a
dead screen). Every node that isn't a hard dead end either has an
always-visible choice or uses `whenLocked: "disable"` instead of the
`"hide"` default specifically so the deck can't empty out.

Verified by hand, three separate browser contexts (one per ending) driving
the built app through `hedges → found-key → door → …`: the good path
additionally exercises the `once` loop (confirms "Whisper why you came" is
visible after `backdoor` sets `mood`, then confirms it's gone on the
second visit to `reckoning`), the bad path confirms that same choice stays
hidden on a route that never touches `backdoor`, and all three reach their
correct `ending.kind` with no console errors and no soft-lock at any
intermediate node. `allowBack: false` was checked separately: the back
button is disabled and hidden mid-story, but — per phase 4's dual-purpose
design — still reads "Back to shelf" and works at the start node, since
leaving before making a choice isn't undoing anything.

One incidental fix, found while re-checking engine coverage before
shipping content that leans on every mutation op: `mutate.ts` had no
dedicated unit test — `push`/`toggle`/`remove` were only ever exercised
indirectly through `session.test.ts`'s `set`/`add` cases. Added
`tests/mutate.test.ts` (13 tests: every op, ordering, immutability, and
defensive behavior against a variable of the wrong type).

**On "proves the spec is writable" (§9):** `aviary`'s JSON was authored
directly from `format.md` — every block/choice/condition/mutation/theme
shape came from the document, not from reading `content/types.ts`. The one
place a `.ts` file mattered was checking `validate.ts`'s specific
possible-value heuristics before finalizing the `reckoning` branch, which
is a content-*quality* question (will this trip a warning), not a
format-*comprehension* gap — and it's exactly the kind of check §13
promises `npm run validate` exists to catch instead of requiring by hand.

122 tests pass (13 new, `tests/mutate.test.ts`). Typecheck, validate
(zero errors, zero warnings on both stories), and build are all clean.

**Phase 7 is done — the build order in §9 is complete.** Built:

- **`.github/workflows/deploy-storied.yml`** — copied from
  `deploy-starseed.yml` per §10, with the four named changes (`paths:`
  filter, `S3_PREFIX`, `working-directory`, `concurrency.group`) plus
  `environment.url`, `cache-dependency-path`, and the summary text. The
  existing second sync pass (everything under `dist/` except `assets/*`,
  `--cache-control 'no-cache'`) already covers `dist/content/**` exactly
  right with no changes needed — confirming §10's original claim, which
  hadn't been checked against a real build until now.
- **`.github/workflows/pages.yml`** — `storied` added to the `paths:`
  filter, the cache-dependency list, a full install/validate/test/build
  step block, `cp -r storied/dist/. _site/storied/`, and a third landing
  card. Both workflow files parse as valid YAML (checked directly, not just
  by eye).
- **Root `README.md`** — a row in the projects table and the deploying
  table.
- **`storied/README.md`** — didn't exist before this phase; written
  mirroring `starseed/README.md`'s shape (what it is, running it, playing
  it, layout of the code, checks) plus a "Writing a story" section that
  exists nowhere else, pointing straight at `format.md` and at `aviary/`
  as the feature-complete example to read alongside it.
- **`scripts/verify-ui.ts`** — mirrors `starseed/scripts/verify-ui.ts`'s
  shape: Playwright against a running `npm run preview`, three viewports,
  screenshots committed under `screenshots/`.

**Writing `verify-ui.ts` found a real, shipped dead end**, not a
hypothetical one. Driving the exact path a real player could take — reach
`hedges`, skip the key, go straight to `door` — hit a node where *both*
real choices were `whenLocked: "disable"` and permanently unsatisfiable
without backtracking, and `aviary`'s own `allowBack: false` meant there
was no way out at all. `npm run validate` reported zero errors and zero
warnings on this content in every phase-6 run; three separate manual
Playwright playthroughs in phase 6 didn't catch it either, because none of
them happened to skip the key. This is exactly the gap phase 6's own
Status section already named as a known limitation of the possible-value
warning check — proven out in practice one phase later, on the first
script that tried a path the earlier manual testing hadn't. Fixed two
ways: an always-available third choice at `door` ("Give up and turn
back", straight to the neutral ending), and a new callout in `format.md`
§5 (cross-referenced from §13) spelling out the actual rule — a `"disable"`
choice keeps the deck non-empty, not usable, and proving "at least one
choice is always available" isn't something `npm run validate` can check
in general. `verify-ui.ts` now specifically drives this once-broken path
on every run, so a regression here fails loudly instead of shipping quietly
again.

Verified: `npm run typecheck`, `npm test` (122 tests, unchanged this
phase), and `npm run validate` (zero errors, zero warnings) all pass;
`npm run build` followed by `CHROMIUM_PATH=/opt/pw-browsers/chromium npm
run verify` against the real preview server ran clean at all three
viewports and wrote 12 screenshots to `screenshots/`, committed for
review alongside this change.

**All seven phases of §9 are now built.** What's left is the two items
the Verification section's manual checklist has always named and neither
of which a script fully replaces: whether `format.md` is genuinely
writable by someone who has never opened this project's TypeScript (the
strongest evidence so far is that `aviary/story.json` was authored
directly from the document, per phase 6's Status note — but that was
still written by the same person who wrote the spec), and enabling GitHub
Pages once, by hand, in the repository's own settings, which is the one
step in `.github/workflows/pages.yml`'s own comment that no commit can do
for it.

## A third story — and a real answer to the writability question

**`public/content/moth-king/`** ("The Moth King's Debt," 15 nodes) closes
the gap the note above left open. It was written with `format.md` open
and nothing else — no other story's JSON, no `.ts` file — the actual
version of the "someone who has never opened the TypeScript" test, not a
proxy for it. It validated with **zero errors and zero warnings on the
first run.** That's the strongest evidence this project has that the spec
stands on its own: not "the author didn't need to check the source" (true
of `aviary` too, and less convincing, since the same session had just
finished writing both `format.md` and `validate.ts`), but "the author
deliberately didn't."

It's also a genuinely different piece of content, not a coverage
exercise — a fae-bargain folk tale, tonally distinct from `lighthouse`'s
noir and `aviary`'s fable register, using a moderate, natural subset of
the format (a handful of styles, `eq`/`gte`, `add`/`sub`/`set`, a node
theme override, choice-text interpolation) rather than straining to hit
every operator. The `king-tree` node applies §5's rule directly and
visibly: two of its four choices carry no `if` at all (offering labor,
fleeing), so the node has a real way forward regardless of what the
player has or hasn't done — the exact property `aviary`'s `door` node
was missing before phase 7's fix.

**Verification found two things — one in the content, one in the test
harness driving it, and it's worth being precise about which was which.**
`npm run validate` was clean from the first run; every issue that turned
up afterward came from playtesting, not the gate. A four-path Playwright
run (honest+lantern, dishonest+labor, flee, honest+beg) initially reported
one path with a choice locked when it shouldn't have been, and a second
path that hung waiting for a choice that never appeared. Isolating each
one: the "locked when it shouldn't" report was the *test's* mistake, not
the story's — the `beg` choice is authored with `whenLocked: "disable"`
on purpose (so its `lockedText` is visible), and the assertion had wrongly
expected the *default* `"hide"` behavior instead. The hang was also the
test's mistake: `backway` is its own node with a single `"Go on"` choice
into `orchard`, and two different versions of the script skipped that
click, so the failure appeared to move between paths across runs (whichever
`run()` call happened to contain the missing step) — nothing about the
story or the engine changed between those runs. Once both were fixed, all
four paths reached their correct `ending.kind` cleanly, including the
`{promise}` interpolation showing correctly in the ending text and in a
choice label (`lantern-pay`'s "Walk back through the orchard, {promise}
behind you" — the first content in this project to interpolate inside
choice `text` rather than a block).

Content report: `npm run typecheck`/`npm test` (122, unchanged — no code
changed for this story) and `npm run validate` all clean; four full
playthroughs in a real browser, one per ending path, all correct.

## Local import — a real feature, plus a plan for the rest of it

Added a working "Import a story…" control to the shelf: pick a `.json`
file from disk, and — entirely client-side, nothing uploaded — it's
parsed and validated through the exact same `parseStory`/`validateStory`
pair every other story goes through, then stored in this browser and
playable immediately, alongside the shipped stories under its own
"Imported on this device" heading.

**The format change this needed, and why it's small.** A file picked from
disk has no folder next to it, so a relative image `src` has nothing to
resolve against. Rather than invent a new content mechanism, `format.md`
§14 leans on something the reader already does almost for free: an
`<img>` doesn't care whether its `src` is a path or a `data:` URI, so a
"portable" story is just a normal story with every image embedded that
way, plus four optional top-level fields (`blurb`, `cover`, `tags`,
`estimatedMinutes`) that mirror the manifest entry it doesn't have. Both
are additive — nothing under `public/content/` changed, and a
manifest-listed story ignores the new top-level fields entirely (the
manifest stays authoritative there).

**Guardrails that turned out to matter in practice, not just in theory:**
an id collision with a *shipped* story is rejected outright, because
`persistence.ts` keys a save by story id alone — letting two different
stories share one would mean silently sharing a save. Re-importing the
same local story again (after editing it) is allowed and expected — it
just overwrites its old copy, same id or not. And a relative (non-`data:`)
image `src` is rejected **at import time**, scanning every block, both
background-image slots, and the new `cover` field, with the exact JSON
path in the message — this is deliberately proactive rather than letting
it fail silently the first time the story actually renders, in the same
spirit as phase 7's `aviary` fix: catch the dead end before it ships, not
after.

**What's real and shipped vs. what's written down for later.** Storage is
synchronous `localStorage`, same posture as `persistence.ts` and
`preferences.ts` — deliberately not IndexedDB, since nothing about this
feature needed async storage to work, only to scale past a size ceiling
that hasn't actually been hit yet. `offline.md` is the new document for
that boundary: it names every real limitation this implementation has on
purpose (the size ceiling, no export path, no CLI check for a portable
file sitting outside `public/content/`, single-file-only import, and that
none of this makes the app work with the network fully off), and outlines
what changing each one would actually touch in this codebase — without
scheduling any of it. It's written the same way this document is: so the
next session doesn't have to re-derive the shape of the problem.

Verification: `npm run typecheck`/`npm test` (134, +12 new for
`state/localStories.ts`) / `npm run validate` all clean; a real browser
run against `npm run build && npm run preview` importing a small portable
story with an embedded image, confirming — in this order — a relative-path
image is rejected with the right message, an id collision with a shipped
story is rejected with the right message, a valid import appears under
"Imported on this device" and reads correctly (image included, zero
network requests for its content), the action label reads "Continue"
after reaching an ending, and "Remove" actually removes it.
