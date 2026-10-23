/**
 * Monsters, the places they live, and the spells and prayers used to fight
 * them. Monster stats come from a combat level and an archetype, so a new
 * monster is one line.
 */
import type { Area, Aurora, CombatStyle, DamageType, LootEntry, Monster, Prayer, Spell } from './types';

interface MonsterOpts {
  hp?: number;
  hit?: number;
  acc?: number;
  eva?: Partial<Record<CombatStyle, number>>;
  speed?: number;
  resist?: Partial<Record<DamageType, number>>;
  dr?: number;
  loot?: [string, number, number, number][];
  lootChance?: number;
  bones?: string;
  slayer?: number;
  special?: Monster['special'];
  boss?: boolean;
  icon: string;
}

export const MONSTERS: Monster[] = [];

function mon(id: string, name: string, level: number, style: CombatStyle, damageType: DamageType, o: MonsterOpts): Monster {
  const eva = o.eva ?? {};
  const base = (m: number): number => Math.round((level + 9) * (64 + level * 1.15 * m));
  const loot: LootEntry[] = (o.loot ?? []).map(([item, min, max, weight]) => ({ item, min, max, weight }));
  const m: Monster = {
    id, name, icon: o.icon, combatLevel: level,
    hp: Math.round((level * 8 + 20) * (o.hp ?? 1) * (o.boss ? 3 : 1)),
    style, damageType,
    speed: o.speed ?? 2800,
    maxHit: Math.round((level * 1.7 + 8) * (o.hit ?? 1) * (o.boss ? 1.25 : 1)),
    accuracy: base(o.acc ?? 1),
    evasion: { melee: base(eva.melee ?? 1), ranged: base(eva.ranged ?? 1), magic: base(eva.magic ?? 1) },
    resist: o.resist ?? {},
    dr: o.dr ?? Math.min(35, Math.floor(level / 5)),
    loot: { chance: o.lootChance ?? 0.5, entries: loot },
    gp: [Math.round(level * 1.5), Math.round(level * 4 + 5)],
  };
  if (o.bones !== undefined) {
    if (o.bones) m.bones = o.bones;
  } else m.bones = level >= 40 ? 'big-bones' : 'bones';
  if (o.slayer) m.slayerLevel = o.slayer;
  if (o.special) m.special = o.special;
  if (o.boss) m.boss = true;
  MONSTERS.push(m);
  return m;
}

// Weakness/resistance shorthands. Negative = takes extra.
const ARMOURED = { slash: 0.3, pierce: 0.3, stab: 0.1, crush: -0.2 };
const SOFT = { slash: -0.2, stab: -0.1, crush: 0.2 };
const SKELETAL = { slash: 0.4, pierce: 0.5, stab: 0.3, crush: -0.3 };
const SPECTRAL = { slash: 0.5, stab: 0.5, crush: 0.5, pierce: 0.6, fire: -0.2, air: -0.1 };
const FIERY = { fire: 0.8, water: -0.4, earth: 0.1, air: -0.1 };
const FROZEN = { water: 0.8, fire: -0.4, crush: -0.2 };
const SCALED = { slash: 0.25, stab: -0.1, pierce: 0.2, fire: 0.3 };
const STONE = { slash: 0.4, stab: 0.3, pierce: 0.5, crush: -0.3, earth: 0.5, water: -0.2 };
const AIRY = { air: 0.6, earth: -0.3, pierce: 0.2 };
const RIFT = { stab: 0.4, slash: 0.4, crush: 0.4, pierce: 0.4, fire: 0.4, water: 0.4, earth: 0.4, air: 0.4, void: -0.25 };

// --- Combat areas --------------------------------------------------------------

