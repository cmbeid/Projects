# Hearthrise

An incremental city-building game for the phone. It's built for portrait and scales up to tablets and desktops. A boat leaves you on the beach of a drowned city with a hammer and a lantern. Clear the ruins ward by ward, build the city back on the ground you win, and find out why everyone stood on the quays and let the sea come in. Out in the bay, the white Spire hums.

- **Clearing and upgrades.** Tap the ruin at the work site to swing. Every 20 ruins a landmark stands exposed; bring it down and the next ward opens, with a new row of land. Coin buys upgrades (tools, barrows, ledgers, kilns, steady hands, foremen), with ×10, Max and a Spend all button.
- **The city.** Each district is a 6×8 grid, one row per ward. There are 32 buildings in six kinds: homes, crews, trade, industry, green spaces and civic buildings, from 1×1 tents to a 2×2 arcology. Homes house citizens; crews and trade need hands. Crews clear ruins on their own, and trade pays taxes, offline too (up to 8 hours, more with upgrades). Every level of a type costs the same whether you place a new one or build one up, so the map decides which is better.
- **Neighbours.** Every building likes or dislikes its neighbours by kind: homes like gardens and hate industry, trade likes homes, crews like a short walk home. Each point is +10% to that building, and the average home sets the city's happiness, which multiplies every workplace. Placing shows a ghost with what it would get and give before you build. Tap a building to level it up, move it for free or pull it down for half back.
- **The Founder.** Levels up from every ruin. Each level gives points for Craft, Vision, Charm and Grit, and every third level a point for a 12-node passive tree. Three edicts draw on resolve: Work Rush, Survey and Festival.
- **Workshops and the Drafting Hall.** Workshops turn salvage into goods over time, one slot of your own and one for every workshop, boatyard or foundry in the city. The Drafting Hall makes 34 pieces of regalia across four slots (chain, seal, coat and lantern), each with random affixes, up to the Founders' set at the top of the Spire. It also makes 10 supplies and 7 one-off fixtures; there are 62 recipes in all.
- **Story.** A 44-mission story runs from the beach to the top of the Spire, unlocks each system as it introduces it, and ends with a choice. Three citizens' petitions a day pay coin, XP and Memories.
- **Districts and hazards.** Five districts, each with four kinds of salvage, two relics and a heart:
  | District | Wards | Era | Hazard |
  | --- | --- | --- | --- |
  | The Landing | 1–8 | Camp | none |
  | Old Harbour | 9–16 | Village | the tide floods the low rows and slows your crews |
  | Market Ward | 17–24 | Town | crowds slow your crews, and bad neighbours count double |
  | Foundry Quarter | 25–32 | City | smog: you need a sealed coat, your crews need scrubbers |
  | The Drowned Spire | 33 and up | Arcology | fog: you need a bright lantern, your crews need beacons |
- **The Tide.** This is the prestige layer. Let the sea take the city, keep the Founder, and spend the Memories you earn on a permanent 10-node Charter. The layout is kept as a plan, and one button puts it back as the wards reopen.

## Running it

All commands run from this directory (`hearthrise/`).

```bash
npm install
npm run dev          # dev server
npm run build        # typecheck + production build into dist/
npm run preview      # serve the build at http://localhost:4173/
```

## Controls

Tap the ruin on the right to swing; tap the map to build or to open a building. In Build, pick a building, then tap open ground: on a phone the first tap shows the ghost and the second builds, and with a mouse the ghost follows the pointer and a click builds. On a desktop, Space swings, 1–3 proclaim the edicts, Esc stops placing, and F (or the button at the top right) switches to full screen wherever the browser supports it.

## Art and sound: all made in code

There are no image or audio files to fetch.

- **Sprites.** The sprites are hand-written pixel art in [`src/sprites/defs.ts`](src/sprites/defs.ts). Each one is a grid of characters plus a palette; the three 2×2 buildings are drawn by a few lines of code instead. Salvage, goods, relics and regalia are palette swaps of a few templates, with colours from `src/data`, and every building takes its roof and wall colours from its own entry. `npm run bake` packs them into `src/sprites/atlas.png` and `atlas.json`, both committed, and writes the app icons. A test fails if the atlas goes stale.
- **Sound effects.** [`src/audio/sfx.ts`](src/audio/sfx.ts) synthesises every effect with Web Audio. The hammer's pitch rises with the value of the salvage, and a new building plays a little figure that climbs higher the dearer it was.
- **Music.** [`src/audio/music.ts`](src/audio/music.ts) is a generative score: a drone, slow pads, sparse FM bells, a plucked ostinato for the bustle of the town, and surf on the shingle. Each district sets the key, mode, tempo, brightness and how busy it is. The camp is warm and pentatonic, the Market busy, the Foundry mechanical, and the Spire very quiet, over a tritone and a toll too deep to be a bell. The story changes it.

## Checks

```bash
npm run validate     # content graph: every building, recipe, mission and material reachable in time
npm test             # unit tests, plus a bot that plays six hours and must hit the milestones
npm run playtest -- 6   # print the bot's progress, for tuning src/data/progression.ts
npm run verify       # screenshots of every tab at phone, tablet and desktop sizes, a building placed by tapping, and an audio check
```

The bot ([`src/game/bot.ts`](src/game/bot.ts)) plays like an ordinary player: it taps four times a second, spends greedily, puts each new building on the best tile it can see and never plans ahead. In six simulated hours it has to reach the Market Ward, finish 15 story missions, make regalia, keep the city's happiness at 100% or more and let the Tide in at least once. A balance change that breaks the early curve fails `npm test`.

`npm run verify` needs the preview server running. Set `CHROMIUM_PATH` to use a browser that is already installed.

## Layout of the code

| Path | What it holds |
| --- | --- |
| `src/data/` | Content, as plain typed data: districts, materials, buildings, regalia, recipes, missions, and the balance numbers in `progression.ts`. |
| `src/game/` | The simulation: clearing, the grid and adjacency, the economy, the Founder, workshops, missions, the Tide and time away. Pure functions over `GameState`, seeded RNG, and no DOM. |
| `src/render/` | The canvas scene. It reads the state and listens to game events. |
| `src/audio/` | The mixer, effects and score. |
| `src/ui/` | The panels, written as HTML strings and patched into the page so that buttons survive re-renders, and the placement flow. |
| `src/state/` | Save, load, defaults for older saves, and export or import as a code. |

[`PLAN.md`](PLAN.md) is the plan the game was built from.
