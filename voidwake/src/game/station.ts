import { CLASS_IDS } from '../data/crew';
import { GEAR_DEF, RARITIES } from '../data/gear';
import { CONSUMABLE, CONSUMABLE_IDS, MAT, RAW_MATS } from '../data/materials';
import { BAL } from '../data/progression';
import { QUEST, QUESTS } from '../data/quests';
import { SECTORS } from '../data/sectors';
import type { ConsumableId, FactionId, MatId } from '../data/types';
import type { Crew, GameState, MapNode, QuestInst, StationState } from '../state/types';
import { hasMats, payMats, randomGear } from './crafting';
import { grantXp, makeCrew } from './crew';
import { derive, maxHp } from './derive';
import { addLog } from './log';
import { stationName } from './names';
import { pick, randInt, stateRng, type Rng } from './rng';

export function makeStation(s: GameState, r: Rng, n: MapNode, sector: number): StationState {
  const st: StationState = {
    name: stationName(r),
    faction: n.faction,
    restockAt: 0,
    stock: {},
    items: {},
    gear: [],
    recruits: [],
    quest: null,
  };
  stockStation(s, r, st, sector);
  return st;
}

function stockStation(s: GameState, r: Rng, st: StationState, sector: number): void {
  st.stock = {};
  for (const m of RAW_MATS) st.stock[m] = randInt(r, 4, 14);
  st.stock.alloy = randInt(r, 2, 8);
  st.stock.circuits = sector >= 1 ? randInt(r, 1, 4) : randInt(r, 0, 2);
  st.stock.exotic = sector >= 3 ? randInt(r, 0, 2) : 0;
  st.items = {};
  for (const id of CONSUMABLE_IDS) if (r() < 0.6) st.items[id] = randInt(r, 1, 3);
  st.items.medkit = Math.max(1, st.items.medkit ?? 0);
  st.gear = [];
  const g = randInt(r, 1, 3);
  for (let i = 0; i < g; i++) st.gear.push(randomGear(s, r, sector));
  st.recruits = [];
  const n = randInt(r, 1, 2);
  for (let i = 0; i < n; i++) st.recruits.push(makeCrew(s, r, pick(r, CLASS_IDS), Math.max(1, sector * 2 + randInt(r, 0, 2))));
}

/** On docking: restock if it's been long enough, and post a job if there isn't one. */
export function refreshStation(s: GameState, n: MapNode): void {
  const st = n.station;
  if (!st) return;
  const r = stateRng(s);
  if (s.day >= st.restockAt && st.restockAt > 0) stockStation(s, r, st, s.sector.index);
  if (st.restockAt <= s.day) st.restockAt = s.day + BAL.stationRestockDays;
  if (!st.quest && !s.quests.some((q) => q.from === n.id && !q.done)) st.quest = makeQuest(s, r, n);
}

// ---------------------------------------------------------------- Prices

export function repMult(s: GameState, f: FactionId | 'none'): number {
  if (f === 'none') return 1;
  const rep = s.rep[f];
  return rep >= 40 ? 0.85 : rep >= 15 ? 0.93 : rep <= -30 ? 1.3 : rep <= -10 ? 1.12 : 1;
}

function base(s: GameState, n: MapNode): number {
  return (1 + 0.12 * s.sector.index) * repMult(s, n.station?.faction ?? 'none');
}

export function buyPrice(s: GameState, n: MapNode, value: number): number {
  return Math.max(1, Math.round(value * base(s, n) * (1 - derive(s).trade)));
}

export function sellPrice(s: GameState, _n: MapNode, value: number): number {
  return Math.max(1, Math.floor(value * (1 + 0.12 * s.sector.index) * BAL.sellShare * (1 + derive(s).trade)));
}

export const FUEL_VALUE = 12;
export const FOOD_VALUE = 4;
export const ENERGY_VALUE = 2;

export function gearValue(base: string, rarity: number): number {
  const tier = GEAR_DEF.get(base)?.tier ?? 1;
  return Math.round(tier * 45 * RARITIES[rarity]!.mult ** 2);
}

export function repairPrice(s: GameState, n: MapNode): number {
  return Math.max(1, Math.round(BAL.repairCost * base(s, n)));
}

export function hirePrice(c: Crew): number {
  return 50 + 35 * c.level;
}

// ---------------------------------------------------------------- Trades

export function buyMat(s: GameState, n: MapNode, m: MatId, qty = 1): boolean {
  const st = n.station!;
  const have = st.stock[m] ?? 0;
  const price = buyPrice(s, n, MAT.get(m)!.value) * qty;
  if (have < qty || s.res.credits < price) return false;
  s.res.credits -= price;
  st.stock[m] = have - qty;
  s.mats[m] += qty;
  return true;
}

