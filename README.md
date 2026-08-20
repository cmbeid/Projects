# Alchemy Forge

A crafting puzzle game for the phone. Start with air, earth, fire and water;
drag two together and see what comes out. There are **495 elements** and **981
combinations** to find.

Plain HTML5 — it installs to the home screen and plays fully offline.

## Running it

```bash
npm install
npm run dev          # dev server
```

For the installable, offline-capable version:

```bash
npm run build
npm run preview
```

Then use the browser's *Install app* / *Add to Home Screen*. There is no native
toolchain and no APK to build.

## Playing

| Gesture | On the board | In the element list |
| --- | --- | --- |
| Tap | duplicate it | drop one on the board |
| Long press | open its details | open its details |
| Drag | move it, or drop it onto another to combine | drag one out onto the board |
| Drag onto 🗑️ | remove it | — |

**Clear** empties the workspace and never touches your discoveries. **Hint**
names two elements you already have that make something new — it will not tell
you what. Elements marked ✦ are *final*: nothing further is made from them.

Progress saves automatically to the browser and survives closing the app.

## Screens

The layout has two shapes and switches between them live, which matters on a
foldable — folding and unfolding resizes the viewport without reloading the
page.

- **Under 700px** (phones, a foldable's cover screen): the board fills the
  screen and the element list is a bottom drawer, collapsed to a single
  scrolling strip and expanding to a searchable grid.
- **700px and up** (a foldable's inner screen, tablets, desktop): the board sits
  beside a permanent sidebar with search always visible.

Token positions are stored as fractions of the board rather than pixels, so
folding the phone shut moves everything proportionally instead of pushing half
the board off-screen.

## Layout of the code

```
src/data/       elements and recipes, split into themed packs
src/game/       combine, hints, progress — pure functions
src/state/      store and versioned localStorage persistence
src/ui/         layout, board, drag gestures, inventory, modals
scripts/        data validator, icon generator, browser verification
```

### The content

Elements and recipes live in `src/data/packs/`. Combinations are
order-agnostic — `A + B` and `B + A` collapse to the same key — and a pair may
produce more than one element. Whether an element is *final* is derived from the
recipe graph, never hand-authored, so it cannot fall out of step.

The element set is original to this project. It is the same genre as Little
Alchemy 2, not a copy of its content.

### The data gate

```bash
npm run validate
```

Hand-authoring a thousand recipes goes wrong in ways you cannot see by reading
them, so this walks the graph outward from air/earth/fire/water and fails if
anything is unreachable — content the player could never see. It also catches
dangling ids, recipes that produce one of their own inputs, duplicates, and
pairs that accidentally yield two different elements.

To add content: add elements and recipes to a pack, then run the validator.

## Checks

```bash
npm run validate   # content reachability and integrity
npm test           # unit tests
npm run typecheck
npm run build

npm run preview &  # then, against the built app:
npm run verify     # drives a real browser
```

`npm run verify` plays an actual session in Chromium at both of a Pixel Fold's
screen sizes, resizes the viewport between them mid-session to confirm nothing
falls off the board, and reloads with the network cut to confirm offline play.
Screenshots land in `screenshots/`.

`npm run icons` regenerates the PWA icon set from `assets/icon.svg`.
