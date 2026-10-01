# PokéHarvest

A Pokémon farming game for the phone. It's built for portrait and scales up to tablets and desktop monitors. Pick a starter, then till, plant, water and harvest berries on a walkable farm. Sell them through the shipping bin or the Poké Mart, and sleep before 2 AM.

It has the core farming loop (Phase 1 in [`PLAN.md`](PLAN.md)), RPG progression and battles (Phase 2), and ranching, crafting and a living economy (Phase 3). More seasons, weather and polish come in Phase 4.

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
- **Party, Farm or Box:** decide where each Pokémon lives from the Bag's Pokémon tab.
  - Party Pokémon (up to 3) follow you and battle.
  - Farm Pokémon live in the barn and work the farm all day, even while you're out on Route 1.
  - The barn starts as a Shed for 3; the carpenter builds bigger ones (6, 10, 15) once your reputation is high enough.
- **The barn:** farm Pokémon eat one berry each night from its trough. Fed ones work at full pace and grow fonder of you; hungry ones work at half pace.
  - Livestock make something every morning when fed: Miltank milk, Mareep and Wooloo wool, Combee honey, Chansey Lucky Eggs, Slowpoke tails. Fond ones make two.
  - Collect it at the barn, and buy livestock at its ranch counter.
  - Tap any Pokémon for a pat: a little friendship, once a day.
- **Machines:** craft them in the Bag's Craft tab, hold one and tap open grass to place it. Tap it to load it, and tap again when it's done. The sickle picks it back up.
  - Berry Press: berry juice in 6 hours.
  - Preserves Jar: jam overnight.
  - Cheese Press: Moomoo Cheese in 4 hours.
  - Loom: Silk Cloth overnight.
  - Electric Pokémon on the farm power them, so they run twice as fast.
- **Cooking:** dishes are cooked at home and eaten from the Bag. They restore energy, and some give a buff for the day: walking faster, more extra berries, more Pokémon XP, or cheaper tool work.
- **Market:** every berry and good has its own price each day, up to 15% either side of normal. Selling more than 15 of one thing in a day floods the market, and each extra one fetches less.
- **Request board:** by the house. Three orders at a time, each with a deadline. Fill one for a bonus over the market and some reputation.
- **Travelling merchant:** her cart by the gate opens on Saturdays and Sundays with Rare Candy, Metal Coats, Nuggets, cheap rare seeds and more.
- **Blacksmith:** the stall next to the Mart upgrades the hoe and the can. Copper works three tiles in a row, Steel a 3×3 square and Gold does that for less energy. Upgrades cost gold plus the Hard Stones, Metal Coats and Nuggets that wild Pokémon drop.
- **Skills:** Farming, Battling and Crafting level up with use. Each Farming level adds 3 max energy, and levels 5 and 10 offer a choice of two perks.
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
  - `barn.ts` covers roles, the trough, livestock produce, the ranch and the carpenter.
  - `machines.ts` and `craft.ts` cover machines, recipes, cooking and Rare Candy.
  - `market.ts` and `requests.ts` cover daily prices, flooding, the merchant and the request board.
  - `economy.ts`, `time.ts` and `path.ts` (A*) cover the rest.
  - The UI changes the world only through commands, and reads back `world.events`.
- `src/render/`: Canvas 2D.
  - Tiles, the farmhouse, crops and the farmer are drawn in code (`tiles.ts`, `farmer.ts`).
  - Pokémon come from animated sprite sheets (`sprites.ts`).
  - `camera.ts` picks a whole-number tile scale that fits at least 11 × 14 tiles.
  - `light.ts` tints for the time of day and adds lamplight at night.
- `src/ui/`: the DOM HUD, hotbar and menus. Menus slide up as bottom sheets on a phone and dock to the side on wide screens.
- `src/state/save.ts`: `localStorage`. Loading is forgiving: every field is validated and repaired.
- `src/data/`: species with stats, catch rates and evolutions; moves and type-based learnsets; the maps; Route 1's encounter tables; tool tiers, skills and perks; recipes and machines; livestock, barns, reputation and the merchant's wares.
- `scripts/fetch-assets.ts`: adapted from PokéDefense's. It downloads Black/White animated sprites (front, shiny and back) and cries from PokeAPI's GitHub repos and commits them under `public/`.

Pokémon, its sprites and its cries are © Nintendo / Creatures / GAME FREAK. This is a personal, non-commercial fan project.
