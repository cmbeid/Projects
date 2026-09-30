/**
 * Turn-based battles with wild Pokémon, one on one: your lead against the
 * wild one. Each turn you fight, use an item, switch or run, and the wild
 * Pokémon answers. Pure logic: every command returns what happened, in
 * order, for the battle screen to play back.
 */
import { ITEMS, item, seedId } from '../data/items';
import { move, type Move } from '../data/moves';
import { species } from '../data/species';
import { effectiveness } from '../data/types';
import { adopt, gainXp, healthyParty, makeMon, maxHp, statsOf, xpYield } from './mon';
import { SPAWN } from '../data/maps';
import { placeHelpers, syncHelpers } from './helpers';
import { hasPerk, monByUid, type Mon, type World } from './model';
import { nextRandom } from './rng';
import { addSkillXp } from './skills';
import { DAY_END } from './time';

export type Side = 'you' | 'wild';

export interface Stages {
  atk: number;
  def: number;
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
  | { kind: 'end'; result: NonNullable<Battle['over']> };

export type BattleAction =
  | { kind: 'move'; index: number }
  | { kind: 'item'; id: string }
  | { kind: 'switch'; uid: number }
  | { kind: 'run' };

const MAX_LURE = 3;
const TAMER_MAX_LURE = 4;

export function startBattle(world: World, dex: number, level: number): Battle | null {
  const lead = healthyParty(world)[0];
  if (!lead) return null;
  const wild = makeMon(dex, level, world.rng);
  const battle: Battle = {
    wild, active: lead.uid, stages: { you: { atk: 0, def: 0 }, wild: { atk: 0, def: 0 } },
    lure: 1, runs: 0, fought: [lead.uid], mustSwitch: false, over: null,
  };
  if (!world.seen.includes(dex)) world.seen.push(dex);
  world.battle = battle;
  world.player.path = [];
  world.player.pending = null;
  world.events.push({ kind: 'encounter', dex, level });
  return battle;
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

/** The wild Pokémon's pick: usually an attack, sometimes a status move. */
function wildMove(world: World, b: Battle): string {
  const moves = b.wild.moves;
  const weights = moves.map((id) => (move(id).power > 0 ? 3 : 1));
  let r = nextRandom(world.rng) * weights.reduce((a, w) => a + w, 0);
  for (let i = 0; i < moves.length; i += 1) {
    r -= weights[i]!;
    if (r < 0) return moves[i]!;
  }
  return moves[0]!;
}

/** After a hit: check for fainting, and settle the battle if it's decided. */
function checkFaints(world: World, b: Battle, out: BattleEvent[]): boolean {
  if (b.wild.hp <= 0) {
    out.push({ kind: 'faint', side: 'wild' }, { kind: 'text', text: `The wild ${species(b.wild.dex).name} fainted!` });
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

function win(world: World, b: Battle, out: BattleEvent[]): void {
  const xp = Math.floor(xpYield(b.wild.dex, b.wild.level) * (hasPerk(world, 'trainer') ? 1.25 : 1));
  for (const uid of b.fought) {
    const mon = monByUid(world, uid);
    if (!mon || mon.hp <= 0) continue;
    out.push({ kind: 'text', text: `${species(mon.dex).name} gained ${xp} XP!` });
    for (const line of gainXp(mon, xp)) out.push({ kind: 'text', text: line });
    if (uid === b.active) out.push({ kind: 'hp', side: 'you', hp: mon.hp, max: maxHp(mon) });
  }
  drops(world, b, out);
  world.stats.wins += 1;
  addSkillXp(world, 'battling', b.wild.level * 3);
  finish(b, 'win', out);
}

/** The chance a ball works this throw, 0–1. */
export function catchChance(world: World, b: Battle, ballId: string): number {
  const max = maxHp(b.wild);
  const rate = species(b.wild.dex).catchRate;
  const ball = item(ballId).ball ?? 1;
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

/** What you can do from the bag in battle: balls, healing berries, and berries to offer. */
export function battleItems(world: World): string[] {
  return Object.keys(world.inventory).filter((id) => {
    const def = ITEMS.get(id);
    return def && (def.kind === 'ball' || def.kind === 'crop');
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
    b.stages.you = { atk: 0, def: 0 };
    if (!b.fought.includes(action.uid)) b.fought.push(action.uid);
    out.push({ kind: 'send', uid: action.uid }, { kind: 'text', text: `Go, ${species(mon.dex).name}!` });
    if (!forced) {
      useMove(world, b, 'wild', wildMove(world, b), out);
      checkFaints(world, b, out);
    }
    return out;
  }

  if (action.kind === 'run') {
    const faster = statsOf(activeMon(world, b)).spe >= statsOf(b.wild).spe;
    b.runs += 1;
    if (faster || nextRandom(world.rng) < 0.25 + 0.25 * b.runs) {
      out.push({ kind: 'text', text: 'Got away safely!' });
      finish(b, 'run', out);
      return out;
    }
    out.push({ kind: 'text', text: "Couldn't get away!" });
    useMove(world, b, 'wild', wildMove(world, b), out);
    checkFaints(world, b, out);
    return out;
  }

  if (action.kind === 'item') {
    const def = ITEMS.get(action.id);
    if (!def || (world.inventory[action.id] ?? 0) <= 0) return out;
    if (def.kind === 'ball') {
      if (throwBall(world, b, action.id, out)) return out;
    } else if (def.kind === 'crop') {
      if (!useItem(world, b, action.id, out)) return out;
    } else {
      return out;
    }
    useMove(world, b, 'wild', wildMove(world, b), out);
    checkFaints(world, b, out);
    return out;
  }

  // Fight: priority first, then the faster; ties are a coin flip.
  const mine = activeMon(world, b);
  const myMove = mine.moves[action.index];
  if (!myMove) return out;
  const theirMove = wildMove(world, b);
  const mySpeed = statsOf(mine).spe;
  const theirSpeed = statsOf(b.wild).spe;
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
}