mon('chicken', 'Chicken', 2, 'melee', 'stab', { icon: 'bird.white', hp: 0.6, hit: 0.5, loot: [['feather', 2, 6, 10], ['egg', 1, 1, 3], ['raw-meat', 1, 1, 4]], lootChance: 0.8 });
mon('cow', 'Cow', 4, 'melee', 'crush', { icon: 'quad.white', hp: 1.2, hit: 0.6, loot: [['cowhide', 1, 1, 10], ['raw-meat', 1, 1, 6], ['milk', 1, 1, 2]], lootChance: 0.9, resist: SOFT });
mon('rat', 'Giant Rat', 6, 'melee', 'stab', { icon: 'quad.grey', speed: 2200, loot: [['raw-meat', 1, 1, 4], ['seed-potato', 1, 2, 3]] });
mon('goblin', 'Goblin', 9, 'melee', 'slash', { icon: 'humanoid.green', loot: [['bronze-sword', 1, 1, 2], ['bronze-helmet', 1, 1, 2], ['rune-mind', 2, 6, 6], ['seed-wheat', 1, 3, 5], ['goblin-totem', 1, 1, 1]] });
mon('wolf', 'Grey Wolf', 14, 'melee', 'slash', { icon: 'quad.grey', speed: 2400, resist: SOFT, loot: [['beast-fang', 1, 1, 8], ['wolf-pelt', 1, 1, 2], ['raw-meat', 1, 1, 6]] });
mon('bandit', 'Bandit', 18, 'melee', 'slash', { icon: 'humanoid.brown', loot: [['iron-dagger', 1, 1, 3], ['iron-sword', 1, 1, 2], ['gem-topaz', 1, 1, 3], ['rune-chaos', 1, 4, 4], ['seed-sagewort', 1, 1, 3]] });
mon('spider', 'Giant Spider', 22, 'melee', 'stab', { icon: 'spider.black', speed: 2200, resist: { crush: -0.2, slash: 0.1 }, loot: [['spider-silk', 1, 2, 8], ['seed-emberroot', 1, 1, 2]] });
mon('bear', 'Brown Bear', 26, 'melee', 'crush', { icon: 'quad.brown', hp: 1.3, speed: 3200, hit: 1.2, resist: { crush: 0.2, slash: -0.1 }, loot: [['bear-pelt', 1, 1, 5], ['raw-bear', 1, 1, 6], ['beast-fang', 1, 2, 4]] });
mon('bat', 'Cave Bat', 20, 'melee', 'stab', { icon: 'bat.black', speed: 2000, hp: 0.7, eva: { melee: 1.3, ranged: 0.8 }, loot: [['bat-wing', 1, 2, 10]] });
mon('skeleton', 'Skeleton', 28, 'melee', 'slash', { icon: 'skeleton.bone', resist: SKELETAL, loot: [['bones', 1, 3, 8], ['iron-platelegs', 1, 1, 2], ['steel-sword', 1, 1, 1], ['rune-death', 1, 3, 3]], bones: 'bones' });
mon('crawler', 'Cave Crawler', 30, 'melee', 'stab', { icon: 'bug.slime', resist: { crush: -0.2, pierce: 0.2 }, loot: [['seed-frostmint', 1, 1, 3], ['ore-coal', 2, 5, 8], ['ore-mithril', 1, 2, 3]] });
mon('troll', 'Cave Troll', 34, 'melee', 'crush', { icon: 'brute.grey', hp: 1.5, hit: 1.2, speed: 3400, acc: 0.85, eva: { magic: 0.7 }, resist: { crush: 0.2, slash: 0.1, fire: -0.2 }, loot: [['big-bones', 1, 1, 6], ['steel-mace', 1, 1, 2], ['ore-coal', 3, 8, 6]], bones: 'big-bones' });
mon('frog', 'Bog Frog', 30, 'melee', 'crush', { icon: 'slime.green', loot: [['seed-cabbage', 1, 3, 5], ['seed-duskbloom', 1, 1, 1], ['raw-meat', 1, 2, 6]] });
mon('mudling', 'Mudling', 36, 'magic', 'water', { icon: 'slime.brown', resist: { stab: 0.3, slash: 0.2, water: 0.5, earth: -0.3 }, loot: [['rune-water', 5, 20, 8], ['compost', 1, 3, 6], ['ore-limestone', 2, 6, 4]] });
mon('witch', 'Swamp Witch', 42, 'magic', 'water', { icon: 'mage.green', eva: { magic: 1.4, melee: 0.8 }, loot: [['rune-nature', 2, 6, 8], ['rune-chaos', 3, 9, 6], ['adept-hat', 1, 1, 1], ['seed-duskbloom', 1, 2, 3], ['bat-wing', 1, 2, 4]] });
mon('lizardman', 'Lizardman Archer', 45, 'ranged', 'pierce', { icon: 'humanoid.slime', eva: { ranged: 1.3 }, resist: SCALED, loot: [['mithril-arrows', 5, 15, 6], ['maple-shortbow', 1, 1, 1], ['feather', 5, 15, 6]] });
mon('ogre', 'Ogre', 48, 'melee', 'crush', { icon: 'brute.brown', hp: 1.5, speed: 3600, hit: 1.25, acc: 0.85, eva: { melee: 0.8, magic: 0.7 }, resist: SOFT, loot: [['big-bones', 1, 2, 6], ['adamant-mace', 1, 1, 1], ['raw-meat', 2, 4, 5]], bones: 'big-bones' });
mon('harpy', 'Harpy', 52, 'ranged', 'pierce', { icon: 'bird.purple', speed: 2400, eva: { melee: 1.2, ranged: 1.1 }, resist: AIRY, loot: [['feather', 10, 30, 8], ['seed-stormvine', 1, 1, 2], ['gem-emerald', 1, 1, 2]] });
mon('giant', 'Hill Giant', 54, 'melee', 'crush', { icon: 'brute.bigbone', hp: 1.7, speed: 3800, hit: 1.3, resist: { crush: 0.2, stab: -0.2 }, loot: [['big-bones', 2, 3, 8], ['adamant-platelegs', 1, 1, 1], ['ore-adamantite', 2, 4, 4]], bones: 'big-bones' });
mon('griffin', 'Griffin', 58, 'melee', 'slash', { icon: 'bird.gold', hp: 1.2, resist: { pierce: -0.2, air: 0.3 }, loot: [['feather', 10, 25, 6], ['gem-ruby', 1, 1, 2], ['wyvern-bones', 1, 1, 2]] });
mon('icewolf', 'Ice Wolf', 56, 'melee', 'slash', { icon: 'quad.frost', speed: 2400, resist: FROZEN, loot: [['frost-shard', 1, 1, 4], ['wolf-pelt', 1, 1, 6], ['beast-fang', 1, 2, 6]] });
mon('yeti', 'Yeti', 64, 'melee', 'crush', { icon: 'brute.white', hp: 1.6, hit: 1.2, speed: 3400, resist: FROZEN, loot: [['frost-shard', 1, 2, 6], ['big-bones', 2, 3, 6], ['seed-sunpetal', 1, 1, 1]], bones: 'big-bones' });
mon('frostmage', 'Frost Mage', 66, 'magic', 'water', { icon: 'mage.frost', eva: { magic: 1.5, melee: 0.7 }, resist: FROZEN, loot: [['rune-blood', 2, 8, 6], ['rune-water', 20, 60, 8], ['frost-shard', 1, 1, 4], ['wizard-hat', 1, 1, 1]] });
mon('icegolem', 'Ice Golem', 70, 'melee', 'crush', { icon: 'golem.frost', hp: 1.8, speed: 4000, hit: 1.3, resist: { ...STONE, water: 0.8, fire: -0.5, earth: 0 }, loot: [['frost-shard', 2, 4, 8], ['ore-cobalt', 2, 5, 5]] });
mon('imp', 'Fire Imp', 66, 'magic', 'fire', { icon: 'imp.ember', speed: 2200, hp: 0.8, eva: { melee: 1.3 }, resist: FIERY, loot: [['fire-essence', 1, 2, 8], ['rune-fire', 20, 60, 8], ['ash', 2, 6, 4]] });
mon('salamander', 'Salamander', 72, 'ranged', 'fire', { icon: 'lizard.ember', resist: FIERY, loot: [['fire-essence', 1, 2, 6], ['ember-scale', 1, 1, 2], ['raw-meat', 2, 4, 4]] });
mon('lavagolem', 'Lava Golem', 74, 'melee', 'fire', { icon: 'golem.ember', hp: 1.9, speed: 4000, hit: 1.3, resist: { ...STONE, fire: 0.8, water: -0.5, earth: 0.2 }, loot: [['fire-essence', 2, 3, 8], ['ore-starstone', 1, 2, 3], ['ore-cobalt', 2, 4, 4]] });
mon('magmawyrm', 'Magma Wyrm', 80, 'magic', 'fire', { icon: 'dragon.ember', hp: 1.4, resist: { ...FIERY, ...SCALED, fire: 0.8 }, loot: [['dragon-bones', 1, 1, 8], ['ember-scale', 1, 2, 4], ['dragon-scale', 1, 1, 2]], bones: 'dragon-bones' });
mon('stormelemental', 'Storm Elemental', 78, 'magic', 'air', { icon: 'elemental.blue', eva: { magic: 1.5, melee: 1.1 }, resist: AIRY, loot: [['rune-air', 50, 150, 8], ['rune-soul', 2, 6, 4], ['seed-stormvine', 1, 2, 3]], bones: '' });
mon('wyvern', 'Wyvern', 84, 'ranged', 'pierce', { icon: 'dragon.wyvern', hp: 1.4, resist: { ...SCALED, air: 0.3 }, loot: [['wyvern-bones', 1, 1, 10], ['dragon-scale', 1, 1, 3], ['magic-longbow', 1, 1, 1]], bones: 'wyvern-bones' });
mon('skyknight', 'Sky Knight', 88, 'melee', 'slash', { icon: 'knight.blue', hp: 1.3, eva: { melee: 1.3, ranged: 1.3, magic: 0.8 }, resist: ARMOURED, loot: [['starmetal-sword', 1, 1, 1], ['starmetal-helmet', 1, 1, 1], ['bar-starmetal', 1, 3, 4], ['gem-diamond', 1, 1, 2]] });
mon('roc', 'Roc', 92, 'melee', 'stab', { icon: 'bird.brown', hp: 1.6, hit: 1.2, resist: { pierce: -0.25, air: 0.4, earth: -0.2 }, loot: [['feather', 30, 80, 8], ['gem-onyx', 1, 1, 1], ['golden-stardust', 1, 1, 2], ['big-bones', 3, 5, 6]] });

