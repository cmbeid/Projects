import { GEAR_BASE } from '../data/gear';
import { MATERIAL } from '../data/materials';
import { MACHINES, SKILLS, UPGRADES } from '../data/progression';
import { CRAFT, REFINE } from '../data/recipes';
import type { CraftRecipe, Goal } from '../data/types';
import type { CoreStat, GameState } from '../state/types';
import { batchesAffordable, canCraft, craft, furnaceSlots, hasInputs, meetsRequirement, queueRefine } from './crafting';
import { derive } from './derive';
import { buyMachine, buyUpgrade, machineCost, sellAllOre, upgradeCost } from './economy';
import { tick } from './engine';
import { hasFeature } from './features';
import { activeStory, claimContract, claimStory, progress, refreshContracts } from './missions';
import { blockHp, setDepth, tap } from './mining';
import { BIOMES, biomeAt } from '../data/biomes';
import { buyEcho, descend, echoGain } from './prestige';
import { canRankPassive, rankPassive, skillReady, spendStat, useConsumable, useSkill } from './rpg';

/**
 * A simple player. It taps at a steady human pace, spends greedily, crafts
 * the best gear it can reach, and Descends once it stalls. It is not good —
 * it is meant to be *ordinary*, so that if it can reach a milestone in a
 * given time, a person can too. `tests/bot.test.ts` holds it to that.
 */
export interface BotOptions {
  tapsPerSecond: number;
  /** Descend after the frontier has not moved for this long. */
  stallSeconds: number;
  minEchoes: number;
}

export const DEFAULT_BOT: BotOptions = { tapsPerSecond: 4, stallSeconds: 600, minEchoes: 8 };

const STAT_ORDER: CoreStat[] = ['str', 'str', 'dex', 'str', 'lck', 'end'];
const PASSIVE_ORDER = ['heavy', 'oiled', 'geologist', 'keen', 'tinker', 'assayer', 'lucky', 'brutal', 'scholar', 'seambreaker', 'nightshift', 'overclock'];
const ECHO_ORDER = ['resonance', 'ghosts', 'ledger', 'memory', 'study', 'purse', 'omen', 'embers', 'hum', 'longnight'];

interface BotMemory {
  stallTimer: number;
  lastMax: number;
  statCursor: number;
}

/** The workbench recipes the bot is working toward: anything that beats what it wears, and every fixture. */
function targets(s: GameState): CraftRecipe[] {
  const out: CraftRecipe[] = [];
  for (const r of CRAFT) {
    if (!meetsRequirement(s, r.requires)) continue;
    if (r.output.kind === 'fixture') {
      if (!s.fixtures.includes(r.output.id)) out.push(r);
    } else if (r.output.kind === 'gear') {
      const base = GEAR_BASE.get(r.output.base)!;
      const worn = s.gear.find((g) => g.uid === s.equipped[base.slot]);
      const wornTier = worn ? GEAR_BASE.get(worn.base)!.tier : 0;
      if (base.tier > wornTier) out.push(r);
    } else if (r.output.id === 'dynamite' && (s.consumables.dynamite ?? 0) < 3) {
      out.push(r);
    }
  }
  return out;
}

/**
 * The ore the story is waiting on, if any: either mined directly, or the
 * ore behind the bars a story craft needs.
 */
function oreWanted(s: GameState, goal: Goal): string | null {
  if (goal.kind === 'mine') return goal.ore;
  if (goal.kind !== 'craft' || !goal.recipe) return null;
  const r = CRAFT.find((c) => c.id === goal.recipe);
  if (!r) return null;
  for (const x of r.inputs) {
    if ((s.inventory[x.id] ?? 0) >= x.n) continue;
    const mat = MATERIAL.get(x.id);
    if (mat?.kind === 'ore') return x.id;
    const smelt = REFINE.find((q) => q.output === x.id);
    const short = smelt?.inputs.find((y) => (s.inventory[y.id] ?? 0) < y.n * (x.n - (s.inventory[x.id] ?? 0)));
    if (short) return short.id;
  }
  return null;
}

