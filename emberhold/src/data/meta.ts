/**
 * The layer over the skills: mastery guilds, quests, pets, the shops, game
 * modes and relics.
 */
import { AREAS, MONSTERS } from './combat';
import { item, registerItem } from './items';
import { ACTIONS_BY_SKILL, SKILL_INFO, SKILL_LIST } from './skills';
import { ANIMALS, BUILDINGS, CONSTELLATIONS, FARM_CROPS, PLOTS } from './special';
import { NONCOMBAT_SKILLS, SKILLS, type GameMode, type Mods, type Pet, type Quest, type ShopEntry, type SkillId } from './types';

// --- Mastery guilds ------------------------------------------------------------

/**
 * Guilds replace per-item mastery (the second game's change): every skill
 * has a guild with set tasks. A task is a counter that has to reach a
 * number; finishing one pays guild reputation, and reputation raises the
 * guild's rank. Combat has one guild for all eight combat skills.
 */
export interface GuildTask {
  id: string;
  label: string;
  /** A key into `state.counters`, or `level:<skill>` for a level. */
  counter: string;
  qty: number;
  rep: number;
}

export type GuildId = (typeof NONCOMBAT_SKILLS)[number] | 'combat';

export interface Guild {
  id: GuildId;
  name: string;
  tasks: GuildTask[];
}

/** Cumulative reputation for each rank, 0 to 10. */
export const GUILD_RANKS = [0, 150, 450, 900, 1600, 2600, 4000, 6000, 8800, 12500, 17500] as const;
export const RANK_TITLES = ['Initiate', 'Novice', 'Apprentice', 'Journeyman', 'Adept', 'Expert', 'Veteran', 'Master', 'Grandmaster', 'Legend', 'Guildmaster'] as const;

const ROUND = (n: number): number => (n >= 1000 ? Math.round(n / 100) * 100 : n >= 100 ? Math.round(n / 10) * 10 : Math.round(n));

function spread<T>(list: T[], n: number): T[] {
  if (list.length <= n) return list;
  return Array.from({ length: n }, (_, i) => list[Math.round((i * (list.length - 1)) / (n - 1))]!);
}

function levelTasks(skill: SkillId, label: string): GuildTask[] {
  return [15, 30, 50, 70, 85, 99].map((lvl, i) => ({ id: `${skill}-lvl-${lvl}`, label: `Reach level ${lvl} ${label}`, counter: `level:${skill}`, qty: lvl, rep: 100 + i * 120 }));
}

function skillGuild(skill: (typeof NONCOMBAT_SKILLS)[number]): Guild {
  const info = SKILL_INFO[skill];
  const tasks: GuildTask[] = levelTasks(skill, info.name);
  const actions = ACTIONS_BY_SKILL[skill] ?? [];
  if (actions.length) {
    const chosen = spread([...actions].sort((a, b) => a.level - b.level), 8);
    chosen.forEach((a, i) => {
      const qty = ROUND(Math.max(25, (60_000 * (8 + i * 6)) / a.interval / 2));
      tasks.push({ id: `${skill}-do-${a.id}`, label: `${verb(skill)} ${a.name} ×${qty}`, counter: `action:${a.id}`, qty, rep: 80 + i * 70 });
    });
  }
  const extra = specialTasks(skill);
  tasks.push(...extra);
  tasks.push({ id: `${skill}-actions`, label: `Complete ${ROUND(5000)} ${info.name} actions`, counter: `skill:${skill}`, qty: 5000, rep: 900 });
  return { id: skill, name: `${info.name} Guild`, tasks };
}

function verb(skill: SkillId): string {
  const v: Partial<Record<SkillId, string>> = {
    woodcutting: 'Chop', fishing: 'Catch', mining: 'Mine', firemaking: 'Burn', cooking: 'Cook', smithing: 'Make', fletching: 'Fletch', crafting: 'Craft',
    runecrafting: 'Craft', herblore: 'Brew', thieving: 'Pickpocket', summoning: 'Bind', archaeology: 'Excavate', construction: 'Make', enchantment: 'Enchant',
    hunting: 'Hunt', beastcrafting: 'Craft',
  };
  return v[skill] ?? 'Do';
}

