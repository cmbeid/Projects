/**
 * The box legends that were only ever bosses: catch one (a Master Ball
 * helps) and it joins your roster. Each is one stage, and very strong.
 */
import type { TowerLine } from '../towers';

export const LEGEND_LINES: readonly TowerLine[] = [
  {
    id: 'mewtwo', name: 'Mewtwo', type: 'psychic', attack: 'bolt', role: 'The genetic Pokémon: Psystrike tears through any armour',
    cost: 480, base: { damage: 46, range: 3, rate: 1 }, effects: { pierceArmour: 0.6 },
    stages: [{ dex: 150, level: 1 }],
    moves: [
      { name: 'Psystrike', desc: 'Half as strong again, ignoring armour entirely.', damage: 1.5, effects: { pierceArmour: 0.4 }, cost: 950 },
      { name: 'Aura Sphere', desc: 'Fighting-type spheres over a group.', type: 'fighting', attack: 'splash', damage: 1.3, effects: { splash: 1 }, cost: 950 },
    ],
    placement: 'land', detect: true, unlock: { kind: 'catch' },
  },
  {
    id: 'lugia', name: 'Lugia', type: 'psychic', attack: 'beam', role: 'The guardian of the seas: Aeroblast through a whole line; downs flyers; can swim',
    cost: 480, base: { damage: 40, range: 3, rate: 0.9 }, effects: { crit: 0.2, antiAir: 0.5 },
    stages: [{ dex: 249, level: 1 }],
    moves: [
      { name: 'Aeroblast', desc: 'Flying-type blasts that crit half the time.', type: 'flying', damage: 1.3, effects: { crit: 0.3 }, cost: 950 },
      { name: 'Hydro Pump', desc: 'Water-type torrents, sixty per cent stronger.', type: 'water', damage: 1.6, cost: 950 },
    ],
    placement: 'any', unlock: { kind: 'catch' },
  },
  {
    id: 'ho-oh', name: 'Ho-Oh', type: 'fire', attack: 'splash', role: 'The rainbow phoenix: sacred flames that burn, and bring lives back',
    cost: 480, base: { damage: 36, range: 2.8, rate: 0.9 }, effects: { splash: 0.9, burn: 0.3, lifeEvery: 25 },
    stages: [{ dex: 250, level: 1 }],
    moves: [
      { name: 'Sacred Fire', desc: 'Half as strong again, and burns harder.', damage: 1.5, effects: { burn: 0.3 }, cost: 950 },
      { name: 'Recover', desc: 'Restores a life far more often.', effects: { lifeEvery: -13 }, cost: 950 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'kyogre', name: 'Kyogre', type: 'water', attack: 'splash', role: 'Primordial Sea: rain falls for the rest of the battle; can swim',
    cost: 480, base: { damage: 38, range: 2.8, rate: 0.9 }, effects: { splash: 1 },
    stages: [{ dex: 382, level: 1 }],
    moves: [
      { name: 'Origin Pulse', desc: 'Half as strong again, over a wider area.', damage: 1.5, effects: { splash: 0.4 }, cost: 950 },
      { name: 'Ice Beam', desc: 'Ice-type blasts that slow.', type: 'ice', damage: 1.2, effects: { slow: 0.4 }, cost: 950 },
    ],
    placement: 'any', fieldWeather: 'rain', unlock: { kind: 'catch' },
  },
  {
    id: 'groudon', name: 'Groudon', type: 'ground', attack: 'splash', role: 'Desolate Land: harsh sun for the rest of the battle',
    cost: 480, base: { damage: 42, range: 2.6, rate: 0.85 }, effects: { splash: 1, knockback: 0.2 },
    stages: [{ dex: 383, level: 1 }],
    moves: [
      { name: 'Precipice Blades', desc: 'Half as strong again, ignoring armour.', damage: 1.5, effects: { pierceArmour: 0.6 }, cost: 950 },
      { name: 'Fire Punch', desc: 'Fire-type blows that burn — stronger in the sun.', type: 'fire', damage: 1.2, effects: { burn: 0.3 }, cost: 950 },
    ],
    placement: 'land', groundOnly: true, fieldWeather: 'sun', unlock: { kind: 'catch' },
  },
  {
    id: 'rayquaza', name: 'Rayquaza', type: 'dragon', attack: 'beam', role: 'Delta Stream: clears any weather; beams that tear flyers from the sky',
    cost: 480, base: { damage: 44, range: 3, rate: 0.9 }, effects: { antiAir: 0.6 },
    stages: [{ dex: 384, level: 1 }],
    moves: [
      { name: 'Dragon Ascent', desc: 'Flying-type strikes, half as strong again, ignoring armour.', type: 'flying', damage: 1.5, effects: { pierceArmour: 0.5 }, cost: 950 },
      { name: 'Draco Meteor', desc: 'Meteors over a whole group.', attack: 'splash', damage: 1.7, effects: { splash: 1.2 }, cost: 950 },
    ],
    placement: 'land', fieldWeather: 'clear', unlock: { kind: 'catch' },
  },
  {
    id: 'giratina', name: 'Giratina', type: 'ghost', attack: 'bolt', role: 'The renegade from the Distortion World: sees all, and hexes',
    cost: 480, base: { damage: 42, range: 2.8, rate: 1 }, effects: { hex: 0.5, pierceArmour: 0.3 },
    stages: [{ dex: 487, level: 1 }],
    moves: [
      { name: 'Shadow Force', desc: 'Half as strong again, and it strikes first at the unseen.', damage: 1.5, effects: { pierceArmour: 0.4 }, cost: 950 },
      { name: 'Dragon Pulse', desc: 'Dragon-type waves over a group that leave them weaker.', type: 'dragon', attack: 'splash', damage: 1.2, effects: { splash: 1, weaken: 0.6 }, cost: 950 },
    ],
    placement: 'land', detect: true, unlock: { kind: 'catch' },
  },
  {
    id: 'kyurem', name: 'Kyurem', type: 'ice', attack: 'splash', role: 'The boundary Pokémon: freezing blasts that stop crowds in their tracks',
    cost: 480, base: { damage: 36, range: 2.8, rate: 0.9 }, effects: { splash: 1, slow: 0.35, flinch: 0.1 },
    stages: [{ dex: 646, level: 1 }],
    moves: [
      { name: 'Glaciate', desc: 'Half as strong again, and freezes harder.', damage: 1.5, effects: { slow: 0.2, flinch: 0.1 }, cost: 950 },
      { name: 'Dragon Pulse', desc: 'Dragon-type waves, sixty per cent stronger.', type: 'dragon', damage: 1.6, cost: 950 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'zygarde', name: 'Zygarde', type: 'dragon', attack: 'pulse', role: 'The order Pokémon: Thousand Arrows pull even flyers to the ground',
    cost: 480, base: { damage: 34, range: 2.2, rate: 1 }, effects: { slow: 0.2 },
    stages: [{ dex: 718, level: 1 }],
    moves: [
      { name: 'Thousand Arrows', desc: 'Ground-type arrows that hit flyers too, and knock them down.', type: 'ground', damage: 1.4, effects: { smackDown: 1 }, cost: 950 },
      { name: 'Core Enforcer', desc: 'Half as strong again, over a wider ring.', damage: 1.5, range: 0.5, cost: 950 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'necrozma', name: 'Necrozma', type: 'psychic', attack: 'beam', role: 'The prism Pokémon: the hardest-hitting beam of all, if slow',
    cost: 500, base: { damage: 80, range: 3.2, rate: 0.5 }, effects: { pierceArmour: 0.4 },
    stages: [{ dex: 800, level: 1 }],
    moves: [
      { name: 'Prismatic Laser', desc: 'Nearly twice as hard, slower still.', damage: 1.9, rate: 0.75, cost: 1000 },
      { name: 'Photon Geyser', desc: 'Faster light that ignores armour entirely.', rate: 1.4, effects: { pierceArmour: 0.6 }, cost: 1000 },
    ],
    placement: 'land', detect: true, unlock: { kind: 'catch' },
  },
  {
    id: 'eternatus', name: 'Eternatus', type: 'poison', attack: 'splash', role: 'Dynamax Cannon: twice as hard against bosses',
    cost: 500, base: { damage: 38, range: 2.8, rate: 0.85 }, effects: { splash: 1, poison: 0.2, bossBonus: 1 },
    stages: [{ dex: 890, level: 1 }],
    moves: [
      { name: 'Eternabeam', desc: 'Nearly twice as hard, a little slower.', damage: 1.9, rate: 0.8, cost: 1000 },
      { name: 'Dragon Pulse', desc: 'Dragon-type blasts, and the poison lingers.', type: 'dragon', damage: 1.3, effects: { poison: 0.3 }, cost: 1000 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'arceus', name: 'Arceus', type: 'normal', attack: 'bolt', role: 'The Original One: Judgment takes whichever type its target fears most',
    cost: 520, base: { damage: 40, range: 3, rate: 1 }, effects: { judgment: 1 },
    stages: [{ dex: 493, level: 1 }],
    moves: [
      { name: 'Judgment', desc: 'Judgment over a whole group.', attack: 'splash', damage: 1.3, effects: { splash: 1 }, cost: 1000 },
      { name: 'Extreme Speed', desc: 'Much faster.', rate: 1.5, cost: 1000 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'terapagos', name: 'Terapagos', type: 'normal', attack: 'splash', role: 'Tera Starstorm: every type at once, the one each target fears most',
    cost: 520, base: { damage: 36, range: 2.8, rate: 0.9 }, effects: { splash: 1, judgment: 1 },
    stages: [{ dex: 1024, level: 1 }],
    moves: [
      { name: 'Tera Starstorm', desc: 'Half as strong again, over a wider area.', damage: 1.5, effects: { splash: 0.4 }, cost: 1000 },
      { name: 'Tera Shell', desc: 'Faster, ignoring armour.', rate: 1.3, effects: { pierceArmour: 0.6 }, cost: 1000 },
    ],
    placement: 'any', unlock: { kind: 'catch' },
  },
];
