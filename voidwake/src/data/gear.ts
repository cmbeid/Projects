import type { AffixDef, GearDef } from './types';

/**
 * Away-mission gear. Each item is one of four slots; tier is the sector it
 * starts turning up in. Rarity scales the base numbers and adds rolled affixes.
 */
export const GEAR: readonly GearDef[] = [
  // Weapons
  { id: 'w-cutter', slot: 'weapon', name: 'Plasma Cutter', tier: 1, mods: { awayDmg: 0 }, desc: 'A mining tool with ideas.' },
  { id: 'w-pistol', slot: 'weapon', name: 'Service Pistol', tier: 1, mods: { awayDmg: 0.15, range: 0.5 }, desc: 'Concord issue.' },
  { id: 'w-scatter', slot: 'weapon', name: 'Scattergun', tier: 2, mods: { awayDmg: 0.45, range: -1 }, desc: 'Close, loud, final.' },
  { id: 'w-carbine', slot: 'weapon', name: 'Pulse Carbine', tier: 2, mods: { awayDmg: 0.3, fireRate: 0.15 }, desc: 'Steady and quick.' },
  { id: 'w-longrifle', slot: 'weapon', name: 'Long Rifle', tier: 3, mods: { awayDmg: 0.6, range: 2.5, fireRate: -0.15 }, desc: 'For things you want far away.' },
  { id: 'w-arc', slot: 'weapon', name: 'Arc Projector', tier: 3, mods: { awayDmg: 0.5, fireRate: 0.25 }, desc: 'Lightning on a leash.' },
  { id: 'w-clanblade', slot: 'weapon', name: 'Clan Harpoon', tier: 4, mods: { awayDmg: 0.9, range: 1 }, desc: 'Barbed. Rewound by hand.' },
  { id: 'w-lance', slot: 'weapon', name: 'Ion Lance', tier: 4, mods: { awayDmg: 0.8, fireRate: 0.2, range: 1 }, desc: 'Ark security hardware.' },
  { id: 'w-chord', slot: 'weapon', name: 'Chord Emitter', tier: 5, mods: { awayDmg: 1.2, fireRate: 0.25, range: 1 }, desc: 'Hums in a key you can\'t name.' },
  { id: 'w-sunspear', slot: 'weapon', name: 'Sunspear', tier: 6, mods: { awayDmg: 1.6, fireRate: 0.3, range: 2 }, desc: 'Made from a piece of the ark\'s drive.' },
  // Suits
  { id: 's-basic', slot: 'suit', name: 'Survey Suit', tier: 1, mods: { o2: 0, suitShield: 0 }, desc: 'Patched at both knees.' },
  { id: 's-thermal', slot: 'suit', name: 'Thermal Suit', tier: 1, mods: { suitShield: 30, o2: 10 }, desc: 'Keeps the cold out and the heat in, or the reverse.' },
  { id: 's-rebreather', slot: 'suit', name: 'Rebreather Suit', tier: 2, mods: { o2: 45 }, desc: 'Every breath counts twice.' },
  { id: 's-plated', slot: 'suit', name: 'Plated Hardsuit', tier: 2, mods: { hp: 35, suitShield: 15 }, desc: 'Heavy and very hard to bite.' },
  { id: 's-hazmat', slot: 'suit', name: 'Hazmat Shell', tier: 3, mods: { suitShield: 80, o2: 15 }, desc: 'Sealed against almost everything.' },
  { id: 's-ranger', slot: 'suit', name: 'Ranger Weave', tier: 3, mods: { o2: 40, hp: 25, speed: 0.08 }, desc: 'Light, tough, breathable.' },
  { id: 's-clanhide', slot: 'suit', name: 'Clan Hide', tier: 4, mods: { hp: 60, suitShield: 40 }, desc: 'Stitched from something that lived out here.' },
  { id: 's-voidsuit', slot: 'suit', name: 'Voidsuit', tier: 4, mods: { o2: 70, suitShield: 50 }, desc: 'Ark EVA kit, Mk VII.' },
  { id: 's-choir', slot: 'suit', name: 'Choir Mantle', tier: 5, mods: { o2: 80, suitShield: 90, hp: 30 }, desc: 'It breathes with you.' },
  { id: 's-haven', slot: 'suit', name: 'Pathfinder Suit', tier: 6, mods: { o2: 110, suitShield: 120, hp: 60 }, desc: 'What the first landing party was meant to wear.' },
  // Tools
  { id: 't-pick', slot: 'tool', name: 'Hand Drill', tier: 1, mods: { gather: 0 }, desc: 'It works. Slowly.' },
  { id: 't-satchel', slot: 'tool', name: 'Cargo Satchel', tier: 1, mods: { carry: 10 }, desc: 'More pockets.' },
  { id: 't-drill', slot: 'tool', name: 'Core Drill', tier: 2, mods: { gather: 0.4 }, desc: 'Bites through anything softer than diamond.' },
  { id: 't-sled', slot: 'tool', name: 'Hover Sled', tier: 2, mods: { carry: 18, speed: -0.04 }, desc: 'Drags behind you, full of rocks.' },
  { id: 't-sonic', slot: 'tool', name: 'Sonic Extractor', tier: 3, mods: { gather: 0.7, carry: 6 }, desc: 'Shakes ore loose from its host.' },
  { id: 't-boots', slot: 'tool', name: 'Mag Boots', tier: 3, mods: { speed: 0.15, carry: 6 }, desc: 'Run on any ground.' },
  { id: 't-clanhook', slot: 'tool', name: 'Salvage Hook', tier: 4, mods: { gather: 0.8, carry: 15 }, desc: 'Clan salvagers swear by it.' },
  { id: 't-drone', slot: 'tool', name: 'Hauler Drone', tier: 4, mods: { carry: 30 }, desc: 'Follows you, carries everything.' },
  { id: 't-harmonic', slot: 'tool', name: 'Harmonic Tuner', tier: 5, mods: { gather: 1.2, carry: 15 }, desc: 'Sings crystals out of the ground.' },
  { id: 't-ark', slot: 'tool', name: 'Ark Fabricore', tier: 6, mods: { gather: 1.5, carry: 30, speed: 0.1 }, desc: 'A pocket refinery.' },
  // Modules
  { id: 'm-o2', slot: 'module', name: 'Spare Tank', tier: 1, mods: { o2: 30 }, desc: 'Thirty more seconds.' },
  { id: 'm-sprint', slot: 'module', name: 'Servo Legs', tier: 1, mods: { speed: 0.12 }, desc: 'Walk like you mean it.' },
  { id: 'm-medic', slot: 'module', name: 'Trauma Pack', tier: 2, mods: { hp: 30 }, desc: 'Auto-injectors in the collar.' },
  { id: 'm-cooldown', slot: 'module', name: 'Capacitor Bank', tier: 2, mods: { skillCd: 0.2 }, desc: 'Skills come back sooner.' },
  { id: 'm-scope', slot: 'module', name: 'Smart Scope', tier: 3, mods: { range: 1.5, awayDmg: 0.15 }, desc: 'Paints targets for you.' },
  { id: 'm-shield', slot: 'module', name: 'Shield Belt', tier: 3, mods: { suitShield: 60 }, desc: 'A personal bubble.' },
  { id: 'm-wits', slot: 'module', name: 'Neural Lace', tier: 4, mods: { wits: 2, skillCd: 0.15 }, desc: 'You think faster. Mostly.' },
  { id: 'm-charm', slot: 'module', name: 'Diplomat\'s Pin', tier: 4, mods: { charm: 2, trade: 0.05 }, desc: 'A Concord pin. Opens doors.' },
  { id: 'm-heart', slot: 'module', name: 'Choir Heart', tier: 5, mods: { hp: 50, o2: 40, skillCd: 0.2 }, desc: 'It beats out of time with yours.' },
  { id: 'm-beacon', slot: 'module', name: 'Ark Beacon', tier: 6, mods: { awayDmg: 0.3, speed: 0.12, gather: 0.3, o2: 40 }, desc: 'The ark knows you are one of its own.' },
];
export const GEAR_DEF = new Map(GEAR.map((g) => [g.id, g]));

