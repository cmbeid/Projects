# Voidwake — design

## Context

Voidwake joins the phone-first games in this repository (`epochs/`, `hollowdeep/`, `hearthrise/` and others), and follows their conventions: Vite and strict TypeScript, pixel art and sound made in code, a pure seeded simulation, and a balance bot run by `vitest`. The brief was an RPG space exploration survival game for portrait mobile web with a responsive UI. Three choices shaped it:

- **Hybrid play.** A turn-based star map, events and ship battles, plus short real-time away missions on planet surfaces.
- **One persistent campaign.** There is no permadeath; losing reloads the last station checkpoint.
- **A full first release** rather than a vertical slice.

This is the design as planned. Where the shipped numbers differ (54 recipes rather than ~60, 15 modules × 4 tiers), the README and `src/data/` are the source of truth.

---

## 1. Game design

### Premise
The colony ark *Meridian* tore apart during a failed jump. Its sections and 12,000 sleepers are scattered across six sectors. You wake from cryo aboard the *Wren*, a battered survey scout with two crew. Your job is to find the ark's pieces, keep your crew alive, and reach **Haven**, the world the ark was bound for. Something followed the ark out of the jump.

### Core loop
1. **Star map (turn-based).** Plot a jump to an adjacent node. Each jump costs **fuel** and advances the **day** clock. Every day, crew eat **food**, and **life support** draws **energy**.
2. **Arrive at a node.** Depending on the node type, you get an event card, a system view with planets to scan or land on, a station (trade, recruit, repair, quests), a hostile ship (combat), or a story beat.
3. **Away mission (real-time, 2–4 min).** Land a crew member on a planet. Gather materials, explore ruins, and fight or avoid fauna. Get back to the lander before the suit's O2 and hazard shielding run out.
4. **Back aboard.** Fabricate parts, gear and consumables. Grow food in hydroponics, refine ore into fuel, level up crew, and upgrade ship modules.
5. **Push deeper.** Each sector's ark section is a story node guarded by a boss encounter. Recovering it opens the jump gate to the next sector.

### Survival resources (HUD, always visible)
| Resource | Drained by | Restored by |
|---|---|---|
| Fuel | jumps, fleeing combat | stations, refining ice or gas, events |
| Food | crew per day | hydroponics, trade, foraging on away missions |
| Hull | combat, hazards (asteroid fields, solar flares) | repair at stations, Engineer repair using alloy |
| Energy | life support, shields, modules | reactor output per day, power cells |
| Credits | — | trade, bounties, salvage |

When a resource reaches zero, it hurts but does not end the game outright:
- **No food:** starvation damages crew health and morale.
- **No energy:** life support fails and every crew member takes damage each day.
- **No fuel:** you can drift one node and send a distress beacon, which triggers a random rescue or pirate event.
- **Hull 0, or the whole crew dead:** "Signal lost" and a reload from the last outpost checkpoint.

### Star map
- **Six sectors:**
  1. Shatterbelt (tutorial)
  2. Verdant Reach
  3. Ashen Expanse
  4. Drift Clans Hold
  5. Choir Nebula
  6. Haven Approach
- Each sector is a seeded graph of 16–20 nodes, laid out to fit a tall portrait canvas: the entry gate at the bottom, the exit gate at the top, and pinch-zoom/pan on top of that.
- **Node types:** star system (1–4 planets plus a belt), station, derelict, asteroid field, nebula (sensors blind, shields drain), anomaly, distress call, pirate patrol, story node, sector gate.
- **Fog of war:** the Sensors module sets how far ahead node types are revealed. Visited nodes stay revealed, and stations restock over time.

### Away missions (real-time)
- Procedural tile map, about 48×64 tiles, taller than wide to suit portrait. Generated from the planet's seed and biome.
- **Nine biomes, each with its own hazard and fauna set:**
  - rocky (none)
  - ice (cold)
  - jungle (spores)
  - desert (heat)
  - volcanic (heat and lava tiles)
  - toxic (toxin)
  - ocean (islands, deep water)
  - crystal (radiation, resonant crystals)
  - ark-wreck (sparking debris, security drones)
- **Controls:**
  - Phone: a floating virtual stick in the lower left, plus **Act** and **Skill** buttons in the lower right. Act gathers or interacts when something is in range, and otherwise fires at the nearest target (auto-aim).
  - Desktop: WASD or arrow keys, Space, and E.