// --- Slayer areas --------------------------------------------------------------

mon('ghost', 'Ghost', 25, 'magic', 'air', { icon: 'ghost.ecto', slayer: 1, resist: SPECTRAL, loot: [['ectoplasm', 1, 2, 10], ['rune-death', 1, 3, 4]], bones: '' });
mon('wraith', 'Wraith', 40, 'magic', 'air', { icon: 'ghost.grey', slayer: 15, resist: SPECTRAL, loot: [['ectoplasm', 1, 3, 10], ['rune-death', 2, 6, 6], ['seed-duskbloom', 1, 1, 3]], bones: '' });
mon('banshee', 'Banshee', 50, 'magic', 'air', { icon: 'ghost.purple', slayer: 25, resist: SPECTRAL, special: { name: 'Wail', chance: 0.15, mult: 1.6 }, loot: [['ectoplasm', 2, 4, 10], ['rune-soul', 1, 3, 4], ['gem-ruby', 1, 1, 2]], bones: '' });
mon('plaguerat', 'Plague Rat', 35, 'melee', 'stab', { icon: 'quad.slime', slayer: 30, speed: 2000, loot: [['seed-stormvine', 1, 1, 2], ['raw-meat', 1, 2, 5], ['compost', 1, 3, 4]] });
mon('bloat', 'Bloat', 45, 'melee', 'crush', { icon: 'slime.slime', slayer: 40, hp: 2, speed: 3600, resist: { crush: 0.4, stab: -0.3, slash: -0.2 }, loot: [['super-compost', 1, 2, 6], ['seed-sunpetal', 1, 1, 1], ['seed-tomato', 2, 5, 6]] });
mon('hydra', 'Marsh Hydra', 60, 'ranged', 'water', { icon: 'dragon.slime', slayer: 50, hp: 1.6, special: { name: 'Triple Bite', chance: 0.12, mult: 2 }, resist: { water: 0.5, slash: -0.2, earth: -0.2 }, loot: [['dragon-scale', 1, 1, 3], ['green-drakehide', 1, 1, 3], ['rune-blood', 3, 8, 5]], bones: 'wyvern-bones' });
mon('greendrake', 'Green Drake', 65, 'magic', 'fire', { icon: 'dragon.green', slayer: 55, hp: 1.4, resist: { ...SCALED, fire: 0.6 }, loot: [['green-drakehide', 1, 2, 10], ['dragon-scale', 1, 1, 3]], bones: 'dragon-bones' });
mon('bluedrake', 'Blue Drake', 75, 'magic', 'water', { icon: 'dragon.blue', slayer: 65, hp: 1.5, resist: { ...SCALED, water: 0.6, fire: 0 }, loot: [['green-drakehide', 1, 2, 6], ['black-drakehide', 1, 1, 2], ['dragon-scale', 1, 2, 4]], bones: 'dragon-bones' });
mon('elderdrake', 'Elder Drake', 85, 'magic', 'fire', { icon: 'dragon.black', slayer: 75, hp: 1.7, hit: 1.2, resist: { ...SCALED, fire: 0.7 }, loot: [['black-drakehide', 1, 2, 8], ['dragon-scale', 2, 3, 5], ['gem-diamond', 1, 1, 2]], bones: 'dragon-bones' });
mon('shade', 'Shade', 80, 'magic', 'void', { icon: 'ghost.black', slayer: 75, resist: { ...SPECTRAL, void: 0.3 }, loot: [['ectoplasm', 3, 6, 8], ['void-shard', 1, 1, 2], ['rune-soul', 2, 6, 5]], bones: '' });
mon('nightmare', 'Nightmare', 88, 'melee', 'slash', { icon: 'quad.void', slayer: 82, hp: 1.6, special: { name: 'Terror', chance: 0.1, mult: 1.5, stun: true }, loot: [['void-shard', 1, 2, 4], ['gem-onyx', 1, 1, 1], ['rune-blood', 5, 15, 6]] });
mon('horror', 'Deep Horror', 95, 'melee', 'crush', { icon: 'brute.void', slayer: 90, hp: 2, hit: 1.25, resist: { crush: 0.3, slash: 0.3 }, loot: [['void-shard', 2, 3, 6], ['gem-onyx', 1, 1, 2], ['void-bones', 1, 1, 4]], bones: 'void-bones' });

