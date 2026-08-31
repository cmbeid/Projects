# Fathomline — Casual Idle Fishing Game (Implementation Plan)

## Context

`fathomline/` (this folder) is empty — this is a greenfield build. The goal is a casual **idle fishing game** for mobile web (portrait-first) that also lays out well on desktop, with 100+ fish, 140+ purchasable upgrades, a mini story with objectives, and multiple replayability engines.

The stack and structure deliberately mirror a prior game, **Sunfall Depths** (`mininggame`): Vite + Tailwind, vanilla ES modules split into small single-responsibility files, canvas for the play scene and DOM/Tailwind for all UI chrome, procedural art with no asset files, localStorage saves, and a `start.bat` launcher. Reusing that shape means the module boundaries, save layer, and data-driven catalog pattern are already proven.

Work is split into **8 phases, each ending in a genuinely playable build** — never a phase that only compiles. Phase 1 alone is a complete 10-minute fishing game; every later phase widens it without breaking what shipped before.

Working title: **Fathomline** (swappable — appears only in `config.js`, `index.html` title, and `package.json`).

---

## Tech Stack & Constraints

- **Vite 5 + Tailwind 3**, vanilla JS ES modules, no game framework. `npm run dev` / `build` / `preview`, plus `start.bat` mirroring Sunfall Depths.
- **Canvas** renders only the water scene (parallax water bands, bobber, line, fish silhouettes, particles, weather). **Tailwind/DOM** renders every HUD element, panel, list, and modal — text stays selectable, scrollable, and accessible.
- **No image or audio asset files.** Fish are procedurally drawn silhouettes (body spline + fin shapes + palette per species); SFX are short procedural WebAudio blips.
- **Portrait-first**, mobile-web target; responsive up to a 3-column desktop layout (see UI section).
- **Seeded PRNG** (`mulberry32`) for anything that must be reproducible (endless-depth layouts, weather cycles). Seed stored in save.
- **Data-driven throughout**: fish, upgrades, crew, bait, story beats, and objectives are plain data tables. UI renders generically from them, so content growth in Phase 3+ is data edits, not new code.
- Offline/idle math is **closed-form** (elapsed-time integral), never a catch-up loop — a 12-hour absence must resolve in <50ms.

---

## File Structure

```
fathomline/
  index.html                  # shell: HUD, canvas mount, tab bar, panel containers
  package.json  vite.config.js  tailwind.config.js  postcss.config.js  start.bat
  AGENTS.md                   # project rules (mirror mininggame/AGENTS.md)
  src/
    main.js                   # boot, wire UI<->engine, screen state machine
    config.js                 # ALL tuning constants + curve functions
    core/
      engine.js               # rAF loop, fixed-step update, global GameState, save hooks
      rng.js                  # mulberry32, weighted pick, gaussian-ish weight roll
      save.js                 # localStorage load/save, schema version + migrations
      offline.js              # closed-form offline yield resolution
      events.js               # tiny pub/sub bus (decouples systems from UI)
      audio.js                # procedural WebAudio SFX behind a mute toggle
    data/
      fish.js                 # ~107 species defs (see Fish Catalog)
      junk.js                 # junk + treasure pulls
      regions.js              # 8 regions: unlock gates, fish pools, modifiers
      upgrades.js             # gear ranks + tiered stats + one-time passives
      bait.js                 # bait + lure catalog
      crew.js                 # hireable idle crew
      story.js                # acts, beats, dialogue, NPCs
      objectives.js           # quest/objective definitions
      perks.js                # Pearl prestige tree
      variants.js             # shiny/albino/ancient/size-class rules
    systems/
      fishing.js              # cast -> bite -> hook resolution, species roll
      minigame.js             # reel/tension state machine (the active skill layer)
      economy.js              # value formula, cooler, selling, market modifiers
      inventory.js            # cooler contents, stacking, auto-sell rules
      upgrades.js             # purchase/tier logic, effect aggregation
      stats.js                # effectiveStats(): folds gear+perks+buffs into one object
      crew.js                 # crew assignment, idle catch generation
      codex.js                # discovery records, completion %, rewards
      progress.js             # objectives, act gating, region unlocks
      prestige.js             # Pearl calc, reset, perk application
      endless.js              # Fathom depth-tier scaling + personal bests
      weather.js              # time-of-day + weather cycle and its fish modifiers
    render/
      scene.js                # canvas draw: water, sky, bobber, line, fish
      fishart.js              # procedural fish silhouette generator (per species seed)
      fx.js                   # particles, splashes, float text, screen shake
      camera.js               # DPR + resize handling, letterboxing
    ui/
      hud.js                  # top bar: coin, pearls, cooler, region, weather
      castbar.js              # primary action button + reel minigame overlay
      shop.js                 # gear/upgrade panels (renders from data/upgrades.js)
      codexui.js              # fish codex grid + detail cards
      crewui.js               # hire/assign/level crew
      mapui.js                # region select + unlock requirements
      storyui.js              # dialogue modal, act intros, choices
      objectivesui.js         # active objective tracker + list
      prestigeui.js           # retire confirm + Pearl tree
      panels.js               # bottom-sheet <-> docked-rail responsive controller
      settings.js             # mute, reduced motion, save export/import, wipe
      format.js               # number/weight/time formatting (1.2K, 3.4 kg, 2h 14m)
```

