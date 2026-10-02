/**
 * Turn-based battles with wild Pokémon, one on one: your lead against the
 * wild one. Each turn you fight, use an item, switch or run, and the wild
 * Pokémon answers. Pure logic: every command returns what happened, in
 * order, for the battle screen to play back.
 */
import { useMedicine } from './medicine';
import { ITEMS, item, seedId } from '../data/items';
import { KAI, kaiTeam, trainer as trainerData } from '../data/people';
import { spawnNpcs, weekOf } from './npcs';
import { move, type Move } from '../data/moves';
import { species } from '../data/species';
import { effectiveness } from '../data/types';
import { adopt, gainXp, healthyParty, makeMon, maxHp, statsOf, xpYield } from './mon';
import { SPAWN } from '../data/maps';
import { placeHelpers, syncHelpers } from './helpers';
import { hasBuff, hasPerk, monByUid, partyMons, type Mon, type World } from './model';
import { nextRandom } from './rng';
import { addSkillXp } from './skills';
import { DAY_END } from './time';

export type Side = 'you' | 'wild';

export interface Stages {
  atk: number;
  def: number;
  spe: number;
}

export function freshStages(): Stages {
  return { atk: 0, def: 0, spe: 0 };
}

const STAT_NAMES: Record<keyof Stages, string> = { atk: 'Attack', def: 'Defense', spe: 'Speed' };

/** A Pokémon's Speed with its stat stage: who moves first. */
function speedOf(world: World, b: Battle, side: Side): number {
  const mon = side === 'you' ? activeMon(world, b) : b.wild;
  return statsOf(mon).spe * stageMult(b.stages[side].spe);
}

export interface Battle {
  wild: Mon;
  /** The uid of your Pokémon out now. */
  active: number;
  stages: Record<Side, Stages>;
  /** How much offered berries have calmed it: multiplies the catch rate. */
  lure: number;
  runs: number;
  /** Your Pokémon that fought, who share the experience. */
  fought: number[];
  /** Your Pokémon fainted and you must send out another. */
  mustSwitch: boolean;
  /** A trainer battle: their team, and which one is out (as `wild`). */
  trainer: {
    id: string; name: string; team: Mon[]; index: number;
    /** Potions left: trainers from Granite Pass on carry one, Kai two. */
    potions: number;
    /** The turn Kai last switched, so he doesn't keep doing it. */
    switchedAt: number;
  } | null;
  /** Turns taken so far. */
  turn: number;
  over: null | 'win' | 'lose' | 'run' | 'caught';
}

export type BattleEvent =
  | { kind: 'text'; text: string }
  | { kind: 'attack'; side: Side; move: string }
  | { kind: 'hp'; side: Side; hp: number; max: number }
  | { kind: 'faint'; side: Side }
  | { kind: 'send'; uid: number }
  | { kind: 'throw'; ball: string }
  | { kind: 'shake'; count: number }
  | { kind: 'caught' }
  | { kind: 'sendWild'; index: number }
  | { kind: 'end'; result: NonNullable<Battle['over']> };

export type BattleAction =
  | { kind: 'move'; index: number }
  | { kind: 'item'; id: string; target?: number }
  | { kind: 'switch'; uid: number }
  | { kind: 'run' };

const MAX_LURE = 3;
const TAMER_MAX_LURE = 4;

export function startBattle(world: World, dex: number, level: number): Battle | null {
  return begin(world, makeMon(dex, level, world.rng), null);
}

function begin(world: World, wild: Mon, trainer: Battle['trainer']): Battle | null {
  const lead = healthyParty(world)[0];
  if (!lead) return null;
  const battle: Battle = {
    wild, active: lead.uid, stages: { you: freshStages(), wild: freshStages() },
    lure: 1, runs: 0, fought: [lead.uid], mustSwitch: false, over: null, trainer, turn: 0,
  };
  if (!world.seen.includes(wild.dex)) world.seen.push(wild.dex);
  world.battle = battle;
  world.player.path = [];
  world.player.pending = null;
  world.events.push({ kind: 'encounter', dex: wild.dex, level: wild.level });
  return battle;
}

