/** Hisui's Pokémon — Sinnoh long ago — with its regional forms, Nobles and the Origin Forme legends. */
import type { Species } from '../species';
import { FLY, s } from './make';

export const HISUI_SPECIES: Species[] = [
  // Hisuian forms (PokeAPI form ids)
  s(10229, 'Hisuian Growlithe', ['fire', 'rock'], 2.2, 1.2, 190, { armor: 0.2 }),
  s(10230, 'Hisuian Arcanine', ['fire', 'rock'], 9, 1.3, 75, { armor: 0.3 }),
  s(10231, 'Hisuian Voltorb', ['electric', 'grass'], 1.8, 1.5, 190, { explode: { radius: 1.2, duration: 1 } }),
  s(10232, 'Hisuian Electrode', ['electric', 'grass'], 5, 1.8, 60, { explode: { radius: 1.6, duration: 1.5 } }),
  s(10233, 'Hisuian Typhlosion', ['fire', 'ghost'], 9, 1.1, 45),
  s(10234, 'Hisuian Qwilfish', ['dark', 'poison'], 2.4, 1.2, 45, { armor: 0.2 }),
  s(10235, 'Hisuian Sneasel', ['fighting', 'poison'], 2.2, 1.6, 60),
  s(10236, 'Hisuian Samurott', ['water', 'dark'], 9, 1.2, 45, { armor: 0.2 }),
  s(10237, 'Hisuian Lilligant', ['grass', 'fighting'], 8, 1.4, 45),
  s(10238, 'Hisuian Zorua', ['normal', 'ghost'], 1.8, 1.3, 75, { traits: ['invisible'] }),
  s(10239, 'Hisuian Zoroark', ['normal', 'ghost'], 6, 1.4, 45, { traits: ['invisible'] }),
  s(10240, 'Hisuian Braviary', ['psychic', 'flying'], 7, 1.3, 60, FLY),
  s(10241, 'Hisuian Sliggoo', ['steel', 'dragon'], 4.4, 0.7, 45, { armor: 0.4 }),
  s(10242, 'Hisuian Goodra', ['steel', 'dragon'], 10, 0.7, 45, { armor: 0.45 }),
  s(10243, 'Hisuian Avalugg', ['ice', 'rock'], 12, 0.6, 55, { armor: 0.55 }),
  s(10244, 'Hisuian Decidueye', ['grass', 'fighting'], 9, 1.1, 45),
  s(10247, 'Basculin', ['water'], 2, 1.5, 25),

  // New in Hisui
  s(899, 'Wyrdeer', ['normal', 'psychic'], 7, 1.3, 135),
  s(900, 'Kleavor', ['bug', 'rock'], 8, 1.3, 15, { armor: 0.35 }),
  s(901, 'Ursaluna', ['ground', 'normal'], 12, 0.8, 20, { armor: 0.35 }),
  s(902, 'Basculegion', ['water', 'ghost'], 8, 1.3, 25),
  s(903, 'Sneasler', ['fighting', 'poison'], 7, 1.7, 20),
  s(904, 'Overqwil', ['dark', 'poison'], 7, 1.2, 45, { armor: 0.3 }),

  // Around Hisui
  s(47, 'Parasect', ['bug', 'grass'], 4.4, 0.7, 75, { armor: 0.15 }),
  s(193, 'Yanma', ['bug', 'flying'], 2.4, 1.6, 75, FLY),
  s(339, 'Barboach', ['water', 'ground'], 1.6, 1, 190),
  s(355, 'Duskull', ['ghost'], 1.8, 0.9, 190, { traits: ['invisible'] }),
  s(363, 'Spheal', ['ice', 'water'], 2.2, 0.8, 255),
  s(413, 'Wormadam', ['bug', 'grass'], 4.4, 0.8, 45, { armor: 0.2 }),
  s(424, 'Ambipom', ['normal'], 4.4, 1.6, 45),
  s(433, 'Chingling', ['psychic'], 1.2, 1.1, 120),
  s(438, 'Bonsly', ['rock'], 1.8, 0.7, 255, { armor: 0.4 }),
  s(446, 'Munchlax', ['normal'], 4, 0.6, 50, { regen: 0.02 }),
  s(463, 'Lickilicky', ['normal'], 9, 0.7, 30, { regen: 0.02 }),
  s(464, 'Rhyperior', ['ground', 'rock'], 11, 0.7, 30, { armor: 0.5 }),
  s(465, 'Tangrowth', ['grass'], 9, 0.8, 30, { regen: 0.03 }),
  s(470, 'Leafeon', ['grass'], 6, 1.3, 45),
  s(471, 'Glaceon', ['ice'], 6, 1.2, 45),

  // The Origin Forme legends
  s(10007, 'Giratina (Origin)', ['ghost', 'dragon'], 32, 0.9, 3, { traits: ['flying'], armor: 0.3 }),
  s(10245, 'Dialga (Origin)', ['steel', 'dragon'], 26, 0.8, 3, { armor: 0.45 }),
  s(10246, 'Palkia (Origin)', ['water', 'dragon'], 26, 0.9, 3, { armor: 0.3 }),
];