---

## Core Gameplay Loop

1. **Cast** — tap the big CAST button (or tap the water). A bobber arcs out; cast distance/accuracy come from rod stats.
2. **Wait for a bite** — bite timer rolls from `baseBiteTime / (biteRate stats)`, modified by bait, lure, weather, and time of day. A bobber dip + optional haptic/SFX signals the bite.
3. **Hook** — tap within the hook window (widened by upgrades; auto-hooked once `Bite Alarm` is bought).
4. **Reel minigame** — the active skill layer (see below). Success lands the fish; failure snaps the line or loses the fish.
5. **Land & record** — fish rolls species → weight → size class → variant. New species/variant fires a **Codex discovery** card. Fish enters the cooler.
6. **Sell** — sell from the cooler for Coin (auto-sell once unlocked); cooler capacity forces the sell-now-vs-bank-a-trophy decision.
7. **Spend** — Coin buys rods, reels, lines, hooks, boats, tackle passives, bait, and crew.
8. **Idle** — assigned crew fish their regions on timers; offline progress accrues up to the Offline Cap.
9. **Progress** — objectives and codex completion unlock new regions, advance story acts, and eventually open Prestige and the endless Fathom.

**Session shape:** 3–5 minute active bursts, meaningful idle returns after 30min+, full story arc ≈ 6–10 hours, prestige loop indefinite.

---

## The Reel Minigame (`systems/minigame.js`)

One-finger, portrait-native, and the thing that keeps active play from being a pure clicker.

- A **vertical depth track** on the right side of the scene. A **fish marker** moves up/down with per-species AI (see below). A **catch zone** (a bar the player controls) rises while holding and falls while released.
- **Progress bar** fills while the fish marker is inside the catch zone, drains while outside. Fill to 100% = caught; drain to 0% = escaped.
- **Tension meter** rises while holding *and* while the fish struggles against the line. Max tension = line snaps (fish lost, bait consumed, small durability ding). Tension bleeds off when not holding — so it's a hold/release rhythm, not a hold-forever.
- **Fish AI profiles** (a field on each species): `steady`, `darter` (sharp random jumps), `diver` (long runs downward), `thrasher` (high tension gain), `sulker` (long stillness then a burst). Legendary/Mythic fish combine two profiles with a **phase change** at 60% progress.
- **Struggle events**: a legendary fish periodically triggers a 1.2s QTE flash — tap to counter for a tension dump, miss it for a tension spike.
- **Upgrade hooks:** Reel rank → catch-zone size; Line rank → max tension; Tension Control tier → tension bleed rate; Rod rank → progress fill rate; `Second Wind` passive → one free escape rescue per cast.
- **Accessibility:** a settings toggle for **Assist Mode** (zone +40%, tension −40%) and an **Auto-Reel** passive purchasable mid-game so late-game idling never requires the minigame.

---

## Fish Catalog (`src/data/fish.js`)

**107 species across 8 regions**, plus variants and junk. Rarity tiers: **C**ommon · **U**ncommon · **R**are · **E**pic · **L**egendary · **M**ythic.

Base rarity weights: C 60 · U 25 · R 10 · E 4 · L 0.9 · M 0.1, shifted by Hook rank, Luck tier, bait, lure, weather, and time of day.