/** Your first starter's line, by its first form (1, 4 or 7). */
export function starterOf(world: World): number {
  const first = world.mons.reduce((a, m) => (m.uid < a.uid ? m : a), world.mons[0]!);
  return first.dex <= 3 ? 1 : first.dex <= 6 ? 4 : 7;
}

/** Battle a trainer. Rematches in later weeks are a little stronger each time. */
export function startTrainerBattle(world: World, id: string): Battle | null {
  const t = id === 'kai' ? KAI : trainerData(id);
  const wins = world.trainers[id]?.wins ?? 0;
  const roster = id === 'kai' ? kaiTeam(starterOf(world), wins) : t.team.map(([d, l]): [number, number] => [d, l + Math.min(12, wins * 3)]);
  const team = roster.map(([d, l]) => {
    const mon = makeMon(d, l, world.rng);
    mon.shiny = false;
    return mon;
  });
  const potions = id === 'kai' ? 2 : t.map === 'route3' ? 1 : 0;
  return begin(world, team[0]!, { id, name: `${t.cls === 'Rival' ? '' : `${t.cls} `}${t.name}`, team, index: 0, potions, switchedAt: -99 });
}

export function activeMon(world: World, b: Battle): Mon {
  return monByUid(world, b.active)!;
}

function stageMult(stage: number): number {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
}

function label(world: World, b: Battle, side: Side): string {
  return side === 'wild' ? `The wild ${species(b.wild.dex).name}` : species(activeMon(world, b).dex).name;
}

/** Damage one hit would do, and how well it lands. */
export function damageFor(world: World, attacker: Mon, defender: Mon, mv: Move, stages: { atk: number; def: number }, boost = 1): { damage: number; effect: number; crit: boolean } {
  const effect = effectiveness(mv.type, species(defender.dex).types);
  if (effect === 0) return { damage: 0, effect, crit: false };
  const a = statsOf(attacker).atk * stageMult(stages.atk);
  const d = statsOf(defender).def * stageMult(stages.def);
  const base = Math.floor(Math.floor((Math.floor((2 * attacker.level) / 5 + 2) * mv.power * a) / d) / 50) + 2;
  const stab = species(attacker.dex).types.includes(mv.type) ? 1.5 : 1;
  const crit = nextRandom(world.rng) < 1 / 16;
  const roll = 0.85 + nextRandom(world.rng) * 0.15;
  return { damage: Math.max(1, Math.floor(base * stab * effect * roll * (crit ? 1.5 : 1) * boost)), effect, crit };
}

function useMove(world: World, b: Battle, side: Side, moveId: string, out: BattleEvent[]): void {
  const mv = move(moveId);
  const attacker = side === 'you' ? activeMon(world, b) : b.wild;
  const defender = side === 'you' ? b.wild : activeMon(world, b);
  const foe: Side = side === 'you' ? 'wild' : 'you';
  out.push({ kind: 'attack', side, move: moveId }, { kind: 'text', text: `${label(world, b, side)} used ${mv.name}!` });
  if (nextRandom(world.rng) * 100 >= mv.accuracy) {
    out.push({ kind: 'text', text: 'But it missed!' });
    return;
  }
  if (mv.raises) {
    const stage = b.stages[side];
    const { stat, by } = mv.raises;
    if (stage[stat] >= 6) {
      out.push({ kind: 'text', text: `${label(world, b, side)}'s ${STAT_NAMES[stat]} won't go any higher!` });
      return;
    }
    stage[stat] = Math.min(6, stage[stat] + by);
    out.push({ kind: 'text', text: `${label(world, b, side)}'s ${STAT_NAMES[stat]} rose${by > 1 ? ' sharply' : ''}!` });
    return;
  }
  if (mv.lowers) {
    const stage = b.stages[foe];
    if (stage[mv.lowers] <= -6) {
      out.push({ kind: 'text', text: 'Nothing happened!' });
      return;
    }
    stage[mv.lowers] -= 1;
    out.push({ kind: 'text', text: `${label(world, b, foe)}'s ${mv.lowers === 'atk' ? 'Attack' : 'Defense'} fell!` });
    return;
  }
  const boost = side === 'you' && hasPerk(world, 'ace') ? 1.15 : 1;
  const { damage, effect, crit } = damageFor(world, attacker, defender, mv, { atk: b.stages[side].atk, def: b.stages[foe].def }, boost);
  if (effect === 0) {
    out.push({ kind: 'text', text: `It doesn't affect ${label(world, b, foe)}...` });
    return;
  }
  defender.hp = Math.max(0, defender.hp - damage);
  out.push({ kind: 'hp', side: foe, hp: defender.hp, max: maxHp(defender) });
  if (crit) out.push({ kind: 'text', text: 'A critical hit!' });
  if (effect > 1) out.push({ kind: 'text', text: "It's super effective!" });
  if (effect < 1) out.push({ kind: 'text', text: "It's not very effective..." });
  if (mv.drain && attacker.hp > 0) {
    attacker.hp = Math.min(maxHp(attacker), attacker.hp + Math.max(1, Math.floor(damage / 2)));
    out.push({ kind: 'hp', side, hp: attacker.hp, max: maxHp(attacker) }, { kind: 'text', text: `${label(world, b, foe)} had its energy drained!` });
  }
}

