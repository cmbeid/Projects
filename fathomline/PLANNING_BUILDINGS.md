# PLANNING_BUILDINGS.md — Marrow Cove Buildings (draft, not yet merged into PLAN.md)

## Design Rationale

Buildings are the fourth progression pillar alongside Gear (the boat), Crew (people), and Prestige (Pearls/meta) — but they belong to **the town, not the boat**. That distinction drives two decisions:

1. **Scope: Marrow Cove only.** Buildings are not per-region. They live in your home port; one building (Shipyard) *dispatches* production to other regions, but the structures themselves don't multiply 8x. This keeps the data table small and avoids a combinatorial region×building matrix.
2. **Persistence: buildings survive "Retire the Boat."** Prestige resets Coin, gear, crew, and region unlocks but keeps Codex, Pearls, perks, and story flags — thematically, retiring the boat doesn't tear down the smokehouse. Buildings join the keep-list. This is deliberate, not an oversight: it gives NG+ a genuine head start (reinforcing the existing "second run reaches Act V measurably faster" verify criterion in Phase 6) while staying safe from runaway snowballing because every building's output is throughput-capped by something else (cooler stock, catch counts, region availability) rather than being a bare coin multiplier that compounds with itself.
3. **No new render/asset work.** Buildings are DOM/Tailwind cards like every other panel — no canvas, no procedural art system needed (a small icon glyph per building via Tailwind/SVG shape is enough).

## Phase Placement

### Phase 4.5 — Marrow Cove Rising
Insert after Phase 4 (Codex, Variants & Collection Meta) and before Phase 5 (Story & Objectives). It's placed here because the Aquarium reads the Records board built in Phase 4, and because building unlock gates below are deliberately expressed as coin/region/codex%/boat-tier conditions — systems that already exist by Phase 4 — rather than depending on the Act system, which doesn't land until Phase 5. When Phase 5 ships, story beats can be layered onto these same unlock gates via each building's `unlock` field without touching this phase's code.

`data/buildings.js` (7 buildings, catalog below), `systems/buildings.js` (purchase/level logic, online production ticks, offline closed-form resolver), `ui/townui.js` (building list + detail cards, Aquarium socket picker, Smokehouse queue view, Shipyard skiff dispatch), extension of `systems/stats.js#effectiveStats()` to fold building effects, extension of `core/offline.js` to resolve building production in the same pass as crew, and a `state.buildings` save-schema addition with a migration entry.

**Playable:** Marrow Cove visibly grows — a new "Town" entry point (see UI Integration) shows building cards you can afford and level up; the cove stops being just a boat launch and starts producing on its own axis. A market stall quietly drains your cooler into coin while you're off fishing elsewhere; a smokehouse turns a batch of raw catch into a marked-up "Smoked Goods" line; your best Trophy catches sit in a tank instead of the sale bin, paying rent forever.

