import { BUILDING, BUILDINGS } from '../data/buildings';
import { DISTRICTS, districtAt } from '../data/districts';
import { MATERIAL } from '../data/materials';
import { CHARTER, EDICTS, UPGRADES } from '../data/progression';
import { CRAFT, REFINE } from '../data/recipes';
import { REGALIA_BASE } from '../data/regalia';
import type { BuildingDef, CraftRecipe, Goal } from '../data/types';
import type { CoreStat, GameState } from '../state/types';
import { ruinHp, setWard, tap } from './clearing';
import { derive } from './derive';
import {
  buildingAllowed, buyUpgrade, canAffordPlace, hasInputs, headroom, levelCost, place, rebuildFromPlan, sellAllSalvage,
  upgradeCost, upgradeType,
} from './economy';
import { tick } from './engine';
import { hasFeature } from './features';
import { canRankPassive, edictReady, rankPassive, spendStat, useConsumable, useEdict } from './founder';
import { freeSpots, openDistricts, previewPlacement, typeCount } from './grid';
import { activeStory, claimPetition, claimStory, progress, refreshPetitions, storyIndex } from './missions';
import { meetsRequirement } from './requirements';
import { buyCharter, letTideIn, memoryGain } from './tide';
import { batchesAffordable, canCraft, craft, queueRefine, workshopSlots } from './workshops';

/**
 * A simple player. It taps at a steady human pace, spends greedily, puts
 * each new building on the best tile it can see, crafts the best regalia it
 * can reach, and lets the Tide in once it stalls. It is not good — it is
 * meant to be *ordinary*, so that if it can reach a milestone in a given
 * time, a person can too. `tests/bot.test.ts` holds it to that.
 */
export interface BotOptions {
  tapsPerSecond: number;
  /** Let the Tide in after the frontier has not moved for this long. */
  stallSeconds: number;
  minMemories: number;
}

export const DEFAULT_BOT: BotOptions = { tapsPerSecond: 4, stallSeconds: 600, minMemories: 8 };

const STAT_ORDER: CoreStat[] = ['craft', 'craft', 'vision', 'craft', 'charm', 'grit'];
const PASSIVE_ORDER = ['brawn', 'gaffer', 'scavenger', 'eye', 'kilnwise', 'broker', 'lucky', 'wrecker', 'scholar', 'architect', 'landmarks', 'nightwatch'];
const CHARTER_ORDER = ['hands', 'crews', 'tithe', 'maps', 'lore', 'purse', 'omens', 'trades', 'hum', 'patience'];

interface BotMemory {
  stallTimer: number;
  lastMax: number;
  statCursor: number;
}

/** The Drafting Hall recipes the bot is working toward: anything that beats what it wears, and every fixture. */
function targets(s: GameState): CraftRecipe[] {
  const out: CraftRecipe[] = [];
  for (const r of CRAFT) {
    if (!meetsRequirement(s, r.requires)) continue;
    if (r.output.kind === 'fixture') {
      if (!s.fixtures.includes(r.output.id)) out.push(r);
    } else if (r.output.kind === 'regalia') {
      const base = REGALIA_BASE.get(r.output.base)!;
      const worn = s.regalia.find((g) => g.uid === s.equipped[base.slot]);
      const wornTier = worn ? REGALIA_BASE.get(worn.base)!.tier : 0;
      if (base.tier > wornTier) out.push(r);
    } else if (r.output.id === 'charge' && (s.consumables.charge ?? 0) < 3) {
      out.push(r);
    }
  }
  return out;
}

/** The building types the bot would like one more of, with how many goods each needs. */
function wantedBuildings(s: GameState): BuildingDef[] {
  return BUILDINGS.filter((b) => buildingAllowed(s, b) && b.inputs.length > 0);
}

/** Goods short for the Drafting Hall targets and the next of each building, with how many are wanted. */
function goodsWanted(s: GameState, goal: Goal | null): Map<string, number> {
  const wanted = new Map<string, number>();
  const want = (id: string, n: number): void => {
    if (MATERIAL.get(id)?.kind !== 'good') return;
    const short = n - (s.inventory[id] ?? 0);
    if (short > 0) wanted.set(id, Math.max(wanted.get(id) ?? 0, short));
  };
  if (goal?.kind === 'refine') want(goal.good ?? 'planks', (s.inventory[goal.good ?? 'planks'] ?? 0) + goal.n);
  for (const r of targets(s)) for (const x of r.inputs) want(x.id, x.n);
  for (const b of wantedBuildings(s)) for (const x of b.inputs) want(x.id, x.n * 2);
  return wanted;
}

