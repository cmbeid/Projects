# Epochs — an incremental city through the ages (plan)

> The plan the game was built from. Where the build departed from it, the README is the reference.

## Context

The user wants another incremental city-building game in `cmbeid/Projects`, but explicitly **not like Hearthrise** (`hearthrise/`: tap ruins → place buildings on a 6×8 adjacency grid → Founder RPG stats/passive tree → crafting regalia → 57-mission story → Tide prestige). Chosen direction: **"Through the ages"** — one city pushed from a Stone Age campfire to the Space Age, with a research tree, wonders, and buildings that visibly transform each era. Prestige is launching a colony ship and starting over on a new planet. Art: **pixel art** (same in-code sprite pipeline as before).

Directory: `epochs/`.

## What makes it different from Hearthrise

| Hearthrise | Epochs |
| --- | --- |
| Tap a ruin to clear it | **No tap loop.** The verb is *allocating people*: assign citizens to jobs, and decide what to build/research next. |
| Top-down 6×8 grid, adjacency puzzle | **Side-view pixel skyline** that scrolls horizontally. No placement: buildings are counts; the skyline renders them on **land plots**, which are the hard constraint. |
| Founder levels, stats, passive tree | **Research tree** per era (Knowledge), branching, with era-advance gates. |
| Workshops + regalia with affixes | **Wonders**: multi-stage construction projects (one or two per era) that stay standing on the skyline and give permanent bonuses. |
| Linear 57-mission story | **The Chronicle**: seeded historical events with a timed choice (plague, flood, a prophet, a schism, a gold rush…), plus 3–5 era goals that gate the age advance. |
| Districts with hazards | **Eras** that reskin everything: every building has an evolved sprite per era (hut → longhouse → villa → townhouse → tenement → apartment block → arcology pod). Resources become obsolete or convert as eras pass. |
| The Tide (Memories, Charter) | **Colony ship**: a five-stage Space-Age wonder. Launch → new planet with random **planet traits** (low gravity, ocean world, thin air…) that change costs and rules. Spend **Heritage** on a permanent tree. |

## The game, system by system

- **Population.** Citizens grow from food surplus up to housing capacity. Each citizen eats; starvation shrinks the population. **Jobs** expand per era: Forager → Farmer, Woodcutter, Quarrier, Miner, Scholar, Artisan, Merchant, Priest/Artist, Engineer, Clerk, Technician, Scientist, Astronaut. Jobs panel has +/− and "assign idle" buttons; a research unlocks auto-assign by ratio.
- **Resources** (~14): Food, Wood, Stone, Copper/Bronze, Iron, Knowledge, Gold, Culture, Faith, Coal, Steel, Oil, Power, Data, Alloy. Storage caps rise with storehouses/warehouses. Some resources stop being produced or auto-convert at later eras (e.g. Wood → mostly consumed by industry).
- **Buildings** come in 14 *lines* (homes, farms, lumber, quarries, mines, storage, learning, culture, trade, industry, power, oil, computing, fabrication) with a tier per era — 81 buildings in all. Cost scales ×1.15 per unit of the line, and each takes a plot. Whatever you build is the current era's tier; older ones stay as they were until you **modernize** them in place.
- **Land.** The skyline is a strip of plots that grows via research (Surveying, Land reclamation, High-rise, Arcologies) and wonders. Taller eras raise plot density (more housing per plot), which is the main growth beat.
- **Stability.** Culture and Faith vs population size and overcrowding. Low stability lowers output and raises the odds of unrest Chronicle events; high stability triggers a **Golden Age** (temporary ×2 output).
- **Research.** ~10 techs per era (≈80 total) in a branching tree drawn as nodes; cost in Knowledge (later Data). One research at a time with a queue unlocked mid-game. The era-advance tech requires the era's key techs, its goals, and one wonder completed.
- **Wonders** (~12): Standing Stones, Great Ziggurat, Colossus, Great Library, Cathedral, Observatory, Great Exhibition, Grand Dam, Skyscraper, Space Elevator, Colony Ship (5 stages). Each stage costs a bundle of resources + worker-time; large pixel sprite on the skyline.
- **Chronicle.** Every few minutes a seeded event card with two choices and real consequences (lose 10% food but gain Faith; accept refugees for +pop/−stability…). ~60 events tagged by era. Unanswered events auto-resolve to a default after a timer. A scrollable history log of the city's events, with era headings — the "story" is the city's own history.
- **Eras** (8): Stone, Bronze, Classical, Medieval, Renaissance, Industrial, Modern, Space. Age advance is a moment: transition card, the skyline repaints building by building, the palette and music change.
- **Colony ship (prestige).** Launch keeps nothing but **Heritage** (from total population peak, wonders built and eras reached) and the Chronicle archive. Heritage buys a 12-node permanent tree (faster early eras, start with a tech, extra plot, cheaper wonders). Each new planet rolls 1–2 traits that modify the run and its sky/ground palette.
- **Offline.** Closed-form rates from `derive()`, up to 8h (more from Heritage). Chronicle events don't fire offline; research and wonder stages progress.

