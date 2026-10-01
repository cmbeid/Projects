# PokéHarvest — design & implementation plan

> **Status:** All five phases are built. Phase 3 also added a Farm role, as requested: Pokémon assigned to the farm live in the barn and work all day while you're away. Phase 5 (below) added the story, the town, two routes, trainers, crafting stations and the on-screen d-pad.

## Context
You want a new personal-project game for the `cmbeid/Projects` monorepo: a Pokémon-themed farming sim for HTML5 mobile web. It should be built for portrait phones and still scale up well on desktop. It needs RPG progression and upgrades, a day/night cycle, an economy, crafting, and turn-based battles.

The repo already has two Pokémon games, `pokedefense/` and `pokefling/`. Both use the same stack: Vite 7, TypeScript (strict), Vitest, plain Canvas 2D for the game view and a DOM HUD. Pokémon assets are pulled once from the PokeAPI GitHub repos by a script and committed under `public/`. The new game copies that stack and those patterns. There's no shared package in the repo, so files are copied rather than imported.

**Decisions you made:**
- You play a human farmer. Pokémon are both farmhands (with type-based jobs) and livestock that produce goods.
- The farm is a walkable top-down tile map with tap-to-move.
- There are turn-based battles with wild Pokémon in forage areas.
- It ships as a phased MVP.

New folder: **`pokeharvest/`**.

---

## Core game design

**Core loop**
1. Wake at 6:00 and energy refills.
2. Till, plant, water and harvest.
3. Pokémon helpers do their jobs automatically.
4. Collect livestock goods.
5. Craft or process goods.
6. Sell them into the shipping bin (paid overnight) or at the Poké Mart.
7. Spend the money on upgrades.
8. Sleep. The save happens at the end of the day.

**Time and day/night**
- 1 in-game minute = 0.7 s real time, so a day from 6:00 to 2:00 is about 14 min.
- 4 seasons of 28 days each, with a weather roll each day: sun, rain (auto-waters crops) or storm.
- The canvas gets a tint gradient: dawn → day → dusk → night.
- At night some Pokémon appear only then (Hoothoot, Gastly), and lamps and campfires give light.
- If you're still awake at 2:00 you pass out, lose 10% of your money and start the next day with reduced energy.

**Farming**
- Soil tiles go through these states: untilled → tilled → planted → watered.
- Crops have per-season growth stages and some regrow. They're berries plus farm crops, for example Oran, Pecha, Cheri, Sitrus, Leppa, and Apricorns on trees.
- Quality tiers are normal, silver and gold. Quality comes from fertilizer, the farmer's Farming skill and Grass-helper bonuses.

**Pokémon helpers** each type has a job:
| Type | Job |
|---|---|
| Water | Waters crops |
| Grass | Growth boost |
| Fire | Fuels furnaces and kilns |
| Ground | Tills soil |
| Electric | Powers machines |
| Bug | Pollinates, for a quality chance |
| Normal/Fighting | Hauls produce to the bin |
| Flying | Scares off pests |

- Each Pokémon has a friendship meter, a level and an energy stat. It works within a radius around its assigned building or area.
- Helpers are housed in a Barn, Coop or Pond whose capacity can be upgraded.

**Livestock producers** are fed daily and give more when friendship is high:

| Pokémon | Product |
|---|---|
| Miltank | Moomoo Milk |
| Mareep | Wool |
| Chansey | Lucky Egg |
| Combee | Honey |
| Wooloo | Wool |
| Shellder/Slowpoke | Tail |
| Torchic | Egg |

**RPG progression**
- The farmer has skills (Farming, Ranching, Crafting, Foraging, Battling). Each has XP and levels 1–10, and each level gives a perk picked from two options.
- Tool upgrades go Basic → Copper → Steel → Gold. Better tools hit an area and cost less energy. They're made at the Blacksmith for ore plus gold and take one day.
- Building upgrades expand the farmhouse (more storage and kitchen), the barn and coop (more capacity), and the greenhouse (grows in any season).
- There's a Pokédex, with completion rewards.
- Town requests work as quests: NPCs post item requests that pay gold and reputation, and reputation unlocks shop stock.