/**
 * The salvage the story is waiting on, if any: either salvaged directly, or
 * the salvage behind the goods a story craft needs.
 */
function salvageWanted(s: GameState, goal: Goal): string | null {
  if (goal.kind === 'salvage') return goal.id;
  let inputs: readonly { id: string; n: number }[] = [];
  if (goal.kind === 'craft' && goal.recipe) inputs = CRAFT.find((c) => c.id === goal.recipe)?.inputs ?? [];
  else if (goal.kind === 'build' && typeCount(s, goal.id) === 0) inputs = BUILDING.get(goal.id)?.inputs ?? [];
  else if (goal.kind === 'fixture') inputs = CRAFT.find((c) => c.output.kind === 'fixture' && c.output.id === goal.id)?.inputs ?? [];
  for (const x of inputs) {
    if ((s.inventory[x.id] ?? 0) >= x.n) continue;
    const mat = MATERIAL.get(x.id);
    if (mat?.kind === 'salvage') return x.id;
    const make = REFINE.find((q) => q.output === x.id);
    const short = make?.inputs.find((y) => (s.inventory[y.id] ?? 0) < y.n * (x.n - (s.inventory[x.id] ?? 0)));
    if (short) return short.id;
  }
  return null;
}

/**
 * The best open tile for one more of `type`, scored by what it would get
 * from its neighbours and give to them. Null if nowhere is worth it.
 */
function bestSpot(s: GameState, type: string): { district: number; x: number; y: number; score: number } | null {
  const def = BUILDING.get(type)!;
  let best: { district: number; x: number; y: number; score: number } | null = null;
  for (const d of openDistricts(s)) {
    for (const spot of freeSpots(s, type, d)) {
      const p = previewPlacement(s, type, d, spot.x, spot.y);
      let score = p.score + p.neighbours.reduce((a, n) => a + n.delta, 0);
      // Green and civic buildings are worth exactly what their neighbours get from them.
      if (def.tag === 'green' || def.tag === 'civic') score = p.neighbours.reduce((a, n) => a + n.delta, 0);
      // Prefer the later districts a little: there is more room there.
      score += d * 0.01;
      if (!best || score > best.score) best = { district: d, x: spot.x, y: spot.y, score };
    }
  }
  return best;
}

/** How much the bot wants another level of this type, as a price multiplier: lower is keener. */
function appetite(s: GameState, def: BuildingDef, goal: Goal | null): number {
  const d = derive(s);
  const city = d.city;
  if (goal?.kind === 'build' && goal.id === def.id && !progress(s, goal, s.story.base).done) return 0.2;
  switch (def.tag) {
    case 'home':
      if (goal?.kind === 'pop') return 0.4;
      return city.pop < city.jobs * 1.05 ? 0.5 : 3;
    case 'crew':
      // Cost per damage, normalised against a salvage gang.
      return (0.6 / (def.dps ?? 1)) * 1.4;
    case 'trade':
      // A coin a second is worth about as much as a gang's damage, early on.
      return (0.3 / (def.tax ?? 1)) * 2.2;
    case 'civic':
      return goal?.kind === 'happy' ? 0.5 : 5;
    case 'industry':
      return workshopSlots(s) < 3 ? 2 : 50;
    case 'green':
      return goal?.kind === 'happy' ? 0.3 : 3;
  }
}

