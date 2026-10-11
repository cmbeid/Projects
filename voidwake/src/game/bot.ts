import { GEAR_DEF } from '../data/gear';
import { MODULE } from '../data/modules';
import type { ClassId, ConsumableId, MatId, ModKey, ModuleId } from '../data/types';
import type { Crew, GameState, MapNode } from '../state/types';
import { awayBotInput, newMemo } from './away/ai';
import { canLand, createAway } from './away/mission';
import { liftOff, NO_INPUT, stepAway } from './away/sim';
import { abilityReady, canJumpAway, combatTurn, type CombatAction } from './combat';
import { canCraft, canUpgrade, craft, upgrade } from './crafting';
import { autoSpend, equip, slotOf } from './crew';
import { conscious, derive, gearMods, maxHp } from './derive';
import { checkOdds, choiceAffordable, choiceShown, choose, eventView } from './events';
import {
  ackLost,
  canDistress,
  canMine,
  canPatch,
  closeAway,
  closeCombat,
  closeEvent,
  closeReport,
  createCaptain,
  distress,
  jump,
  mineBelt,
  patchHull,
  rest,
  useItem,
} from './engine';
import { hops, node } from './galaxy';
import { stateRng } from './rng';
import {
  acceptQuest,
  buyMat,
  buySupply,
  canHeal,
  completeQuest,
  healAll,
  hire,
  hirePrice,
  questsHere,
  repairAll,
  sellMat,
} from './station';
import { canDeliver, canTakeGate, currentMission, deliver, missionNode, takeGate } from './story';

/**
 * A player who never plans more than one jump ahead. It follows the story
 * marker, stops at stations to refuel and repair, lands on every planet it
 * passes, takes the first sensible event choice, crafts what it runs short
 * of and buys upgrades in a fixed order.
 *
 * `tests/bot.test.ts` holds the game to the milestones it reaches.
 */

export interface BotReport {
  log: string[];
  sectorAt: number[];
  actions: number;
  stuck: number;
}

const UPGRADE_ORDER: readonly ModuleId[] = [
  'plating', 'shield', 'laser', 'cargo', 'hydro', 'engine', 'refinery', 'reactor', 'cabins', 'missile', 'fabricator',
  'sensor', 'lander', 'medbay', 'shield', 'laser', 'plating', 'ion', 'missile', 'reactor', 'hydro', 'engine',
];

const EXPLORER_ORDER: readonly ClassId[] = ['soldier', 'engineer', 'pilot', 'scientist', 'medic'];

function gearScore(base: string, mods: Partial<Record<ModKey, number>>): number {
  const w: Partial<Record<ModKey, number>> = { awayDmg: 30, fireRate: 20, range: 4, o2: 0.6, suitShield: 0.3, hp: 0.5, speed: 40, gather: 25, carry: 1.5, skillCd: 20, wits: 5, charm: 5, grit: 5, trade: 50 };
  let n = 0;
  for (const [k, v] of Object.entries(mods) as [ModKey, number][]) n += (w[k] ?? 1) * v;
  return n + (GEAR_DEF.get(base)?.tier ?? 0) * 0.5;
}

