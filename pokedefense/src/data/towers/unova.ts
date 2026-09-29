/** Unova's tower lines: the starters Professor Juniper gives, five earned with badges, five to catch, and two legends. */
import type { TowerLine } from '../towers';

export const UNOVA_LINES: readonly TowerLine[] = [
  {
    id: 'snivy', name: 'Snivy', type: 'grass', attack: 'bolt', role: 'Regal vines: long range, slowing, and quick',
    cost: 115, base: { damage: 8, range: 2.6, rate: 1.3 }, effects: { slow: 0.2 },
    stages: [{ dex: 495, level: 1 }, { dex: 496, level: 3 }, { dex: 497, level: 5 }],
    moves: [
      { name: 'Leaf Storm', desc: 'A storm of leaves over a whole group.', attack: 'splash', damage: 1.8, rate: 0.7, effects: { splash: 1.1 }, cost: 500 },
      { name: 'Coil', desc: 'Wraps its targets up: much slower and paralysed.', effects: { slow: 0.2, paralyse: 0.15 }, cost: 480 },
    ],
    placement: 'land', unlock: { kind: 'region', region: 'unova' },
  },
  {
    id: 'tepig', name: 'Tepig', type: 'fire', attack: 'splash', role: 'Fiery charges that burn and knock enemies back',
    cost: 120, base: { damage: 10, range: 1.9, rate: 0.9 }, effects: { splash: 0.6, burn: 0.2, knockback: 0.3 },
    stages: [{ dex: 498, level: 1 }, { dex: 499, level: 3 }, { dex: 500, level: 5, power: 1.25 }],
    moves: [
      { name: 'Heat Crash', desc: 'Sixty per cent more damage.', damage: 1.6, cost: 500 },
      { name: 'Hammer Arm', desc: 'Fighting-type blows that knock enemies well back.', type: 'fighting', effects: { knockback: 0.6, pierceArmour: 0.3 }, cost: 500 },
    ],
    placement: 'land', unlock: { kind: 'region', region: 'unova' },
  },
  {
    id: 'oshawott', name: 'Oshawott', type: 'water', attack: 'bolt', role: 'Scalchop slashes that land critical hits; can swim',
    cost: 115, base: { damage: 10, range: 2, rate: 1.1 }, effects: { crit: 0.2 },
    stages: [{ dex: 501, level: 1 }, { dex: 502, level: 3 }],
    // Or its Hisuian form, as Professor Laventon knew it.
    branches: {
      level: 5,
      options: [
        { item: 'mystic-water', dex: 503, type: 'water', attack: 'bolt', desc: 'Samurott: the seamitars, as in Unova.', effects: {} },
        { item: 'black-glasses', dex: 10236, type: 'dark', attack: 'bolt', desc: 'Hisuian Samurott: dark blades that leave targets weakened.', effects: { weaken: 0.5 } },
      ],
    },
    moves: [
      { name: 'Razor Shell', desc: 'Critical hits nearly half the time.', effects: { crit: 0.25 }, cost: 480 },
      { name: 'Hydro Pump', desc: 'A jet through a whole line.', attack: 'beam', damage: 1.5, cost: 500 },
    ],
    placement: 'any', unlock: { kind: 'region', region: 'unova' },
  },
  {
    id: 'pidove', name: 'Pidove', type: 'flying', attack: 'bolt', role: 'Air slashes that make enemies flinch; downs flyers',
    cost: 90, base: { damage: 6, range: 2.3, rate: 1.5 }, effects: { antiAir: 0.5, flinch: 0.08 },
    stages: [{ dex: 519, level: 1 }, { dex: 520, level: 3 }, { dex: 521, level: 5 }],
    moves: [
      { name: 'Air Slash', desc: 'Makes enemies flinch far more often.', effects: { flinch: 0.2 }, cost: 420 },
      { name: 'Sky Attack', desc: 'Twice the damage, a little slower.', damage: 2, rate: 0.8, cost: 450 },
    ],
    placement: 'land', unlock: { kind: 'badge', badge: 33 },
  },
  {
    id: 'blitzle', name: 'Blitzle', type: 'electric', attack: 'chain', role: 'Galloping lightning that jumps between enemies',
    cost: 115, base: { damage: 8, range: 2.1, rate: 1.4 }, effects: { chain: 2 },
    stages: [{ dex: 522, level: 1 }, { dex: 523, level: 4 }],
    moves: [
      { name: 'Wild Charge', desc: 'Half as strong again.', damage: 1.5, cost: 460 },
      { name: 'Flame Charge', desc: 'Fire-type charges that burn, and get faster.', type: 'fire', rate: 1.2, effects: { burn: 0.2 }, cost: 460 },
    ],
    placement: 'land', unlock: { kind: 'badge', badge: 34 },
  },
  {
    id: 'roggenrola', name: 'Roggenrola', type: 'rock', attack: 'splash', role: 'Rock blasts that crack armour over an area',
    cost: 125, base: { damage: 12, range: 2.1, rate: 0.7 }, effects: { splash: 0.6, pierceArmour: 0.3 },
    stages: [{ dex: 524, level: 1 }, { dex: 525, level: 3 }, { dex: 526, level: 5, power: 1.25 }],
    moves: [
      { name: 'Stone Edge', desc: 'Sharp stones that crit very often.', damage: 1.4, effects: { crit: 0.35 }, cost: 500 },
      { name: 'Sandstorm', desc: 'Whips up a sandstorm that wears down enemies near it.', range: 0.4, effects: { chip: 0.02 }, cost: 500 },
    ],
    placement: 'land', unlock: { kind: 'badge', badge: 35 },
  },
  {
    id: 'litwick', name: 'Litwick', type: 'ghost', attack: 'splash', role: 'Ghostly flames that burn a crowd; sees invisible',
    cost: 130, base: { damage: 9, range: 2.3, rate: 0.9 }, effects: { splash: 0.6, burn: 0.3 },
    stages: [{ dex: 607, level: 1 }, { dex: 608, level: 3 }, { dex: 609, level: 5, power: 1.3 }],
    moves: [
      { name: 'Hex', desc: 'Double damage against anything with a status.', effects: { hex: 1 }, cost: 500 },
      { name: 'Overheat', desc: 'Fire-type blasts, nearly twice as hard.', type: 'fire', damage: 1.9, rate: 0.8, cost: 500 },
    ],
    placement: 'land', detect: true, unlock: { kind: 'badge', badge: 37 },
  },
  {
    id: 'axew', name: 'Axew', type: 'dragon', attack: 'bolt', role: 'Tusks that cut through anything; grows into Haxorus',
    cost: 150, base: { damage: 15, range: 1.7, rate: 0.9 }, effects: { crit: 0.15, pierceArmour: 0.3 },
    stages: [{ dex: 610, level: 1 }, { dex: 611, level: 3 }, { dex: 612, level: 5, power: 1.4 }],
    moves: [
      { name: 'Dragon Dance', desc: 'Faster and stronger.', damage: 1.3, rate: 1.3, cost: 600 },
      { name: 'Guillotine', desc: 'A chance to knock out any non-boss outright.', damage: 1.2, effects: { ohko: 0.06 }, cost: 600 },
    ],
    placement: 'land', unlock: { kind: 'badge', badge: 39 },
  },
  {
    id: 'sandile', name: 'Sandile', type: 'ground', attack: 'bolt', role: 'Crunching jaws that leave targets weaker',
    cost: 120, base: { damage: 11, range: 1.9, rate: 1 }, effects: { weaken: 0.3 },
    stages: [{ dex: 551, level: 1 }, { dex: 552, level: 3 }, { dex: 553, level: 5 }],
    moves: [
      { name: 'Crunch', desc: 'Dark-type bites, and targets take more damage.', type: 'dark', damage: 1.3, effects: { weaken: 0.7 }, cost: 480 },
      { name: 'Earthquake', desc: 'Quakes over a whole group.', attack: 'splash', damage: 1.4, effects: { splash: 1 }, cost: 480 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'deino', name: 'Deino', type: 'dark', attack: 'splash', role: 'Blind and brutal; becomes three-headed Hydreigon',
    cost: 160, base: { damage: 13, range: 2, rate: 0.8 }, effects: { splash: 0.5 },
    stages: [{ dex: 633, level: 1 }, { dex: 634, level: 3 }, { dex: 635, level: 5, power: 1.45 }],
    moves: [
      { name: 'Dragon Pulse', desc: 'Dragon-type blasts, sixty per cent stronger.', type: 'dragon', damage: 1.6, cost: 620 },
      { name: 'Tri Attack', desc: 'Three heads: each hit burns, paralyses or freezes.', effects: { random: 1 }, cost: 620 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'larvesta', name: 'Larvesta', type: 'fire', attack: 'splash', role: 'Becomes Volcarona, the sun: fiery dust over everything',
    cost: 170, base: { damage: 10, range: 2.2, rate: 0.9 }, effects: { splash: 0.7, burn: 0.3 },
    stages: [{ dex: 636, level: 1 }, { dex: 637, level: 4, power: 1.5 }],
    moves: [
      { name: 'Quiver Dance', desc: 'Faster, stronger, and further.', damage: 1.25, rate: 1.25, range: 0.4, cost: 640 },
      { name: 'Fiery Dance', desc: 'Burns far worse, and makes nearby towers stronger.', effects: { burn: 0.4, auraDamage: 0.1 }, cost: 640 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'vanillite', name: 'Vanillite', type: 'ice', attack: 'splash', role: 'Ice-cream flurries that slow a crowd',
    cost: 110, base: { damage: 7, range: 2.2, rate: 0.9 }, effects: { splash: 0.7, slow: 0.3 },
    stages: [{ dex: 582, level: 1 }, { dex: 583, level: 3 }, { dex: 584, level: 5 }],
    moves: [
      { name: 'Blizzard', desc: 'Sixty per cent more, and slows harder.', damage: 1.6, effects: { slow: 0.15 }, cost: 470 },
      { name: 'Sheer Cold', desc: 'A small chance to freeze any non-boss solid.', effects: { ohko: 0.05 }, cost: 470 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'ferroseed', name: 'Ferroseed', type: 'steel', attack: 'pulse', role: 'Iron barbs on the path itself: spikes for all who pass',
    cost: 110, base: { damage: 9, range: 0.9, rate: 1.2 }, effects: { pierceArmour: 0.3 },
    stages: [{ dex: 597, level: 1 }, { dex: 598, level: 4 }],
    moves: [
      { name: 'Spikes', desc: 'Wider, sharper barbs.', damage: 1.5, range: 0.4, cost: 460 },
      { name: 'Power Whip', desc: 'Grass-type lashes that slow.', type: 'grass', effects: { slow: 0.35 }, cost: 460 },
    ],
    placement: 'path', groundOnly: true, unlock: { kind: 'catch' },
  },
  {
    id: 'reshiram', name: 'Reshiram', type: 'fire', attack: 'beam', role: 'The legend of truth: white flames through everything',
    cost: 480, base: { damage: 38, range: 2.9, rate: 0.9 }, effects: { burn: 0.3 },
    stages: [{ dex: 643, level: 1 }],
    moves: [
      { name: 'Blue Flare', desc: 'Half as strong again, and burns harder.', damage: 1.5, effects: { burn: 0.3 }, cost: 950 },
      { name: 'Draco Meteor', desc: 'Dragon-type meteors over a whole group.', type: 'dragon', attack: 'splash', damage: 1.7, effects: { splash: 1.2 }, cost: 950 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'zekrom', name: 'Zekrom', type: 'electric', attack: 'chain', role: 'The legend of ideals: black lightning that jumps',
    cost: 480, base: { damage: 36, range: 2.8, rate: 1 }, effects: { chain: 3, paralyse: 0.15 },
    stages: [{ dex: 644, level: 1 }],
    moves: [
      { name: 'Bolt Strike', desc: 'Half as strong again, with more paralysis.', damage: 1.5, effects: { paralyse: 0.15 }, cost: 950 },
      { name: 'Outrage', desc: 'Dragon-type fury that jumps to two more.', type: 'dragon', damage: 1.3, effects: { chain: 2 }, cost: 950 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
];