**Verify:**
- Every building's `unlock` gate is reachable with the stat/state values available at that point in a fresh save (no building requires content that doesn't exist yet, e.g. Aquarium can't gate on a codex % higher than achievable pre-Phase-5).
- Buildings persist across a simulated prestige reset (assert `state.buildings` is untouched by `systems/prestige.js`'s reset) while `state.gear`/`state.crew`/`state.cooler` clear as before.
- A 12h offline window with Market Stall + Smokehouse + 2 Shipyard skiffs active still resolves in <50ms (closed-form, no per-tick loop).
- Market Stall offline drain never sells more value than was in the cooler at the start of the window (no coin minting from an empty cooler).
- Aquarium bonuses recompute correctly when a better Record replaces a socketed one (old bonus removed, new bonus applied, exactly once).
- Shipyard skiffs assigned to a region that becomes locked (edge case: none currently lock post-unlock, but assert the resolver treats an invalid/unassigned skiff as zero-yield rather than throwing).

## UI Integration

No 6th tab-bar icon — the existing 5-icon mobile bottom bar (Shop · Codex · Crew · Map · Story) stays as-is. Tapping the **Marrow Cove node on the map** (`ui/mapui.js`, already the "you are here" region) opens `ui/townui.js` instead of (or as a segment alongside) the standard region-info sheet, since Marrow Cove is the one region that's a hub rather than just a fishing ground. Desktop keeps this consistent: the right-rail Map tab gets a "Town" sub-tab. If playtesting in Phase 7's polish pass shows this is buried, promote it to a dedicated tab then — noted as a fallback, not blocking this phase.

## `data/buildings.js` — data contract

```js
// data/buildings.js
{
  id, name, desc,
  category: 'trade' | 'process' | 'capacity' | 'showcase' | 'utility' | 'production' | 'ambient',
  unlock: { type: 'coin' | 'boatTier' | 'regionUnlocked' | 'codexPercent', value },
  maxLevel, baseCost, costCurve(level),           // same shape as GEAR/STATS cost curves
  effect(level),                                   // -> partial stats object, folded into effectiveStats()
                                                    //    via the SAME Mult-suffix-multiplies /
                                                    //    else-adds rule gear and stat tracks already use
  slots?(level),                                   // Aquarium: display slot count at this level
  online?: { tickFn },                              // Smokehouse queue, Market Stall drain, Shipyard skiffs
  offline?: { resolveFn },                          // closed-form contribution, called from core/offline.js
}
```

`systems/stats.js#effectiveStats()` gets a third fold loop (after the existing `state.gear` and `state.stats` loops):
```js
for (const [buildingId, built] of Object.entries(state.buildings)) {
  const def = buildingById(buildingId);
  if (!def || !built.level) continue;
  for (const [key, value] of Object.entries(def.effect(built.level))) {
    stats[key] = key.endsWith('Mult') ? (stats[key] ?? 1) * value : (stats[key] ?? 0) + value;
  }
}
```
This is a pure addition to the existing seam — no other system needs to special-case buildings; anything already reading `effectiveStats()` picks up building effects for free (Dock Expansion's `crewSlots`/`coolerCapacity`, Lighthouse's `junkReduction`/`biteRateMult`, Chart Room's `regionUnlockCostMult`/`forecastHorizonHours`, Aquarium's `marketPriceMult`).

## `systems/buildings.js` — responsibilities

- `purchaseOrLevelUp(state, stats, buildingId)` — gate check against `unlock`, cost check against `costCurve(currentLevel+1)`, mutate `state.buildings[id].level`.
- `buildingsProductionTick(state, stats, dtSeconds, events)` — added to `engine.addSystem(...)` alongside `crewProductionTick`. Runs: Market Stall's continuous cooler drain (probabilistic-per-tick equivalent of the offline exponential formula, so online and offline behavior converge — the same calibration relationship `crewProductionTick`/`resolveOfflineProgress` already have), Smokehouse's batch queue (loads lowest-value raw cooler entries by default, converts on batch completion into a "Smoked Goods" cooler entry), Shipyard skiff catch rolls (identical shape to `crewProductionTick`, but iterating `state.buildings.shipyard.skiffs`, at a flat `skiffYieldMult = 0.5`).
- `resolveBuildingsOffline(state, stats, { windowFromMs, nowMs, elapsedMs, crewCatchTotals })` — called from `core/offline.js` right after the existing crew loop, in the same pass. Returns `{ coinEarned, breakdown[] }`, merged into the existing offline summary object so the "while you were away" card gains a Town section. `crewCatchTotals` (`{ totalCatches, totalRawValue }`) is a small addition to the existing crew loop in `offline.js` — needed for the Smokehouse's throughput-cap math (see below) — not a new simulation, just two running sums the loop already has the numbers for.
- `aquariumSocket(state, slotIndex, speciesId)` / `aquariumUnsocket(...)` — reads `state.codex.records`, writes `state.buildings.aquarium.sockets[]`.
- `buildingById(id)`, `nextBuildingCost(id)` — mirrors `nextGearTier` in `data/upgrades.js`.

`core/offline.js` changes: export `expectedCatchValueForRegion` (currently private) so the Shipyard offline resolver can reuse it verbatim instead of re-deriving region economics; accumulate `totalCatches`/`totalRawValue` across the existing crew loop and pass them into `resolveBuildingsOffline`.

## Building Catalog (7)

| # | Building | Category | Unlock | Levels | Cost curve | What it does |
|---|---|---|---|---|---|---|
| 1 | **Market Stall** | trade | `coin ≥ 300` | 4 | 300 × 2.6^(L-1) | Passively drains the cooler into Coin over time at a discount (`sellMult` 0.80→0.92 across levels), independent of the Auto-Sell passive. `drainRatePerHour = 0.15 + 0.10·L`. Payoff for players who don't want to babysit the cooler; the discount keeps manual selling relevant. |
| 2 | **Smokehouse** | process | `coin ≥ 1500` | 5 | 1200 × 2.8^(L-1) | Adds a processing step: batches of raw cooler fish convert into a higher-value "Smoked Goods" entry after `batchTimeMs` (default-on auto-load of lowest-value raw fish, optionally manual). `batchSize = 2+L`, `batchTimeMs = 90000/(1+0.15L)`, `smokeValueMult = 1.5+0.1L`. |
| 3 | **Dock Expansion** | capacity | `boatTier ≥ 2` | 6 | 800 × 2.4^(L-1) | `coolerCapacity += 3L` (stacks additively with the existing Cooler Capacity stat track, separate pool). `crewSlots += 1` at L3 and again at L6 — the *only* source of crew slots beyond what boat tiers grant, making it the late-game crew-slot lever. |
| 4 | **Aquarium** | showcase | `codexPercent(region1) ≥ 15%` | 5 | 1000 × 3.0^(L-1) | `slots(L) = L`. Player pins already-achieved Records (read-only reference into `state.codex.records`, no fish is consumed or removed from sale) into slots. Each socketed record contributes `marketPriceMult += 0.01 · rarityRank(fish.rarity) · (sizeClass==='Record' ? 1.5 : 1)`, recomputed whenever a socket changes or a pinned record is beaten by a bigger catch. |
| 5 | **Chart Room** (Cartographer's Office) | utility | `regionUnlocked('reedwater_marsh')` | 4 | 2000 × 2.5^(L-1) | `regionUnlockCostMult = 1 − 0.05L` (next region gate cheaper) and `forecastHorizonHours = 2 + 2L`, folded into the *same* stats key the Weather Eye tacklebox passive will set in Phase 3, so the two compose through `effectiveStats()` without special-casing either. |
| 6 | **Shipyard** (Support Skiffs) | production | `boatTier ≥ 3` | 4 (one skiff built per level) | 5000 × 3.5^(index-1) | Each built skiff is a small automated producer, freely reassignable to *any already-unlocked* region (unlike hired crew, which are locked to their hire's region affinity) at a fixed slow interval (90s) and `skiffYieldMult = 0.5` — deliberately weaker than a leveled crew hire, so it reads as "extra idle throughput," not a crew replacement. Independent of `crewSlots`. |
| 7 | **Lighthouse** | ambient | `coin ≥ 6000` | 3 | 4000 × 2.6^(L-1) | `junkReduction += 0.03L` (stacks with Hook's junk reduction) and `biteRateMult += 0.03L`. Flat, not time-conditional, to stay inside the flat-stat-fold seam — the "guides fish home at dusk" framing is flavor text on top of a flat bonus. |

## Offline Resolution — closed-form specifics

**Market Stall.** Uses the cooler value *snapshot at the start of the offline window* (crew production during the window is settled directly to Coin already, per the existing `resolveOfflineProgress`, so it never re-enters the cooler mid-window — no double-counting risk):
```
hours = elapsedMs / 3_600_000
soldFraction = 1 - exp(-drainRatePerHour(level) * hours)
soldValue = coolerValueAtWindowStart * soldFraction * sellMult(level)
```
Remove `soldFraction × cooler.length` entries oldest-first, refund their summed value as Coin. Never exceeds cooler value at the start — bounded by construction.

**Smokehouse.** Reuses the crew loop's aggregate numbers rather than re-simulating catches:
```
numBatches = floor(elapsedMs / batchTimeMs(level))
throughputCap = numBatches * batchSize(level)
processed = min(throughputCap, crewCatchTotals.totalCatches)
avgValuePerCatch = crewCatchTotals.totalRawValue / crewCatchTotals.totalCatches   // 0 guarded
bonusCoin = processed * avgValuePerCatch * (smokeValueMult(level) - 1)
```
This is additive on top of the crew coin already earned — it never touches the cooler in the offline path (only its online tick does), keeping the math a single closed-form expression.

**Shipyard.** Identical shape to the existing crew loop, one skiff at a time, reusing the exported `expectedCatchValueForRegion`:
```
for each skiff assigned to region R:
  catches = elapsedMs / skiffIntervalMs
  coin = catches * expectedCatchValueForRegion(R, { marketMult: stats.marketPriceMult }) * skiffYieldMult
```
Unassigned skiffs contribute zero, not an error.

**Dock Expansion, Aquarium, Chart Room, Lighthouse** need no offline resolver at all — they're static stat contributions already live through `effectiveStats()`, exactly like gear ranks.

## Save Schema & Prestige

`GameState` gains:
```js
buildings: {
  market_stall: { level },
  smokehouse: { level, queue: [{ startedAt, entries: [] }] },
  dock_expansion: { level },
  aquarium: { level, sockets: [speciesId | null, ...] },
  chart_room: { level },
  shipyard: { skiffs: [{ region }] },
  lighthouse: { level },
}
```
`core/save.js` gets a migration entry defaulting `state.buildings` to all-zero/empty on upgrade from any pre-buildings save. `systems/prestige.js`'s reset explicitly does **not** include `buildings` in its cleared-keys list — call this out with a comment at the reset site, since every other major system (gear, crew, cooler, region unlocks, objectives) *does* reset there, and buildings being the one exception is easy to miss on a careless refactor. Shipyard skiffs' `region` field should be validated against the post-reset unlocked-region set on the first tick after a prestige (regions reset, so a skiff pointed at a now-locked region falls back to unassigned rather than silently producing for a region the player can't currently sail to).

---

### Critical Files for Implementation
- `src/data/buildings.js` (new)
- `src/systems/buildings.js` (new)
- `src/ui/townui.js` (new)
- `src/core/offline.js` (extend: export `expectedCatchValueForRegion`, accumulate crew totals, call `resolveBuildingsOffline`)
- `src/systems/stats.js` (extend `effectiveStats()` with the buildings fold loop)
- `src/systems/prestige.js` (exclude `buildings` from reset, once Phase 6 exists)
- `src/core/save.js` (schema version bump + migration)
