/**
 * Everything that isn't the action runner or combat: farming, the agility
 * course, surveying, stars, the settlement, the ranch, the museum, shops,
 * quests and guild tasks.
 */
import { ITEM, item } from '../data/items';
import { GUILDS, QUEST, SHOP_ENTRY, adventureSkillCost, type GuildId } from '../data/meta';
import { ACTION, SKILL_INFO } from '../data/skills';
import {
  ANIMAL, BUILDING, CONSTELLATION, FARM_CROP, HEX_KEY, OBSTACLES, PENS, PILLARS, PLOTS, POIS, STARS, hexCost, hexDist, mapHexes, starCost, type PlotKind,
} from '../data/special';
import { WOODS } from '../data/tiers';
import type { Qty, SkillId } from '../data/types';
import type { GameState } from '../state/types';
import { addItem, bump, count, grantXp, guildRep, invalidate, level, notice, removeItem, rollSkillExtras, skillUnlocked } from './core';
import { get, interval, mods, rankOf, skillMod, xpMult } from './modifiers';
import { allMet, describe } from './requirements';
import { chance, randInt, roll } from './rng';
import { stopActivity, useCharges } from './skilling';

function takeAll(s: GameState, items: readonly Qty[]): void {
  for (const q of items) removeItem(s, q.item, q.qty);
}

export function missing(s: GameState, items: readonly Qty[]): string | null {
  for (const q of items) if (count(s, q.item) < q.qty) return `Needs ${q.qty} ${ITEM.get(q.item)?.name ?? q.item}`;
  return null;
}

// --- Farming -------------------------------------------------------------------

export function growTime(s: GameState, seed: string): number {
  const c = FARM_CROP.get(seed)!;
  return Math.round(c.grow * (1 - Math.min(60, get(mods(s), 'farmGrowth')) / 100));
}

export function plotReady(s: GameState, kind: PlotKind, i: number): boolean {
  const p = s.farm[kind][i];
  return !!p?.seed && s.time >= p.plantedAt + growTime(s, p.seed);
}

export function plant(s: GameState, kind: PlotKind, i: number, seed: string, compost: 0 | 1 | 2 = 0): string | null {
  if (!skillUnlocked(s, 'farming')) return 'Farming is locked';
  const p = s.farm[kind][i];
  const c = FARM_CROP.get(seed);
  if (!p) return 'No such plot';
  if (p.seed) return 'Already planted';
  if (!c || c.kind !== kind) return 'That does not grow here';
  if (level(s, 'farming') < c.level) return `Needs Farming ${c.level}`;
  if (count(s, seed) < c.seeds) return `Needs ${c.seeds} seeds`;
  const compostItem = compost === 2 ? 'super-compost' : compost === 1 ? 'compost' : null;
  if (compostItem && !removeItem(s, compostItem, 1)) compost = 0;
  removeItem(s, seed, c.seeds);
  p.seed = seed;
  p.plantedAt = s.time;
  p.compost = compost;
  grantXp(s, 'farming', c.xp * 0.5 * xpMult(mods(s), 'farming'));
  return null;
}

export function harvest(s: GameState, kind: PlotKind, i: number): string | null {
  const p = s.farm[kind][i];
  if (!p?.seed) return 'Nothing planted';
  if (!plotReady(s, kind, i)) return 'Not ready yet';
  const c = FARM_CROP.get(p.seed)!;
  const m = mods(s);
  const ok = p.compost > 0 || chance(s, 0.65 + (level(s, 'farming') - c.level) * 0.005);
  if (!ok) {
    notice(s, `Your ${c.name} withered. Compost makes sure of a harvest.`, 'bad');
    p.seed = null;
    return null;
  }
  let qty = randInt(s, c.yield[0], c.yield[1]);
  qty = Math.round(qty * (1 + get(m, 'farmYield') / 100) * (p.compost === 2 ? 1.5 : 1));
  if (!addItem(s, c.product, qty)) return 'Bank full';
  if (c.kind !== 'tree' && chance(s, 0.3)) addItem(s, c.seed, 1);
  grantXp(s, 'farming', (c.xp + qty * c.xp * 0.12) * xpMult(m, 'farming'));
  guildRep(s, 'farming', 2 + c.level / 10, get(m, 'guildXP'));
  bump(s, `harvest:${c.seed}`);
  bump(s, 'harvest:any');
  bump(s, 'skill:farming');
  rollSkillExtras(s, 'farming', 60_000, get(m, 'petChance'));
  useCharges(s, 'farming');
  notice(s, `Harvested ${qty} ${item(c.product).name}.`, 'loot');
  p.seed = null;
  return null;
}

