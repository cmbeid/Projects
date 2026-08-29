# Storied content format — v1

This is the spec for everything under `public/content/`. Storied ships no
story of its own; it reads whatever it finds here. If you can write JSON, you
can write a story — nothing in this document requires reading the app's
source.

The one-line rule for adding a story: **drop a folder under `public/content/`
and add one entry to `public/content/index.json`.** No rebuild, no code.

Run `npm run validate` after any change. It checks everything in this
document and reports errors with a JSON path (`nodes.door.choices[1].to`) and
a section number here, so a failure always points back to the rule it broke.

---

## 1. Where files go

```
public/content/
├── index.json                 the manifest — every story lives here
├── lighthouse/
│   ├── story.json             the story itself
│   └── images/
│       ├── cover.webp
│       └── dock.webp
└── another-story/
    ├── story.json
    └── images/
```

A story is one folder holding one `story.json` and its own `images/`. Paths
inside a story (image `src`, background images) are relative to that story's
folder, not to `content/` or the site root. The manifest's `path` and `cover`
are relative to `content/` itself.

Nothing else lives under a story folder — no CSS, no scripts. See §8 for why.

---

## 2. The manifest — `content/index.json`

The one file the app reads before it knows anything else exists. HTTP cannot
list a directory, so this is how Storied discovers stories at all.

```json
{
  "formatVersion": 1,
  "stories": [
    {
      "id": "lighthouse",
      "title": "The Lighthouse at Vail",
      "author": "A. Writer",
      "blurb": "A dock, a locked door, and a light that shouldn't be on.",
      "path": "lighthouse/story.json",
      "cover": "lighthouse/images/cover.png",
      "tags": ["mystery", "short"],
      "estimatedMinutes": 8
    }
  ]
}
```

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `formatVersion` | `1` | yes | Must be exactly `1`. |
| `stories` | array | yes | May be empty. |
| `stories[].id` | string | yes | Unique across the manifest. Lowercase, `a-z0-9-`. Used as the localStorage save key and must match `story.json`'s own `id`. |
| `stories[].title` | string | yes | Shown on the shelf card. |
| `stories[].author` | string | no | Shown on the shelf card if present. |
| `stories[].blurb` | string | yes | One sentence. Shown on the shelf card. |
| `stories[].path` | string | yes | Relative to `content/`, e.g. `lighthouse/story.json`. |
| `stories[].cover` | string | no | Relative to `content/`. Shelf shows a placeholder if absent. |
| `stories[].tags` | string[] | no | Free text, shown as chips on the shelf. |
| `stories[].estimatedMinutes` | number | no | Shown on the shelf card. |

---

## 3. A story file — `content/<id>/story.json`

```json
{
  "formatVersion": 1,
  "id": "lighthouse",
  "title": "The Lighthouse at Vail",
  "author": "A. Writer",
  "start": "arrival",
  "allowBack": true,
  "variables": {
    "hasLantern": false,
    "trust": 0,
    "pocket": []
  },
  "theme": { "…": "see §8" },
  "nodes": { "…": "see §4" }
}
```

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `formatVersion` | `1` | yes | |
| `id` | string | yes | Must match the manifest entry that points at this file. |
| `title` | string | yes | |
| `author` | string | no | |
| `start` | string | yes | A node id in `nodes`. Where a new playthrough begins. |
| `allowBack` | boolean | no, default `true` | Set `false` to remove the back button — for a story where an undo would cheapen the point. |
| `variables` | object | yes (may be `{}`) | The **complete** set of variables this story uses, with their starting values. A variable's type is fixed by the type of its starting value here — `false` makes it a boolean forever, `0` a number, `""` a string, `[]` a list of strings. Every `var` referenced anywhere else in the file must be declared here first. |
| `theme` | object | no | See §8. Applies for the whole story unless a node overrides it. |
| `nodes` | object | yes | Keyed by node id. Must contain `start` and everything reachable from it. |

Node ids and variable names: `a-z0-9-` and `a-z0-9_` respectively, by
convention — the validator doesn't enforce a charset, but non-ASCII or
punctuation in an id makes error messages harder to read.

---

## 4. Nodes and blocks

A node is one screen. It has content (`blocks`) and, unless it's an ending,
a way out (`choices`).

