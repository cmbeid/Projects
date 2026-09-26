# PokéFling

A slingshot physics game for the phone, in the style of Angry Birds: pull
Pokémon back in a sling and fling them at Team Rocket's towers of wood, ice and
stone until every Meowth, Ekans, Koffing and Grimer is knocked out.

Twelve levels across three worlds — Viridian Forest, Mt. Moon and the Rocket
Hideout — with stars for clearing each one efficiently.

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

| Pokémon | Move |
| --- | --- |
| Pikachu | — (a plain, dependable shot) |
| Jolteon | **Quick Attack** — a burst of speed in the direction it is flying |
| Staryu | **Swift** — splits into three |
| Snorlax | **Body Slam** — heavy anyway, and drops straight down |
| Voltorb | **Self-Destruct** — explodes; goes off on its own shortly after landing |

Knocked-out targets and broken blocks score points; every Pokémon left unused
when the last target falls is worth 10,000 more. One star for clearing a level,
two or three for doing it in fewer shots and with more wreckage.

## How it is built

TypeScript, Vite, [Matter.js](https://brm.io/matter-js/) for the physics and a
plain 2D canvas for drawing. No framework.

| Path | What it holds |
| --- | --- |
| `src/game/` | The simulation: `game.ts` runs one attempt at one level and has no DOM, so all of it runs under Vitest. Damage, scoring and sling maths are small pure modules beside it. |
| `src/data/` | The roster, materials and the twelve levels. Levels are built from structural helpers (`frame`, `tower`, `hill`) rather than raw coordinates. |
| `src/render/` | Camera, canvas drawing, particles and sprite loading. Reads the game; never changes it. |
| `src/ui/` | The in-level screen (input and HUD) and the menus. |
| `src/state/save.ts` | Best score and stars per level, in `localStorage`. |

Physics runs at a fixed 120 Hz, two steps per frame, so fast shots do not pass
through thin planks. Damage is proportional to how sharply a body's own
velocity changes in a collision, so a light Pokémon barely dents stone but a
falling stone block flattens a Meowth.

## Checks

```bash
npm test             # unit tests, including: every level stands still before the first shot
npm run typecheck
npm run playtest     # a greedy bot plays every level headlessly (~90 s)
npm run verify       # drives the built game in Chromium, writes screenshots/
```

`playtest` tries a grid of angles, powers and ability timings for each shot and
keeps the best, so it answers "is every level winnable with the Pokémon it
gives you?" — run it after changing a level or the physics. It is not in CI
because it is slow.

`verify` needs `npm run preview` running. Where the Chromium Playwright pins is
not installed, point `CHROMIUM_PATH` at one that is.

## Art and sound

Pokémon artwork is the official artwork from
[PokeAPI's sprites repository](https://github.com/PokeAPI/sprites), and each
Pokémon's cry — played when it is flung, and lower and slower when a target
faints — is its latest cry from [PokeAPI's cries repository](https://github.com/PokeAPI/cries).
Both are committed, under `public/sprites/` and `public/cries/`.

`npm run fetch-assets` downloads them again from the roster in
`src/data/roster.ts` — run it after adding a Pokémon. PokeAPI serves the cries
as `.ogg`, which older iOS Safari cannot play (and some, like Pikachu's, are
really MP3s under that name), so the script decodes each one by its actual
format and rewrites it as a small mono WAV.

Pokémon, its artwork and its cries are © Nintendo / Creatures / GAME FREAK;
they are used here for a personal, non-commercial project.

Everything else — blocks, scenery, particles and the other sound effects — is
drawn or synthesised in code.