function plan(s: GameState, mem: BotMemory, opts: BotOptions): void {
  if (activeStory(s) && progress(s, activeStory(s)!.goal, s.story.base).done) claimStory(s);
  for (const c of s.contracts.list) claimContract(s, c.id);

  while (s.statPoints > 0 && hasFeature(s, 'miner')) {
    spendStat(s, STAT_ORDER[mem.statCursor++ % STAT_ORDER.length]!);
  }
  for (const id of PASSIVE_ORDER) while (canRankPassive(s, id)) rankPassive(s, id);

  // Crafting comes before shopping: gear is the big multiplier.
  const goals = targets(s);
  for (const r of goals) if (canCraft(s, r)) craft(s, r.id);

  // Keep the furnaces busy on the bars the next pieces need.
  if (hasFeature(s, 'refinery')) {
    const wanted = new Map<string, number>();
    for (const r of targets(s)) {
      for (const x of r.inputs) {
        if (MATERIAL.get(x.id)?.kind !== 'bar') continue;
        const short = x.n - (s.inventory[x.id] ?? 0);
        if (short > 0) wanted.set(x.id, Math.max(wanted.get(x.id) ?? 0, short));
      }
    }
    const slots = furnaceSlots(s);
    for (let i = 0; i < slots; i++) {
      const f = s.furnace[i]!;
      if (f.queued > 0) continue;
      for (const [bar, n] of wanted) {
        const recipe = REFINE.find((r) => r.output === bar && meetsRequirement(s, r.requires));
        if (!recipe || s.furnace.some((x) => x.recipe === recipe.id && x.queued > 0)) continue;
        if (batchesAffordable(s, recipe) < 1) continue;
        queueRefine(s, i, recipe.id, Math.min(n, batchesAffordable(s, recipe)));
        break;
      }
    }
  }

  // Sell ore, but keep enough back for the furnace.
  sellAllOre(s, hasFeature(s, 'refinery') ? 60 : 0);
  // Gems not needed by any target are just money.
  const neededGems = new Set(goals.flatMap((r) => r.inputs.map((x) => x.id)));
  for (const [id, n] of Object.entries(s.inventory)) {
    const mat = MATERIAL.get(id);
    if (mat && (mat.kind === 'gem') && !neededGems.has(id) && n > 4) {
      s.inventory[id] = 4;
      s.coins += (n - 4) * mat.value * derive(s).sellMult;
      s.counters.earned += (n - 4) * mat.value * derive(s).sellMult;
    }
  }

  // Keep back coin for a craft that only lacks coin.
  // Only for crafts within reach, or it would never buy anything else.
  const reserve = Math.max(
    0,
    ...goals.filter((r) => r.coins <= s.coins * 2 && hasInputs(s, r.inputs)).map((r) => r.coins),
  );
  const factor: Record<string, number> = { sharpen: 1, cart: 1.6, haggle: 1.6, tuning: 1.2, bellows: 4, grip: 3 };
  for (let guard = 0; guard < 200; guard++) {
    let best: { cost: number; buy: () => boolean } | null = null;
    for (const u of UPGRADES) {
      if (!hasFeature(s, 'upgrades') || (u.requires && !hasFeature(s, u.requires))) continue;
      const cost = upgradeCost(u.id, s.upgrades[u.id] ?? 0);
      const score = cost * (factor[u.id] ?? 2);
      if (!best || score < best.cost) best = { cost: score, buy: () => buyUpgrade(s, u.id) };
    }
    for (const m of MACHINES) {
      if (!hasFeature(s, m.requires)) continue;
      const cost = machineCost(m.id, s.machines[m.id] ?? 0);
      // Cost per damage, normalised against a drone.
      const score = (cost / m.dps) * 0.6;
      if (!best || score < best.cost) best = { cost: score, buy: () => buyMachine(s, m.id) };
    }
    if (!best || s.coins <= reserve || !best.buy() || s.coins < reserve) break;
  }

  // Skills: spam them.
  for (const k of SKILLS) if (skillReady(s, k.id)) useSkill(s, k.id);
  if (s.block.seam && (s.consumables.dynamite ?? 0) > 0) useConsumable(s, 'dynamite');

  // A mission wanting an ore from a shallower biome sends it back up to farm.
  const story = activeStory(s);
  const ore = story && !progress(s, story.goal, s.story.base).done ? oreWanted(s, story.goal) : null;
  if (ore) {
    const home = BIOMES.find((b) => b.ores.some((o) => o.id === ore));
    if (home && biomeAt(s.depth) !== home && s.maxDepth >= home.from) {
      const next = BIOMES[BIOMES.indexOf(home) + 1];
      s.autoAdvance = false;
      setDepth(s, Math.min(s.maxDepth, next ? next.from - 1 : s.maxDepth));
      return;
    }
    if (home && biomeAt(s.depth) === home) return;
  }

  // Depth: push on while a seam falls in reasonable time, otherwise farm.
  const d = derive(s);
  const dps = d.tap * opts.tapsPerSecond + d.autoDps;
  const seamTime = (blockHp(s.depth, true) / d.seamMult) / Math.max(1e-9, dps);
  if (s.autoAdvance && seamTime > 60 && s.depth === s.maxDepth) s.autoAdvance = false;
  else if (!s.autoAdvance && seamTime < 25) s.autoAdvance = true;
  if (s.depth < s.maxDepth && s.autoAdvance) setDepth(s, s.maxDepth);

  if (s.maxDepth > mem.lastMax) {
    mem.lastMax = s.maxDepth;
    mem.stallTimer = 0;
  }
  if (hasFeature(s, 'descent') && mem.stallTimer > opts.stallSeconds && echoGain(s) >= opts.minEchoes) {
    descend(s);
    mem.lastMax = s.maxDepth;
    mem.stallTimer = 0;
    for (let guard = 0; guard < 500; guard++) {
      let bought = false;
      for (const id of ECHO_ORDER) if (buyEcho(s, id)) bought = true;
      if (!bought) break;
    }
  }
}