- **Suit meters:** O2 runs down over time. Hazard shielding runs down in hazard zones, and once it is gone, health drains instead. Carry capacity is limited by weight.
- **On the map:** resource nodes (ore, ice, organics, crystal, relics), loot caches, lore terminals, cryo pods (rescued sleepers become Colonists, a score and story stat), side-objective markers, and fauna (wander → chase → attack, with ranged spitters and a rare alpha).
- **Leaving:** walk back to the lander to bank the haul. If the explorer goes down, the haul is lost but the explorer survives wounded (no permadeath for crew on away missions; health and morale take the hit).
- The simulation runs on a fixed 60 Hz timestep in pure code. It takes an input vector, so the bot and the tests can drive it without a DOM.

### Ship combat (turn-based)
- Both ships have **subsystems** (Weapons, Shields, Engines, Sensors, Life Support) with HP. Every turn the **reactor** provides energy pips.
- On your turn, you assign pips (shields soak damage, engines add evasion, weapons charge) and pick actions:
  - fire each charged weapon at a chosen enemy subsystem
  - brace
  - repair (Engineer)
  - a crew ability (Pilot: evasive roll; Scientist: scan weak point; Soldier: boarding strike; Medic: triage)
  - charge the jump drive to flee (takes 3 turns)
- Hits roll against evasion. Destroying a subsystem disables it. The enemy AI is a simple priority list for each archetype.
- **Enemies:** 10 archetypes (scavenger skiff, clan raider, Concord interceptor, Choir drone, and so on) plus 6 sector bosses.
- Victory pays out scrap, credits, modules and sometimes a surrendering crew member.

### RPG layer
- **Captain** is created at the start: name, portrait (built from code-drawn parts) and **Origin**. The Origin is Navy, Salvager, Scholar or Colonist, and gives starting bonuses and unique dialogue options.
- **Crew** (up to 6, more with cabin upgrades). Each crew member has:
  - a class: Pilot, Engineer, Scientist, Medic or Soldier
  - four stats: **Grit, Wits, Reflex, Charm**
  - health and morale
  - 1–2 traits (for example, Iron Stomach eats half, Claustrophobic loses morale on long jumps)
  - a level from 1 to 15, with XP from events, combat and away missions
  - a skill tree of 8 nodes per class
- Events run **stat checks** against the best qualified crew member, and the UI shows the odds.
- **Gear:** each away explorer has weapon, suit, tool and module slots. There are about 40 items with rarity tiers and rolled affixes.
- **Ship modules:** weapons ×2–4, shield, engine, sensor, reactor, cargo, hydroponics, refinery, fabricator, med-bay and cabins. Each upgrades through Mk I–IV, for about 35 modules in all.
- **Fabricator crafting:** about 60 recipes turning raw materials (ore, ice, organics, crystal, relic, alloy, circuits, exotic matter) into parts, gear, modules and consumables (medkits, rations, fuel cells, power cells, O2 canisters, decoys).
- **Factions:** Concord Remnant, Drift Clans and the Choir. Each has reputation from −100 to +100, which shifts prices, recruitment, and whether patrols are friendly or hostile.

### Narrative and content targets
- **Main quest:** 36 story missions across six sectors (six per sector), ending with a final choice at Haven: settle, share or sever, which gives three epilogues.
- **Side content:** about 70 random events with branching choices and stat checks, 18 station quests, and 30 lore terminal logs.
- **Ship's log tab:** keeps every story beat, plus a Codex of planets, fauna and factions.

### Persistence and checkpoints
- The game autosaves to `localStorage` after every action and every few seconds during an away mission.
- Docking at a station writes a **checkpoint snapshot**. "Signal lost" restores that checkpoint and shows how many days were lost.
- Saves export and import as a copyable code, following epochs' `exportSave`/`importSave`.

---

## 2. Responsive UI

- **Portrait phone (default, below 760px wide):**
  - Top HUD strip: fuel, food, energy, hull, credits, day, sector.
  - The main canvas fills the middle.
  - Sheet panels slide up over the canvas for station, event and fabricator screens.
  - Bottom tab bar: **Map · Ship · Crew · Cargo · Log**.
  - Safe-area insets, `100dvh`, tap targets of at least 44px, and fonts no smaller than 14px. Numbers use a system face, as in epochs' `--num-face`.
