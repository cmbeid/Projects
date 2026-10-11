# Voidwake

An RPG space exploration survival game for the phone. It's built for portrait and scales up to tablets and desktops.

The colony ark *Meridian* tore apart in a failed jump. Its sections and twelve thousand sleepers are scattered across six sectors. You wake aboard the *Wren*, a battered survey scout, with two crew. Find the ark's pieces, keep your people fed and breathing, and bring the Wake home to Haven. Something followed the ark out of the jump.

- **Star map.** Each sector is a seeded map of 16–20 stars, from the jump point at the bottom to the gate at the top. Every jump costs fuel and a day. The Sensor Array sets how far ahead you can see.
- **Survival.** The crew eat every day, life support draws power, and the hull takes the knocks. Running out hurts rather than ending the run: starvation and blackouts wound the crew, and an empty tank means a distress call.
- **Events.** 70 encounters at derelicts, asteroid fields, nebulae, anomalies, distress calls and patrols. Choices run stat checks against your best crew member, and the odds are shown before you commit.
- **Landings.** Land a crew member on any of nine biomes for a real-time away mission, played with a thumb stick. Mine deposits, rescue sleepers from cryo pods, read terminals and fight or dodge the fauna. Get back to the lander before your air runs out. Hazard ground eats suit shielding, and lava eats everything.
- **Ship combat.** Turn-based. Choose which enemy subsystem to target and what the crew does each turn: brace, evade, patch systems, find a weak point, board, triage or charge the jump drive. Lasers, missiles and ion cannons each behave differently. There is a boss in every sector.
- **RPG.** You create a captain with one of four origins. Crew come in five classes, with four stats, traits, levels up to 15, an eight-skill tree per class and four gear slots. There are 40 pieces of gear with rarities and rolled affixes.
- **Ship and crafting.** 15 ship modules, each upgradeable Mk I–IV, and a fabricator with 54 recipes for refining, supplies and gear.
- **Story.** A 36-mission campaign with six missions a sector, three factions with reputation, station jobs, 30 lore logs, a codex and three endings.
- **One persistent campaign.** There is no permadeath. Docking at a station writes a checkpoint. If the hull is destroyed or the whole crew goes down, the signal is lost and you resume from the last dock.

## Running it

All commands run from this directory (`voidwake/`).

```bash
npm install
npm run dev          # dev server
npm run build        # typecheck + production build into dist/
npm run preview      # serve the build at http://localhost:4173/
```

## Controls

Tap a linked star on the map to select it, then tap it again (or press **Jump**) to go there. On landings, the left thumb drags a floating stick. The large button acts: it gathers, opens or rescues whatever is in reach, and otherwise shoots the nearest creature. The smaller button is the explorer's class skill. **Lift off** appears when you're standing by the lander.

On a keyboard during landings: WASD or the arrows move, Space acts, E uses the skill, Q uses an air canister, R uses a medkit, and Enter lifts off.

## Art and sound: all made in code

There are no image or audio files to fetch.

- **Sprites** are drawn in [`src/sprites/defs.ts`](src/sprites/defs.ts). Ships and creatures are grown from mirrored random masks with fixed seeds. Tiles are noise in each biome's palette, and the icons are character-grid drawings. `npm run bake` packs them into `src/sprites/atlas.png` and `atlas.json`, both committed, and writes the app icons. A test fails if the atlas goes stale. Crew faces are assembled at runtime from six part indices.
- **Sound effects** in [`src/audio/sfx.ts`](src/audio/sfx.ts) are synthesised with Web Audio.
- **Music** in [`src/audio/music.ts`](src/audio/music.ts) is a generative score: a drone on the sector's root note, pad chords from its mode, and sparse bells. A fight adds a pulsing bass and hats. A landing muffles everything, as if heard through a helmet.

## Checks

```bash
npm run validate        # content graph: every reference resolves, every flag can be set, no event can trap you
npm test                # unit tests, plus a bot that plays the whole campaign on three seeds
npm run playtest -- 200 # print the bot's run, for tuning src/data/progression.ts
npm run verify          # screenshots at phone, short phone, tablet and desktop sizes, plus an audio check
```

The bot ([`src/game/bot.ts`](src/game/bot.ts)) plays like a player who never plans more than one jump ahead:

- It follows the story marker and refuels and repairs at stations.
- It lands on every planet it passes and takes the first sensible event choice.
- It crafts what it's short of and buys upgrades in a fixed order.
- It goes back to farming for a while after losing to a boss.

On each of three seeds it has to reach the third sector by day 80, recover all six ark sections, rescue at least 70 colonists and see an ending. A balance change that walls the campaign fails `npm test`.

`npm run verify` needs the preview server running. Set `CHROMIUM_PATH` to use a browser that is already installed.

## Layout of the code

| Path | What it holds |
| --- | --- |
| `src/data/` | Content as plain typed data: sectors, story, events, crew, skills, gear, modules, recipes, biomes, fauna, enemies, jobs, lore. The balance numbers live in `progression.ts`, and `validate.ts` is the content gate. |
| `src/game/` | The simulation: galaxy, survival, events, stations, combat, crafting, crew, story and checkpoints. Pure functions over `GameState` with seeded RNG and no DOM. `away/` holds the landing generator, the fixed-step sim and the bot's thumb. |
| `src/render/` | Canvas drawing for the star map, the fight and the landing. It only reads state. |
| `src/audio/` | The mixer, effects and score. |
| `src/ui/` | The app shell, panels and modals, written as HTML strings and patched into the page so buttons survive re-renders, plus the touch controls. |
| `src/state/` | Save, load, defaults for old saves, and export or import as a code. |

See [`PLAN.md`](PLAN.md) for the design.