**Economy**
- Each item has a base price, adjusted by quality, a seasonal demand multiplier and a daily market fluctuation of ±15%, driven by a seeded RNG.
- Selling large volumes of one item that day drives its price down.
- The Poké Mart sells seeds, feed, fertilizer and Poké Balls.
- The Blacksmith handles tools and ore processing.
- The Carpenter handles buildings.
- A travelling merchant visits on weekends with rare seeds and TMs.

**Crafting**
- The data is a recipe table: inputs → output, the station needed, the time it takes and a skill gate.
- Stations are the Workbench, Kitchen (cooking dishes that restore energy and give buffs), Keg/Jar (juice, jam), Furnace (Fire helper speeds it up), Loom (wool → cloth) and Apricorn Workshop (Poké Balls from Apricorns).
- Machines keep processing in real time while the day runs.

**Turn-based battles**
- Wild Pokémon appear in tall grass on the forage map ("Route 1", reached by a gate from the farm). Night swaps in a different encounter table.
- You bring a party of up to 3 of your Pokémon.
- The battle screen offers Fight (4 moves), Item, Switch and Run. There's also Befriend: throw a Poké Ball or offer a berry, with a catch chance based on HP and catch rate.
- Damage uses a simplified Gen formula with type effectiveness, using `types.ts` copied from pokedefense. There's STAB and a small random roll. Stats are HP/Atk/Def/Spd from level and base stats.
- Wins give XP to the party and Battling XP to the farmer, and drop materials (ore, fiber, rare seeds). Befriended Pokémon become helpers or livestock.
- Pokémon level up, learn moves at set levels, and evolve at a level or by item (for example Mareep → Flaaffy → Ampharos, which also improves the job it does).

**Species roster** has about 40 at launch and is easy to extend. Examples: Bulbasaur line, Oddish, Bellsprout, Chikorita, Squirtle, Wooper, Lotad, Charmander, Growlithe, Diglett, Sandshrew, Pikachu, Mareep line, Miltank, Chansey, Wooloo, Combee, Torchic, Slowpoke, Pidgey, Hoothoot, Caterpie line, Machop, Rattata, Gastly, Eevee.

---

## Technical architecture

**Stack**
- Copied from `pokedefense/`: `package.json` scripts, `vite.config.ts` (`base: './'`), `tsconfig.json`, and `.gitignore` (`screenshots/`).
- No runtime dependencies.

**Code reused by copying**
| From | Into `pokeharvest/` |
|---|---|
| `pokedefense/src/ui/dom.ts` (`h()` helper) | `src/ui/dom.ts` |
| `pokedefense/src/ui/fullscreen.ts` | `src/ui/fullscreen.ts` |
| `pokedefense/src/audio/index.ts` (buses, `unlock`, `cry`, `suspend`) | `src/audio/index.ts` |
| `pokedefense/src/audio/music.ts` and `scripts/music/*` | music sequencer and parsers, optional in phase 3 |
| `pokedefense/src/data/types.ts` (`TYPES`, `effectiveness`, `TYPE_COLOURS`) | `src/data/types.ts` |
| `pokedefense/src/data/species/make.ts` pattern | species table |
| `pokedefense/src/render/sprites.ts` (`loadSheet`, `loadSheets`, animated sheet JSON) | `src/render/sprites.ts` |
| `pokedefense/src/state/save.ts` (injected `Store`, versioned key, validation on load) | `src/state/save.ts` |
| `pokedefense/scripts/fetch-assets.ts` (`fetchSprite`, `packSheet`, `fetchCry`, `encodeWav`, `fetchFile`) | `scripts/fetch-assets.ts` |