## Screen layout

Portrait first. Top: canvas skyline (horizontal scroll/drag, day–night cycle, citizens walking, smoke, era palette; wonders tall in the background). Below: resource bar (rates on tap), then tabs **City · Jobs · Research · Wonders · Chronicle · Heritage · Settings**. At ≥900px scene and panel sit side by side. Event cards pop over the panel. Keyboard on desktop: 1–7 switch tabs, F fullscreen.

## Code layout — `epochs/` (same toolchain as `hearthrise/`)

| Path | Contents |
| --- | --- |
| `src/data/` | `types.ts`, `eras.ts`, `resources.ts`, `jobs.ts`, `buildings.ts`, `techs.ts`, `wonders.ts`, `events.ts` (Chronicle), `planets.ts`, `heritage.ts`, `progression.ts` (all balance numbers), `validate.ts` |
| `src/game/` | `engine.ts` (newGame, tick), `population.ts` (growth, food, jobs), `economy.ts` (production/consumption/storage), `buildings.ts` (cost, land), `research.ts`, `wonders.ts`, `stability.ts`, `chronicle.ts`, `eras.ts` (advance + goals), `colony.ts` (prestige), `offline.ts`, `derive.ts`, `bot.ts`, plus copied `rng.ts`, `events.ts`, `features.ts` |
| `src/render/` | `scene.ts` (side-view parallax skyline, plots → building sprites per era, citizens, weather, day/night), `camera.ts` (drag scroll) |
| `src/sprites/` | `defs.ts` hand-written pixel art: each building type has one sprite per era it exists in; templates + palette swaps per era; `atlas.ts`, `hash.ts`, committed `atlas.png/json` |
| `src/audio/` | `index.ts` mixer, `sfx.ts`, `music.ts`/`song.ts`: chip score whose *instrumentation and mode* change by era (drums + drone in Stone Age, lyre-like arps in Classical, modal chant in Medieval, harpsichord-ish arps in Renaissance, mechanical ostinato in Industrial, synth pop in Modern, sparse ambient in Space) |
| `src/ui/` | `app.ts`, `panels.ts` (one module per tab if large), `techtree.ts`, `dom.ts` |
| `src/state/` | `types.ts`, `persistence.ts` (save, migrate, export/import code) |
| `scripts/` | `bake-sprites.ts`, `validate-data.ts`, `playtest.ts`, `verify-ui.ts` |
| `tests/` | data, engine, population, research, wonders, chronicle, offline, colony, persistence, sprites (atlas not stale), bot |

**Reuse (copied, not imported — projects stay independent):** from `hearthrise/`: `src/game/rng.ts`, `events.ts`, `features.ts`; `src/num/format.ts`; `src/ui/dom.ts`; the save/migrate/export pattern in `src/state/persistence.ts`; `src/audio/index.ts` and the chip voice in `music.ts`; the sprite pipeline (`src/sprites/atlas.ts`, `hash.ts`, `scripts/bake-sprites.ts`); `scripts/verify-ui.ts`, `scripts/playtest.ts`; `package.json` deps/scripts, `vite.config.ts` (`base: './'`), `tsconfig.json`, `index.html`, `public/manifest.webmanifest`. Use a different font pairing and a different UI colour scheme so it doesn't look like a Hearthrise reskin.

## Build order (one commit each)

1. Plan (`epochs/PLAN.md`), content data, simulation, saves and the balance bot
2. Hand-written pixel sprites (per-era building variants, wonders, citizens), baked atlas and icons
3. Sound effects and the era-shifting chip score
4. Canvas skyline and the responsive UI (tabs, tech tree, event cards)
5. Tests, `epochs/README.md`, publishing: add `epochs/**` path filter, cache path, install/validate/test/build steps, `_site/epochs` copy and an index card in `.github/workflows/pages.yml`; rows in both root `README.md` tables

Then push to `claude/pensive-knuth-r6qrc1` and open a draft PR.

## Verification

- `npm run validate`: every building, job, tech, wonder and event is reachable in its era; the tech tree has no cycles; every era goal is achievable.
- `npm test`: unit tests plus a **bot** that assigns jobs greedily, buys the cheapest useful thing, researches cheapest-first and picks the first Chronicle choice. Milestones: Bronze Age in < 30 min, Medieval within 6 simulated hours, stability never stuck below 50%, at least one wonder; a second bot run of ~30 simulated hours must launch the colony ship once.
- `npm run playtest -- 6`: prints the curve for tuning `progression.ts`.
- `npm run build`: typecheck + Vite build.
- `npm run verify` (preview server running, `CHROMIUM_PATH=/opt/pw-browsers/chromium`): screenshots of every tab at 390×844, 1024×768, 1440×900; scripted flow (assign a job, buy a building, start research, answer an event); no console errors, no horizontal page scroll, AudioContext running.