function housekeeping(s: GameState): void {
  for (const c of s.crew) autoSpend(c);
  // Equip the best piece in each slot, captain first.
  const order = [...s.crew].sort((a, b) => (a.captain ? -1 : 0) - (b.captain ? -1 : 0));
  for (const c of order) {
    for (const g of [...s.gear].sort((a, b) => gearScore(b.base, gearMods(b)) - gearScore(a.base, gearMods(a)))) {
      const slot = slotOf(g.base);
      if (!slot) continue;
      const owner = s.crew.find((m) => Object.values(m.gear).includes(g.uid));
      if (owner && owner !== c) continue;
      const cur = s.gear.find((x) => x.uid === c.gear[slot]);
      if (!cur || gearScore(g.base, gearMods(g)) > gearScore(cur.base, gearMods(cur))) equip(s, c, g.uid);
    }
  }
  const d = derive(s);
  const want: [string, () => boolean][] = [
    ['r-medkit', () => s.items.medkit < 2],
    ['r-o2can', () => s.items.o2can < 2],
    ['r-repairkit', () => s.items.repairkit < 1 && s.mats.alloy >= 4],
    ['r-alloy', () => s.mats.ore >= 22],
    ['r-circuits', () => s.mats.crystal >= 7],
    ['r-ration', () => s.res.food < d.eat * 4 && s.mats.organics >= 8],
    ['r-fuelcell', () => s.res.fuel < 3 && s.mats.ice >= 5],
    ['r-exotic', () => s.mats.relic >= 3 && s.mats.circuits >= 3],
  ];
  const r = stateRng(s);
  for (const [id, cond] of want) {
    let guard = 0;
    while (cond() && canCraft(s, id) && guard++ < 10) craft(s, r, id);
  }
  // Upgrades: keep a reserve of credits for fuel and food.
  const reserve = 40 + 20 * s.sector.index;
  for (const id of UPGRADE_ORDER) {
    const t = MODULE.get(id)!.tiers[s.modules[id]];
    if (!t || s.res.credits - t.credits < reserve) continue;
    if (canUpgrade(s, id)) upgrade(s, id);
  }
  // Supplies.
  const use = (id: ConsumableId, when: boolean): void => {
    if (when && s.items[id] > 0) useItem(s, id);
  };
  use('fuelcell', s.res.fuel < d.fuelPerJump * 2);
  use('ration', s.res.food < d.eat * 2);
  use('repairkit', s.res.hull < d.maxHull * 0.5);
  use('powercell', s.res.energy < 8);
  for (const c of s.crew) if (c.hp < maxHp(c) * 0.4 && s.items.medkit > 0) useItem(s, 'medkit', c.id);
  use('stim', s.crew.some((c) => c.morale < 25));
  while (canPatch(s) && s.res.hull < d.maxHull * 0.7 && s.mats.alloy > 3) patchHull(s);
}

function atStation(s: GameState, n: MapNode): void {
  const d = derive(s);
  for (const q of questsHere(s)) completeQuest(s, q);
  // Sell surplus raw goods, keep enough to craft with.
  const keep: Partial<Record<MatId, number>> = { ore: 14, ice: 10, organics: 14, crystal: 10, relic: 4, alloy: 24, circuits: 12 };
  for (const [m, k] of Object.entries(keep) as [MatId, number][]) {
    while (s.mats[m] > k + 4) sellMat(s, n, m, 1);
  }
  repairAll(s, n);
  if (canHeal(s) && s.crew.some((c) => c.hp < maxHp(c) * 0.6)) healAll(s);
  buySupply(s, n, 'fuel', Math.max(0, Math.ceil(d.maxFuel * 0.8 - s.res.fuel)));
  buySupply(s, n, 'food', Math.max(0, Math.ceil(Math.min(d.maxFood, d.eat * 12) - s.res.food)));
  buySupply(s, n, 'energy', Math.max(0, Math.ceil(d.maxEnergy * 0.6 - s.res.energy)));
  // Buy what the story asks for.
  const m = currentMission(s);
  if (m?.objective.k === 'deliver') {
    for (const [mat, need] of Object.entries(m.objective.mats) as [MatId, number][]) {
      let guard = 0;
      while (s.mats[mat] < need && guard++ < 30 && buyMat(s, n, mat, 1));
    }
  }
  const st = n.station!;
  if (s.crew.length < d.crewCap) {
    const best = [...st.recruits].sort((a, b) => b.level - a.level)[0];
    if (best && s.res.credits > hirePrice(best) + 80) hire(s, n, best.id);
  }
  if (st.quest && s.quests.filter((q) => !q.done && q.sector === s.sector.index).length < 3) acceptQuest(s, n);
  for (const q of questsHere(s)) completeQuest(s, q);
}

function explorer(s: GameState): Crew | null {
  const ready = s.crew.filter((c) => conscious(c) && c.hp >= maxHp(c) * 0.45);
  ready.sort((a, b) => EXPLORER_ORDER.indexOf(a.cls) - EXPLORER_ORDER.indexOf(b.cls));
  return ready[0] ?? null;
}

function runAway(s: GameState): void {
  const memo = newMemo();
  const a = s.away!;
  let guard = 0;
  while (a.status === 'play' && guard++ < 60 * 400) {
    const inp = awayBotInput(a, memo);
    if (inp.leave) {
      liftOff(a);
      break;
    }
    if (a.o2 < 15 && s.items.o2can > 0) {
      s.items.o2can--;
      a.o2 += 60;
    }
    if (a.hp < a.hpMax * 0.3 && s.items.medkit > 0) {
      s.items.medkit--;
      a.hp = Math.min(a.hpMax, a.hp + 40);
    }
    stepAway(a, inp);
    a.events.length = 0;
  }
  if (a.status === 'play') {
    // Wandered too long: walk it home by force.
    a.x = a.lander.x;
    a.y = a.lander.y;
    liftOff(a);
    stepAway(a, NO_INPUT);
  }
  closeAway(s);
}

