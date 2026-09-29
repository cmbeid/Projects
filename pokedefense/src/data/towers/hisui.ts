/**
 * Hisui's tower lines, earned in the Galaxy Expedition Team's surveys and
 * caught in the wilds. (Hisui's starters are Rowlet, Cyndaquil and Oshawott,
 * who can evolve into their Hisuian forms.)
 */
import type { TowerLine } from '../towers';

export const HISUI_LINES: readonly TowerLine[] = [
  {
    id: 'growlithe-h', name: 'Hisuian Growlithe', type: 'rock', attack: 'bolt', role: 'A Rock-hard guardian pup: Hisuian Arcanine’s Head Smash cracks armour',
    cost: 115, base: { damage: 11, range: 1.8, rate: 0.9 }, effects: { pierceArmour: 0.3, burn: 0.1 },
    stages: [{ dex: 10229, level: 1 }, { dex: 10230, level: 4, power: 1.4 }],
    moves: [
      { name: 'Raging Fury', desc: 'Fire-type rampages that burn a crowd.', type: 'fire', attack: 'splash', damage: 1.3, effects: { splash: 0.8, burn: 0.25 }, cost: 500 },
      { name: 'Head Smash', desc: 'Nearly twice as hard, ignoring armour.', damage: 1.9, rate: 0.8, effects: { pierceArmour: 0.5 }, cost: 500 },
    ],
    placement: 'land', unlock: { kind: 'badge', badge: 141 },
  },
  {
    id: 'zorua-h', name: 'Hisuian Zorua', type: 'ghost', attack: 'bolt', role: 'A spiteful illusion: sees through disguises; its grudges hex and confuse',
    cost: 120, base: { damage: 9, range: 2.3, rate: 1.1 }, effects: { confuse: 0.12, hex: 0.5 },
    stages: [{ dex: 10238, level: 1 }, { dex: 10239, level: 4, power: 1.4 }],
    moves: [
      { name: 'Bitter Malice', desc: 'Frostbitten grudges that slow and weaken.', effects: { slow: 0.3, weaken: 0.6 }, cost: 500 },
      { name: 'Shadow Claw', desc: 'Critical hits a third of the time.', effects: { crit: 0.33 }, cost: 500 },
    ],
    placement: 'land', detect: true, unlock: { kind: 'badge', badge: 142 },
  },
  {
    id: 'stantler', name: 'Stantler', type: 'normal', attack: 'pulse', role: 'Antlers that daze; Wyrdeer’s Psyshield Bash knocks everything back',
    cost: 110, base: { damage: 9, range: 1.6, rate: 0.9 }, effects: { confuse: 0.12 },
    stages: [{ dex: 234, level: 1 }, { dex: 899, level: 4, power: 1.35 }],
    moves: [
      { name: 'Psyshield Bash', desc: 'Psychic-type charges that knock enemies back.', type: 'psychic', damage: 1.3, effects: { knockback: 0.35 }, cost: 480 },
      { name: 'Stomp', desc: 'A wider stamp that makes enemies flinch.', range: 0.4, effects: { flinch: 0.2 }, cost: 480 },
    ],
    placement: 'land', unlock: { kind: 'badge', badge: 144 },
  },
  {
    id: 'basculin', name: 'Basculin', type: 'water', attack: 'bolt', role: 'The white-striped school; Basculegion carries the spirits of the fallen; can swim',
    cost: 115, base: { damage: 9, range: 2.1, rate: 1.2 }, effects: { crit: 0.1 },
    stages: [{ dex: 10247, level: 1 }, { dex: 902, level: 4, power: 1.4 }],
    moves: [
      { name: 'Last Respects', desc: 'Ghost-type waves, far stronger, that hex.', type: 'ghost', damage: 1.5, effects: { hex: 0.5 }, cost: 500 },
      { name: 'Wave Crash', desc: 'Faster, and through a whole line.', attack: 'beam', rate: 1.2, damage: 1.2, cost: 500 },
    ],
    placement: 'any', detect: true, unlock: { kind: 'badge', badge: 145 },
  },
  {
    id: 'sneasel-h', name: 'Hisuian Sneasel', type: 'fighting', attack: 'bolt', role: 'Poisoned claws that climb cliffs; Sneasler’s Dire Claw inflicts anything',
    cost: 150, base: { damage: 11, range: 1.8, rate: 1.4 }, effects: { poison: 0.2, random: 0.1 },
    stages: [{ dex: 10235, level: 1 }, { dex: 903, level: 4, power: 1.45 }],
    moves: [
      { name: 'Dire Claw', desc: 'A status of some kind nearly every hit.', effects: { random: 0.3 }, cost: 600 },
      { name: 'Close Combat', desc: 'Sixty per cent stronger, ignoring armour.', damage: 1.6, effects: { pierceArmour: 0.5 }, cost: 600 },
    ],
    placement: 'land', unlock: { kind: 'badge', badge: 147 },
  },
  {
    id: 'voltorb-h', name: 'Hisuian Voltorb', type: 'electric', attack: 'chain', role: 'A Poké Ball made of apricorn wood: sparks that leave seeds behind',
    cost: 110, base: { damage: 8, range: 2, rate: 1.1 }, effects: { chain: 2, paralyse: 0.1 },
    stages: [{ dex: 10231, level: 1 }, { dex: 10232, level: 4, power: 1.35 }],
    moves: [
      { name: 'Chloroblast', desc: 'Grass-type blasts over a group, far stronger.', type: 'grass', attack: 'splash', damage: 1.6, effects: { splash: 0.9 }, cost: 480 },
      { name: 'Thunderbolt', desc: 'Jumps to two more, and paralyses more.', effects: { chain: 2, paralyse: 0.1 }, cost: 480 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'qwilfish-h', name: 'Hisuian Qwilfish', type: 'dark', attack: 'splash', role: 'Barbed spines over a crowd; Overqwil poisons everything; can swim',
    cost: 110, base: { damage: 7, range: 2, rate: 1 }, effects: { splash: 0.7, poison: 0.25 },
    stages: [{ dex: 10234, level: 1 }, { dex: 904, level: 4, power: 1.35 }],
    moves: [
      { name: 'Barb Barrage', desc: 'Poison-type barbs that hit poisoned targets twice as hard.', type: 'poison', effects: { hex: 1, poison: 0.2 }, cost: 480 },
      { name: 'Crunch', desc: 'Sixty per cent stronger, leaving targets weaker.', damage: 1.6, effects: { weaken: 0.4 }, cost: 480 },
    ],
    placement: 'any', unlock: { kind: 'catch' },
  },
  {
    id: 'rufflet', name: 'Rufflet', type: 'flying', attack: 'bolt', role: 'Grows into Hisuian Braviary, a psychic eagle: downs flyers, sees all',
    cost: 120, base: { damage: 9, range: 2.4, rate: 1.1 }, effects: { antiAir: 0.5 },
    stages: [{ dex: 627, level: 1 }, { dex: 10240, level: 4, power: 1.4 }],
    moves: [
      { name: 'Esper Wing', desc: 'Psychic-type wings, faster, that crit.', type: 'psychic', rate: 1.25, effects: { crit: 0.25 }, cost: 500 },
      { name: 'Brave Bird', desc: 'Sixty per cent stronger.', damage: 1.6, cost: 500 },
    ],
    placement: 'land', detect: true, unlock: { kind: 'catch' },
  },
];
