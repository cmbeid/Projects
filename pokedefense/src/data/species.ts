/**
 * Every Pokémon the game shows — as a tower, an enemy, or both — with its
 * stats as an enemy. The numbers are relative: a Caterpie is 1 HP unit and
 * walks one tile a second. `src/game/waves.ts` scales HP per map and wave.
 *
 * Catch rates are the games' own (0–255): Caterpie 255, Snorlax 25, Mewtwo 3.
 */
import type { PokeType } from './types';

export type Trait = 'flying' | 'invisible';

export type Ability =
  /** Stops every tower within `radius` tiles for `duration` s. */
  | { kind: 'stun'; every: number; radius: number; duration: number }
  /** Calls `count` × `dex` onto the path just behind it. */
  | { kind: 'summon'; every: number; dex: number; count: number }
  /** Jumps `tiles` further along the path. */
  | { kind: 'teleport'; every: number; tiles: number }
  /** Runs at `factor` × speed for `duration` s. */
  | { kind: 'dash'; every: number; factor: number; duration: number }
  /** Cannot be hurt for `duration` s. */
  | { kind: 'shield'; every: number; duration: number }
  /** Cannot be seen for `duration` s. */
  | { kind: 'vanish'; every: number; duration: number }
  /** Once, at half HP: restores `fraction` of max HP. */
  | { kind: 'heal'; fraction: number };

export interface Species {
  dex: number;
  name: string;
  types: readonly PokeType[];
  /** HP in units of a Caterpie. */
  hp: number;
  /** Tiles per second. */
  speed: number;
  /** Fraction of each hit shrugged off, 0–0.6. */
  armor: number;
  /** ₽ for knocking it out, before scaling. */
  bounty: number;
  catchRate: number;
  traits: readonly Trait[];
  abilities: readonly Ability[];
  /** Regenerates this fraction of max HP per second. */
  regen: number;
  /** When knocked out, `count` × `dex` burst out. */
  split: { dex: number; count: number } | null;
  /** Left alive for `after` s, it evolves into `dex`. */
  evolve: { dex: number; after: number } | null;
  /** On fainting, stuns towers within `radius` for `duration` s (Self-Destruct). */
  explode: { radius: number; duration: number } | null;
}

type Extra = Partial<Omit<Species, 'dex' | 'name' | 'types' | 'hp' | 'speed' | 'catchRate'>>;

function s(dex: number, name: string, types: PokeType[], hp: number, speed: number, catchRate: number, extra: Extra = {}): Species {
  return {
    dex, name, types, hp, speed, catchRate,
    armor: 0, bounty: Math.max(1, Math.round(hp * 3)), traits: [], abilities: [], regen: 0,
    split: null, evolve: null, explode: null,
    ...extra,
  };
}

const FLY: Extra = { traits: ['flying'] };