// --- Dungeon monsters and bosses -------------------------------------------------

mon('goblin-shaman', 'Goblin Shaman', 16, 'magic', 'fire', { icon: 'mage.green', loot: [['rune-fire', 5, 15, 6], ['rune-mind', 5, 15, 6]] });
mon('goblin-brute', 'Goblin Brute', 20, 'melee', 'crush', { icon: 'brute.green', hp: 1.3, loot: [['iron-mace', 1, 1, 2]] });
mon('goblin-warlord', 'Goblin Warlord', 25, 'melee', 'slash', { icon: 'knight.green', boss: true, special: { name: 'Rally', chance: 0.1, mult: 1, heal: 0.1 }, loot: [['goblin-cleaver', 1, 1, 1]], lootChance: 0.08 });
mon('broodmother', 'Broodmother', 45, 'ranged', 'pierce', { icon: 'spider.purple', boss: true, special: { name: 'Web Spit', chance: 0.12, mult: 1.2, stun: true }, resist: { crush: -0.2 }, loot: [['silkstrand-bow', 1, 1, 1]], lootChance: 0.06 });
mon('barrow-king', 'Barrow King', 60, 'melee', 'crush', { icon: 'skeleton.gold', boss: true, resist: SKELETAL, special: { name: 'Life Drain', chance: 0.12, mult: 1.3, heal: 0.15 }, loot: [['barrow-crown', 1, 1, 1]], lootChance: 0.05 });
mon('frost-queen', 'The Frost Queen', 75, 'magic', 'water', { icon: 'mage.white', boss: true, resist: FROZEN, special: { name: 'Blizzard', chance: 0.12, mult: 1.8 }, loot: [['frostfang', 1, 1, 1]], lootChance: 0.05 });
mon('infernal-titan', 'Infernal Titan', 88, 'melee', 'fire', { icon: 'golem.red', boss: true, hp: 1.2, resist: { ...FIERY, ...STONE, fire: 0.8 }, special: { name: 'Eruption', chance: 0.1, mult: 2 }, loot: [['infernal-cape', 1, 1, 1]], lootChance: 0.12 });
mon('ancient-dragon', 'Ancient Dragon', 98, 'magic', 'fire', { icon: 'dragon.gold', boss: true, hp: 1.3, resist: { ...SCALED, fire: 0.8 }, special: { name: 'Dragonfire', chance: 0.15, mult: 2.2 }, loot: [['dragonbane', 1, 1, 1], ['black-drakehide', 3, 6, 10]], lootChance: 0.15, bones: 'dragon-bones' });
mon('bastion-sentinel', 'Bastion Sentinel', 70, 'melee', 'pure', { icon: 'knight.grey', hp: 1.4, resist: ARMOURED, loot: [['bar-cobalt', 1, 3, 6]] });
mon('bastion-warden', 'Bastion Warden', 80, 'ranged', 'pure', { icon: 'knight.white', hp: 1.5, resist: ARMOURED, loot: [['bar-starmetal', 1, 2, 6]] });
mon('bastion-champion', 'Bastion Champion', 90, 'magic', 'pure', { icon: 'knight.royal', hp: 1.6, resist: { ...ARMOURED, fire: -0.2 }, loot: [['gem-onyx', 1, 1, 2]] });
mon('bastion-commander', 'Bastion Commander', 100, 'melee', 'pure', { icon: 'knight.gold', boss: true, resist: ARMOURED, special: { name: 'Command', chance: 0.12, mult: 1.7 }, loot: [['stronghold-sigil', 1, 1, 1]], lootChance: 0.1 });

