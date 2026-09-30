# PokéHarvest

A Pokémon farming game for the phone. It's built for portrait and scales up to tablets and desktop monitors. Pick a starter, then till, plant, water and harvest berries on a walkable farm. Sell them through the shipping bin or the Poké Mart, and sleep before 2 AM.

It has the core farming loop (Phase 1 in [`PLAN.md`](PLAN.md)) plus RPG progression and battles (Phase 2). Ranching, crafting, a deeper economy and more seasons come in later phases.

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
- **Route 1:** walk out of the farm gate to reach it.
  - Wild Pokémon hide in the tall grass, with stronger ones past the tree line and different ones at night.
  - Battles are turn-based: Fight, Bag, Pokémon or Run.
  - Weaken a wild Pokémon, offer it berries to calm it, then throw a Poké Ball to befriend it.
  - Up to three Pokémon follow you, fight and work the farm; the rest wait in the box.
- **Pokémon:** they gain XP, learn moves as they level and evolve.
  - Their farm job comes from their type. Normal, Fighting, Ground and Rock types pick ripe crops into the shipping bin, and Flying types scare crows like Fire types do.
  - Oran and Sitrus Berries heal them, in battle or from the Bag.
- **Blacksmith:** the stall next to the Mart upgrades the hoe and the can. Copper works three tiles in a row, Steel a 3×3 square and Gold does that for less energy. Upgrades cost gold plus the Hard Stones, Metal Coats and Nuggets that wild Pokémon drop.
- **Skills:** Farming and Battling level up with use. Each Farming level adds 3 max energy, and levels 5 and 10 offer a choice of two perks.
- **Energy:** tool work costs energy. Sleep to restore it. If you're still up at 2 AM you pass out and lose 10% of your gold.
- **Keyboard:** WASD or the arrow keys to walk, Space or E to use the tile you're facing, 1–8 to pick a hotbar slot, B for the bag, Esc to close menus.

The farm saves when you sleep, every in-game hour, and when the tab is hidden.

## Scripts

```bash
npm install
npm run dev           # play locally
npm test              # rules, battles, save, assets, and a bot playing a week with each starter
npm run build         # typecheck + production build into dist/
npm run fetch-assets  # re-download sprites, cries and item icons from PokeAPI
npm run preview       # then, in another shell:
CHROMIUM_PATH=/opt/pw-browsers/chromium npm run verify   # phone, tablet and desktop screenshots + checks
```

## How it's built

It uses the same stack as [`pokedefense/`](../pokedefense/): Vite, TypeScript and Vitest, with no runtime dependencies.

- `src/game/`: the simulation, pure TypeScript with no DOM.
  - `world.ts` holds the commands and the fixed-step `tick`.
  - `farm.ts` covers tools, tool tiers and overnight growth.
  - `helpers.ts` is the Pokémon AI on the map.
  - `battle.ts` is the turn-based battle engine. Every command returns the events of a turn, and the battle screen plays them back.
  - `mon.ts` covers stats, XP, learning moves and evolving.
  - `skills.ts` covers farmer skills and perks.
  - `economy.ts`, `time.ts` and `path.ts` (A*) cover the rest.
  - The UI changes the world only through commands, and reads back `world.events`.
- `src/render/`: Canvas 2D.
  - Tiles, the farmhouse, crops and the farmer are drawn in code (`tiles.ts`, `farmer.ts`).
  - Pokémon come from animated sprite sheets (`sprites.ts`).
  - `camera.ts` picks a whole-number tile scale that fits at least 11 × 14 tiles.
  - `light.ts` tints for the time of day and adds lamplight at night.
- `src/ui/`: the DOM HUD, hotbar and menus. Menus slide up as bottom sheets on a phone and dock to the side on wide screens.
- `src/state/save.ts`: `localStorage`. Loading is forgiving: every field is validated and repaired.
- `src/data/`: species with stats, catch rates and evolutions; moves and type-based learnsets; the maps; Route 1's encounter tables; tool tiers, skills and perks.
- `scripts/fetch-assets.ts`: adapted from PokéDefense's. It downloads Black/White animated sprites (front, shiny and back) and cries from PokeAPI's GitHub repos and commits them under `public/`.

Pokémon, its sprites and its cries are © Nintendo / Creatures / GAME FREAK. This is a personal, non-commercial fan project.