function specialTasks(skill: SkillId): GuildTask[] {
  switch (skill) {
    case 'farming':
      return spread(FARM_CROPS, 7).map((c, i) => ({ id: `farming-${c.seed}`, label: `Harvest ${c.name} ×${3 + i * 2}`, counter: `harvest:${c.seed}`, qty: 3 + i * 2, rep: 90 + i * 80 }));
    case 'agility':
      return [10, 50, 150, 400, 1000].map((n, i) => ({ id: `agility-laps-${n}`, label: `Run ${n} laps of your course`, counter: 'laps', qty: n, rep: 100 + i * 150 }))
        .concat([5, 10].map((n, i) => ({ id: `agility-built-${n}`, label: `Have ${n} obstacles built`, counter: 'obstaclesBuilt', qty: n, rep: 200 + i * 400 })));
    case 'astrology':
      return spread(CONSTELLATIONS, 6).map((c, i) => ({ id: `astro-${c.id}`, label: `Study ${c.name} ×${ROUND(80 + i * 60)}`, counter: `action:astro-${c.id}`, qty: ROUND(80 + i * 60), rep: 90 + i * 90 }))
        .concat([{ id: 'astro-stars', label: 'Raise 20 stars', counter: 'starsRaised', qty: 20, rep: 600 }]);
    case 'cartography':
      return [5, 15, 30, 45, 60].map((n, i) => ({ id: `carto-${n}`, label: `Survey ${n} hexes`, counter: 'hexesSurveyed', qty: n, rep: 100 + i * 160 }))
        .concat([{ id: 'carto-pois', label: 'Find 12 landmarks', counter: 'poisFound', qty: 12, rep: 700 }]);
    case 'ranching':
      return spread(ANIMALS, 6).map((a, i) => ({ id: `ranch-${a.id}`, label: `Collect from ${a.name}s ×${ROUND(30 + i * 40)}`, counter: `produce:${a.id}`, qty: ROUND(30 + i * 40), rep: 90 + i * 90 }));
    case 'construction':
      return spread(BUILDINGS, 6).map((b, i) => ({ id: `con-${b.id}`, label: `Build ${b.name} to level ${2 + i}`, counter: `building:${b.id}`, qty: 2 + i, rep: 100 + i * 100 }));
    case 'archaeology':
      return [{ id: 'arch-museum', label: 'Donate 12 artefacts to the museum', counter: 'donated', qty: 12, rep: 600 }];
    case 'firemaking':
      return [{ id: 'fm-bonfire', label: 'Light 25 bonfires', counter: 'bonfires', qty: 25, rep: 400 }];
    case 'thieving':
      return [{ id: 'thieve-gp', label: 'Steal 100K gold', counter: 'stolenGp', qty: 100_000, rep: 600 }];
    default:
      return [];
  }
}

function combatGuild(): Guild {
  const tasks: GuildTask[] = [];
  for (const s of ['attack', 'strength', 'defence', 'hitpoints', 'ranged', 'magic', 'prayer', 'slayer'] as const) {
    for (const lvl of [40, 70, 99]) tasks.push({ id: `combat-${s}-${lvl}`, label: `Reach level ${lvl} ${SKILL_INFO[s].name}`, counter: `level:${s}`, qty: lvl, rep: lvl * 3 });
  }
  const areas = AREAS.filter((a) => a.kind === 'combat');
  areas.forEach((a, i) => {
    const m = a.monsters[a.monsters.length - 1]!;
    const name = MONSTERS.find((x) => x.id === m)!.name;
    tasks.push({ id: `combat-kill-${m}`, label: `Defeat ${name} ×${50 + i * 25}`, counter: `kill:${m}`, qty: 50 + i * 25, rep: 100 + i * 60 });
  });
  AREAS.filter((a) => a.kind === 'dungeon' || a.kind === 'stronghold').forEach((a, i) => {
    tasks.push({ id: `combat-clear-${a.id}`, label: `Clear ${a.name} ×${5 + i * 2}`, counter: `clear:${a.id}`, qty: 5 + i * 2, rep: 250 + i * 120 });
  });
  tasks.push({ id: 'combat-slayer', label: 'Finish 50 slayer tasks', counter: 'slayerTasks', qty: 50, rep: 800 });
  tasks.push({ id: 'combat-kills', label: 'Defeat 5,000 monsters', counter: 'kills', qty: 5000, rep: 1000 });
  return { id: 'combat', name: 'Warriors\' Guild', tasks };
}

