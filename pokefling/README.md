# PokéFling

A slingshot physics game for the phone, in the style of Angry Birds: pull
Pokémon back in a sling and fling them at towers of wood, ice and stone until
every wild Pokémon sheltering in them is knocked out.

Sixty levels across ten real places from the games — through Kanto and Johto
to the Indigo Plateau — each with its own scenery, its own Game Boy music, the
wild Pokémon that live there, and a boss at the end.

## Running it

All commands run from this directory (`pokefling/`), not the repository root.

```bash
npm install
npm run dev          # dev server
```

```bash
npm run build
npm run preview      # the built game, at http://localhost:4173/
```

## Playing

Best in landscape; portrait works too, with the camera panning further.

- **Drag back** from the Pokémon in the sling and **let go** to fire. The dotted
  arc shows where it will go.
- **Tap anywhere** while it flies to use its move, if it has one.
- **Drag** empty space to look around; **pinch** to zoom.
- **The bag** (the Poké Ball by the pause button) holds items, used while aiming.
- **Settings** (⚙️ on the title screen, or in the pause menu) has separate
  volumes for music, Pokémon cries and sound effects.
- **Full screen** (the corners button on the title screen and by the score)
  hides the browser's bars. It is left out where the browser does not
  allow it — iPhone Safari only lets videos go full screen; there, *Add to
  Home Screen* is the way to lose the address bar.

| Pokémon | Move |
| --- | --- |
| Pikachu | — (a plain, dependable shot) |
| Jolteon | **Quick Attack** — a burst of speed in the direction it is flying |
| Staryu | **Swift** — splits into three |
| Snorlax | **Body Slam** — heavy anyway, and drops straight down |
| Gengar | **Phantom Force** — passes through blocks until you tap, then bursts out |
| Voltorb | **Self-Destruct** — explodes; goes off on its own shortly after landing |
| Pidgeot | **Gust** — whips round and flies back, for targets hiding behind walls |

| Area | Region | Where the difficulty comes from | Boss |
| --- | --- | --- | --- |
| Viridian Forest | Kanto | Wooden forts, Pidgey overhead | Beedrill |
| Mt. Moon | Kanto | A low cave roof — no lobbing — and loose boulders | Clefable |
| Pokémon Tower | Kanto | Tall stacks, gravestones, ghosts drifting high | Marowak |
| Rocket Hideout | Kanto | Explosive crates stored beside everything | Persian |
| Sprout Tower | Johto | Targets tucked in behind tall walls | Victreebel |
| Union Cave | Johto | Rock ledges at every height under a roof | Onix |
| Burned Tower | Johto | Collapsed floors and pits between ledges | Magmar |
| Lake of Rage | Johto | Islands in deep water — anything knocked in is gone | Red Gyarados |
| Team Rocket HQ | Johto | Walled bunkers, crates and guard dogs | Houndoom |
| Indigo Plateau | Pokémon League | Victory Road, the Elite Four, all of the above | Dragonite |

Knocked-out targets and broken blocks score points; every Pokémon left unused
when the last target falls is worth 10,000 more. One star for clearing a level;
two for doing it with a Pokémon to spare and a quarter of the structure
broken; three for clearing it in par and breaking half.

### Items

| Item | Does |
| --- | --- |
| X Attack | The next Pokémon hits twice as hard |
| X Speed | The next launch is 25% faster, so it flies farther |
| Scope Lens | Shows the whole flight path for the rest of the level |
| Max Revive | The last Pokémon you sent out gets another go |
| TM Earthquake | Shakes every block and target loose |

Each works once per level. You start with one of each, get one for clearing a
level for the first time (two for a boss), and can find more: about a third of
the levels hide a Poké Ball somewhere awkward, and knocking anything into it
collects what is inside — even if you then lose.

## How it is built

TypeScript, Vite, [Matter.js](https://brm.io/matter-js/) for the physics, a
plain 2D canvas for drawing and Web Audio for sound. No framework.

| Path | What it holds |
| --- | --- |
| `src/game/` | The simulation: `game.ts` runs one attempt at one level — including items, water, ceilings and explosions — and has no DOM, so all of it runs under Vitest. Damage, scoring and sling maths are small pure modules beside it. |
| `src/data/` | The roster and items, materials, the ten areas, music choices, and the levels — one file per area under `levels/`, built from structural helpers (`frame`, `tower`, `bunker`, `pyramid`, `ledge`, `water`, `ceiling`) rather than raw coordinates. |
| `src/render/` | Camera, canvas drawing, each area's scenery, particles and sprite loading. Reads the game; never changes it. |
| `src/audio/` | The mixer (music, cries, effects, mute), synthesised effects, and the Game Boy music player. |
| `src/ui/` | The in-level screen (input, HUD, bag) and the menus. |
| `src/state/save.ts` | Best score and stars per level, the bag, hidden items found, and sound settings, in `localStorage`. |

Physics runs at a fixed 120 Hz, two steps per frame, so fast shots do not pass
through thin planks. Damage is proportional to how sharply a body's own
velocity changes in a collision, so a light Pokémon barely dents stone but a
falling stone block flattens a Meowth.

A level's sprites and cries are fetched when it is first opened, not all at
once at start-up.

## Checks

```bash
npm test             # unit tests, including: every level stands still before the first shot
npm run typecheck
npm run playtest     # a bot plays every level headlessly, on every core (~3 min)
npm run verify       # drives the built game in Chromium, checks sound, writes screenshots/
```

`playtest` tries a grid of angles, powers and ability timings for each shot,
refines around the best few, and keeps whichever knocks out most (then wears
down most, then scores most). It aims perfectly, so it sets a floor rather than
measuring difficulty: each level's `par` is the number of shots the bot needed,
and it gets two more Pokémon than that in the first three areas and one more
after (at least three, and one extra for a boss). `npm run playtest -- mt-moon`
plays one area; run it after changing a level or the physics. It is not in CI
because it is slow.

`verify` needs `npm run preview` running. Where the Chromium Playwright pins is
not installed, point `CHROMIUM_PATH` at one that is.

## Art and sound

Pokémon artwork is the official artwork from
[PokeAPI's sprites repository](https://github.com/PokeAPI/sprites), shrunk to
192 px; item icons come from the same place. Each Pokémon's cry — played when
it is flung, and lower and slower when a target faints — is its latest cry
from [PokeAPI's cries repository](https://github.com/PokeAPI/cries). All of it
is committed, under `public/sprites/`, `public/items/` and `public/cries/`.

`npm run fetch-assets` downloads them again from the roster in
`src/data/roster.ts` — run it after adding a Pokémon. PokeAPI serves the cries
as `.ogg`, which older iOS Safari cannot play (and some, like Pikachu's, are
really MP3s under that name), so the script decodes each one by its actual
format and rewrites it as a small mono WAV.

The music is Pokémon Crystal's own, from the
[pret/pokecrystal](https://github.com/pret/pokecrystal) disassembly.
`npm run fetch-music` downloads each track's source and runs it through
`scripts/music/parse.ts`, which plays the song the way the Game Boy's sound
engine does — frame by frame, all four channels, with the engine's own tempo
and pitch arithmetic — and writes the notes out as JSON under `public/music/`
(a few KB per track). In the browser, `src/audio/music.ts` voices them as the
hardware did: pulse waves at four duty cycles, the wave channel's 32-step
shapes, and LFSR noise for drums.

Pokémon, its artwork, its cries and its music are © Nintendo / Creatures /
GAME FREAK; they are used here for a personal, non-commercial project.

Everything else — blocks, scenery, particles and the other sound effects — is
drawn or synthesised in code.
