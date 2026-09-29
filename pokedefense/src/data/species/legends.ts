/** Box legends that turn up only as rare wild Pokémon on the endless maps, to catch as towers. */
import type { Species } from '../species';
import { FLY, s } from './make';

export const LEGEND_SPECIES: Species[] = [
  s(249, 'Lugia', ['psychic', 'flying'], 28, 1, 3, { ...FLY, armor: 0.3 }),
  s(250, 'Ho-Oh', ['fire', 'flying'], 28, 1, 3, { ...FLY, armor: 0.3, regen: 0.01 }),
  s(382, 'Kyogre', ['water'], 30, 0.9, 3, { armor: 0.3 }),
  s(383, 'Groudon', ['ground'], 30, 0.9, 3, { armor: 0.35 }),
  s(493, 'Arceus', ['normal'], 36, 0.9, 3, { armor: 0.4 }),
];
