import { CLASS, ORIGIN } from '../data/crew';
import { ENEMY } from '../data/enemies';
import { GEAR_DEF, RARITIES } from '../data/gear';
import { CONSUMABLE_IDS, MAT, MAT_IDS } from '../data/materials';
import { MODULES } from '../data/modules';
import { BAL } from '../data/progression';
import { SECTORS } from '../data/sectors';
import type { ClassId, ConsumableId, ModuleId, Res } from '../data/types';
import type { GameState } from '../state/types';
import { endAway } from './away/mission';
import { signalLost, writeCheckpoint } from './checkpoint';
import { startCombat } from './combat';
import { makeGear } from './crafting';
import { equip, grantXp, healCrew, makeCrew, setMorale } from './crew';
import { conscious, derive, maxHp } from './derive';
import { openEvent, pickEvent } from './events';
import { canJump, node, reveal, revealAll } from './galaxy';
import { addLog } from './log';
import { rand, seeded, stateRng } from './rng';
import { questArrival, refreshStation } from './station';
import { currentMission, enterSector, missionNode } from './story';
import { allDown, passDay, refine } from './survival';

export const SAVE_VERSION = 1;

export function newGame(seed: number, now = 0): GameState {
  const res: Res = { ...BAL.start };
  const mats = Object.fromEntries(MAT_IDS.map((m) => [m, 0])) as GameState['mats'];
  const items = Object.fromEntries(CONSUMABLE_IDS.map((c) => [c, 0])) as GameState['items'];
  const modules = Object.fromEntries(MODULES.map((m) => [m.id, m.starts])) as Record<ModuleId, number>;
  return {
    version: SAVE_VERSION,
    savedAt: now,
    rng: seed,
    seed,
    screen: 'create',
    origin: '',
    day: 1,
    res,
    mats,
    items,
    modules,
    crew: [],
    gear: [],
    nextId: 1,
    sector: { index: 0, seed: 0, nodes: [] },
    at: 0,
    story: { idx: 0, done: [], flags: [] },
    colonists: 0,
    rep: { concord: 0, clans: 0, choir: 0 },
    quests: [],
    event: null,
    combat: null,
    away: null,
    lore: [],
    codex: { biomes: [], fauna: [], enemies: [] },
    log: [],
    checkpoint: null,
    lost: null,
    report: null,
    ending: null,
    stats: { jumps: 0, fights: 0, wins: 0, landings: 0, gathered: 0, kills: 0, reloads: 0, crafted: 0, seen: [] },
    settings: { sfx: 75, music: 55, muted: false },
  };
}

/** The companions who start with you depend on what you are. */
const STARTING_CREW: Record<ClassId, [ClassId, ClassId]> = {
  soldier: ['pilot', 'engineer'],
  engineer: ['pilot', 'medic'],
  scientist: ['pilot', 'engineer'],
  medic: ['pilot', 'engineer'],
  pilot: ['engineer', 'medic'],
};

export function createCaptain(s: GameState, name: string, originId: string, portrait: number[] = [0, 0, 0, 0, 0, 0]): boolean {
  const origin = ORIGIN.get(originId);
  if (!origin || s.screen !== 'create') return false;
  const r = seeded(s.seed ^ 0x1234567);
  s.origin = origin.id;
  const cap = makeCrew(s, r, origin.cls);
  cap.name = name.trim().slice(0, 24) || 'Captain';
  cap.captain = true;
  cap.portrait = portrait.slice(0, 6);
  for (const [k, v] of Object.entries(origin.stats)) cap.stats[k as keyof typeof cap.stats] += v;
  cap.hp = maxHp(cap);
  s.crew = [cap, ...STARTING_CREW[origin.cls].map((c) => makeCrew(s, r, c))];
  for (const [k, v] of Object.entries(origin.res)) s.res[k as keyof Res] += v;
  for (const [k, v] of Object.entries(origin.mats)) s.mats[k as keyof typeof s.mats] += v;
  for (const [k, v] of Object.entries(origin.rep)) s.rep[k as keyof typeof s.rep] += v;
  s.items.medkit = 2;
  s.items.o2can = 2;
  s.items.ration = 1;
  // Starting kit for everyone.
  for (const c of s.crew) {
    for (const base of ['w-cutter', 's-basic', 't-pick']) {
      const g = makeGear(s, r, base, 0);
      s.gear.push(g);
      equip(s, c, g.uid);
    }
  }
  const d = derive(s);
  s.res.hull = Math.min(s.res.hull, d.maxHull);
  s.screen = 'map';
  enterSector(s, 0);
  addLog(s, `Captain ${cap.name} wakes aboard the Wren. The Meridian is gone.`, 'story');
  return true;
}

// ---------------------------------------------------------------- Travel

export function jump(s: GameState, to: number): boolean {
  if (!canJump(s, to)) return false;
  const d = derive(s);
  s.res.fuel = Math.max(0, Math.round((s.res.fuel - d.fuelPerJump) * 100) / 100);
  for (const n of s.sector.nodes) n.mined = false;
  s.at = to;
  s.stats.jumps++;
  passDay(s);
  const refined = refine(s);
  if (refined) addLog(s, `The refinery cracked ice into ${refined} fuel.`, 'ship');
  const n = node(s);
  const first = !n.visited;
  n.visited = true;
  reveal(s);
  if (checkLost(s)) return true;
  arrive(s, first);
  return true;
}

