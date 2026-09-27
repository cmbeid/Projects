# PokéDefense

A Pokémon tower defense game for the phone, portrait-first, that also lays out
properly on tablets and desktops: when there's room beside the map, the map
takes the full height and the controls move into columns beside it. Place Pokémon beside the path, level them up
until they evolve, teach them signature moves, and catch the wild Pokémon
marching past, through nine places in Kanto to the Indigo Plateau, then on
into the endless Cerulean Cave.

## Running it

All commands run from this directory (`pokedefense/`).

```bash
npm install
npm run dev          # dev server
npm run build && npm run preview   # the built game, at http://localhost:4173/
```

## Playing

- **Place:** pick a Pokémon in the dock, then tap a tile. On a touch screen the
  first tap previews it (with its range), and a second tap on the same tile places it.
- **Upgrade:** tap a tower to level it up. At set levels it **evolves**
  (Charmander → Charmeleon → Charizard). At level 6 it learns one of two
  **signature moves** (Flamethrower's piercing beam or Fire Blast's huge
  splash, say). Eevee picks its evolution with a stone. Knockouts earn a tower
  XP, which takes up to half off its next level. Sell for 70% (100% before the
  next wave starts).
- **Target:** each tower can aim at the first, last, strongest or closest enemy.
- **Types matter:** the full modern type chart applies. Ground attacks can't
  reach flyers, Normal can't touch Ghosts, and only Psychic/Ghost/Porygon/Mew
  towers (or a Silph Scope) can see invisible Pokémon.
- **Catch:** tap the Poké Ball, then a wild Pokémon; the chance shows above
  each one. Weak, asleep or paralysed Pokémon are easier. Twelve tower lines
  can only be had by catching (Meowth, Clefairy, Gastly, Eevee, Magikarp,
  Lapras, Scyther, Dratini, Snorlax, Porygon, Mew…), and a new one joins your
  team mid-battle. Shinies turn up 1 in 128.
- **Power-ups:** Rare Candy, X Attack, X Speed, Max Repel, Poké Flute, Full
  Restore, TM Thunderbolt, TM Earthquake, Silph Scope, Amulet Coin. Fainted
  Pokémon sometimes drop items; tap them before they fade.
- **Gym Leaders:** bosses have far more HP than anything else, so they walk at half speed. A map ends with its leader's ace (the Indigo Plateau also has the Elite Four). If that Pokémon gets through, or your lives run out during its wave, the wave starts over with your towers, ₽, lives and items as they were when it began. You can rearrange first, and retry as often as it takes. Catches made during a failed attempt are kept.
- **Waves:** call the next wave early for bonus ₽. Speeds: pause, 1×, 2×, 3× and 5×; you can still place and upgrade towers while paused. Auto-waves are in the ☰ menu.
- **Keyboard:** 1–8 pick a tower, Space next wave, F speed, U level up, S sell,
  B ball, P pause, Esc cancel / menu.

Winning earns stars (by lives kept), a badge, and **BP** to spend in the
**Poké Mart**: power-ups, Poké/Great/Ultra/Master Balls, **held items** given
to a whole tower line (Charcoal, Scope Lens, Quick Claw, Wide Lens…), and
permanent **Trainer upgrades** (start ₽, lives, discounts, interest, catch rate…).
Clearing a map opens its Hard mode.

| Map | Twist | Boss |
| --- | --- | --- |
| Viridian Forest | Bugs that evolve if left alive | Brock's Onix |
| Mt. Moon | Zubat swarms, armoured Geodude | Misty's Starmie (Recover) |
| S.S. Anne | Two gangways; water only for swimmers | Lt. Surge's Raichu (stuns towers) |
| Celadon Gardens | Grass types; Exeggutor splits | Erika's Vileplume |
| Pokémon Tower | Invisible ghosts, a long spiral | Koga's Weezing (vanishes, summons) |
| Silph Co. | Teleport pads, teleporting Abra | Sabrina's Alakazam |
| Cinnabar Volcano | Two trails between lava; fast fire horses | Blaine's Arcanine |
| Viridian Gym | Armoured Ground types, a long maze | Giovanni's Rhydon |
| Indigo Plateau | Victory Road, the Elite Four, then the Champion | Blue's Charizard |
| Cerulean Cave | Endless | Mewtwo every 25th wave |

## How it is built

TypeScript, Vite, a 2D canvas and Web Audio. No framework.

| Path | What it holds |
| --- | --- |
| `src/game/` | The simulation — `game.ts` runs one battle at a fixed 60 Hz with no DOM, so it all runs under Vitest. Tower stats, paths, wave generation and a seeded RNG beside it, plus `bot.ts`, a greedy player used for balancing. |
| `src/data/` | Type chart, species (enemy stats, traits, abilities), the 24 tower lines, items, maps and music. |
| `src/render/` | Sprite sheets, procedurally drawn pixel-art tiles per theme, the battle renderer and its effects. |
| `src/audio/` | The mixer and synth effects, event → sound mapping, and the Game Boy music player. |
| `src/ui/` | Screens (title, Kanto map, team select, Mart, Pokédex, settings) and the battle screen. |
| `src/state/save.ts` | Progress in `localStorage`. |

Waves are generated per map from its pool of wild Pokémon — the same every
time, so a map can be learned — with HP in "Caterpie units" scaled by wave and map.

## Checks

```bash
npm test             # unit tests: type chart, maps, towers, battles, catching, save, assets
npm run typecheck
npm run playtest     # the bot plays every map on Normal and Hard (no catches, no items)
npm run verify       # drives the built game in Chromium at phone, tablet and desktop sizes
```

`verify` needs `npm run preview` running; set `CHROMIUM_PATH` if Playwright's
own Chromium isn't installed. The bot is a floor, not a measure: it clears
eight of the nine campaign maps on Normal without catching anything or using
a single item.

## Art and sound

Pokémon sprites are the animated Black/White sprites from
[PokeAPI's sprites repository](https://github.com/PokeAPI/sprites), with their
shinies; `npm run fetch-assets` decodes each GIF, trims it and packs it into a
palette PNG sheet with a JSON of frame timings (canvas can't step through GIF
frames). Item icons and badges come from the same place. Cries are from
[PokeAPI's cries repository](https://github.com/PokeAPI/cries), rewritten as
small mono WAVs that iOS can play.

Music is Pokémon Crystal's own Kanto arrangements, from the
[pret/pokecrystal](https://github.com/pret/pokecrystal) disassembly, played by
a Game Boy–style synth (`npm run fetch-music`; the converter and player come
from `pokefling/`).

Pokémon and all of the above are © Nintendo / Creatures / GAME FREAK, used
here for a personal, non-commercial project. The map tiles, effects and other
sounds are drawn or synthesised in code.
