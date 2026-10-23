/**
 * Every item in the game. Most are generated from the ladders in
 * `tiers.ts`; the rest are written out. Icons are `template.palette` —
 * `src/sprites/defs.ts` paints `template` in the shades `PALETTE[palette]`.
 */
import type { CombatStyle, DamageType, EquipStats, Item, LootTable, Mods, Slot } from './types';
import { CROPS, FISH, GEMS, HERBS, HIDES, METALS, ORES, PRECIOUS, ROBES, RUNES, WOODS, power, type Shades } from './tiers';

export const PALETTE: Record<string, Shades> = {};
for (const o of ORES) PALETTE[`ore-${o.id}`] = o.shades;
for (const m of [...METALS, ...PRECIOUS]) PALETTE[`metal-${m.id}`] = m.shades;
for (const w of WOODS) PALETTE[`wood-${w.id}`] = w.shades;
for (const f of FISH) PALETTE[`fish-${f.id}`] = f.shades;
for (const g of GEMS) PALETTE[`gem-${g.id}`] = g.shades;
for (const r of RUNES) PALETTE[`rune-${r.id}`] = r.shades;
for (const h of HERBS) PALETTE[`herb-${h.id}`] = h.shades;
for (const c of CROPS) PALETTE[`crop-${c.id}`] = c.shades;
for (const h of HIDES) PALETTE[`hide-${h.id}`] = h.shades;
for (const r of ROBES) PALETTE[`robe-${r.id}`] = r.shades;

/** Named palettes for everything that isn't on a ladder. */
const MISC_PALETTES: Record<string, Shades> = {
  bone: ['#8a8070', '#d8d0bc', '#ffffff'],
  bigbone: ['#7a6a50', '#c8b890', '#f8f0d8'],
  wyvern: ['#3a4a5a', '#8aa0b8', '#e0f0ff'],
  dragon: ['#5a1a0a', '#b84a2a', '#f0a080'],
  void: ['#14082a', '#5a2a9a', '#d090ff'],
  brown: ['#3a2410', '#7a5028', '#c08a50'],
  fox: ['#6a2a0a', '#d0601a', '#ffb070'],
  grey: ['#3a3a40', '#7a7a84', '#c8c8d0'],
  white: ['#8a8a90', '#d8d8e0', '#ffffff'],
  black: ['#0a0a0e', '#2a2a32', '#5a5a68'],
  red: ['#5a0a0a', '#b02020', '#ff7060'],
  green: ['#0a3a0a', '#2a8a2a', '#8ae08a'],
  blue: ['#0a1a5a', '#2a5ad0', '#90b0ff'],
  frost: ['#2a5a7a', '#6ab8e0', '#e0f8ff'],
  ember: ['#6a1a00', '#e05010', '#ffc050'],
  gold: ['#7a5000', '#e0a820', '#fff090'],
  silk: ['#8a8a9a', '#e0e0ec', '#ffffff'],
  slime: ['#1a5a1a', '#4ac04a', '#c0ffb0'],
  ecto: ['#2a5a4a', '#6ad0b0', '#d0fff0'],
  pink: ['#6a2a3a', '#e07a9a', '#ffd0e0'],
  purple: ['#2a0a4a', '#7a2ab0', '#d09aff'],
  meat: ['#5a0a0a', '#c03a3a', '#ff9a8a'],
  cooked: ['#3a1a08', '#8a4a1a', '#d08a4a'],
  burnt: ['#0a0808', '#2a2220', '#4a3a34'],
  wool: ['#a8a090', '#e8e4d8', '#ffffff'],
  milk: ['#a8b0b8', '#eef2f8', '#ffffff'],
  egg: ['#a08a60', '#f0e0c0', '#ffffff'],
  worm: ['#6a2a2a', '#c86a6a', '#ffb0a0'],
  compost: ['#1a1008', '#4a3018', '#7a5a30'],
  spirit: ['#0a3a4a', '#2ab0c8', '#b0ffff'],
  clay: ['#5a2a14', '#a8603a', '#e8a070'],
  jade: ['#0a3a2a', '#2a9a6a', '#a0f0c8'],
  bronzeart: ['#4a3010', '#a0702a', '#e8c070'],
  marble: ['#7a7a80', '#d0d0d8', '#ffffff'],
  amber: ['#6a3a00', '#e09010', '#ffd070'],
  royal: ['#3a0a3a', '#9a1a8a', '#ff8af0'],
  cyan: ['#0a4a5a', '#1ab0c8', '#a0f8ff'],
  orange: ['#6a2a00', '#e06a10', '#ffb060'],
  yellow: ['#6a5a00', '#e0c820', '#fff8a0'],
  teal: ['#0a3a3a', '#1a8a8a', '#8ae8e0'],
};
Object.assign(PALETTE, MISC_PALETTES);

export const ITEMS: Item[] = [];

function add(item: Item): Item {
  ITEMS.push(item);
  return item;
}

function mat(id: string, name: string, icon: string, sell: number, category: Item['category'] = 'material', desc?: string): Item {
  return add({ id, name, category, sell, icon, ...(desc ? { desc } : {}) });
}

// --- Raw materials ---------------------------------------------------------------