| # | Region | Species (rarity) |
|---|---|---|
| R1 | **Marrow Cove** — starter shallows | Silverfin Minnow (C), Cove Sardine (C), Mudsnout Carp (C), Bristle Perch (C), Pier Goby (C), Copperscale Bass (U), Harbor Mackerel (U), Spotted Flounder (U), Moonlit Trout (R, night), Glass Eel (R), Kingfisher Salmon (E), **Isolde's Perch (L, story)** |
| R2 | **Reedwater Marsh** — brackish | Reed Roach (C), Marsh Bream (C), Blackmouth Catfish (C), Peat Tench (C), Bulrush Pike (U), Amber Loach (U), Fen Sturgeon (U), Bog Lamprey (R), Heron's Bane Pike (R), Mirror Carp (E), Sunken Bell Koi (E, rain only), **The Reedmother (L, boss)** |
| R3 | **Coral Shelf** | Clown Wrasse (C), Banded Damsel (C), Parrotscale (C), Sand Goby (C), Coral Butterflyfish (U), Firetail Snapper (U), Lionfish (U, spine hazard), Emperor Angelfish (R), Ribbon Eel (R), Napoleon Wrasse (E), Sunburst Grouper (E), Titan Triggerfish (E), **Prismscale Manta (L)** |
| R4 | **Kelp Cathedral** | Kelp Perch (C), Señorita Fish (C), Green Rockfish (C), Kelp Greenling (U), Leafy Seadragon (U), Garibaldi (U), Cabezon (U), Wolf Eel (R), Giant Sea Bass (R), Sixgill Pup (R), Vermilion Rockfish (E), Canary Rockfish (E), **The Green Warden (L, boss)** |
| R5 | **Wreck of the Isolde** | Wreck Blenny (C), Rust Crab (C), Porthole Scorpionfish (C), Cargo Conger (U), Bone Snapper (U), Drowned Cod (U), Ghostfin Ray (R), Anchor Lingcod (R), Chainmail Sturgeon (R), Lantern Grouper (E), Coffin Catfish (E), Pale Marlin (E), **The Bosun (L, story boss)** |
| R6 | **Frostcurrent** — glacier bay | Icefin Smelt (C), Arctic Cod (C), Snow Char (C), Ribbon Capelin (C), Glacier Halibut (U), Frostjaw Pike (U), Wolffish (U), Blue Ling (R), Greenland Shark (R), Narwhal Eel (R), Crystal Sturgeon (E), Aurora Salmon (E), **The Winterwake (L, boss)** |
| R7 | **Ember Rift** — volcanic vents | Vent Shrimp (C), Cinder Goby (C), Sulphur Blenny (C), Basalt Crab (C), Magma Eel (U), Obsidian Snapper (U), Yeti Crab (U), Tubeworm Tangler (R), Emberfin Tuna (R), Smokestack Ray (R), Pyre Coelacanth (E), Molten Anglerfish (E), **The Forgewyrm (L, boss)** |
| R8 | **Fathom Trench** — abyss | Lanternfish (C), Bristlemouth (C), Hatchetfish (C), Viperfish (U), Barreleye (U), Dumbo Octopus (U), Goblin Shark (R), Frilled Shark (R), Giant Isopod (R), Vampire Squid (R), Colossal Squid (E), Bone Angler (E), Gulper Leviathan (E), **Tideheart Leviathan (M, finale)** |
| — | **Wanderers** — any region, ultra-rare | Silver Wanderer (M), The Drowned Lantern (M), Chronofin (M), Gran Isolde's Ghostfish (M, story) |

**Junk & treasure pulls** (`data/junk.js`, 10 entries): Old Boot, Tangled Net, Rusted Can, Kelp Clump, Driftwood, **Message in a Bottle** (lore), **Sealed Chest** (coin burst), **Barnacled Locket** (codex fragment), **Ship's Compass** (region hint), **Gran's Log Page** (story beat trigger). Junk rate starts ~18% and is reduced by Hook rank and the `Line Splicer` passive.

### Variants & size classes (`data/variants.js`)
- **Size class** from the weight roll percentile: Runt (<15%) · Standard (15–70%) · Large (70–92%) · **Trophy** (92–99%) · **Record** (>99%). Record catches are stamped into the codex records board with date and gear used.
- **Variants** (independent roll, multiplicative value): **Shiny/Golden** 1/250 (×8), **Albino** 1/400 (×12), **Ancient** 1/1000 (×25, unlocks a codex lore entry), **Void-touched** 1/2000 (×50, Fathom Trench + endless only).
- Codex tracks each species × variant × best weight, so full completion is `107 × 5` records — the long-tail chase.