export const GUILDS: Guild[] = [...NONCOMBAT_SKILLS.map(skillGuild), combatGuild()];
export const GUILD = new Map(GUILDS.map((g) => [g.id, g]));

export function guildFor(skill: SkillId): GuildId {
  return (NONCOMBAT_SKILLS as readonly string[]).includes(skill) ? (skill as GuildId) : 'combat';
}

/** Total bonuses of a guild at a rank. */
export function guildRankMods(guild: GuildId, rank: number): Mods {
  const m: Mods = {};
  const addm = (k: string, v: number): void => {
    m[k] = (m[k] ?? 0) + v;
  };
  if (guild === 'combat') {
    const ladder: [string, number][] = [
      ['combatXP', 3], ['meleeAccuracy', 4], ['rangedAccuracy', 4], ['magicAccuracy', 4], ['damageReduction', 2],
      ['meleeMaxHit', 3], ['rangedMaxHit', 3], ['magicMaxHit', 3], ['lootDouble', 3], ['slayerCoins', 10],
    ];
    for (let r = 0; r < rank; r++) {
      const [k, v] = ladder[r]!;
      addm(k, v);
      if (r >= 4 && r <= 7) {
        // Each rank after the fourth lifts all three styles together.
        addm(k === 'meleeMaxHit' ? 'rangedAccuracy' : 'meleeAccuracy', 1);
      }
    }
    return m;
  }
  const ladder = ['skillXP', 'interval', 'doubleChance', 'preserve'] as const;
  for (let r = 0; r < rank; r++) addm(`${ladder[r % 4]}:${guild}`, r >= 8 ? 4 : 3);
  if (rank >= 10) addm(`skillXP:${guild}`, 5);
  return m;
}

// --- Pets ----------------------------------------------------------------------

const SKILL_PETS: Partial<Record<SkillId, [string, string]>> = {
  woodcutting: ['Acorn', 'brown'], fishing: ['Puddles', 'blue'], mining: ['Pebble', 'grey'], firemaking: ['Cinder', 'ember'], cooking: ['Crumb', 'egg'],
  smithing: ['Anvilette', 'grey'], fletching: ['Quill', 'white'], crafting: ['Thimble', 'pink'], runecrafting: ['Glyph', 'orange'], herblore: ['Sprout', 'green'],
  thieving: ['Pickpocket', 'black'], farming: ['Turnip', 'slime'], agility: ['Hopper', 'cyan'], summoning: ['Wisp', 'spirit'], astrology: ['Twinkle', 'gold'],
  cartography: ['Compass', 'amber'], archaeology: ['Dusty', 'clay'], construction: ['Brick', 'red'], enchantment: ['Sparkle', 'royal'], ranching: ['Lamb', 'wool'],
  hunting: ['Tracker', 'fox'], beastcrafting: ['Patch', 'bigbone'], prayer: ['Halo', 'white'], slayer: ['Fang', 'void'],
};

