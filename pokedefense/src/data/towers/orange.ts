/** The Orange Islands' tower lines: Professor Ivy's three, and the fossils and the tough customers of the archipelago to catch. */
import type { TowerLine } from '../towers';

export const ORANGE_LINES: readonly TowerLine[] = [
  {
    id: 'marill', name: 'Marill', type: 'water', attack: 'splash', role: 'Huge Power: a small ball of water that hits far above its size; can swim',
    cost: 95, base: { damage: 8, range: 2, rate: 0.9 }, effects: { splash: 0.6 },
    stages: [{ dex: 298, level: 1 }, { dex: 183, level: 2 }, { dex: 184, level: 4, power: 1.45 }],
    moves: [
      { name: 'Play Rough', desc: 'Fairy-type tackles, sixty per cent stronger.', type: 'fairy', damage: 1.6, cost: 420 },
      { name: 'Aqua Jet', desc: 'Much faster splashes.', rate: 1.45, cost: 420 },
    ],
    placement: 'any', unlock: { kind: 'region', region: 'orange' },
  },
  {
    id: 'venonat', name: 'Venonat', type: 'bug', attack: 'bolt', role: 'Compound eyes see through anything; Venomoth’s powders poison and put to sleep',
    cost: 90, base: { damage: 6, range: 2.3, rate: 1.2 }, effects: { poison: 0.2 },
    stages: [{ dex: 48, level: 1 }, { dex: 49, level: 4, power: 1.3 }],
    moves: [
      { name: 'Sleep Powder', desc: 'Puts what it hits to sleep more often.', effects: { sleep: 0.2 }, cost: 400 },
      { name: 'Psybeam', desc: 'Psychic-type beams that confuse.', type: 'psychic', attack: 'beam', damage: 1.3, effects: { confuse: 0.15 }, cost: 400 },
    ],
    placement: 'land', detect: true, unlock: { kind: 'region', region: 'orange' },
  },
  {
    id: 'vulpix', name: 'Vulpix', type: 'fire', attack: 'bolt', role: 'Six tails of flame: burns, and Ninetales’s glare confuses',
    cost: 100, base: { damage: 7, range: 2.1, rate: 1.2 }, effects: { burn: 0.25 },
    stages: [{ dex: 37, level: 1 }, { dex: 38, level: 4, power: 1.35 }],
    moves: [
      { name: 'Fire Spin', desc: 'Flames over a group that burn harder.', attack: 'splash', damage: 1.2, effects: { splash: 0.7, burn: 0.2 }, cost: 440 },
      { name: 'Confuse Ray', desc: 'Ghost-type light that confuses and hexes.', type: 'ghost', effects: { confuse: 0.2, hex: 0.5 }, cost: 440 },
    ],
    placement: 'land', unlock: { kind: 'region', region: 'orange' },
  },
  {
    id: 'omanyte', name: 'Omanyte', type: 'rock', attack: 'splash', role: 'A revived fossil: spiked shells over a crowd; can swim',
    cost: 110, base: { damage: 9, range: 2, rate: 0.8 }, effects: { splash: 0.6, pierceArmour: 0.2 },
    stages: [{ dex: 138, level: 1 }, { dex: 139, level: 4, power: 1.35 }],
    moves: [
      { name: 'Ancient Power', desc: 'Half as strong again, over a wider area.', damage: 1.5, effects: { splash: 0.3 }, cost: 460 },
      { name: 'Hydro Pump', desc: 'Water-type torrents that knock enemies back.', type: 'water', damage: 1.3, effects: { knockback: 0.3 }, cost: 460 },
    ],
    placement: 'any', unlock: { kind: 'catch' },
  },
  {
    id: 'kabuto', name: 'Kabuto', type: 'rock', attack: 'bolt', role: 'A revived fossil: Kabutops’s scythes slash fast and crit; can swim',
    cost: 110, base: { damage: 8, range: 1.8, rate: 1.4 }, effects: { crit: 0.1 },
    stages: [{ dex: 140, level: 1 }, { dex: 141, level: 4, power: 1.35 }],
    moves: [
      { name: 'Slash', desc: 'Critical hits nearly half the time.', effects: { crit: 0.35 }, cost: 460 },
      { name: 'Aqua Jet', desc: 'Water-type, and much faster.', type: 'water', rate: 1.4, cost: 460 },
    ],
    placement: 'any', unlock: { kind: 'catch' },
  },
  {
    id: 'tauros', name: 'Tauros', type: 'normal', attack: 'pulse', role: 'A stampede: tramples everything near it and knocks it back',
    cost: 110, base: { damage: 9, range: 1.5, rate: 1 }, effects: { knockback: 0.3 },
    stages: [{ dex: 128, level: 1 }],
    moves: [
      { name: 'Thrash', desc: 'Seventy per cent stronger, and faster.', damage: 1.7, rate: 1.15, cost: 460 },
      { name: 'Earthquake', desc: 'Ground-type quakes over a wider ring.', type: 'ground', range: 0.4, damage: 1.2, cost: 460 },
    ],
    placement: 'land', groundOnly: true, unlock: { kind: 'catch' },
  },
  {
    id: 'electabuzz', name: 'Electabuzz', type: 'electric', attack: 'chain', role: 'Rudy’s pride: thunder punches that jump and paralyse',
    cost: 120, base: { damage: 9, range: 2, rate: 1.1 }, effects: { chain: 2, paralyse: 0.12 },
    stages: [{ dex: 125, level: 1 }, { dex: 466, level: 5, power: 1.3 }],
    moves: [
      { name: 'Thunder Punch', desc: 'Half as strong again, and paralyses more.', damage: 1.5, effects: { paralyse: 0.1 }, cost: 480 },
      { name: 'Cross Chop', desc: 'Fighting-type chops that crit.', type: 'fighting', attack: 'bolt', effects: { crit: 0.3 }, cost: 480 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
];
