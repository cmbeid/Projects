/** Paldea's tower lines: the starters Professor Sada gives, five earned with badges, four to catch, and two legends. */
import type { TowerLine } from '../towers';

export const PALDEA_LINES: readonly TowerLine[] = [
  {
    id: 'sprigatito', name: 'Sprigatito', type: 'grass', attack: 'bolt', role: 'A stage magician’s flower-bombs that always crit',
    cost: 120, base: { damage: 9, range: 2.2, rate: 1.3 }, effects: { crit: 0.2 },
    stages: [{ dex: 906, level: 1 }, { dex: 907, level: 3 }, { dex: 908, level: 5 }],
    moves: [
      { name: 'Flower Trick', desc: 'Critical hits most of the time.', effects: { crit: 0.35 }, cost: 500 },
      { name: 'Knock Off', desc: 'Dark-type swipes that leave targets taking more damage.', type: 'dark', damage: 1.3, effects: { weaken: 0.7 }, cost: 500 },
    ],
    placement: 'land', unlock: { kind: 'region', region: 'paldea' },
  },
  {
    id: 'fuecoco', name: 'Fuecoco', type: 'fire', attack: 'splash', role: 'A song of fire that burns crowds; Skeledirge sees ghosts',
    cost: 125, base: { damage: 10, range: 2.2, rate: 0.8 }, effects: { splash: 0.7, burn: 0.25 },
    stages: [{ dex: 909, level: 1 }, { dex: 910, level: 3 }, { dex: 911, level: 5, power: 1.3 }],
    moves: [
      { name: 'Torch Song', desc: 'Stronger every wave it sings through.', effects: { accelerate: 0.06 }, cost: 500 },
      { name: 'Shadow Ball', desc: 'Ghost-type blasts, sixty per cent stronger.', type: 'ghost', damage: 1.6, cost: 500 },
    ],
    placement: 'land', unlock: { kind: 'region', region: 'paldea' },
  },
  {
    id: 'quaxly', name: 'Quaxly', type: 'water', attack: 'bolt', role: 'A dancer’s rapid kicks that speed up as it goes; can swim',
    cost: 120, base: { damage: 8, range: 2, rate: 1.5 }, effects: { accelerate: 0.03 },
    stages: [{ dex: 912, level: 1 }, { dex: 913, level: 3 }, { dex: 914, level: 5 }],
    moves: [
      { name: 'Aqua Step', desc: 'Faster and faster with every wave.', effects: { accelerate: 0.05 }, cost: 500 },
      { name: 'Close Combat', desc: 'Fighting-type kicks that ignore armour.', type: 'fighting', damage: 1.4, effects: { pierceArmour: 0.6 }, cost: 500 },
    ],
    placement: 'any', unlock: { kind: 'region', region: 'paldea' },
  },
  {
    id: 'lechonk', name: 'Lechonk', type: 'normal', attack: 'pulse', role: 'Truffle-snuffling stomps that knock everything back',
    cost: 95, base: { damage: 7, range: 1.4, rate: 1 }, effects: { knockback: 0.2 },
    stages: [{ dex: 915, level: 1 }, { dex: 916, level: 4, power: 1.3 }],
    moves: [
      { name: 'Body Press', desc: 'Fighting-type slams, sixty per cent stronger.', type: 'fighting', damage: 1.6, cost: 420 },
      { name: 'Lucky Chant', desc: 'Its knockouts turn up extra ₽.', effects: { payDay: 1.5 }, cost: 420 },
    ],
    placement: 'land', groundOnly: true, unlock: { kind: 'badge', badge: 121 },
  },
  {
    id: 'pawmi', name: 'Pawmi', type: 'electric', attack: 'chain', role: 'Paw-pad sparks; Pawmot revives its friends',
    cost: 115, base: { damage: 8, range: 2, rate: 1.3 }, effects: { chain: 1, paralyse: 0.1 },
    stages: [{ dex: 921, level: 1 }, { dex: 922, level: 3 }, { dex: 923, level: 5 }],
    moves: [
      { name: 'Double Shock', desc: 'Twice as hard, a little slower.', damage: 2, rate: 0.8, cost: 480 },
      { name: 'Revival Blessing', desc: 'Restores a life every so often as it fights.', effects: { lifeEvery: 20 }, cost: 480 },
    ],
    placement: 'land', unlock: { kind: 'badge', badge: 122 },
  },
  {
    id: 'tinkatink', name: 'Tinkatink', type: 'fairy', attack: 'bolt', role: 'A tiny smith with a huge hammer: flattens armour',
    cost: 125, base: { damage: 14, range: 1.7, rate: 0.7 }, effects: { pierceArmour: 0.5 },
    stages: [{ dex: 957, level: 1 }, { dex: 958, level: 3 }, { dex: 959, level: 5, power: 1.35 }],
    moves: [
      { name: 'Gigaton Hammer', desc: 'Twice as hard, a little slower.', damage: 2, rate: 0.8, cost: 500 },
      { name: 'Knock Off', desc: 'Dark-type blows that leave targets taking more damage.', type: 'dark', effects: { weaken: 0.8 }, cost: 500 },
    ],
    placement: 'land', unlock: { kind: 'badge', badge: 124 },
  },
  {
    id: 'charcadet', name: 'Charcadet', type: 'fire', attack: 'splash', role: 'A knight of cinders: becomes Armarouge, with psychic cannons',
    cost: 130, base: { damage: 10, range: 2.2, rate: 0.9 }, effects: { splash: 0.6, burn: 0.2 },
    stages: [{ dex: 935, level: 1 }, { dex: 936, level: 4, power: 1.4 }],
    moves: [
      { name: 'Armor Cannon', desc: 'Nearly twice as hard, over a wider area.', damage: 1.9, rate: 0.8, effects: { splash: 0.3 }, cost: 520 },
      { name: 'Psyshock', desc: 'Psychic-type shots that ignore armour; sees invisible foes.', type: 'psychic', damage: 1.3, effects: { pierceArmour: 0.7 }, cost: 520 },
    ],
    placement: 'land', unlock: { kind: 'badge', badge: 125 },
  },
  {
    id: 'frigibax', name: 'Frigibax', type: 'dragon', attack: 'bolt', role: 'Icy fins that slow; becomes mighty Baxcalibur',
    cost: 160, base: { damage: 13, range: 2, rate: 1 }, effects: { slow: 0.2 },
    stages: [{ dex: 996, level: 1 }, { dex: 997, level: 3 }, { dex: 998, level: 5, power: 1.45 }],
    moves: [
      { name: 'Glaive Rush', desc: 'Nearly twice as hard.', damage: 1.9, cost: 620 },
      { name: 'Icicle Crash', desc: 'Ice-type crashes over a group that make enemies flinch.', type: 'ice', attack: 'splash', damage: 1.3, effects: { splash: 0.8, flinch: 0.2 }, cost: 620 },
    ],
    placement: 'land', unlock: { kind: 'badge', badge: 127 },
  },
  {
    id: 'gimmighoul', name: 'Gimmighoul', type: 'ghost', attack: 'bolt', role: 'A coin-chest ghost: its hits pay ₽; becomes Gholdengo',
    cost: 130, base: { damage: 9, range: 2.2, rate: 1.1 }, effects: { payDay: 1 },
    stages: [{ dex: 999, level: 1 }, { dex: 1000, level: 4, power: 1.45 }],
    moves: [
      { name: 'Make It Rain', desc: 'Steel-type coins over a crowd, paying more ₽.', type: 'steel', attack: 'splash', damage: 1.3, effects: { splash: 0.9, payDay: 1 }, cost: 540 },
      { name: 'Shadow Ball', desc: 'Sixty per cent stronger.', damage: 1.6, cost: 540 },
    ],
    placement: 'land', detect: true, unlock: { kind: 'catch' },
  },
  {
    id: 'tandemaus', name: 'Tandemaus', type: 'normal', attack: 'bolt', role: 'A family of mice: very fast, many small bites',
    cost: 100, base: { damage: 4, range: 1.9, rate: 2.4 }, effects: {},
    stages: [{ dex: 924, level: 1 }, { dex: 925, level: 4, power: 1.3 }],
    moves: [
      { name: 'Population Bomb', desc: 'Faster still, and crits.', rate: 1.3, effects: { crit: 0.2 }, cost: 440 },
      { name: 'Bite', desc: 'Dark-type bites that make enemies flinch.', type: 'dark', effects: { flinch: 0.12 }, cost: 440 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'flittle', name: 'Flittle', type: 'psychic', attack: 'bolt', role: 'Becomes Espathra: its gaze confuses; sees invisible',
    cost: 120, base: { damage: 9, range: 2.5, rate: 1.1 }, effects: { confuse: 0.12 },
    stages: [{ dex: 955, level: 1 }, { dex: 956, level: 4, power: 1.3 }],
    moves: [
      { name: 'Lumina Crash', desc: 'Everything it hits takes more damage from everyone.', damage: 1.2, effects: { weaken: 1 }, cost: 480 },
      { name: 'Dazzling Gleam', desc: 'Fairy-type light over a group.', type: 'fairy', attack: 'splash', damage: 1.3, effects: { splash: 0.8 }, cost: 480 },
    ],
    placement: 'land', detect: true, unlock: { kind: 'catch' },
  },
  {
    id: 'orthworm', name: 'Orthworm', type: 'steel', attack: 'pulse', role: 'Burrows under the path: iron spikes for all who pass',
    cost: 120, base: { damage: 10, range: 0.9, rate: 1.2 }, effects: { pierceArmour: 0.3 },
    stages: [{ dex: 968, level: 1 }],
    moves: [
      { name: 'Shed Tail', desc: 'Wider, sharper spikes.', damage: 1.5, range: 0.4, cost: 460 },
      { name: 'Earthquake', desc: 'Ground-type quakes that slow.', type: 'ground', effects: { slow: 0.35 }, cost: 460 },
    ],
    placement: 'path', groundOnly: true, unlock: { kind: 'catch' },
  },
  {
    id: 'koraidon', name: 'Koraidon', type: 'fighting', attack: 'splash', role: 'The ancient legend: blazing sun, and crushing blows',
    cost: 480, base: { damage: 40, range: 2.7, rate: 0.9 }, effects: { splash: 1, burn: 0.2 },
    stages: [{ dex: 1007, level: 1 }],
    moves: [
      { name: 'Collision Course', desc: 'Half as strong again, ignoring armour.', damage: 1.5, effects: { pierceArmour: 0.6 }, cost: 950 },
      { name: 'Flare Blitz', desc: 'Fire-type blasts that burn harder.', type: 'fire', damage: 1.3, effects: { burn: 0.3 }, cost: 950 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'miraidon', name: 'Miraidon', type: 'electric', attack: 'chain', role: 'The future legend: electric terrain that jumps between foes',
    cost: 480, base: { damage: 38, range: 2.8, rate: 1 }, effects: { chain: 3, paralyse: 0.15 },
    stages: [{ dex: 1008, level: 1 }],
    moves: [
      { name: 'Electro Drift', desc: 'Half as strong again, jumping to two more.', damage: 1.5, effects: { chain: 2 }, cost: 950 },
      { name: 'Draco Meteor', desc: 'Dragon-type meteors over a whole group.', type: 'dragon', attack: 'splash', damage: 1.7, effects: { splash: 1.2 }, cost: 950 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
];
