/** Alola's tower lines: the starters Professor Kukui gives, five earned in the island trials, four to catch, and two legends. */
import type { TowerLine } from '../towers';

export const ALOLA_LINES: readonly TowerLine[] = [
  {
    id: 'rowlet', name: 'Rowlet', type: 'grass', attack: 'bolt', role: 'Silent feathered arrows from afar; Decidueye sees the unseen',
    cost: 120, base: { damage: 9, range: 2.8, rate: 1 }, effects: { crit: 0.1 },
    stages: [{ dex: 722, level: 1 }, { dex: 723, level: 3 }, { dex: 724, level: 5 }],
    moves: [
      { name: 'Spirit Shackle', desc: 'Ghost-type arrows that pin enemies in place.', type: 'ghost', damage: 1.3, effects: { slow: 0.4 }, cost: 500 },
      { name: 'Leaf Blade', desc: 'Critical hits nearly half the time.', effects: { crit: 0.35 }, cost: 500 },
    ],
    placement: 'land', detect: true, unlock: { kind: 'region', region: 'alola' },
  },
  {
    id: 'litten', name: 'Litten', type: 'fire', attack: 'bolt', role: 'A heel of a wrestler: burns, and hits harder the tougher the foe',
    cost: 120, base: { damage: 11, range: 1.9, rate: 1 }, effects: { burn: 0.25, pierceArmour: 0.3 },
    stages: [{ dex: 725, level: 1 }, { dex: 726, level: 3 }, { dex: 727, level: 5, power: 1.3 }],
    moves: [
      { name: 'Darkest Lariat', desc: 'Dark-type spins that ignore armour entirely.', type: 'dark', damage: 1.4, effects: { pierceArmour: 0.7 }, cost: 500 },
      { name: 'Flare Blitz', desc: 'Sixty per cent more damage, and burns harder.', damage: 1.6, effects: { burn: 0.25 }, cost: 500 },
    ],
    placement: 'land', unlock: { kind: 'region', region: 'alola' },
  },
  {
    id: 'popplio', name: 'Popplio', type: 'water', attack: 'splash', role: 'Bubbles that burst over a crowd; can swim',
    cost: 120, base: { damage: 8, range: 2.3, rate: 0.9 }, effects: { splash: 0.7, slow: 0.15 },
    stages: [{ dex: 728, level: 1 }, { dex: 729, level: 3 }, { dex: 730, level: 5 }],
    moves: [
      { name: 'Sparkling Aria', desc: 'A song that leaves everything it hits taking more damage.', damage: 1.3, effects: { weaken: 0.8 }, cost: 500 },
      { name: 'Moonblast', desc: 'Fairy-type blasts, sixty per cent stronger.', type: 'fairy', damage: 1.6, cost: 500 },
    ],
    placement: 'any', unlock: { kind: 'region', region: 'alola' },
  },
  {
    id: 'pikipek', name: 'Pikipek', type: 'flying', attack: 'bolt', role: 'Rapid-fire pecks; Toucannon’s beak shells blast flyers',
    cost: 95, base: { damage: 5, range: 2.2, rate: 2 }, effects: { antiAir: 0.5 },
    stages: [{ dex: 731, level: 1 }, { dex: 732, level: 3 }, { dex: 733, level: 5 }],
    moves: [
      { name: 'Beak Blast', desc: 'Scalding pecks that burn.', type: 'fire', damage: 1.3, effects: { burn: 0.3 }, cost: 440 },
      { name: 'Bullet Seed', desc: 'Even faster.', type: 'grass', rate: 1.4, cost: 440 },
    ],
    placement: 'land', unlock: { kind: 'badge', badge: 101 },
  },
  {
    id: 'grubbin', name: 'Grubbin', type: 'bug', attack: 'chain', role: 'Becomes Vikavolt, a living railgun of chained lightning',
    cost: 120, base: { damage: 8, range: 2.2, rate: 1 }, effects: { chain: 1 },
    stages: [{ dex: 736, level: 1 }, { dex: 737, level: 3 }, { dex: 738, level: 5, power: 1.35 }],
    moves: [
      { name: 'Zap Cannon', desc: 'Electric-type bolts that jump to three more and paralyse.', type: 'electric', effects: { chain: 2, paralyse: 0.2 }, cost: 500 },
      { name: 'Bug Buzz', desc: 'Half as strong again.', damage: 1.5, cost: 480 },
    ],
    placement: 'land', unlock: { kind: 'badge', badge: 102 },
  },
  {
    id: 'rockruff', name: 'Rockruff', type: 'rock', attack: 'bolt', role: 'A loyal pup that grows into swift Lycanroc',
    cost: 110, base: { damage: 10, range: 2, rate: 1.1 }, effects: { crit: 0.1 },
    stages: [{ dex: 744, level: 1 }, { dex: 745, level: 4, power: 1.3 }],
    moves: [
      { name: 'Accelerock', desc: 'Much faster bites.', rate: 1.45, cost: 460 },
      { name: 'Stone Edge', desc: 'Critical hits nearly half the time.', effects: { crit: 0.35 }, cost: 460 },
    ],
    placement: 'land', unlock: { kind: 'badge', badge: 104 },
  },
  {
    id: 'mudbray', name: 'Mudbray', type: 'ground', attack: 'pulse', role: 'Stamping hooves that shake and slow everything nearby',
    cost: 115, base: { damage: 9, range: 1.5, rate: 0.9 }, effects: { slow: 0.25 },
    stages: [{ dex: 749, level: 1 }, { dex: 750, level: 4, power: 1.3 }],
    moves: [
      { name: 'High Horsepower', desc: 'Seventy per cent stronger quakes.', damage: 1.7, cost: 460 },
      { name: 'Stamina', desc: 'A wider, harder stamp that knocks enemies back.', range: 0.4, effects: { knockback: 0.3 }, cost: 460 },
    ],
    placement: 'land', groundOnly: true, unlock: { kind: 'badge', badge: 105 },
  },
  {
    id: 'jangmo-o', name: 'Jangmo-o', type: 'dragon', attack: 'pulse', role: 'Clanging scales that shake a crowd; grows into Kommo-o',
    cost: 160, base: { damage: 12, range: 1.6, rate: 0.9 }, effects: { weaken: 0.2 },
    stages: [{ dex: 782, level: 1 }, { dex: 783, level: 3 }, { dex: 784, level: 5, power: 1.4 }],
    moves: [
      { name: 'Clangorous Soul', desc: 'Stronger, faster and further.', damage: 1.3, rate: 1.2, range: 0.4, cost: 620 },
      { name: 'Close Combat', desc: 'Fighting-type blows, sixty per cent stronger, that ignore armour.', type: 'fighting', damage: 1.6, effects: { pierceArmour: 0.6 }, cost: 620 },
    ],
    placement: 'land', unlock: { kind: 'badge', badge: 107 },
  },
  {
    id: 'mimikyu', name: 'Mimikyu', type: 'ghost', attack: 'bolt', role: 'A lonely disguise; claws that hex and strike unseen foes',
    cost: 140, base: { damage: 12, range: 2, rate: 1 }, effects: { hex: 0.5, pierceArmour: 0.5 },
    stages: [{ dex: 778, level: 1 }],
    moves: [
      { name: 'Play Rough', desc: 'Fairy-type swipes, sixty per cent stronger.', type: 'fairy', damage: 1.6, cost: 520 },
      { name: 'Shadow Claw', desc: 'Critical hits a third of the time.', effects: { crit: 0.33 }, cost: 520 },
    ],
    placement: 'land', detect: true, unlock: { kind: 'catch' },
  },
  {
    id: 'mareanie', name: 'Mareanie', type: 'poison', attack: 'pulse', role: 'Toxic spines all around; can swim',
    cost: 115, base: { damage: 6, range: 1.6, rate: 1 }, effects: { poison: 0.4 },
    stages: [{ dex: 747, level: 1 }, { dex: 748, level: 4 }],
    moves: [
      { name: 'Baneful Bunker', desc: 'Far stronger poison.', effects: { poison: 0.5 }, cost: 460 },
      { name: 'Liquidation', desc: 'Water-type splashes, sixty per cent stronger.', type: 'water', damage: 1.6, cost: 460 },
    ],
    placement: 'any', unlock: { kind: 'catch' },
  },
  {
    id: 'salandit', name: 'Salandit', type: 'poison', attack: 'splash', role: 'Toxic, burning fumes over a crowd',
    cost: 120, base: { damage: 7, range: 2.2, rate: 1 }, effects: { splash: 0.6, poison: 0.25, burn: 0.15 },
    stages: [{ dex: 757, level: 1 }, { dex: 758, level: 4 }],
    moves: [
      { name: 'Fire Lash', desc: 'Fire-type lashes that burn and weaken.', type: 'fire', effects: { burn: 0.25, weaken: 0.5 }, cost: 480 },
      { name: 'Corrosion', desc: 'Its poison works on anything, and stronger.', effects: { poison: 0.35, pierceArmour: 0.4 }, cost: 480 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'wimpod', name: 'Wimpod', type: 'bug', attack: 'bolt', role: 'Timid… until it becomes Golisopod, a hulking knight',
    cost: 110, base: { damage: 7, range: 1.7, rate: 1.3 }, effects: {},
    stages: [{ dex: 767, level: 1 }, { dex: 768, level: 4, power: 1.6 }],
    moves: [
      { name: 'First Impression', desc: 'Twice as hard.', damage: 2, cost: 500 },
      { name: 'Liquidation', desc: 'Water-type slashes that pierce armour.', type: 'water', damage: 1.4, effects: { pierceArmour: 0.5 }, cost: 500 },
    ],
    placement: 'any', unlock: { kind: 'catch' },
  },
  {
    id: 'solgaleo', name: 'Solgaleo', type: 'steel', attack: 'beam', role: 'The legend of the sun: blazing beams through everything',
    cost: 480, base: { damage: 42, range: 2.9, rate: 0.9 }, effects: { pierceArmour: 0.5 },
    stages: [{ dex: 791, level: 1 }],
    moves: [
      { name: 'Sunsteel Strike', desc: 'Half as strong again, ignoring armour entirely.', damage: 1.5, effects: { pierceArmour: 0.5 }, cost: 950 },
      { name: 'Flare Blitz', desc: 'Fire-type beams that burn.', type: 'fire', damage: 1.3, effects: { burn: 0.35 }, cost: 950 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'lunala', name: 'Lunala', type: 'ghost', attack: 'splash', role: 'The legend of the moon: moonlight over whole crowds; sees all',
    cost: 480, base: { damage: 36, range: 2.9, rate: 0.9 }, effects: { splash: 1.1, hex: 0.5 },
    stages: [{ dex: 792, level: 1 }],
    moves: [
      { name: 'Moongeist Beam', desc: 'Half as strong again; everything it touches takes more damage.', damage: 1.5, effects: { weaken: 0.8 }, cost: 950 },
      { name: 'Moonblast', desc: 'Fairy-type moonlight over a wider area.', type: 'fairy', damage: 1.3, effects: { splash: 0.4 }, cost: 950 },
    ],
    placement: 'land', detect: true, unlock: { kind: 'catch' },
  },
];