/** Decides what happens on arrival: a story beat, a fight, an event, or nothing. */
export function arrive(s: GameState, first: boolean): void {
  const n = node(s);
  const m = currentMission(s);
  const pinned = missionNode(s);
  if (n.kind === 'station') {
    refreshStation(s, n);
    writeCheckpoint(s);
  }
  const quest = questArrival(s);
  if (quest.done.length) s.report = { title: 'Job done', lines: quest.done };
  if (m && pinned && pinned.id === n.id) {
    if (m.objective.k === 'reach') {
      openEvent(s, m.id, 'story');
      n.cleared = true;
      return;
    }
    if (m.objective.k === 'defeat') {
      startCombat(s, m.objective.enemy, { storyId: m.id });
      return;
    }
  }
  if (quest.bounty) {
    startCombat(s, quest.bounty.enemy ?? '@sector', { questUid: quest.bounty.uid });
    return;
  }
  if (n.cleared || n.story && m?.id !== n.story && ['patrol'].includes(n.kind)) {
    n.cleared = true;
    return;
  }
  n.cleared = true;
  const always = ['derelict', 'asteroids', 'nebula', 'anomaly', 'distress', 'patrol'].includes(n.kind);
  const chance = n.kind === 'system' ? 0.3 : n.kind === 'station' ? 0.12 : n.kind === 'entry' ? 0.4 : 0;
  if (always || (first && rand(s) < chance)) {
    // Friendly patrols wave you through.
    if (n.kind === 'patrol' && n.faction !== 'none' && s.rep[n.faction] >= 50) {
      s.report = { title: 'Friendly patrol', lines: ['The patrol recognises your ship and waves you through.'] };
      return;
    }
    const ev = pickEvent(s, n);
    if (ev) openEvent(s, ev.id, 'event');
  }
}

/** Out of fuel: send a distress call and hope the right people hear it. */
export function canDistress(s: GameState): boolean {
  return s.screen === 'map' && s.res.fuel < derive(s).fuelPerJump;
}

export function distress(s: GameState): boolean {
  if (!canDistress(s)) return false;
  passDay(s);
  if (checkLost(s)) return true;
  const roll = rand(s);
  if (roll < 0.55) {
    s.res.fuel += 3;
    s.report = { title: 'Distress call answered', lines: ['A passing trader tops up your tanks out of kindness.', '+3 fuel'] };
  } else if (roll < 0.8) {
    const price = Math.min(s.res.credits, 30 + 10 * s.sector.index);
    s.res.credits -= price;
    s.res.fuel += 4;
    s.report = { title: 'Distress call answered', lines: [`A Clan tanker sells you fuel at a robber's price.`, `−${price} credits`, '+4 fuel'] };
  } else {
    s.res.fuel += 2;
    startCombat(s, '@sector');
    s.report = { title: 'Distress call answered', lines: ['Pirates answer your call. At least they brought fuel you can take.'] };
  }
  addLog(s, 'Sent a distress call.', 'warn');
  return true;
}

/** Wait a day where you are: heal, grow food, recharge. */
export function rest(s: GameState): boolean {
  if (s.screen !== 'map') return false;
  passDay(s);
  checkLost(s);
  return true;
}

export function scanPlanet(s: GameState, i: number): boolean {
  const p = node(s).planets[i];
  if (!p || p.scanned || s.res.energy < 1) return false;
  s.res.energy -= 1;
  p.scanned = true;
  return true;
}

/** Systems have belts; a quick pass with the mining laser. Once per visit. */
export function canMine(s: GameState): boolean {
  const n = node(s);
  return s.screen === 'map' && (n.kind === 'system' || n.kind === 'asteroids') && !n.mined && s.res.energy >= 3;
}

export function mineBelt(s: GameState): string[] | null {
  if (!canMine(s)) return null;
  const n = node(s);
  n.mined = true;
  s.res.energy -= 3;
  const r = stateRng(s);
  const ore = 3 + Math.floor(r() * 4) + s.sector.index;
  const ice = 1 + Math.floor(r() * 3);
  s.mats.ore += ore;
  s.mats.ice += ice;
  const lines = [`+${ore} ${MAT.get('ore')!.name}`, `+${ice} ${MAT.get('ice')!.name}`];
  if (r() < 0.25) {
    s.mats.crystal += 1;
    lines.push(`+1 ${MAT.get('crystal')!.name}`);
  }
  if (r() < 0.15) {
    s.res.hull = Math.max(1, s.res.hull - 3);
    lines.push('−3 hull (a rock clipped you)');
  }
  return lines;
}

