# Projects

A home for several standalone projects. Each lives in its own directory with
its own `package.json`, dependencies and scripts — there is no shared build and
nothing at the root to install. 

| Project | What it is |
| --- | --- |
| [`alchemy-forge/`](alchemy-forge/) | An element-crafting puzzle game for the phone. 495 elements to find; installs and plays offline when served over HTTPS. |
| [`starseed/`](starseed/) | An idle game about a self-replicating space probe. Three eras and the automation ladder are playable; prestige and offline progress are not built yet. |
| [`storied/`](storied/) | A phone-first reader for branching stories, driven entirely by JSON content in `storied/public/content/`. Seven demo stories ship on the shelf; a story can also be imported straight from a local file or folder, and a story already opened once stays readable with the network off. |
| [`pokefling/`](pokefling/) | An Angry Birds–style slingshot physics game for the phone, themed on Pokémon. Sixty levels in ten Kanto and Johto locations, items, and Pokémon Crystal's music played by a Game Boy–style synth. |
| [`pokedefense/`](pokedefense/) | A Pokémon tower defense game, portrait-first for the phone. Nine regions, Kanto to Paldea, and three side regions — the Orange Islands, Hisui and Kitakami: 108 maps with Gym Leaders and twelve Leagues, twelve endless maps, 178 evolving tower lines (legends included), catching, weather, Mega Evolution, Z-Moves, Dynamax and Terastallizing, a Battle Frontier, items, and music from the games. |
| [`pokeharvest/`](pokeharvest/) | A Pokémon farming game, portrait-first for the phone. Till, plant, water and harvest berries on a walkable farm with a day/night clock, and sell through the shipping bin or the Poké Mart. Pokémon work the farm by type. Befriend more in turn-based battles on Route 1, level them up and evolve them, upgrade your tools at the blacksmith, and pick perks as your skills grow. Ranching and crafting are planned. |
| [`simtowerweb/`](simtowerweb/) | A playable remake of SimTower (1994) — elevator scheduling, tenants and star ratings, with a portrait phone layout. It ships GPL-3.0 community sprites so it runs out of the box; the original bitmaps are not redistributable, so it reads them from a copy the player supplies, in the player's own browser. |

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

`simtowerweb/`, `pokefling/`, `pokedefense/` and `pokeharvest/` have no S3 workflow — they publish to Pages only.

### GitHub Pages

[`pages.yml`](.github/workflows/pages.yml) is the exception to the rule above:
it builds every project into one site, so all of them have to pass for any of
them to publish.

| Project | Live at |
| --- | --- |
| `alchemy-forge/` | https://cmbeid.github.io/Projects/alchemy-forge/ |
| `starseed/` | https://cmbeid.github.io/Projects/starseed/ |
| `storied/` | https://cmbeid.github.io/Projects/storied/ |
| `simtowerweb/` | https://cmbeid.github.io/Projects/simtowerweb/ |
| `pokefling/` | https://cmbeid.github.io/Projects/pokefling/ |
| `pokedefense/` | https://cmbeid.github.io/Projects/pokedefense/ |
| `pokeharvest/` | https://cmbeid.github.io/Projects/pokeharvest/ |

Pages serves from a subdirectory, so a project published there has to resolve
its own assets relatively — `base: './'` in the Vite config, and no
origin-rooted paths at runtime (service worker registration and web manifests
are the usual offenders).

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