**Assets** are fetched by `scripts/fetch-assets.ts` and committed:
- Pokémon sprites are animated Gen 5 black-white GIFs, packed into sheets, with the Showdown sprites as a fallback. They go to `public/sprites/{dex}.png|json`. These overworld-sized sprites work for both farm helpers and battles.
- Cries go to `public/cries/{dex}.wav`.
- Item icons come from PokeAPI `sprites/items/{name}.png` (berries, Poké Balls, Moomoo Milk, Honey, ores and more) and go to `public/items/`.
- Terrain and building tiles are procedurally drawn pixel art in `src/render/tiles.ts`. PokeAPI has no tilesets, and drawing them in code keeps the repo lean. The farmer avatar is also a small procedural 4-direction sprite.

**`src/` layout**
```
main.ts                      bootstrap and audio unlock (pattern from pokedefense main.ts)
data/  types.ts species/ moves.ts items.ts crops.ts recipes.ts shops.ts buildings.ts
       encounters.ts maps.ts quests.ts upgrades.ts skills.ts
game/  world.ts      pure sim: state, fixed-step tick(dt), command functions, events[]
       time.ts       clock, seasons, weather, day rollover
       farm.ts       soil and crop growth, watering, harvesting
       helpers.ts    helper AI (job targeting within a radius, pathing on the tile grid)
       livestock.ts  feeding and production
       economy.ts    pricing, shipping bin, market RNG
       crafting.ts   station queues
       battle.ts     pure turn-based battle engine (damage, catching, XP)
       progression.ts skills, levels, evolutions, tools
       path.ts rng.ts
render/ camera.ts (follows the player; portrait pans, wide screens show more)
        tiles.ts sprites.ts draw.ts lighting.ts (day/night tint and light sources)
        battle-view.ts
ui/    app.ts hud.ts (clock, energy, gold, hotbar) inventory.ts shop.ts crafting.ts
       party.ts dex.ts quests.ts settings.ts dom.ts fullscreen.ts
state/ save.ts
audio/ index.ts music.ts
style.css
```

**Key architecture rules** (following pokedefense):
- `game/*` is pure TypeScript with no DOM. The UI changes state only through commands such as `till`, `plant`, `water`, `harvest`, `craft`, `sell`, `assignHelper` and `battleAction`.
- The sim emits `events[]`, which render and audio consume each frame.
- The loop uses `requestAnimationFrame` with a fixed-step accumulator (`STEP = 1/60`, dt capped at 0.1). It pauses on menus and when the tab is hidden.
- Randomness comes from a seeded RNG stored in the save file, so the sim is deterministic and testable.

**Input and layout**
- Tapping a tile makes the avatar path to it (A* in `path.ts`) and then act with the selected hotbar tool or seed. Tapping a Pokémon or NPC talks to it.
- An optional virtual d-pad can be turned on in settings. Desktop gets WASD plus a click-to-move keyboard mode.
- Pointer events with `touch-action: none`, and the gesture blocking from pokedefense.
- **Portrait first:** the canvas fills the viewport, the HUD strip is at the top (time, weather, gold, energy), and the hotbar sits at the bottom within the safe-area insets. Menus are bottom sheets.
- **Wide screens:** a `ResizeObserver` picks an integer tile scale. At aspect ratio ≥ 1 or width ≥ 900 px, menus dock as a side panel instead of a sheet, the camera shows more tiles, and the inventory and crafting open side by side. This reuses pokedefense's `arrange()` stack/side idea.
- 44 px touch targets, `env(safe-area-inset-*)`, and a fullscreen toggle.

**Save**
- Key `pokeharvest.save.v1` in localStorage. It holds the world, map tiles, inventory, party and box, the clock, the RNG seed and quests.
- Autosave on sleep, plus a light snapshot every in-game hour.
- Loading validates each field and falls back to its default.
- Export and import as JSON from settings.

---

## Phases
1. **Core loop MVP**
   - Scaffold, fetch-assets script, farm map, walking avatar, tools (hoe, can, sickle).
   - Crops for 1 season, clock and day/night tint, sleep and the shipping bin, Poké Mart, HUD, inventory, save and load.
   - Starter helper Pokémon (pick a Grass, Water or Fire starter) doing its job.
2. **RPG and battles**
   - Route 1 map, the turn-based battle engine and UI, befriending and catching.
   - Party and box, Pokémon leveling, moves and evolution, farmer skills and perks, tool upgrades at the Blacksmith.
