# PokéHarvest

A Pokémon farming game for the phone. It's built for portrait and scales up to tablets and desktop monitors. Pick a starter, then till, plant, water and harvest berries on a walkable farm. Sell them through the shipping bin or the Poké Mart, and sleep before 2 AM.

This is an early build of the core farming loop (Phase 1 in [`PLAN.md`](PLAN.md)). Battles, ranching, crafting, skills and more seasons come in later phases.

## Playing

- **Tap a tile** to walk there and use what's in your hand on it. Tap the bin, the farmhouse door or the Mart stall to use them.
- **Hotbar:**
  - The **hoe** tills grass.
  - **Seeds** plant on tilled soil.
  - The **can** waters crops; refill it at the pond.
  - The **sickle** clears plants and plots.
  - Tapping a ripe berry picks it, whatever you're holding.
- **Growth:** crops grow one day for each night they spend watered.
  - The shipping bin pays full price overnight.
  - The Mart buys produce on the spot for 60% and sells seeds.
- **Helpers:** your starter works the farm.
  - Squirtle waters a thirsty crop every half hour.
  - Bulbasaur tends watered crops so they grow 50% faster.
  - Charmander keeps crows away from your field at night.
- **Energy:** tool work costs energy. Sleep to restore it. If you're still up at 2 AM you pass out and lose 10% of your gold.
- **Keyboard:** WASD or the arrow keys to walk, Space or E to use the tile you're facing, 1–8 to pick a hotbar slot, Esc to close menus.

The farm saves when you sleep, every in-game hour, and when the tab is hidden.

## Scripts

```bash
npm install
npm run dev           # play locally
npm test              # rules, save, assets, and a bot playing a week with each starter
npm run build         # typecheck + production build into dist/
npm run fetch-assets  # re-download sprites, cries and item icons from PokeAPI
npm run preview       # then, in another shell:
CHROMIUM_PATH=/opt/pw-browsers/chromium npm run verify   # phone, tablet and desktop screenshots + checks
```

## How it's built

It uses the same stack as [`pokedefense/`](../pokedefense/): Vite, TypeScript and Vitest, with no runtime dependencies.

- `src/game/`: the simulation, pure TypeScript with no DOM.
  - `world.ts` holds the commands and the fixed-step `tick`.
  - `farm.ts` covers tools and overnight growth.
  - `helpers.ts` is the Pokémon AI.
  - `economy.ts`, `time.ts` and `path.ts` (A*) cover the rest.
  - The UI changes the world only through commands, and reads back `world.events`.
- `src/render/`: Canvas 2D.
  - Tiles, the farmhouse, crops and the farmer are drawn in code (`tiles.ts`, `farmer.ts`).
  - Pokémon come from animated sprite sheets (`sprites.ts`).
  - `camera.ts` picks a whole-number tile scale that fits at least 11 × 14 tiles.
  - `light.ts` tints for the time of day and adds lamplight at night.
- `src/ui/`: the DOM HUD, hotbar and menus. Menus slide up as bottom sheets on a phone and dock to the side on wide screens.
- `src/state/save.ts`: `localStorage`. Loading is forgiving: every field is validated and repaired.
- `scripts/fetch-assets.ts`: adapted from PokéDefense's. It downloads Black/White animated sprites and cries from PokeAPI's GitHub repos and commits them under `public/`.

Pokémon, its sprites and its cries are © Nintendo / Creatures / GAME FREAK. This is a personal, non-commercial fan project.