### Value formula (`systems/economy.js`)
```
value = base × (kg / avgKg)^1.3 × rarityMult × sizeClassMult × variantMult
      × marketTier × prestigeMult × depthMult(endless)
```

---

## Upgrades — 140+ distinct purchases (`src/data/upgrades.js`)

**Gear ranks (32 purchases)** — big step changes, cost curve `base × 3.2^rank`:
1. **Rod** (8): Bamboo Switch → Driftwood Rod → Fiberglass → Carbon Spire → Whalebone → Stormglass → Abyssal Spine → **Tideheart Rod** *(reel progress rate, cast distance)*
2. **Reel** (6): Handcrank → Spinning → Baitcaster → Geared Drum → Deepwinch → **Leviathan Winch** *(catch-zone size, reel speed)*
3. **Line** (6): Cotton → Braided → Monofilament → Steel Weave → Kelpsilk → **Fathomcord** *(max tension, max landable weight)*
4. **Hook** (6): Bent Pin → Barbed → Treble → Silver → Bone → **Starhook** *(rarity bias, junk reduction)*
5. **Boat** (6): Rowboat → Skiff → Trawler → Cutter → Icebreaker → **Deepdiver** *(region access, crew slots, offline cap)*

**Tiered stat upgrades (50 tiers)** — cost curve `base × 1.55^tier`:
Cast Distance (5) · Lure Speed (5) · Tension Control (5) · Luck (5) · Cooler Capacity (6) · Market Price (5) · Bait Efficiency (4) · Offline Cap (5) · Crew Speed (5) · Crew Yield (5)

**Tacklebox passives (18 one-time)**:
Auto-Cast · Auto-Sell · Auto-Reel · Double Hook (chance at 2 fish) · Bite Alarm (auto-hook) · Rarity Radar (preview incoming rarity) · Trophy Scale (+trophy odds) · Sonar (shows region fish density) · Net Trawl (passive background catches) · Chum Slick (temporary bite-rate boost) · Barbed Hooks (−escape chance) · Line Splicer (−junk, −snap) · Second Wind (one escape rescue/cast) · Deep Pockets (+coin per sale) · Insulated Cooler (no value decay) · Livewell (bank one live fish across prestige) · Ledger (offline log + sale history) · Weather Eye (forecast + rerolls)

**Bait (10)** — consumable, biases the species roll: Earthworm · Minnow · Shrimp · Squid Strip · Corn · Chum Ball · Glowbait *(deep/night)* · Ember Roe *(R7)* · Frostkrill *(R6)* · **Ancient Roe** *(Mythic bias)*
**Lures (8)** — equipment, region-biased: Spinner · Spoon · Popper · Jig · Deep Diver · Fly · Bone Rattle · Tidecaller Lure

**Crew (8 hires × 5 levels = 40)** — the idle engine: Deckhand Pell · Netter Maura · Old Tom · Diver Kess · Cartographer Wen · Icewright Bran · Ventwalker Sura · Ghost of the Isolde. Each has a region affinity, catch interval, rarity bias, and one unique perk.
**Pearl perk tree (24 nodes)** — see Prestige.

---

## Story & Objectives (`data/story.js`, `data/objectives.js`)

You are the heir to **Gran Isolde's** boat in **Marrow Cove**, a fishing town whose catch has collapsed. Isolde left behind a half-finished Codex and a boat, and she went out one morning and never came back. The **Tidewright Company** trawlers are stripping the water; the old fishers say the tides stopped answering.

- **Act I — Slack Water** (R1–R2): learn the trade, reopen the market, fill the first Codex pages. Beat: a Log Page reveals Isolde was charting something, not fishing.
- **Act II — The Company** (R3–R4): Tidewright is dredging the reef. Objectives push you to out-fish their quotas and buy the reef's protection. Beat: their charts match Isolde's.
- **Act III — The Wreck** (R5): find the *Isolde* on the bottom. Boss: **The Bosun**. Beat: her final log — she was answering something calling from the trench, and she chose to go down.
- **Act IV — Cold and Fire** (R6–R7): two keys, two bosses (**Winterwake**, **Forgewyrm**), to open the trench.
- **Act V — Fathomline** (R8): descend to the **Tideheart Leviathan**. **Final choice** — *Cut the line* (release it; tides return, the town lives, your Codex records are archived into a Legacy tab and reset) or *Land it* (bind it; enormous permanent multiplier, the cove stays dead, a different epilogue). Both choices unlock Prestige and the endless Fathom; the choice is recorded per-run and shown in the Legacy tab.

