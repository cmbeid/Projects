# Branchline — a choose-your-own-adventure framework

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

Name: `branchline`. Trivial to change before implementation starts.

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
branchline/
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

1. **`.github/workflows/deploy-branchline.yml`** — copy `deploy-starseed.yml` and
   change the `paths:` filter, `S3_PREFIX`, `defaults.run.working-directory`,
   `concurrency.group`, `environment.url`, `cache-dependency-path`, and the
   summary text. Its existing second sync pass (`--exclude 'assets/*'`,
   `--cache-control 'no-cache'`) already covers `dist/content/**` correctly:
   content is exactly the thing that should not be cached, since it changes
   without a rebuild.
2. **`.github/workflows/pages.yml`** — add `branchline` to the `paths:` filter,
   its install/validate/test/build steps, `cp -r branchline/dist/.
   _site/branchline/`, and a third `<a class="card">` in the hand-maintained
   landing-page heredoc.
3. **Root `README.md`** — a row in the projects table and one in the deploying
   table for `http://s3.cmbeid.com/branchline/index.html`.

No `.gitignore` changes; the root one covers `node_modules/` and `dist/` at any
depth.

## Verification

Every phase, from `branchline/`:

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

**Nothing is built.** This document is the plan only — no scaffold, no code, no
content. The directory holds this file and nothing else.

Phase 1 of §9 is the next step, and it starts with `format.md` rather than with
the scaffold: the format is the contract everything else implements, and writing
it first is what stops the code from quietly becoming the spec.