// --- The Rift ------------------------------------------------------------------

mon('rift-crawler', 'Rift Crawler', 90, 'melee', 'void', { icon: 'bug.void', resist: RIFT, dr: 40, loot: [['void-shard', 1, 2, 8], ['ore-voidstone', 2, 4, 6]], bones: 'void-bones' });
mon('void-hound', 'Void Hound', 95, 'melee', 'void', { icon: 'quad.void', speed: 2200, resist: RIFT, dr: 40, loot: [['void-shard', 1, 2, 8], ['void-hide', 1, 1, 3]], bones: 'void-bones' });
mon('unmade', 'The Unmade', 100, 'magic', 'void', { icon: 'elemental.void', resist: RIFT, dr: 45, loot: [['void-shard', 2, 3, 8], ['rune-void', 10, 30, 6], ['void-staff', 1, 1, 1]], lootChance: 0.6, bones: 'void-bones' });
mon('rift-sovereign', 'Rift Sovereign', 110, 'ranged', 'void', { icon: 'mage.void', boss: true, resist: RIFT, dr: 50, special: { name: 'Unmaking', chance: 0.12, mult: 2 }, loot: [['riftreaver', 1, 1, 1], ['rift-bow', 1, 1, 1]], lootChance: 0.08, bones: 'void-bones' });

export const MONSTER = new Map(MONSTERS.map((m) => [m.id, m]));