/** What the other side does this turn. */
type FoeAction = { kind: 'move'; id: string } | { kind: 'potion' } | { kind: 'switch'; index: number };

/** How good a damaging move looks against your Pokémon out now. */
function moveScore(world: World, b: Battle, user: Mon, id: string): number {
  const mv = move(id);
  if (!mv.power) return 0;
  const stab = species(user.dex).types.includes(mv.type) ? 1.5 : 1;
  return mv.power * stab * effectiveness(mv.type, species(activeMon(world, b).dex).types) * (mv.accuracy / 100);
}

/** The wild Pokémon's pick: usually an attack, sometimes a status move, and no more boosting once it's well up. */
function wildMove(world: World, b: Battle): string {
  const moves = b.wild.moves;
  const weights = moves.map((id): number => {
    const mv = move(id);
    if (mv.raises) return b.stages.wild[mv.raises.stat] >= 2 ? 0 : 1;
    return mv.power > 0 ? 3 : 1;
  });
  let r = nextRandom(world.rng) * weights.reduce((a, w) => a + w, 0);
  for (let i = 0; i < moves.length; i += 1) {
    r -= weights[i]!;
    if (r < 0) return moves[i]!;
  }
  return moves[0]!;
}

/**
 * A trainer thinks a little: the move that hits hardest (now and then the
 * next best), a boost while healthy and ahead, a Potion when low, and Kai
 * swaps out of a bad matchup.
 */
function foeAction(world: World, b: Battle): FoeAction {
  const t = b.trainer;
  if (!t) return { kind: 'move', id: wildMove(world, b) };
  const me = b.wild;
  const max = maxHp(me);
  const team = t.team;
  const alive = team.filter((m) => m.hp > 0);
  if (t.potions > 0 && me.hp > 0 && me.hp < max * 0.3) return { kind: 'potion' };
  if (t.id === 'kai' && b.turn - t.switchedAt >= 3 && alive.length > 1) {
    const yours = activeMon(world, b);
    const threat = yours.moves.filter((id) => move(id).power > 0).map((id) => move(id).type);
    const hurts = threat.some((type) => effectiveness(type, species(me.dex).types) >= 2);
    const safe = team.findIndex((m, i) => i !== t.index && m.hp > 0 && threat.every((type) => effectiveness(type, species(m.dex).types) <= 1));
    if (hurts && safe >= 0) return { kind: 'switch', index: safe };
  }
  const ranked = me.moves.map((id) => ({ id, score: moveScore(world, b, me, id) })).sort((a, z) => z.score - a.score);
  const boost = me.moves.find((id) => {
    const up = move(id).raises;
    if (!up || b.stages.wild[up.stat] >= 2 || me.hp < max * 0.7) return false;
    const ahead = speedOf(world, b, 'wild') > speedOf(world, b, 'you');
    return up.stat === 'spe' ? !ahead : ahead;
  });
  if (boost && nextRandom(world.rng) < 0.5) return { kind: 'move', id: boost };
  const best = ranked[0];
  if (!best || best.score <= 0) return { kind: 'move', id: wildMove(world, b) };
  const second = ranked[1];
  return { kind: 'move', id: second && second.score > 0 && nextRandom(world.rng) < 0.25 ? second.id : best.id };
}

