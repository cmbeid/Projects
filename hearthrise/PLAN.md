# Hearthrise — an incremental city-building game (plan)

## Context

Hollowdeep (`hollowdeep/`, PR #73) set a pattern for games in this repo: a portrait-first phone incremental game in TypeScript and Vite. It has typed content data, a pure simulation with seeded RNG, pixel art and audio made in code, a balance bot that must hit milestones in `npm test`, and Playwright UI checks. It publishes to Pages only. **Hearthrise** reuses that format and the same system skeleton (tap loop → idle machines → RPG → crafting → story missions → prestige). The mining becomes rebuilding a drowned, abandoned city. The player clears ruins and places buildings on a small grid for each district, with adjacency bonuses. The city grows from a camp to an arcology, and a quiet mystery story asks who left the city, and why.

Decisions taken: **small grid + incremental** (not pure lists, not free-form SimCity), and the **"ruins to skyline"** theme.

## The game, system by system (Hollowdeep → Hearthrise)

| Hollowdeep | Hearthrise |
| --- | --- |
| Tap the rock, block HP, ore drops | Tap a **ruin tile** on the district grid. It has HP and drops salvage (timber, stone, scrap, glass and so on), plus a rare **relic** (the gem analog). |
| Seam every 10 blocks opens next depth | Clearing a district's **landmark ruin** (a big multi-tile ruin) opens the next **ward** (the depth analog). There are about 40 wards across 5 districts. |
| Coin upgrades | **Civic upgrades**, bought with coin. These are tools (tap power), carts (salvage yield), ledgers (tax) and so on, with bulk buy and Spend all from the start. |
| Drones / rigs / excavators (idle, offline) | **Placed buildings**. Homes give citizens. Workplaces turn citizens into output. Crews (salvage gangs, cranes, dredgers) clear ruins idly, up to 8h offline. |
| — (new) | **Grid and adjacency.** Each district is a 6×8 grid, which fits portrait. Buildings have footprints of 1×1 to 2×2 and tags (home, work, green, civic, power). There are adjacency rules: a park next to homes gives +happiness, a smithy next to homes gives −, a market next to many homes gives more tax. **Happiness** multiplies all output. |
| Miner level, STR/DEX/LCK/END, 12-node passive tree | **Founder** level (XP from clearing and building). The stats are **Vision** (build cost), **Craft** (tap and clear power), **Charm** (tax and happiness) and **Grit** (stamina and offline cap). There is a 12-node passive tree. |
| Power Strike / Dowse / Frenzy (stamina) | **Edicts**, which use resolve: **Work Rush** (a big tap), **Survey** (shows relics and boosts drops) and **Festival** (multiplies all output for a short time). |
| Furnaces (timed, offline) | **Workshops**: sawmill, kiln, foundry and glassworks. They turn salvage into materials (planks, bricks, beams, panes), which advanced buildings need. |
| Workbench gear (4 slots, affixes) | **Regalia**, crafted at the Drafting Hall. There are 4 slots: Chain of Office, Seal, Coat and Lantern-Charm. Each has random affixes, plus a late set for the bottom district. **Supplies** (blasting charges, festival wine, surveyor's ink…) and one-off **fixtures**. |
| 42-mission story plus 3 daily contracts | About 40 story missions that also act as the tutorial and unlock each system. Plus 3 seeded daily **citizen petitions**. |
| Biome hazards | District hazards (below). |
| The Descent → Echoes, 10-node tree | **The Tide**: let the sea take the city back. Keep the Founder, earn **Memories** and spend them on a permanent 10-node "Charter" tree. Placed buildings reset, and a blueprint "remembered layout" fixture can restore one district's plan for free. |

### Districts (biome analog)

| District | Wards | Era | Hazard |
| --- | --- | --- | --- |
| The Landing | 1–6 | Camp | none (tutorial) |
| Old Harbour | 7–14 | Village | **Tides**: the lowest row floods on a cycle, and buildings there pause unless walled. |
| Market Ward | 15–24 | Town | **Crowding**: negative adjacency counts double, so the layout matters. |
| Foundry Quarter | 25–34 | City | **Smog**: workshops spread unhappiness unless parks or filters are nearby. |
| The Drowned Spire | 35–40+ | Arcology | **Silence**: fog hides tiles, which a lit lantern-charm or beacons reveal. The Spire hums, and the story ends here. |

Story spine: the founders sealed something under the Spire and flooded the city to keep it asleep. Rebuilding wakes it, and the Tide (prestige) is the city choosing to forget again. The tone stays gentle, with a hint of Hollowdeep's unease.

### Screen layout (same as Hollowdeep)
Portrait: the canvas shows the active district grid at the top, and the tab panel sits below it (Build · Founder · Workshops · Missions · Tide · Settings). Tapping a ruin swings. In Build, you pick a building and then tap a free tile to place it. A ghost preview shows the adjacency deltas, and you tap again to confirm. A long press moves or demolishes a building (it refunds 50%). At 900px and up, the scene and panel sit side by side. At 1300px and up, Missions gets its own column. Tapping the district name jumps to any opened ward. There is a full-screen button and keyboard shortcuts (Space taps the selected ruin, 1–3 cast edicts).

## Code layout — `hearthrise/` (mirrors `hollowdeep/`)

| Path | Contents |
| --- | --- |
| `src/data/` | `types.ts`, `districts.ts`, `materials.ts`, `buildings.ts` (footprint, tags, adjacency rules, cost, output), `regalia.ts`, `recipes.ts`, `missions.ts`, `flags.ts`, `progression.ts` (all balance numbers), `validate.ts` |
| `src/game/` | `engine.ts` (newGame, tick), `clearing.ts` (tap/ruin HP/drops, the mining.ts analog), `grid.ts` (placement, footprint checks, adjacency scoring, happiness), `economy.ts`, `founder.ts` (the rpg.ts analog), `workshops.ts` (the crafting.ts analog), `missions.ts`, `story.ts`, `tide.ts` (prestige), `offline.ts`, `derive.ts`, `bot.ts`, `events.ts`, `rng.ts`, `features.ts` |
| `src/render/scene.ts` | Canvas: isometric-lite or top-down tile grid, ruins crumbling, buildings popping in, citizens walking, day/night tint, tide water |
| `src/audio/` | `index.ts` mixer, `sfx.ts` (taps, hammer, placement chime pitched by building value), `music.ts` (generative score per district: warm pentatonic camp → busier town → industrial ostinato → hollow Lydian/Locrian Spire) |
| `src/sprites/` | `defs.ts` hand-written pixel art, palette-swapped templates; `atlas.ts`, `hash.ts`; `scripts/bake-sprites.ts` → committed `atlas.png/json` + icons |
| `src/ui/` | `app.ts`, `panels.ts`, `dom.ts` (HTML strings patched in so buttons survive re-renders) |
| `src/state/` | `types.ts`, `persistence.ts` (save, migrate, export/import code) |
| `scripts/` | `bake-sprites.ts`, `validate-data.ts`, `playtest.ts`, `verify-ui.ts` |
| `tests/` | data, engine, grid/adjacency, workshops, missions, offline, tide, persistence, sprites (atlas not stale), bot |

**Reuse.** Projects stay independent, so these files are copied and then adapted, not imported: `hollowdeep/src/game/rng.ts`, `events.ts` and `features.ts`; `src/num/format.ts`; `src/ui/dom.ts`; the `src/state/persistence.ts` save/migrate/export pattern; `src/audio/index.ts`; the sprite pipeline (`src/sprites/atlas.ts`, `hash.ts`, `scripts/bake-sprites.ts`); `scripts/verify-ui.ts`; and `scripts/playtest.ts`. `package.json`, `vite.config.ts` (`base: './'`), `tsconfig.json`, `index.html`, `manifest.webmanifest`, the fonts and the dev deps also match Hollowdeep.

**Grid specifics (the only truly new system).** `GameState.districts[d].tiles` is a flat array of length 48. Each tile is `{ruin?: {hp,maxHp,kind}} | {building: uid, anchor: bool} | {}`. `grid.ts` exports `canPlace`, `place`, `demolish`, `adjacencyScore(district)` and `happiness(state)`. These are pure and memoised in `derive.ts`. Offline progress uses closed-form rates from `derive()` (as `hollowdeep/src/game/offline.ts` does), so the layout stays fixed while the player is away.

## Content targets (v1)
5 districts / about 40 wards. 24 salvage and material types, with 2 relics and a heart-relic per district. About 30 buildings (6 per district). 4 workshops. About 40 regalia pieces across 4 slots. 10 supplies. About 70 recipes. About 40 story missions. 12 passives and 10 Charter nodes.

## Build order (one commit each, like PR #73)
1. Content data, simulation, grid/adjacency, saves and the balance bot
2. Hand-written pixel sprites, baked into an atlas and app icons
3. Synthesised sound effects and a generative score
4. Canvas scene and the responsive portrait-first UI (placement flow included)
5. Tests, docs, and publishing to Pages. This adds an install/validate/test/build step block, a `_site/hearthrise` copy and an index card in `.github/workflows/pages.yml`, plus rows in the root `README.md` (the project table and the Pages table), a `hearthrise/README.md` in Hollowdeep's format, and `.github/workflows/pages.yml` path filter `hearthrise/**`.

Build it on a feature branch, then push and open a draft PR.

## Verification
- `npm run validate`: the content graph checks that every building, recipe, mission and material can be reached in time, and that every footprint fits a 6×8 grid.
- `npm test`: unit tests, plus a **bot** that plays 6 simulated hours. It taps 4 times a second, buys and places greedily (it picks the best adjacency tile), and never plans ahead. It must reach the Market Ward, finish 15 story missions, craft regalia, keep happiness ≥ 1.0, and take the Tide at least once.
- `npm run playtest -- 6`: prints the curve for tuning `progression.ts`.
- `npm run build`: the typecheck and the Vite build pass.
- `npm run verify` (with the preview server running, `CHROMIUM_PATH=/opt/pw-browsers/chromium`): screenshots of every tab at 390×844, 1024×768 and 1440×900, plus a scripted placement (select, ghost, confirm). It checks for no console errors and no horizontal scroll, and that the AudioContext is running.