export const PETS: Pet[] = [
  ...Object.entries(SKILL_PETS).map(([skill, [name, pal]]): Pet => ({
    id: `pet-${skill}`, name, icon: `pet.${pal}`, source: { skill: skill as SkillId }, odds: 25_000,
    mods: { [`skillXP:${skill}`]: 2, ...(skill === 'slayer' ? { slayerCoins: 5 } : {}) }, desc: `Found while training ${SKILL_INFO[skill as SkillId].name}.`,
  })),
  { id: 'pet-goblin', name: 'Gobbo', icon: 'pet.green', source: { area: 'warren' }, odds: 150, mods: { gpGain: 2 }, desc: 'Followed you home from the Goblin Warren.' },
  { id: 'pet-spiderling', name: 'Itsy', icon: 'pet.black', source: { area: 'nest' }, odds: 150, mods: { rangedAccuracy: 3 }, desc: 'Hatched in the Spider Nest.' },
  { id: 'pet-skull', name: 'Rattles', icon: 'pet.bone', source: { area: 'barrows' }, odds: 150, mods: { 'buryBonus': 10 }, desc: 'A skull from the Barrow Tombs that likes you.' },
  { id: 'pet-snowfox', name: 'Flurry', icon: 'pet.frost', source: { area: 'keep' }, odds: 150, mods: { 'resist:water': 0.03 }, desc: 'Followed you out of Frost Keep.' },
  { id: 'pet-ember', name: 'Smoulder', icon: 'pet.ember', source: { area: 'pit' }, odds: 150, mods: { 'resist:fire': 0.03 }, desc: 'Crawled out of the Infernal Pit after you.' },
  { id: 'pet-whelp', name: 'Scorch', icon: 'pet.dragon', source: { area: 'lair' }, odds: 150, mods: { meleeMaxHit: 2, rangedMaxHit: 2, magicMaxHit: 2 }, desc: 'Hatched from an egg in the Dragon\'s Lair.' },
  { id: 'pet-banner', name: 'Sir Flaps', icon: 'pet.royal', source: { area: 'bastion' }, odds: 150, mods: { damageReduction: 1 }, desc: 'A banner from the Bastion that walks on its own.' },
  { id: 'pet-voidling', name: 'Nothing', icon: 'pet.void', source: { area: 'heart' }, odds: 150, mods: { 'resist:void': 0.03 }, desc: 'Is it there? It is always there.' },
];
export const PET = new Map(PETS.map((p) => [p.id, p]));

// --- Quests --------------------------------------------------------------------

