/** Kitakami's and Blueberry Academy's Pokémon (Scarlet and Violet's DLC), with Ogerpon's masks and Terapagos's forms. */
import type { Species } from '../species';
import { FLY, s } from './make';

export const KITAKAMI_SPECIES: Species[] = [
  // Around Kitakami
  s(172, 'Pichu', ['electric'], 0.8, 1.3, 190),
  s(173, 'Cleffa', ['fairy'], 1, 0.9, 150),
  s(187, 'Hoppip', ['grass', 'flying'], 1, 1.3, 255, FLY),
  s(188, 'Skiploom', ['grass', 'flying'], 2.4, 1.4, 120, FLY),
  s(189, 'Jumpluff', ['grass', 'flying'], 4.4, 1.6, 45, FLY),
  s(191, 'Sunkern', ['grass'], 0.8, 0.7, 235),
  s(192, 'Sunflora', ['grass'], 4, 0.8, 120),
  s(206, 'Dunsparce', ['normal'], 3, 0.9, 190),
  s(261, 'Poochyena', ['dark'], 1.4, 1.2, 255),
  s(313, 'Volbeat', ['bug'], 2.4, 1.3, 150, FLY),
  s(314, 'Illumise', ['bug'], 2.4, 1.2, 150, FLY),
  s(316, 'Gulpin', ['poison'], 2, 0.8, 225),
  s(317, 'Swalot', ['poison'], 6, 0.8, 75, { regen: 0.02 }),
  s(361, 'Snorunt', ['ice'], 1.6, 1, 190),
  s(982, 'Dudunsparce', ['normal'], 9, 0.9, 45, { regen: 0.02 }),
  s(1011, 'Dipplin', ['grass', 'dragon'], 4, 0.8, 45, { armor: 0.3 }),
  s(1012, 'Poltchageist', ['grass', 'ghost'], 1.4, 1, 120),
  s(1013, 'Sinistcha', ['grass', 'ghost'], 7, 0.9, 60, { regen: 0.03 }),
  s(1018, 'Archaludon', ['steel', 'dragon'], 11, 0.8, 10, { armor: 0.5 }),
  s(1019, 'Hydrapple', ['grass', 'dragon'], 12, 0.7, 10, { armor: 0.35, regen: 0.02 }),

  // The Loyal Three, and Ogerpon in its masks (PokeAPI form ids)
  s(1014, 'Okidogi', ['poison', 'fighting'], 14, 1, 3, { armor: 0.35 }),
  s(1015, 'Munkidori', ['poison', 'psychic'], 12, 1.3, 3),
  s(1016, 'Fezandipiti', ['poison', 'fairy'], 12, 1.2, 3, FLY),
  s(1017, 'Ogerpon', ['grass'], 14, 1.2, 5),
  s(10273, 'Ogerpon (Wellspring Mask)', ['grass', 'water'], 14, 1.2, 5),
  s(10274, 'Ogerpon (Hearthflame Mask)', ['grass', 'fire'], 14, 1.3, 5),
  s(10275, 'Ogerpon (Cornerstone Mask)', ['grass', 'rock'], 14, 1.1, 5, { armor: 0.3 }),

  // Area Zero's depths
  s(1020, 'Gouging Fire', ['fire', 'dragon'], 12, 1.2, 10, { armor: 0.3 }),
  s(1021, 'Raging Bolt', ['electric', 'dragon'], 12, 1, 10, { armor: 0.3 }),
  s(1022, 'Iron Boulder', ['rock', 'psychic'], 12, 1.3, 10, { armor: 0.35 }),
  s(1023, 'Iron Crown', ['steel', 'psychic'], 12, 1.1, 10, { armor: 0.4 }),
  s(10276, 'Terapagos (Terastal Form)', ['normal'], 34, 0.8, 3, { armor: 0.45 }),
  s(10277, 'Terapagos (Stellar Form)', ['normal'], 34, 0.9, 3, { armor: 0.4 }),
];
