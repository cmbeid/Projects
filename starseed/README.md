# Starseed

An idle game about a self-replicating space probe. You start with one probe
chewing on one asteroid, and you are meant to end up disassembling a galaxy.

Mine ore by hand, build probes that mine it for you, refine it into alloy, grow
alloy into compute — and spend the compute buying your own way out of ever
touching the game again.

**Playable, and unfinished.** Three eras, 13 producers, 31 upgrades, the full
automation ladder and the first prestige layer are in. The narrative log,
offline progress and the second prestige layer are not yet — see
[`PLAN.md`](PLAN.md) for the design and what is left.

## Running it

All commands run from this directory (`starseed/`), not the repository root.

```bash
npm install
npm run dev          # dev server
```

```bash
npm run build
npm run preview      # the built game, at http://localhost:4173/
```

## Playing

Tap **Mine** until you can afford a Probe, then stop tapping and let it work.
Each era consumes the one before it, so ore never stops mattering.

| Panel | What it holds |
| --- | --- |
| **Swarm** | Everything you can build. `×1 / ×10 / Max` sets how much a tap buys. |
| **Tech** | Upgrades, then the automation ladder. |
| **Log** | Milestones reached, and run statistics. |
| **Relaunch** | Appears once prestige is in reach. The payout, the loadout, the tree. |

Each building card shows **what the next purchase would add**, priced at
whatever the buy mode is set to — not what the stack already produces, which is
on the quieter line beneath it. The figure is a difference in the swarm's total
rates, so it accounts for the feedstock a converter will draw and for the
thermal load the purchase puts on everything else. When the swarm runs hot,
that number can be smaller than the new unit's own output, or negative.

The rail across the top shows what you have, what it holds, and how fast it is
moving. A resource that goes amber is **full** — production above the cap is
discarded, so buy a depot.

**Thermal load** is a soft cap. Past the threshold, everything runs at a
fraction of its rate. It is diminishing, never negative: overbuilding is
inefficient, not a trap.

## Relaunching

Once a run has produced enough, **Relaunch** fires a seed probe at a fresh
system. It destroys the swarm, everything it built and everything it learned,
and pays **Schematics** — which buy permanent upgrades that make every run after
it faster.

The payout is `floor((run value / 1e7) ^ 0.5)`. Run value counts everything the
run produced, weighted by what it cost to make: alloy is worth 150 ore and
compute 6,000, so refining and thinking pay better than digging. The square root
means a run ten times as long pays only about three times as much — a short
deliberate run is a strategy, not a mistake.

Each Relaunch also picks **3 directives** from a pool that grows as you keep
relaunching. They are strong, they all cost something, and only one per family
can be taken — so a loadout is three commitments, and each run plays
differently. Fewer than three is a legal choice.

Progress saves to the browser automatically and survives closing the tab.

## Layout of the code

```
src/num/      decimal.ts — mantissa/exponent big number; format.ts — how it reads
src/data/     content as typed tables in packs/, plus validate.ts
src/game/     engine.ts, rates.ts, purchase.ts, unlocks.ts, automation.ts,
              prestige.ts — all pure
src/state/    store.ts, versioned localStorage persistence, types
src/ui/       layout, resource rail, swarm, tech, log, prestige, modal, ticker, toast
scripts/      validate-data.ts (content gate), verify-ui.ts (Playwright)
tests/        decimal / engine / purchase / persistence / data / prestige
```

Three decisions explain most of the code:

**One `advance(state, seconds)`.** The simulation runs on a fixed 10 Hz timestep
with an accumulator, so `advance(s, 10)` produces *exactly* the same state as a
hundred calls of `advance(s, 0.1)` — not merely a close one. It never reads a
clock; `seconds` is a parameter. That is what will let offline catch-up reuse the
live code path rather than being a second calculation that can drift out of
agreement with it, and it is why the engine tests need no DOM and no fake timers.

**A custom `Decimal`.** Doubles stop at ~1.8e308 and two prestige layers stack
multipliers past it. Building the type up front costs ~250 lines; retrofitting it
later would touch every arithmetic site in the codebase.

**Formatting is stable to three significant figures, deliberately.** The render
loop decides whether to touch the DOM by comparing a value's formatted string to
the last one written, so a number climbing exponentially still only changes its
rendered form a few times a second. Widening that precision would quietly turn
the optimisation off.

## Checks

```bash
npm run typecheck    # the strict tsconfig is this repo's only static gate
npm test             # vitest
npm run validate     # content gate — broken references, unreachable unlocks
npm run verify       # Playwright, against a running `npm run preview`
```

`npm run verify` writes `screenshots/` at both breakpoints, and drives the whole
Relaunch flow — payout, the picker's family exclusion, the reset, the tree it
opens — because that is the one screen in the game that destroys progress. If the sandbox's
Chromium does not match the build Playwright pins, point at the existing one:

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium npm run verify
```

## Screens

The layout has two shapes and switches between them live, which matters on a
foldable — folding and unfolding resizes the viewport without reloading.

- **Under 700px**: the resource rail pins to the top, one panel shows at a time,
  and a tab bar switches between them.
- **700px and up**: Swarm, Tech and Log sit side by side and the tabs go away.