export function useItem(s: GameState, id: ConsumableId, crewId?: number): boolean {
  if (s.items[id] <= 0 || s.screen !== 'map') return false;
  const d = derive(s);
  switch (id) {
    case 'medkit': {
      const c = crewId !== undefined ? s.crew.find((m) => m.id === crewId) : [...s.crew].sort((a, b) => a.hp / maxHp(a) - b.hp / maxHp(b))[0];
      if (!c || c.hp >= maxHp(c)) return false;
      healCrew(c, 40);
      break;
    }
    case 'ration':
      if (s.res.food >= d.maxFood) return false;
      s.res.food = Math.min(d.maxFood, s.res.food + 6);
      break;
    case 'fuelcell':
      if (s.res.fuel >= d.maxFuel) return false;
      s.res.fuel = Math.min(d.maxFuel, s.res.fuel + 3);
      break;
    case 'powercell':
      if (s.res.energy >= d.maxEnergy) return false;
      s.res.energy = Math.min(d.maxEnergy, s.res.energy + 15);
      break;
    case 'repairkit':
      if (s.res.hull >= d.maxHull) return false;
      s.res.hull = Math.min(d.maxHull, s.res.hull + 12);
      break;
    case 'stim':
      for (const c of s.crew) setMorale(c, c.morale + 25);
      break;
    case 'scanner':
      revealAll(s);
      break;
    default:
      return false;
  }
  s.items[id]--;
  return true;
}

/** Engineers can patch the hull with alloy, anywhere. */
export function canPatch(s: GameState): boolean {
  return s.screen === 'map' && s.mats.alloy >= 1 && s.res.hull < derive(s).maxHull && s.crew.some((c) => c.cls === 'engineer' && conscious(c));
}

export function patchHull(s: GameState): boolean {
  if (!canPatch(s)) return false;
  const d = derive(s);
  s.mats.alloy--;
  s.res.hull = Math.min(d.maxHull, s.res.hull + Math.round(8 * (1 + (d.mods.repair ?? 0))));
  return true;
}

// ---------------------------------------------------------------- Closing screens

export function closeEvent(s: GameState): boolean {
  const ev = s.event;
  if (!ev || ev.result === null) return false;
  s.event = null;
  s.screen = 'map';
  if (s.ending) {
    s.screen = 'ending';
    return true;
  }
  if (checkLost(s)) return true;
  if (ev.then?.combat) startCombat(s, ev.then.combat);
  return true;
}

export function closeCombat(s: GameState): boolean {
  const c = s.combat;
  if (!c || !c.result) return false;
  s.combat = null;
  s.screen = 'map';
  if (c.result === 'lose') {
    signalLost(s);
    return true;
  }
  const lines: string[] = [];
  if (c.result === 'win' && c.loot) {
    lines.push(`+${c.loot.credits} credits`);
    for (const [m, n] of Object.entries(c.loot.mats)) lines.push(`+${n} ${MAT.get(m as keyof typeof s.mats)!.name}`);
    if (c.loot.gear) lines.push(`Salvaged: ${RARITIES[c.loot.gear.rarity]!.name} ${GEAR_DEF.get(c.loot.gear.base)!.name}`);
    if (c.questUid !== undefined) {
      const q = s.quests.find((x) => x.uid === c.questUid);
      if (q && !q.done) {
        q.done = true;
        s.res.credits += q.reward.credits;
        if (q.reward.rep) s.rep[q.reward.rep] = Math.min(100, s.rep[q.reward.rep] + 5);
        lines.push(`Bounty paid: +${q.reward.credits} credits`, ...grantXp(s, q.reward.xp));
      }
    }
    s.report = { title: `${ENEMY.get(c.enemyId)!.name} defeated`, lines };
    if (c.storyId) openEvent(s, c.storyId, 'story');
  } else if (c.result === 'fled') {
    // Fleeing a story fight leaves the node to try again.
    s.report = { title: 'Escaped', lines: ['You jump clear and limp back to where you were.'] };
  }
  checkLost(s);
  return true;
}

export function closeAway(s: GameState): boolean {
  if (!s.away || s.away.status === 'play') return false;
  endAway(s);
  return true;
}

export function closeReport(s: GameState): void {
  s.report = null;
}

export function ackLost(s: GameState): void {
  if (s.screen !== 'lost') return;
  s.lost = null;
  s.screen = 'map';
  // A little mercy after a reload: the Wake sends what it can spare, so a
  // checkpoint taken in a bad moment can't trap the campaign in a loop.
  const d = derive(s);
  s.res.hull = Math.max(s.res.hull, Math.round(d.maxHull * 0.5));
  s.res.food = Math.max(s.res.food, Math.ceil(d.eat * 5));
  s.res.energy = Math.max(s.res.energy, 15);
  s.res.fuel = Math.max(s.res.fuel, Math.ceil(d.fuelPerJump * 3));
  for (const c of s.crew) c.hp = Math.max(c.hp, Math.round(maxHp(c) * 0.5));
}

/** Hull gone or everyone down: back to the last dock. */
export function checkLost(s: GameState): boolean {
  if (s.res.hull <= 0 || allDown(s)) {
    signalLost(s);
    return true;
  }
  return false;
}

export function sectorName(s: GameState): string {
  return SECTORS[s.sector.index]!.name;
}

export function className(cls: ClassId): string {
  return CLASS.get(cls)!.name;
}