- **Short phones (360×640):** the HUD collapses to icons and values, and panels scroll.
- **Tablet/landscape and desktop (760px and wider):** a two-column grid, with the canvas on the left and the active panel on the right. Tabs move into a side rail. The HUD stays on top. Away missions and combat take the full width and show keyboard hints.
- **Away mission:** a full-screen canvas with an overlaid stick and buttons. In landscape on a phone, it keeps playing in a letterboxed portrait-ish view rather than forcing rotation.
- **Rendering:** the canvas renders at integer pixel scale, sized for `devicePixelRatio`, with `image-rendering: pixelated`. A `ResizeObserver` drives the layout.
- **Panels:** HTML strings patched with `morph()`, so the button under a finger never gets replaced mid-tap.
- **Full-screen button:** where supported. The manifest sets `orientation: portrait` and `display: standalone`.

---

## 3. Technical architecture (mirrors `epochs/` and `hollowdeep/`)

```
voidwake/
  package.json  vite.config.ts  tsconfig.json  index.html  README.md  PLAN.md  .gitignore
  public/manifest.webmanifest  public/icons/icon-{64,192,512}.png   (written by bake)
  src/main.ts
  src/data/      types.ts sectors.ts nodes.ts biomes.ts fauna.ts enemies.ts modules.ts gear.ts
                 materials.ts recipes.ts crew.ts origins.ts skills.ts traits.ts events.ts
                 story.ts quests.ts lore.ts factions.ts progression.ts validate.ts
  src/game/      rng.ts engine.ts derive.ts galaxy.ts (sector gen + travel) survival.ts
                 events.ts (resolve choices/stat checks) station.ts combat.ts away/{gen,sim,ai}.ts
                 crew.ts crafting.ts story.ts factions.ts checkpoint.ts bot.ts features.ts
  src/render/    canvas.ts starmap.ts system.ts combat.ts away.ts starfield.ts portrait.ts
  src/ui/        dom.ts app.ts layout.ts hud.ts tabs.ts panels/{map,ship,crew,cargo,log,station,event,combat}.ts
                 touch.ts (virtual stick + buttons, keyboard) text.ts
  src/audio/     index.ts sfx.ts music.ts (generative: per-sector key/mode, combat layer, away-mission biome beds)
  src/sprites/   px.ts defs.ts atlas.ts hash.ts atlas.png atlas.json  (baked, committed)
  src/state/     types.ts persistence.ts
  src/num/       format.ts
  scripts/       bake-sprites.ts validate-data.ts playtest.ts verify-ui.ts
  tests/         galaxy, survival, events, combat, away-sim, crafting, crew, persistence, checkpoint, story, sprites, data, bot
```

**Patterns to copy from the sibling games** (adapted, not cross-imported, because the projects stay independent):
- `epochs/src/ui/dom.ts`: `morph()` and `esc()` for DOM patching that leaves tapped buttons in place.
- `epochs/src/game/rng.ts`: mulberry32 with its state kept in the save, plus `pickWeighted` and `hashString`. Every roll replays deterministically.
- `epochs/src/state/persistence.ts`: `mergeDefaults`, `SAVE_VERSION`, and the save export/import code.
- `epochs/src/sprites/px.ts`, `atlas.ts`, `hash.ts` and `scripts/bake-sprites.ts`: code-drawn pixel art, a baked atlas, and a test that fails when the atlas is stale.
- `epochs/src/audio/{index,sfx,music}.ts`: the mixer and the `blip`/`hiss` synthesis helpers.
- `epochs/scripts/verify-ui.ts`: Playwright screenshots at the phone (390×844), short (360×640), tablet (1024×768) and wide (1440×900) viewports.
- `epochs/src/main.ts` boot shape, `index.html` meta tags, `vite.config.ts` (`base: './'`), `tsconfig.json` and the `package.json` scripts and devDependency versions.

**Key design rules:**
- `src/game/` is pure: no DOM, all randomness from `rand(state)`, time passed in explicitly.
- The away mission is `stepAway(sim, input, dt)` with a fixed dt. The renderer interpolates, and the bot supplies the input.
- Content is typed data in `src/data/`. `validate.ts` checks that every recipe, story flag, event outcome and item reference resolves, and that every sector can be finished.
- The **bot** (`src/game/bot.ts`) plays a greedy campaign:
  - jumps toward the gate while detouring to stations when low on fuel or food
  - picks the first affordable event choice
  - fights with a fixed policy
  - runs away missions with a "go to nearest node, return at 40% O2" policy
  - crafts the cheapest needed consumable and buys upgrades in priority order
- **`tests/bot.test.ts` gate:** within a fixed seed and a set number of in-game days, the bot must reach Sector 3, recover two ark sections, survive at least one checkpoint reload, and never soft-lock (always has a legal action).

---