export const QUESTS: Quest[] = [
  { id: 'fresh-start', name: 'A Fresh Start', giver: 'Elder Marta', story: 'Every newcomer earns their keep. Chop some wood, catch some shrimp and cook a meal.',
    steps: [{ kind: 'action', target: 'wc-normal', qty: 20 }, { kind: 'action', target: 'fish-shrimp', qty: 10 }, { kind: 'action', target: 'cook-shrimp', qty: 10 }],
    rewards: { gp: 500, items: [{ item: 'bronze-sword', qty: 1 }, { item: 'food-shrimp', qty: 30 }] } },
  { id: 'goblin-trouble', name: 'Goblin Trouble', giver: 'Farmer Hobb', story: 'Goblins keep raiding the fields. Thin them out.',
    steps: [{ kind: 'kill', target: 'goblin', qty: 15 }], rewards: { gp: 1500, xp: { attack: 600, strength: 600 }, items: [{ item: 'bronze-helmet', qty: 1 }] } },
  { id: 'smiths-apprentice', name: "The Smith's Apprentice", giver: 'Smith Doran', story: 'Show me you can smelt. Bring me bronze, and learn the anvil.',
    steps: [{ kind: 'item', target: 'bar-bronze', qty: 15 }, { kind: 'level', target: 'smithing', qty: 15 }], rewards: { gp: 2000, mods: { 'interval:mining': 3 }, items: [{ item: 'iron-dagger', qty: 1 }] } },
  { id: 'seeds-of-hope', name: 'Seeds of Hope', giver: 'Elder Marta', story: 'The village needs food. Plant and harvest five crops.',
    steps: [{ kind: 'action', target: 'harvest:any', qty: 5 }], rewards: { items: [{ item: 'super-compost', qty: 10 }, { item: 'seed-cabbage', qty: 15 }], xp: { farming: 800 } } },
  { id: 'ranch-hand', name: 'Ranch Hand', giver: 'Old Tess', story: 'My hands are too stiff for the pens now. Look after the animals for me.',
    steps: [{ kind: 'action', target: 'produce:any', qty: 25 }, { kind: 'level', target: 'ranching', qty: 10 }], rewards: { mods: { ranchProduction: 5 }, gp: 3000 } },
  { id: 'lost-map', name: 'The Lost Map', giver: 'Cartographer Venn', story: 'Half my map was lost in a fire. Survey the country around us.',
    steps: [{ kind: 'action', target: 'hexesSurveyed', qty: 6 }], rewards: { gp: 4000, mods: { 'interval:cartography': 5 } } },
  { id: 'warren', name: 'Into the Warren', giver: 'Farmer Hobb', story: 'The goblins come from a warren to the east. End it.',
    steps: [{ kind: 'clear', target: 'warren', qty: 1 }], rewards: { gp: 6000, items: [{ item: 'holy-symbol', qty: 1 }] } },
  { id: 'pest-control', name: 'Pest Control', giver: 'Ranger Alys', story: 'The spiders in Whisperwood are getting bigger. Much bigger.',
    steps: [{ kind: 'kill', target: 'spider', qty: 40 }, { kind: 'level', target: 'slayer', qty: 15 }], rewards: { gp: 8000, xp: { slayer: 3000 }, mods: { slayerCoins: 5 } } },
  { id: 'settlers', name: 'Settlers', giver: 'Reeve Callan', story: 'People are arriving from the burned towns. Build them somewhere to live.',
    steps: [{ kind: 'action', target: 'building:cottage', qty: 3 }, { kind: 'level', target: 'construction', qty: 20 }], rewards: { gp: 10000, mods: { constructionProduction: 10 } } },
  { id: 'star-crossed', name: 'Star-Crossed', giver: 'Astronomer Ilse', story: 'Gather stardust for my lenses and I will teach you the brightest stars.',
    steps: [{ kind: 'item', target: 'stardust', qty: 300 }, { kind: 'level', target: 'astrology', qty: 30 }], rewards: { items: [{ item: 'golden-stardust', qty: 8 }], xp: { astrology: 5000 } } },
  { id: 'hunters-oath', name: "The Hunter's Oath", giver: 'Ranger Alys', story: 'Prove yourself in the old way: wolf pelts, freely taken.',
    steps: [{ kind: 'item', target: 'wolf-pelt', qty: 10 }, { kind: 'level', target: 'hunting', qty: 40 }], rewards: { mods: { 'doubleChance:hunting': 5 }, gp: 15000 } },
  { id: 'barrow-king', name: 'The Barrow King', giver: 'Sister Wen', story: 'Something old is waking in the tombs. Lay it back down.',
    steps: [{ kind: 'clear', target: 'barrows', qty: 1 }], rewards: { gp: 25000, items: [{ item: 'miasma-mask', qty: 1 }], mods: { prayerCost: -5 } } },
  { id: 'frozen-throne', name: 'The Frozen Throne', giver: 'Jarl Ketil', story: 'Our halls have been winter for nine years. Break the Queen.',
    steps: [{ kind: 'clear', target: 'keep', qty: 1 }], rewards: { gp: 50000, items: [{ item: 'ward-shield', qty: 1 }] } },
  { id: 'dragonslayer', name: 'Dragonslayer', giver: 'Jarl Ketil', story: 'The drakes are leaving the roost and burning farms. Thin the flock.',
    steps: [{ kind: 'kill', target: 'greendrake', qty: 30 }, { kind: 'kill', target: 'bluedrake', qty: 20 }], rewards: { gp: 80000, mods: { 'damageVs:dragon': 10 }, items: [{ item: 'dawn-ring', qty: 1 }] } },
  { id: 'into-the-rift', name: 'Into the Rift', giver: 'The Stranger', story: 'Beyond the Bastion the world is torn. Bring me what it leaks, and I will open the way.',
    steps: [{ kind: 'clear', target: 'bastion', qty: 1 }, { kind: 'item', target: 'void-shard', qty: 5 }, { kind: 'level', target: 'magic', qty: 70 }],
    rewards: { gp: 150000, unlocks: 'The Rift, Voidstone, Elder trees, Rift eels, Void runes and the Rift Cultist.' } },
  { id: 'beyond-the-veil', name: 'Beyond the Veil', giver: 'The Stranger', story: 'At the heart of the Rift something rules. Unmake it.',
    steps: [{ kind: 'clear', target: 'heart', qty: 1 }], req: [{ kind: 'quest', quest: 'into-the-rift' }], rewards: { gp: 500000, mods: { skillXP: 5, combatXP: 5 } } },
];
export const QUEST = new Map(QUESTS.map((q) => [q.id, q]));