for (const o of ORES) mat(`ore-${o.id}`, o.name, `${o.id === 'essence' ? 'essence' : 'ore'}.ore-${o.id}`, Math.max(1, Math.round(o.xp / 3)), o.id === 'essence' ? 'essence' : 'ore');
for (const m of [...METALS, ...PRECIOUS]) mat(`bar-${m.id}`, `${m.name} Bar`, `bar.metal-${m.id}`, Math.round(2 + m.level * 1.5), 'bar');
for (const w of WOODS) mat(`log-${w.id}`, w.name, `log.wood-${w.id}`, Math.max(1, Math.round(w.xp / 3)), 'log');
for (const f of FISH) {
  mat(`raw-${f.id}`, `Raw ${f.name}`, `fish.fish-${f.id}`, f.sell, 'fish');
  add({ id: `food-${f.id}`, name: f.name, category: 'food', sell: f.sell * 2, icon: `cookedfish.fish-${f.id}`, heal: f.heal });
}
add({ id: 'burnt-food', name: 'Burnt Food', category: 'misc', sell: 0, icon: 'cookedfish.burnt', desc: 'Not even the rats will eat it.' });
for (const g of GEMS) mat(`gem-${g.id}`, g.name, `gem.gem-${g.id}`, g.sell, 'gem');
for (const r of RUNES) mat(`rune-${r.id}`, r.name, `rune.rune-${r.id}`, Math.round(1 + r.level / 6), 'rune');
for (const h of HERBS) {
  mat(`herb-${h.id}`, h.name, `herb.herb-${h.id}`, Math.round(4 + h.level), 'herb');
  mat(`seed-${h.id}`, `${h.name} Seed`, `seed.herb-${h.id}`, Math.round(2 + h.level / 2), 'seed');
}
for (const c of CROPS) {
  const crop: Item = { id: `crop-${c.id}`, name: c.name, category: c.heal ? 'food' : 'material', sell: Math.round(2 + c.level / 3), icon: `crop.crop-${c.id}` };
  if (c.heal) crop.heal = c.heal;
  add(crop);
  mat(`seed-${c.id}`, `${c.name} Seed`, `seed.crop-${c.id}`, Math.round(1 + c.level / 4), 'seed');
}
export const SAPLING_WOODS = ['oak', 'willow', 'maple', 'yew', 'magic'] as const;
for (const w of SAPLING_WOODS) {
  const wood = WOODS.find((x) => x.id === w)!;
  mat(`sapling-${w}`, `${wood.tree.replace(' Tree', '')} Sapling`, `sapling.wood-${w}`, Math.round(10 + wood.level * 3), 'seed');
}
mat('plank-normal', 'Plank', 'plank.wood-normal', 4);
for (const w of ['oak', 'teak', 'mahogany', 'yew'] as const) {
  const wood = WOODS.find((x) => x.id === w)!;
  mat(`plank-${w}`, `${wood.name.replace(' Logs', '')} Plank`, `plank.wood-${w}`, Math.round(4 + wood.level));
}
mat('stone-block', 'Stone Block', 'block.ore-limestone', 6);
mat('nails', 'Iron Nails', 'nails.metal-iron', 3);
mat('compost', 'Compost', 'sack.compost', 5, 'material', 'Doubles the chance of a full harvest.');
mat('super-compost', 'Rich Compost', 'sack.green', 20, 'material', 'Spread on a plot for a bigger, surer harvest.');
mat('ash', 'Ashes', 'dust.grey', 2, 'material', 'What is left of the fire.');
mat('spirit-shard', 'Spirit Shard', 'shard.spirit', 3, 'material', 'Binds a familiar to a tablet.');
mat('stardust', 'Stardust', 'dust.gold', 2, 'material', 'Spend at the observatory to strengthen a constellation.');
mat('golden-stardust', 'Golden Stardust', 'dust.amber', 40, 'material', 'Unlocks the brightest star of a constellation.');
mat('arrow-shafts', 'Arrow Shafts', 'shafts.wood-normal', 1);
mat('bowstring', 'Bowstring', 'string.white', 3, 'material', 'Spun from wool.');

// Animal produce (ranching) and quarry (hunting).
mat('worm', 'Worms', 'worm.worm', 1, 'material', 'Bait for the better fishing spots.');
mat('egg', 'Egg', 'egg.egg', 3);
mat('feather', 'Feather', 'feather.white', 1);
mat('milk', 'Bucket of Milk', 'bucket.milk', 4);
mat('cowhide', 'Cowhide', 'hide.brown', 6, 'hide');
mat('wool', 'Wool', 'wool.wool', 4);
mat('elk-antler', 'Velvet Antler', 'antler.bigbone', 60);
mat('green-drakehide', 'Green Drakehide', 'hide.green', 90, 'hide');
add({ id: 'raw-meat', name: 'Raw Meat', category: 'material', sell: 3, icon: 'meat.meat' });
add({ id: 'raw-pork', name: 'Raw Pork', category: 'material', sell: 5, icon: 'meat.pink' });
add({ id: 'raw-venison', name: 'Raw Venison', category: 'material', sell: 12, icon: 'meat.red' });
add({ id: 'raw-bear', name: 'Raw Bear Meat', category: 'material', sell: 20, icon: 'meat.brown' });
mat('rabbit-fur', 'Rabbit Fur', 'fur.white', 4, 'hide');
mat('fox-fur', 'Fox Fur', 'fur.fox', 12, 'hide');
mat('boar-hide', 'Boar Hide', 'hide.bigbone', 14, 'hide');
mat('deer-antler', 'Deer Antler', 'antler.bone', 20);
mat('wolf-pelt', 'Wolf Pelt', 'fur.grey', 30, 'hide');
mat('lynx-fur', 'Lynx Fur', 'fur.amber', 45, 'hide');
mat('bear-pelt', 'Bear Pelt', 'fur.brown', 60, 'hide');
mat('frost-scale', 'Frost Scale', 'scale.frost', 90, 'hide');
mat('ember-scale', 'Ember Scale', 'scale.ember', 130, 'hide');
mat('void-hide', 'Void Hide', 'hide.void', 220, 'hide');

// Monster parts.
mat('beast-fang', 'Beast Fang', 'fang.bone', 8);
mat('bat-wing', 'Bat Wing', 'wing.black', 10);
mat('spider-silk', 'Spider Silk', 'silk.silk', 14);
mat('ectoplasm', 'Ectoplasm', 'orb.ecto', 25);
mat('fire-essence', 'Fire Essence', 'orb.ember', 40);
mat('frost-shard', 'Frost Shard', 'shard.frost', 45);
mat('dragon-scale', 'Dragon Scale', 'scale.dragon', 120);
mat('black-drakehide', 'Black Drakehide', 'hide.black', 160, 'hide');
mat('void-shard', 'Void Shard', 'shard.void', 150);
mat('goblin-totem', 'Goblin Totem', 'totem.green', 20, 'misc', 'Proof of a goblin warren cleared.');

const BONES: [string, string, number, string][] = [
  ['bones', 'Bones', 5, 'bone'],
  ['big-bones', 'Big Bones', 15, 'bigbone'],
  ['wyvern-bones', 'Wyvern Bones', 50, 'wyvern'],
  ['dragon-bones', 'Dragon Bones', 72, 'dragon'],
  ['void-bones', 'Void Bones', 125, 'void'],
];
for (const [id, name, bury, pal] of BONES) add({ id, name, category: 'bone', sell: Math.round(bury / 2), icon: `bone.${pal}`, bury });

// --- Cooking -------------------------------------------------------------------

