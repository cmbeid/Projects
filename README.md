# Projects

A home for several standalone projects. Each lives in its own directory with
its own `package.json`, dependencies and scripts — there is no shared build and
nothing at the root to install. 

| Project | What it is |
| --- | --- |
| [`alchemy-forge/`](alchemy-forge/) | An element-crafting puzzle game for the phone. 495 elements to find; installs and plays offline when served over HTTPS. |
| [`starseed/`](starseed/) | An idle game about a self-replicating space probe. Three eras and the automation ladder are playable; prestige and offline progress are not built yet. |
| [`storied/`](storied/) | A phone-first reader for branching stories, driven entirely by JSON content in `storied/public/content/`. Two demo stories ship on the shelf. |

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
to the `s3.cmbeid.com` bucket, each under its own prefix.

Access is via a single account-wide IAM role assumed through OIDC, so no AWS
credentials are stored in GitHub and a new repo needs no per-repo setup — see
[`.github/aws/README.md`](.github/aws/README.md).

| Project | Live at |
| --- | --- |
| `alchemy-forge/` | http://s3.cmbeid.com/alchemy-forge/index.html |
| `starseed/` | http://s3.cmbeid.com/starseed/index.html |
| `storied/` | http://s3.cmbeid.com/storied/index.html |

## Adding another

Make a directory, put a `package.json` in it, and add a row to the table above.
Keeping projects independent means one can change its toolchain, or be removed
entirely, without touching any other.

The root `.gitignore` covers the usual build output (`node_modules/`, `dist/`)
at any depth, so a new project generally needs no ignore rules of its own.

To deploy it, copy `deploy-alchemy-forge.yml`, then change the path filter, the
`S3_PREFIX` and the working directory, and set the `AWS_ROLE_ARN` repository
variable. The IAM role behind it is account-wide, so that variable is the only
per-repository step.