/** Carry out a trainer's Potion or switch (moves go through `useMove`). */
function foeItemOrSwitch(world: World, b: Battle, action: FoeAction, out: BattleEvent[]): void {
  const t = b.trainer!;
  if (action.kind === 'potion') {
    t.potions -= 1;
    const max = maxHp(b.wild);
    const heal = b.wild.level >= 20 ? 60 : 20;
    b.wild.hp = Math.min(max, b.wild.hp + heal);
    out.push({ kind: 'text', text: `${t.name} used a ${heal > 20 ? 'Super Potion' : 'Potion'}!` }, { kind: 'hp', side: 'wild', hp: b.wild.hp, max });
  } else if (action.kind === 'switch') {
    const from = species(b.wild.dex).name;
    t.index = action.index;
    t.switchedAt = b.turn;
    b.wild = t.team[action.index]!;
    b.stages.wild = freshStages();
    if (!world.seen.includes(b.wild.dex)) world.seen.push(b.wild.dex);
    out.push({ kind: 'text', text: `${t.name} withdrew ${from}!` }, { kind: 'sendWild', index: action.index }, { kind: 'text', text: `${t.name} sent out ${species(b.wild.dex).name}!` });
  }
}

/** The other side's turn, when yours wasn't an attack (a switch, an item, a failed run). */
function foeTurn(world: World, b: Battle, out: BattleEvent[]): void {
  b.turn += 1;
  const action = foeAction(world, b);
  if (action.kind === 'move') {
    useMove(world, b, 'wild', action.id, out);
    checkFaints(world, b, out);
  } else {
    foeItemOrSwitch(world, b, action, out);
  }
}

/** After a hit: check for fainting, and settle the battle if it's decided. */
function checkFaints(world: World, b: Battle, out: BattleEvent[]): boolean {
  if (b.wild.hp <= 0) {
    const whose = b.trainer ? `${b.trainer.name}'s` : 'The wild';
    out.push({ kind: 'faint', side: 'wild' }, { kind: 'text', text: `${whose} ${species(b.wild.dex).name} fainted!` });
    const next = b.trainer ? b.trainer.team.findIndex((m) => m.hp > 0) : -1;
    if (b.trainer && next >= 0) {
      // Experience for this one, then their next Pokémon still standing (Kai may have swapped them about).
      award(world, b, out);
      b.trainer.index = next;
      b.wild = b.trainer.team[b.trainer.index]!;
      b.stages.wild = freshStages();
      if (!world.seen.includes(b.wild.dex)) world.seen.push(b.wild.dex);
      out.push({ kind: 'sendWild', index: b.trainer.index }, { kind: 'text', text: `${b.trainer.name} sent out ${species(b.wild.dex).name}!` });
      return true;
    }
    win(world, b, out);
    return true;
  }
  const mine = activeMon(world, b);
  if (mine.hp <= 0) {
    out.push({ kind: 'faint', side: 'you' }, { kind: 'text', text: `${species(mine.dex).name} fainted!` });
    if (healthyParty(world).length) {
      b.mustSwitch = true;
    } else {
      out.push({ kind: 'text', text: 'You have no Pokémon left who can battle! You hurry home...' });
      finish(b, 'lose', out);
    }
    return true;
  }
  return false;
}

function finish(b: Battle, result: NonNullable<Battle['over']>, out: BattleEvent[]): void {
  b.over = result;
  out.push({ kind: 'end', result });
}