```json
{
  "blocks": [
    { "type": "text", "text": "The dock is empty. You have *{trust}* reasons to turn back." },
    { "type": "image", "src": "images/dock.webp", "alt": "A rotting jetty vanishing into fog." },
    { "type": "text", "style": "whisper", "text": "Someone is already inside." }
  ],
  "onEnter": [
    { "var": "trust", "op": "add", "value": 1 }
  ],
  "theme": { "palette": { "accent": "#8b2f2f" } },
  "choices": [ "… see §5" ]
}
```

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `blocks` | array | yes, at least one | Rendered top to bottom. |
| `onEnter` | Mutation[] | no | Applied once, the moment the node is entered — before the blocks render, so `{variable}` interpolation (§9) already sees the new values. Applied in array order. |
| `theme` | object | no | A **partial** theme (§8), merged over the story's for as long as this node is showing. |
| `choices` | Choice[] | no | Absent or empty means this node is an ending. |
| `ending` | object | required iff `choices` is absent or empty | `{ "kind": "good" \| "bad" \| "neutral", "title": "You reached the light" }`. Forbidden on a node that has choices. |

### Block types

**`text`**

```json
{ "type": "text", "text": "…", "style": "whisper" }
```

`text` supports `{variable}` interpolation and a small inline syntax — see
§9. `style` is optional, default `plain`, and must be one of:

| Style | Reads as |
| --- | --- |
| `plain` | Normal body text. |
| `aside` | A quieter, smaller note — a stage direction. |
| `letter` | A serif block set apart, as if quoted from a page. |
| `terminal` | Monospaced, for a screen, a log, a transmission. |
| `whisper` | Small, dim, close — something said quietly. |
| `shout` | Large, bold — something said loudly, or urgently. |
| `epigraph` | Italic, centered — an opening quotation. |

These are the **only** styles available. A story cannot add its own CSS
class or inline style — see §8 for why.

**`image`**

```json
{ "type": "image", "src": "images/dock.webp", "alt": "A rotting jetty vanishing into fog.", "caption": "The dock, 1962." }
```

| Field | Required | Notes |
| --- | --- | --- |
| `src` | yes | Relative to this story's folder. |
| `alt` | yes, non-empty | Not optional. The validator rejects an image with no `alt`. |
| `caption` | no | Shown beneath the image in small type. |

The reader boxes every image at its intrinsic aspect ratio before it loads,
so ship images at their real dimensions — a placeholder-sized file will
letterbox oddly.

---

## 5. Choices

```json
{
  "text": "Force the window",
  "to": "window",
  "if": { "var": "hasLantern", "eq": true },
  "whenLocked": "disable",
  "lockedText": "Too dark to see the latch.",
  "set": [ { "var": "trust", "op": "sub", "value": 2 } ],
  "once": false
}
```

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `text` | string | yes | The button label. Supports interpolation, not inline markup. |
| `to` | string | yes | A node id. |
| `if` | Condition | no | See §6. Absent means always available. |
| `whenLocked` | `"hide"` \| `"disable"` | no, default `"hide"` | What happens when `if` is false. `"hide"` removes the choice entirely; `"disable"` shows it greyed out and unclickable. |
| `lockedText` | string | no | Shown in place of a hint when the choice is disabled. Only meaningful with `whenLocked: "disable"`. |
| `set` | Mutation[] | no | Applied in array order, **after** the destination node's `onEnter` mutations — see §7. |
| `once` | boolean | no, default `false` | If `true`, this exact choice can be taken at most once per playthrough; a repeat visit to the node sees it as locked, following `whenLocked`. |

A node with no choices left visible (everything hidden by `if`) is a dead
end at runtime even though the validator sees a way out — see the
reachability warning in §11.

---

## 6. Conditions

Conditions are plain data, evaluated by the app — never a string of
JavaScript, never `eval`. Every condition is one of these shapes.

**A variable test.**

```json
{ "var": "trust", "gte": 3 }
```

Exactly one comparison key alongside `"var"`:

| Key | Meaning | Valid for |
| --- | --- | --- |
| `eq` | equals | boolean, number, string |
| `ne` | not equals | boolean, number, string |
| `gt` `gte` `lt` `lte` | numeric comparison | number only |
| `has` | list contains this string | list (string[]) only |

The value's type must match the variable's declared type (§3). `{ "var":
"trust", "eq": "high" }` is a validator error if `trust` started as a
number.

**A path test.**

```json
{ "visited": "lighthouse-door" }
```

True if the given node id has been entered at any point this playthrough,
including the current node.

**Combinators.** Any condition can nest inside these:

```json
{ "all": [ { "var": "hasLantern", "eq": true }, { "var": "trust", "gte": 1 } ] }
{ "any": [ { "visited": "door" }, { "visited": "window" } ] }
{ "not": { "var": "trust", "lt": 0 } }
```