export const AREAS: Area[] = [
  { id: 'farms', name: 'Meadowbrook Farms', kind: 'combat', icon: 'area.green', monsters: ['chicken', 'cow', 'rat', 'goblin'], desc: 'Where everyone starts. Mind the goblins.' },
  { id: 'woods', name: 'Whisperwood', kind: 'combat', icon: 'area.brown', monsters: ['wolf', 'bandit', 'spider', 'bear'], desc: 'Old trees, and things that live under them.' },
  { id: 'caves', name: 'Hollow Caves', kind: 'combat', icon: 'area.grey', monsters: ['bat', 'skeleton', 'crawler', 'troll'], desc: 'Skeletons shrug off blades; bring a mace.' },
  { id: 'swamp', name: 'Bogmire Swamp', kind: 'combat', icon: 'area.slime', monsters: ['frog', 'mudling', 'witch', 'lizardman'], desc: 'Wet, and full of things that cast water.' },
  { id: 'highlands', name: 'Stormcrag Highlands', kind: 'combat', icon: 'area.bigbone', monsters: ['ogre', 'harpy', 'giant', 'griffin'], desc: 'Big things that hit hard and slowly.' },
  { id: 'wastes', name: 'Rimefrost Wastes', kind: 'combat', icon: 'area.frost', monsters: ['icewolf', 'yeti', 'frostmage', 'icegolem'], desc: 'Fire melts it all. Water does nothing.' },
  { id: 'peaks', name: 'Cinder Peaks', kind: 'combat', icon: 'area.ember', monsters: ['imp', 'salamander', 'lavagolem', 'magmawyrm'], desc: 'Bring water. Fire just makes them stronger.', hazard: { desc: 'The heat: −10% max HP unless you resist fire.', mods: { maxHP: -10 } } },
  { id: 'skyreach', name: 'Skyreach Ruins', kind: 'combat', icon: 'area.blue', monsters: ['stormelemental', 'wyvern', 'skyknight', 'roc'], desc: 'The ruins of a city in the clouds.' },
  { id: 'crypt', name: 'Haunted Crypt', kind: 'slayer', icon: 'area.ecto', monsters: ['ghost', 'wraith', 'banshee'], needsWorn: 'holy-symbol', req: [{ kind: 'level', skill: 'slayer', level: 1 }], desc: 'Blades pass right through. Magic does not.' },
  { id: 'marsh', name: 'Miasma Marsh', kind: 'slayer', icon: 'area.slime', monsters: ['plaguerat', 'bloat', 'hydra'], needsWorn: 'miasma-mask', req: [{ kind: 'level', skill: 'slayer', level: 30 }], desc: 'The air itself is poison.' },
  { id: 'roost', name: 'Drake Roost', kind: 'slayer', icon: 'area.dragon', monsters: ['greendrake', 'bluedrake', 'elderdrake'], needsWorn: 'ward-shield', req: [{ kind: 'level', skill: 'slayer', level: 55 }], desc: 'Dragonfire everywhere. Bring a ward.' },
  { id: 'depths', name: 'Shadow Depths', kind: 'slayer', icon: 'area.black', monsters: ['shade', 'nightmare', 'horror'], needsWorn: 'dawn-ring', req: [{ kind: 'level', skill: 'slayer', level: 75 }], desc: 'No light reaches here unless you bring it.' },
  { id: 'warren', name: 'Goblin Warren', kind: 'dungeon', icon: 'dungeon.green', monsters: ['goblin', 'goblin', 'goblin-shaman', 'goblin-brute', 'goblin-warlord'], reward: [{ item: 'goblin-totem', qty: 2 }], pet: 'pet-goblin', desc: 'A warren of goblins and their warlord.' },
  { id: 'nest', name: 'Spider Nest', kind: 'dungeon', icon: 'dungeon.black', monsters: ['spider', 'spider', 'crawler', 'spider', 'broodmother'], reward: [{ item: 'spider-silk', qty: 20 }], pet: 'pet-spiderling', req: [{ kind: 'dungeon', dungeon: 'warren' }], desc: 'Silk, eggs, and the mother of them all.' },
  { id: 'barrows', name: 'Barrow Tombs', kind: 'dungeon', icon: 'dungeon.bone', monsters: ['skeleton', 'skeleton', 'wraith', 'skeleton', 'barrow-king'], reward: [{ item: 'dungeon-chest', qty: 1 }], pet: 'pet-skull', req: [{ kind: 'dungeon', dungeon: 'nest' }], desc: 'The old kings do not rest.' },
  { id: 'keep', name: 'Frost Keep', kind: 'dungeon', icon: 'dungeon.frost', monsters: ['icewolf', 'frostmage', 'yeti', 'icegolem', 'frost-queen'], reward: [{ item: 'dungeon-chest', qty: 2 }], pet: 'pet-snowfox', req: [{ kind: 'dungeon', dungeon: 'barrows' }], desc: 'Her throne is made of everyone who came before.' },
  { id: 'pit', name: 'Infernal Pit', kind: 'dungeon', icon: 'dungeon.ember', monsters: ['imp', 'imp', 'salamander', 'lavagolem', 'magmawyrm', 'infernal-titan'], reward: [{ item: 'dungeon-chest', qty: 2 }, { item: 'fire-essence', qty: 10 }], pet: 'pet-ember', req: [{ kind: 'dungeon', dungeon: 'keep' }], desc: 'Six fights in the heat. The cape is the prize.' },
  { id: 'lair', name: "Dragon's Lair", kind: 'dungeon', icon: 'dungeon.dragon', monsters: ['greendrake', 'bluedrake', 'elderdrake', 'magmawyrm', 'ancient-dragon'], reward: [{ item: 'dungeon-chest', qty: 3 }, { item: 'dragon-bones', qty: 10 }], pet: 'pet-whelp', req: [{ kind: 'dungeon', dungeon: 'pit' }, { kind: 'level', skill: 'slayer', level: 60 }], desc: 'The oldest dragon sleeps on everything it ever took.' },
  { id: 'bastion', name: 'The Bastion', kind: 'stronghold', icon: 'stronghold.grey', monsters: ['bastion-sentinel', 'bastion-sentinel', 'bastion-warden', 'bastion-warden', 'bastion-champion', 'bastion-commander'], reward: [{ item: 'dungeon-chest', qty: 4 }], pet: 'pet-banner', req: [{ kind: 'dungeon', dungeon: 'lair' }], desc: 'A stronghold whose soldiers deal pure damage: armour does nothing. Resist it with levels and food.' },
  { id: 'rift', name: 'The Rift', kind: 'abyss', icon: 'area.void', monsters: ['rift-crawler', 'void-hound', 'unmade'], req: [{ kind: 'quest', quest: 'into-the-rift' }], desc: 'Void damage ignores armour; only void resistance stops it. They shrug off everything but void.' },
  { id: 'heart', name: 'Heart of the Rift', kind: 'dungeon', icon: 'dungeon.void', monsters: ['rift-crawler', 'void-hound', 'unmade', 'void-hound', 'rift-sovereign'], reward: [{ item: 'rift-chest', qty: 3 }], pet: 'pet-voidling', req: [{ kind: 'quest', quest: 'into-the-rift' }, { kind: 'dungeon', dungeon: 'bastion' }], desc: 'Where the world comes undone.' },
];
export const AREA = new Map(AREAS.map((a) => [a.id, a]));