function combatAction(s: GameState): CombatAction {
  const c = s.combat!;
  const d = derive(s);
  if (s.res.hull < d.maxHull * 0.3 && s.items.repairkit > 0) return { k: 'item', id: 'repairkit' };
  const enemyStronger = c.enemy.hull > s.res.hull * 2.5;
  if (canJumpAway(s) && (s.res.hull < d.maxHull * 0.25 || (enemyStronger && c.jump > 0))) return { k: 'jump' };
  if (c.player.shield < c.player.maxShield * 0.3 && s.items.shieldcell > 0) return { k: 'item', id: 'shieldcell' };
  const hurtSub = Object.values(c.player.subs).some((x) => x.hp <= x.max / 2);
  if (abilityReady(s, 'engineer') && (hurtSub || s.res.hull < d.maxHull * 0.5)) return { k: 'ability', cls: 'engineer' };
  if (abilityReady(s, 'soldier') && c.turn % 2 === 1) return { k: 'ability', cls: 'soldier' };
  if (abilityReady(s, 'scientist') && c.turn % 3 === 1) return { k: 'ability', cls: 'scientist' };
  if (abilityReady(s, 'pilot') && c.evadeTurns === 0 && c.turn % 3 === 2) return { k: 'ability', cls: 'pilot' };
  if (abilityReady(s, 'medic') && s.crew.some((m) => m.hp < maxHp(m) * 0.5)) return { k: 'ability', cls: 'medic' };
  return { k: 'fire' };
}

