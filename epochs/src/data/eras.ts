import { LINE } from './buildings';
import { ERA_SCALE, TECH_SCALE } from './progression';
import { RESOURCE } from './resources';
import { WONDER } from './wonders';
import type { EraDef, Goal } from './types';

const PENTA_MINOR = [0, 3, 5, 7, 10];
const PHRYGIAN_DOM = [0, 1, 4, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10];
const IONIAN = [0, 2, 4, 5, 7, 9, 11];
const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];

type Spec = Omit<EraDef, 'index' | 'advanceCost'> & { advance?: boolean };

const SPECS: readonly Spec[] = [
  {
    id: 'stone',
    name: 'Stone Age',
    years: [-10000, -3500],
    blurb: 'A fire on a riverbank, and a handful of people who decided to stay.',
    goals: [{ k: 'pop', n: 14 }, { k: 'techs', n: 8 }, { k: 'line', line: 'home', n: 4 }, { k: 'wonder', id: 'standing-stones' }],
    sky: ['#e8a868', '#f8dca0'],
    ground: ['#6a8a3a', '#4a6a2a'],
    road: '#8a6a3a',
    hills: ['#5a7a4a', '#7a9a5a'],
    song: { bpm: 84, meter: 4, key: 57, scale: PENTA_MINOR, progression: [0, 0, 3, 0, 2, 3, 1, 0], motif: [0, 2, 1, 3, 2], ensemble: 'stone' },
  },
  {
    id: 'bronze',
    name: 'Bronze Age',
    years: [-3500, -1200],
    blurb: 'Brick walls, a temple on a mound and the first written word.',
    goals: [{ k: 'pop', n: 32 }, { k: 'techs', n: 8 }, { k: 'line', line: 'market', n: 2 }, { k: 'wonder', id: 'ziggurat' }],
    sky: ['#f0b860', '#fce8b0'],
    ground: ['#b89a5a', '#9a7a42'],
    road: '#c8a870',
    hills: ['#a88a5a', '#c8a86a'],
    song: { bpm: 100, meter: 7, key: 62, scale: PHRYGIAN_DOM, progression: [0, 1, 0, 6, 0, 1, 4, 0], motif: [0, 1, 2, 1, 4, 2], ensemble: 'bronze' },
  },
  {
    id: 'classical',
    name: 'Classical Age',
    years: [-1200, 500],
    blurb: 'Marble, philosophy and a forum full of arguments.',
    goals: [{ k: 'pop', n: 60 }, { k: 'techs', n: 8 }, { k: 'stability', n: 90 }, { k: 'wonder', id: 'great-library' }],
    sky: ['#78b8e8', '#d8f0ff'],
    ground: ['#8aa04a', '#6a8a3a'],
    road: '#d8d0b8',
    hills: ['#6a8a6a', '#8aaa7a'],
    song: { bpm: 104, meter: 3, key: 64, scale: DORIAN, progression: [0, 3, 0, 4, 0, 3, 6, 0], motif: [0, 2, 4, 3, 1], ensemble: 'classical' },
  },
  {
    id: 'medieval',
    name: 'Medieval Age',
    years: [500, 1450],
    blurb: 'Walls, bells, guilds and a cathedral that takes four lifetimes.',
    goals: [{ k: 'pop', n: 100 }, { k: 'techs', n: 8 }, { k: 'line', line: 'shrine', n: 5 }, { k: 'wonder', id: 'cathedral' }],
    sky: ['#8aa0b8', '#d8dce0'],
    ground: ['#5a7a3a', '#4a6a32'],
    road: '#7a7468',
    hills: ['#4a6a52', '#6a8a6a'],
    song: { bpm: 76, meter: 6, key: 60, scale: MIXOLYDIAN, progression: [0, 0, 6, 0, 3, 4, 6, 0], motif: [0, 1, 2, 0, -1, 0], ensemble: 'medieval' },
  },
  {
    id: 'renaissance',
    name: 'Renaissance',
    years: [1450, 1750],
    blurb: 'Domes, printing presses and ships to the edge of the map.',
    goals: [{ k: 'pop', n: 160 }, { k: 'techs', n: 8 }, { k: 'res', r: 'gold', n: 40000 }, { k: 'wonder', id: 'observatory' }],
    sky: ['#68a8e0', '#f0e8d0'],
    ground: ['#7a9a4a', '#5a7a3a'],
    road: '#b8a088',
    hills: ['#5a8a5a', '#7aa070'],
    song: { bpm: 112, meter: 4, key: 67, scale: IONIAN, progression: [0, 4, 5, 3, 0, 1, 4, 0], motif: [0, 1, 2, 4, 3, 2, 1], ensemble: 'renaissance' },
  },
  {
    id: 'industrial',
    name: 'Industrial Age',
    years: [1750, 1900],
    blurb: 'Smoke, steam, steel and a city that never sleeps.',
    goals: [{ k: 'pop', n: 260 }, { k: 'techs', n: 8 }, { k: 'line', line: 'power', n: 2 }, { k: 'wonder', id: 'exhibition' }],
    sky: ['#9a9088', '#d8c8a8'],
    ground: ['#5a5a4a', '#48483e'],
    road: '#3a3a3e',
    hills: ['#6a6a62', '#8a8478'],
    song: { bpm: 120, meter: 4, key: 57, scale: HARMONIC_MINOR, progression: [0, 0, 3, 4, 0, 5, 4, 0], motif: [0, 2, 0, 4, 3, 2], ensemble: 'industrial' },
  },
  {
    id: 'modern',
    name: 'Modern Age',
    years: [1900, 2030],
    blurb: 'Concrete, glass, cars and a sky full of signals.',
    goals: [{ k: 'pop', n: 400 }, { k: 'techs', n: 8 }, { k: 'line', line: 'server', n: 3 }, { k: 'wonder', id: 'sky-tower' }],
    sky: ['#4a88d8', '#c8e4ff'],
    ground: ['#6a8a5a', '#58784a'],
    road: '#2e3036',
    hills: ['#5a7a8a', '#7a9aaa'],
    song: { bpm: 124, meter: 4, key: 64, scale: MIXOLYDIAN, progression: [0, 0, 6, 3, 0, 4, 6, 0], motif: [0, 2, 4, 2, 5, 4], ensemble: 'modern' },
  },
  {
    id: 'space',
    name: 'Space Age',
    years: [2030, 2200],
    blurb: 'Fusion light, orbital rings, and a ship being built for somewhere else.',
    goals: [{ k: 'pop', n: 600 }, { k: 'techs', n: 10 }, { k: 'wonder', id: 'colony-ship' }],
    sky: ['#1a2050', '#5a6ab0'],
    ground: ['#4a5a6a', '#3a4858'],
    road: '#5ae0e8',
    hills: ['#2a3a5a', '#3a4a7a'],
    song: { bpm: 72, meter: 5, key: 62, scale: LYDIAN, progression: [0, 1, 0, 4, 5, 3, 1, 0], motif: [0, 4, 2, 6, 3], ensemble: 'space' },
    advance: false,
  },
];

export const ERAS: readonly EraDef[] = SPECS.map((s, index) => {
  const { advance, ...rest } = s;
  return {
    ...rest,
    index,
    advanceCost:
      advance === false ? {} : { knowledge: TECH_SCALE[index]! * 5, culture: 30 * ERA_SCALE[index]! },
  };
});

export const LAST_ERA = ERAS.length - 1;

export function goalText(g: Goal, era: number): string {
  switch (g.k) {
    case 'pop':
      return `Reach ${g.n} citizens`;
    case 'techs':
      return `Research ${g.n} techs of this era`;
    case 'wonder':
      return `Build the ${WONDER.get(g.id)?.name ?? g.id}`;
    case 'line': {
      const tier = LINE.get(g.line)?.tiers.find((t) => t.era === era);
      return `Stand ${g.n} × ${tier?.name ?? g.line}`;
    }
    case 'stability':
      return `Hold ${g.n}% stability`;
    case 'res':
      return `Stockpile ${g.n.toLocaleString('en')} ${RESOURCE.get(g.r)?.name.toLowerCase() ?? g.r}`;
  }
}
