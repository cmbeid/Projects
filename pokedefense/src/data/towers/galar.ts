/** Galar's tower lines: the starters Professor Magnolia gives, five earned with badges, four to catch, and two legends. */
import type { TowerLine } from '../towers';

export const GALAR_LINES: readonly TowerLine[] = [
  {
    id: 'grookey', name: 'Grookey', type: 'grass', attack: 'pulse', role: 'Drumbeats that shake the ground and slow everything near',
    cost: 120, base: { damage: 9, range: 1.6, rate: 0.9 }, effects: { slow: 0.2 },
    stages: [{ dex: 810, level: 1 }, { dex: 811, level: 3 }, { dex: 812, level: 5, power: 1.3 }],
    moves: [
      { name: 'Drum Beating', desc: 'Sixty per cent more, and slows harder.', damage: 1.6, effects: { slow: 0.15 }, cost: 500 },
      { name: 'Grassy Glide', desc: 'A wider, faster drumroll.', rate: 1.3, range: 0.4, cost: 500 },
    ],
    placement: 'land', unlock: { kind: 'region', region: 'galar' },
  },
  {
    id: 'scorbunny', name: 'Scorbunny', type: 'fire', attack: 'bolt', role: 'Fiery kicks that burn, faster with every wave',
    cost: 120, base: { damage: 9, range: 2, rate: 1.4 }, effects: { burn: 0.2, accelerate: 0.04 },
    stages: [{ dex: 813, level: 1 }, { dex: 814, level: 3 }, { dex: 815, level: 5 }],
    moves: [
      { name: 'Pyro Ball', desc: 'Flaming footballs over a group.', attack: 'splash', damage: 1.5, effects: { splash: 0.9, burn: 0.2 }, cost: 500 },
      { name: 'High Jump Kick', desc: 'Fighting-type kicks that crit.', type: 'fighting', effects: { crit: 0.3 }, cost: 500 },
    ],
    placement: 'land', unlock: { kind: 'region', region: 'galar' },
  },
  {
    id: 'sobble', name: 'Sobble', type: 'water', attack: 'bolt', role: 'A sniper: the longest range of any starter; can swim',
    cost: 120, base: { damage: 11, range: 3.2, rate: 0.8 }, effects: { crit: 0.15 },
    stages: [{ dex: 816, level: 1 }, { dex: 817, level: 3 }, { dex: 818, level: 5 }],
    moves: [
      { name: 'Snipe Shot', desc: 'Critical hits nearly half the time, from even further.', range: 0.6, effects: { crit: 0.3 }, cost: 500 },
      { name: 'Hydro Cannon', desc: 'Nearly twice the damage, a little slower.', damage: 1.9, rate: 0.8, cost: 500 },
    ],
    placement: 'any', unlock: { kind: 'region', region: 'galar' },
  },
  {
    id: 'rookidee', name: 'Rookidee', type: 'flying', attack: 'bolt', role: 'Grows into Corviknight, the armoured raven: pierces armour, downs flyers',
    cost: 110, base: { damage: 8, range: 2.2, rate: 1.3 }, effects: { antiAir: 0.5 },
    stages: [{ dex: 821, level: 1 }, { dex: 822, level: 3 }, { dex: 823, level: 5, power: 1.3 }],
    moves: [
      { name: 'Steel Wing', desc: 'Steel-type wings that ignore armour.', type: 'steel', effects: { pierceArmour: 0.7 }, cost: 480 },
      { name: 'Brave Bird', desc: 'Sixty per cent more damage.', damage: 1.6, cost: 480 },
    ],
    placement: 'land', unlock: { kind: 'badge', badge: 111 },
  },
  {
    id: 'rolycoly', name: 'Rolycoly', type: 'rock', attack: 'splash', role: 'Becomes Coalossal: burning tar over a crowd',
    cost: 125, base: { damage: 10, range: 2.1, rate: 0.8 }, effects: { splash: 0.6, burn: 0.15 },
    stages: [{ dex: 837, level: 1 }, { dex: 838, level: 3 }, { dex: 839, level: 5, power: 1.3 }],
    moves: [
      { name: 'Tar Shot', desc: 'Everything it hits takes more damage, and burns worse.', effects: { weaken: 0.8, burn: 0.15 }, cost: 500 },
      { name: 'Heat Crash', desc: 'Fire-type blasts, sixty per cent stronger.', type: 'fire', damage: 1.6, cost: 500 },
    ],
    placement: 'land', unlock: { kind: 'badge', badge: 112 },
  },
  {
    id: 'toxel', name: 'Toxel', type: 'electric', attack: 'chain', role: 'A punk-rock riff of poisoned sparks',
    cost: 120, base: { damage: 8, range: 2.2, rate: 1.1 }, effects: { chain: 2, poison: 0.2 },
    stages: [{ dex: 848, level: 1 }, { dex: 849, level: 4, power: 1.35 }],
    moves: [
      { name: 'Overdrive', desc: 'Half as strong again, jumping to two more.', damage: 1.5, effects: { chain: 2 }, cost: 480 },
      { name: 'Sludge Bomb', desc: 'Poison-type bursts over a group.', type: 'poison', attack: 'splash', damage: 1.3, effects: { splash: 0.9, poison: 0.2 }, cost: 480 },
    ],
    placement: 'land', unlock: { kind: 'badge', badge: 114 },
  },
  {
    id: 'hatenna', name: 'Hatenna', type: 'psychic', attack: 'pulse', role: 'Senses everything around it; Hatterene’s mind-blasts stun crowds',
    cost: 120, base: { damage: 9, range: 1.9, rate: 0.9 }, effects: { confuse: 0.15 },
    stages: [{ dex: 856, level: 1 }, { dex: 857, level: 3 }, { dex: 858, level: 5, power: 1.3 }],
    moves: [
      { name: 'Magic Powder', desc: 'Fairy-type powder that makes everything flinch.', type: 'fairy', effects: { flinch: 0.25 }, cost: 480 },
      { name: 'Psychic', desc: 'Sixty per cent stronger, over a wider area.', damage: 1.6, range: 0.3, cost: 480 },
    ],
    placement: 'land', detect: true, unlock: { kind: 'badge', badge: 115 },
  },
  {
    id: 'dreepy', name: 'Dreepy', type: 'dragon', attack: 'bolt', role: 'Launches its young like missiles; grows into Dragapult',
    cost: 160, base: { damage: 11, range: 2.4, rate: 1.3 }, effects: {},
    stages: [{ dex: 885, level: 1 }, { dex: 886, level: 3 }, { dex: 887, level: 5, power: 1.4 }],
    moves: [
      { name: 'Dragon Darts', desc: 'Two darts at once: much faster.', rate: 1.5, cost: 620 },
      { name: 'Phantom Force', desc: 'Ghost-type strikes that ignore armour and hex.', type: 'ghost', damage: 1.3, effects: { pierceArmour: 0.6, hex: 0.5 }, cost: 620 },
    ],
    placement: 'land', detect: true, unlock: { kind: 'badge', badge: 117 },
  },
  {
    id: 'sinistea', name: 'Sinistea', type: 'ghost', attack: 'splash', role: 'A haunted teacup: spilt tea that weakens a crowd',
    cost: 115, base: { damage: 7, range: 2.1, rate: 1 }, effects: { splash: 0.6, weaken: 0.3 },
    stages: [{ dex: 854, level: 1 }, { dex: 855, level: 4 }],
    moves: [
      { name: 'Shell Smash', desc: 'Much faster and stronger.', damage: 1.3, rate: 1.35, cost: 480 },
      { name: 'Strength Sap', desc: 'Grass-type sips that slow.', type: 'grass', effects: { slow: 0.35 }, cost: 480 },
    ],
    placement: 'land', detect: true, unlock: { kind: 'catch' },
  },
  {
    id: 'falinks', name: 'Falinks', type: 'fighting', attack: 'beam', role: 'Six soldiers in formation: a charge through a whole line',
    cost: 130, base: { damage: 11, range: 2.2, rate: 0.9 }, effects: { pierceArmour: 0.3 },
    stages: [{ dex: 870, level: 1 }],
    moves: [
      { name: 'No Retreat', desc: 'Faster and stronger.', damage: 1.3, rate: 1.3, cost: 500 },
      { name: 'Megahorn', desc: 'Bug-type charges, sixty per cent stronger.', type: 'bug', damage: 1.6, cost: 500 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'cufant', name: 'Cufant', type: 'steel', attack: 'splash', role: 'Becomes Copperajah: a trunk that slams whole groups',
    cost: 140, base: { damage: 13, range: 1.9, rate: 0.7 }, effects: { splash: 0.6, knockback: 0.2 },
    stages: [{ dex: 878, level: 1 }, { dex: 879, level: 4, power: 1.45 }],
    moves: [
      { name: 'Heavy Slam', desc: 'Nearly twice as hard.', damage: 1.9, rate: 0.8, cost: 540 },
      { name: 'High Horsepower', desc: 'Ground-type stomps over a wider area.', type: 'ground', damage: 1.3, effects: { splash: 0.4 }, cost: 540 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'applin', name: 'Applin', type: 'grass', attack: 'bolt', role: 'A dragon in an apple; Flapple takes wing',
    cost: 120, base: { damage: 10, range: 2.2, rate: 1 }, effects: {},
    stages: [{ dex: 840, level: 1 }, { dex: 841, level: 4, power: 1.35 }],
    moves: [
      { name: 'Grav Apple', desc: 'Apples dropped over a group, leaving them weaker.', attack: 'splash', damage: 1.3, effects: { splash: 0.8, weaken: 0.5 }, cost: 480 },
      { name: 'Dragon Rush', desc: 'Dragon-type charges, sixty per cent stronger.', type: 'dragon', damage: 1.6, cost: 480 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'zacian', name: 'Zacian', type: 'fairy', attack: 'beam', role: 'The legendary sword: cuts through everything in a line',
    cost: 480, base: { damage: 42, range: 2.8, rate: 1 }, effects: { crit: 0.15, pierceArmour: 0.4 },
    stages: [{ dex: 888, level: 1 }],
    moves: [
      { name: 'Behemoth Blade', desc: 'Steel-type cuts, half as strong again, ignoring armour.', type: 'steel', damage: 1.5, effects: { pierceArmour: 0.6 }, cost: 950 },
      { name: 'Play Rough', desc: 'Critical hits nearly half the time.', effects: { crit: 0.3 }, cost: 950 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'zamazenta', name: 'Zamazenta', type: 'fighting', attack: 'pulse', role: 'The legendary shield: slams everything near it back',
    cost: 480, base: { damage: 34, range: 2, rate: 0.9 }, effects: { knockback: 0.3, pierceArmour: 0.4 },
    stages: [{ dex: 889, level: 1 }],
    moves: [
      { name: 'Behemoth Bash', desc: 'Steel-type slams, half as strong again.', type: 'steel', damage: 1.5, cost: 950 },
      { name: 'Close Combat', desc: 'A wider slam that stops enemies in their tracks.', range: 0.5, effects: { flinch: 0.3 }, cost: 950 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
];
