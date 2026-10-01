/**
 * Moves, and which ones each Pokémon learns. There's no PP: a move can be
 * used as often as you like. Status moves lower the target's Attack or
 * Defense by one stage; drain moves heal by half the damage dealt.
 */
import { species } from './species';
import type { PokeType } from './types';

export interface Move {
  id: string;
  name: string;
  type: PokeType;
  /** 0 for status moves. */
  power: number;
  accuracy: number;
  priority?: number;
  drain?: boolean;
  lowers?: 'atk' | 'def';
}

function m(id: string, name: string, type: PokeType, power: number, accuracy = 100, extra: Partial<Move> = {}): Move {
  return { id, name, type, power, accuracy, ...extra };
}

const LIST: readonly Move[] = [
  m('tackle', 'Tackle', 'normal', 40), m('quick-attack', 'Quick Attack', 'normal', 40, 100, { priority: 1 }),
  m('headbutt', 'Headbutt', 'normal', 70), m('body-slam', 'Body Slam', 'normal', 85), m('double-edge', 'Double-Edge', 'normal', 110, 90),
  m('growl', 'Growl', 'normal', 0, 100, { lowers: 'atk' }), m('tail-whip', 'Tail Whip', 'normal', 0, 100, { lowers: 'def' }),
  m('ember', 'Ember', 'fire', 40), m('flame-wheel', 'Flame Wheel', 'fire', 60), m('flamethrower', 'Flamethrower', 'fire', 90), m('fire-blast', 'Fire Blast', 'fire', 110, 85),
  m('water-gun', 'Water Gun', 'water', 40), m('bubble-beam', 'Bubble Beam', 'water', 65), m('surf', 'Surf', 'water', 90), m('hydro-pump', 'Hydro Pump', 'water', 110, 80),
  m('vine-whip', 'Vine Whip', 'grass', 45), m('razor-leaf', 'Razor Leaf', 'grass', 55, 95), m('giga-drain', 'Giga Drain', 'grass', 75, 100, { drain: true }), m('energy-ball', 'Energy Ball', 'grass', 90),
  m('thunder-shock', 'Thunder Shock', 'electric', 40), m('spark', 'Spark', 'electric', 65), m('thunderbolt', 'Thunderbolt', 'electric', 90), m('thunder', 'Thunder', 'electric', 110, 70),
  m('bug-bite', 'Bug Bite', 'bug', 60), m('signal-beam', 'Signal Beam', 'bug', 75), m('x-scissor', 'X-Scissor', 'bug', 80), m('bug-buzz', 'Bug Buzz', 'bug', 90),
  m('gust', 'Gust', 'flying', 40), m('wing-attack', 'Wing Attack', 'flying', 60), m('air-slash', 'Air Slash', 'flying', 75, 95), m('hurricane', 'Hurricane', 'flying', 110, 70),
  m('mud-shot', 'Mud Shot', 'ground', 55, 95), m('bulldoze', 'Bulldoze', 'ground', 60), m('dig', 'Dig', 'ground', 80), m('earthquake', 'Earthquake', 'ground', 100),
  m('rock-throw', 'Rock Throw', 'rock', 50, 90), m('rock-tomb', 'Rock Tomb', 'rock', 60, 95), m('rock-slide', 'Rock Slide', 'rock', 75, 90), m('stone-edge', 'Stone Edge', 'rock', 100, 80),
  m('karate-chop', 'Karate Chop', 'fighting', 50), m('low-sweep', 'Low Sweep', 'fighting', 65), m('brick-break', 'Brick Break', 'fighting', 75), m('cross-chop', 'Cross Chop', 'fighting', 100, 80),
  m('lick', 'Lick', 'ghost', 30), m('shadow-sneak', 'Shadow Sneak', 'ghost', 40, 100, { priority: 1 }), m('shadow-punch', 'Shadow Punch', 'ghost', 60), m('shadow-ball', 'Shadow Ball', 'ghost', 80),
  m('confusion', 'Confusion', 'psychic', 50), m('psybeam', 'Psybeam', 'psychic', 65), m('zen-headbutt', 'Zen Headbutt', 'psychic', 80, 90), m('psychic', 'Psychic', 'psychic', 90),
  m('powder-snow', 'Powder Snow', 'ice', 40), m('icy-wind', 'Icy Wind', 'ice', 55, 95), m('ice-beam', 'Ice Beam', 'ice', 90), m('blizzard', 'Blizzard', 'ice', 110, 70),
  m('pursuit', 'Pursuit', 'dark', 40), m('bite', 'Bite', 'dark', 60), m('knock-off', 'Knock Off', 'dark', 65), m('crunch', 'Crunch', 'dark', 80),
  m('acid', 'Acid', 'poison', 40), m('sludge', 'Sludge', 'poison', 65), m('poison-jab', 'Poison Jab', 'poison', 80), m('sludge-bomb', 'Sludge Bomb', 'poison', 90),
];