/** Drops: Rock and Ground types carry more stones. */
function drops(world: World, b: Battle, out: BattleEvent[]): void {
  const rocky = species(b.wild.dex).types.some((t) => t === 'rock' || t === 'ground' || t === 'steel');
  const r = nextRandom(world.rng);
  const found = rocky
    ? r < 0.08 ? 'nugget' : r < 0.3 ? 'metal-coat' : r < 0.8 ? 'hard-stone' : null
    : r < 0.02 ? 'nugget' : r < 0.1 ? 'metal-coat' : r < 0.35 ? 'hard-stone' : null;
  const seeds = nextRandom(world.rng) < 0.12 ? seedId(nextRandom(world.rng) < 0.5 ? 'leppa' : 'sitrus') : null;
  for (const id of [found, seeds]) {
    if (!id) continue;
    world.inventory[id] = (world.inventory[id] ?? 0) + 1;
    out.push({ kind: 'text', text: `It dropped a ${item(id).name}!` });
  }
}

/** Experience for beating the Pokémon in front of you. Trainers' Pokémon are worth half as much again. */
function award(world: World, b: Battle, out: BattleEvent[]): void {
  const xp = Math.floor(xpYield(b.wild.dex, b.wild.level) * (hasPerk(world, 'trainer') ? 1.25 : 1) * (hasBuff(world, 'coach') ? 1.5 : 1) * (b.trainer ? 1.5 : 1));
  for (const uid of b.fought) {
    const mon = monByUid(world, uid);
    if (!mon || mon.hp <= 0) continue;
    out.push({ kind: 'text', text: `${species(mon.dex).name} gained ${xp} XP!` });
    for (const line of gainXp(mon, xp)) out.push({ kind: 'text', text: line });
    if (uid === b.active) out.push({ kind: 'hp', side: 'you', hp: mon.hp, max: maxHp(mon) });
  }
  // The Exp. Share: everyone else in the party who's still standing learns from watching.
  if (!world.inventory['exp-share']) return;
  const share = Math.max(1, Math.floor(xp / 2));
  const rest = partyMons(world).filter((m) => m.hp > 0 && !b.fought.includes(m.uid));
  if (!rest.length) return;
  out.push({ kind: 'text', text: rest.length === 1 ? `${species(rest[0]!.dex).name} gained ${share} XP from the Exp. Share!` : `The rest of your team gained ${share} XP from the Exp. Share!` });
  for (const mon of rest) for (const line of gainXp(mon, share)) out.push({ kind: 'text', text: line });
}

function win(world: World, b: Battle, out: BattleEvent[]): void {
  award(world, b, out);
  world.stats.wins += 1;
  if (b.trainer) {
    const t = b.trainer.id === 'kai' ? KAI : trainerData(b.trainer.id);
    const record = world.trainers[b.trainer.id];
    world.trainers[b.trainer.id] = { week: weekOf(world.day), wins: (record?.wins ?? 0) + 1 };
    world.player.gold += t.reward;
    world.stats.earned += t.reward;
    out.push({ kind: 'text', text: `${b.trainer.name}: "${t.outro}"` }, { kind: 'text', text: `You got ${t.reward}g for winning!` });
    addSkillXp(world, 'battling', b.wild.level * 5);
  } else {
    drops(world, b, out);
    addSkillXp(world, 'battling', b.wild.level * 3);
  }
  finish(b, 'win', out);
}

/** Apricorn balls: much better against the right target. */
export function ballBonus(world: World, b: Battle, ballId: string): number {
  const types = species(b.wild.dex).types;
  switch (item(ballId).ballBonus) {
    case 'level': {
      const mine = activeMon(world, b).level;
      return mine >= b.wild.level * 2 ? 4 : mine > b.wild.level ? 2 : 1;
    }
    case 'water': return types.includes('water') ? 3 : 1;
    case 'fast': return species(b.wild.dex).base.spe >= 80 ? 4 : 1;
    case 'heavy': return types.includes('rock') || types.includes('steel') ? 3 : 1;
    default: return 1;
  }
}

/** The chance a ball works this throw, 0–1. */
export function catchChance(world: World, b: Battle, ballId: string): number {
  const max = maxHp(b.wild);
  const rate = species(b.wild.dex).catchRate;
  const ball = (item(ballId).ball ?? 1) * ballBonus(world, b, ballId);
  const perk = hasPerk(world, 'catcher') ? 1.5 : 1;
  const a = ((3 * max - 2 * b.wild.hp) * rate * ball * b.lure * perk) / (3 * max);
  return Math.min(1, a / 255);
}