export interface BotRun {
  state: GameState;
  log: string[];
}

/**
 * Plays `seconds` of game time. Decisions every second, the world in tenths.
 */
export function runBot(s: GameState, seconds: number, opts: BotOptions = DEFAULT_BOT, now = 0): BotRun {
  const mem: BotMemory = { stallTimer: 0, lastMax: s.maxDepth, statCursor: 0 };
  const log: string[] = [];
  const dt = 0.1;
  let tapCarry = 0;
  let lastStory = s.story.index;
  let lastDescents = s.counters.descents;
  for (let t = 0; t < seconds; t += 1) {
    refreshContracts(s, now + t * 1000);
    plan(s, mem, opts);
    for (let k = 0; k < 10; k++) {
      tapCarry += opts.tapsPerSecond * dt;
      while (tapCarry >= 1) {
        tapCarry -= 1;
        tap(s);
      }
      tick(s, dt);
    }
    mem.stallTimer += 1;
    for (const m of [10, 21, 30, 51, 91, 141]) {
      if (s.deepestEver >= m && !log.some((l) => l.includes(`reached ${m} `))) log.push(`${(t / 60).toFixed(1)}m reached ${m} lvl ${s.level}`);
    }
    if (s.story.index !== lastStory) {
      lastStory = s.story.index;
      log.push(`${(t / 60).toFixed(1)}m story ${s.story.index} depth ${s.maxDepth} lvl ${s.level}`);
    }
    if (s.counters.descents !== lastDescents) {
      lastDescents = s.counters.descents;
      log.push(`${(t / 60).toFixed(1)}m DESCENT echoes ${s.echoesEarned}`);
    }
  }
  return { state: s, log };
}