3. **Ranching, crafting and economy depth**
   - Barn and coop, livestock goods, crafting stations and recipes, cooking buffs.
   - Market fluctuation and saturation, travelling merchant, town requests and reputation.
4. **Content and polish**
   - All 4 seasons plus the greenhouse, weather, night encounters, the Pokédex and its rewards, and more species.
   - Chiptune music, sfx, cries, and the Playwright verify and playtest scripts.

---

## Repo integration
- Add `pokeharvest` to `.github/workflows/pages.yml` in all 5 places:
  1. `paths`
  2. `cache-dependency-path`
  3. install/test/build steps
  4. the "Assemble the site" copy
  5. an index card in the heredoc
- Add rows to the root `README.md` project table and the Pages table, and mention it in the "Pages-only" sentence.
- Add `pokeharvest/README.md` covering how to play, the scripts and asset credits (a fair-use personal-project note).

---

## Verification
- **Vitest unit tests** (`tests/*.test.ts`):
  - `time` (day rollover, seasons), `farm` (growth, watering, regrowth), `economy` (pricing, saturation, deterministic RNG)
  - `crafting` (recipe validity: every input and output exists in `items.ts`)
  - `battle` (damage against the type chart, catch odds, XP and level-up, evolution)
  - `save` (round trip, and recovering from corrupt fields)
  - `helpers` (a Water helper waters every crop in its radius)
- **Asset test:** every species has a sprite, sheet and cry, and every item has an icon. This mirrors `pokedefense/tests/assets.test.ts`.
- **Headless sim test:** a bot plays 7 in-game days (plant → water → harvest → sell) and must end with more gold than it started with.
- **Build and run:**
  - `npm run build` passes the typecheck.
  - `npm run preview` works.
  - `scripts/verify-ui.ts` (Playwright on the preinstalled Chromium) screenshots phone portrait at 390×844, a tablet and 1440×900 desktop. It checks nothing overflows and the hotbar and HUD are visible.
  - A manual pass covers tap-to-move, a full day, a battle and a save reload.

---

## Phase 5: town, routes, trainers, stations, d-pad and story (built)
- **Story, "Revive Cobblevale":** five chapters with goals and dialogue. Each one finished opens more of the world: the road to town, the Pokémon Center, Granite Pass, and the Harvest Festival, which ends with a battle against your rival Kai.
- **Maps:** Cobblevale Town (Pokémon Center, Mayor's Hall, workshop, townsfolk), Whisperwood (forest: Apricorns and wood) and Granite Pass (cave: ore).
- **Trainers:** 12 roaming trainers with lines of sight and teams, beatable once a week; Kai's weekly rematches come after the story.
- **Stations:** Workbench (needed for crafting machines), Furnace (ore into bars, faster with Fire Pokémon and no wood needed), Apricorn Workshop (Apricorn balls). The kitchen moved into the farmhouse.
- **On-screen d-pad:** can be turned on or off, resized, made more or less see-through, and dragged anywhere.

## Seed Box and sowing helpers (built)
- **The Seed Box:** a fixed crate by the house that you stock with seeds. You pick what it plants: one seed, or Auto (the most plentiful seed that will grow on the tile).
- **The Sow job:** Ground types now sow instead of harvesting.
  - They walk to the box, take one seed, and plant it in the nearest empty plot anywhere on the farm, greenhouse included.
  - They re-till field tiles that went back to grass.
  - Seeds they're carrying go back into the box if a trip is called off or the game saves.
- **Saves:** older saves count their existing plots as fields. Anything that stood where the box now is goes back to the bag.

## Rest bars and the bench (built)
- **Rest bars:** a bar over each crop-working Pokémon (water, tend, harvest, sow) counts down to its next job. It's amber when the Pokémon is hungry, and hidden while it's walking to a job or off duty.
- **The bench:** a fixed bench by the house. Sitting on it runs the whole sim six times faster, crops, helpers and machines alike. Any input gets you up, and so does midnight. Saves store you standing beside it.
