/** The Orange Islands' Pokémon: Kanto's, mostly, plus the ones the Orange Archipelago adds. */
import type { Species } from '../species';
import { FLY, s } from './make';

export const ORANGE_SPECIES: Species[] = [
  // Professor Ivy's gifts
  s(48, 'Venonat', ['bug', 'poison'], 1.4, 1, 190),
  s(183, 'Marill', ['water', 'fairy'], 1.6, 1, 190),
  s(184, 'Azumarill', ['water', 'fairy'], 5, 1, 75, { armor: 0.15 }),

  // Around the islands
  s(54, 'Psyduck', ['water'], 1.6, 1, 190),
  s(55, 'Golduck', ['water'], 4.4, 1.2, 75),
  s(83, 'Farfetch’d', ['normal', 'flying'], 2, 1.4, 45, FLY),
  s(84, 'Doduo', ['normal', 'flying'], 1.6, 1.6, 190),
  s(85, 'Dodrio', ['normal', 'flying'], 4.4, 1.8, 45),
  s(86, 'Seel', ['water'], 2, 0.9, 190),
  s(108, 'Lickitung', ['normal'], 5, 0.7, 45, { regen: 0.02 }),
  s(113, 'Chansey', ['normal'], 8, 0.8, 30, { regen: 0.03 }),
  s(115, 'Kangaskhan', ['normal'], 6, 1, 45, { armor: 0.2 }),
  s(125, 'Electabuzz', ['electric'], 5, 1.2, 45, { abilities: [{ kind: 'stun', every: 9, radius: 1.5, duration: 1 }] }),
  s(127, 'Pinsir', ['bug'], 5, 1.1, 45, { armor: 0.25 }),
  s(128, 'Tauros', ['normal'], 5, 1.6, 45, { abilities: [{ kind: 'dash', every: 6, factor: 2, duration: 0.8 }] }),
  s(138, 'Omanyte', ['rock', 'water'], 2, 0.7, 45, { armor: 0.4 }),
  s(139, 'Omastar', ['rock', 'water'], 5.5, 0.7, 45, { armor: 0.45 }),
  s(140, 'Kabuto', ['rock', 'water'], 2, 0.8, 45, { armor: 0.4 }),
  s(141, 'Kabutops', ['rock', 'water'], 5.5, 1.2, 45, { armor: 0.35 }),
  s(186, 'Politoed', ['water'], 6, 1, 45, { regen: 0.02 }),
  s(223, 'Remoraid', ['water'], 1.4, 1.3, 190),
  s(224, 'Octillery', ['water'], 4.4, 1, 75, { armor: 0.15 }),
  s(298, 'Azurill', ['normal', 'fairy'], 1, 1, 150),
  s(29, 'Nidoran♀', ['poison'], 1.4, 1, 235),
  s(30, 'Nidorina', ['poison'], 3, 1, 120),
  s(97, 'Hypno', ['psychic'], 4.4, 1, 75, { abilities: [{ kind: 'stun', every: 10, radius: 1.5, duration: 1 }] }),
  s(199, 'Slowking', ['water', 'psychic'], 6, 0.7, 70, { regen: 0.03 }),

  // The legendary birds of Shamouti
  s(144, 'Articuno', ['ice', 'flying'], 16, 1.1, 3, { ...FLY, armor: 0.2 }),
  s(145, 'Zapdos', ['electric', 'flying'], 16, 1.2, 3, { ...FLY, armor: 0.2, abilities: [{ kind: 'stun', every: 8, radius: 2, duration: 1.5 }] }),
  s(146, 'Moltres', ['fire', 'flying'], 16, 1.1, 3, { ...FLY, armor: 0.2 }),
];