export const DISHES = [
  { id: 'baked-potato', name: 'Baked Potato', level: 5, heal: 50, inputs: [['crop-potato', 1]], xp: 15 },
  { id: 'cooked-meat', name: 'Cooked Meat', level: 1, heal: 40, inputs: [['raw-meat', 1]], xp: 10 },
  { id: 'bread', name: 'Bread', level: 10, heal: 50, inputs: [['crop-wheat', 2]], xp: 18 },
  { id: 'pork-chop', name: 'Pork Chop', level: 20, heal: 90, inputs: [['raw-pork', 1]], xp: 28 },
  { id: 'tomato-stew', name: 'Tomato Stew', level: 30, heal: 120, inputs: [['crop-tomato', 1], ['crop-onion', 1]], xp: 40 },
  { id: 'venison-steak', name: 'Venison Steak', level: 35, heal: 140, inputs: [['raw-venison', 1]], xp: 45 },
  { id: 'corn-chowder', name: 'Corn Chowder', level: 45, heal: 180, inputs: [['crop-sweetcorn', 1], ['milk', 1]], xp: 58 },
  { id: 'bear-roast', name: 'Bear Roast', level: 55, heal: 220, inputs: [['raw-bear', 1]], xp: 70 },
  { id: 'strawberry-cake', name: 'Strawberry Cake', level: 62, heal: 280, inputs: [['crop-strawberry', 2], ['egg', 1], ['milk', 1], ['crop-wheat', 1]], xp: 90 },
  { id: 'starfruit-tart', name: 'Starfruit Tart', level: 80, heal: 380, inputs: [['crop-starfruit', 2], ['egg', 1], ['crop-wheat', 1]], xp: 125 },
] as const;
for (const d of DISHES) add({ id: d.id, name: d.name, category: 'food', sell: Math.round(d.heal / 6), icon: `${d.id.includes('meat') || d.id.includes('chop') || d.id.includes('steak') || d.id.includes('roast') ? 'cookedmeat.cooked' : d.id.includes('cake') || d.id.includes('tart') || d.id === 'bread' ? 'cake.egg' : 'bowl.cooked'}`, heal: d.heal });

// --- Equipment helpers -----------------------------------------------------------

function gear(id: string, name: string, icon: string, sell: number, equip: EquipStats, desc?: string, category: Item['category'] = 'armour'): Item {
  return add({ id, name, category, sell, icon, equip, ...(desc ? { desc } : {}) });
}

export const MELEE_WEAPONS = [
  { kind: 'dagger', name: 'Dagger', bars: 1, off: 0, type: 'stab', speed: 2000, acc: 1.25, pow: 0.8, twoHanded: false },
  { kind: 'sword', name: 'Sword', bars: 2, off: 2, type: 'slash', speed: 2400, acc: 1.0, pow: 1.0, twoHanded: false },
  { kind: 'mace', name: 'Mace', bars: 2, off: 3, type: 'crush', speed: 2600, acc: 0.9, pow: 1.1, twoHanded: false },
  { kind: 'spear', name: 'Spear', bars: 3, off: 5, type: 'stab', speed: 3200, acc: 1.35, pow: 1.4, twoHanded: true },
  { kind: 'battleaxe', name: 'Battleaxe', bars: 3, off: 7, type: 'slash', speed: 3600, acc: 1.0, pow: 1.7, twoHanded: true },
  { kind: 'warhammer', name: 'Warhammer', bars: 4, off: 9, type: 'crush', speed: 3800, acc: 0.9, pow: 1.8, twoHanded: true },
] as const;

export const ARMOUR_PIECES = [
  { kind: 'helmet', name: 'Helmet', slot: 'helmet', bars: 2, off: 1, def: 1.2, dr: 0.15 },
  { kind: 'platebody', name: 'Platebody', slot: 'body', bars: 5, off: 8, def: 3, dr: 0.4 },
  { kind: 'platelegs', name: 'Platelegs', slot: 'legs', bars: 4, off: 6, def: 2, dr: 0.25 },
  { kind: 'boots', name: 'Boots', slot: 'boots', bars: 1, off: 0, def: 0.6, dr: 0.05 },
  { kind: 'gloves', name: 'Gauntlets', slot: 'gloves', bars: 1, off: 0, def: 0.6, dr: 0.05 },
  { kind: 'shield', name: 'Shield', slot: 'shield', bars: 3, off: 4, def: 1.8, dr: 0.15 },
] as const;

/** Total damage reduction of a full set of tier `i` plate. */
export function setDr(i: number): number {
  return 3 + i * 4;
}

METALS.forEach((m, i) => {
  const A = Math.round(8 * power(i));
  for (const w of MELEE_WEAPONS) {
    const equip: EquipStats = {
      slot: 'weapon', style: 'melee', damageType: w.type as DamageType, speed: w.speed, twoHanded: w.twoHanded,
      accuracy: Math.round(A * w.acc), power: Math.round(A * w.pow), req: { attack: m.level },
    };
    if (m.id === 'voidsteel') equip.resist = { void: 0.05 };
    gear(`${m.id}-${w.kind}`, `${m.name} ${w.name}`, `${w.kind}.metal-${m.id}`, Math.round((m.level + 5) * w.bars * 4), equip, undefined, 'weapon');
  }
  const D = Math.round(5 * power(i));
  for (const p of ARMOUR_PIECES) {
    const def = Math.round(D * p.def);
    const equip: EquipStats = {
      slot: p.slot as Slot, defMelee: def, defRanged: Math.round(def * 0.9), defMagic: Math.round(def * 0.3),
      dr: Math.round(setDr(i) * p.dr * 10) / 10, req: { defence: m.level },
    };
    if (m.id === 'voidsteel') equip.resist = { void: 0.04 };
    gear(`${m.id}-${p.kind}`, `${m.name} ${p.name}`, `${p.kind}.metal-${m.id}`, Math.round((m.level + 5) * p.bars * 4), equip);
  }
  mat(`${m.id}-arrowheads`, `${m.name} Arrowheads`, `arrowhead.metal-${m.id}`, Math.max(1, Math.round(m.level / 8)));
  gear(`${m.id}-arrows`, `${m.name} Arrows`, `arrow.metal-${m.id}`, Math.max(1, Math.round(m.level / 4)), {
    slot: 'ammo', ammoFor: 'bow', power: Math.round(4 * power(i)), accuracy: Math.round(2 * power(i)), req: { ranged: m.level },
  }, undefined, 'ammo');
});

/** Bows: one short (fast) and one long (accurate) per wood. */
WOODS.forEach((w, i) => {
  const A = Math.round(8 * power(i));
  gear(`${w.id}-shortbow`, `${w.id === 'normal' ? '' : `${w.name.replace(' Logs', '')} `}Shortbow`, `shortbow.wood-${w.id}`, Math.round((w.level + 5) * 6), {
    slot: 'weapon', style: 'ranged', damageType: 'pierce', speed: 2400, twoHanded: true, accuracy: Math.round(A * 1.0), power: Math.round(A * 0.25), req: { ranged: w.level },
  }, undefined, 'weapon');
  gear(`${w.id}-longbow`, `${w.id === 'normal' ? '' : `${w.name.replace(' Logs', '')} `}Longbow`, `longbow.wood-${w.id}`, Math.round((w.level + 5) * 8), {
    slot: 'weapon', style: 'ranged', damageType: 'pierce', speed: 3200, twoHanded: true, accuracy: Math.round(A * 1.35), power: Math.round(A * 0.45), req: { ranged: w.level },
  }, undefined, 'weapon');
});

