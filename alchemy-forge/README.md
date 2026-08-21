# Alchemy Forge

A crafting puzzle game for the phone. Start with air, earth, fire and water;
drag two together and see what comes out. There are **495 elements** and **981
combinations** to find.

Plain HTML5 — it installs to the home screen and plays fully offline.

## Running it

All commands run from this directory (`alchemy-forge/`), not the repository
root.

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

## Deployment

Pushing changes under `alchemy-forge/` builds and publishes to S3 via
[`.github/workflows/deploy-alchemy-forge.yml`](../.github/workflows/deploy-alchemy-forge.yml).
The workflow runs the data validator and the tests first, so a broken recipe
tree stops a release rather than shipping quietly. It can also be run by hand
from the Actions tab.

**Live at** http://s3.cmbeid.com/alchemy-forge/index.html

### What it needs

Either of two ways in — the workflow uses whichever is configured.

**Preferred: no stored credentials.** Run [`.github/aws/setup.sh`](../.github/aws/setup.sh)
once, then set a repository variable `AWS_ROLE_ARN` to the role it prints. That
role works for every repo on the account, so no further repo needs setting up.
See [`.github/aws/README.md`](../.github/aws/README.md).

**Fallback: access keys.** Leave `AWS_ROLE_ARN` unset and put two secrets in a
GitHub Environment named **`AWS`**:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

The bucket (`s3.cmbeid.com`) and region (`us-east-1`) are defaults in the
workflow. Override either with a repository variable — `S3_BUCKET` or
`AWS_REGION` — without editing the file.

The IAM identity needs, on that bucket and the `alchemy-forge/*` prefix:
`s3:ListBucket`, `s3:PutObject`, `s3:PutObjectAcl`, `s3:DeleteObject`.
`PutObjectAcl` is required because uploads are made `public-read`, matching how
the rest of the bucket is served. If the bucket has ACLs disabled and uses a
bucket policy instead, drop the `--acl public-read` flags from the workflow.

### Cache headers

Uploads happen in three passes, because getting this wrong on a PWA means
deploys that never reach anyone:

| Files | `Cache-Control` |
| --- | --- |
| `assets/*` — content-hashed bundles | `max-age=31536000, immutable` |
| `icons/*` — not hashed | `max-age=86400` |
| `index.html`, `sw.js`, `workbox-*.js`, `manifest.webmanifest` | `no-cache` |

Hashed assets upload first, so the HTML is never live before the files it
points at. The service worker is never cached — a cached `sw.js` can keep
serving an old build long after a deploy.

### HTTP means no offline mode

The bucket is served over plain HTTP, and browsers only expose the service
worker API on a secure origin. So on the deployed site:

- the game **plays normally** — every element, combination and save works;
- there is **no offline mode**, and **no home-screen install** prompt.

This degrades rather than breaks: registration sits behind an
`'serviceWorker' in navigator` guard, which is simply false there.

Both come back the moment the site is served over HTTPS — CloudFront with an
ACM certificate in front of the bucket is the usual route, and needs no change
to this workflow beyond pointing at the new hostname.
