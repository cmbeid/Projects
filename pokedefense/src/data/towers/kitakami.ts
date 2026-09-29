/** Kitakami's and Blueberry Academy's tower lines: the three the professor sends along, two earned with badges, and Ogerpon and the Loyal Three to catch. */
import type { TowerLine } from '../towers';

export const KITAKAMI_LINES: readonly TowerLine[] = [
  {
    id: 'poltchageist', name: 'Poltchageist', type: 'grass', attack: 'pulse', role: 'A counterfeit matcha ghost: bitter tea that saps everything near it',
    cost: 110, base: { damage: 7, range: 1.7, rate: 1 }, effects: { weaken: 0.3, slow: 0.15 },
    stages: [{ dex: 1012, level: 1 }, { dex: 1013, level: 4, power: 1.4 }],
    moves: [
      { name: 'Matcha Gotcha', desc: 'Far stronger tea that burns.', damage: 1.5, effects: { burn: 0.2 }, cost: 480 },
      { name: 'Shadow Ball', desc: 'Ghost-type blasts at range that hex.', type: 'ghost', attack: 'bolt', range: 0.8, effects: { hex: 0.5 }, cost: 480 },
    ],
    placement: 'land', detect: true, unlock: { kind: 'region', region: 'kitakami' },
  },
  {
    id: 'duraludon', name: 'Duraludon', type: 'steel', attack: 'beam', role: 'An alloy dragon; Archaludon’s Electro Shot pierces a whole line',
    cost: 150, base: { damage: 16, range: 2.6, rate: 0.7 }, effects: { pierceArmour: 0.3 },
    stages: [{ dex: 884, level: 1 }, { dex: 1018, level: 5, power: 1.45 }],
    moves: [
      { name: 'Electro Shot', desc: 'Electric-type, nearly twice as hard.', type: 'electric', damage: 1.9, rate: 0.85, cost: 600 },
      { name: 'Draco Meteor', desc: 'Dragon-type meteors over a group.', type: 'dragon', attack: 'splash', damage: 1.4, effects: { splash: 1 }, cost: 600 },
    ],
    placement: 'land', unlock: { kind: 'region', region: 'kitakami' },
  },
  {
    id: 'dipplin', name: 'Dipplin', type: 'dragon', attack: 'splash', role: 'Syrupy candy apples that slow; Hydrapple’s heads splash a crowd',
    cost: 125, base: { damage: 10, range: 2.2, rate: 0.8 }, effects: { splash: 0.7, slow: 0.2 },
    stages: [{ dex: 1011, level: 1 }, { dex: 1019, level: 4, power: 1.45 }],
    moves: [
      { name: 'Syrup Bomb', desc: 'Stickier syrup that slows far more.', effects: { slow: 0.3 }, cost: 500 },
      { name: 'Fickle Beam', desc: 'Sixty per cent stronger, now and then double.', damage: 1.6, effects: { crit: 0.3 }, cost: 500 },
    ],
    placement: 'land', unlock: { kind: 'region', region: 'kitakami' },
  },
  {
    id: 'dunsparce', name: 'Dunsparce', type: 'normal', attack: 'pulse', role: 'Burrows beside the path; Dudunsparce’s drills rattle a ring around it',
    cost: 100, base: { damage: 8, range: 1.5, rate: 1 }, effects: { flinch: 0.1 },
    stages: [{ dex: 206, level: 1 }, { dex: 982, level: 4, power: 1.4 }],
    moves: [
      { name: 'Hyper Drill', desc: 'Seventy per cent stronger, ignoring armour.', damage: 1.7, effects: { pierceArmour: 0.5 }, cost: 440 },
      { name: 'Coil', desc: 'Faster, and a wider ring.', rate: 1.25, range: 0.4, cost: 440 },
    ],
    placement: 'land', unlock: { kind: 'badge', badge: 152 },
  },
  {
    id: 'snorunt', name: 'Snorunt', type: 'ice', attack: 'splash', role: 'Polar Biome ice: Glalie’s freezing breath slows a crowd',
    cost: 115, base: { damage: 8, range: 2.1, rate: 0.9 }, effects: { splash: 0.6, slow: 0.25 },
    stages: [{ dex: 361, level: 1 }, { dex: 362, level: 4, power: 1.35 }],
    moves: [
      { name: 'Freeze-Dry', desc: 'Ice that hits Water types hard too, and freezes.', effects: { flinch: 0.15, slow: 0.15 }, cost: 480 },
      { name: 'Crunch', desc: 'Dark-type bites, sixty per cent stronger.', type: 'dark', attack: 'bolt', damage: 1.6, cost: 480 },
    ],
    placement: 'land', unlock: { kind: 'badge', badge: 156 },
  },
  {
    id: 'ogerpon', name: 'Ogerpon', type: 'grass', attack: 'bolt', role: 'The masked ogre: Ivy Cudgel takes the type of the mask it wears',
    cost: 360, base: { damage: 30, range: 2.2, rate: 1.1 }, effects: { crit: 0.2 },
    stages: [{ dex: 1017, level: 1 }],
    moves: [
      { name: 'Wellspring Mask', desc: 'Water-type cudgel swings, half as strong again.', type: 'water', damage: 1.5, cost: 800 },
      { name: 'Hearthflame Mask', desc: 'Fire-type cudgel swings over a group, that burn.', type: 'fire', attack: 'splash', damage: 1.3, effects: { splash: 0.8, burn: 0.3 }, cost: 800 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'okidogi', name: 'Okidogi', type: 'fighting', attack: 'pulse', role: 'The toxic chain dog: poisoned blows on everything near it',
    cost: 300, base: { damage: 24, range: 1.7, rate: 1 }, effects: { poison: 0.3, knockback: 0.2 },
    stages: [{ dex: 1014, level: 1 }],
    moves: [
      { name: 'Toxic Chain', desc: 'Stronger poison, and it lasts.', type: 'poison', effects: { poison: 0.4 }, cost: 700 },
      { name: 'Bulk Up', desc: 'Half as strong again.', damage: 1.5, cost: 700 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'munkidori', name: 'Munkidori', type: 'psychic', attack: 'chain', role: 'The toxic chain monkey: its mind leaps foe to foe, poisoning',
    cost: 300, base: { damage: 20, range: 2.4, rate: 1.1 }, effects: { chain: 2, poison: 0.25 },
    stages: [{ dex: 1015, level: 1 }],
    moves: [
      { name: 'Fake Out', desc: 'Makes what it hits flinch.', effects: { flinch: 0.25 }, cost: 700 },
      { name: 'Psychic', desc: 'Half as strong again, jumping to more.', damage: 1.5, effects: { chain: 1 }, cost: 700 },
    ],
    placement: 'land', detect: true, unlock: { kind: 'catch' },
  },
  {
    id: 'fezandipiti', name: 'Fezandipiti', type: 'fairy', attack: 'splash', role: 'The toxic chain pheasant: a poisonous flurry of wings; downs flyers',
    cost: 300, base: { damage: 20, range: 2.6, rate: 0.9 }, effects: { splash: 0.8, poison: 0.2, antiAir: 0.4 },
    stages: [{ dex: 1016, level: 1 }],
    moves: [
      { name: 'Beat Up', desc: 'Dark-type flurries, far faster.', type: 'dark', rate: 1.5, cost: 700 },
      { name: 'Moonblast', desc: 'Half as strong again, leaving targets weaker.', damage: 1.5, effects: { weaken: 0.5 }, cost: 700 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
];