function throwBall(world: World, b: Battle, ballId: string, out: BattleEvent[]): boolean {
  world.inventory[ballId] = (world.inventory[ballId] ?? 0) - 1;
  if (world.inventory[ballId]! <= 0) delete world.inventory[ballId];
  out.push({ kind: 'throw', ball: ballId }, { kind: 'text', text: `You threw a ${item(ballId).name}!` });
  // Four checks, as in the games: each one it passes is a shake; all four and it's yours.
  const each = Math.pow(catchChance(world, b, ballId), 1 / 4);
  let shakes = 0;
  while (shakes < 4 && nextRandom(world.rng) < each) shakes += 1;
  out.push({ kind: 'shake', count: Math.min(3, shakes) });
  const name = species(b.wild.dex).name;
  if (shakes < 4) {
    out.push({ kind: 'text', text: ['Oh no! It broke free!', 'Aww! It appeared to be caught!', 'Aargh! Almost had it!', 'Shoot! It was so close, too!'][shakes]! });
    return false;
  }
  if (ballId === 'friend-ball') b.wild.friendship = 200;
  const where = adopt(world, b.wild);
  out.push({ kind: 'caught' }, { kind: 'text', text: `Gotcha! ${name} is now your friend!` });
  out.push({ kind: 'text', text: where === 'party' ? `${name} joined your party.` : `Your party is full, so ${name} is waiting in the box at the farmhouse.` });
  addSkillXp(world, 'battling', b.wild.level * 5);
  finish(b, 'caught', out);
  return true;
}

/** Heal with a berry, or offer one to calm the wild Pokémon. Returns whether the wild one still gets its turn. */
function useItem(world: World, b: Battle, id: string, out: BattleEvent[]): boolean {
  const def = item(id);
  world.inventory[id] = (world.inventory[id] ?? 0) - 1;
  if (world.inventory[id]! <= 0) delete world.inventory[id];
  if (def.heals) {
    const mon = activeMon(world, b);
    const max = maxHp(mon);
    const amount = def.heals < 1 ? Math.floor(max * def.heals) : def.heals;
    mon.hp = Math.min(max, mon.hp + amount);
    out.push({ kind: 'hp', side: 'you', hp: mon.hp, max }, { kind: 'text', text: `${species(mon.dex).name} ate the ${def.name} and recovered HP!` });
    return true;
  }
  const cap = hasPerk(world, 'tamer') ? TAMER_MAX_LURE : MAX_LURE;
  const step = hasPerk(world, 'tamer') ? 1 : 0.5;
  b.lure = Math.min(cap, b.lure + step);
  out.push({ kind: 'text', text: `You offered a ${def.name}. The wild ${species(b.wild.dex).name} happily munches on it!` });
  out.push({ kind: 'text', text: b.lure >= cap ? 'It looks completely at ease with you.' : 'It seems friendlier.' });
  return false;
}

/** What you can do from the bag in battle: balls, medicine, healing berries, and berries to offer. */
export function battleItems(world: World): string[] {
  return Object.keys(world.inventory).filter((id) => {
    const def = ITEMS.get(id);
    return def && (def.kind === 'ball' || def.kind === 'crop' || def.kind === 'medicine');
  });
}