// --- Shop ----------------------------------------------------------------------

registerItem({ id: 'slayer-helm', name: 'Slayer Helm', category: 'armour', sell: 0, icon: 'helmet.black', desc: 'Hits harder on slayer tasks.',
  equip: { slot: 'helmet', defMelee: 30, defRanged: 30, defMagic: 30, dr: 3, req: { defence: 40, slayer: 40 }, mods: { slayerDamage: 12 } } });
registerItem({ id: 'gauntlet-cape', name: 'Gauntlet Cape', category: 'cape', sell: 0, icon: 'cape.green', desc: 'Worn by those who have run the Gauntlet.',
  equip: { slot: 'cape', defMelee: 20, defRanged: 20, defMagic: 20, accuracy: 8, power: 6, mods: { combatXP: 4 } } });

const UP = (id: string, name: string, icon: string, desc: string, gp: number, max: number, growth: number, tab: ShopEntry['tab'] = 'general', req?: ShopEntry['req']): ShopEntry => ({
  id, name, icon, desc, cost: { gp }, gives: { upgrade: id, max }, tab, growth, ...(req ? { req } : {}),
});
const BUY = (item: string, name: string, icon: string, gp: number, qty = 1, tab: ShopEntry['tab'] = 'skilling', desc = ''): ShopEntry => ({
  id: `buy-${item}-${qty}`, name, icon, desc, cost: { gp }, gives: { item, qty }, tab,
});