/** Crafted ranged armour from hides. */
export const HIDE_PIECES = [
  { kind: 'coif', name: 'Coif', slot: 'helmet', hides: 1, off: 0, def: 1.1, dr: 0.15 },
  { kind: 'body', name: 'Body', slot: 'body', hides: 3, off: 6, def: 2.8, dr: 0.45 },
  { kind: 'chaps', name: 'Chaps', slot: 'legs', hides: 2, off: 3, def: 1.9, dr: 0.3 },
  { kind: 'vambraces', name: 'Vambraces', slot: 'gloves', hides: 1, off: 1, def: 0.6, dr: 0.1 },
] as const;
HIDES.forEach((h, i) => {
  const D = Math.round(4 * power(i + 1));
  for (const p of HIDE_PIECES) {
    const def = Math.round(D * p.def);
    gear(`${h.id}-${p.kind}`, `${h.name} ${p.name}`, `${p.kind === 'body' ? 'leatherbody' : p.kind}.hide-${h.id}`, Math.round((h.level + 5) * p.hides * 5), {
      slot: p.slot as Slot, defMelee: Math.round(def * 0.7), defRanged: def, defMagic: Math.round(def * 0.8),
      dr: Math.round((2 + i * 3) * p.dr * 10) / 10, accuracy: Math.round(D * 0.3 * p.def), req: { ranged: h.level, defence: Math.max(1, h.level - 10) },
      mods: { rangedAccuracy: Math.round(p.def * (1 + i)) },
    });
  }
});

/** Magic robes. */
export const ROBE_PIECES = [
  { kind: 'hat', name: 'Hat', slot: 'helmet', wool: 2, off: 0, def: 1 },
  { kind: 'top', name: 'Robe Top', slot: 'body', wool: 5, off: 5, def: 2.5 },
  { kind: 'bottom', name: 'Robe Bottom', slot: 'legs', wool: 4, off: 3, def: 1.8 },
  { kind: 'boots', name: 'Boots', slot: 'boots', wool: 1, off: 1, def: 0.5 },
] as const;
ROBES.forEach((r, i) => {
  const D = Math.round(4 * power(Math.round(i * 1.7)));
  for (const p of ROBE_PIECES) {
    const def = Math.round(D * p.def);
    const equip: EquipStats = {
      slot: p.slot as Slot, defMelee: Math.round(def * 0.4), defRanged: Math.round(def * 0.6), defMagic: def,
      dr: Math.round((1 + i * 2) * p.def / 6 * 10) / 10, req: { magic: r.level, defence: Math.max(1, Math.round(r.level / 2)) },
      mods: { magicMaxHit: Math.round(p.def * (1 + i)), magicAccuracy: Math.round(p.def * (2 + i * 2)) },
    };
    if (r.id === 'riftweave') equip.resist = { void: 0.04 };
    gear(`${r.id}-${p.kind}`, `${r.name} ${p.name}`, `robe${p.kind}.robe-${r.id}`, Math.round((r.level + 5) * p.wool * 6), equip);
  }
});

/** Staves. Elemental ones supply their rune for free. */
export const ELEMENTS = ['air', 'water', 'earth', 'fire'] as const;
gear('staff', 'Staff', 'staff.wood-normal', 20, { slot: 'weapon', style: 'magic', speed: 3000, twoHanded: true, accuracy: 6, power: 0, req: { magic: 1 } }, 'A plain staff for channelling spells.', 'weapon');
ELEMENTS.forEach((e, i) => {
  gear(`staff-${e}`, `Staff of ${e[0]!.toUpperCase()}${e.slice(1)}`, `staff.rune-${e}`, 200 + i * 80, {
    slot: 'weapon', style: 'magic', speed: 3000, twoHanded: true, accuracy: 14, power: 2, req: { magic: 10 + i * 5 }, mods: { [`infiniteRune:rune-${e}`]: 1 },
  }, `Supplies endless ${e} runes.`, 'weapon');
  gear(`battlestaff-${e}`, `${e[0]!.toUpperCase()}${e.slice(1)} Battlestaff`, `battlestaff.rune-${e}`, 1500 + i * 400, {
    slot: 'weapon', style: 'magic', speed: 2800, twoHanded: true, accuracy: 38, power: 8, req: { magic: 45 + i * 5 }, mods: { [`infiniteRune:rune-${e}`]: 1, magicMaxHit: 5 },
  }, `Supplies endless ${e} runes, and hits harder.`, 'weapon');
});

/** Jewelry. Plain pieces add a little; enchantment makes them sing. */
GEMS.forEach((g, i) => {
  const lvl = 5 + g.level;
  gear(`ring-${g.id}`, `${g.name} Ring`, `ring.gem-${g.id}`, Math.round(g.sell * 2 + 40), {
    slot: 'ring', accuracy: 2 + i * 2, defMelee: 1 + i, defRanged: 1 + i, defMagic: 1 + i, req: { magic: Math.max(1, lvl - 20) },
  }, undefined, 'jewelry');
  gear(`amulet-${g.id}`, `${g.name} Amulet`, `amulet.gem-${g.id}`, Math.round(g.sell * 2 + 60), {
    slot: 'amulet', accuracy: 3 + i * 3, power: 1 + i * 2, defMelee: 1 + i, defRanged: 1 + i, defMagic: 1 + i,
  }, undefined, 'jewelry');
});
gear('silver-ring', 'Silver Ring', 'ring.metal-silver', 40, { slot: 'ring', accuracy: 1 }, undefined, 'jewelry');
gear('silver-amulet', 'Silver Amulet', 'amulet.metal-silver', 50, { slot: 'amulet', accuracy: 2, power: 1 }, undefined, 'jewelry');