`all` and `any` take an array of conditions (may nest arbitrarily deep);
`not` takes exactly one.

**Truth table**, for `{ "all": [A, { "any": [B, C] }] }` with A=true, B=false, C=true:
`any: [false, true] → true`, so `all: [true, true] → true` — the whole
condition is true.

---

## 7. Mutations

A mutation changes one variable. They appear in a node's `onEnter` or a
choice's `set`, always as an ordered array — order matters, and both arrays
run in the order written.

```json
{ "var": "trust", "op": "set", "value": 5 }
{ "var": "trust", "op": "add", "value": 1 }
{ "var": "trust", "op": "sub", "value": 2 }
{ "var": "hasLantern", "op": "toggle" }
{ "var": "pocket", "op": "push", "value": "brass key" }
{ "var": "pocket", "op": "remove", "value": "brass key" }
```

| Op | Valid for | `value` | Effect |
| --- | --- | --- | --- |
| `set` | any | matches variable's type | Replaces it outright. |
| `add` | number | number | Adds (negative to subtract). |
| `sub` | number | number | Subtracts. |
| `toggle` | boolean | — (omit `value`) | Flips it. |
| `push` | list | string | Appends, if not already present (a list holds each string at most once). |
| `remove` | list | string | Removes if present; no-op otherwise. |

**Ordering, end to end, for one choice:** the player clicks a choice → its
own `set` mutations run in array order → the destination node is entered →
that node's `onEnter` mutations run in array order → the node renders. A
choice's `set` never sees the destination node's `onEnter` effects, and
vice versa — each array is its own scope, run once, in the order written.

---

## 8. Theming

A story sets its look with **tokens**, not CSS. `ui/theme.ts` maps every
token below onto a CSS custom property scoped to the reader; nothing else is
reachable from content.

```json
{
  "mode": "dark",
  "palette": {
    "bg": "#0b0f14",
    "surface": "#141b24",
    "text": "#e8eef7",
    "dim": "#8b9bb0",
    "accent": "#d9a441",
    "choiceBg": "#1a2430"
  },
  "font": { "body": "serif", "display": "serif", "scale": 1.05 },
  "background": { "image": "images/paper.webp", "fit": "cover", "overlay": 0.55 },
  "radius": 14
}
```

| Field | Type | Default | Clamp / rule |
| --- | --- | --- | --- |
| `mode` | `"dark"` \| `"light"` | `"dark"` | Sets the base contrast direction; individual `palette` entries still override it. |
| `palette.bg` `surface` `text` `dim` `accent` `choiceBg` | hex color | app default per `mode` | Must parse as `#rgb`, `#rrggbb`, or `rgb(...)`. Any omitted key falls back to the default for the active `mode`. |
| `font.body` `font.display` | `"serif"` \| `"sans"` \| `"mono"` \| `"display"` | `"sans"` | Maps to a system font stack. **No remote font URLs** — a story cannot make the reader fetch anything from a font host. |
| `font.scale` | number | `1` | Clamped to `0.85`–`1.3`. |
| `background.image` | string | none | Relative to the story folder, like a block image. |
| `background.fit` | `"cover"` \| `"contain"` | `"cover"` | |
| `background.overlay` | number | `0.5` | Clamped `0`–`0.9`. Darkens/lightens the background image so text stays readable regardless of what's under it. |
| `radius` | number (px) | `14` | Clamped `0`–`32`. |

Every field is optional; an absent `theme` block uses the app's own default
theme.

**A node's `theme` is a partial override**, merged key-by-key over the
story's theme for as long as that node is on screen, then cross-fades back
when the player moves on. This is the mechanism for a scene turning red, or
a betrayal draining the color out of a room — set only the keys that should
change.

**Why tokens and not a stylesheet.** A per-story CSS file was considered and
rejected: one bad selector can break the app's own chrome (the shelf, the
choice deck, the settings sheet), and it would be an arbitrary-CSS injection
path the moment a story comes from anyone but the same person deploying the
app. The block-style vocabulary in §4 exists to give real typographic
range within that constraint.

---

## 9. Inline text syntax and interpolation

Every `text` block and choice `text` runs through the same small formatter.
It never produces HTML from content — the characters `<`, `>`, and `&` in a
story always render as literal text, never as markup.

**Interpolation.** `{variableName}` is replaced with that variable's current
value. A boolean renders as `true`/`false`, a list as its items joined with
`, `. Referencing an undeclared variable is a validator error (§11), not a
silent blank.