export function sellMat(s: GameState, n: MapNode, m: MatId, qty = 1): boolean {
  if (s.mats[m] < qty) return false;
  s.mats[m] -= qty;
  s.res.credits += sellPrice(s, n, MAT.get(m)!.value) * qty;
  n.station!.stock[m] = (n.station!.stock[m] ?? 0) + qty;
  return true;
}

export function buySupply(s: GameState, n: MapNode, what: 'fuel' | 'food' | 'energy', qty = 1): boolean {
  const d = derive(s);
  const cap = what === 'fuel' ? d.maxFuel : what === 'food' ? d.maxFood : d.maxEnergy;
  const value = what === 'fuel' ? FUEL_VALUE : what === 'food' ? FOOD_VALUE : ENERGY_VALUE;
  const room = Math.floor(cap - s.res[what] + 1e-9);
  qty = Math.min(qty, room);
  const price = buyPrice(s, n, value) * qty;
  if (qty <= 0 || s.res.credits < price) return false;
  s.res.credits -= price;
  s.res[what] += qty;
  return true;
}

export function sellSupply(s: GameState, n: MapNode, what: 'fuel' | 'food', qty = 1): boolean {
  if (s.res[what] < qty) return false;
  s.res[what] -= qty;
  s.res.credits += sellPrice(s, n, what === 'fuel' ? FUEL_VALUE : FOOD_VALUE) * qty;
  return true;
}

export function buyItem(s: GameState, n: MapNode, id: ConsumableId): boolean {
  const st = n.station!;
  const price = buyPrice(s, n, CONSUMABLE.get(id)!.value);
  if ((st.items[id] ?? 0) <= 0 || s.res.credits < price) return false;
  s.res.credits -= price;
  st.items[id]! -= 1;
  s.items[id]++;
  return true;
}

export function sellItem(s: GameState, n: MapNode, id: ConsumableId): boolean {
  if (s.items[id] <= 0) return false;
  s.items[id]--;
  s.res.credits += sellPrice(s, n, CONSUMABLE.get(id)!.value);
  return true;
}

export function buyGear(s: GameState, n: MapNode, uid: number): boolean {
  const st = n.station!;
  const i = st.gear.findIndex((g) => g.uid === uid);
  if (i < 0) return false;
  const g = st.gear[i]!;
  const price = buyPrice(s, n, gearValue(g.base, g.rarity));
  if (s.res.credits < price) return false;
  s.res.credits -= price;
  st.gear.splice(i, 1);
  s.gear.push(g);
  return true;
}

export function sellGear(s: GameState, n: MapNode, uid: number): boolean {
  const i = s.gear.findIndex((g) => g.uid === uid);
  if (i < 0 || s.crew.some((c) => Object.values(c.gear).includes(uid))) return false;
  const g = s.gear[i]!;
  s.res.credits += sellPrice(s, n, gearValue(g.base, g.rarity));
  s.gear.splice(i, 1);
  n.station!.gear.push(g);
  return true;
}

export function repairAll(s: GameState, n: MapNode): number {
  const d = derive(s);
  const missing = Math.ceil(d.maxHull - s.res.hull);
  const per = repairPrice(s, n);
  const afford = Math.min(missing, Math.floor(s.res.credits / per));
  if (afford <= 0) return 0;
  s.res.credits -= afford * per;
  s.res.hull = Math.min(d.maxHull, s.res.hull + afford);
  return afford;
}

export function healPrice(s: GameState): number {
  return s.crew.reduce((a, c) => a + Math.max(0, maxHp(c) - c.hp), 0);
}

export function healAll(s: GameState): boolean {
  const price = healPrice(s);
  if (price <= 0 || s.res.credits < price) return false;
  s.res.credits -= price;
  for (const c of s.crew) c.hp = maxHp(c);
  return true;
}

export function hire(s: GameState, n: MapNode, id: number): boolean {
  const st = n.station!;
  const i = st.recruits.findIndex((c) => c.id === id);
  if (i < 0 || s.crew.length >= derive(s).crewCap) return false;
  const c = st.recruits[i]!;
  const price = hirePrice(c);
  if (s.res.credits < price) return false;
  s.res.credits -= price;
  st.recruits.splice(i, 1);
  s.crew.push(c);
  addLog(s, `${c.name} signed on.`, 'ship');
  return true;
}

export function dismiss(s: GameState, id: number): boolean {
  const i = s.crew.findIndex((c) => c.id === id);
  if (i < 0 || s.crew[i]!.captain) return false;
  const c = s.crew[i]!;
  s.crew.splice(i, 1);
  addLog(s, `${c.name} left the crew.`, 'ship');
  return true;
}

// ---------------------------------------------------------------- Quests