export const MOVES: ReadonlyMap<string, Move> = new Map(LIST.map((mv) => [mv.id, mv]));

export function move(id: string): Move {
  const mv = MOVES.get(id);
  if (!mv) throw new Error(`unknown move ${id}`);
  return mv;
}

/** Each type's moves, weakest first. */
const TYPE_MOVES: Partial<Record<PokeType, readonly string[]>> = {
  normal: ['tackle', 'headbutt', 'body-slam', 'double-edge'],
  fire: ['ember', 'flame-wheel', 'flamethrower', 'fire-blast'],
  water: ['water-gun', 'bubble-beam', 'surf', 'hydro-pump'],
  grass: ['vine-whip', 'razor-leaf', 'giga-drain', 'energy-ball'],
  electric: ['thunder-shock', 'spark', 'thunderbolt', 'thunder'],
  bug: ['bug-bite', 'signal-beam', 'x-scissor', 'bug-buzz'],
  flying: ['gust', 'wing-attack', 'air-slash', 'hurricane'],
  ground: ['mud-shot', 'bulldoze', 'dig', 'earthquake'],
  rock: ['rock-throw', 'rock-tomb', 'rock-slide', 'stone-edge'],
  fighting: ['karate-chop', 'low-sweep', 'brick-break', 'cross-chop'],
  ghost: ['lick', 'shadow-sneak', 'shadow-punch', 'shadow-ball'],
  poison: ['acid', 'sludge', 'poison-jab', 'sludge-bomb'],
  psychic: ['confusion', 'psybeam', 'zen-headbutt', 'psychic'],
  ice: ['powder-snow', 'icy-wind', 'ice-beam', 'blizzard'],
  dark: ['pursuit', 'bite', 'knock-off', 'crunch'],
};

/** Levels the main type's moves come at, and the second type's. */
const MAIN_LEVELS = [5, 13, 24, 36];
const SECOND_LEVELS = [9, 20, 31];

/**
 * What a Pokémon learns and when, built from its types: Tackle and a
 * stat-lowering move to start, then its types' moves as it grows.
 */
export function learnset(dex: number): [level: number, move: string][] {
  const [main, second] = species(dex).types;
  const out: [number, string][] = [[1, 'tackle'], [1, main === 'normal' ? 'tail-whip' : 'growl']];
  if (main === 'normal') out.push([5, 'quick-attack']);
  const mainMoves = TYPE_MOVES[main!] ?? [];
  MAIN_LEVELS.forEach((lvl, i) => {
    const id = mainMoves[i];
    if (id && id !== 'tackle') out.push([lvl, id]);
  });
  const secondMoves = second ? TYPE_MOVES[second] ?? [] : [];
  SECOND_LEVELS.forEach((lvl, i) => {
    const id = secondMoves[i];
    if (id) out.push([lvl, id]);
  });
  return out.sort((a, b) => a[0] - b[0]);
}