export function harvestAll(s: GameState): number {
  let n = 0;
  for (const kind of ['allotment', 'herb', 'tree'] as const) {
    s.farm[kind].forEach((_, i) => {
      if (plotReady(s, kind, i) && !harvest(s, kind, i)) n++;
    });
  }
  return n;
}

/** Shop upgrades add plots; this keeps the arrays in step. */
export function syncPlots(s: GameState): void {
  for (const kind of ['allotment', 'herb', 'tree'] as const) {
    const want = PLOTS[kind].start + (s.upgrades[`plot-${kind}`] ?? 0);
    while (s.farm[kind].length < want) s.farm[kind].push({ seed: null, plantedAt: 0, compost: 0 });
  }
  const pens = PENS.start + (s.upgrades['pen'] ?? 0);
  while (s.ranch.length < pens) s.ranch.push({ animal: null, count: 0, progress: 0 });
}

// --- Agility -------------------------------------------------------------------

export function buildObstacle(s: GameState, id: string): string | null {
  const ob = OBSTACLES.find((o) => o.id === id);
  if (!ob) return 'No such obstacle';
  if (!skillUnlocked(s, 'agility')) return 'Agility is locked';
  if (level(s, 'agility') < ob.level) return `Needs Agility ${ob.level}`;
  if (s.course[ob.slot] === id) return 'Already built';
  // Building the same obstacle again later costs less, the way a course gets cheaper to rebuild.
  const discount = Math.min(0.5, (s.counters[`built:${id}`] ?? 0) * 0.1);
  const gp = Math.round(ob.cost.gp * (1 - discount));
  if (s.gp < gp) return `Needs ${gp} gold`;
  const why = missing(s, ob.cost.items);
  if (why) return why;
  s.gp -= gp;
  takeAll(s, ob.cost.items);
  s.course[ob.slot] = id;
  bump(s, `built:${id}`);
  s.counters['obstaclesBuilt'] = s.course.filter(Boolean).length;
  invalidate(s);
  return null;
}

export function buildPillar(s: GameState, id: string): string | null {
  const p = PILLARS.find((x) => x.id === id);
  if (!p) return 'No such pillar';
  if (s.course.some((c) => !c)) return 'Build all ten obstacles first';
  if (s.gp < p.cost.gp) return `Needs ${p.cost.gp} gold`;
  const why = missing(s, p.cost.items);
  if (why) return why;
  s.gp -= p.cost.gp;
  takeAll(s, p.cost.items);
  s.pillar = id;
  invalidate(s);
  return null;
}

export function startAgility(s: GameState): string | null {
  if (!s.course.some(Boolean)) return 'Build an obstacle first';
  if (!skillUnlocked(s, 'agility')) return 'Agility is locked';
  stopActivity(s);
  s.activity = { kind: 'agility', index: nextObstacle(s, -1), progress: 0 };
  return null;
}

function nextObstacle(s: GameState, from: number): number {
  for (let i = from + 1; i < s.course.length; i++) if (s.course[i]) return i;
  return -1;
}

export function obstacleInterval(s: GameState, slot: number): number {
  const ob = OBSTACLES.find((o) => o.id === s.course[slot]);
  return interval(mods(s), 'agility', ob?.interval ?? 3000);
}

export function completeObstacle(s: GameState): void {
  const a = s.activity;
  if (a?.kind !== 'agility') return;
  const ob = OBSTACLES.find((o) => o.id === s.course[a.index]);
  if (!ob) {
    a.index = nextObstacle(s, -1);
    return;
  }
  const m = mods(s);
  grantXp(s, 'agility', ob.xp * xpMult(m, 'agility'));
  s.gp += Math.round(ob.gp * (1 + get(m, 'gpGain') / 100));
  guildRep(s, 'agility', ob.interval / 3000, get(m, 'guildXP'));
  bump(s, 'skill:agility');
  rollSkillExtras(s, 'agility', ob.interval, get(m, 'petChance'));
  const next = nextObstacle(s, a.index);
  if (next < 0) {
    bump(s, 'laps');
    a.index = nextObstacle(s, -1);
  } else a.index = next;
}

// --- Cartography ---------------------------------------------------------------

