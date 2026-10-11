import type { ClassDef, ClassId, OriginDef, StatId, TraitDef } from './types';

export const STATS: readonly { id: StatId; name: string; desc: string }[] = [
  { id: 'grit', name: 'Grit', desc: 'Toughness. Health, hazards, heavy work.' },
  { id: 'wits', name: 'Wits', desc: 'Science, systems, puzzles, spotting a lie.' },
  { id: 'reflex', name: 'Reflex', desc: 'Piloting, shooting, getting out of the way.' },
  { id: 'charm', name: 'Charm', desc: 'Talking, trading, keeping spirits up.' },
];

export const CLASSES: readonly ClassDef[] = [
  {
    id: 'pilot',
    name: 'Pilot',
    desc: 'Flies the ship. Better evasion and cheaper jumps.',
    stats: { grit: 3, wits: 4, reflex: 7, charm: 4 },
    combat: { id: 'evade', name: 'Evasive roll', desc: '+30% evasion this turn and the next.' },
    away: { id: 'dash', name: 'Dash', desc: 'A burst of thrusters: a short, fast dash.', cooldown: 5 },
    color: '#5ac8f0',
  },
  {
    id: 'engineer',
    name: 'Engineer',
    desc: 'Keeps the ship together. Repairs in combat and out.',
    stats: { grit: 6, wits: 6, reflex: 3, charm: 3 },
    combat: { id: 'repair', name: 'Patch systems', desc: 'Repairs the most damaged subsystem and some hull.' },
    away: { id: 'turret', name: 'Turret', desc: 'Drops a sentry that shoots fauna for 10 seconds.', cooldown: 14 },
    color: '#f0b040',
  },
  {
    id: 'scientist',
    name: 'Scientist',
    desc: 'Reads the void. Scans, anomalies, and the Choir.',
    stats: { grit: 3, wits: 8, reflex: 4, charm: 3 },
    combat: { id: 'scan', name: 'Find weak point', desc: 'Next volley gets +25% accuracy and double damage to systems.' },
    away: { id: 'pulse', name: 'Survey pulse', desc: 'Marks every deposit and cryo pod on the map.', cooldown: 12 },
    color: '#b080f0',
  },
  {
    id: 'medic',
    name: 'Medic',
    desc: 'Keeps the crew alive and sane.',
    stats: { grit: 4, wits: 6, reflex: 3, charm: 6 },
    combat: { id: 'triage', name: 'Triage', desc: 'Heals every crew member by 15.' },
    away: { id: 'heal', name: 'Nanogel', desc: 'Heals 35 health.', cooldown: 12 },
    color: '#f07080',
  },
  {
    id: 'soldier',
    name: 'Soldier',
    desc: 'Fights. Boarding actions and hostile worlds.',
    stats: { grit: 7, wits: 3, reflex: 6, charm: 2 },
    combat: { id: 'board', name: 'Boarding strike', desc: 'A team crosses over: heavy damage to the targeted subsystem.' },
    away: { id: 'grenade', name: 'Grenade', desc: 'Blasts every creature nearby.', cooldown: 8 },
    color: '#80d050',
  },
];
export const CLASS = new Map(CLASSES.map((c) => [c.id, c]));
export const CLASS_IDS: readonly ClassId[] = CLASSES.map((c) => c.id);