/** Enchanted jewelry: one skilling ring and one combat amulet per gem. */
export const ENCHANTED = [
  { gem: 'topaz', ring: 'Ring of the Forester', ringMods: { 'doubleChance:woodcutting': 5, 'doubleChance:fishing': 3 }, amulet: 'Amulet of Vigour', amuletMods: { maxHP: 5 } },
  { gem: 'sapphire', ring: 'Ring of the Angler', ringMods: { 'doubleChance:fishing': 8, 'preserve:cooking': 5 }, amulet: 'Amulet of Accuracy', amuletMods: { meleeAccuracy: 6, rangedAccuracy: 6, magicAccuracy: 6 } },
  { gem: 'emerald', ring: 'Ring of the Delver', ringMods: { 'doubleChance:mining': 8, gemChance: 1 }, amulet: 'Amulet of Fury', amuletMods: { meleeMaxHit: 5, rangedMaxHit: 5, magicMaxHit: 5 } },
  { gem: 'ruby', ring: 'Ring of the Artisan', ringMods: { 'preserve:smithing': 8, 'preserve:crafting': 8, 'preserve:fletching': 8 }, amulet: 'Amulet of Bloodlust', amuletMods: { lifesteal: 3 } },
  { gem: 'diamond', ring: 'Ring of Wealth', ringMods: { gpGain: 10, lootDouble: 4 }, amulet: 'Amulet of Warding', amuletMods: { damageReduction: 4 } },
  { gem: 'onyx', ring: 'Ring of Mastery', ringMods: { skillXP: 4, guildXP: 10 }, amulet: 'Amulet of Torment', amuletMods: { meleeMaxHit: 8, rangedMaxHit: 8, magicMaxHit: 8, meleeAccuracy: 8, rangedAccuracy: 8, magicAccuracy: 8 } },
] as const;
GEMS.forEach((g, i) => {
  const e = ENCHANTED[i]!;
  const base = ITEMS.find((x) => x.id === `ring-${g.id}`)!.equip!;
  gear(`ering-${g.id}`, e.ring, `ering.gem-${g.id}`, Math.round(g.sell * 5 + 200), { ...base, mods: { ...e.ringMods } }, undefined, 'jewelry');
  const baseA = ITEMS.find((x) => x.id === `amulet-${g.id}`)!.equip!;
  gear(`eamulet-${g.id}`, e.amulet, `eamulet.gem-${g.id}`, Math.round(g.sell * 5 + 300), { ...baseA, mods: { ...e.amuletMods } }, undefined, 'jewelry');
});

/** Elemental enchantments on weapons: same swing, a new damage type — the MI2 answer to a single best weapon. */
export const IMBUE_METALS = ['steel', 'mithril', 'adamant', 'cobalt', 'starmetal'] as const;
export const IMBUE_KINDS = ['sword', 'spear', 'warhammer'] as const;
for (const m of IMBUE_METALS) {
  for (const k of IMBUE_KINDS) {
    for (const e of ELEMENTS) {
      const base = ITEMS.find((x) => x.id === `${m}-${k}`)!;
      const eq = base.equip!;
      gear(`${m}-${k}-${e}`, `${e[0]!.toUpperCase()}${e.slice(1)}-forged ${base.name}`, `${k}.rune-${e}`, base.sell * 3, {
        ...eq, damageType: e, accuracy: Math.round(eq.accuracy! * 1.05), power: Math.round(eq.power! * 1.08),
        req: { attack: eq.req!.attack!, enchantment: Math.max(1, eq.req!.attack! - 5) },
      }, `Strikes with ${e} instead of steel.`, 'weapon');
    }
  }
}

// --- Beastcrafting -------------------------------------------------------------

export const FUR_CAPES = [
  { id: 'cape-rabbit', name: 'Rabbit-fur Cape', fur: 'rabbit-fur', level: 1, icon: 'cape.white', mods: { 'interval:agility': 3, 'interval:thieving': 2 } },
  { id: 'cape-fox', name: 'Foxtail Cape', fur: 'fox-fur', level: 15, icon: 'cape.fox', mods: { 'success:thieving': 5, gpGain: 3 } },
  { id: 'cape-wolf', name: 'Wolfpelt Cape', fur: 'wolf-pelt', level: 35, icon: 'cape.grey', mods: { meleeMaxHit: 3, meleeAccuracy: 4 } },
  { id: 'cape-lynx', name: 'Lynx Cape', fur: 'lynx-fur', level: 45, icon: 'cape.amber', mods: { rangedMaxHit: 3, rangedAccuracy: 4 } },
  { id: 'cape-bear', name: 'Bearhide Cape', fur: 'bear-pelt', level: 55, icon: 'cape.brown', mods: { maxHP: 6, damageReduction: 2 } },
  { id: 'cape-frost', name: 'Rimescale Cape', fur: 'frost-scale', level: 70, icon: 'cape.frost', mods: { magicMaxHit: 3, magicAccuracy: 4, 'resist:fire': 0.1 } },
  { id: 'cape-ember', name: 'Emberscale Cape', fur: 'ember-scale', level: 80, icon: 'cape.ember', mods: { meleeMaxHit: 4, rangedMaxHit: 4, magicMaxHit: 4, 'resist:water': 0.1 } },
] as const;
for (const c of FUR_CAPES) {
  gear(c.id, c.name, c.icon, 60 + c.level * 12, { slot: 'cape', defMelee: 2 + c.level / 8, defRanged: 2 + c.level / 8, defMagic: 2 + c.level / 8, mods: { ...c.mods } });
}

export const SCALE_TIERS = [
  { id: 'frostscale', name: 'Frostscale', scale: 'frost-scale', level: 60, shades: 'frost', resist: 'fire' },
  { id: 'emberscale', name: 'Emberscale', scale: 'ember-scale', level: 75, shades: 'ember', resist: 'water' },
  { id: 'voidscale', name: 'Voidscale', scale: 'void-hide', level: 88, shades: 'void', resist: 'void' },
] as const;
export const SCALE_PIECES = [
  { kind: 'helm', name: 'Helm', slot: 'helmet', n: 2, def: 1.2, tpl: 'coif' },
  { kind: 'hauberk', name: 'Hauberk', slot: 'body', n: 4, def: 3, tpl: 'leatherbody' },
  { kind: 'greaves', name: 'Greaves', slot: 'legs', n: 3, def: 2, tpl: 'chaps' },
] as const;
SCALE_TIERS.forEach((t, i) => {
  for (const p of SCALE_PIECES) {
    const def = Math.round((30 + i * 14) * p.def);
    gear(`${t.id}-${p.kind}`, `${t.name} ${p.name}`, `${p.tpl}.${t.shades}`, 400 + t.level * 20 * p.n, {
      slot: p.slot as Slot, defMelee: def, defRanged: def, defMagic: def, dr: Math.round((8 + i * 4) * p.def / 6 * 10) / 10,
      resist: { [t.resist]: t.resist === 'void' ? 0.06 * p.def / 2 : 0.05 * p.def }, req: { defence: t.level - 10, beastcrafting: t.level },
    }, `Hybrid armour: guards against every style, and against ${t.resist}.`);
  }
});
gear('bone-charm', 'Bone Charm', 'amulet.bone', 80, { slot: 'amulet', accuracy: 4, power: 2, mods: { 'buryBonus': 10 } }, 'Bones buried while worn give more prayer.', 'jewelry');
gear('antler-talisman', 'Antler Talisman', 'amulet.bigbone', 400, { slot: 'amulet', accuracy: 10, power: 5, mods: { 'doubleChance:hunting': 6 } }, undefined, 'jewelry');
gear('fang-necklace', 'Fang Necklace', 'amulet.dragon', 2600, { slot: 'amulet', accuracy: 22, power: 14, mods: { meleeMaxHit: 3, rangedMaxHit: 3 } }, undefined, 'jewelry');
mat('hunting-trap', 'Snare Trap', 'trap.brown', 6, 'material', 'Consumed by the bigger hunts.');
mat('bait-pouch', 'Bait Pouch', 'sack.worm', 12, 'material', 'Draws the shy creatures out.');

