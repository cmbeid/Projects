# Melvor 2 Pocket

A personal, portrait-mode web rebuild of the **Melvor Idle 2 Demo** (Steam build 26074343, v0.11.2-alpha.4) for
playing on a phone. Not affiliated with Games By Malcs.

**This repo and the deployed site contain no game content.** No item, recipe, enemy or other data, and no artwork or
audio. The app plays using `content.json`, which you build from your own Steam install and load into your own browser
once. Never commit `data/` (it's git-ignored).

## Play it from GitHub Pages

Live at https://cmbeid.github.io/Projects/melvor2-pocket/ (HTTPS, so it installs to your home screen and plays offline).

1. On a PC with the Melvor Idle 2 Demo installed through Steam, in this folder, run `npm install` and then
   `npm run data`. This reads the game's data pack out of `Melvor2.exe` and writes `data/content.json`. Set
   `MELVOR2_EXE` if the game isn't in the default Steam folder.
2. Copy `data/content.json` to your phone (cloud drive, email to yourself, USB…).
3. Open the site and pick the file. It's stored in that browser and never uploaded anywhere. Settings → Game data
   lets you load a newer one.

### Optional: bundle the data into a private Pages build

If the repo is private **and** your plan supports Pages access control, the Pages build can include the game data,
so the site needs no `content.json` on first run. Note that on GitHub Free, Pro and Team, a private repo's Pages site
is still public: only GitHub Enterprise Cloud can make a Pages site private (Settings → Pages → visibility).

1. Run `npm run data`, then `npm run data:upload`. This uploads `data/content.json` as the release asset
   `melvor2-data`, and refuses if the repo isn't private.
2. Set the repository variable `MELVOR2_BUNDLE_DATA` to `true` (Settings → Secrets and variables → Actions →
   Variables).
3. Re-run the Pages workflow.

Before bundling, the build checks that the repo is private and that the Pages API reports the site as private.
If either check fails, the deploy fails rather than publishing the data. To turn it off, set the variable to `false`.
**Delete the `melvor2-data` release before ever making the repo public again.**

## Run it on your own network

```bash
npm install
npm run build:local    # builds data/content.json and bundles it into this local build
PORT=8137 npm start    # serves dist/ on your network and prints the address for your phone
```

`npm run build` makes the data-free build that Pages uses. `npm test` runs the engine tests. Most of them need
`data/content.json`; without it (in CI, for example) only the data-free checks run.

## How it's built

- `tools/extract-pck.mjs` reads the Godot pack embedded in the exe; `tools/build-data.mjs` builds `data/content.json`
  and fails on broken references.
- `src/engine` is a deterministic tick engine (60 ticks/s, seeded RNG): online play and offline catch-up give identical
  results. Mechanics follow the game's own rules (notes kept outside this repo).
- `src/ui` is a Preact portrait UI. All art is generated SVG (`src/art/icons.ts`); no game artwork or audio is used.
- Saves live in IndexedDB (autosave every 10 s and when the app is hidden), with export/import in Settings.

## What's in

- **Gathering skills:** Woodcutting, Fishing, Mining, Firemaking, Thieving, Hunting, Astrology.
- **Crafting skills:** Cooking, Smithing, Fletching, Crafting, Runecrafting, Beastcrafting.
- **Background skills:** Farming (with the Grain Mill) and Ranching.
- **Combat:** melee, ranged and magic, with equipment, prayers, Slayer tasks and dungeons.
- **Other systems:**
  - shop and bank slots
  - bonuses from the shop, astrology star nodes, equipment, set bonuses and the skill toolbelts
  - quests, openable items and item upgrades
  - completion log and offline progress (24 h cap)

## Not in yet

- **Mastery Guild:** ranks, tasks and their bonuses.
- **Combat status effects:** poison, bleed, stun, burn; enemy passives, ward and lifesteal. Elemental bonuses aren't
  in either.
- **Bonuses that depend on conditions:** e.g. "while fighting X". These are skipped.
- **Smaller skill mechanics:** Ranching enclosure maintenance and sickness, fishing bait/priority, Firemaking
  bonfires and events, Hunting journal bonuses.
- **Locked in the demo itself:** Herblore and Agility have no playable content in the demo.
- **Offline caching on your phone:** browsers only allow it over HTTPS or on `localhost`, so it doesn't work from a
  plain `http://` LAN address.
