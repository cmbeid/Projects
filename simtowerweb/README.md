# SimTowerWeb

A browser-based remake of **SimTower** (1994) — the elevator-scheduling,
tenant-pleasing tower sim — rebuilt as vanilla ES modules on a Canvas 2D
renderer. It follows [OpenSkyscraper](https://github.com/fabianschuiki/OpenSkyscraper)'s
reading of the original: the same 8×36-pixel grid, the same star ratings, the
same population and routing rules.

```bash
npm install
npm run dev
```

Live at <https://cmbeid.github.io/Projects/simtowerweb/>.

## Two editions

The game runs in one of two art modes, chosen on the main menu.

**OpenSkyScraper** needs nothing. It draws with the community sprites vendored
in [`public/assets/opensky/`](public/assets/opensky) plus procedurally
generated sheets (sky, clouds, crowds, digits, elevator shafts) painted by
[`src/render/opensky-media.js`](src/render/opensky-media.js). This is what the
public build boots into.

**SimTower** uses the original bitmaps, which live inside `SIMTOWER.EXE`. They
are © Maxis / OPeNBooK / Yoot Saito and were never released as freeware, so
**this repository contains none of them**. Point the menu at your own copy and
the file is verified by SHA-256, unpacked and cut into sprites entirely in the
browser; the result is cached in IndexedDB on your device. Nothing is uploaded
and nothing is written back here. The root `.gitignore` refuses `*.EXE` and
`*.EX_` at any depth so a stray copy cannot be committed by accident.

Art provenance and licensing for the vendored sprites is in
[`public/assets/opensky/README.md`](public/assets/opensky/README.md) — note
that they are GPL-3.0 and belong to a different project.

### Refreshing the vendored art

`OPENSKY_SOURCES` in `src/render/opensky-media.js` is the single list of what
the renderer needs. After changing it:

```bash
npm run sync-art
```

This needs the `gh` CLI on your PATH. `npm test` fails if the list and the
files on disk disagree, so an un-vendored sprite stops the build rather than
turning into a blank icon and a 404 in production.

## Playing on a phone

The UI has a portrait tier below 480px: the menu bar collapses to a hamburger
with a bottom sheet, the toolbox becomes a bottom drawer with 44px targets, the
dialogs become bottom sheets you can swipe down to dismiss, and the canvas
scrollbars are suppressed in favour of one-finger pan and pinch zoom. Because
the desktop message line has no room there, build rejections, save
confirmations and star progress surface as a toast above the drawer instead.

## Layout

| Path | What is in it |
| --- | --- |
| `src/core/` | Engine-agnostic pieces: time, money, RNG, save/load, XML, media cache. |
| `src/game/` | The simulation — items, transport, people, routing, systems. No DOM. |
| `src/render/` | Canvas 2D renderer, camera, and both art pipelines. |
| `src/ui/` | Menu bar, toolbox, dialogs, input and gestures. |
| `tests/` | Vitest, over the DOM-free modules only. |

`src/ui/format.js` is deliberately DOM-free so the formatters, the message
queue and the tower-bounds sweep can be tested headlessly; keep it that way.

## Hosting

Everything resolves through `document.baseURI` rather than the origin root —
the service worker registration, the manifest, the icons and the vendored art
— and the build sets `base: './'`. One `dist/` therefore works unchanged at an
origin root, under an S3 prefix, and under the `/Projects/simtowerweb/`
subdirectory Pages serves it from.