/** Which area a monster is normally fought in (the first one listing it). */
export function homeArea(monster: string): Area | undefined {
  return AREAS.find((a) => a.kind !== 'dungeon' && a.monsters.includes(monster));
}

// --- Magic ---------------------------------------------------------------------

const TIERS = [
  { name: 'Strike', levels: [1, 5, 9, 13], hits: [20, 40, 60, 80], cat: 'mind' },
  { name: 'Bolt', levels: [17, 23, 29, 35], hits: [90, 100, 110, 120], cat: 'chaos' },
  { name: 'Blast', levels: [41, 47, 53, 59], hits: [130, 140, 150, 160], cat: 'death' },
  { name: 'Wave', levels: [62, 65, 70, 75], hits: [170, 180, 190, 200], cat: 'blood' },
  { name: 'Surge', levels: [81, 85, 90, 95], hits: [220, 240, 260, 280], cat: 'soul' },
] as const;
const ELEMS = ['air', 'water', 'earth', 'fire'] as const;
export const SPELLS: Spell[] = [];
TIERS.forEach((t, ti) => {
  ELEMS.forEach((e, ei) => {
    SPELLS.push({
      id: `${e}-${t.name.toLowerCase()}`, name: `${e[0]!.toUpperCase()}${e.slice(1)} ${t.name}`, level: t.levels[ei]!, maxHit: t.hits[ei]!, element: e,
      runes: [{ item: `rune-${e}`, qty: 1 + ti + (e === 'air' ? 1 : 0) }, { item: `rune-${t.cat}`, qty: 1 }], icon: `spell.rune-${e}`,
    });
  });
});
SPELLS.push({ id: 'void-lance', name: 'Void Lance', level: 80, maxHit: 320, element: 'void', runes: [{ item: 'rune-void', qty: 2 }, { item: 'rune-soul', qty: 1 }], icon: 'spell.rune-void' });
SPELLS.push({ id: 'rift-collapse', name: 'Rift Collapse', level: 92, maxHit: 400, element: 'void', runes: [{ item: 'rune-void', qty: 4 }, { item: 'rune-blood', qty: 2 }], icon: 'spell.void' });
SPELLS.sort((a, b) => a.level - b.level);
export const SPELL = new Map(SPELLS.map((s) => [s.id, s]));

export const AURORAS: Aurora[] = [
  { id: 'swiftness', name: 'Surge of Swiftness', level: 25, runes: [{ item: 'rune-air', qty: 3 }, { item: 'rune-mind', qty: 1 }], mods: { attackInterval: -6 } },
  { id: 'stoneward', name: 'Stoneward', level: 40, runes: [{ item: 'rune-earth', qty: 3 }, { item: 'rune-nature', qty: 1 }], mods: { damageReduction: 3 } },
  { id: 'fury', name: 'Fury', level: 60, runes: [{ item: 'rune-fire', qty: 4 }, { item: 'rune-blood', qty: 1 }], mods: { meleeMaxHit: 5, rangedMaxHit: 5, magicMaxHit: 5 } },
  { id: 'tranquility', name: 'Tranquility', level: 75, runes: [{ item: 'rune-water', qty: 5 }, { item: 'rune-soul', qty: 1 }], mods: { hpRegen: 120, lifesteal: 2 } },
];
export const AURORA = new Map(AURORAS.map((a) => [a.id, a]));

// --- Prayer --------------------------------------------------------------------

