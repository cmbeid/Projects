# Hollowdeep

An incremental mining game for the phone. It's built for portrait and scales up to tablets and desktops. Tap the rock face, break through each depth's seam, and keep going down through five strata, each stranger than the last. Something at the bottom is breathing.

- **Mining and upgrades.** Tap to swing. Buy upgrades with coin, and buy drones, drill rigs and excavators that mine for you, offline too (up to 8 hours, more with upgrades).
- **RPG.** Your miner levels up from every block. Each level gives stat points for Strength, Dexterity, Luck and Endurance. Every third level gives a point for a 12-node passive tree. Three active skills draw on stamina: Power Strike, Dowse and Frenzy.
- **Crafting.** Furnaces smelt ore into bars over time. The workbench turns bars, gems and seam hearts into gear, supplies and one-off fixtures. There are 23 pieces of gear across four slots, each with random affixes, and 45 recipes in all.
- **Missions.** A 42-mission story runs from the top of the shaft to depth 200 and unlocks each system as it introduces it. Three daily contracts pay out coin, XP and Echoes.
- **Biomes and hazards.** There are five biomes, each with four ores, two gems and a heart:
  | Biome | Depths | Hazard |
  | --- | --- | --- |
  | Topsoil Mine | 1–20 | none |
  | Fungal Caverns | 21–50 | spores choke your machines |
  | Crystal Hollows | 51–90 | crits shatter blocks for double ore |
  | Magma Veins | 91–140 | heat slows you and your machines |
  | The Hollow | 141 and below | it is too dark to work without a bright lantern |
- **The Descent.** This is the prestige layer. Collapse the shaft and keep your miner, then spend the Echoes you earn on a permanent 10-node tree.

## Running it

All commands run from this directory (`hollowdeep/`).

```bash
npm install
npm run dev          # dev server
npm run build        # typecheck + production build into dist/
npm run preview      # serve the build at http://localhost:4173/
```

## Controls

Tap the rock to swing. On a desktop, Space swings and 1–3 use the skills. The button at the top right (or F) switches to full screen wherever the browser supports it. iPhone Safari does not, but adding the game to the home screen does the same job.

## Art and sound: all made in code

There are no image or audio files to fetch.

- **Sprites.** The sprites are hand-written pixel art in [`src/sprites/defs.ts`](src/sprites/defs.ts). Each one is a grid of characters plus a palette. Ores, ingots, gems and gear are palette swaps of a few templates, and their colours come from `src/data`. `npm run bake` packs them into `src/sprites/atlas.png` and `atlas.json`, both committed, and writes the app icons. A test fails if the atlas goes stale.
- **Sound effects.** [`src/audio/sfx.ts`](src/audio/sfx.ts) synthesises every effect with Web Audio. The pick's pitch rises with the value of the ore.
- **Music.** [`src/audio/music.ts`](src/audio/music.ts) is a generative ambient score: a drone, slow pads, sparse FM bells and distant "breath" swells. Each biome sets the key, mode, tempo, filter and unease. The music gets slower and less resolved the deeper you go. The Hollow uses a Locrian scale over a tritone drone, with a heartbeat that is not yours.

## Checks

```bash
npm run validate     # content graph: every recipe, mission and material reachable in time
npm test             # unit tests, plus a bot that plays six hours and must hit the milestones
npm run playtest -- 6   # print the bot's progress, for tuning src/data/progression.ts
npm run verify       # screenshots of every tab at phone, tablet and desktop sizes, plus an audio check
```

The bot ([`src/game/bot.ts`](src/game/bot.ts)) plays like an ordinary player: it taps four times a second, spends greedily and never plans ahead. In six simulated hours it has to reach the Crystal Hollows, finish 15 story missions, craft gear and Descend at least once. A balance change that breaks the early curve fails `npm test`.

`npm run verify` needs the preview server running. Set `CHROMIUM_PATH` to use a browser that is already installed.

## Layout of the code

| Path | What it holds |
| --- | --- |
| `src/data/` | Content, as plain typed data: biomes, materials, gear, recipes, missions, and the balance numbers in `progression.ts`. |
| `src/game/` | The simulation: mining, the RPG, crafting, missions, the Descent and offline time. Pure functions over `GameState`, seeded RNG, and no DOM. |
| `src/render/` | The canvas scene. It reads the state and listens to game events. |
| `src/audio/` | The mixer, effects and score. |
| `src/ui/` | The panels, written as HTML strings and patched into the page so that buttons survive re-renders. |
| `src/state/` | Save, load, migration, and export or import as a code. |
