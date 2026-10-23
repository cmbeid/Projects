# Emberhold

An idle skilling and combat RPG for the phone, in the spirit of Melvor Idle. It's built for portrait Android browsers and scales up to tablets and desktops. Pick something to do and it carries on while you do something else, or while the game is closed, for up to 24 hours.

All names, numbers and pixel art are original. Nothing is taken from Melvor Idle.

## What's in it

- **Thirty skills.** There are eight combat skills: Attack, Strength, Defence, Hitpoints, Ranged, Magic, Prayer and Slayer. There are twenty-two others: Woodcutting, Fishing, Mining, Firemaking, Cooking, Smithing, Fletching, Crafting, Runecrafting, Herblore, Thieving, Farming, Agility, Summoning, Astrology, Cartography, Archaeology, Construction, Enchantment, Ranching, Hunting and Beastcrafting. Every skill goes to 99 and has a skillcape. There is also a cape for having every skill at 99.
- **Combat.** Fights run on swing timers, with a melee, ranged and magic triangle. Ten damage types are in play: stab, slash, crush, pierce, the four elements, pure and void. Every monster resists some types and is weak to others, so the best weapon depends on what you're fighting. You can also forge elemental versions of weapons in Enchantment.
  - Food and three tiers of auto-eat.
  - 25 prayers fuelled by burying bones, 22 spells and 4 auroras.
  - Slayer tasks in four tiers, slayer coins, a slayer shop, and four slayer areas that need a particular item worn.
  - Seven dungeons with bosses and pets.
  - A stronghold whose soldiers deal pure damage, which armour doesn't reduce.
  - The Rift, an endgame realm unlocked by a quest. Its void damage is stopped only by void resistance.
- **60 monsters** in eight open areas, plus the slayer areas, dungeons, the stronghold and the Rift.
- **Mastery guilds.** Each non-combat skill has its own guild and combat shares the Warriors' Guild, 23 in all. Each has set tasks, and reputation from tasks and training raises the guild through ten ranks of bonuses.
- **Special skills.**
  - Farming has plots that grow in real time, compost, and herb and tree patches.
  - Agility has a ten-slot obstacle course plus a pillar. Each obstacle gives its bonus as long as it stands, and some have trade-offs.
  - Astrology has ten constellations. You spend stardust and golden stardust on their stars.
  - Cartography has a 61-hex survey map with landmarks. Those landmarks unlock Archaeology's dig sites.
  - Archaeology fills a museum. Completing a site's display gives a lasting bonus.
  - Construction builds a settlement in the second game's style, with settlers, jobs and buildings that produce while you're away.
  - Ranching has pens of animals that produce passively and eat feed.
  - Summoning has twelve familiars and seven synergies between pairs.
  - Firemaking has bonfires.
- **Meta.**
  - 16 quests, some of which unlock content.
  - 32 pets.
  - A shop with upgrades, supplies, gear, slayer and Gauntlet tabs, and capes.
  - A bank with tabs, search, sort, slot locking and a slot limit you can raise.
  - Loot left behind after a fight, or a satchel to collect it for you.
  - Equipment loadouts, potions and chests.
  - A completion log, statistics and a message log.
- **The Gauntlet.** A wave raid that ignores your gear. It hands you a kit for your style and offers a choice of boons after every wave. It pays Gauntlet coins, which buy things in its own shop.
- **Game modes.**
  - Standard: dying costs one piece of gear.
  - Hardcore: one life.
  - Adventure: every non-combat skill must be bought, each costing more than the last.
  - Ancient Relics: skills start capped at level 10. Uncovering a skill's five relics raises its cap and grants bonuses.
- **Offline progress** of up to 24 hours, replayed through the same engine and shown in a report. Returning to the tab after more than a minute does the same.
- **Saves** go to local storage every 10 seconds and when you leave the page. An export code moves a save between devices.
- **Installable** when served over HTTPS. A service worker caches the game for offline play.

## Melvor Idle 1 and 2: what was researched and decided

The brief was every feature from both games, and where the two conflict, the second game's version. Melvor Idle 2 was in alpha when this was written: its combat update came in June 2026 and a public demo in October 2026. Most of what is known comes from the developers' progress posts and the Steam page.

| Area | Melvor Idle 1 | Melvor Idle 2 | Emberhold |
| --- | --- | --- | --- |
| Mastery | XP per item into a pool, with checkpoint bonuses | **Mastery Guilds**: set tasks for each skill that raise a guild rank, including a guild for combat | **Guilds** (MI2). Per-item mastery and pools are gone. |
| Combat balance | One best weapon at each tier | Build variety. The developers wanted to move away from "one weapon is best in slot". | Damage types and monster resistances (MI2). |
| Township | A separate settlement skill | Construction is reworked | Construction **is** the settlement (MI2). Township is not a separate skill. |
| New skills | — | Ranching, Hunting, Beastcrafting | All three are in. |
| Alt. Magic and item upgrades | Alt. Magic spells; upgrading items | Enchantment | Enchantment (MI2) imbues jewelry with skill bonuses and weapons with elements. |
| Quests | None | Quests | 16 quests. |
| Bank | Bank, plus equipment as its own thing | Bank and inventory merged | One bank, equipment taken from it. |
| Look | Desktop-style panels | A new look and feel | Mobile-first cards, a skill drawer and a bottom nav. |

Everything else from the first game that doesn't conflict is kept: the combat triangle, slayer, dungeons, strongholds, the Abyss (here, the Rift), prayer, auroras, summoning synergies, astrology, cartography with dig sites, archaeology with a museum, agility pillars, pets, the loot pile, auto-eat, loadouts, the Golbin Raid (here, the Gauntlet), and the Hardcore, Adventure and Ancient Relics modes.

## Running it

All commands run from this directory (`emberhold/`).

```bash
npm install
npm run dev          # dev server
npm run build        # typecheck + production build into dist/
npm run preview      # serve the build at http://localhost:4173/
npm test             # engine, content and balance tests
npm run validate     # content gate: every reference resolves, every input can be got
npm run playtest     # a bot plays 8 hours and prints where it got
npm run verify       # browser screenshots at phone size (needs `npm run preview` running)
```

`npm run verify` uses Playwright's own browser. Set `CHROMIUM_PATH` to use one already on the machine.

## How it's put together

- `src/data/` is content and nothing else. Most of it is generated from ladders in `tiers.ts` (metals, woods, fish, gems, runes, herbs, crops, hides, robes), so a new tier is one row. Monsters are made from a combat level and an archetype. `validate.ts` is the content gate: it checks that every recipe input has a source.
- `src/game/` holds the rules.
  - `engine.ts` advances the clock by any amount: one frame in the browser, or a day offline.
  - `skilling.ts` runs every action-list skill.
  - `combat.ts` jumps from one swing to the next, so offline combat costs as much as its swings, not its ticks.
  - `systems.ts` covers farming, agility, the map, stars, the settlement, the ranch, the museum, shops, quests and guild tasks.
  - `modifiers.ts` sums every bonus source into one cached table.
  - `bot.ts` is the balance-check player.
- `src/ui/` renders views as HTML strings that are morphed into the live DOM four times a second, so a button under your finger stays the same node. Progress bars move every frame.
- `src/sprites/defs.ts` holds every sprite as pixel art written out in text. Templates are painted in each tier's shades. `npm run bake` turns them into `atlas.png` and `atlas.json`, and the app icons. The tests fail if the atlas is stale.