export const RARITIES = [
  { name: 'Common', color: '#c8ccd8', mult: 1, affixes: 0 },
  { name: 'Fine', color: '#6ad06a', mult: 1.2, affixes: 1 },
  { name: 'Rare', color: '#5aa8f8', mult: 1.45, affixes: 2 },
  { name: 'Ark-made', color: '#f0b040', mult: 1.75, affixes: 3 },
] as const;

/** Values are per tier; a tier-3 affix rolls 3× the range. */
export const AFFIXES: readonly AffixDef[] = [
  { id: 'keen', name: 'Keen', slots: ['weapon', 'module'], key: 'awayDmg', min: 0.04, max: 0.08 },
  { id: 'swift', name: 'Swift', slots: ['weapon'], key: 'fireRate', min: 0.03, max: 0.06 },
  { id: 'reaching', name: 'Reaching', slots: ['weapon'], key: 'range', min: 0.2, max: 0.4 },
  { id: 'deep', name: 'Deep-breathing', slots: ['suit', 'module'], key: 'o2', min: 5, max: 10 },
  { id: 'sealed', name: 'Sealed', slots: ['suit'], key: 'suitShield', min: 6, max: 12 },
  { id: 'sturdy', name: 'Sturdy', slots: ['suit', 'module'], key: 'hp', min: 5, max: 10 },
  { id: 'nimble', name: 'Nimble', slots: ['tool', 'suit'], key: 'speed', min: 0.02, max: 0.04 },
  { id: 'greedy', name: 'Greedy', slots: ['tool'], key: 'gather', min: 0.05, max: 0.1 },
  { id: 'roomy', name: 'Roomy', slots: ['tool'], key: 'carry', min: 2, max: 4 },
  { id: 'clever', name: 'Clever', slots: ['module', 'tool'], key: 'wits', min: 0.3, max: 0.5 },
  { id: 'charming', name: 'Charming', slots: ['module'], key: 'charm', min: 0.3, max: 0.5 },
  { id: 'tough', name: 'Tough', slots: ['suit', 'module'], key: 'grit', min: 0.3, max: 0.5 },
];
export const AFFIX = new Map(AFFIXES.map((a) => [a.id, a]));