export function surveyable(s: GameState): string[] {
  const done = new Set(s.surveyed);
  const lvl = level(s, 'cartography');
  return mapHexes()
    .filter(([q, r]) => !done.has(HEX_KEY(q, r)) && hexCost(q, r).level <= lvl)
    .filter(([q, r]) => [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]].some(([dq, dr]) => done.has(HEX_KEY(q + dq!, r + dr!))))
    .sort((a, b) => hexDist(a[0], a[1]) - hexDist(b[0], b[1]))
    .map(([q, r]) => HEX_KEY(q, r));
}

export function startSurvey(s: GameState, hex?: string): string | null {
  if (!skillUnlocked(s, 'cartography')) return 'Cartography is locked';
  const options = surveyable(s);
  const target = hex && options.includes(hex) ? hex : options[0];
  if (!target) return 'Nothing left you can survey';
  stopActivity(s);
  s.surveyTarget = target;
  s.activity = { kind: 'survey', hex: target, progress: 0 };
  return null;
}

export const SURVEY_INTERVAL = 3000;

export function completeSurvey(s: GameState): void {
  const a = s.activity;
  if (a?.kind !== 'survey') return;
  const [q, r] = a.hex.split(',').map(Number) as [number, number];
  const m = mods(s);
  const gain = 1 + Math.floor(level(s, 'cartography') / 15);
  s.map[a.hex] = (s.map[a.hex] ?? 0) + gain;
  grantXp(s, 'cartography', (6 + hexDist(q, r) * 5) * xpMult(m, 'cartography'));
  guildRep(s, 'cartography', 1, get(m, 'guildXP'));
  bump(s, 'skill:cartography');
  rollSkillExtras(s, 'cartography', SURVEY_INTERVAL, get(m, 'petChance'));
  if (s.map[a.hex]! >= hexCost(q, r).points) {
    s.surveyed.push(a.hex);
    bump(s, 'hexesSurveyed');
    const poi = POIS.find((p) => p.q === q && p.r === r);
    if (poi) {
      bump(s, 'poisFound');
      for (const it of poi.reward.items ?? []) addItem(s, it.item, it.qty);
      if (poi.reward.mods) {
        s.earned.push(poi.reward.mods);
        invalidate(s);
      }
      notice(s, `Landmark found: ${poi.name}. ${poi.desc}`, 'good');
    }
    const next = surveyable(s)[0];
    if (next) {
      a.hex = next;
      a.progress = 0;
      s.surveyTarget = next;
    } else {
      s.activity = null;
      notice(s, 'You have surveyed all you can for now.', 'info');
    }
  }
}

// --- Astrology stars -------------------------------------------------------------

export function raiseStar(s: GameState, cid: string, star: number): string | null {
  const c = CONSTELLATION.get(cid);
  const def = STARS[star];
  if (!c || !def) return 'No such star';
  if (level(s, 'astrology') < c.level) return `Needs Astrology ${c.level}`;
  const levels = (s.stars[cid] ??= [0, 0, 0, 0]);
  const lv = levels[star] ?? 0;
  if (lv >= def.max) return 'Already at its brightest';
  const cost = starCost(lv, def.golden);
  const dust = def.golden ? 'golden-stardust' : 'stardust';
  if (count(s, dust) < cost) return `Needs ${cost} ${item(dust).name}`;
  removeItem(s, dust, cost);
  levels[star] = lv + 1;
  bump(s, 'starsRaised');
  invalidate(s);
  return null;
}

// --- Construction --------------------------------------------------------------

export function buildingCost(id: string, lv: number): { gp: number; items: Qty[] } {
  const b = BUILDING.get(id)!;
  const f = b.growth ** lv;
  return { gp: Math.round(b.gp * f), items: b.cost.map((c) => ({ item: c.item, qty: Math.round(c.qty * f) })) };
}

export function settlementPop(s: GameState): { pop: number; needed: number; staffing: number } {
  let pop = 0;
  let needed = 0;
  for (const [id, lv] of Object.entries(s.settlement)) {
    const b = BUILDING.get(id);
    if (!b) continue;
    pop += (b.housing ?? 0) * lv;
    needed += b.workers * lv;
  }
  return { pop, needed, staffing: needed ? Math.min(1, pop / needed) : 1 };
}