**Objective system**: an always-visible tracker (top of the panel rail on desktop, collapsible chip on mobile) showing 1 active + up to 2 queued objectives. Types: `catch_species`, `catch_count`, `catch_weight`, `earn_coin`, `own_upgrade`, `codex_percent`, `defeat_boss`, `survive_depth`. Each has `{ id, act, title, desc, type, target, reward, unlocks[] }`. Rewards: Coin, bait bundles, gear discounts, region keys, crew hires.

---

## Replayability

**1. Prestige — "Retire the Boat"** (`systems/prestige.js`)
Unlocked after Act V. Resets Coin, gear, crew, region unlocks, and objectives; **keeps** Codex discoveries, records, Pearls, perks, and story flags.
```
pearls = floor( sqrt(lifetimeCoin / 1e6) × (1 + codexCompletion) × actBonus )
```
**24-node Pearl tree** in 4 branches — *Angler* (catch speed, minigame assist, crit catches), *Merchant* (value, market tiers, starting capital), *Naturalist* (rarity, variant odds, codex rewards), *Deepwarden* (endless depth scaling, offline cap, crew power). Nodes cost 1–15 Pearls with prerequisites. NG+ runs re-gate regions but at a compressed pace (early costs scaled by a prestige discount) so a replay is ~40% the length of the first run.

**2. Living Codex & rarity chase** (`systems/codex.js`)
Grid of 107 species × 5 variant slots. Per-species detail card: silhouette, best weight, first-caught date, region, bait used, lore. **Completion rewards** at 25/50/75/100% per region (permanent multipliers) and global milestones. A **Records board** ranks your heaviest catch per species. This is the content that outlives the story.

**3. Endless Fathom** (`systems/endless.js`)
Post-story infinite mode. Descend depth tiers `d`; each tier: value `×1.18^d`, tension `×1.06^d`, bite time `×1.03^d`, plus a rolling depth modifier (blackout, pressure, current, bloom). Fish pool skews Void-touched. Currency: **Depth Marks**, spent on a small endless-only upgrade set. Tracks personal best depth per run and all-time; deaths (line snap at depth) end the dive and bank Marks earned.

*(Explicitly out of scope: daily seeded tides / limited-time events. The weather system in Phase 3 leaves a clean hook if this is wanted later.)*

---

## UI / Responsive Layout

**Portrait mobile (<640px)** — the primary target:
- Top: compact HUD strip — Coin, Pearls, cooler fill bar, region name, weather/time icon.
- Middle: canvas scene, ~4:5, full-bleed. Objective chip overlays the top-left.
- Bottom: large **CAST** button (min 64px tall, thumb-reachable) + a 5-icon tab bar (Shop · Codex · Crew · Map · Story).
- Panels open as **bottom sheets** to 85vh with a drag handle, `overscroll-contain`, and momentum scroll.

**Tablet (640–1023px)**: same column centered at `max-w-[560px]`, ambient water gradient in the gutters.

**Desktop (≥1024px)**: 3-column grid — **left rail** (objectives, crew roster, active buffs) · **center** scene at `max-w-[600px]` · **right rail** (tabbed Shop/Codex, always visible, no modal). Same components with `lg:` variants; `ui/panels.js` swaps sheet-mode for docked-mode off a single media query, so there is one implementation of every panel.

**Canvas handling**: DPR-aware sizing via `ResizeObserver`, logical coordinate space fixed at 360×450 with letterboxing, so scene code never deals with device pixels.

**Accessibility**: `prefers-reduced-motion` kills shake/parallax, Assist Mode for the minigame, ≥44px hit targets, WCAG AA contrast on all HUD text, full keyboard path on desktop (Space = cast/hold, Tab through panels).

---

## Persistence