```
"You are carrying {pocket}."          → "You are carrying brass key, coin."
"Trust: {trust}"                       → "Trust: 3"
```

**Emphasis**, applied after interpolation:

| Syntax | Renders as |
| --- | --- |
| `*text*` | *italic* |
| `**text**` | **bold** |
| `_text_` | underline |

No nesting, no other syntax — no links, no headings, no raw HTML. Escape a
literal `*`, `_`, `{`, or `}` with a backslash: `\*`, `\{`.

---

## 10. Images

Covered field-by-field in §4; this section is the practical checklist.

- **Paths** are relative to the story's own folder: `images/dock.webp`, not
  `content/lighthouse/images/dock.webp` and not `/images/dock.webp`.
- **`alt` is required and validated non-empty.** Write what a person who
  can't see the image needs to know to keep following the scene — not just
  what's depicted, but why it matters if that's not obvious from the text
  around it.
- **Ship real dimensions.** The reader reserves the image's own aspect ratio
  as soon as the node mounts, before the file has loaded, so nothing jumps.
  A 4000×4000 placeholder standing in for a 16×9 photo will reserve the
  wrong box.
- **Format:** `.webp` or `.jpg` for photos, `.png` for anything needing
  transparency. Keep a phone connection in mind — a cover image much over
  ~300KB is a bad first impression on the shelf.
- A `background.image` (§8) follows the same path and `alt`-less rules,
  except it has no `alt` field — it's decorative, always paired with an
  `overlay` for text contrast.

---

## 11. A complete worked story

Every feature above, in one short, playable story.

```json
{
  "formatVersion": 1,
  "id": "lighthouse",
  "title": "The Lighthouse at Vail",
  "author": "A. Writer",
  "start": "arrival",
  "allowBack": true,
  "variables": { "hasLantern": false, "trust": 0, "pocket": [] },
  "theme": {
    "mode": "dark",
    "palette": { "accent": "#5fb3d9" },
    "font": { "body": "serif", "display": "serif" }
  },
  "nodes": {
    "arrival": {
      "blocks": [
        { "type": "text", "style": "epigraph", "text": "The light was not supposed to be on." },
        { "type": "image", "src": "images/dock.png", "alt": "A rotting jetty vanishing into fog, a lit window beyond it." },
        { "type": "text", "text": "The dock is empty. Fog hides the base of the lighthouse, but its lamp is lit — and it hasn't worked in eleven years." }
      ],
      "choices": [
        { "text": "Walk the dock toward the light", "to": "door" },
        { "text": "Check the tide pools for the old lantern", "to": "tidepools" }
      ]
    },
    "tidepools": {
      "blocks": [
        { "type": "text", "text": "Under a shelf of rock, wedged in the weed: a lantern, glass intact." }
      ],
      "onEnter": [ { "var": "hasLantern", "op": "set", "value": true } ],
      "choices": [
        { "text": "Take it and head for the door", "to": "door", "set": [ { "var": "pocket", "op": "push", "value": "lantern" } ] }
      ]
    },
    "door": {
      "blocks": [
        { "type": "text", "text": "The door is shut. You have *{trust}* reasons to knock instead of trying the latch." },
        { "type": "text", "style": "whisper", "text": "Someone is already inside." }
      ],
      "onEnter": [ { "var": "trust", "op": "add", "value": 1 } ],
      "theme": { "palette": { "accent": "#8b2f2f" } },
      "choices": [
        { "text": "Knock", "to": "knocked" },
        {
          "text": "Force the latch with the lantern's edge",
          "to": "forced",
          "if": { "var": "hasLantern", "eq": true },
          "whenLocked": "disable",
          "lockedText": "You have nothing stiff enough to force it.",
          "set": [ { "var": "trust", "op": "sub", "value": 2 } ]
        }
      ]
    },
    "knocked": {
      "blocks": [
        { "type": "text", "text": "Footsteps. The door opens on its own weight before anyone answers." }
      ],
      "choices": [
        { "text": "Go up to the lamp room", "to": "ending-good" }
      ]
    },
    "forced": {
      "blocks": [
        { "type": "text", "text": "The latch gives with a crack that echoes off the water. Whatever was inside heard that too." }
      ],
      "choices": [
        { "text": "Go up to the lamp room anyway", "to": "ending-bad", "if": { "any": [ { "visited": "tidepools" }, { "var": "trust", "lte": -1 } ] } }
      ]
    },
    "ending-good": {
      "blocks": [
        { "type": "text", "style": "shout", "text": "The lamp is burning on its own, no keeper in sight — and for the first time in eleven years, it isn't alone." }
      ],
      "ending": { "kind": "good", "title": "The Light Keeps Itself" }
    },
    "ending-bad": {
      "blocks": [
        { "type": "text", "style": "terminal", "text": "The lamp goes dark the moment you reach the top of the stairs." }
      ],
      "ending": { "kind": "bad", "title": "Eleven Years, and Then You" }
    }
  }
}
```