function makeQuest(s: GameState, r: Rng, from: MapNode): QuestInst | null {
  const sector = s.sector.index;
  const tpls = QUESTS.filter((q) => q.minSector <= sector);
  const tpl = pick(r, tpls);
  const nodes = s.sector.nodes;
  const reward = {
    credits: Math.round((45 + 30 * sector) * (0.8 + r() * 0.5)),
    xp: 25 + 15 * sector,
    rep: from.station!.faction === 'none' ? null : from.station!.faction,
  };
  const q: QuestInst = { uid: s.nextId++, tpl: tpl.id, sector, from: from.id, target: from.id, reward, done: false };
  if (tpl.kind === 'deliver') {
    const mat: MatId =
      tpl.id === 'q-ore-run' ? 'ore' : tpl.id === 'q-ice-run' ? 'ice' : tpl.id === 'q-food-run' ? 'organics' : tpl.id === 'q-crystal' ? 'crystal' : tpl.id === 'q-alloy' ? 'alloy' : tpl.id === 'q-circuits' ? 'circuits' : 'relic';
    const n = Math.max(1, Math.round((MAT.get(mat)!.refined || mat === 'relic' ? 3 : 10) * (1 + sector * 0.3)));
    q.need = { [mat]: n };
    q.reward.credits += n * MAT.get(mat)!.value;
    return q;
  }
  const away = nodes.filter((n) => n.id !== from.id && !n.story && n.kind !== 'entry' && n.kind !== 'gate');
  const want =
    tpl.kind === 'courier' ? away.filter((n) => n.kind === 'station') : tpl.kind === 'survey' ? away.filter((n) => n.kind === 'system') : away.filter((n) => n.kind !== 'station' && !n.visited);
  const target = want.length ? pick(r, want) : null;
  if (!target) return null;
  q.target = target.id;
  if (tpl.kind === 'bounty') {
    const def = SECTORS[sector]!;
    q.enemy = tpl.id === 'q-bounty-hulk' ? 'wrecker' : tpl.id === 'q-bounty-raider' ? 'raider' : pick(r, def.enemies);
    q.reward.credits += 30;
  }
  return q;
}

export function acceptQuest(s: GameState, n: MapNode): boolean {
  const st = n.station;
  if (!st?.quest) return false;
  s.quests.push(st.quest);
  addLog(s, `Took a job: ${QUEST.get(st.quest.tpl)!.title}.`, 'ship');
  st.quest = null;
  return true;
}

export function activeQuests(s: GameState): QuestInst[] {
  return s.quests.filter((q) => !q.done && q.sector === s.sector.index);
}

/** Quests that can be handed in right here, right now. */
export function questsHere(s: GameState): QuestInst[] {
  return activeQuests(s).filter((q) => {
    const tpl = QUEST.get(q.tpl)!;
    if (tpl.kind === 'deliver') return q.from === s.at && hasMats(s, q.need ?? {});
    if (tpl.kind === 'courier') return q.target === s.at;
    return false;
  });
}

export function completeQuest(s: GameState, q: QuestInst): string[] {
  const tpl = QUEST.get(q.tpl)!;
  if (tpl.kind === 'deliver' && q.need) payMats(s, q.need);
  q.done = true;
  s.res.credits += q.reward.credits;
  if (q.reward.rep) s.rep[q.reward.rep] = Math.min(100, s.rep[q.reward.rep] + 5);
  const lines = [`+${q.reward.credits} credits`, ...grantXp(s, q.reward.xp)];
  addLog(s, `Job done: ${tpl.title}. +${q.reward.credits} credits.`, 'ship');
  return lines;
}

/** Arriving at a node may finish a rescue, or trigger a bounty. */
export function questArrival(s: GameState): { bounty: QuestInst | null; done: string[] } {
  const out: { bounty: QuestInst | null; done: string[] } = { bounty: null, done: [] };
  for (const q of activeQuests(s)) {
    if (q.target !== s.at) continue;
    const tpl = QUEST.get(q.tpl)!;
    if (tpl.kind === 'rescue') {
      const n = 2 + s.sector.index;
      s.colonists += n;
      out.done.push(`Rescued ${n} colonists`, ...completeQuest(s, q));
    } else if (tpl.kind === 'bounty') {
      out.bounty = q;
    }
  }
  return out;
}

export function surveyDone(s: GameState, nodeId: number): string[] {
  const lines: string[] = [];
  for (const q of activeQuests(s)) {
    if (q.target === nodeId && QUEST.get(q.tpl)!.kind === 'survey') lines.push(...completeQuest(s, q));
  }
  return lines;
}

export function canHeal(s: GameState): boolean {
  return s.crew.some((c) => c.hp < maxHp(c)) && s.res.credits >= healPrice(s);
}