/** One step of the build plan: the best purchase on offer, or null. */
function bestBuy(s: GameState, goal: Goal | null, reserve: number): { score: number; buy: () => boolean } | null {
  const offers: { score: number; buy: () => boolean }[] = [];
  const factor: Record<string, number> = { tools: 1, barrows: 1.6, ledgers: 1.6, foremen: 1.2, kilns: 4, hands: 3 };
  for (const u of UPGRADES) {
    if (!hasFeature(s, 'upgrades') || (u.requires && !hasFeature(s, u.requires))) continue;
    const cost = upgradeCost(u.id, s.upgrades[u.id] ?? 0);
    if (cost > s.coins - reserve) continue;
    const score = cost * (factor[u.id] ?? 2) * (goal?.kind === 'upgrade' && goal.id === u.id ? 0.2 : 1);
    offers.push({ score, buy: () => buyUpgrade(s, u.id) });
  }
  for (const def of BUILDINGS) {
    if (!buildingAllowed(s, def)) continue;
    const cost = levelCost(s, def.id);
    if (cost > s.coins - reserve) continue;
    const score = cost * appetite(s, def, goal);
    offers.push({
      score,
      buy: () => {
        const count = typeCount(s, def.id);
        const room = s.buildings.some((b) => b.type === def.id && headroom(b) > 0);
        // New ground first while it is plentiful; level up once the good spots are gone.
        const spot = canAffordPlace(s, def.id) ? bestSpot(s, def.id) : null;
        if (spot && (count < 2 || spot.score >= 1 || !room || def.tag === 'green')) return !!place(s, def.id, spot.district, spot.x, spot.y);
        return room && def.tag !== 'green' && upgradeType(s, def.id, 1);
      },
    });
  }
  offers.sort((a, b) => a.score - b.score);
  for (const o of offers) if (o.buy()) return o;
  return null;
}

function plan(s: GameState, mem: BotMemory, opts: BotOptions): void {
  // The bot has no opinion on the ending; the seed decides.
  if (activeStory(s) && progress(s, activeStory(s)!.goal, s.story.base).done) claimStory(s, s.rng & 1);
  for (const c of s.petitions.list) claimPetition(s, c.id);

  while (s.statPoints > 0 && hasFeature(s, 'founder')) spendStat(s, STAT_ORDER[mem.statCursor++ % STAT_ORDER.length]!);
  for (const id of PASSIVE_ORDER) while (canRankPassive(s, id)) rankPassive(s, id);

  const story = activeStory(s);
  const goal = story && !progress(s, story.goal, s.story.base).done ? story.goal : null;

  // Crafting comes before shopping: regalia is the big multiplier.
  const goals = targets(s);
  for (const r of goals) if (canCraft(s, r)) craft(s, r.id);

  // Keep the workshops busy on the goods the next things need.
  if (hasFeature(s, 'workshops')) {
    const wanted = goodsWanted(s, goal);
    const slots = workshopSlots(s);
    for (let i = 0; i < slots; i++) {
      const f = s.workshops[i]!;
      if (f.queued > 0) continue;
      for (const [good, n] of wanted) {
        const recipe = REFINE.find((r) => r.output === good && meetsRequirement(s, r.requires));
        if (!recipe || s.workshops.some((x, k) => k < slots && x.recipe === recipe.id && x.queued > 0)) continue;
        if (batchesAffordable(s, recipe) < 1) continue;
        queueRefine(s, i, recipe.id, Math.min(n, batchesAffordable(s, recipe)));
        break;
      }
    }
  }

  // Sell salvage, but keep enough back for the workshops and the odd building.
  sellAllSalvage(s, hasFeature(s, 'workshops') ? 80 : 0);
  // Relics not needed by any target are just money.
  const neededRelics = new Set(goals.flatMap((r) => r.inputs.map((x) => x.id)));
  for (const [id, n] of Object.entries(s.inventory)) {
    const mat = MATERIAL.get(id);
    if (mat?.kind === 'relic' && !neededRelics.has(id) && n > 4) {
      const coins = (n - 4) * mat.value * derive(s).sellMult;
      s.inventory[id] = 4;
      s.coins += coins;
      s.counters.earned += coins;
    }
  }

  if (s.plan.length) rebuildFromPlan(s);

  // Keep back coin for a craft that only lacks coin, if it is within reach.
  const reserve = Math.max(0, ...goals.filter((r) => r.coins <= s.coins * 2 && hasInputs(s, r.inputs)).map((r) => r.coins));
  for (let guard = 0; guard < 60; guard++) {
    if (!bestBuy(s, goal, reserve)) break;
  }

  // Edicts: the long ones whenever they are ready, and Work Rush with what resolve is left over.
  for (const k of [...EDICTS].reverse()) {
    if (!edictReady(s, k.id)) continue;
    const saving = EDICTS.filter((e) => e.id !== 'rush' && hasFeature(s, e.id)).reduce((a, e) => Math.max(a, e.resolve), 0);
    if (k.id === 'rush' && s.resolve < 20 + saving) continue;
    useEdict(s, k.id);
  }
  if (s.ruin.landmark && (s.consumables.charge ?? 0) > 0) useConsumable(s, 'charge');

  // Missions that ask to be somewhere, or to hold the landmark back.
  if (goal?.kind === 'visit') {
    s.autoAdvance = false;
    setWard(s, goal.ward);
    return;
  }
  if (goal?.kind === 'farm') {
    s.autoAdvance = false;
    return;
  }
  // A mission wanting salvage from an earlier district sends it back to get some.
  const want = goal ? salvageWanted(s, goal) : null;
  if (want) {
    const home = DISTRICTS.find((d) => d.salvage.some((o) => o.id === want));
    if (home && districtAt(s.ward) !== home && s.maxWard >= home.from) {
      const next = DISTRICTS[DISTRICTS.indexOf(home) + 1];
      s.autoAdvance = false;
      setWard(s, Math.min(s.maxWard, next ? next.from - 1 : s.maxWard));
      return;
    }
    if (home && districtAt(s.ward) === home) return;
  }

  // Wards: push on while a landmark falls in reasonable time, otherwise salvage.
  const d = derive(s);
  const dps = d.tap * opts.tapsPerSecond + d.crewDps;
  const landmarkTime = ruinHp(s.ward, true) / d.landmarkMult / Math.max(1e-9, dps);
  const atFront = ruinHp(s.maxWard, true) / d.landmarkMult / Math.max(1e-9, dps);
  if (s.autoAdvance && landmarkTime > 60 && s.ward === s.maxWard) s.autoAdvance = false;
  else if (!s.autoAdvance && atFront < 25) s.autoAdvance = true;
  if (s.autoAdvance) {
    if (s.ward < s.maxWard) setWard(s, s.maxWard);
  } else {
    // Holding back: salvage at the furthest ward where an ordinary ruin still falls in a few seconds.
    let w = s.maxWard;
    while (w > 1 && ruinHp(w, false) / dps > 4) w -= 1;
    if (w !== s.ward) setWard(s, w);
  }

  if (s.maxWard > mem.lastMax) {
    mem.lastMax = s.maxWard;
    mem.stallTimer = 0;
  }
  if (hasFeature(s, 'tide') && mem.stallTimer > opts.stallSeconds && memoryGain(s) >= opts.minMemories) {
    letTideIn(s);
    mem.lastMax = s.maxWard;
    mem.stallTimer = 0;
    for (let guard = 0; guard < 500; guard++) {
      let bought = false;
      for (const id of CHARTER_ORDER) if (CHARTER.some((c) => c.id === id) && buyCharter(s, id)) bought = true;
      if (!bought) break;
    }
  }
}