// --- Summoning tablets -----------------------------------------------------------

export const FAMILIARS = [
  { id: 'beaver', name: 'Beaver', level: 1, skill: 'woodcutting', mat: 'log-oak', pal: 'brown', mods: { 'doubleChance:woodcutting': 8, 'interval:woodcutting': 4 } },
  { id: 'otter', name: 'Otter', level: 10, skill: 'fishing', mat: 'raw-herring', pal: 'fox', mods: { 'doubleChance:fishing': 8, 'interval:fishing': 4 } },
  { id: 'mole', name: 'Mole', level: 20, skill: 'mining', mat: 'ore-iron', pal: 'black', mods: { 'doubleChance:mining': 8, gemChance: 1 } },
  { id: 'wolf', name: 'Wolf', level: 25, skill: 'combat', mat: 'beast-fang', pal: 'grey', maxHit: 60, mods: { meleeMaxHit: 3 } },
  { id: 'salamander', name: 'Salamander', level: 30, skill: 'cooking', mat: 'fire-essence', pal: 'ember', mods: { 'preserve:cooking': 10, 'success:cooking': 10 } },
  { id: 'magpie', name: 'Magpie', level: 35, skill: 'thieving', mat: 'feather', pal: 'black', mods: { 'success:thieving': 6, gpGain: 5 } },
  { id: 'ent', name: 'Ent', level: 40, skill: 'farming', mat: 'log-maple', pal: 'green', mods: { farmYield: 15 } },
  { id: 'golem', name: 'Golem', level: 45, skill: 'combat', mat: 'stone-block', pal: 'marble', maxHit: 80, mods: { damageReduction: 3 } },
  { id: 'owl', name: 'Owl', level: 50, skill: 'astrology', mat: 'feather', pal: 'amber', mods: { 'doubleChance:astrology': 8, 'interval:cartography': 5 } },
  { id: 'phoenix', name: 'Phoenix', level: 60, skill: 'combat', mat: 'fire-essence', pal: 'orange', maxHit: 110, mods: { hpRegen: 50 } },
  { id: 'imp', name: 'Imp', level: 70, skill: 'combat', mat: 'ectoplasm', pal: 'red', maxHit: 140, mods: { magicMaxHit: 4, runePreserve: 10 } },
  { id: 'wyrmling', name: 'Wyrmling', level: 80, skill: 'combat', mat: 'dragon-scale', pal: 'dragon', maxHit: 200, mods: { meleeAccuracy: 6, rangedAccuracy: 6, magicAccuracy: 6 } },
] as const;
for (const f of FAMILIARS) {
  const fam: NonNullable<Item['familiar']> = { skill: f.skill as never, mods: { ...f.mods } };
  if ('maxHit' in f) fam.maxHit = f.maxHit;
  add({
    id: `tablet-${f.id}`, name: `${f.name} Tablet`, category: 'tablet', sell: 5 + f.level, icon: `tablet.${f.pal}`,
    equip: { slot: 'summon1', req: { summoning: f.level } }, familiar: fam,
    desc: f.skill === 'combat' ? `A ${f.name.toLowerCase()} fights at your side.` : `A ${f.name.toLowerCase()} helps with ${f.skill}.`,
  });
}

// --- Potions ---------------------------------------------------------------------

export const POTIONS = [
  { id: 'lumberjack', name: "Lumberjack's Tonic", level: 1, herb: 'brightleaf', extra: 'egg', skill: 'woodcutting', mods: { 'doubleChance:woodcutting': 10 }, charges: 60, pal: 'brown' },
  { id: 'angler', name: "Angler's Brew", level: 5, herb: 'brightleaf', extra: 'worm', skill: 'fishing', mods: { 'doubleChance:fishing': 10 }, charges: 60, pal: 'blue' },
  { id: 'attack', name: 'Attack Potion', level: 8, herb: 'brightleaf', extra: 'beast-fang', skill: 'combat', mods: { meleeAccuracy: 12 }, charges: 80, pal: 'cyan' },
  { id: 'prospector', name: "Prospector's Draught", level: 12, herb: 'sagewort', extra: 'ore-coal', skill: 'mining', mods: { 'doubleChance:mining': 10 }, charges: 60, pal: 'grey' },
  { id: 'strength', name: 'Strength Potion', level: 15, herb: 'sagewort', extra: 'beast-fang', skill: 'combat', mods: { meleeMaxHit: 7 }, charges: 80, pal: 'orange' },
  { id: 'smith', name: "Smith's Elixir", level: 20, herb: 'emberroot', extra: 'ash', skill: 'smithing', mods: { 'preserve:smithing': 12 }, charges: 60, pal: 'red' },
  { id: 'ranging', name: 'Ranging Potion', level: 25, herb: 'emberroot', extra: 'feather', skill: 'combat', mods: { rangedAccuracy: 12, rangedMaxHit: 5 }, charges: 80, pal: 'green' },
  { id: 'magic', name: 'Magic Potion', level: 30, herb: 'frostmint', extra: 'bat-wing', skill: 'combat', mods: { magicAccuracy: 12, magicMaxHit: 5 }, charges: 80, pal: 'blue' },
  { id: 'defence', name: 'Defence Potion', level: 35, herb: 'frostmint', extra: 'spider-silk', skill: 'combat', mods: { damageReduction: 4 }, charges: 80, pal: 'teal' },
  { id: 'thief', name: "Thief's Draught", level: 40, herb: 'duskbloom', extra: 'spider-silk', skill: 'thieving', mods: { 'success:thieving': 12, gpGain: 8 }, charges: 60, pal: 'purple' },
  { id: 'artisan', name: "Artisan's Focus", level: 45, herb: 'duskbloom', extra: 'gem-sapphire', skill: 'crafting', mods: { 'preserve:crafting': 12, 'skillXP:crafting': 8 }, charges: 60, pal: 'pink' },
  { id: 'regen', name: 'Regeneration Potion', level: 55, herb: 'stormvine', extra: 'ectoplasm', skill: 'combat', mods: { hpRegen: 150 }, charges: 100, pal: 'ecto' },
  { id: 'growth', name: 'Growth Potion', level: 60, herb: 'stormvine', extra: 'compost', skill: 'farming', mods: { farmYield: 25 }, charges: 10, pal: 'slime' },
  { id: 'fortune', name: 'Fortune Potion', level: 68, herb: 'sunpetal', extra: 'dragon-scale', skill: 'combat', mods: { lootDouble: 10, gpGain: 10 }, charges: 100, pal: 'gold' },
  { id: 'stardust', name: 'Stargazer Draught', level: 72, herb: 'sunpetal', extra: 'stardust', skill: 'astrology', mods: { 'doubleChance:astrology': 12 }, charges: 60, pal: 'yellow' },
  { id: 'voidward', name: 'Void Ward', level: 82, herb: 'voidthistle', extra: 'void-shard', skill: 'combat', mods: { 'resist:void': 0.25 }, charges: 120, pal: 'void' },
] as const;
for (const p of POTIONS) {
  add({ id: `potion-${p.id}`, name: p.name, category: 'potion', sell: 10 + p.level * 2, icon: `potion.${p.pal}`, potion: { skill: p.skill as never, mods: { ...p.mods }, charges: p.charges } });
}

