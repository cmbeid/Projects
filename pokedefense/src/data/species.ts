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
  | { kind: 'heal'; fraction: number }
  /** Truant: loafs about, standing still every other `every` seconds (Slaking). */
  | { kind: 'truant'; every: number };

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


  // ---------------------------------------------------------------- Johto
  s(28, 'Sandslash', ['ground'], 4.4, 1, 90, { armor: 0.35 }),
  s(49, 'Venomoth', ['bug', 'poison'], 3.6, 1.3, 75, FLY),
  s(57, 'Primeape', ['fighting'], 4.2, 1.4, 75),
  s(79, 'Slowpoke', ['water', 'psychic'], 3, 0.5, 190, { regen: 0.02 }),
  s(80, 'Slowbro', ['water', 'psychic'], 7, 0.5, 75, { armor: 0.3, regen: 0.02 }),
  s(96, 'Drowzee', ['psychic'], 2.4, 0.9, 190),
  s(117, 'Seadra', ['water'], 4, 1.3, 75),
  s(152, 'Chikorita', ['grass'], 2, 0.9, 45),
  s(153, 'Bayleef', ['grass'], 4, 0.9, 45),
  s(154, 'Meganium', ['grass'], 8, 0.8, 45, { armor: 0.2 }),
  s(155, 'Cyndaquil', ['fire'], 2, 1.1, 45),
  s(156, 'Quilava', ['fire'], 4, 1.1, 45),
  s(157, 'Typhlosion', ['fire'], 8, 1, 45),
  s(158, 'Totodile', ['water'], 2, 1, 45),
  s(159, 'Croconaw', ['water'], 4, 1, 45),
  s(160, 'Feraligatr', ['water'], 9, 0.9, 45, { armor: 0.2 }),
  s(161, 'Sentret', ['normal'], 1, 1.4, 255),
  s(162, 'Furret', ['normal'], 3, 1.7, 90),
  s(163, 'Hoothoot', ['normal', 'flying'], 1.3, 1.1, 255, FLY),
  s(164, 'Noctowl', ['normal', 'flying'], 3.6, 1.2, 90, FLY),
  s(165, 'Ledyba', ['bug', 'flying'], 1.2, 1.1, 255, FLY),
  s(166, 'Ledian', ['bug', 'flying'], 3, 1.2, 90, FLY),
  s(167, 'Spinarak', ['bug', 'poison'], 1.2, 0.9, 255),
  s(168, 'Ariados', ['bug', 'poison'], 3.4, 1, 90),
  s(169, 'Crobat', ['poison', 'flying'], 5, 1.9, 90, FLY),
  s(175, 'Togepi', ['fairy'], 1.6, 0.8, 190),
  s(176, 'Togetic', ['fairy', 'flying'], 4, 1, 75, FLY),
  s(468, 'Togekiss', ['fairy', 'flying'], 8, 1.1, 30, FLY),
  s(178, 'Xatu', ['psychic', 'flying'], 5, 1.2, 75, { traits: ['flying'], abilities: [{ kind: 'teleport', every: 5, tiles: 2 }] }),
  s(179, 'Mareep', ['electric'], 1.6, 0.9, 235),
  s(180, 'Flaaffy', ['electric'], 3.4, 0.9, 120),
  s(181, 'Ampharos', ['electric'], 7, 0.8, 45, { armor: 0.15 }),
  s(190, 'Aipom', ['normal'], 2, 1.5, 45),
  s(194, 'Wooper', ['water', 'ground'], 1.6, 0.9, 255),
  s(195, 'Quagsire', ['water', 'ground'], 5, 0.8, 90, { armor: 0.15 }),
  s(196, 'Espeon', ['psychic'], 6, 1.3, 45),
  s(197, 'Umbreon', ['dark'], 7, 1, 45, { armor: 0.35 }),
  s(198, 'Murkrow', ['dark', 'flying'], 2.4, 1.5, 30, FLY),
  s(200, 'Misdreavus', ['ghost'], 2.6, 1.1, 45, { traits: ['flying', 'invisible'] }),
  s(429, 'Mismagius', ['ghost'], 6, 1.1, 45, { traits: ['flying', 'invisible'] }),
  s(203, 'Girafarig', ['normal', 'psychic'], 4, 1.1, 60),
  s(204, 'Pineco', ['bug'], 2, 0.7, 190, { armor: 0.3, explode: { radius: 1.2, duration: 1.5 } }),
  s(205, 'Forretress', ['bug', 'steel'], 5.5, 0.6, 75, { armor: 0.5, explode: { radius: 1.5, duration: 2 } }),
  s(208, 'Steelix', ['steel', 'ground'], 10, 0.7, 25, { armor: 0.55 }),
  s(209, 'Snubbull', ['fairy'], 2, 1, 190),
  s(210, 'Granbull', ['fairy'], 5, 1, 75, { armor: 0.15 }),
  s(211, 'Qwilfish', ['water', 'poison'], 2.6, 1.2, 45),
  s(214, 'Heracross', ['bug', 'fighting'], 6, 1.1, 45, { armor: 0.25 }),
  s(215, 'Sneasel', ['dark', 'ice'], 2.6, 1.7, 60),
  s(461, 'Weavile', ['dark', 'ice'], 6, 1.8, 45),
  s(216, 'Teddiursa', ['normal'], 2.2, 1, 120),
  s(217, 'Ursaring', ['normal'], 7, 0.9, 60, { armor: 0.2 }),
  s(218, 'Slugma', ['fire'], 2, 0.6, 190, { armor: 0.2 }),
  s(219, 'Magcargo', ['fire', 'rock'], 5, 0.6, 75, { armor: 0.45 }),
  s(220, 'Swinub', ['ice', 'ground'], 1.8, 1, 225),
  s(221, 'Piloswine', ['ice', 'ground'], 5.5, 0.9, 75, { armor: 0.25 }),
  s(222, 'Corsola', ['water', 'rock'], 3.4, 0.8, 60, { armor: 0.3, regen: 0.03 }),
  s(225, 'Delibird', ['ice', 'flying'], 2.8, 1.3, 45, FLY),
  s(226, 'Mantine', ['water', 'flying'], 5, 1.1, 25, FLY),
  s(227, 'Skarmory', ['steel', 'flying'], 5, 1.3, 25, { traits: ['flying'], armor: 0.45 }),
  s(228, 'Houndour', ['dark', 'fire'], 2, 1.3, 120),
  s(229, 'Houndoom', ['dark', 'fire'], 6, 1.3, 45),
  s(230, 'Kingdra', ['water', 'dragon'], 8, 1.1, 45, { armor: 0.2 }),
  s(231, 'Phanpy', ['ground'], 2.4, 0.9, 120, { armor: 0.2 }),
  s(232, 'Donphan', ['ground'], 7, 1, 60, { armor: 0.45, abilities: [{ kind: 'dash', every: 6, factor: 2.2, duration: 1 }] }),
  s(234, 'Stantler', ['normal'], 4, 1.4, 45),
  s(237, 'Hitmontop', ['fighting'], 5, 1.2, 45, { armor: 0.2 }),
  s(241, 'Miltank', ['normal'], 7, 1, 45, { armor: 0.2 }),
  s(243, 'Raikou', ['electric'], 12, 1.8, 3),
  s(244, 'Entei', ['fire'], 13, 1.6, 3),
  s(245, 'Suicune', ['water'], 13, 1.6, 3, { regen: 0.02 }),
  s(246, 'Larvitar', ['rock', 'ground'], 2, 0.8, 45, { armor: 0.3 }),
  s(247, 'Pupitar', ['rock', 'ground'], 4.4, 0.7, 45, { armor: 0.55 }),
  s(248, 'Tyranitar', ['rock', 'dark'], 12, 0.8, 45, { armor: 0.4 }),

  // ---------------------------------------------------------------- Hoenn
  s(252, 'Treecko', ['grass'], 2, 1.3, 45),
  s(253, 'Grovyle', ['grass'], 4, 1.5, 45),
  s(254, 'Sceptile', ['grass'], 8, 1.5, 45),
  s(255, 'Torchic', ['fire'], 2, 1, 45),
  s(256, 'Combusken', ['fire', 'fighting'], 4, 1.1, 45),
  s(257, 'Blaziken', ['fire', 'fighting'], 8, 1.2, 45),
  s(258, 'Mudkip', ['water'], 2, 0.9, 45),
  s(259, 'Marshtomp', ['water', 'ground'], 4.4, 0.8, 45),
  s(260, 'Swampert', ['water', 'ground'], 9, 0.8, 45, { armor: 0.25 }),
  s(262, 'Mightyena', ['dark'], 5, 1.4, 127),
  s(263, 'Zigzagoon', ['normal'], 1, 1.5, 255),
  s(264, 'Linoone', ['normal'], 3, 2, 90),
  s(265, 'Wurmple', ['bug'], 1, 0.9, 255, { evolve: { dex: 266, after: 12 } }),
  s(266, 'Silcoon', ['bug'], 2.2, 0.6, 120, { armor: 0.35, evolve: { dex: 267, after: 12 } }),
  s(267, 'Beautifly', ['bug', 'flying'], 3, 1.2, 45, FLY),
  s(268, 'Cascoon', ['bug'], 2.2, 0.6, 120, { armor: 0.35, evolve: { dex: 269, after: 12 } }),
  s(269, 'Dustox', ['bug', 'poison'], 3, 1.1, 45, FLY),
  s(273, 'Seedot', ['grass'], 1.2, 0.9, 255),
  s(274, 'Nuzleaf', ['grass', 'dark'], 3, 1.1, 120),
  s(275, 'Shiftry', ['grass', 'dark'], 6, 1.2, 45),
  s(276, 'Taillow', ['normal', 'flying'], 1.1, 1.5, 200, FLY),
  s(277, 'Swellow', ['normal', 'flying'], 3.6, 1.9, 45, FLY),
  s(279, 'Pelipper', ['water', 'flying'], 4.4, 1.1, 45, FLY),
  s(280, 'Ralts', ['psychic', 'fairy'], 1.4, 0.9, 235),
  s(281, 'Kirlia', ['psychic', 'fairy'], 3, 0.9, 120, { abilities: [{ kind: 'teleport', every: 5, tiles: 2 }] }),
  s(282, 'Gardevoir', ['psychic', 'fairy'], 7, 0.9, 45, { abilities: [{ kind: 'teleport', every: 5, tiles: 2.5 }] }),
  s(475, 'Gallade', ['psychic', 'fighting'], 7, 1, 45),
  s(285, 'Shroomish', ['grass'], 1.6, 0.8, 255, { regen: 0.03 }),
  s(286, 'Breloom', ['grass', 'fighting'], 5, 1.2, 90),
  s(287, 'Slakoth', ['normal'], 2.4, 0.6, 255, { abilities: [{ kind: 'truant', every: 1 }] }),
  s(288, 'Vigoroth', ['normal'], 5, 1.4, 120),
  s(289, 'Slaking', ['normal'], 14, 0.9, 45, { armor: 0.2, abilities: [{ kind: 'truant', every: 1 }] }),
  s(295, 'Exploud', ['normal'], 7, 1, 45, { abilities: [{ kind: 'stun', every: 8, radius: 1.8, duration: 1.5 }] }),
  s(296, 'Makuhita', ['fighting'], 3, 0.9, 180),
  s(297, 'Hariyama', ['fighting'], 9, 0.9, 200, { armor: 0.15 }),
  s(299, 'Nosepass', ['rock'], 5, 0.6, 255, { armor: 0.55 }),
  s(302, 'Sableye', ['dark', 'ghost'], 3.4, 1.1, 45, { traits: ['invisible'] }),
  s(304, 'Aron', ['steel', 'rock'], 2, 0.7, 180, { armor: 0.5 }),
  s(305, 'Lairon', ['steel', 'rock'], 4.4, 0.7, 90, { armor: 0.55 }),
  s(306, 'Aggron', ['steel', 'rock'], 10, 0.7, 45, { armor: 0.6 }),
  s(307, 'Meditite', ['fighting', 'psychic'], 2, 1.1, 180),
  s(308, 'Medicham', ['fighting', 'psychic'], 5, 1.2, 90),
  s(309, 'Electrike', ['electric'], 1.6, 1.6, 120),
  s(310, 'Manectric', ['electric'], 5, 1.8, 45, { abilities: [{ kind: 'stun', every: 8, radius: 1.6, duration: 1.5 }] }),
  s(311, 'Plusle', ['electric'], 2.4, 1.4, 200),
  s(312, 'Minun', ['electric'], 2.4, 1.4, 200),
  s(318, 'Carvanha', ['water', 'dark'], 1.8, 1.6, 225),
  s(319, 'Sharpedo', ['water', 'dark'], 5, 2, 60),
  s(320, 'Wailmer', ['water'], 5, 0.7, 125),
  s(321, 'Wailord', ['water'], 16, 0.6, 60, { bounty: 60 }),
  s(322, 'Numel', ['fire', 'ground'], 2.2, 0.8, 255),
  s(323, 'Camerupt', ['fire', 'ground'], 6, 0.8, 150, { armor: 0.25 }),
  s(324, 'Torkoal', ['fire'], 7, 0.6, 90, { armor: 0.5 }),
  s(325, 'Spoink', ['psychic'], 2, 1.2, 255),
  s(326, 'Grumpig', ['psychic'], 5, 1, 60),
  s(327, 'Spinda', ['normal'], 2.6, 1, 255, { abilities: [{ kind: 'teleport', every: 4, tiles: 1 }] }),
  s(328, 'Trapinch', ['ground'], 2, 0.7, 255, { armor: 0.3 }),
  s(329, 'Vibrava', ['ground', 'dragon'], 4, 1.2, 120, FLY),
  s(330, 'Flygon', ['ground', 'dragon'], 8, 1.4, 45, FLY),
  s(332, 'Cacturne', ['grass', 'dark'], 6, 1, 60),
  s(333, 'Swablu', ['normal', 'flying'], 1.6, 1.1, 255, FLY),
  s(334, 'Altaria', ['dragon', 'flying'], 7, 1.1, 45, { traits: ['flying'], regen: 0.02 }),
  s(337, 'Lunatone', ['rock', 'psychic'], 7, 0.9, 45, { traits: ['flying'], armor: 0.3 }),
  s(338, 'Solrock', ['rock', 'psychic'], 7, 0.9, 45, { traits: ['flying'], armor: 0.3 }),
  s(340, 'Whiscash', ['water', 'ground'], 6, 0.9, 75, { armor: 0.2 }),
  s(341, 'Corphish', ['water'], 2, 1, 205, { armor: 0.3 }),
  s(342, 'Crawdaunt', ['water', 'dark'], 5.5, 1.1, 155, { armor: 0.3 }),
  s(343, 'Baltoy', ['ground', 'psychic'], 2, 1, 255, { traits: ['flying'] }),
  s(344, 'Claydol', ['ground', 'psychic'], 6, 1, 90, { traits: ['flying'], armor: 0.3, abilities: [{ kind: 'teleport', every: 6, tiles: 2 }] }),
  s(349, 'Feebas', ['water'], 1.2, 0.8, 255, { bounty: 1 }),
  s(350, 'Milotic', ['water'], 10, 1, 60, { regen: 0.03 }),
  s(352, 'Kecleon', ['normal'], 4, 1, 200, { traits: ['invisible'] }),
  s(354, 'Banette', ['ghost'], 5, 1.2, 45, { traits: ['invisible'] }),
  s(356, 'Dusclops', ['ghost'], 7, 0.7, 90, { armor: 0.4, traits: ['invisible'] }),
  s(357, 'Tropius', ['grass', 'flying'], 6, 1, 200, FLY),
  s(358, 'Chimecho', ['psychic'], 3, 1, 45, { traits: ['flying'] }),
  s(359, 'Absol', ['dark'], 5, 1.4, 30, { abilities: [{ kind: 'dash', every: 5, factor: 2.2, duration: 0.8 }] }),
  s(362, 'Glalie', ['ice'], 6, 1, 75, { traits: ['flying'], armor: 0.25 }),
  s(364, 'Sealeo', ['ice', 'water'], 5, 0.9, 120),
  s(365, 'Walrein', ['ice', 'water'], 10, 0.8, 45, { armor: 0.3 }),
  s(370, 'Luvdisc', ['water'], 1, 1.4, 225),
  s(371, 'Bagon', ['dragon'], 2, 1, 45),
  s(372, 'Shelgon', ['dragon'], 4.4, 0.7, 45, { armor: 0.5 }),
  s(373, 'Salamence', ['dragon', 'flying'], 12, 1.3, 45, { traits: ['flying'], armor: 0.2 }),
  s(374, 'Beldum', ['steel', 'psychic'], 2, 0.9, 3, { traits: ['flying'], armor: 0.4 }),
  s(375, 'Metang', ['steel', 'psychic'], 5, 0.9, 3, { traits: ['flying'], armor: 0.45 }),
  s(376, 'Metagross', ['steel', 'psychic'], 12, 0.9, 3, { armor: 0.5 }),
  s(380, 'Latias', ['dragon', 'psychic'], 12, 1.6, 3, FLY),
  s(381, 'Latios', ['dragon', 'psychic'], 12, 1.7, 3, FLY),
  s(384, 'Rayquaza', ['dragon', 'flying'], 30, 1, 3, { traits: ['flying'], armor: 0.3 }),

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
