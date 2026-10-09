# Epochs

An incremental city game for the phone. It's built for portrait and scales up to tablets and desktops. A handful of people light a fire on a riverbank and decide to stay. Grow their city through eight ages, from the Stone Age to the Space Age, then build a colony ship and start again on a new world.

There is no tapping to earn and no tile puzzle: you decide who works where, what to build on the little land you have, what to learn next, and what the city does when something happens to it.

- **People and jobs.** Citizens are born while there is food and room to house them. Put them to work: twelve jobs from forager and farmer to coder and fabricator, each needing slots in the right building. Foragers need no building and are the pool everyone else is drawn from. The Census lets new citizens find work themselves, with a priority list of jobs to fill first.
- **Buildings across the ages.** There are 14 lines of buildings (homes, farms, lumber, quarries, mines, storage, learning, culture, trade, industry, power, oil, computing and fabrication), and each has a style for every era it is built in: 81 buildings, from a hide tent to an arcology spire. Whatever you build is in the style of the current age. What is already standing stays as it was until you **modernize** it in place, and a newer building houses more people, holds more workers and makes them more productive.
- **Land.** Every building takes one plot, and the city has only so much land. More comes with each age, with some techs and wonders, and with density: a tenement on the plot where a hut stood. Tap a building on the skyline to rebuild it or pull it down.
- **Stability.** Temples, theatres and stadiums, artists, techs and wonders hold the city together; size and idle hands pull it apart. Output scales with it. Spend culture on a festival for +50% to every job, twice as long when the city is at 120% or more.
- **Research.** Ten techs an age, 80 in all, each with its own small tree. They add land, boost jobs, unlock buildings and turn on systems: the Chronicle, festivals, wonders, auto-assign, the research queue and modernizing a whole line at once.
- **Wonders.** Fifteen great works, one an age required and a few optional, built in stages over time: the Standing Stones, the Great Ziggurat, the Colossus, a Gothic cathedral, a crystal exhibition hall, a sky tower, a space elevator. Each stands for good on the far bank behind the city.
- **Ages.** Each age has goals (people, techs, a building line, stability or a stockpile, and its wonder) and a price to enter the next. The calendar runs from 10,000 BCE to 2200 CE, and the skyline, the citizens' clothes, the colours and the music all change with the age.
- **The Chronicle.** Every few minutes something happens: a comet, a plague, a gold rush, a philosopher asking awkward questions, a signal from the stars. Each has two answers, and each answer says what it will do. Leave one too long and the city decides for itself. Everything goes in the city's history book. There are 45 events, sized to the city's own output so they matter in every age.
- **The colony ship.** This is the prestige layer. Finish the five-stage Colony Ship and choose one of three worlds, each with one or two traits (fertile, barren, ocean world, low gravity, twin suns, a storm belt…). Everything stays behind except **Heritage**, which buys a 12-node tree of traditions that last for every world after.
- **Time away** counts for up to 8 hours (more with Heritage). The city works and grows while you are gone, but nothing happens to it that you did not get to decide.

## Running it

All commands run from this directory (`epochs/`).

```bash
npm install
npm run dev          # dev server
npm run build        # typecheck + production build into dist/
npm run preview      # serve the build at http://localhost:4173/
```

## Controls

Tap the buttons. On the skyline, drag (or scroll) to look along the city and tap a building to pick it. On a desktop, 1–7 switch tabs, Esc lets go of a picked building and F switches to full screen wherever the browser supports it.

## Art and sound: all made in code

There are no image or audio files to fetch.

- **Sprites.** [`src/sprites/defs.ts`](src/sprites/defs.ts) draws every sprite as pixel art in code, on a tiny raster with hard one-pixel edges ([`src/sprites/px.ts`](src/sprites/px.ts)). Each era has a style (materials, roofs, windows, trim) and each building line a silhouette that carries across the ages, so a farm still reads as a farm when it becomes a hydroponic tower. Wonders, citizens in the clothes of every age, and the icons are drawn the same way. `npm run bake` packs them into `src/sprites/atlas.png` and `atlas.json`, both committed, and writes the app icons; a test fails if the atlas goes stale. `npm run sheet -- out.png` draws every building by line and era on one sheet, for looking at.
- **Sound effects.** [`src/audio/sfx.ts`](src/audio/sfx.ts) synthesises every effect with Web Audio: wooden knocks for building, a bright run for a new tech, a slow fanfare for a new age, a roar for the launch.
- **Music.** [`src/audio/song.ts`](src/audio/song.ts) composes each age's tune a bar at a time, A A′ B A′ over eight bars, and [`src/audio/music.ts`](src/audio/music.ts) plays it. What changes most from age to age is who plays: a bone flute over a drone and log drums by the fire; a reed and a lyre over a frame drum in seven for the Bronze Age; aulos and lyre in three; plainchant over a drone; harpsichord counterpoint and a walking bass; a clanking ostinato in harmonic minor; synth pop with four on the floor; and slow pads for space. Each age plays in its own room, from a big stone hall to bone dry. At night the drums drop out.

## Checks

```bash
npm run validate     # content graph: every price payable in time, every requirement real
npm test             # unit tests, plus a bot that plays eight hours and must hit the milestones
npm run playtest -- 8   # print the bot's progress, for tuning src/data/progression.ts
npm run verify       # screenshots of every tab at phone, tablet and desktop sizes, the main verbs played through, and an audio check
```

The bot ([`src/game/bot.ts`](src/game/bot.ts)) plays like a player who never plans ahead: once a second it answers the Chronicle, researches the cheapest tech, starts wonder stages, modernizes and builds whatever is most obviously short. In eight simulated hours it has to reach the Industrial Age by hour six, launch the colony ship and keep the city stable. A balance change that walls an age fails `npm test`.

`npm run verify` needs the preview server running. Set `CHROMIUM_PATH` to use a browser that is already installed.

## Layout of the code

| Path | What it holds |
| --- | --- |
| `src/data/` | Content, as plain typed data: eras, resources and jobs, building lines, techs, wonders, Chronicle events, Heritage and world traits, and the balance numbers in `progression.ts`. |
| `src/game/` | The simulation: `derive.ts` works out every number from the state in one pass; the city, research, wonders, eras, the Chronicle, the colony ship and time away. Pure functions over `GameState`, seeded RNG, and no DOM. |
| `src/render/` | The skyline scene. It reads the state and listens to game events. |
| `src/audio/` | The mixer, effects and score. |
| `src/ui/` | The panels, written as HTML strings and patched into the page so that buttons survive re-renders. |
| `src/state/` | Save, load, defaults for older saves, and export or import as a code. |

[`PLAN.md`](PLAN.md) is the plan the game was built from.