`localStorage` key `fathomline.save.v1`, JSON, autosave every 15s and on every milestone (catch, purchase, act change, prestige). Stores: schema version, seed, coin, pearls, depthMarks, gear ranks, upgrade tiers, passives, bait/lure inventory, crew roster + assignments, cooler contents, codex records, story flags + choices, objective state, endless bests, settings, and `lastSeenAt` for offline math. `core/save.js` owns a **migration chain** keyed on version so content patches never wipe saves. Settings panel offers **export/import as a JSON string** and a confirm-gated wipe.

---

## Phase Plan

Each phase ends in a build you can open and play. Ship, play, then move on.

### Phase 0 — Scaffold & First Cast
Scaffold Vite/Tailwind/postcss/`start.bat`/`AGENTS.md`. Build `core/engine.js` (fixed-step loop), `core/save.js`, `core/events.js`, `render/camera.js`, a minimal `render/scene.js` (water bands + bobber), `ui/hud.js`, and `ui/castbar.js`.
**Playable:** tap CAST → bobber arcs out → a bite after a delay → tap to land one placeholder fish → Coin increments → reload restores your Coin.
**Verify:** save survives reload; loop holds 60fps on a throttled mobile viewport; canvas is crisp at DPR 2.

### Phase 1 — Core Loop Vertical Slice *(the game becomes fun here)*
Full reel minigame with tension and the 5 AI profiles. Region 1 (Marrow Cove, 12 species) in `data/fish.js`. Rarity roll, weight roll, size classes, value formula, cooler + manual sell. Rod/Reel/Line/Hook ranks 1–3 and the first 4 tiered stats. `render/fishart.js` procedural silhouettes. `render/fx.js` splashes and float text.
**Playable:** a complete, satisfying 10–15 minute fishing game — catch 12 species, feel weight variance, buy 4 gear lines, chase a Trophy.
**Verify:** 100 simulated casts produce a rarity distribution within tolerance of the table; line snaps only above the line's weight cap; no upgrade makes the minigame trivially unloseable.

### Phase 2 — Idle Engine
Crew hire/assign/level (`systems/crew.js`), closed-form offline resolution (`core/offline.js`) with a "while you were away" summary, auto-sell, Offline Cap tiers, bait consumables, `Net Trawl` passive.
**Playable:** it's now an *idle* game — close the tab, come back, collect. Crew fish while you fish.
**Verify:** offline yield for 4h matches 4h of foreground play within ±5%; a 12h absence resolves in <50ms; the cooler cap correctly truncates offline gains; clock tampering (system time set backwards) can't mint coin.

### Phase 3 — The World: 8 Regions, 107 Fish
All remaining regions and species, boat tiers, region unlock gates, `systems/weather.js` (day/night cycle + weather states with per-species modifiers), remaining gear ranks and stat tiers, full bait/lure catalogs, `ui/mapui.js`.
**Playable:** the full breadth of content — sail between 8 distinct regions, ~4–5 hours of fresh fish to find.
**Verify:** every region reachable via its intended gate; every species obtainable (a headless roll script proves each of the 107 can appear under some condition); no fish is unreachable behind an impossible weight or tension wall.

### Phase 4 — Codex, Variants & Collection Meta
`systems/codex.js`, variant rolls, size-class records, discovery cards, `ui/codexui.js` (grid + detail cards + records board), per-region and global completion rewards, aquarium showcase for Record catches.
**Playable:** the collection chase engages — a clear "97/107" completion pull with rewards along the way.
**Verify:** a variant catch of a known species registers as a new codex slot without duplicating the species; completion percentages match a hand count; completion rewards apply exactly once.

### Phase 5 — Story & Objectives
`data/story.js` (5 acts, all beats, NPC dialogue), `data/objectives.js`, `systems/progress.js`, `ui/storyui.js`, `ui/objectivesui.js`. Boss fish encounters with phase-change minigame behavior. Log Pages and Messages in a Bottle as story delivery. Act V final choice with two epilogues.
**Playable:** a start-to-finish narrative campaign with guided objectives — the game now has an ending.
**Verify:** playthrough hits every act beat in order; objectives can't soft-lock (each has a reachable target given the gear available at its act); both Act V branches resolve and persist their choice.

