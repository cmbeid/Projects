# Projects

A home for several standalone projects. Each lives in its own directory with
its own `package.json`, dependencies and scripts — there is no shared build and
nothing at the root to install.

| Project | What it is |
| --- | --- |
| [`alchemy-forge/`](alchemy-forge/) | An element-crafting puzzle game for the phone. 495 elements to find; installs and plays offline when served over HTTPS. |

## Working on one

```bash
cd alchemy-forge
npm install
npm run dev
```

Each project's own README covers the rest.

## Deploying

Each project owns a workflow in [`.github/workflows/`](.github/workflows),
path-filtered so a change to one project never redeploys another. They publish
to the `s3.cmbeid.com` bucket, each under its own prefix, using credentials from
a GitHub Environment named `AWS`.

| Project | Live at |
| --- | --- |
| `alchemy-forge/` | http://s3.cmbeid.com/alchemy-forge/index.html |

## Adding another

Make a directory, put a `package.json` in it, and add a row to the table above.
Keeping projects independent means one can change its toolchain, or be removed
entirely, without touching any other.

The root `.gitignore` covers the usual build output (`node_modules/`, `dist/`)
at any depth, so a new project generally needs no ignore rules of its own.

To deploy it, copy `deploy-alchemy-forge.yml`, then change the path filter, the
`S3_PREFIX` and the working directory. The `AWS` environment is shared.