/** Take a turn. Returns what happened, in order. */
export function act(world: World, action: BattleAction): BattleEvent[] {
  const b = world.battle;
  const out: BattleEvent[] = [];
  if (!b || b.over) return out;

  if (b.mustSwitch && action.kind !== 'switch') return out;

  if (action.kind === 'switch') {
    const mon = monByUid(world, action.uid);
    if (!mon || mon.hp <= 0 || !world.party.includes(action.uid) || action.uid === b.active) return out;
    const forced = b.mustSwitch;
    b.mustSwitch = false;
    b.active = action.uid;
    b.stages.you = freshStages();
    if (!b.fought.includes(action.uid)) b.fought.push(action.uid);
    out.push({ kind: 'send', uid: action.uid }, { kind: 'text', text: `Go, ${species(mon.dex).name}!` });
    if (!forced) {
      foeTurn(world, b, out);
    }
    return out;
  }

  if (action.kind === 'run' && b.trainer) {
    out.push({ kind: 'text', text: "There's no running from a trainer battle!" });
    return out;
  }

  if (action.kind === 'run') {
    const faster = speedOf(world, b, 'you') >= speedOf(world, b, 'wild');
    b.runs += 1;
    if (faster || nextRandom(world.rng) < 0.25 + 0.25 * b.runs) {
      out.push({ kind: 'text', text: 'Got away safely!' });
      finish(b, 'run', out);
      return out;
    }
    out.push({ kind: 'text', text: "Couldn't get away!" });
    foeTurn(world, b, out);
    return out;
  }

  if (action.kind === 'item') {
    const def = ITEMS.get(action.id);
    if (!def || (world.inventory[action.id] ?? 0) <= 0) return out;
    if (def.kind === 'ball') {
      if (b.trainer) {
        out.push({ kind: 'text', text: "You can't catch another trainer's Pokémon!" });
        return out;
      }
      if (throwBall(world, b, action.id, out)) return out;
    } else if (def.kind === 'crop') {
      if (!useItem(world, b, action.id, out)) return out;
    } else if (def.kind === 'medicine') {
      // On whoever you pick: the Pokémon out now unless you say otherwise.
      const uid = action.target ?? b.active;
      const mon = world.party.includes(uid) ? monByUid(world, uid) : undefined;
      const line = mon && useMedicine(world, action.id, mon);
      if (!mon || !line) return out;
      out.push({ kind: 'text', text: `You used a ${def.name}.` });
      if (uid === b.active) out.push({ kind: 'hp', side: 'you', hp: mon.hp, max: maxHp(mon) });
      out.push({ kind: 'text', text: line });
    } else {
      return out;
    }
    foeTurn(world, b, out);
    return out;
  }

  // Fight: priority first, then the faster; ties are a coin flip.
  const mine = activeMon(world, b);
  const myMove = mine.moves[action.index];
  if (!myMove) return out;
  b.turn += 1;
  const theirs = foeAction(world, b);
  // A trainer's Potion or switch comes before anyone attacks.
  if (theirs.kind !== 'move') {
    foeItemOrSwitch(world, b, theirs, out);
    useMove(world, b, 'you', myMove, out);
    checkFaints(world, b, out);
    return out;
  }
  const theirMove = theirs.id;
  const mySpeed = speedOf(world, b, 'you');
  const theirSpeed = speedOf(world, b, 'wild');
  const pm = move(myMove).priority ?? 0;
  const pt = move(theirMove).priority ?? 0;
  const meFirst = pm !== pt ? pm > pt : mySpeed !== theirSpeed ? mySpeed > theirSpeed : nextRandom(world.rng) < 0.5;
  const order: [Side, string][] = meFirst ? [['you', myMove], ['wild', theirMove]] : [['wild', theirMove], ['you', myMove]];
  for (const [side, id] of order) {
    useMove(world, b, side, id, out);
    if (checkFaints(world, b, out)) break;
  }
  return out;
}

/**
 * Leave the battle. After a loss you wake at the farmhouse an hour later,
 * your Pokémon patched up and your wallet a little lighter.
 */
export function endBattle(world: World): void {
  const b = world.battle;
  world.battle = null;
  syncHelpers(world);
  if (!b || b.over !== 'lose') return;
  const p = world.player;
  p.gold -= Math.floor(p.gold * 0.1);
  world.map = 'farm';
  p.x = SPAWN.x;
  p.y = SPAWN.y;
  p.path = [];
  p.pending = null;
  world.clock = Math.min(DAY_END - 1, world.clock + 60);
  for (const mon of world.mons) if (world.party.includes(mon.uid)) mon.hp = Math.max(1, Math.floor(maxHp(mon) / 2));
  placeHelpers(world, SPAWN);
  spawnNpcs(world);
}