Paired manifest entry:

```json
{
  "id": "lighthouse",
  "title": "The Lighthouse at Vail",
  "author": "A. Writer",
  "blurb": "A dock, a locked door, and a light that shouldn't be on.",
  "path": "lighthouse/story.json",
  "cover": "lighthouse/images/cover.png",
  "tags": ["mystery", "short"],
  "estimatedMinutes": 8
}
```

---

## 12. Field cheat sheet

| Field | Type | Required | Default |
| --- | --- | --- | --- |
| **Manifest entry** | | | |
| `id` | string | yes | — |
| `title` | string | yes | — |
| `author` | string | no | — |
| `blurb` | string | yes | — |
| `path` | string | yes | — |
| `cover` | string | no | — |
| `tags` | string[] | no | `[]` |
| `estimatedMinutes` | number | no | — |
| **Story** | | | |
| `formatVersion` | `1` | yes | — |
| `id` | string | yes | — |
| `title` | string | yes | — |
| `author` | string | no | — |
| `start` | string (node id) | yes | — |
| `allowBack` | boolean | no | `true` |
| `variables` | object | yes | `{}` |
| `theme` | Theme | no | app default |
| `nodes` | object | yes | — |
| **Node** | | | |
| `blocks` | Block[] | yes | — |
| `onEnter` | Mutation[] | no | `[]` |
| `theme` | partial Theme | no | inherits story's |
| `choices` | Choice[] | no (ending if absent) | — |
| `ending` | `{kind, title}` | required iff no choices | — |
| **Text block** | | | |
| `type` | `"text"` | yes | — |
| `text` | string | yes | — |
| `style` | enum, §4 | no | `"plain"` |
| **Image block** | | | |
| `type` | `"image"` | yes | — |
| `src` | string | yes | — |
| `alt` | string | yes, non-empty | — |
| `caption` | string | no | — |
| **Choice** | | | |
| `text` | string | yes | — |
| `to` | string (node id) | yes | — |
| `if` | Condition | no | always true |
| `whenLocked` | `"hide"` \| `"disable"` | no | `"hide"` |
| `lockedText` | string | no | — |
| `set` | Mutation[] | no | `[]` |
| `once` | boolean | no | `false` |
| **Theme** | | | |
| `mode` | `"dark"` \| `"light"` | no | `"dark"` |
| `palette.*` | hex color | no | app default |
| `font.body` `font.display` | enum, §8 | no | `"sans"` |
| `font.scale` | number | no, clamp 0.85–1.3 | `1` |
| `background.image` | string | no | — |
| `background.fit` | `"cover"` \| `"contain"` | no | `"cover"` |
| `background.overlay` | number | no, clamp 0–0.9 | `0.5` |
| `radius` | number | no, clamp 0–32 | `14` |

---

## 13. Checking your work

```bash
npm run validate
```

runs `scripts/validate-content.ts` against every story the manifest lists,
and is the same check CI runs before a deploy. It reports two kinds of
problem:

**Errors** (exit non-zero — these block a deploy):

- a `to`, `visited`, or `var` naming something that doesn't exist (§3–§7)
- a node with neither `choices` nor `ending` (§4)
- a node **reachable from `start`** that no path can ever reach (§3) —
  walked through every choice, including ones behind a condition
- an image whose `src` doesn't exist on disk, or has empty `alt` (§10)
- a theme color that doesn't parse, or an enum value not in this document
  (§8)
- a manifest entry whose `path` or `cover` doesn't exist, or a duplicate
  `id`
- a `set`/`onEnter` mutation whose `op` doesn't match its variable's type
  (§7)

**Warnings** (printed, don't block):

- a choice whose `if` can never be true given the story's starting values
  and every mutation that can reach it — almost always a typo in a
  variable name or comparison
- an image under `images/` that no node references
- a node whose text blocks together run past ~1200 characters — more than
  a phone screen comfortably holds in one scroll

A story that fails validation still shows on the shelf, with the specific
error in place of the blurb, rather than being silently dropped — so a
typo in one story never hides it from the person trying to fix it.