const LIST: Species[] = [
  // Kanto starters and their lines (towers; rarely seen as enemies).
  s(1, 'Bulbasaur', ['grass', 'poison'], 2, 0.9, 45),
  s(2, 'Ivysaur', ['grass', 'poison'], 4, 0.9, 45),
  s(3, 'Venusaur', ['grass', 'poison'], 8, 0.8, 45, { armor: 0.2 }),
  s(4, 'Charmander', ['fire'], 2, 1, 45),
  s(5, 'Charmeleon', ['fire'], 4, 1, 45),
  s(6, 'Charizard', ['fire', 'flying'], 8, 1.1, 45, FLY),
  s(7, 'Squirtle', ['water'], 2, 0.9, 45),
  s(8, 'Wartortle', ['water'], 4, 0.9, 45),
  s(9, 'Blastoise', ['water'], 9, 0.8, 45, { armor: 0.25 }),

  // Viridian Forest
  s(10, 'Caterpie', ['bug'], 1, 0.9, 255, { evolve: { dex: 11, after: 14 } }),
  s(11, 'Metapod', ['bug'], 2.2, 0.6, 120, { armor: 0.35, evolve: { dex: 12, after: 12 } }),
  s(12, 'Butterfree', ['bug', 'flying'], 3, 1.1, 45, FLY),
  s(13, 'Weedle', ['bug', 'poison'], 1, 1, 255, { evolve: { dex: 14, after: 14 } }),
  s(14, 'Kakuna', ['bug', 'poison'], 2.2, 0.6, 120, { armor: 0.35, evolve: { dex: 15, after: 12 } }),
  s(15, 'Beedrill', ['bug', 'poison'], 3, 1.4, 45, FLY),
  s(16, 'Pidgey', ['normal', 'flying'], 1, 1.3, 255, FLY),
  s(17, 'Pidgeotto', ['normal', 'flying'], 2.4, 1.4, 120, FLY),
  s(18, 'Pidgeot', ['normal', 'flying'], 5, 1.6, 45, FLY),
  s(19, 'Rattata', ['normal'], 0.9, 1.7, 255),
  s(20, 'Raticate', ['normal'], 2.6, 1.7, 127, { abilities: [{ kind: 'dash', every: 5, factor: 2.2, duration: 1 }] }),
  s(23, 'Ekans', ['poison'], 1.6, 1.1, 255),
  s(24, 'Arbok', ['poison'], 3.6, 1.1, 90),
  s(25, 'Pikachu', ['electric'], 1.6, 1.5, 190),
  s(26, 'Raichu', ['electric'], 4, 1.4, 75),

  // Mt. Moon
  s(27, 'Sandshrew', ['ground'], 1.8, 1, 255, { armor: 0.25 }),
  s(35, 'Clefairy', ['fairy'], 2.4, 0.9, 150),
  s(36, 'Clefable', ['fairy'], 5, 0.9, 25),
  s(39, 'Jigglypuff', ['normal', 'fairy'], 2.6, 0.8, 170),
  s(40, 'Wigglytuff', ['normal', 'fairy'], 5.5, 0.8, 50),
  s(41, 'Zubat', ['poison', 'flying'], 0.9, 1.6, 255, FLY),
  s(42, 'Golbat', ['poison', 'flying'], 2.6, 1.6, 90, FLY),
  s(46, 'Paras', ['bug', 'grass'], 1.4, 0.9, 190),
  s(74, 'Geodude', ['rock', 'ground'], 2, 0.7, 255, { armor: 0.4 }),
  s(75, 'Graveler', ['rock', 'ground'], 4, 0.7, 120, { armor: 0.45 }),
  s(76, 'Golem', ['rock', 'ground'], 8, 0.7, 45, { armor: 0.5 }),
  s(95, 'Onix', ['rock', 'ground'], 6, 0.9, 45, { armor: 0.45 }),

  // S.S. Anne
  s(52, 'Meowth', ['normal'], 1.6, 1.3, 255, { bounty: 12 }),
  s(53, 'Persian', ['normal'], 3.6, 1.5, 90, { bounty: 25 }),
  s(60, 'Poliwag', ['water'], 1.4, 1, 255),
  s(61, 'Poliwhirl', ['water'], 3, 1, 120),
  s(62, 'Poliwrath', ['water', 'fighting'], 6, 0.9, 45, { armor: 0.2 }),
  s(66, 'Machop', ['fighting'], 2.2, 0.9, 180),
  s(67, 'Machoke', ['fighting'], 4.4, 0.9, 90, { armor: 0.15 }),
  s(68, 'Machamp', ['fighting'], 8, 0.9, 45, { armor: 0.2 }),
  s(72, 'Tentacool', ['water', 'poison'], 1.4, 1.1, 190),
  s(73, 'Tentacruel', ['water', 'poison'], 4, 1.1, 60),
  s(90, 'Shellder', ['water'], 1.6, 0.8, 190, { armor: 0.45 }),
  s(91, 'Cloyster', ['water', 'ice'], 5, 0.8, 60, { armor: 0.5, abilities: [{ kind: 'shield', every: 7, duration: 1.5 }] }),
  s(98, 'Krabby', ['water'], 1.6, 1, 225, { armor: 0.3 }),
  s(99, 'Kingler', ['water'], 4, 1, 60, { armor: 0.35 }),
  s(116, 'Horsea', ['water'], 1.2, 1.2, 225),
  s(120, 'Staryu', ['water'], 1.8, 1.2, 225, { regen: 0.04 }),
  s(121, 'Starmie', ['water', 'psychic'], 4.4, 1.3, 60, { regen: 0.04 }),
  s(129, 'Magikarp', ['water'], 1.2, 0.8, 255, { bounty: 1, evolve: { dex: 130, after: 10 } }),
  s(130, 'Gyarados', ['water', 'flying'], 9, 1, 45, { armor: 0.2, bounty: 30 }),

  // Celadon
  s(43, 'Oddish', ['grass', 'poison'], 1.4, 0.9, 255),
  s(44, 'Gloom', ['grass', 'poison'], 3, 0.9, 120),
  s(45, 'Vileplume', ['grass', 'poison'], 6, 0.8, 45, { armor: 0.15 }),
  s(69, 'Bellsprout', ['grass', 'poison'], 1.2, 1.1, 255),
  s(70, 'Weepinbell', ['grass', 'poison'], 2.8, 1.1, 120),
  s(71, 'Victreebel', ['grass', 'poison'], 6, 1, 45),
  s(102, 'Exeggcute', ['grass', 'psychic'], 1.3, 0.9, 90),
  s(103, 'Exeggutor', ['grass', 'psychic'], 7, 0.8, 45, { split: { dex: 102, count: 3 } }),
  s(114, 'Tangela', ['grass'], 4, 0.8, 45, { armor: 0.3, regen: 0.03 }),
  s(123, 'Scyther', ['bug', 'flying'], 4, 1.6, 45, FLY),
  s(133, 'Eevee', ['normal'], 2.4, 1.3, 45),
  s(134, 'Vaporeon', ['water'], 6, 1, 45),
  s(135, 'Jolteon', ['electric'], 4, 1.8, 45),
  s(136, 'Flareon', ['fire'], 5, 1.1, 45),

  // Pokémon Tower
  s(92, 'Gastly', ['ghost', 'poison'], 1.3, 1.1, 190, { traits: ['flying', 'invisible'] }),
  s(93, 'Haunter', ['ghost', 'poison'], 3, 1.1, 90, { traits: ['flying', 'invisible'] }),
  s(94, 'Gengar', ['ghost', 'poison'], 6, 1.1, 45, { traits: ['invisible'], abilities: [{ kind: 'teleport', every: 6, tiles: 2 }] }),
  s(104, 'Cubone', ['ground'], 2, 1, 190, { armor: 0.2 }),
  s(105, 'Marowak', ['ground'], 4.5, 1, 75, { armor: 0.3 }),
  s(88, 'Grimer', ['poison'], 2.4, 0.7, 190, { regen: 0.03 }),
  s(89, 'Muk', ['poison'], 6, 0.7, 75, { regen: 0.03, split: { dex: 88, count: 2 } }),
  s(109, 'Koffing', ['poison'], 1.8, 0.9, 190, { traits: ['flying'], explode: { radius: 1.2, duration: 1.5 } }),
  s(110, 'Weezing', ['poison'], 5, 0.9, 60, { traits: ['flying'], split: { dex: 109, count: 2 } }),

  // Silph Co.
  s(63, 'Abra', ['psychic'], 1.2, 0.9, 200, { abilities: [{ kind: 'teleport', every: 4, tiles: 2 }] }),
  s(64, 'Kadabra', ['psychic'], 3, 0.9, 100, { abilities: [{ kind: 'teleport', every: 4, tiles: 2.5 }] }),
  s(65, 'Alakazam', ['psychic'], 6, 0.9, 50, { abilities: [{ kind: 'teleport', every: 4, tiles: 3 }] }),
  s(81, 'Magnemite', ['electric', 'steel'], 1.4, 1, 190, { traits: ['flying'], armor: 0.3 }),
  s(82, 'Magneton', ['electric', 'steel'], 4.2, 1, 60, { traits: ['flying'], armor: 0.35, split: { dex: 81, count: 3 } }),
  s(100, 'Voltorb', ['electric'], 1.6, 1.4, 190, { explode: { radius: 1.2, duration: 1.5 } }),
  s(101, 'Electrode', ['electric'], 3.6, 1.9, 60, { explode: { radius: 1.6, duration: 2 } }),
  s(122, 'Mr. Mime', ['psychic', 'fairy'], 5, 0.9, 45, { abilities: [{ kind: 'shield', every: 6, duration: 1.5 }] }),
  s(131, 'Lapras', ['water', 'ice'], 8, 0.8, 45, { armor: 0.2 }),
  s(137, 'Porygon', ['normal'], 3, 1, 45, { abilities: [{ kind: 'vanish', every: 6, duration: 2 }] }),
  s(233, 'Porygon2', ['normal'], 6, 1, 45),

  // Cinnabar
  s(37, 'Vulpix', ['fire'], 1.6, 1.2, 190),
  s(38, 'Ninetales', ['fire'], 4.4, 1.3, 75),
  s(58, 'Growlithe', ['fire'], 2, 1.2, 190),
  s(59, 'Arcanine', ['fire'], 7, 1.3, 75, { abilities: [{ kind: 'dash', every: 6, factor: 2.5, duration: 1.2 }] }),
  s(77, 'Ponyta', ['fire'], 2, 1.6, 190),
  s(78, 'Rapidash', ['fire'], 4.4, 1.8, 60, { abilities: [{ kind: 'dash', every: 5, factor: 2, duration: 1 }] }),
  s(126, 'Magmar', ['fire'], 5, 1, 45, { armor: 0.15 }),
  s(151, 'Mew', ['psychic'], 6, 1.2, 45, { abilities: [{ kind: 'teleport', every: 5, tiles: 2 }] }),

  // Viridian Gym
  s(31, 'Nidoqueen', ['poison', 'ground'], 7, 0.8, 45, { armor: 0.35 }),
  s(32, 'Nidoran♂', ['poison'], 1.3, 1.1, 235),
  s(33, 'Nidorino', ['poison'], 3, 1.1, 120),
  s(34, 'Nidoking', ['poison', 'ground'], 7, 0.9, 45, { armor: 0.3 }),
  s(50, 'Diglett', ['ground'], 1, 1.5, 255, { abilities: [{ kind: 'vanish', every: 5, duration: 1 }] }),
  s(51, 'Dugtrio', ['ground'], 3.6, 1.6, 50, { split: { dex: 50, count: 3 } }),
  s(111, 'Rhyhorn', ['ground', 'rock'], 4, 0.8, 120, { armor: 0.45 }),
  s(112, 'Rhydon', ['ground', 'rock'], 9, 0.8, 60, { armor: 0.5 }),
  s(143, 'Snorlax', ['normal'], 16, 0.5, 25, { armor: 0.2, regen: 0.02, bounty: 60 }),

  // Indigo Plateau
  s(87, 'Dewgong', ['water', 'ice'], 6, 1, 75),
  s(106, 'Hitmonlee', ['fighting'], 5, 1.3, 45, { abilities: [{ kind: 'dash', every: 5, factor: 2.4, duration: 0.8 }] }),
  s(107, 'Hitmonchan', ['fighting'], 5, 1.1, 45, { armor: 0.25 }),
  s(124, 'Jynx', ['ice', 'psychic'], 5, 1, 45, { abilities: [{ kind: 'stun', every: 8, radius: 1.5, duration: 1.5 }] }),
  s(142, 'Aerodactyl', ['rock', 'flying'], 6, 1.8, 45, { traits: ['flying'], armor: 0.2 }),
  s(147, 'Dratini', ['dragon'], 2, 1.1, 45),
  s(148, 'Dragonair', ['dragon'], 5, 1.1, 45),
  s(149, 'Dragonite', ['dragon', 'flying'], 12, 1, 45, { traits: ['flying'], armor: 0.3 }),

  // Cerulean Cave
  s(132, 'Ditto', ['normal'], 3, 1, 35),
  s(150, 'Mewtwo', ['psychic'], 20, 1, 3, { armor: 0.3 }),

  // Towers only
  s(212, 'Scizor', ['bug', 'steel'], 7, 1.2, 25, { armor: 0.4 }),
];

export const SPECIES: ReadonlyMap<number, Species> = new Map(LIST.map((sp) => [sp.dex, sp]));

export function species(dex: number): Species {
  const sp = SPECIES.get(dex);
  if (!sp) throw new Error(`No species #${dex}`);
  return sp;
}

export function spriteUrl(dex: number, shiny = false): string {
  return shiny ? `sprites/${dex}-shiny.png` : `sprites/${dex}.png`;
}
export function sheetUrl(dex: number, shiny = false): string {
  return shiny ? `sprites/${dex}-shiny.json` : `sprites/${dex}.json`;
}
export function cryUrl(dex: number): string {
  return `cries/${dex}.wav`;
}