// --- Archaeology -----------------------------------------------------------------

export const DIG_SITES = [
  { id: 'old-well', name: 'The Old Well', level: 1, pal: 'clay', artefacts: ['Chipped Cup', 'Rusty Key', 'Clay Figurine'] },
  { id: 'barrow-field', name: 'Barrow Field', level: 12, pal: 'bronzeart', artefacts: ['Bronze Torc', 'Burial Urn', 'Antler Comb'] },
  { id: 'sunken-chapel', name: 'Sunken Chapel', level: 24, pal: 'marble', artefacts: ['Saint\'s Icon', 'Silver Censer', 'Stained Shard'] },
  { id: 'dragon-graves', name: 'Dragon Graves', level: 36, pal: 'dragon', artefacts: ['Wyrm Tooth', 'Scale Shield', 'Fossil Egg'] },
  { id: 'jade-court', name: 'The Jade Court', level: 48, pal: 'jade', artefacts: ['Jade Mask', 'Court Seal', 'Lacquer Box'] },
  { id: 'sky-temple', name: 'Sky Temple', level: 60, pal: 'cyan', artefacts: ['Wind Chime', 'Feathered Crown', 'Star Chart'] },
  { id: 'amber-vault', name: 'Amber Vault', level: 72, pal: 'amber', artefacts: ['Insect in Amber', 'Sun Disc', 'Gilded Scarab'] },
  { id: 'rift-ruins', name: 'Rift Ruins', level: 85, pal: 'void', artefacts: ['Hollow Idol', 'Unmade Coin', 'Shard of Before'] },
] as const;
const ART_TPL = ['pot', 'statue', 'coin'] as const;
for (const site of DIG_SITES) {
  site.artefacts.forEach((name, j) => {
    add({ id: `art-${site.id}-${j}`, name, category: 'artefact', sell: Math.round((site.level + 10) * (j + 1) * 8), icon: `${ART_TPL[j]}.${site.pal}`, desc: `Unearthed at ${site.name}. The museum would love it.` });
  });
}

// --- Construction ----------------------------------------------------------------

// (Planks, blocks and nails are above.)

// --- Unique drops ----------------------------------------------------------------

function unique(id: string, name: string, icon: string, sell: number, equip: EquipStats, desc: string): Item {
  return gear(id, name, icon, sell, equip, desc, equip.slot === 'weapon' ? 'weapon' : equip.slot === 'ring' || equip.slot === 'amulet' ? 'jewelry' : 'armour');
}
unique('goblin-cleaver', 'Goblin Cleaver', 'battleaxe.green', 800, { slot: 'weapon', style: 'melee', damageType: 'slash', speed: 2600, accuracy: 26, power: 28, req: { attack: 15 } }, 'Fast for a two-hander. Nobody knows how goblins lift it.');
unique('silkstrand-bow', 'Silkstrand Bow', 'longbow.silk', 3500, { slot: 'weapon', style: 'ranged', damageType: 'pierce', speed: 2600, twoHanded: true, accuracy: 60, power: 18, req: { ranged: 35 } }, 'Strung with spider silk. Quick and quiet.');
unique('barrow-crown', 'Barrow Crown', 'helmet.gold', 6000, { slot: 'helmet', defMelee: 40, defRanged: 40, defMagic: 40, dr: 4, req: { defence: 40 }, mods: { lifesteal: 2 } }, 'It whispers when you take it off.');
unique('frostfang', 'Frostfang', 'dagger.frost', 9000, { slot: 'weapon', style: 'melee', damageType: 'water', speed: 1900, accuracy: 70, power: 52, req: { attack: 55 } }, 'A dagger of ice that never melts. Deals water damage.');
unique('infernal-cape', 'Infernal Cape', 'cape.ember', 20000, { slot: 'cape', accuracy: 10, power: 8, defMelee: 18, defRanged: 18, defMagic: 18, dr: 3, req: { defence: 60 }, mods: { meleeMaxHit: 4, rangedMaxHit: 4, magicMaxHit: 4 } }, 'Earned in fire.');
unique('dragonbane', 'Dragonbane', 'spear.dragon', 30000, { slot: 'weapon', style: 'melee', damageType: 'stab', speed: 3000, twoHanded: true, accuracy: 120, power: 115, req: { attack: 70 }, mods: { 'damageVs:dragon': 20 } }, 'Forged to find the gaps between scales.');
unique('ward-shield', 'Dragonfire Ward', 'shield.dragon', 4000, { slot: 'shield', defMelee: 50, defRanged: 50, defMagic: 50, dr: 5, resist: { fire: 0.4 }, req: { defence: 50 } }, 'Keeps dragonfire off. Needed in the Drake Roost.');
unique('holy-symbol', 'Holy Symbol', 'amulet.silk', 400, { slot: 'amulet', accuracy: 4, power: 2, defMagic: 6, mods: { prayerCost: -10 } }, 'Keeps the dead at arm\'s length. Needed in the Haunted Crypt.');
unique('miasma-mask', 'Miasma Mask', 'helmet.slime', 1200, { slot: 'helmet', defMelee: 18, defRanged: 22, defMagic: 18, dr: 2, req: { defence: 25 } }, 'Filters the marsh air. Needed in the Miasma Marsh.');
unique('dawn-ring', 'Ring of Dawn', 'ering.yellow', 8000, { slot: 'ring', accuracy: 12, defMelee: 10, defRanged: 10, defMagic: 10, mods: { 'resist:void': 0.05 } }, 'A light that the dark cannot swallow. Needed in the Shadow Depths.');
unique('void-staff', 'Staff of the Rift', 'battlestaff.void', 60000, { slot: 'weapon', style: 'magic', speed: 2600, twoHanded: true, accuracy: 140, power: 22, req: { magic: 85 }, mods: { 'infiniteRune:rune-void': 1 } }, 'Supplies endless void runes. Hums with the Rift.');
unique('riftreaver', 'Riftreaver', 'warhammer.void', 80000, { slot: 'weapon', style: 'melee', damageType: 'void', speed: 3400, twoHanded: true, accuracy: 190, power: 200, req: { attack: 90 }, resist: { void: 0.05 } }, 'Deals void damage.');
unique('rift-bow', 'Riftstring Bow', 'longbow.void', 80000, { slot: 'weapon', style: 'ranged', damageType: 'void', speed: 2800, twoHanded: true, accuracy: 190, power: 70, req: { ranged: 90 }, resist: { void: 0.05 } }, 'Its arrows deal void damage.');
unique('stronghold-sigil', 'Sigil of the Bastion', 'eamulet.gold', 40000, { slot: 'amulet', accuracy: 30, power: 20, defMelee: 20, defRanged: 20, defMagic: 20, dr: 3 }, 'Taken from the Bastion\'s keep.');
unique('raider-ring', 'Raider\'s Ring', 'ering.green', 3000, { slot: 'ring', accuracy: 8, mods: { combatXP: 5, gpGain: 5 } }, 'Bought with Gauntlet coins.');