export const SHOP: ShopEntry[] = [
  UP('bank', 'Bank Space', 'ui.bank', '+8 bank slots.', 2000, 60, 1.18),
  UP('autoeat', 'Auto Eat', 'ui.food', 'Eat automatically when low. Each tier eats sooner and wastes less.', 5000, 3, 10),
  UP('autoloot', 'Loot Satchel', 'ui.loot', 'Combat loot goes straight to the bank.', 50000, 1, 1),
  UP('loadout', 'Extra Loadout', 'ui.gear', 'One more equipment set to swap to.', 20000, 2, 5),
  UP('axe', 'Axe Upgrade', 'ui.axe', 'Woodcutting is 5% faster per upgrade.', 1000, 7, 3.2, 'skilling'),
  UP('pickaxe', 'Pickaxe Upgrade', 'ui.pick', 'Mining is 5% faster per upgrade.', 1000, 7, 3.2, 'skilling'),
  UP('rod', 'Fishing Rod Upgrade', 'ui.rod', 'Fishing is 5% faster per upgrade.', 1000, 7, 3.2, 'skilling'),
  UP('trowel', 'Archaeology Tools', 'ui.trowel', 'Digs are 4% faster and finds are better per upgrade.', 5000, 5, 3.5, 'skilling'),
  UP('plot-allotment', 'Allotment Plot', 'ui.plot', 'One more allotment plot.', PLOTS.allotment.baseCost, PLOTS.allotment.max - PLOTS.allotment.start, 3, 'skilling'),
  UP('plot-herb', 'Herb Plot', 'ui.plot', 'One more herb plot.', PLOTS.herb.baseCost, PLOTS.herb.max - PLOTS.herb.start, 3, 'skilling'),
  UP('plot-tree', 'Tree Plot', 'ui.plot', 'One more tree plot.', PLOTS.tree.baseCost, PLOTS.tree.max - PLOTS.tree.start, 4, 'skilling'),
  UP('pen', 'Ranch Pen', 'ui.pen', 'One more pen for your ranch.', 3000, 6, 3, 'skilling'),
  UP('pen-size', 'Bigger Pens', 'ui.pen', 'Every pen holds 3 more animals.', 10000, 5, 3, 'skilling'),
  BUY('food-shrimp', 'Shrimp ×10', 'cookedfish.fish-shrimp', 60, 10, 'general'),
  BUY('worm', 'Worms ×20', 'worm.worm', 40, 20),
  BUY('feather', 'Feathers ×50', 'feather.white', 120, 50),
  BUY('bowstring', 'Bowstrings ×10', 'string.white', 80, 10),
  BUY('wool', 'Wool ×10', 'wool.wool', 80, 10),
  BUY('spirit-shard', 'Spirit Shards ×50', 'shard.spirit', 400, 50),
  BUY('compost', 'Compost ×5', 'sack.compost', 100, 5),
  BUY('seed-potato', 'Potato Seeds ×10', 'seed.crop-potato', 30, 10),
  BUY('seed-wheat', 'Wheat Seeds ×10', 'seed.crop-wheat', 50, 10),
  BUY('seed-cabbage', 'Cabbage Seeds ×10', 'seed.crop-cabbage', 150, 10),
  BUY('seed-brightleaf', 'Brightleaf Seeds ×5', 'seed.herb-brightleaf', 100, 5),
  BUY('sapling-oak', 'Oak Sapling', 'sapling.wood-oak', 400),
  BUY('ore-essence', 'Rune Essence ×50', 'essence.ore-essence', 250, 50),
  BUY('staff', 'Staff', 'staff.wood-normal', 50, 1, 'gear'),
  BUY('bronze-sword', 'Bronze Sword', 'sword.metal-bronze', 40, 1, 'gear'),
  BUY('bronze-helmet', 'Bronze Helmet', 'helmet.metal-bronze', 40, 1, 'gear'),
  BUY('normal-shortbow', 'Shortbow', 'shortbow.wood-normal', 60, 1, 'gear'),
  BUY('bronze-arrows', 'Bronze Arrows ×100', 'arrow.metal-bronze', 150, 100, 'gear'),
  BUY('apprentice-hat', 'Apprentice Hat', 'robehat.robe-apprentice', 80, 1, 'gear'),
  BUY('rune-air', 'Air Runes ×100', 'rune.rune-air', 200, 100, 'gear'),
  BUY('rune-mind', 'Mind Runes ×100', 'rune.rune-mind', 300, 100, 'gear'),
  ...[['holy-symbol', 'Holy Symbol', 200], ['miasma-mask', 'Miasma Mask', 800], ['ward-shield', 'Dragonfire Ward', 3000], ['dawn-ring', 'Ring of Dawn', 8000], ['slayer-helm', 'Slayer Helm', 5000]].map(([item, name, coins]): ShopEntry => ({
    id: `slay-${item}`, name: name as string, icon: '', desc: '', cost: { slayerCoins: coins as number }, gives: { item: item as string, qty: 1 }, tab: 'slayer',
  })),
  { id: 'slay-reroll', name: 'Skip Task', icon: 'ui.skull', desc: 'Drop your current slayer task.', cost: { slayerCoins: 30 }, gives: { upgrade: 'reroll' }, tab: 'slayer' },
  { id: 'raid-ring', name: "Raider's Ring", icon: 'ering.green', desc: '', cost: { raidCoins: 400 }, gives: { item: 'raider-ring', qty: 1 }, tab: 'raid' },
  { id: 'raid-cape', name: 'Gauntlet Cape', icon: 'cape.green', desc: '', cost: { raidCoins: 1500 }, gives: { item: 'gauntlet-cape', qty: 1 }, tab: 'raid' },
  { id: 'raid-dust', name: 'Golden Stardust ×3', icon: 'dust.amber', desc: '', cost: { raidCoins: 120 }, gives: { item: 'golden-stardust', qty: 3 }, tab: 'raid' },
  { id: 'raid-shards', name: 'Spirit Shards ×200', icon: 'shard.spirit', desc: '', cost: { raidCoins: 60 }, gives: { item: 'spirit-shard', qty: 200 }, tab: 'raid' },
  { id: 'raid-chest', name: "Warden's Chest", icon: 'chest.metal-iron', desc: '', cost: { raidCoins: 200 }, gives: { item: 'dungeon-chest', qty: 1 }, tab: 'raid' },
  ...SKILL_LIST.map((s): ShopEntry => ({
    id: `cape-${s.id}`, name: `${s.name} Cape`, icon: `skillcape.${s.pal}`, desc: 'Requires level 99.', cost: { gp: 1_000_000 }, gives: { item: `skillcape-${s.id}`, qty: 1 }, tab: 'capes',
    req: [{ kind: 'level', skill: s.id, level: 99 }],
  })),
  { id: 'cape-max', name: 'Cape of Everything', icon: 'skillcape.royal', desc: 'Requires every skill at 99.', cost: { gp: 10_000_000 }, gives: { item: 'max-cape', qty: 1 }, tab: 'capes',
    req: SKILLS.map((s) => ({ kind: 'level' as const, skill: s, level: 99 })) },
];
for (const e of SHOP) if (!e.icon && 'item' in e.gives) e.icon = item(e.gives.item).icon;
export const SHOP_ENTRY = new Map(SHOP.map((e) => [e.id, e]));