export const PRAYERS: Prayer[] = [
  { id: 'thick-skin', name: 'Thick Skin', level: 1, cost: 1, mods: { damageReduction: 2 }, icon: 'prayer.white' },
  { id: 'burst', name: 'Burst of Strength', level: 4, cost: 1, mods: { meleeMaxHit: 5 }, icon: 'prayer.red' },
  { id: 'clarity', name: 'Clarity of Thought', level: 7, cost: 1, mods: { meleeAccuracy: 5 }, icon: 'prayer.cyan' },
  { id: 'sharp-eye', name: 'Sharp Eye', level: 9, cost: 1, mods: { rangedAccuracy: 5, rangedMaxHit: 5 }, icon: 'prayer.green' },
  { id: 'mystic-will', name: 'Mystic Will', level: 11, cost: 1, mods: { magicAccuracy: 5, magicMaxHit: 3 }, icon: 'prayer.blue' },
  { id: 'rock-skin', name: 'Rock Skin', level: 16, cost: 2, mods: { damageReduction: 4 }, icon: 'prayer.grey' },
  { id: 'superhuman', name: 'Superhuman Strength', level: 19, cost: 2, mods: { meleeMaxHit: 10 }, icon: 'prayer.red' },
  { id: 'reflexes', name: 'Improved Reflexes', level: 22, cost: 2, mods: { meleeAccuracy: 10 }, icon: 'prayer.cyan' },
  { id: 'rapid-heal', name: 'Rapid Heal', level: 25, cost: 1, mods: { hpRegen: 100 }, icon: 'prayer.pink' },
  { id: 'protect-item', name: 'Protect Item', level: 30, cost: 1, mods: { protectItem: 1 }, icon: 'prayer.gold' },
  { id: 'hawk-eye', name: 'Hawk Eye', level: 34, cost: 2, mods: { rangedAccuracy: 10, rangedMaxHit: 10 }, icon: 'prayer.green' },
  { id: 'mystic-lore', name: 'Mystic Lore', level: 37, cost: 2, mods: { magicAccuracy: 10, magicMaxHit: 6 }, icon: 'prayer.blue' },
  { id: 'steel-skin', name: 'Steel Skin', level: 40, cost: 3, mods: { damageReduction: 6 }, icon: 'prayer.grey' },
  { id: 'ultimate', name: 'Ultimate Strength', level: 43, cost: 3, mods: { meleeMaxHit: 15 }, icon: 'prayer.red' },
  { id: 'incredible', name: 'Incredible Reflexes', level: 46, cost: 3, mods: { meleeAccuracy: 15 }, icon: 'prayer.cyan' },
  { id: 'protect-melee', name: 'Protect from Melee', level: 50, cost: 3, mods: { 'protect:melee': 40 }, icon: 'prayer.orange' },
  { id: 'protect-ranged', name: 'Protect from Ranged', level: 53, cost: 3, mods: { 'protect:ranged': 40 }, icon: 'prayer.teal' },
  { id: 'protect-magic', name: 'Protect from Magic', level: 56, cost: 3, mods: { 'protect:magic': 40 }, icon: 'prayer.purple' },
  { id: 'eagle-eye', name: 'Eagle Eye', level: 60, cost: 3, mods: { rangedAccuracy: 15, rangedMaxHit: 15 }, icon: 'prayer.green' },
  { id: 'mystic-might', name: 'Mystic Might', level: 63, cost: 3, mods: { magicAccuracy: 15, magicMaxHit: 10 }, icon: 'prayer.blue' },
  { id: 'piety', name: 'Piety', level: 70, cost: 5, mods: { meleeAccuracy: 20, meleeMaxHit: 18, damageReduction: 3 }, icon: 'prayer.gold' },
  { id: 'rigour', name: 'Rigour', level: 74, cost: 5, mods: { rangedAccuracy: 20, rangedMaxHit: 18, damageReduction: 3 }, icon: 'prayer.gold' },
  { id: 'augury', name: 'Augury', level: 77, cost: 5, mods: { magicAccuracy: 20, magicMaxHit: 14, damageReduction: 3 }, icon: 'prayer.gold' },
  { id: 'soul-siphon', name: 'Soul Siphon', level: 82, cost: 4, mods: { lifesteal: 5 }, icon: 'prayer.ecto' },
  { id: 'void-ward', name: 'Void Ward', level: 88, cost: 4, mods: { 'resist:void': 0.2 }, icon: 'prayer.void' },
];
export const PRAYER = new Map(PRAYERS.map((p) => [p.id, p]));

// --- Slayer --------------------------------------------------------------------

export const SLAYER_TIERS = [
  { id: 'easy', name: 'Easy', combat: 1, min: 1, max: 35, coins: 1 },
  { id: 'normal', name: 'Normal', combat: 30, min: 20, max: 60, coins: 2 },
  { id: 'hard', name: 'Hard', combat: 55, min: 45, max: 85, coins: 4 },
  { id: 'elite', name: 'Elite', combat: 80, min: 70, max: 110, coins: 7 },
] as const;

/** Monsters a Slayer Master may ask for: everything in combat and slayer areas. */
export function slayerPool(tier: (typeof SLAYER_TIERS)[number]): Monster[] {
  const ids = new Set(AREAS.filter((a) => a.kind === 'combat' || a.kind === 'slayer').flatMap((a) => a.monsters));
  return MONSTERS.filter((m) => ids.has(m.id) && m.combatLevel >= tier.min && m.combatLevel <= tier.max);
}
