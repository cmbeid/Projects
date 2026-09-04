# Vendored art

The sprites in this directory are **not ours** and are **not from SimTower**.

They come from [Skyscraper Rising](https://github.com/tonytins/skyscraperrising),
a SimTower-like built in Godot by Anthony Foxclaw (`tonytins`), with sprite work
credited to `binarybird`. That project is licensed **GPL-3.0**.

Only the 93 files named in `OPENSKY_SOURCES`
([`src/render/opensky-media.js`](../../../src/render/opensky-media.js)) are
vendored, and they are re-fetched by
[`scripts/sync-opensky-art.sh`](../../../scripts/sync-opensky-art.sh) rather
than edited here. File names are lower-cased and de-spaced by that script;
upstream casing is inconsistent and this site is served from a case-sensitive
host.

They exist so the **OpenSkyScraper edition** — the one that needs no copy of
SIMTOWER.EXE — has something to draw. Everything else the renderer needs is
generated procedurally by `opensky-media.js` itself.

## What is deliberately absent

No bitmap from `SIMTOWER.EXE` is in this repository, and none ever will be.
That art is © Maxis / OPeNBooK / Yoot Saito, was never released as freeware,
and committing it here would be redistribution. The SimTower edition reads it
out of a copy the player supplies, in the player's own browser — see the
[project README](../../../README.md).