export function upgradeBuilding(s: GameState, id: string): string | null {
  const b = BUILDING.get(id);
  if (!b) return 'No such building';
  if (!skillUnlocked(s, 'construction')) return 'Construction is locked';
  if (level(s, 'construction') < b.level) return `Needs Construction ${b.level}`;
  const lv = s.settlement[id] ?? 0;
  if (lv >= b.max) return 'Fully built';
  const cost = buildingCost(id, lv);
  if (s.gp < cost.gp) return `Needs ${cost.gp} gold`;
  const why = missing(s, cost.items);
  if (why) return why;
  s.gp -= cost.gp;
  takeAll(s, cost.items);
  s.settlement[id] = lv + 1;
  s.counters[`building:${id}`] = lv + 1;
  bump(s, 'build:any');
  const m = mods(s);
  grantXp(s, 'construction', b.xp * (lv + 1) * xpMult(m, 'construction'));
  guildRep(s, 'construction', 10 + lv * 4, get(m, 'guildXP'));
  invalidate(s);
  return null;
}

/** Passive production over `ms` of game time. */
export function settlementTick(s: GameState, ms: number): void {
  const { staffing } = settlementPop(s);
  const prod = (1 + get(mods(s), 'constructionProduction') / 100) * staffing;
  const hours = ms / 3_600_000;
  for (const [id, lv] of Object.entries(s.settlement)) {
    const b = BUILDING.get(id);
    if (!b || !lv) continue;
    if (b.gpPerHour) s.gp += b.gpPerHour * lv * hours * prod;
    for (const p of b.produces ?? []) {
      const key = `${id}:${p.item}`;
      const amt = (s.settleFrac[key] ?? 0) + p.qty * lv * hours * prod;
      const whole = Math.floor(amt);
      if (whole > 0 && addItem(s, p.item, whole)) s.settleFrac[key] = amt - whole;
      else s.settleFrac[key] = Math.min(amt, 1e6);
    }
  }
  s.gp = Math.floor(s.gp * 1000) / 1000;
}

// --- Ranching ------------------------------------------------------------------

export function penCapacity(s: GameState): number {
  return PENS.capacity + 3 * (s.upgrades['pen-size'] ?? 0);
}

export function buyAnimal(s: GameState, pen: number, animal: string): string | null {
  const a = ANIMAL.get(animal);
  const p = s.ranch[pen];
  if (!a || !p) return 'No such pen';
  if (!skillUnlocked(s, 'ranching')) return 'Ranching is locked';
  if (level(s, 'ranching') < a.level) return `Needs Ranching ${a.level}`;
  if (p.animal && p.animal !== animal) return 'That pen holds another kind of animal';
  if (p.count >= penCapacity(s)) return 'The pen is full';
  if (s.gp < a.price) return `Needs ${a.price} gold`;
  s.gp -= a.price;
  p.animal = animal;
  p.count++;
  return null;
}

export function sellAnimals(s: GameState, pen: number): void {
  const p = s.ranch[pen];
  if (!p?.animal) return;
  s.gp += Math.round(ANIMAL.get(p.animal)!.price * 0.4 * p.count);
  p.animal = null;
  p.count = 0;
  p.progress = 0;
}

export function ranchTick(s: GameState, ms: number): void {
  if (s.mode === 'adventure' && !skillUnlocked(s, 'ranching')) return;
  const m = mods(s);
  const speed = 1 + get(m, 'ranchProduction') / 100;
  for (const p of s.ranch) {
    if (!p.animal || p.count <= 0) continue;
    const a = ANIMAL.get(p.animal)!;
    p.progress += ms * speed;
    let cycles = Math.floor(p.progress / a.interval);
    if (cycles <= 0) continue;
    if (a.feed) cycles = Math.min(cycles, Math.floor(count(s, a.feed) / p.count));
    if (cycles <= 0) {
      p.progress = Math.min(p.progress, a.interval);
      continue;
    }
    p.progress -= cycles * a.interval;
    if (a.feed) removeItem(s, a.feed, cycles * p.count);
    const n = cycles * p.count;
    for (const pr of a.produce) addItem(s, pr.item, pr.qty * n * (chance(s, skillMod(m, 'doubleChance', 'ranching') / 100) ? 2 : 1));
    grantXp(s, 'ranching', a.xp * n * xpMult(m, 'ranching'));
    guildRep(s, 'ranching', n * a.interval / 30_000, get(m, 'guildXP'));
    bump(s, `produce:${a.id}`, n);
    bump(s, 'produce:any', n);
    bump(s, 'skill:ranching', n);
    rollSkillExtras(s, 'ranching', a.interval * n, get(m, 'petChance'));
  }
}