export interface BotRun {
  state: GameState;
  log: string[];
}

/** Plays `seconds` of game time. Decisions every second, the world in tenths. */
export function runBot(s: GameState, seconds: number, opts: BotOptions = DEFAULT_BOT, now = 0): BotRun {
  const mem: BotMemory = { stallTimer: 0, lastMax: s.maxWard, statCursor: 0 };
  const log: string[] = [];
  const dt = 0.1;
  let tapCarry = 0;
  let lastStory = storyIndex(s);
  let lastTides = s.counters.tides;
  for (let t = 0; t < seconds; t += 1) {
    refreshPetitions(s, now + t * 1000);
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
    for (const m of [5, 9, 13, 17, 25, 33]) {
      if (s.furthestEver >= m && !log.some((l) => l.includes(`reached ${m} `))) log.push(`${(t / 60).toFixed(1)}m reached ${m} lvl ${s.level}`);
    }
    if (storyIndex(s) !== lastStory) {
      lastStory = storyIndex(s);
      log.push(`${(t / 60).toFixed(1)}m story ${storyIndex(s)} ward ${s.maxWard} lvl ${s.level} pop ${Math.floor(derive(s).city.pop)}`);
    }
    if (s.counters.tides !== lastTides) {
      lastTides = s.counters.tides;
      log.push(`${(t / 60).toFixed(1)}m TIDE memories ${s.memoriesEarned}`);
    }
  }
  return { state: s, log };
}
