/** Sinnoh's tower lines: the starters Professor Rowan gives, five earned with badges, five to catch, and two legends. */
import type { TowerLine } from '../towers';

export const SINNOH_LINES: readonly TowerLine[] = [
  {
    id: 'turtwig', name: 'Turtwig', type: 'grass', attack: 'splash', role: 'A walking grove: heavy, slowing blows over an area',
    cost: 120, base: { damage: 11, range: 2, rate: 0.7 }, effects: { splash: 0.6, slow: 0.25 },
    stages: [{ dex: 387, level: 1 }, { dex: 388, level: 3 }, { dex: 389, level: 5, power: 1.3 }],
    moves: [
      { name: 'Earthquake', desc: 'Ground-type quakes over a wider area.', type: 'ground', damage: 1.5, effects: { splash: 0.5 }, cost: 520 },
      { name: 'Wood Hammer', desc: 'Twice the damage, a little slower.', damage: 2, rate: 0.8, cost: 520 },
    ],
    placement: 'land', unlock: { kind: 'region', region: 'sinnoh' },
  },
  {
    id: 'chimchar', name: 'Chimchar', type: 'fire', attack: 'bolt', role: 'Flurries of fiery punches that burn and break armour',
    cost: 115, base: { damage: 8, range: 1.9, rate: 1.8 }, effects: { burn: 0.25, pierceArmour: 0.25 },
    stages: [{ dex: 390, level: 1 }, { dex: 391, level: 3 }, { dex: 392, level: 5 }],
    moves: [
      { name: 'Close Combat', desc: 'Fighting-type blows that ignore armour.', type: 'fighting', damage: 1.5, effects: { pierceArmour: 0.75 }, cost: 500 },
      { name: 'Flare Blitz', desc: 'Sixty per cent more damage, and burns harder.', damage: 1.6, effects: { burn: 0.3 }, cost: 500 },
    ],
    placement: 'land', unlock: { kind: 'region', region: 'sinnoh' },
  },
  {
    id: 'piplup', name: 'Piplup', type: 'water', attack: 'beam', role: 'Jets of water through a whole line; can swim',
    cost: 125, base: { damage: 10, range: 2.4, rate: 0.9 }, effects: {},
    stages: [{ dex: 393, level: 1 }, { dex: 394, level: 3 }, { dex: 395, level: 5 }],
    moves: [
      { name: 'Hydro Pump', desc: 'Seventy per cent more damage.', damage: 1.7, cost: 520 },
      { name: 'Flash Cannon', desc: 'Steel beams that leave targets taking more damage.', type: 'steel', effects: { weaken: 1, pierceArmour: 0.3 }, cost: 520 },
    ],
    placement: 'any', unlock: { kind: 'region', region: 'sinnoh' },
  },
  {
    id: 'shinx', name: 'Shinx', type: 'electric', attack: 'bolt', role: 'Paralysing sparks; Luxray’s eyes see the invisible',
    cost: 110, base: { damage: 9, range: 2.2, rate: 1.2 }, effects: { paralyse: 0.1 },
    stages: [{ dex: 403, level: 1 }, { dex: 404, level: 3 }, { dex: 405, level: 5 }],
    moves: [
      { name: 'Wild Charge', desc: 'Sixty per cent more damage.', damage: 1.6, cost: 480 },
      { name: 'Discharge', desc: 'Electricity that jumps to three more enemies.', attack: 'chain', effects: { chain: 3, paralyse: 0.1 }, cost: 480 },
    ],
    placement: 'land', detect: true, unlock: { kind: 'badge', badge: 25 },
  },
  {
    id: 'budew', name: 'Budew', type: 'grass', attack: 'splash', role: 'Poisonous petals over a crowd',
    cost: 100, base: { damage: 6, range: 2.3, rate: 1 }, effects: { splash: 0.7, poison: 0.3 },
    stages: [{ dex: 406, level: 1 }, { dex: 315, level: 3 }, { dex: 407, level: 5 }],
    moves: [
      { name: 'Toxic Spikes', desc: 'Much stronger poison.', type: 'poison', effects: { poison: 0.5 }, cost: 450 },
      { name: 'Petal Dance', desc: 'Sixty per cent more damage over a wider area.', damage: 1.6, effects: { splash: 0.3 }, cost: 450 },
    ],
    placement: 'land', unlock: { kind: 'badge', badge: 26 },
  },
  {
    id: 'buizel', name: 'Buizel', type: 'water', attack: 'bolt', role: 'The swiftest swimmer: rapid jets; can swim',
    cost: 105, base: { damage: 6, range: 2.1, rate: 2.2 }, effects: {},
    stages: [{ dex: 418, level: 1 }, { dex: 419, level: 4 }],
    moves: [
      { name: 'Aqua Jet', desc: 'Faster still.', rate: 1.35, cost: 450 },
      { name: 'Ice Fang', desc: 'Ice-type bites that slow.', type: 'ice', damage: 1.3, effects: { slow: 0.3 }, cost: 450 },
    ],
    placement: 'any', unlock: { kind: 'badge', badge: 27 },
  },
  {
    id: 'riolu', name: 'Riolu', type: 'fighting', attack: 'bolt', role: 'Aura Spheres that never miss; senses the invisible',
    cost: 140, base: { damage: 13, range: 2.4, rate: 0.9 }, effects: { pierceArmour: 0.3 },
    stages: [{ dex: 447, level: 1 }, { dex: 448, level: 4, power: 1.3 }],
    moves: [
      { name: 'Aura Sphere', desc: 'Seventy per cent more damage.', damage: 1.7, cost: 540 },
      { name: 'Flash Cannon', desc: 'Steel-type beams through a whole line.', type: 'steel', attack: 'beam', damage: 1.3, cost: 540 },
    ],
    placement: 'land', detect: true, unlock: { kind: 'badge', badge: 29 },
  },
  {
    id: 'gible', name: 'Gible', type: 'dragon', attack: 'bolt', role: 'A land shark that grows into mighty Garchomp',
    cost: 160, base: { damage: 14, range: 1.9, rate: 1 }, effects: { crit: 0.1 },
    stages: [{ dex: 443, level: 1 }, { dex: 444, level: 3 }, { dex: 445, level: 5, power: 1.4 }],
    moves: [
      { name: 'Outrage', desc: 'Nearly twice the damage.', damage: 1.9, cost: 620 },
      { name: 'Earthquake', desc: 'Ground-type quakes over a whole group.', type: 'ground', attack: 'splash', damage: 1.5, effects: { splash: 1 }, cost: 620 },
    ],
    placement: 'land', unlock: { kind: 'badge', badge: 31 },
  },
  {
    id: 'gligar', name: 'Gligar', type: 'ground', attack: 'bolt', role: 'Swoops from above: poisons and hunts flyers',
    cost: 120, base: { damage: 10, range: 2.2, rate: 1.2 }, effects: { poison: 0.2, antiAir: 0.5 },
    stages: [{ dex: 207, level: 1 }, { dex: 472, level: 4 }],
    moves: [
      { name: 'Poison Jab', desc: 'Stronger poison.', type: 'poison', effects: { poison: 0.3 }, cost: 480 },
      { name: 'Sky Uppercut', desc: 'Fifty per cent more, and double against flyers.', damage: 1.5, effects: { antiAir: 1 }, cost: 480 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'spiritomb', name: 'Spiritomb', type: 'ghost', attack: 'pulse', role: '108 spirits that curse everything nearby; sees invisible',
    cost: 150, base: { damage: 10, range: 1.6, rate: 0.8 }, effects: { weaken: 0.3, pierceArmour: 1 },
    stages: [{ dex: 442, level: 1 }],
    moves: [
      { name: 'Ominous Wind', desc: 'Everything it touches takes more damage from everyone.', effects: { weaken: 0.7 }, cost: 520 },
      { name: 'Hex', desc: 'Double damage against anything with a status.', damage: 1.3, effects: { hex: 1, confuse: 0.1 }, cost: 520 },
    ],
    placement: 'land', detect: true, unlock: { kind: 'catch' },
  },
  {
    id: 'croagunk', name: 'Croagunk', type: 'poison', attack: 'bolt', role: 'Toxic jabs that poison and crack armour',
    cost: 115, base: { damage: 9, range: 1.8, rate: 1.3 }, effects: { poison: 0.3, pierceArmour: 0.2 },
    stages: [{ dex: 453, level: 1 }, { dex: 454, level: 4 }],
    moves: [
      { name: 'Cross Chop', desc: 'Fighting chops that crit.', type: 'fighting', damage: 1.4, effects: { crit: 0.25 }, cost: 470 },
      { name: 'Sucker Punch', desc: 'Dark jabs that stop enemies in their tracks.', type: 'dark', effects: { flinch: 0.3 }, cost: 470 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'snover', name: 'Snover', type: 'ice', attack: 'pulse', role: 'A blizzard around it: slows and chills everything near',
    cost: 130, base: { damage: 8, range: 1.7, rate: 0.9 }, effects: { slow: 0.3, chip: 0.005 },
    stages: [{ dex: 459, level: 1 }, { dex: 460, level: 4 }],
    moves: [
      { name: 'Blizzard', desc: 'Sixty per cent more, over a wider area.', damage: 1.6, range: 0.4, cost: 500 },
      { name: 'Wood Hammer', desc: 'Grass-type blows twice as hard.', type: 'grass', damage: 2, rate: 0.8, cost: 500 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'bronzor', name: 'Bronzor', type: 'steel', attack: 'pulse', role: 'A humming bell that confuses everything near it',
    cost: 120, base: { damage: 7, range: 1.6, rate: 0.9 }, effects: { confuse: 0.2 },
    stages: [{ dex: 436, level: 1 }, { dex: 437, level: 4 }],
    moves: [
      { name: 'Extrasensory', desc: 'Psychic waves that make enemies flinch.', type: 'psychic', damage: 1.4, effects: { flinch: 0.25 }, cost: 480 },
      { name: 'Trick Room', desc: 'Sends enemies back where they came from.', effects: { rewind: 0.15 }, cost: 520 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'dialga', name: 'Dialga', type: 'steel', attack: 'beam', role: 'The legend of time: bends it backwards',
    cost: 480, base: { damage: 40, range: 2.8, rate: 0.9 }, effects: { rewind: 0.1, pierceArmour: 0.3 },
    stages: [{ dex: 483, level: 1 }],
    moves: [
      { name: 'Roar of Time', desc: 'Dragon-type beams that send enemies far back.', type: 'dragon', damage: 1.3, effects: { rewind: 0.2 }, cost: 950 },
      { name: 'Flash Cannon', desc: 'Leaves targets taking more damage from everyone.', effects: { weaken: 1 }, cost: 950 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'palkia', name: 'Palkia', type: 'water', attack: 'splash', role: 'The legend of space: tears it open; can stand on water',
    cost: 480, base: { damage: 40, range: 2.8, rate: 0.8 }, effects: { splash: 1.1 },
    stages: [{ dex: 484, level: 1 }],
    moves: [
      { name: 'Spacial Rend', desc: 'Dragon-type rifts that crit often.', type: 'dragon', damage: 1.3, effects: { crit: 0.35 }, cost: 950 },
      { name: 'Hydro Pump', desc: 'Half as strong again.', damage: 1.5, cost: 950 },
    ],
    placement: 'any', unlock: { kind: 'catch' },
  },
];
