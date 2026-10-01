/**
 * Every Pokémon that can live on the farm: the Kanto starters and the wild
 * Pokémon of Route 1, with their evolutions.
 *
 * Stats are folded down to four, from the games' base stats: HP, Attack (the
 * higher of Attack and Sp. Atk), Defense (the mean of Defense and Sp. Def) and
 * Speed. A helper's farm job comes from its type (see `jobFor`).
 */
import type { PokeType } from './types';

/** What a helper does around the farm. */
export type Job = 'water' | 'tend' | 'guard' | 'harvest' | 'power' | 'none';

export interface Base {
  hp: number;
  atk: number;
  def: number;
  spe: number;
}

export interface Species {
  dex: number;
  name: string;
  types: readonly PokeType[];
  base: Base;
  catchRate: number;
  evolves?: { to: number; level: number };
  job: Job;
}

/** The first of a Pokémon's types that has a job decides what it does. */
const JOB_BY_TYPE: readonly [PokeType, Job][] = [
  ['water', 'water'], ['grass', 'tend'], ['bug', 'tend'], ['fire', 'guard'], ['flying', 'guard'],
  ['dark', 'guard'], ['normal', 'harvest'], ['fighting', 'harvest'], ['ground', 'harvest'], ['rock', 'harvest'], ['steel', 'harvest'], ['electric', 'power'],
];

export function jobFor(types: readonly PokeType[]): Job {
  for (const [type, job] of JOB_BY_TYPE) if (types.includes(type)) return job;
  return 'none';
}

function s(dex: number, name: string, types: PokeType[], [hp, atk, def, spe]: [number, number, number, number], catchRate: number, evolves?: [to: number, level: number]): Species {
  return { dex, name, types, base: { hp, atk, def, spe }, catchRate, job: jobFor(types), ...(evolves ? { evolves: { to: evolves[0], level: evolves[1] } } : {}) };
}