// --- Skillcapes ------------------------------------------------------------------

// Added in data/skills.ts once the skill list (with palettes) exists.

// --- Chests --------------------------------------------------------------------

function chest(id: string, name: string, icon: string, opens: LootTable, desc: string): void {
  add({ id, name, category: 'chest', sell: 0, icon, opens, desc });
}
chest('bird-nest', 'Bird Nest', 'nest.brown', { chance: 1, entries: [
  { item: 'seed-potato', min: 1, max: 4, weight: 20 }, { item: 'seed-onion', min: 1, max: 3, weight: 15 }, { item: 'seed-brightleaf', min: 1, max: 2, weight: 15 },
  { item: 'seed-sagewort', min: 1, max: 2, weight: 10 }, { item: 'sapling-oak', min: 1, max: 1, weight: 8 }, { item: 'sapling-willow', min: 1, max: 1, weight: 4 },
  { item: 'sapling-maple', min: 1, max: 1, weight: 2 }, { item: 'feather', min: 3, max: 10, weight: 20 }, { item: 'egg', min: 1, max: 2, weight: 10 },
] }, 'Fell out of a tree. Something might be inside.');
chest('sunken-chest', 'Sunken Chest', 'chest.wood-teak', { chance: 1, entries: [
  { item: 'gem-topaz', min: 1, max: 2, weight: 20 }, { item: 'gem-sapphire', min: 1, max: 1, weight: 14 }, { item: 'gem-emerald', min: 1, max: 1, weight: 8 },
  { item: 'gem-ruby', min: 1, max: 1, weight: 4 }, { item: 'gem-diamond', min: 1, max: 1, weight: 1 }, { item: 'bar-gold', min: 1, max: 3, weight: 10 },
  { item: 'rune-nature', min: 5, max: 20, weight: 12 }, { item: 'seed-frostmint', min: 1, max: 2, weight: 6 },
] }, 'Hauled up from the deep, crusted in barnacles.');
chest('dungeon-chest', 'Warden\'s Chest', 'chest.metal-iron', { chance: 1, entries: [
  { item: 'gem-sapphire', min: 1, max: 3, weight: 20 }, { item: 'gem-emerald', min: 1, max: 2, weight: 15 }, { item: 'gem-ruby', min: 1, max: 2, weight: 10 },
  { item: 'gem-diamond', min: 1, max: 1, weight: 5 }, { item: 'rune-death', min: 10, max: 40, weight: 15 }, { item: 'rune-blood', min: 5, max: 25, weight: 8 },
  { item: 'bar-mithril', min: 3, max: 8, weight: 12 }, { item: 'bar-adamant', min: 2, max: 6, weight: 8 }, { item: 'seed-duskbloom', min: 1, max: 3, weight: 6 },
  { item: 'spirit-shard', min: 20, max: 80, weight: 10 },
] }, 'The reward for a cleared dungeon.');
chest('rift-chest', 'Rift Cache', 'chest.void', { chance: 1, entries: [
  { item: 'void-shard', min: 2, max: 6, weight: 30 }, { item: 'gem-onyx', min: 1, max: 1, weight: 6 }, { item: 'rune-void', min: 20, max: 80, weight: 25 },
  { item: 'ore-voidstone', min: 5, max: 15, weight: 20 }, { item: 'seed-voidthistle', min: 1, max: 3, weight: 10 }, { item: 'void-bones', min: 2, max: 5, weight: 15 },
] }, 'It is colder inside than it should be.');
chest('relic-cache', 'Ancient Cache', 'chest.gold', { chance: 1, entries: [
  { item: 'golden-stardust', min: 1, max: 3, weight: 10 }, { item: 'gem-diamond', min: 1, max: 2, weight: 10 }, { item: 'gem-onyx', min: 1, max: 1, weight: 3 },
  { item: 'bar-starmetal', min: 2, max: 5, weight: 10 }, { item: 'spirit-shard', min: 50, max: 150, weight: 15 },
] }, 'Found by careful digging.');

// --- Lookup --------------------------------------------------------------------

export const ITEM = new Map(ITEMS.map((i) => [i.id, i]));

export function item(id: string): Item {
  const it = ITEM.get(id);
  if (!it) throw new Error(`no item "${id}"`);
  return it;
}

/** Registers an item from another data file (skillcapes need the skill list). */
export function registerItem(it: Item): void {
  add(it);
  ITEM.set(it.id, it);
}

export function styleOf(weapon: Item | undefined): CombatStyle {
  return weapon?.equip?.style ?? 'melee';
}

export function modsOf(it: Item): Mods {
  return it.equip?.mods ?? {};
}
