import type { Pack } from '../types';

/** The four elements every player starts with. Nothing produces these. */
export const basePack: Pack = {
  id: 'base',
  title: 'The Four',
  elements: [
    {
      id: 'air',
      name: 'Air',
      emoji: '💨',
      category: 'base',
      blurb: 'The thin, restless stuff that fills every gap. It carries everything else.',
    },
    {
      id: 'earth',
      name: 'Earth',
      emoji: '🟫',
      category: 'base',
      blurb: 'Patient and heavy. Given enough time, it becomes almost anything.',
    },
    {
      id: 'fire',
      name: 'Fire',
      emoji: '🔥',
      category: 'base',
      blurb: 'Change made visible. It takes one thing and hands back another.',
    },
    {
      id: 'water',
      name: 'Water',
      emoji: '💧',
      category: 'base',
      blurb: 'It has no shape of its own, which is exactly why it fits everywhere.',
    },
  ],
  recipes: [],
};