// --- Firemaking bonfires ---------------------------------------------------------

export function lightBonfire(s: GameState, wood: string): string | null {
  const w = WOODS.find((x) => x.id === wood);
  if (!w) return 'No such logs';
  if (level(s, 'firemaking') < w.level) return `Needs Firemaking ${w.level}`;
  if (count(s, `log-${wood}`) < 10) return `Needs 10 ${w.name}`;
  removeItem(s, `log-${wood}`, 10);
  const mins = 5 + WOODS.indexOf(w) * 2;
  s.buffs = s.buffs.filter((b) => b.id !== 'bonfire' && b.until > s.time);
  s.buffs.push({ id: 'bonfire', name: `${w.name} Bonfire`, mods: { 'skillXP:firemaking': 10, skillXP: 2 }, until: s.time + mins * 60_000 });
  grantXp(s, 'firemaking', w.xp * 5 * xpMult(mods(s), 'firemaking'));
  bump(s, 'bonfires');
  invalidate(s);
  return null;
}

// --- Museum --------------------------------------------------------------------

export function donate(s: GameState, id: string): string | null {
  if (!id.startsWith('art-')) return 'The museum only takes artefacts';
  if (s.donated.includes(id)) return 'Already on display';
  if (!removeItem(s, id, 1)) return 'None in the bank';
  s.donated.push(id);
  bump(s, 'donated');
  grantXp(s, 'archaeology', (item(id).sell / 4) * xpMult(mods(s), 'archaeology'));
  invalidate(s);
  return null;
}

// --- Bank verbs ----------------------------------------------------------------

export function sell(s: GameState, id: string, qty: number): number {
  const it = ITEM.get(id);
  if (!it) return 0;
  const n = Math.min(qty, count(s, id));
  if (n <= 0) return 0;
  removeItem(s, id, n);
  const gp = it.sell * n;
  s.gp += gp;
  bump(s, 'soldGp', gp);
  return gp;
}

export function openChest(s: GameState, id: string, qty: number): Qty[] {
  const it = ITEM.get(id);
  if (!it?.opens) return [];
  const n = Math.min(qty, count(s, id));
  const out = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const d = roll(s, it.opens);
    if (!d) continue;
    if (!addItem(s, d.item, d.qty)) break;
    out.set(d.item, (out.get(d.item) ?? 0) + d.qty);
    removeItem(s, id, 1);
  }
  return [...out].map(([item, qty]) => ({ item, qty }));
}

export function drinkPotion(s: GameState, id: string): string | null {
  const it = ITEM.get(id);
  if (!it?.potion) return 'Not a potion';
  if (!removeItem(s, id, 1)) return 'None in the bank';
  const cur = s.potions[it.potion.skill];
  s.potions[it.potion.skill] = { item: id, charges: it.potion.charges + (cur?.item === id ? cur.charges : 0) };
  invalidate(s);
  return null;
}

// --- Shop ----------------------------------------------------------------------

export function shopPrice(s: GameState, id: string): { gp: number; slayerCoins: number; raidCoins: number } {
  const e = SHOP_ENTRY.get(id)!;
  const owned = 'upgrade' in e.gives ? s.upgrades[e.gives.upgrade] ?? 0 : 0;
  const f = e.growth ? e.growth ** owned : 1;
  return { gp: Math.round((e.cost.gp ?? 0) * f), slayerCoins: e.cost.slayerCoins ?? 0, raidCoins: e.cost.raidCoins ?? 0 };
}

export function buy(s: GameState, id: string, times = 1): string | null {
  const e = SHOP_ENTRY.get(id);
  if (!e) return 'No such item';
  for (let i = 0; i < times; i++) {
    if (!allMet(s, e.req)) return `Needs ${describe(e.req!.find((r) => !allMet(s, [r]))!)}`;
    if ('upgrade' in e.gives && e.gives.max !== undefined && (s.upgrades[e.gives.upgrade] ?? 0) >= e.gives.max) return 'Sold out';
    if (e.gives && 'upgrade' in e.gives && e.gives.upgrade === 'reroll' && !s.slayerTask) return 'No task to skip';
    const p = shopPrice(s, id);
    if (s.gp < p.gp) return 'Not enough gold';
    if (s.slayerCoins < p.slayerCoins) return 'Not enough slayer coins';
    if (s.raidCoins < p.raidCoins) return 'Not enough Gauntlet coins';
    if ('item' in e.gives && !addItem(s, e.gives.item, e.gives.qty)) return 'Bank full';
    s.gp -= p.gp;
    s.slayerCoins -= p.slayerCoins;
    s.raidCoins -= p.raidCoins;
    if ('upgrade' in e.gives) {
      if (e.gives.upgrade === 'reroll') s.slayerTask = null;
      else s.upgrades[e.gives.upgrade] = (s.upgrades[e.gives.upgrade] ?? 0) + 1;
      if (e.gives.upgrade === 'loadout') s.loadouts.push({});
      syncPlots(s);
      invalidate(s);
    }
  }
  return null;
}

