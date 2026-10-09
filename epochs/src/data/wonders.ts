import { ERA_MATS, ERA_SCALE } from './progression';
import type { Bundle, Effect, WonderDef } from './types';

/**
 * Wonders: the great works. Each is built in stages — every stage paid for
 * up front, then built over time — and once finished it stands on the far
 * bank behind the city for good. Every era asks for one; some have a second
 * you can build for its bonus.
 */

const WONDER_BASE = 45;

function stagePrice(era: number, stage: number, mult: number): Bundle {
  const base = WONDER_BASE * ERA_SCALE[era]! * (1 + 0.3 * stage) * mult;
  const out: Bundle = {};
  const weights = [1, 0.75, 0.5];
  ERA_MATS[era]!.forEach((r, i) => {
    out[r] = Math.round(base * weights[i]!);
  });
  return out;
}

type Spec = {
  id: string;
  name: string;
  era: number;
  required: boolean;
  stages: number;
  stageTime: number;
  effects: readonly Effect[];
  blurb: string;
  w: number;
  h: number;
  at: number;
  mult?: number;
  tech?: string;
};

const SPECS: readonly Spec[] = [
  {
    id: 'standing-stones',
    name: 'Standing Stones',
    era: 0,
    required: true,
    stages: 3,
    stageTime: 40,
    effects: [{ k: 'stability', n: 5 }, { k: 'job', job: 'scholar', x: 0.2 }],
    blurb: 'A ring of stones that catches the midsummer sunrise.',
    w: 40,
    h: 24,
    at: 0.12,
    tech: 'megaliths',
  },
  {
    id: 'ziggurat',
    name: 'Great Ziggurat',
    era: 1,
    required: true,
    stages: 3,
    stageTime: 60,
    effects: [{ k: 'all', x: 0.1 }, { k: 'stability', n: 5 }],
    blurb: 'A mountain of brick with a temple on top, nearer the gods.',
    w: 48,
    h: 36,
    at: 0.3,
  },
  {
    id: 'hanging-gardens',
    name: 'Hanging Gardens',
    era: 1,
    required: false,
    stages: 3,
    stageTime: 60,
    effects: [{ k: 'growth', x: 0.5 }, { k: 'housing', x: 0.1 }],
    blurb: 'Terraces of trees and flowers, watered by a screw from the river.',
    w: 40,
    h: 34,
    at: 0.48,
    mult: 0.8,
  },
  {
    id: 'great-library',
    name: 'Great Library',
    era: 2,
    required: true,
    stages: 4,
    stageTime: 80,
    effects: [{ k: 'job', job: 'scholar', x: 0.5 }, { k: 'research', x: 0.1 }],
    blurb: 'Every scroll in the world, copied from every ship that docks.',
    w: 48,
    h: 30,
    at: 0.62,
  },
  {
    id: 'colossus',
    name: 'Colossus',
    era: 2,
    required: false,
    stages: 3,
    stageTime: 80,
    effects: [{ k: 'job', job: 'merchant', x: 0.5 }, { k: 'plots', n: 3 }],
    blurb: 'A bronze giant astride the harbour mouth.',
    w: 26,
    h: 56,
    at: 0.04,
    mult: 0.8,
  },
  {
    id: 'cathedral',
    name: 'Great Cathedral',
    era: 3,
    required: true,
    stages: 4,
    stageTime: 100,
    effects: [{ k: 'stability', n: 12 }, { k: 'job', job: 'artist', x: 0.4 }],
    blurb: 'Two towers and a rose window. It took four generations.',
    w: 44,
    h: 60,
    at: 0.78,
  },
  {
    id: 'castle-keep',
    name: 'Castle Keep',
    era: 3,
    required: false,
    stages: 3,
    stageTime: 100,
    effects: [{ k: 'plots', n: 4 }, { k: 'cap', x: 0.5 }],
    blurb: 'Curtain walls round the whole hill, and room inside them.',
    w: 56,
    h: 40,
    at: 0.2,
    mult: 0.8,
  },
  {
    id: 'observatory',
    name: 'Royal Observatory',
    era: 4,
    required: true,
    stages: 4,
    stageTime: 120,
    effects: [{ k: 'research', x: 0.15 }, { k: 'job', job: 'scholar', x: 0.5 }],
    blurb: 'A dome that opens on the sky, and a telescope as long as a ship.',
    w: 40,
    h: 40,
    at: 0.9,
    tech: 'astronomy',
  },
  {
    id: 'grand-canal',
    name: 'Grand Canal',
    era: 4,
    required: false,
    stages: 3,
    stageTime: 120,
    effects: [{ k: 'job', job: 'merchant', x: 0.6 }, { k: 'job', job: 'farmer', x: 0.3 }],
    blurb: 'Locks, towpaths and a straight line to the sea.',
    w: 64,
    h: 20,
    at: 0.4,
    mult: 0.8,
  },
  {
    id: 'exhibition',
    name: 'Crystal Exhibition',
    era: 5,
    required: true,
    stages: 4,
    stageTime: 140,
    effects: [{ k: 'all', x: 0.15 }, { k: 'festival', x: 0.5 }],
    blurb: 'A palace of glass, and every marvel of the age inside it.',
    w: 64,
    h: 34,
    at: 0.55,
  },
  {
    id: 'iron-bridge',
    name: 'Iron Bridge',
    era: 5,
    required: false,
    stages: 3,
    stageTime: 140,
    effects: [{ k: 'plots', n: 6 }, { k: 'all', x: 0.05 }],
    blurb: 'A span of riveted iron across the river, and a new town on the far side.',
    w: 64,
    h: 30,
    at: 0.7,
    mult: 0.8,
  },
  {
    id: 'sky-tower',
    name: 'Sky Tower',
    era: 6,
    required: true,
    stages: 4,
    stageTime: 160,
    effects: [{ k: 'housing', x: 0.25 }, { k: 'plots', n: 6 }],
    blurb: 'A needle of steel and glass, the tallest thing anyone has built.',
    w: 22,
    h: 80,
    at: 0.34,
  },
  {
    id: 'grand-dam',
    name: 'Grand Dam',
    era: 6,
    required: false,
    stages: 4,
    stageTime: 160,
    effects: [{ k: 'job', job: 'farmer', x: 0.5 }, { k: 'cap', x: 0.5 }],
    blurb: 'A curve of concrete holding back a lake.',
    w: 56,
    h: 36,
    at: 0.08,
    mult: 0.8,
  },
  {
    id: 'space-elevator',
    name: 'Space Elevator',
    era: 7,
    required: false,
    stages: 4,
    stageTime: 180,
    effects: [{ k: 'wonderSpeed', x: 0.5 }, { k: 'cap', x: 1 }],
    blurb: 'A ribbon to orbit, and a lift that takes a week.',
    w: 16,
    h: 96,
    at: 0.97,
    mult: 0.8,
    tech: 'orbital-habitats',
  },
  {
    id: 'colony-ship',
    name: 'Colony Ship',
    era: 7,
    required: true,
    stages: 5,
    stageTime: 200,
    effects: [],
    blurb: 'Everything the city has learned, in one hull. When it is finished, you can launch.',
    w: 64,
    h: 44,
    at: 0.46,
    mult: 1.1,
    tech: 'ion-drive',
  },
];

export const WONDERS: readonly WonderDef[] = SPECS.map((s) => {
  const w: WonderDef = {
    id: s.id,
    name: s.name,
    era: s.era,
    required: s.required,
    blurb: s.blurb,
    stages: Array.from({ length: s.stages }, (_, i) => stagePrice(s.era, i, s.mult ?? 1)),
    stageTime: s.stageTime,
    effects: s.effects,
    w: s.w,
    h: s.h,
    at: s.at,
  };
  if (s.tech) w.tech = s.tech;
  return w;
});

export const WONDER = new Map<string, WonderDef>(WONDERS.map((w) => [w.id, w]));
