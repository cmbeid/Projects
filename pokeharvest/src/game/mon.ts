/** Pokémon you own: stats, experience, learning moves and evolving. */
import { learnset, move } from '../data/moves';
import { FRIENDSHIP } from '../data/ranch';
import { species, type Base } from '../data/species';
import { PARTY_SIZE, partyMons, type Mon, type World } from './model';
import { nextRandom, type Rng } from './rng';

export const MAX_LEVEL = 100;

export function statsOf(mon: { dex: number; level: number }): Base {
  const b = species(mon.dex).base;
  const L = mon.level;
  const stat = (base: number): number => Math.floor((2 * base * L) / 100) + 5;
  return { hp: Math.floor((2 * b.hp * L) / 100) + L + 10, atk: stat(b.atk), def: stat(b.def), spe: stat(b.spe) };
}

export function maxHp(mon: { dex: number; level: number }): number {
  return statsOf(mon).hp;
}

export function xpForLevel(level: number): number {
  return level <= 1 ? 0 : level ** 3;
}

/** The four most recent moves it knows at this level. */
export function movesAt(dex: number, level: number): string[] {
  const known = learnset(dex).filter(([l]) => l <= level).map(([, id]) => id);
  return [...new Set(known)].slice(-4);
}

/** A Pokémon, not yet anyone's: `uid` 0 until it joins you. */
export function makeMon(dex: number, level: number, rng: Rng): Mon {
  const mon: Mon = { uid: 0, dex, level, xp: xpForLevel(level), hp: 0, moves: movesAt(dex, level), shiny: nextRandom(rng) < 1 / 256, friendship: FRIENDSHIP.start, fed: true };
  mon.hp = maxHp(mon);
  return mon;
}

/** Give a Pokémon to the player: into the party if there's room (and `toParty`), else the box. */
export function adopt(world: World, mon: Mon, toParty = true): 'party' | 'box' {
  mon.uid = world.nextUid++;
  world.mons.push(mon);
  if (!world.seen.includes(mon.dex)) world.seen.push(mon.dex);
  if (!world.caught.includes(mon.dex)) world.caught.push(mon.dex);
  if (toParty && world.party.length < PARTY_SIZE) {
    world.party.push(mon.uid);
    return 'party';
  }
  return 'box';
}

/** Experience for beating a Pokémon, from its stats and level. */
export function xpYield(dex: number, level: number): number {
  const b = species(dex).base;
  return Math.max(1, Math.floor((((b.hp + b.atk + b.def + b.spe) / 4) * level) / 7));
}

/**
 * Add experience: levels, new moves (forgetting the weakest when it already
 * knows four) and evolution. Returns what happened, as lines to show.
 */
export function gainXp(mon: Mon, amount: number): string[] {
  const lines: string[] = [];
  mon.xp += amount;
  while (mon.level < MAX_LEVEL && mon.xp >= xpForLevel(mon.level + 1)) {
    const before = maxHp(mon);
    mon.level += 1;
    mon.hp = Math.max(0, mon.hp + maxHp(mon) - before);
    lines.push(`${species(mon.dex).name} grew to level ${mon.level}!`);
    for (const [lvl, id] of learnset(mon.dex)) {
      if (lvl !== mon.level || mon.moves.includes(id)) continue;
      lines.push(learn(mon, id));
    }
    const evo = species(mon.dex).evolves;
    if (evo && mon.level >= evo.level) {
      const from = species(mon.dex).name;
      const hpBefore = maxHp(mon);
      mon.dex = evo.to;
      mon.hp = Math.max(0, mon.hp + maxHp(mon) - hpBefore);
      lines.push(`What? ${from} evolved into ${species(mon.dex).name}!`);
    }
  }
  return lines;
}

function learn(mon: Mon, id: string): string {
  const name = species(mon.dex).name;
  if (mon.moves.length < 4) {
    mon.moves.push(id);
    return `${name} learned ${move(id).name}!`;
  }
  // A boost move takes the place of a stat-lowering one (Growl, Tail Whip), and is kept after.
  if (move(id).raises) {
    const lowering = mon.moves.find((k) => move(k).lowers);
    if (!lowering) return `${name} didn't learn ${move(id).name}.`;
    mon.moves[mon.moves.indexOf(lowering)] = id;
    return `${name} forgot ${move(lowering).name} and learned ${move(id).name}!`;
  }
  const weakest = mon.moves.filter((k) => !move(k).raises).sort((a, b) => move(a).power - move(b).power)[0];
  if (!weakest || move(weakest).power >= move(id).power) return `${name} didn't learn ${move(id).name}.`;
  mon.moves[mon.moves.indexOf(weakest)] = id;
  return `${name} forgot ${move(weakest).name} and learned ${move(id).name}!`;
}

/** Overnight, everyone rests. */
export function healAll(world: World): void {
  for (const mon of world.mons) mon.hp = maxHp(mon);
}

export function healthyParty(world: World): Mon[] {
  return partyMons(world).filter((m) => m.hp > 0);
}