### Phase 6 — Prestige & Endless Fathom
`systems/prestige.js` + Pearl formula + 24-node tree + `ui/prestigeui.js`; NG+ pacing discounts; `systems/endless.js` with depth tiers, modifiers, Depth Marks, and personal bests.
**Playable:** infinite replay — retire, rebuild faster, dive deeper.
**Verify:** prestige preserves exactly the intended keys and clears the rest (assert on the save object); Pearl formula is monotonic in lifetime coin; a second run reaches Act V measurably faster; endless depth 50 doesn't produce `Infinity` or precision loss in the value formula.

### Phase 7 — Polish & Ship
Procedural WebAudio SFX + mute; juice pass (shake, particles, catch celebration, combo streak); full desktop 3-column layout pass; onboarding tutorial for the first 3 casts; accessibility pass (reduced motion, Assist Mode, contrast, keyboard); balance pass against a spreadsheet of time-to-milestone; save export/import; optional PWA manifest + service worker for offline install; `vite build` production check.
**Playable:** shippable v1.0.
**Verify:** Lighthouse mobile pass; real-device portrait test; a fresh save reaches Act II inside 45 minutes; no console errors across a full playthrough.

---

## Key Interfaces (data contracts)

```js
// data/fish.js
{ id, name, region, rarity: 'C'|'U'|'R'|'E'|'L'|'M',
  minKg, maxKg, avgKg, baseValue, weightBias,     // weightBias skews the roll curve
  ai: 'steady'|'darter'|'diver'|'thrasher'|'sulker', aiPhase2?,
  conditions: { time?: 'day'|'night', weather?: [], baitBias?: {}, lureBias?: {}, minBoat? },
  art: { palette:[], bodyShape, finShape, seed }, lore }

// data/upgrades.js
{ id, name, desc, category:'rod'|'reel'|'line'|'hook'|'boat'|'stat'|'passive',
  maxTier, baseCost, costCurve(tier), effect(stats, tier), requires? }

// data/crew.js
{ id, name, hireCost, regionAffinity, baseInterval, rarityBias, maxLevel, perk(stats) }

// data/story.js
{ id, act, trigger:{ type, value }, speaker, lines[], choice?:{ options[] }, unlocks[] }

// data/objectives.js
{ id, act, title, desc, type, target, reward:{}, unlocks[] }

// GameState (owned by core/engine.js)
{ version, seed, coin, pearls, depthMarks, gear{}, stats{}, passives[],
  bait{}, lures[], crew[], cooler[], codex{}, records{},
  story{ act, flags[], choice }, objectives{}, endless{}, settings{}, lastSeenAt }
```

`systems/stats.js` exposes a single `effectiveStats(state)` that folds gear ranks + stat tiers + passives + perks + active buffs + weather into one flat object. **Every other system reads stats only through it** — this is the seam that keeps 140 upgrades from turning into spaghetti.

---

## Verification (end-to-end)

- `npm run dev` (or `start.bat`) → open `http://localhost:5173`, DevTools device toolbar at iPhone-portrait.
- **Manual checklist per phase** as listed above; the Phase 7 run is a full cold-start playthrough to Act V.
- **Optional Vitest specs** for pure logic (cheap, high value, no DOM): rarity distribution over 100k rolls, weight/size-class percentile boundaries, upgrade cost curves, `effectiveStats` aggregation, offline closed-form vs. simulated foreground, prestige key retention, endless scaling numeric stability. Add these in Phase 1 and grow them per phase.
- **Headless content audit script** (`node scripts/audit.js`): asserts every species is reachable, every objective completable, every upgrade purchasable, and no data table has duplicate ids or dangling references.

---

## Assumptions & Defaults (chosen, recorded)

- No daily/seeded-event system; `systems/weather.js` leaves the hook if it is added later.
- Prestige is gated behind finishing Act V rather than a coin threshold, so first-run players see the story.
- Junk pulls are kept (they're comedy and lore delivery) but capped at ~18% and reducible to ~4% with upgrades.
- Assist Mode and Auto-Reel exist so the game stays fully playable as a pure idler for players who don't want the minigame.
- Save is local-only; no accounts, no backend, no analytics.
- Follows `mininggame/AGENTS.md` branch/PR conventions; this project lives in the same git repo as the other projects here, under `fathomline/`.

## Out of Scope

WebGL/3D, multiplayer or leaderboards (personal bests only), image/audio asset files, backend or cloud saves, native app packaging, monetization/ads, daily-event system.