/** Animals are bought straight into a pen from the ranch screen; prices live in `special.ts`. */

// --- Game modes ----------------------------------------------------------------

export const MODES: Record<GameMode, { name: string; desc: string }> = {
  standard: { name: 'Standard', desc: 'The usual game. Dying costs you one piece of equipment.' },
  hardcore: { name: 'Hardcore', desc: 'One life. If you die in combat, the save is gone.' },
  adventure: { name: 'Adventure', desc: 'Start with only combat and one skill of your choice. Every other skill must be bought, and each costs more than the last.' },
  relics: { name: 'Ancient Relics', desc: 'Every skill starts capped at level 10. Training a skill uncovers its five relics; each raises the cap and grants a strong bonus.' },
};

/** Adventure mode: price of the nth skill unlocked. */
export function adventureSkillCost(owned: number): number {
  return Math.round(1000 * 2.4 ** Math.min(owned, 22));
}

/** Ancient Relics mode: the five relics of a skill. */
export function relicMods(skill: SkillId, n: number): Mods {
  const ladder: Mods[] = [
    { [`skillXP:${skill}`]: 10 },
    { [`interval:${skill}`]: 8 },
    { [`doubleChance:${skill}`]: 10 },
    { [`preserve:${skill}`]: 10 },
    { [`skillXP:${skill}`]: 10, [`doubleChance:${skill}`]: 5, [`interval:${skill}`]: 4 },
  ];
  if (SKILL_INFO[skill].kind === 'combat') {
    return [{ combatXP: 3 }, { meleeAccuracy: 4, rangedAccuracy: 4, magicAccuracy: 4 }, { damageReduction: 2 }, { meleeMaxHit: 3, rangedMaxHit: 3, magicMaxHit: 3 }, { lootDouble: 4 }][n]!;
  }
  return ladder[n]!;
}

export function relicCap(found: number): number {
  return [10, 30, 50, 70, 90, 99][Math.min(5, found)]!;
}