function pickChoice(s: GameState): number {
  const v = eventView(s)!;
  let best = -1;
  let bestScore = -Infinity;
  v.choices.forEach((c, i) => {
    if (!choiceShown(s, c) || !choiceAffordable(s, c)) return;
    let score = 1 - i * 0.01;
    if (c.check) score = checkOdds(s, c.check).chance * 1.4 - (c.fail?.combat ? 0.4 : 0);
    if (c.ok.combat && s.res.hull < derive(s).maxHull * 0.5) score -= 1;
    if (c.ok.mats || c.ok.gear || c.ok.colonists || c.ok.recruit) score += 0.3;
    if (c.ok.morale && c.ok.morale < 0) score -= 0.3;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return Math.max(0, best);
}

function pathStep(s: GameState, target: number): number | null {
  const d = hops(s, target);
  const here = node(s);
  let best: number | null = null;
  for (const l of here.links) if (best === null || d[l]! < d[best]!) best = l;
  return best;
}

function chooseTarget(s: GameState, memo: Memo): number {
  const d = derive(s);
  const here = hops(s, s.at);
  const nodes = s.sector.nodes;
  const nearest = (pred: (n: MapNode) => boolean): number | null => {
    let best: number | null = null;
    for (const n of nodes) if (pred(n) && n.id !== s.at && (best === null || here[n.id]! < here[best]!)) best = n.id;
    return best;
  };
  const lowFuel = s.res.fuel < d.fuelPerJump * 3;
  const lowFood = s.res.food < d.eat * 3;
  const hurt = s.res.hull < d.maxHull * 0.45;
  if ((lowFuel || lowFood || hurt) && s.res.credits > 20) {
    const st = nearest((n) => n.kind === 'station');
    if (st !== null && here[st]! <= 3) return st;
  }
  const m = currentMission(s);
  const pinned = missionNode(s);
  if (m?.objective.k === 'rescue' || (m?.objective.k === 'deliver' && pinned && !canDeliverSoon(s))) {
    // Go find planets with sleepers, or materials.
    const sys = nearest((n) => n.kind === 'system' && n.planets.some((p) => p.landings < 2));
    if (sys !== null) return sys;
  }
  if (pinned && m?.objective.k === 'defeat') {
    // Don't walk into a boss fight hurt, and after a loss, go and get stronger first.
    const st = nearest((n) => n.kind === 'station');
    if (s.res.hull < d.maxHull * 0.85 && st !== null && s.res.credits > 30) return st;
    if (memo.grind > 0) {
      const sys = nearest((n) => n.kind === 'system' && n.planets.some((p) => p.landings < 2));
      if (sys !== null) return sys;
      if (st !== null) return st;
    }
  }
  if (pinned) return pinned.id;
  return nodes[nodes.length - 1]!.id;
}

function canDeliverSoon(s: GameState): boolean {
  const m = currentMission(s);
  if (m?.objective.k !== 'deliver') return true;
  // Close enough to buy the rest at the station.
  let short = 0;
  for (const [mat, need] of Object.entries(m.objective.mats) as [MatId, number][]) short += Math.max(0, need - s.mats[mat]) * (mat === 'alloy' ? 16 : mat === 'circuits' ? 30 : 6);
  return short <= s.res.credits;
}

interface Memo {
  visits: Map<number, number>;
  /** Landings still to do before trying the boss again. */
  grind: number;
}

function mapTurn(s: GameState, memo: Memo): void {
  housekeeping(s);
  const n = node(s);
  if (n.kind === 'station' && n.station) atStation(s, n);
  if (canDeliver(s)) {
    deliver(s);
    return;
  }
  if (canTakeGate(s)) {
    takeGate(s);
    return;
  }
  if (canMine(s) && s.res.energy > 12) mineBelt(s);
  if (n.kind === 'system') {
    const ex = explorer(s);
    const order = n.planets.map((p, i) => ({ p, i })).sort((a, b) => (b.p.objective ? 10 : 0) + b.p.pods - ((a.p.objective ? 10 : 0) + a.p.pods));
    for (const { i } of order) {
      if (!ex || s.res.energy < 10) break;
      if (!canLand(s, i, ex.id)) {
        if (memo.grind > 0) memo.grind--;
        createAway(s, i, ex.id);
        runAway(s);
        return;
      }
    }
  }
  if (canDistress(s)) {
    distress(s);
    return;
  }
  // Rest a day if the crew are in a bad way and the larder can take it.
  const d = derive(s);
  if (s.crew.filter(conscious).length < Math.ceil(s.crew.length / 2) && s.res.food > d.eat * 4 && s.res.energy > d.upkeep * 2) {
    rest(s);
    return;
  }
  const target = chooseTarget(s, memo);
  let step = pathStep(s, target);
  const v = (memo.visits.get(step ?? -1) ?? 0) + 1;
  if (step !== null) memo.visits.set(step, v);
  if (step !== null && v > 6) {
    // Going round in circles: try a neighbour at random.
    const links = n.links;
    step = links[Math.floor(stateRng(s)() * links.length)] ?? step;
    memo.visits.clear();
  }
  if (step === null || !jump(s, step)) rest(s);
}

/** Plays until `days` in-game days have passed or the campaign ends. */
export function runBot(s: GameState, days: number, maxActions = 200_000): BotReport {
  const report: BotReport = { log: [], sectorAt: [], actions: 0, stuck: 0 };
  const memo: Memo = { visits: new Map<number, number>(), grind: 0 };
  let lastDay = s.day;
  let lastSector = -1;
  let sameDay = 0;
  while (report.actions++ < maxActions) {
    if (s.screen === 'create') createCaptain(s, 'Bot', 'salvager');
    if (s.sector.index !== lastSector) {
      lastSector = s.sector.index;
      report.sectorAt[lastSector] = s.day;
      report.log.push(`Day ${s.day}: entered sector ${lastSector + 1}`);
    }
    if (s.day - 1 >= days || s.screen === 'ending') break;
    if (s.report) {
      closeReport(s);
      continue;
    }
    switch (s.screen) {
      case 'lost':
        report.log.push(`Day ${s.day}: signal lost`);
        memo.grind += 4;
        ackLost(s);
        break;
      case 'event':
        if (s.event!.result === null) choose(s, pickChoice(s));
        else closeEvent(s);
        break;
      case 'combat':
        if (s.combat!.result) {
          report.log.push(`Day ${s.day}: ${s.combat!.enemy.name} — ${s.combat!.result} on turn ${s.combat!.turn}, hull ${Math.round(s.res.hull)}/${derive(s).maxHull}`);
          closeCombat(s);
        }
        else combatTurn(s, combatAction(s)) || combatTurn(s, { k: 'fire' });
        break;
      case 'away':
        runAway(s);
        break;
      case 'map':
        mapTurn(s, memo);
        break;
      default:
        break;
    }
    if (s.day === lastDay) {
      if (++sameDay > 400) {
        report.stuck++;
        rest(s);
        sameDay = 0;
      }
    } else {
      sameDay = 0;
      lastDay = s.day;
    }
  }
  return report;
}