export function unlockSkill(s: GameState, skill: SkillId): string | null {
  if (s.mode !== 'adventure') return 'Only in Adventure mode';
  if (skillUnlocked(s, skill)) return 'Already unlocked';
  const cost = adventureSkillCost(s.unlocked.length);
  if (s.gp < cost) return `Needs ${cost} gold`;
  s.gp -= cost;
  s.unlocked.push(skill);
  notice(s, `${SKILL_INFO[skill].name} unlocked.`, 'good');
  return null;
}

// --- Quests --------------------------------------------------------------------

export function questStep(s: GameState, step: { kind: string; target: string; qty: number }): number {
  switch (step.kind) {
    case 'level':
      return level(s, step.target as SkillId);
    case 'item':
      return count(s, step.target);
    case 'kill':
      return s.counters[`kill:${step.target}`] ?? 0;
    case 'clear':
      return s.counters[`clear:${step.target}`] ?? 0;
    default:
      return s.counters[ACTION.has(step.target) ? `action:${step.target}` : step.target] ?? 0;
  }
}

export function questReady(s: GameState, id: string): boolean {
  const q = QUEST.get(id);
  if (!q || s.quests.includes(id) || !allMet(s, q.req)) return false;
  return q.steps.every((st) => questStep(s, st) >= st.qty);
}

export function completeQuest(s: GameState, id: string): string | null {
  const q = QUEST.get(id);
  if (!q) return 'No such quest';
  if (!questReady(s, id)) return 'Not finished yet';
  for (const st of q.steps) if (st.kind === 'item') removeItem(s, st.target, st.qty);
  s.quests.push(id);
  const r = q.rewards;
  if (r.gp) s.gp += r.gp;
  for (const it of r.items ?? []) addItem(s, it.item, it.qty);
  for (const [skill, xp] of Object.entries(r.xp ?? {})) grantXp(s, skill as SkillId, xp ?? 0);
  if (r.mods) s.earned.push(r.mods);
  invalidate(s);
  notice(s, `Quest complete: ${q.name}.`, 'good');
  return null;
}

// --- Guild tasks -----------------------------------------------------------------

export function taskProgress(s: GameState, counter: string): number {
  if (counter.startsWith('level:')) return level(s, counter.slice(6) as SkillId);
  return s.counters[counter] ?? 0;
}

/** Claims every finished task. Returns how many were claimed. */
export function claimGuildTasks(s: GameState): number {
  let n = 0;
  for (const g of GUILDS) {
    for (const t of g.tasks) {
      const st = s.guilds[g.id];
      if (st?.claimed.includes(t.id)) continue;
      if (taskProgress(s, t.counter) < t.qty) continue;
      const entry = (s.guilds[g.id] ??= { rep: 0, claimed: [] });
      const before = rankOf(entry.rep);
      entry.claimed.push(t.id);
      entry.rep += t.rep * (1 + get(mods(s), 'guildXP') / 100);
      n++;
      const after = rankOf(entry.rep);
      if (after > before) {
        notice(s, `${g.name}: you are now rank ${after}.`, 'level');
        invalidate(s);
      }
    }
  }
  // Rank-ups from plain reputation (earned by actions) also need the cache refreshed.
  for (const g of GUILDS) {
    const st = s.guilds[g.id];
    if (!st) continue;
    const r = rankOf(st.rep);
    const key = `rank:${g.id}`;
    if ((s.counters[key] ?? 0) !== r) {
      if (r > (s.counters[key] ?? 0)) notice(s, `${g.name}: you are now rank ${r}.`, 'level');
      s.counters[key] = r;
      invalidate(s);
    }
  }
  return n;
}

export function guildRank(s: GameState, g: GuildId): number {
  return rankOf(s.guilds[g]?.rep ?? 0);
}
