# Von Neumann — plan

An idle/incremental game about a self-replicating space probe. You start with
one probe chewing on one asteroid and end up disassembling a galaxy.

Nothing is built yet. This document is the design and the build order.

## Why this game

"Build more of yourself" is the purest expression of the idle fantasy, and the
theme earns its exponential curve rather than apologising for it — in a Von
Neumann swarm, the runaway growth *is* the story.

Target shape:

- **15–25 hours** to the ending, two prestige layers, ~80 upgrades.
- Four pillars, all load-bearing: **meaningful choices** (loadouts that make each
  run play differently), **automation as the puzzle** (a ladder of "stop doing
  this by hand"), **narrative drip** (log fragments at milestones), and **real
  offline progress** (rate integration on return, capped, with a welcome-back
  summary).

## Stack

Mirrors [`../alchemy-forge/`](../alchemy-forge/) so the repo stays legible:
vanilla TypeScript + DOM, **zero runtime dependencies**, Vite 7 +
`vite-plugin-pwa`, vitest in a node environment, `tsx` for scripts, Playwright
for a manual UI check, and the same very strict `tsconfig.json`
(`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`).
Phone-first, installable, plays offline.

## 1. Layout

```
von-neumann/
├── package.json          dev/build/preview/test/test:watch/typecheck/
│                         validate/icons/verify — same names as alchemy-forge
├── tsconfig.json         copied verbatim
├── vite.config.ts        base:'./', VitePWA manifest, vitest node env
├── index.html
├── public/icons/
├── src/
│   ├── main.ts               boot: load save, offline catch-up, start loop
│   ├── num/
│   │   ├── decimal.ts        mantissa/exponent big number (§3)
│   │   └── format.ts         Decimal -> "12.4 M" / "1.24e21"
│   ├── data/
│   │   ├── types.ts          Building, Upgrade, Milestone, Directive, LogEntry
│   │   ├── validate.ts       pure integrity + reachability checks
│   │   ├── index.ts          assembles + freezes all packs
│   │   ├── indexes.ts        id -> entity maps, produces/consumes lookups
│   │   └── packs/
│   │       ├── 00-resources.ts    the resource ladder
│   │       ├── 01-buildings.ts    ~22 producers across 5 eras
│   │       ├── 02-upgrades.ts     ~80 upgrades, tagged by era + effect kind
│   │       ├── 03-automation.ts   the automator ladder
│   │       ├── 04-milestones.ts   thresholds -> unlocks + log triggers
│   │       ├── 05-directives.ts   the per-run loadout pool
│   │       ├── 06-prestige.ts     both layers' perk trees
│   │       └── 07-log.ts          narrative fragments
│   ├── game/
│   │   ├── rates.ts          the production pipeline (§4) — memoised
│   │   ├── engine.ts         advance(state, seconds): pure, deterministic
│   │   ├── purchase.ts       cost curves, bulk buy, max-affordable (§5)
│   │   ├── unlocks.ts        milestone/unlock evaluation
│   │   ├── prestige.ts       both layers' reset + currency formulas (§6)
│   │   ├── offline.ts        catch-up scheduling + summary (§7)
│   │   └── rng.ts            mulberry32, seed lives in state
│   ├── state/
│   │   ├── types.ts          GameState
│   │   ├── persistence.ts    versioned localStorage, defensive load
│   │   └── store.ts          subscribe/notify + debounced save
│   ├── ui/
│   │   ├── layout.ts         responsive shell, 700px switch
│   │   ├── resources.ts      the always-visible resource rail
│   │   ├── swarm.ts          building list + buy controls
│   │   ├── tech.ts           upgrade grid
│   │   ├── log.ts            narrative feed
│   │   ├── prestige.ts       both layers' screens + directive picker
│   │   ├── modal.ts          welcome-back, confirmations, details
│   │   ├── ticker.ts         rAF loop + dirty-string diffing (§8)
│   │   └── toast.ts
│   └── styles/               base / rail / swarm / tech / prestige .css
├── scripts/
│   ├── validate-data.ts      content gate, exits non-zero (CI runs it)
│   ├── simulate.ts           headless balance sim, prints the phase table (§9)
│   ├── make-icons.ts
│   └── verify-ui.ts          Playwright screenshots at both breakpoints
└── tests/
    ├── decimal.test.ts  engine.test.ts  purchase.test.ts
    ├── offline.test.ts  persistence.test.ts  balance.test.ts  data.test.ts
```

Modules stay in alchemy-forge's range (100–430 lines). If `engine.ts` outgrows
that, the pipeline stages want splitting, not a bigger file.

## 2. The simulation core

Everything hinges on one function:

```ts
// src/game/engine.ts
export interface TickReport {
  produced: Map<ResourceId, Decimal>;
  milestonesCrossed: MilestoneId[];
  logUnlocked: LogEntryId[];
  capped: ResourceId[];
}

/** Advances the world by `seconds`. Pure, deterministic, DOM-free. */
export function advance(state: GameState, seconds: number): TickReport;
```

Three properties make this shape worth insisting on:

- **It never reads the clock.** `seconds` is a parameter. `Date.now()` appears in
  exactly two places in the whole codebase — the rAF loop and the offline delta
  — and never inside game logic. That is what makes the engine unit-testable in
  vitest's node environment with no DOM and no fake timers.
- **Live play and offline catch-up call the same code path.** There is no
  separate "offline formula" that can drift out of agreement with real play.
  Offline progress is trustworthy because it is not a different calculation, it
  is the same one run faster.
- **Randomness goes through `rng.ts`** (mulberry32, seed persisted in state), so
  a test can replay an exact sequence.

**Stepping.** `advance` integrates production over the interval, but unlocks and
milestones are discrete events, so it sub-steps. The *caller* picks the schedule:

- Live: `requestAnimationFrame`, `dt` clamped to ≤ 0.25 s — a backgrounded tab
  must not deliver a 30-second frame — fed straight in.
- Offline: chunk elapsed time into `N = clamp(seconds / 1, 1, 20_000)` steps, so
  worst-case catch-up cost is bounded however long the player was away. Coarser
  steps under-credit slightly rather than over-credit, which is the right
  direction to err.

**Rates are not recomputed per tick.** `computeRates(state)` is memoised behind a
`ratesDirty` flag set only by purchases, unlocks and prestige; a tick just
multiplies cached rates by `dt`. This is the most important performance decision
in the project: without it, 60 Hz × ~22 buildings × Decimal math is pure waste
for a value that changes a few times a minute.

## 3. Numbers: build a minimal `Decimal`

**Recommendation: implement it; don't rely on doubles.**

Doubles top out at ~1.8e308. For a single-layer game that is plenty. It is not
plenty here. With two prestige layers the late-game multiplier *stack* is the
problem, not the resource total: layer-2 multipliers multiply layer-1
multipliers, which multiply per-building multipliers, which multiply an already
exponential building count. Games of this shape cross e308 within hours.
Designing to stay under the ceiling is possible, but it silently couples every
future balance decision to a hard wall, and hitting that wall in phase 7 means
re-plumbing every arithmetic site in the codebase.

The cost is ~250 lines and one test file, and the number formatter needed anyway
falls out of it for free.

```ts
// src/num/decimal.ts — value is m * 10^e, with 1 <= |m| < 10
export class Decimal {
  readonly m: number;
  readonly e: number;
  static from(n: number | string | Decimal): Decimal;
  add(o: Decimal): Decimal;   // aligns exponents; returns the larger when the
                              // gap exceeds 17 (the other is below epsilon)
  sub(o: Decimal): Decimal;
  mul(o: Decimal): Decimal;   // m*m, e+e, renormalise
  div(o: Decimal): Decimal;
  pow(n: number): Decimal;    // via log10, not repeated multiplication
  log10(): number;            // e + Math.log10(m)
  cmp(o: Decimal): -1 | 0 | 1;
  gte(o: Decimal): boolean;
  toNumber(): number;         // Infinity above e308; callers must not rely on it
}
```

Immutable — every op returns a new instance — which keeps it trivially correct
and lets tests compare by value. Zero dependencies, per repo convention.

`src/num/format.ts` renders by magnitude: plain below 1e3, one decimal with a
suffix (K/M/B/T, then the illion ladder) to ~1e33, scientific (`1.24e57`) above.
**Formatting is stable to 3–4 significant figures**, which §8 depends on.

## 4. The production pipeline

One documented function, one explicit order of operations. Balance stays
predictable only if there is exactly one place where composition happens.

```
perBuilding = count
            * baseRate
            * (1 + Σ additive[building])     // upgrade tiers, flat %
            * Π multiplicative[building]     // per-building multipliers

rate(res)   = Σ perBuilding over producers of res
            * Π globalMultipliers[res]       // tech, milestone rewards
            * prestigeMult(layer1)           // Schematics tree
            * prestigeMult(layer2)           // Insight tree
            * softCapPenalty(state, res)     // §4.1
```

The order is load-bearing. Additive bonuses pool *within* a building before
anything multiplies, so "+25% ore per probe" upgrades stack linearly with each
other and multiplicatively with everything else. Reversing this makes late-game
additive upgrades worthless, and is the classic way an idle game's balance
quietly dies.

### 4.1 Storage and soft caps

Two distinct behaviours, both needed:

- **Hard-capped resources** (Ore, Alloy — the spendables) clamp at their cap, and
  the tick reports them in `TickReport.capped` so the UI can show a full state.
  Overflow is discarded. That is what creates pressure to buy storage and gives
  a real reason to come back to the game.
- **Thermal load** is a soft cap: past the threshold, `softCapPenalty` applies
  `(threshold / current) ^ 0.5`, degrading rather than stopping. This is the knob
  that stops "more probes" being the automatic answer, and gives the
  efficiency-flavoured directives something to be better at.

## 5. Costs, bulk buying, and the phase budget

`cost(n) = base * growth^n` for the nth unit, `growth` between 1.07 (early,
common) and 1.15 (late, rare). Geometric growth against roughly exponential
income is what produces the genre's "each tier takes about as long as the last"
feel.

Both bulk-buy formulas in closed form — at late-game counts a loop is a frame
hitch:

```
buy k units, currently owning n:
  S(n,k) = base * growth^n * (growth^k - 1) / (growth - 1)

max affordable with budget R:
  k = floor( log( 1 + R*(growth-1) / (base*growth^n) ) / log(growth) )
```

Both live in `src/game/purchase.ts` and go through `Decimal.log10` so they stay
exact past e308. Buy controls are **×1 / ×10 / max**, a persisted preference.

Resource ladder — five eras, each gating the next:

| Era | Resource | Unlocked by |
| --- | --- | --- |
| 1 Regolith | Ore | start |
| 2 Refining | Alloy | 1e4 Ore |
| 3 Swarm | Compute | first automator |
| 4 Stellar | Energy | Dyson milestone |
| 5 Galactic | Exotic Matter | prestige layer 2 |

Phase budget — the target the balance sim in §9 asserts against:

| Phase | Wall-clock | Beat |
| --- | --- | --- |
| 1 | 0–20 min | manual mining; first probe; first automator |
| 2 | 20 min – 2 h | production chains; Ore → Alloy |
| 3 | 2 – 5 h | first **Relaunch** (prestige 1) |
| 4 | 5 – 12 h | Schematics tree; runs get fast; directives start to matter |
| 5 | 12 – 18 h | first **Convergence** (prestige 2) |
| 6 | 18 – 25 h | Insight endgame and the ending |

## 6. The two prestige layers

**Layer 1 — Relaunch.** You fire a seed probe at a fresh system.

- *Resets:* resources, buildings, run upgrades, automators.
- *Persists:* Schematics and its tree, log entries, statistics, settings.
- *Currency:* `schematics = floor( (lifetimeOre / 1e12) ^ 0.5 )`. The square root
  stops a 10× longer run being 10× more rewarding, which is what makes short
  deliberate runs a viable strategy instead of a mistake.

**Layer 2 — Convergence.** The swarm reaches consensus and merges.

- *Resets:* everything layer 1 resets, **plus** Schematics and its tree.
- *Persists:* Insight and its tree, the log, statistics.
- *Currency:* `insight = floor( (totalSchematicsEverEarned / 5e3) ^ 0.6 )`.

### Meaningful choices: a limited-slot directive loadout

At each Relaunch the player picks **3 directives** from a pool that grows from 6
to ~20 as they are unlocked. Directives are strong and mutually exclusive by
family — you cannot take two Expansion directives — so a loadout is a real
commitment:

- *Rapid Fission* — probes replicate 3× faster, 50% worse thermal load.
- *Cold Logic* — no thermal penalty, half replication rate.
- *Salvage Doctrine* — start each run holding 10% of the previous run's Alloy.

Chosen over a branching point-budget tree because replayability scales
combinatorially with authored content rather than linearly; it is legible on a
phone in one screen; it creates no respec-regret UX; and each pick is a decision
the player revisits every run, which is exactly where the "each prestige plays
differently" pillar has to live. A branching tree makes the interesting choice
once, and then it is settled forever.

The Schematics and Insight trees stay conventional permanent-upgrade trees. They
are the ratchet; the directives are the variety.

## 7. Offline progress

- **Cap: 8 hours**, raised to 24 by an Insight perk — a genuinely desirable
  progression hook rather than an arbitrary limit.
- `state.lastSeen` (epoch ms) written on every save and on `pagehide`.
- Edge cases, all handled explicitly:
  - `delta < 0` (clock moved back, timezone change) → credit nothing, resync
    `lastSeen`, say nothing. Not an error.
  - `delta > cap` → credit the cap and **say so plainly** ("away 3 days; credited
    8 hours"). Silently capping reads as a bug.
  - `delta` under ~2 s → skip catch-up entirely, so a reload does not raise a
    modal.
- Catch-up runs the same `advance` as live play (§2), chunked per §2's schedule.
- **Welcome-back modal**: time away vs. time credited, resources gained per type,
  anything that hit its storage cap (with the nudge to buy storage), and any
  milestones or log fragments crossed while away.

## 8. UI

Phone-first, mirroring alchemy-forge's live 700px switch — it reshapes without
reloading, which matters on a foldable.

- **Under 700px** — resource rail pinned top, one panel at a time, bottom tab bar:
  *Swarm / Tech / Log / Prestige*.
- **700px and up** — resource rail down the left, Swarm and Tech side by side, Log
  as a right-hand column.

Render strategy — what keeps a number-heavy UI at 60fps with no framework:

1. Build DOM **once** per panel; hold a `Map<string, HTMLElement>` of value nodes.
2. Each rAF, format the value and **write `textContent` only if the string
   changed**. Because formatting is stable to 3–4 significant figures (§3), a
   value climbing exponentially still only changes its rendered string a few
   times a second. This one trick removes nearly all layout thrash and is far
   simpler than any diffing scheme.
3. Affordability state (button enabled/disabled, cost colouring) recomputes at
   **10 Hz**, not 60. Nobody can perceive the difference; it is 6× less work.
4. Structural change — a building unlocking — sets a dirty flag and rebuilds only
   that panel's subtree.

## 9. Tests and content gates

vitest, node environment, `include: ['tests/**/*.test.ts']`. Fixture-driven where
possible: alchemy-forge's `engine.test.ts` deliberately builds a tiny graph
rather than depending on shipped content, and that instinct applies here too —
balance tests that break every time a number is tuned get ignored.

| File | What it pins down |
| --- | --- |
| `decimal.test.ts` | arithmetic, comparison, `pow`/`log10` edges, formatting boundaries, values past e308 |
| `engine.test.ts` | **determinism**: `advance(s, 10)` matches 100 × `advance(s, 0.1)` within epsilon; pipeline order (§4); resources never go negative |
| `purchase.test.ts` | closed-form bulk sum matches a naive loop; max-affordable never overspends by one unit (the classic off-by-one) |
| `offline.test.ts` | cap enforcement, negative delta, absurd delta, sub-2s skip, summary contents |
| `persistence.test.ts` | round-trip, version migration, corrupt save → new game, unknown ids dropped |
| `balance.test.ts` | a greedy simulated player (buy-max every 5 s) hits each §5 phase inside its window; every milestone reachable; **no building strictly dominated** — never both costlier and slower than one available at the same time |
| `data.test.ts` | the same checks `validate-data.ts` runs |

`scripts/validate-data.ts` is the content gate and exits non-zero, so CI runs it
before tests exactly as alchemy-forge's workflow does: broken id references,
unreachable unlocks, non-monotonic cost curves, orphaned log entries, directives
with no family, upgrades naming unknown buildings.

`scripts/simulate.ts` is the balance tool — runs the headless sim and prints the
phase-timing table, so tuning is an evidence-based edit rather than a guess.

`scripts/verify-ui.ts` mirrors alchemy-forge's: Playwright against
`http://localhost:4173/`, screenshots at both breakpoints, committed for review.

## 10. Deployment wiring

1. **`.github/workflows/deploy-von-neumann.yml`** — copy
   `deploy-alchemy-forge.yml` and change the four things the root README names:
   the `paths:` filter, `S3_PREFIX`, `defaults.run.working-directory`, and the
   `concurrency.group`. Also the `environment.url`, `cache-dependency-path`, and
   the summary step's text.
2. **`.github/workflows/pages.yml`** — add `von-neumann` to the `paths:` filter and
   its install/validate/test/build steps, `cp -r von-neumann/dist/.
   _site/von-neumann/`, and a second `<a class="card">` in the landing-page
   heredoc inside the *Assemble the site* step. That heredoc is hand-maintained;
   it is the one place a new project is not automatic.
3. **Root `README.md`** — a row in the projects table, and a row in the deploying
   table for `http://s3.cmbeid.com/von-neumann/index.html`.

No `.gitignore` changes: the root one already covers `node_modules/` and `dist/`
at any depth.

## 11. Build order

Sequenced so something is playable at the end of phase 1 and every phase after
is additive.

| Phase | Deliverable |
| --- | --- |
| 1 | Scaffold (package.json, tsconfig, vite config, index.html), `Decimal` + format + their tests, `advance`, one resource, one building, save/load. **A playable numbers-go-up loop.** |
| 2 | Full building ladder and resource chain, upgrade system, unlock gating, the real responsive UI and render loop. |
| 3 | The automation ladder — each automator retiring a manual action. |
| 4 | Prestige layer 1: Relaunch, Schematics tree, the directive loadout picker. |
| 5 | Milestones and the narrative log; `validate-data.ts` grows to cover them. |
| 6 | Offline catch-up, welcome-back modal, PWA manifest and icons. |
| 7 | Prestige layer 2: Convergence, Insight tree, endgame and ending. `simulate.ts` and the balance pass against the §5 phase table. |
| 8 | Deploy wiring (§10), README, `verify-ui.ts` screenshots. |

## Verification

At every phase, from this directory:

```bash
npm run typecheck     # the strict tsconfig is this repo's only static gate
npm test              # vitest
npm run validate      # content gate; must exit 0
```

End to end, from phase 2 onward:

```bash
npm run dev           # play it — the loop either feels good or it does not
npm run build && npm run preview
npm run verify        # Playwright screenshots at both breakpoints
```

Balance, from phase 7:

```bash
npx tsx scripts/simulate.ts    # phase-timing table against the §5 targets
```

Offline progress is checked by backdating `lastSeen` in localStorage and
reloading: the summary should credit the right amount and cap honestly at 8
hours.

The PWA only fully verifies over HTTPS — service workers do not register on
plain HTTP — so installability is checked on the GitHub Pages deploy rather than
the S3 one, the same split alchemy-forge already documents.

## Open question

**§3, the `Decimal` type, is the one decision worth revisiting before phase 1.**
It is ~250 lines and a test file of pure infrastructure before the game starts.
The plan recommends building it, because two prestige layers reliably breach
e308 and retrofitting it later touches every arithmetic site. If shipping sooner
against a designed ceiling under 1e308 is preferable, decide that at phase 1 —
the choice is cheap now and expensive in phase 7.
