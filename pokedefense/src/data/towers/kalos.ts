/** Kalos's tower lines: the starters Professor Sycamore gives, five earned with badges, four to catch, and two legends. */
import type { TowerLine } from '../towers';

export const KALOS_LINES: readonly TowerLine[] = [
  {
    id: 'chespin', name: 'Chespin', type: 'grass', attack: 'pulse', role: 'Spiky Shield: needles that push back everything near',
    cost: 120, base: { damage: 8, range: 1.5, rate: 0.9 }, effects: { knockback: 0.25 },
    stages: [{ dex: 650, level: 1 }, { dex: 651, level: 3 }, { dex: 652, level: 5, power: 1.25 }],
    moves: [
      { name: 'Spiky Shield', desc: 'Pushes enemies much further back.', effects: { knockback: 0.4 }, cost: 480 },
      { name: 'Hammer Arm', desc: 'Fighting-type blows, sixty per cent stronger.', type: 'fighting', damage: 1.6, effects: { pierceArmour: 0.3 }, cost: 480 },
    ],
    placement: 'land', unlock: { kind: 'region', region: 'kalos' },
  },
  {
    id: 'fennekin', name: 'Fennekin', type: 'fire', attack: 'splash', role: 'Mystic fire over a crowd; sees invisible',
    cost: 125, base: { damage: 9, range: 2.5, rate: 0.9 }, effects: { splash: 0.6, burn: 0.2 },
    stages: [{ dex: 653, level: 1 }, { dex: 654, level: 3 }, { dex: 655, level: 5 }],
    moves: [
      { name: 'Mystical Fire', desc: 'Leaves targets taking more damage from everyone.', damage: 1.2, effects: { weaken: 0.8 }, cost: 500 },
      { name: 'Psychic', desc: 'Psychic-type blasts, sixty per cent stronger, that confuse.', type: 'psychic', damage: 1.6, effects: { confuse: 0.15 }, cost: 500 },
    ],
    placement: 'land', detect: true, unlock: { kind: 'region', region: 'kalos' },
  },
  {
    id: 'froakie', name: 'Froakie', type: 'water', attack: 'bolt', role: 'Protean: each hit takes the type its target fears most',
    cost: 125, base: { damage: 8, range: 2.3, rate: 1.5 }, effects: { adapt: 1 },
    stages: [{ dex: 656, level: 1 }, { dex: 657, level: 3 }, { dex: 658, level: 5 }],
    moves: [
      { name: 'Water Shuriken', desc: 'Much faster throws.', rate: 1.4, cost: 500 },
      { name: 'Night Slash', desc: 'Sharper stars that crit often.', damage: 1.2, effects: { crit: 0.3 }, cost: 500 },
    ],
    placement: 'any', unlock: { kind: 'region', region: 'kalos' },
  },
  {
    id: 'fletchling', name: 'Fletchling', type: 'flying', attack: 'bolt', role: 'The fastest bird: burns, and downs flyers',
    cost: 100, base: { damage: 6, range: 2.2, rate: 1.8 }, effects: { antiAir: 0.5 },
    stages: [{ dex: 661, level: 1 }, { dex: 662, level: 3 }, { dex: 663, level: 5 }],
    moves: [
      { name: 'Brave Bird', desc: 'Sixty per cent more damage.', damage: 1.6, cost: 460 },
      { name: 'Flare Blitz', desc: 'Fire-type strikes that burn.', type: 'fire', damage: 1.3, effects: { burn: 0.3 }, cost: 460 },
    ],
    placement: 'land', unlock: { kind: 'badge', badge: 51 },
  },
  {
    id: 'honedge', name: 'Honedge', type: 'steel', attack: 'bolt', role: 'A haunted blade: cuts through armour; sees invisible',
    cost: 140, base: { damage: 14, range: 1.8, rate: 0.8 }, effects: { pierceArmour: 0.5 },
    stages: [{ dex: 679, level: 1 }, { dex: 680, level: 3 }, { dex: 681, level: 5, power: 1.3 }],
    moves: [
      { name: 'King’s Shield', desc: 'Its blows leave targets weaker, and make them flinch.', effects: { weaken: 0.6, flinch: 0.15 }, cost: 540 },
      { name: 'Shadow Sneak', desc: 'Ghost-type strikes, faster and sharper.', type: 'ghost', rate: 1.3, effects: { crit: 0.2 }, cost: 540 },
    ],
    placement: 'land', detect: true, unlock: { kind: 'badge', badge: 52 },
  },
  {
    id: 'helioptile', name: 'Helioptile', type: 'electric', attack: 'chain', role: 'Solar-charged sparks that jump far',
    cost: 115, base: { damage: 8, range: 2.3, rate: 1.1 }, effects: { chain: 3 },
    stages: [{ dex: 694, level: 1 }, { dex: 695, level: 4 }],
    moves: [
      { name: 'Thunderbolt', desc: 'Half as strong again, with paralysis.', damage: 1.5, effects: { paralyse: 0.15 }, cost: 470 },
      { name: 'Parabolic Charge', desc: 'Each knockout sometimes restores a life.', effects: { lifeEvery: 25 }, cost: 470 },
    ],
    placement: 'land', unlock: { kind: 'badge', badge: 54 },
  },
  {
    id: 'skrelp', name: 'Skrelp', type: 'poison', attack: 'bolt', role: 'Toxic ink from the water; can swim',
    cost: 110, base: { damage: 7, range: 2.4, rate: 1.1 }, effects: { poison: 0.35 },
    stages: [{ dex: 690, level: 1 }, { dex: 691, level: 4 }],
    moves: [
      { name: 'Sludge Bomb', desc: 'Poison that bursts over a group.', attack: 'splash', damage: 1.3, effects: { splash: 0.9 }, cost: 470 },
      { name: 'Dragon Pulse', desc: 'Dragon-type blasts, sixty per cent stronger.', type: 'dragon', damage: 1.6, cost: 470 },
    ],
    placement: 'any', unlock: { kind: 'badge', badge: 55 },
  },
  {
    id: 'goomy', name: 'Goomy', type: 'dragon', attack: 'splash', role: 'Sticky slime that slows; grows into gentle Goodra',
    cost: 150, base: { damage: 12, range: 2, rate: 0.8 }, effects: { splash: 0.6, slow: 0.25 },
    stages: [{ dex: 704, level: 1 }, { dex: 705, level: 3 }, { dex: 706, level: 5, power: 1.4 }],
    moves: [
      { name: 'Draco Meteor', desc: 'Nearly twice as hard, over a wider area.', damage: 1.9, rate: 0.7, effects: { splash: 0.5 }, cost: 600 },
      { name: 'Sludge Wave', desc: 'Poison-type waves that poison and slow.', type: 'poison', effects: { poison: 0.4, slow: 0.15 }, cost: 580 },
    ],
    placement: 'land', unlock: { kind: 'badge', badge: 57 },
  },
  {
    id: 'hawlucha', name: 'Hawlucha', type: 'fighting', attack: 'bolt', role: 'A high-flying wrestler: crits, and downs flyers',
    cost: 130, base: { damage: 12, range: 1.9, rate: 1.2 }, effects: { crit: 0.2, antiAir: 0.5 },
    stages: [{ dex: 701, level: 1 }],
    moves: [
      { name: 'Flying Press', desc: 'Flying-type dives, half as strong again.', type: 'flying', damage: 1.5, cost: 500 },
      { name: 'High Jump Kick', desc: 'Critical hits nearly half the time.', effects: { crit: 0.25 }, cost: 500 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'noibat', name: 'Noibat', type: 'dragon', attack: 'pulse', role: 'Ultrasonic waves that confuse; echolocates the invisible',
    cost: 130, base: { damage: 8, range: 1.8, rate: 1 }, effects: { confuse: 0.2 },
    stages: [{ dex: 714, level: 1 }, { dex: 715, level: 4, power: 1.3 }],
    moves: [
      { name: 'Boomburst', desc: 'Normal-type noise, sixty per cent louder, over a wider area.', type: 'normal', damage: 1.6, range: 0.4, cost: 520 },
      { name: 'Hurricane', desc: 'Flying-type winds that confuse and push back.', type: 'flying', effects: { confuse: 0.1, knockback: 0.3 }, cost: 520 },
    ],
    placement: 'land', detect: true, unlock: { kind: 'catch' },
  },
  {
    id: 'klefki', name: 'Klefki', type: 'fairy', attack: 'aura', role: 'A jangling key ring: stronger towers nearby, and ₽',
    cost: 130, base: { damage: 0, range: 1.6, rate: 0 }, effects: { auraDamage: 0.1, income: 12 },
    stages: [{ dex: 707, level: 1 }],
    moves: [
      { name: 'Fairy Lock', desc: 'A wider, stronger aura.', range: 0.5, effects: { auraDamage: 0.15, auraRate: 0.1 }, cost: 480 },
      { name: 'Thief', desc: 'Far more ₽ every wave.', effects: { income: 18 }, cost: 480 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'pumpkaboo', name: 'Pumpkaboo', type: 'ghost', attack: 'splash', role: 'Pumpkin bombs that curse a crowd; sees invisible',
    cost: 120, base: { damage: 8, range: 2.1, rate: 0.9 }, effects: { splash: 0.7, hex: 0.5 },
    stages: [{ dex: 710, level: 1 }, { dex: 711, level: 4 }],
    moves: [
      { name: 'Trick-or-Treat', desc: 'Its hits pay ₽.', effects: { payDay: 2 }, cost: 450 },
      { name: 'Seed Bomb', desc: 'Grass-type bombs that slow, sixty per cent stronger.', type: 'grass', damage: 1.6, effects: { slow: 0.2 }, cost: 470 },
    ],
    placement: 'land', detect: true, unlock: { kind: 'catch' },
  },
  {
    id: 'xerneas', name: 'Xerneas', type: 'fairy', attack: 'aura', role: 'The legend of life: every tower near it grows mighty',
    cost: 480, base: { damage: 0, range: 2.2, rate: 0 }, effects: { auraDamage: 0.3, auraRate: 0.15, wish: 1 },
    stages: [{ dex: 716, level: 1 }],
    moves: [
      { name: 'Geomancy', desc: 'A far stronger, wider aura.', range: 0.6, effects: { auraDamage: 0.25, auraRate: 0.1 }, cost: 950 },
      { name: 'Aromatherapy', desc: 'Restores two more lives after every wave.', effects: { wish: 2 }, cost: 950 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'yveltal', name: 'Yveltal', type: 'dark', attack: 'beam', role: 'The legend of destruction: its knockouts restore lives',
    cost: 480, base: { damage: 40, range: 2.9, rate: 0.9 }, effects: { lifeEvery: 20 },
    stages: [{ dex: 717, level: 1 }],
    moves: [
      { name: 'Oblivion Wing', desc: 'Restores lives far more often.', effects: { lifeEvery: -10 }, cost: 950 },
      { name: 'Hurricane', desc: 'Flying-type winds, half as strong again, that confuse.', type: 'flying', damage: 1.5, effects: { confuse: 0.2 }, cost: 950 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
];