const LIST: readonly Species[] = [
  s(1, 'Bulbasaur', ['grass', 'poison'], [45, 65, 57, 45], 45, [2, 16]),
  s(2, 'Ivysaur', ['grass', 'poison'], [60, 80, 72, 60], 45, [3, 32]),
  s(3, 'Venusaur', ['grass', 'poison'], [80, 100, 92, 80], 45),
  s(4, 'Charmander', ['fire'], [39, 60, 47, 65], 45, [5, 16]),
  s(5, 'Charmeleon', ['fire'], [58, 80, 62, 80], 45, [6, 36]),
  s(6, 'Charizard', ['fire', 'flying'], [78, 109, 82, 100], 45),
  s(7, 'Squirtle', ['water'], [44, 50, 65, 43], 45, [8, 16]),
  s(8, 'Wartortle', ['water'], [59, 65, 80, 58], 45, [9, 36]),
  s(9, 'Blastoise', ['water'], [79, 85, 103, 78], 45),
  s(10, 'Caterpie', ['bug'], [45, 30, 28, 45], 255, [11, 7]),
  s(11, 'Metapod', ['bug'], [50, 25, 40, 30], 120, [12, 10]),
  s(12, 'Butterfree', ['bug', 'flying'], [60, 90, 65, 70], 45),
  s(13, 'Weedle', ['bug', 'poison'], [40, 35, 25, 50], 255, [14, 7]),
  s(14, 'Kakuna', ['bug', 'poison'], [45, 25, 40, 35], 120, [15, 10]),
  s(15, 'Beedrill', ['bug', 'poison'], [65, 90, 60, 75], 45),
  s(16, 'Pidgey', ['normal', 'flying'], [40, 45, 38, 56], 255, [17, 18]),
  s(17, 'Pidgeotto', ['normal', 'flying'], [63, 60, 53, 71], 120, [18, 36]),
  s(18, 'Pidgeot', ['normal', 'flying'], [83, 80, 73, 101], 45),
  s(19, 'Rattata', ['normal'], [30, 56, 35, 72], 255, [20, 20]),
  s(20, 'Raticate', ['normal'], [55, 81, 65, 97], 127),
  s(25, 'Pikachu', ['electric'], [35, 55, 45, 90], 190),
  s(27, 'Sandshrew', ['ground'], [50, 75, 58, 40], 255, [28, 22]),
  s(28, 'Sandslash', ['ground'], [75, 100, 83, 65], 90),
  s(41, 'Zubat', ['poison', 'flying'], [40, 45, 38, 55], 255, [42, 22]),
  s(42, 'Golbat', ['poison', 'flying'], [75, 80, 72, 90], 90),
  s(43, 'Oddish', ['grass', 'poison'], [45, 75, 60, 30], 255, [44, 21]),
  s(44, 'Gloom', ['grass', 'poison'], [60, 85, 73, 40], 120),
  s(46, 'Paras', ['bug', 'grass'], [35, 70, 55, 25], 190, [47, 24]),
  s(47, 'Parasect', ['bug', 'grass'], [60, 95, 80, 30], 75),
  s(50, 'Diglett', ['ground'], [10, 55, 35, 95], 255, [51, 26]),
  s(51, 'Dugtrio', ['ground'], [35, 100, 60, 120], 50),
  s(54, 'Psyduck', ['water'], [50, 65, 49, 55], 190, [55, 33]),
  s(55, 'Golduck', ['water'], [80, 95, 79, 85], 75),
  s(58, 'Growlithe', ['fire'], [55, 70, 48, 60], 190),
  s(66, 'Machop', ['fighting'], [70, 80, 43, 35], 180, [67, 28]),
  s(67, 'Machoke', ['fighting'], [80, 100, 65, 45], 90),
  s(69, 'Bellsprout', ['grass', 'poison'], [50, 75, 33, 40], 255, [70, 21]),
  s(70, 'Weepinbell', ['grass', 'poison'], [65, 90, 48, 55], 120),
  s(74, 'Geodude', ['rock', 'ground'], [40, 80, 65, 20], 255, [75, 25]),
  s(75, 'Graveler', ['rock', 'ground'], [55, 95, 80, 35], 120),
  s(79, 'Slowpoke', ['water', 'psychic'], [90, 65, 53, 15], 190, [80, 37]),
  s(80, 'Slowbro', ['water', 'psychic'], [95, 100, 95, 30], 75),
  s(92, 'Gastly', ['ghost', 'poison'], [30, 100, 33, 80], 190, [93, 25]),
  s(93, 'Haunter', ['ghost', 'poison'], [45, 115, 50, 95], 90),
  s(95, 'Onix', ['rock', 'ground'], [35, 45, 85, 70], 45),
  s(113, 'Chansey', ['normal'], [250, 35, 55, 50], 30),
  s(133, 'Eevee', ['normal'], [55, 55, 58, 55], 45),
  s(163, 'Hoothoot', ['normal', 'flying'], [60, 36, 43, 50], 255, [164, 20]),
  s(164, 'Noctowl', ['normal', 'flying'], [100, 86, 73, 70], 90),
  s(167, 'Spinarak', ['bug', 'poison'], [40, 60, 40, 30], 255, [168, 22]),
  s(168, 'Ariados', ['bug', 'poison'], [70, 90, 70, 40], 90),
  s(179, 'Mareep', ['electric'], [55, 65, 43, 35], 235, [180, 15]),
  s(180, 'Flaaffy', ['electric'], [70, 80, 58, 45], 120, [181, 30]),
  s(181, 'Ampharos', ['electric'], [90, 115, 88, 55], 45),
  s(187, 'Hoppip', ['grass', 'flying'], [35, 35, 48, 50], 255, [188, 18]),
  s(188, 'Skiploom', ['grass', 'flying'], [55, 45, 58, 80], 120, [189, 27]),
  s(189, 'Jumpluff', ['grass', 'flying'], [75, 55, 83, 110], 45),
  s(191, 'Sunkern', ['grass'], [30, 30, 30, 30], 235),
  s(194, 'Wooper', ['water', 'ground'], [55, 45, 35, 15], 255, [195, 20]),
  s(195, 'Quagsire', ['water', 'ground'], [95, 85, 75, 35], 90),
  s(198, 'Murkrow', ['dark', 'flying'], [60, 85, 42, 91], 30),
  s(204, 'Pineco', ['bug'], [50, 65, 58, 15], 190, [205, 31]),
  s(205, 'Forretress', ['bug', 'steel'], [75, 90, 100, 40], 75),
  s(206, 'Dunsparce', ['normal'], [100, 70, 70, 45], 190),
  s(215, 'Sneasel', ['dark', 'ice'], [55, 95, 65, 115], 60),
  s(216, 'Teddiursa', ['normal'], [60, 80, 50, 40], 120, [217, 30]),
  s(217, 'Ursaring', ['normal'], [90, 130, 75, 55], 60),
  s(220, 'Swinub', ['ice', 'ground'], [50, 50, 35, 50], 225, [221, 33]),
  s(221, 'Piloswine', ['ice', 'ground'], [100, 100, 70, 50], 75),
  s(225, 'Delibird', ['ice', 'flying'], [45, 65, 45, 75], 45),
  s(231, 'Phanpy', ['ground'], [90, 60, 50, 40], 120, [232, 25]),
  s(232, 'Donphan', ['ground'], [90, 120, 90, 50], 60),
  s(241, 'Miltank', ['normal'], [95, 80, 88, 100], 45),
  s(246, 'Larvitar', ['rock', 'ground'], [50, 64, 50, 41], 45, [247, 30]),
  s(247, 'Pupitar', ['rock', 'ground'], [70, 84, 70, 51], 45, [248, 55]),
  s(248, 'Tyranitar', ['rock', 'dark'], [100, 134, 105, 61], 45),
  s(270, 'Lotad', ['water', 'grass'], [40, 40, 40, 30], 255, [271, 14]),
  s(271, 'Lombre', ['water', 'grass'], [60, 60, 60, 50], 120),
  s(273, 'Seedot', ['grass'], [40, 40, 40, 30], 255, [274, 14]),
  s(274, 'Nuzleaf', ['grass', 'dark'], [70, 70, 40, 60], 120),
  s(285, 'Shroomish', ['grass'], [60, 40, 60, 35], 255, [286, 23]),
  s(286, 'Breloom', ['grass', 'fighting'], [60, 130, 70, 70], 90),
  s(296, 'Makuhita', ['fighting'], [72, 60, 30, 25], 180, [297, 24]),
  s(297, 'Hariyama', ['fighting'], [144, 120, 60, 50], 200),
  s(302, 'Sableye', ['dark', 'ghost'], [50, 75, 70, 50], 45),
  s(304, 'Aron', ['steel', 'rock'], [50, 70, 70, 30], 180, [305, 32]),
  s(305, 'Lairon', ['steel', 'rock'], [60, 90, 100, 40], 90),
  s(313, 'Volbeat', ['bug'], [65, 73, 80, 85], 150),
  s(314, 'Illumise', ['bug'], [65, 73, 80, 85], 150),
  s(415, 'Combee', ['bug', 'flying'], [30, 30, 42, 70], 120),
  s(459, 'Snover', ['grass', 'ice'], [60, 62, 55, 40], 120, [460, 40]),
  s(460, 'Abomasnow', ['grass', 'ice'], [90, 92, 80, 60], 60),
  s(831, 'Wooloo', ['normal'], [42, 40, 50, 48], 255, [832, 24]),
  s(832, 'Dubwool', ['normal'], [72, 80, 95, 88], 127),
];

export const SPECIES: ReadonlyMap<number, Species> = new Map(LIST.map((sp) => [sp.dex, sp]));

/** The three you can pick from on a new farm. */
export const STARTERS: readonly number[] = [1, 4, 7];

export function species(dex: number): Species {
  const sp = SPECIES.get(dex);
  if (!sp) throw new Error(`unknown Pokémon #${dex}`);
  return sp;
}

export const JOB_TEXT: Record<Job, string> = {
  water: 'Waters a thirsty crop every half hour.',
  tend: 'Tends a crop every half hour so it grows 50% faster.',
  guard: 'Keeps crows away from your field at night.',
  harvest: 'Picks ripe crops and puts them in the shipping bin.',
  power: 'Powers your machines: they run twice as fast while it is on the farm.',
  none: 'Keeps you company.'
};

/** Sprite sheet names: `1`, `1-shiny`, `1-back`. */
export function sheetName(dex: number, variant: 'front' | 'shiny' | 'back' = 'front'): string {
  return variant === 'front' ? `${dex}` : `${dex}-${variant}`;
}

export function cryUrl(dex: number): string {
  return `cries/${dex}.wav`;
}