export const TRAITS: readonly TraitDef[] = [
  { id: 'iron-stomach', name: 'Iron Stomach', desc: 'Eats half as much.', good: true, mods: {}, eats: 0.5 },
  { id: 'hardy', name: 'Hardy', desc: '+20 health on landings, +1 Grit.', good: true, mods: { hp: 20, grit: 1 } },
  { id: 'quick', name: 'Quick', desc: 'Moves faster on landings, +1 Reflex.', good: true, mods: { speed: 0.12, reflex: 1 } },
  { id: 'genius', name: 'Genius', desc: '+2 Wits.', good: true, mods: { wits: 2 } },
  { id: 'silver-tongue', name: 'Silver Tongue', desc: '+2 Charm, better prices.', good: true, mods: { charm: 2, trade: 0.04 } },
  { id: 'cheerful', name: 'Cheerful', desc: 'The crew loses morale more slowly.', good: true, mods: { morale: 0.15 } },
  { id: 'scavenger', name: 'Scavenger', desc: 'Gathers more on landings.', good: true, mods: { gather: 0.25 } },
  { id: 'deep-lungs', name: 'Deep Lungs', desc: 'Suit air lasts longer.', good: true, mods: { o2: 25 } },
  { id: 'glutton', name: 'Glutton', desc: 'Eats half again as much.', good: false, mods: {}, eats: 1.5 },
  { id: 'frail', name: 'Frail', desc: '−15 health on landings, −1 Grit.', good: false, mods: { hp: -15, grit: -1 } },
  { id: 'gloomy', name: 'Gloomy', desc: 'The crew loses morale faster.', good: false, mods: { morale: -0.15 } },
  { id: 'clumsy', name: 'Clumsy', desc: '−1 Reflex, slower on landings.', good: false, mods: { reflex: -1, speed: -0.08 } },
];
export const TRAIT = new Map(TRAITS.map((t) => [t.id, t]));

export const ORIGINS: readonly OriginDef[] = [
  {
    id: 'navy',
    name: 'Concord Navy',
    desc: 'You wore the uniform. The Remnant still salutes you; the Clans remember why they shouldn\'t.',
    cls: 'soldier',
    stats: { grit: 1, reflex: 1 },
    res: { hull: 10 },
    mats: { alloy: 2 },
    rep: { concord: 25, clans: -10 },
  },
  {
    id: 'salvager',
    name: 'Salvager',
    desc: 'You crewed a tug that cut wrecks for scrap. You know which panels come off easy.',
    cls: 'engineer',
    stats: { grit: 1, wits: 1 },
    res: { credits: 60 },
    mats: { ore: 10, alloy: 2 },
    rep: { clans: 20 },
  },
  {
    id: 'scholar',
    name: 'Ark Scholar',
    desc: 'You were meant to wake on Haven and catalogue it. You read the old surveys on the way.',
    cls: 'scientist',
    stats: { wits: 2 },
    res: { energy: 10 },
    mats: { crystal: 4 },
    rep: { choir: 10 },
  },
  {
    id: 'colonist',
    name: 'Colonist',
    desc: 'You signed up to farm a new world. You know how to grow things, and how to make people believe.',
    cls: 'medic',
    stats: { charm: 2 },
    res: { food: 6 },
    mats: { organics: 8 },
    rep: {},
  },
];
export const ORIGIN = new Map(ORIGINS.map((o) => [o.id, o]));

export const FIRST_NAMES = [
  'Ada', 'Bram', 'Cass', 'Dov', 'Esme', 'Farid', 'Gale', 'Hollis', 'Ines', 'Joss', 'Kaito', 'Lune', 'Mags', 'Nico',
  'Oren', 'Pia', 'Quill', 'Rhea', 'Sol', 'Tamsin', 'Ulla', 'Vash', 'Wren', 'Xan', 'Yara', 'Zed', 'Ash', 'Bex',
  'Cyrus', 'Dara', 'Eli', 'Fen', 'Ilse', 'Juno', 'Kip', 'Lior', 'Mira', 'Nell', 'Otto', 'Rafe', 'Suri', 'Teo',
];
export const LAST_NAMES = [
  'Okafor', 'Vance', 'Reyes', 'Lindqvist', 'Moreau', 'Tanaka', 'Haddad', 'Novak', 'Achebe', 'Castell', 'Iversen',
  'Kowal', 'Mbeki', 'Quist', 'Sato', 'Varga', 'Whitlock', 'Yilmaz', 'Brandt', 'Duarte', 'Fenn', 'Halloran', 'Petrov',
];
