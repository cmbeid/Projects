# Projects

A home for several standalone projects. Each lives in its own directory with
its own `package.json`, dependencies and scripts — there is no shared build and
nothing at the root to install.

| Project | What it is |
| --- | --- |
| [`alchemy-forge/`](alchemy-forge/) | An element-crafting puzzle game for the phone. Installable PWA, plays offline, 495 elements to find. |

## Working on one

```bash
cd alchemy-forge
npm install
npm run dev
```

Each project's own README covers the rest.

## Adding another

Make a directory, put a `package.json` in it, and add a row to the table above.
Keeping projects independent means one can change its toolchain, or be removed
entirely, without touching any other.

The root `.gitignore` covers the usual build output (`node_modules/`, `dist/`)
at any depth, so a new project generally needs no ignore rules of its own.
