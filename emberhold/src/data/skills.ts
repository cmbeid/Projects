/**
 * The thirty skills, and the repeatable actions of every skill that is
 * nothing more than a list of them. Skills with machinery of their own —
 * farming, agility, cartography, ranching, construction's settlement,
 * astrology's stars — have extra data in `special.ts`.
 */
import { DISHES, DIG_SITES, ELEMENTS, FAMILIARS, FUR_CAPES, HIDE_PIECES, IMBUE_KINDS, IMBUE_METALS, MELEE_WEAPONS, ARMOUR_PIECES, POTIONS, ROBE_PIECES, SCALE_PIECES, SCALE_TIERS, item, registerItem } from './items';
import { CONSTELLATIONS } from './special';
import { FISH, GEMS, HIDES, METALS, ORES, PRECIOUS, ROBES, RUNES, WOODS } from './tiers';
import { SKILLS, type LootTable, type Qty, type SkillAction, type SkillId } from './types';

export type SkillKind = 'combat' | 'gathering' | 'artisan' | 'support';

export interface SkillInfo {
  id: SkillId;
  name: string;
  kind: SkillKind;
  desc: string;
  /** Skillcape colour. */
  pal: string;
  /** Skills that are trained through their own screen rather than an action list. */
  special?: boolean;
  /** New in the second game (shown with a badge). */
  isNew?: boolean;
}

export const SKILL_INFO: Record<SkillId, SkillInfo> = {
  attack: { id: 'attack', name: 'Attack', kind: 'combat', desc: 'Accuracy with melee weapons.', pal: 'red', special: true },
  strength: { id: 'strength', name: 'Strength', kind: 'combat', desc: 'Melee max hit.', pal: 'green', special: true },
  defence: { id: 'defence', name: 'Defence', kind: 'combat', desc: 'Evasion, and the armour you can wear.', pal: 'blue', special: true },
  hitpoints: { id: 'hitpoints', name: 'Hitpoints', kind: 'combat', desc: 'Ten hit points per level.', pal: 'red', special: true },
  ranged: { id: 'ranged', name: 'Ranged', kind: 'combat', desc: 'Accuracy and max hit with bows.', pal: 'green', special: true },
  magic: { id: 'magic', name: 'Magic', kind: 'combat', desc: 'Spells, robes and staves.', pal: 'blue', special: true },
  prayer: { id: 'prayer', name: 'Prayer', kind: 'combat', desc: 'Bury bones; pray for an edge in combat.', pal: 'white', special: true },
  slayer: { id: 'slayer', name: 'Slayer', kind: 'combat', desc: 'Hunt what the Slayer Master asks for; earn coins and new areas.', pal: 'black', special: true },
  woodcutting: { id: 'woodcutting', name: 'Woodcutting', kind: 'gathering', desc: 'Fell trees for logs. Birds sometimes drop a nest.', pal: 'green' },
  fishing: { id: 'fishing', name: 'Fishing', kind: 'gathering', desc: 'Catch fish to cook. The deep spots need bait.', pal: 'blue' },
  mining: { id: 'mining', name: 'Mining', kind: 'gathering', desc: 'Dig ore and essence; sometimes a gem.', pal: 'grey' },
  firemaking: { id: 'firemaking', name: 'Firemaking', kind: 'artisan', desc: 'Burn logs for XP and ash; light a bonfire for a boost to every skill.', pal: 'ember' },
  cooking: { id: 'cooking', name: 'Cooking', kind: 'artisan', desc: 'Turn fish, meat and crops into food. Burns less as you level.', pal: 'purple' },
  smithing: { id: 'smithing', name: 'Smithing', kind: 'artisan', desc: 'Smelt bars and forge weapons, armour and arrowheads.', pal: 'grey' },
  fletching: { id: 'fletching', name: 'Fletching', kind: 'artisan', desc: 'Bows, shafts and arrows.', pal: 'teal' },
  crafting: { id: 'crafting', name: 'Crafting', kind: 'artisan', desc: 'Hide armour, bowstrings and jewelry.', pal: 'brown' },
  runecrafting: { id: 'runecrafting', name: 'Runecrafting', kind: 'artisan', desc: 'Bind essence into runes; weave robes and staves.', pal: 'orange' },
  herblore: { id: 'herblore', name: 'Herblore', kind: 'artisan', desc: 'Brew potions that boost a skill or a fight.', pal: 'slime' },
  thieving: { id: 'thieving', name: 'Thieving', kind: 'gathering', desc: 'Pick pockets. Fail and you are stunned and hurt.', pal: 'purple' },
  farming: { id: 'farming', name: 'Farming', kind: 'gathering', desc: 'Plant crops, herbs and trees that grow while you do other things.', pal: 'green', special: true },
  agility: { id: 'agility', name: 'Agility', kind: 'support', desc: 'Build an obstacle course; each obstacle gives a lasting bonus.', pal: 'blue', special: true },
  summoning: { id: 'summoning', name: 'Summoning', kind: 'artisan', desc: 'Bind familiars to tablets; two together can form a synergy.', pal: 'spirit' },
  astrology: { id: 'astrology', name: 'Astrology', kind: 'support', desc: 'Study constellations for stardust; spend it on their stars.', pal: 'gold', special: true },
  cartography: { id: 'cartography', name: 'Cartography', kind: 'support', desc: 'Survey the map hex by hex; find landmarks and dig sites.', pal: 'amber', special: true },
  archaeology: { id: 'archaeology', name: 'Archaeology', kind: 'gathering', desc: 'Excavate dig sites you have charted; fill the museum.', pal: 'clay' },
  construction: { id: 'construction', name: 'Construction', kind: 'artisan', desc: 'Cut planks and stone, then build up your settlement.', pal: 'bronzeart', isNew: true },
  enchantment: { id: 'enchantment', name: 'Enchantment', kind: 'artisan', desc: 'Imbue jewelry with skills and weapons with the elements.', pal: 'royal', isNew: true },
  ranching: { id: 'ranching', name: 'Ranching', kind: 'gathering', desc: 'Keep animals in pens; they produce while you are away.', pal: 'egg', special: true, isNew: true },
  hunting: { id: 'hunting', name: 'Hunting', kind: 'gathering', desc: 'Track and trap creatures for furs, scales and meat.', pal: 'fox', isNew: true },
  beastcrafting: { id: 'beastcrafting', name: 'Beastcrafting', kind: 'artisan', desc: 'Furs into capes, scales into hybrid armour, bones into charms.', pal: 'dragon', isNew: true },
};

export const SKILL_LIST = SKILLS.map((s) => SKILL_INFO[s]);

const RIFT = { kind: 'quest', quest: 'into-the-rift' } as const;

function q(entries: readonly (readonly [string, number])[]): Qty[] {
  return entries.map(([i, n]) => ({ item: i, qty: n }));
}

function loot(chance: number, entries: [string, number, number, number][]): LootTable {
  return { chance, entries: entries.map(([i, min, max, weight]) => ({ item: i, min, max, weight })) };
}

const ACTIONS: SkillAction[] = [];
function act(a: SkillAction): void {
  ACTIONS.push(a);
}

// --- Gathering -----------------------------------------------------------------

for (const w of WOODS) {
  act({
    id: `wc-${w.id}`, skill: 'woodcutting', name: w.tree, level: w.level, interval: w.interval, xp: w.xp, inputs: [],
    outputs: [{ item: `log-${w.id}`, qty: 1 }], loot: loot(0.006, [['bird-nest', 1, 1, 1]]), icon: `tree.wood-${w.id}`,
    ...(w.id === 'elder' ? { unlock: RIFT } : {}),
  });
}

for (const f of FISH) {
  act({
    id: `fish-${f.id}`, skill: 'fishing', name: f.name, level: f.level, interval: f.interval, xp: f.xp,
    inputs: f.level >= 40 ? [{ item: 'worm', qty: 1 }] : [], outputs: [{ item: `raw-${f.id}`, qty: 1 }],
    loot: loot(0.004, [['sunken-chest', 1, 1, 1]]), icon: `fish.fish-${f.id}`, ...(f.id === 'rifteel' ? { unlock: RIFT } : {}),
  });
}

const GEM_LOOT = GEMS.map((g, i) => [`gem-${g.id}`, 1, 1, [40, 25, 16, 10, 6, 3][i]!] as [string, number, number, number]);
for (const o of ORES) {
  act({
    id: `mine-${o.id}`, skill: 'mining', name: o.name, level: o.level, interval: o.interval, xp: o.xp, inputs: [],
    outputs: [{ item: `ore-${o.id}`, qty: 1 }], loot: loot(o.id === 'essence' ? 0 : 0.01, GEM_LOOT), icon: `rock.ore-${o.id}`,
    ...(o.id === 'voidstone' ? { unlock: RIFT } : {}),
  });
}

export const THIEVING_NPCS = [
  { id: 'villager', name: 'Villager', level: 1, xp: 8, gp: [1, 20], success: 0.72, loot: [['seed-potato', 1, 3, 10], ['seed-wheat', 1, 3, 8], ['bread', 1, 1, 4]] },
  { id: 'farmer', name: 'Farmer', level: 8, xp: 14, gp: [5, 30], success: 0.7, loot: [['seed-brightleaf', 1, 2, 8], ['seed-onion', 1, 3, 8], ['seed-cabbage', 1, 2, 6], ['seed-sagewort', 1, 1, 4]] },
  { id: 'fisherman', name: 'Fisherman', level: 15, xp: 20, gp: [10, 50], success: 0.7, loot: [['raw-trout', 1, 3, 8], ['worm', 3, 10, 10], ['raw-salmon', 1, 2, 4]] },
  { id: 'merchant', name: 'Merchant', level: 25, xp: 30, gp: [20, 120], success: 0.68, loot: [['gem-topaz', 1, 1, 8], ['gem-sapphire', 1, 1, 4], ['seed-tomato', 1, 2, 6], ['seed-emberroot', 1, 1, 4]] },
  { id: 'guard', name: 'Town Guard', level: 35, xp: 42, gp: [40, 180], success: 0.66, loot: [['bar-iron', 1, 3, 8], ['bar-steel', 1, 2, 5], ['rune-chaos', 3, 10, 6]] },
  { id: 'mage', name: 'Wandering Mage', level: 45, xp: 55, gp: [50, 220], success: 0.65, loot: [['rune-nature', 2, 8, 8], ['rune-death', 1, 5, 5], ['seed-frostmint', 1, 2, 5], ['seed-duskbloom', 1, 1, 3]] },
  { id: 'knight', name: 'Knight', level: 55, xp: 70, gp: [100, 400], success: 0.64, loot: [['gem-emerald', 1, 1, 6], ['gem-ruby', 1, 1, 3], ['bar-mithril', 1, 2, 5]] },
  { id: 'noble', name: 'Noble', level: 65, xp: 88, gp: [200, 700], success: 0.63, loot: [['gem-ruby', 1, 1, 6], ['gem-diamond', 1, 1, 2], ['bar-gold', 1, 3, 6], ['seed-stormvine', 1, 1, 3]] },
  { id: 'assassin', name: 'Assassin', level: 75, xp: 110, gp: [300, 1000], success: 0.62, loot: [['spider-silk', 2, 5, 8], ['seed-sunpetal', 1, 1, 3], ['rune-blood', 2, 8, 6], ['seed-starfruit', 1, 1, 2]] },
  { id: 'cultist', name: 'Rift Cultist', level: 88, xp: 145, gp: [500, 1600], success: 0.6, loot: [['void-shard', 1, 1, 4], ['seed-voidthistle', 1, 1, 2], ['rune-void', 2, 8, 6], ['gem-onyx', 1, 1, 1]] },
] as const;
for (const n of THIEVING_NPCS) {
  act({
    id: `thieve-${n.id}`, skill: 'thieving', name: n.name, level: n.level, interval: 3000, xp: n.xp, inputs: [], outputs: [],
    gp: [n.gp[0], n.gp[1]], success: n.success, loot: loot(0.35, n.loot.map((l) => [...l] as [string, number, number, number])),
    icon: `npc.${['brown', 'green', 'blue', 'gold', 'grey', 'purple', 'white', 'royal', 'black', 'void'][THIEVING_NPCS.indexOf(n)]}`,
    ...(n.id === 'cultist' ? { unlock: RIFT } : {}),
  });
}

export const HUNTS = [
  { id: 'rabbit', name: 'Rabbit', level: 1, interval: 3500, xp: 10, out: [['rabbit-fur', 1]], inputs: [], loot: [['raw-meat', 1, 1, 6], ['bones', 1, 1, 3]], pal: 'white' },
  { id: 'fox', name: 'Fox', level: 10, interval: 4000, xp: 17, out: [['fox-fur', 1]], inputs: [], loot: [['raw-meat', 1, 1, 4], ['bones', 1, 1, 3]], pal: 'fox' },
  { id: 'boar', name: 'Wild Boar', level: 20, interval: 4500, xp: 26, out: [['boar-hide', 1], ['raw-meat', 1]], inputs: [], loot: [['big-bones', 1, 1, 4], ['beast-fang', 1, 1, 2]], pal: 'brown' },
  { id: 'deer', name: 'Red Deer', level: 30, interval: 5000, xp: 36, out: [['raw-venison', 1]], inputs: [], loot: [['deer-antler', 1, 1, 4], ['big-bones', 1, 1, 3]], pal: 'fox' },
  { id: 'wolf', name: 'Timber Wolf', level: 40, interval: 5500, xp: 48, out: [['wolf-pelt', 1]], inputs: [['hunting-trap', 1]], loot: [['beast-fang', 1, 2, 6], ['big-bones', 1, 1, 3]], pal: 'grey' },
  { id: 'lynx', name: 'Lynx', level: 50, interval: 6000, xp: 62, out: [['lynx-fur', 1]], inputs: [['bait-pouch', 1]], loot: [['raw-meat', 1, 2, 4], ['beast-fang', 1, 1, 3]], pal: 'amber' },
  { id: 'bear', name: 'Cave Bear', level: 60, interval: 7000, xp: 80, out: [['bear-pelt', 1], ['raw-bear', 1]], inputs: [['hunting-trap', 1]], loot: [['big-bones', 1, 2, 5], ['beast-fang', 1, 2, 3]], pal: 'brown' },
  { id: 'frostdrake', name: 'Frost Drake', level: 70, interval: 8000, xp: 100, out: [['frost-scale', 1]], inputs: [['hunting-trap', 1], ['bait-pouch', 1]], loot: [['wyvern-bones', 1, 1, 5], ['frost-shard', 1, 1, 2]], pal: 'frost' },
  { id: 'emberdrake', name: 'Ember Drake', level: 80, interval: 9000, xp: 125, out: [['ember-scale', 1]], inputs: [['hunting-trap', 1], ['bait-pouch', 1]], loot: [['dragon-bones', 1, 1, 4], ['fire-essence', 1, 1, 3]], pal: 'ember' },
  { id: 'voidstalker', name: 'Void Stalker', level: 90, interval: 10000, xp: 160, out: [['void-hide', 1]], inputs: [['hunting-trap', 1], ['bait-pouch', 2]], loot: [['void-bones', 1, 1, 4], ['void-shard', 1, 1, 1]], pal: 'void' },
] as const;
for (const h of HUNTS) {
  act({
    id: `hunt-${h.id}`, skill: 'hunting', name: h.name, level: h.level, interval: h.interval, xp: h.xp,
    inputs: q(h.inputs), outputs: q(h.out), loot: loot(0.5, h.loot.map((l) => [...l] as [string, number, number, number])),
    icon: `beast.${h.pal}`, ...(h.id === 'voidstalker' ? { unlock: RIFT } : {}),
  });
}

DIG_SITES.forEach((site, i) => {
  const extras: [string, number, number, number][] = [
    ['gem-topaz', 1, 1, 6], [`ore-${['copper', 'iron', 'silver', 'gold', 'mithril', 'adamantite', 'cobalt', 'voidstone'][i]!}`, 2, 6, 14],
    ['bones', 1, 3, 8], ['relic-cache', 1, 1, 1],
  ];
  act({
    id: `dig-${site.id}`, skill: 'archaeology', name: site.name, level: site.level, interval: 6000 + i * 500, xp: 14 + site.level * 1.4,
    inputs: [], outputs: [],
    loot: loot(0.9, [...site.artefacts.map((_, j) => [`art-${site.id}-${j}`, 1, 1, [10, 5, 2][j]!] as [string, number, number, number]), ...extras]),
    icon: `dig.${site.pal}`, unlock: { kind: 'poi', poi: `site-${site.id}` },
  });
});

// --- Artisan -------------------------------------------------------------------

for (const w of WOODS) {
  act({
    id: `fm-${w.id}`, skill: 'firemaking', name: w.name, level: w.level, interval: Math.round(w.interval * 0.6), xp: Math.round(w.xp * 1.5),
    inputs: [{ item: `log-${w.id}`, qty: 1 }], outputs: [], loot: loot(0.25, [['ash', 1, 1, 1]]), icon: `fire.wood-${w.id}`,
  });
}

for (const f of FISH) {
  act({
    id: `cook-${f.id}`, skill: 'cooking', name: f.name, level: f.level, interval: 3000, xp: Math.round(f.xp * 1.1),
    inputs: [{ item: `raw-${f.id}`, qty: 1 }], outputs: [{ item: `food-${f.id}`, qty: 1 }], success: 0.7, icon: `cookedfish.fish-${f.id}`, group: 'Fish',
  });
}
for (const d of DISHES) {
  act({
    id: `cook-${d.id}`, skill: 'cooking', name: d.name, level: d.level, interval: 3500, xp: d.xp, inputs: q(d.inputs),
    outputs: [{ item: d.id, qty: 1 }], success: 0.7, icon: item(d.id).icon, group: 'Dishes',
  });
}

[...METALS, ...PRECIOUS].forEach((m) => {
  act({
    id: `smelt-${m.id}`, skill: 'smithing', name: `${m.name} Bar`, level: m.level, interval: 2500, xp: Math.round(5 + m.level * 0.9),
    inputs: q(m.ores.map(([o, n]) => [`ore-${o}`, n] as const)), outputs: [{ item: `bar-${m.id}`, qty: 1 }], icon: `bar.metal-${m.id}`, group: 'Smelting',
  });
});
METALS.forEach((m) => {
  const barXp = Math.round(8 + m.level * 1.2);
  for (const w of MELEE_WEAPONS) {
    act({
      id: `smith-${m.id}-${w.kind}`, skill: 'smithing', name: `${m.name} ${w.name}`, level: Math.min(99, m.level + w.off), interval: 3000, xp: barXp * w.bars,
      inputs: [{ item: `bar-${m.id}`, qty: w.bars }], outputs: [{ item: `${m.id}-${w.kind}`, qty: 1 }], icon: `${w.kind}.metal-${m.id}`, group: m.name,
    });
  }
  for (const p of ARMOUR_PIECES) {
    act({
      id: `smith-${m.id}-${p.kind}`, skill: 'smithing', name: `${m.name} ${p.name}`, level: Math.min(99, m.level + p.off), interval: 3000, xp: barXp * p.bars,
      inputs: [{ item: `bar-${m.id}`, qty: p.bars }], outputs: [{ item: `${m.id}-${p.kind}`, qty: 1 }], icon: `${p.kind}.metal-${m.id}`, group: m.name,
    });
  }
  act({
    id: `smith-${m.id}-arrowheads`, skill: 'smithing', name: `${m.name} Arrowheads`, level: m.level, interval: 3000, xp: barXp,
    inputs: [{ item: `bar-${m.id}`, qty: 1 }], outputs: [{ item: `${m.id}-arrowheads`, qty: 15 }], icon: `arrowhead.metal-${m.id}`, group: m.name,
  });
});

act({ id: 'fletch-shafts', skill: 'fletching', name: 'Arrow Shafts', level: 1, interval: 2000, xp: 5, inputs: [{ item: 'log-normal', qty: 1 }], outputs: [{ item: 'arrow-shafts', qty: 15 }], icon: 'shafts.wood-normal', group: 'Shafts' });
act({ id: 'fletch-shafts-oak', skill: 'fletching', name: 'Arrow Shafts (Oak)', level: 15, interval: 2000, xp: 10, inputs: [{ item: 'log-oak', qty: 1 }], outputs: [{ item: 'arrow-shafts', qty: 30 }], icon: 'shafts.wood-oak', group: 'Shafts' });
WOODS.forEach((w) => {
  const base = Math.round(w.xp * 1.2);
  act({
    id: `fletch-${w.id}-shortbow`, skill: 'fletching', name: item(`${w.id}-shortbow`).name, level: w.level, interval: 3000, xp: base,
    inputs: [{ item: `log-${w.id}`, qty: 1 }, { item: 'bowstring', qty: 1 }], outputs: [{ item: `${w.id}-shortbow`, qty: 1 }], icon: `shortbow.wood-${w.id}`, group: 'Bows',
  });
  act({
    id: `fletch-${w.id}-longbow`, skill: 'fletching', name: item(`${w.id}-longbow`).name, level: Math.min(99, w.level + 5), interval: 3500, xp: Math.round(base * 1.8),
    inputs: [{ item: `log-${w.id}`, qty: 2 }, { item: 'bowstring', qty: 1 }], outputs: [{ item: `${w.id}-longbow`, qty: 1 }], icon: `longbow.wood-${w.id}`, group: 'Bows',
  });
});
METALS.forEach((m) => {
  act({
    id: `fletch-${m.id}-arrows`, skill: 'fletching', name: `${m.name} Arrows`, level: m.level, interval: 2500, xp: Math.round(10 + m.level * 1.5),
    inputs: [{ item: 'arrow-shafts', qty: 15 }, { item: `${m.id}-arrowheads`, qty: 15 }, { item: 'feather', qty: 15 }],
    outputs: [{ item: `${m.id}-arrows`, qty: 15 }], icon: `arrow.metal-${m.id}`, group: 'Arrows',
  });
});

act({ id: 'craft-bowstring', skill: 'crafting', name: 'Spin Bowstring', level: 1, interval: 2000, xp: 4, inputs: [{ item: 'wool', qty: 1 }], outputs: [{ item: 'bowstring', qty: 1 }], icon: 'string.white', group: 'Spinning' });
HIDES.forEach((h) => {
  for (const p of HIDE_PIECES) {
    act({
      id: `craft-${h.id}-${p.kind}`, skill: 'crafting', name: item(`${h.id}-${p.kind}`).name, level: Math.min(99, h.level + p.off), interval: 3000,
      xp: Math.round((10 + h.level * 1.4) * p.hides), inputs: [{ item: h.hide, qty: p.hides }], outputs: [{ item: `${h.id}-${p.kind}`, qty: 1 }],
      icon: item(`${h.id}-${p.kind}`).icon, group: h.name,
    });
  }
});
act({ id: 'craft-silver-ring', skill: 'crafting', name: 'Silver Ring', level: 20, interval: 3000, xp: 30, inputs: [{ item: 'bar-silver', qty: 1 }], outputs: [{ item: 'silver-ring', qty: 1 }], icon: 'ring.metal-silver', group: 'Jewelry' });
act({ id: 'craft-silver-amulet', skill: 'crafting', name: 'Silver Amulet', level: 22, interval: 3000, xp: 34, inputs: [{ item: 'bar-silver', qty: 1 }], outputs: [{ item: 'silver-amulet', qty: 1 }], icon: 'amulet.metal-silver', group: 'Jewelry' });
GEMS.forEach((g) => {
  const lvl = Math.min(99, 5 + g.level);
  act({ id: `craft-ring-${g.id}`, skill: 'crafting', name: item(`ring-${g.id}`).name, level: lvl, interval: 3000, xp: 20 + g.level * 1.5, inputs: [{ item: 'bar-gold', qty: 1 }, { item: `gem-${g.id}`, qty: 1 }], outputs: [{ item: `ring-${g.id}`, qty: 1 }], icon: `ring.gem-${g.id}`, group: 'Jewelry' });
  act({ id: `craft-amulet-${g.id}`, skill: 'crafting', name: item(`amulet-${g.id}`).name, level: Math.min(99, lvl + 3), interval: 3000, xp: 25 + g.level * 1.7, inputs: [{ item: 'bar-gold', qty: 1 }, { item: `gem-${g.id}`, qty: 1 }], outputs: [{ item: `amulet-${g.id}`, qty: 1 }], icon: `amulet.gem-${g.id}`, group: 'Jewelry' });
});

for (const r of RUNES) {
  const inputs: Qty[] = [{ item: 'ore-essence', qty: 1 }];
  if (r.id === 'void') inputs.push({ item: 'void-shard', qty: 1 });
  act({
    id: `rc-${r.id}`, skill: 'runecrafting', name: r.name, level: r.level, interval: 2000, xp: r.xp, inputs,
    outputs: [{ item: `rune-${r.id}`, qty: r.id === 'void' ? 10 : 1 }], bonusPerLevels: r.id === 'void' ? 0 : 12, icon: `rune.rune-${r.id}`, group: 'Runes',
    ...(r.id === 'void' ? { unlock: RIFT } : {}),
  });
}
ELEMENTS.forEach((e, i) => {
  act({
    id: `rc-staff-${e}`, skill: 'runecrafting', name: item(`staff-${e}`).name, level: 10 + i * 5, interval: 4000, xp: 60 + i * 15,
    inputs: [{ item: 'staff', qty: 1 }, { item: `rune-${e}`, qty: 50 }], outputs: [{ item: `staff-${e}`, qty: 1 }], icon: `staff.rune-${e}`, group: 'Staves',
  });
  act({
    id: `rc-battlestaff-${e}`, skill: 'runecrafting', name: item(`battlestaff-${e}`).name, level: 45 + i * 5, interval: 5000, xp: 200 + i * 40,
    inputs: [{ item: `staff-${e}`, qty: 1 }, { item: 'bar-gold', qty: 2 }, { item: `rune-${e}`, qty: 200 }, { item: 'rune-chaos', qty: 30 }],
    outputs: [{ item: `battlestaff-${e}`, qty: 1 }], icon: `battlestaff.rune-${e}`, group: 'Staves',
  });
});
ROBES.forEach((r) => {
  for (const p of ROBE_PIECES) {
    const inputs: Qty[] = [{ item: 'wool', qty: p.wool * 2 }, { item: `rune-${r.rune}`, qty: p.wool * 10 }];
    if (r.id === 'riftweave') inputs.push({ item: 'void-shard', qty: p.wool });
    act({
      id: `rc-${r.id}-${p.kind}`, skill: 'runecrafting', name: item(`${r.id}-${p.kind}`).name, level: Math.min(99, r.level + p.off), interval: 3500,
      xp: Math.round((12 + r.level * 1.3) * p.wool), inputs, outputs: [{ item: `${r.id}-${p.kind}`, qty: 1 }], icon: item(`${r.id}-${p.kind}`).icon, group: `${r.name} Robes`,
      ...(r.id === 'riftweave' ? { unlock: RIFT } : {}),
    });
  }
});

for (const p of POTIONS) {
  act({
    id: `brew-${p.id}`, skill: 'herblore', name: p.name, level: p.level, interval: 3000, xp: Math.round(12 + p.level * 1.6),
    inputs: [{ item: `herb-${p.herb}`, qty: 1 }, { item: p.extra, qty: 1 }], outputs: [{ item: `potion-${p.id}`, qty: 1 }], icon: item(`potion-${p.id}`).icon,
    ...(p.id === 'voidward' ? { unlock: RIFT } : {}),
  });
}

for (const f of FAMILIARS) {
  act({
    id: `summon-${f.id}`, skill: 'summoning', name: `${f.name} Tablet`, level: f.level, interval: 5000, xp: Math.round(10 + f.level * 1.5),
    inputs: [{ item: 'spirit-shard', qty: 6 + Math.floor(f.level / 10) * 2 }, { item: f.mat, qty: 1 }], outputs: [{ item: `tablet-${f.id}`, qty: 10 }],
    icon: item(`tablet-${f.id}`).icon,
  });
}

GEMS.forEach((g) => {
  const lvl = Math.min(99, 1 + g.level);
  act({
    id: `ench-ring-${g.id}`, skill: 'enchantment', name: item(`ering-${g.id}`).name, level: lvl, interval: 3500, xp: 25 + g.level * 2,
    inputs: [{ item: `ring-${g.id}`, qty: 1 }, { item: 'rune-nature', qty: 2 + Math.floor(g.level / 15) }, { item: 'rune-water', qty: 10 }],
    outputs: [{ item: `ering-${g.id}`, qty: 1 }], icon: `ering.gem-${g.id}`, group: 'Jewelry',
  });
  act({
    id: `ench-amulet-${g.id}`, skill: 'enchantment', name: item(`eamulet-${g.id}`).name, level: Math.min(99, lvl + 4), interval: 3500, xp: 30 + g.level * 2.2,
    inputs: [{ item: `amulet-${g.id}`, qty: 1 }, { item: 'rune-nature', qty: 3 + Math.floor(g.level / 15) }, { item: 'rune-earth', qty: 10 }],
    outputs: [{ item: `eamulet-${g.id}`, qty: 1 }], icon: `eamulet.gem-${g.id}`, group: 'Jewelry',
  });
});
for (const m of IMBUE_METALS) {
  const metal = METALS.find((x) => x.id === m)!;
  for (const k of IMBUE_KINDS) {
    for (const e of ELEMENTS) {
      act({
        id: `ench-${m}-${k}-${e}`, skill: 'enchantment', name: item(`${m}-${k}-${e}`).name, level: Math.max(1, metal.level - 5 + ELEMENTS.indexOf(e)),
        interval: 4000, xp: Math.round(30 + metal.level * 2.5),
        inputs: [{ item: `${m}-${k}`, qty: 1 }, { item: `rune-${e}`, qty: 40 + metal.level }, { item: 'rune-nature', qty: 5 }],
        outputs: [{ item: `${m}-${k}-${e}`, qty: 1 }], icon: `${k}.rune-${e}`, group: `${metal.name} weapons`,
      });
    }
  }
}

act({ id: 'beast-trap', skill: 'beastcrafting', name: 'Snare Traps', level: 1, interval: 2500, xp: 6, inputs: [{ item: 'log-oak', qty: 1 }, { item: 'bowstring', qty: 1 }], outputs: [{ item: 'hunting-trap', qty: 5 }], icon: 'trap.brown', group: 'Tools' });
act({ id: 'beast-bait', skill: 'beastcrafting', name: 'Bait Pouches', level: 5, interval: 2500, xp: 8, inputs: [{ item: 'worm', qty: 5 }, { item: 'raw-meat', qty: 1 }], outputs: [{ item: 'bait-pouch', qty: 5 }], icon: 'sack.worm', group: 'Tools' });
act({ id: 'beast-bone-charm', skill: 'beastcrafting', name: 'Bone Charm', level: 8, interval: 3000, xp: 18, inputs: [{ item: 'big-bones', qty: 3 }, { item: 'bowstring', qty: 1 }], outputs: [{ item: 'bone-charm', qty: 1 }], icon: 'amulet.bone', group: 'Charms' });
act({ id: 'beast-antler', skill: 'beastcrafting', name: 'Antler Talisman', level: 32, interval: 3500, xp: 55, inputs: [{ item: 'deer-antler', qty: 3 }, { item: 'bar-silver', qty: 1 }], outputs: [{ item: 'antler-talisman', qty: 1 }], icon: 'amulet.bigbone', group: 'Charms' });
act({ id: 'beast-fang-necklace', skill: 'beastcrafting', name: 'Fang Necklace', level: 62, interval: 4000, xp: 140, inputs: [{ item: 'beast-fang', qty: 20 }, { item: 'dragon-scale', qty: 2 }, { item: 'bar-gold', qty: 1 }], outputs: [{ item: 'fang-necklace', qty: 1 }], icon: 'amulet.dragon', group: 'Charms' });
for (const c of FUR_CAPES) {
  act({
    id: `beast-${c.id}`, skill: 'beastcrafting', name: c.name, level: c.level, interval: 4000, xp: Math.round(20 + c.level * 3),
    inputs: [{ item: c.fur, qty: 6 }, { item: 'bowstring', qty: 2 }], outputs: [{ item: c.id, qty: 1 }], icon: c.icon, group: 'Capes',
  });
}
for (const t of SCALE_TIERS) {
  for (const p of SCALE_PIECES) {
    act({
      id: `beast-${t.id}-${p.kind}`, skill: 'beastcrafting', name: item(`${t.id}-${p.kind}`).name, level: Math.min(99, t.level + (p.kind === 'hauberk' ? 4 : p.kind === 'greaves' ? 2 : 0)),
      interval: 4500, xp: Math.round((30 + t.level * 2) * p.n), inputs: [{ item: t.scale, qty: p.n * 2 }, { item: 'bar-steel', qty: p.n }],
      outputs: [{ item: `${t.id}-${p.kind}`, qty: 1 }], icon: item(`${t.id}-${p.kind}`).icon, group: t.name,
      ...(t.id === 'voidscale' ? { unlock: RIFT } : {}),
    });
  }
}

for (const c of CONSTELLATIONS) {
  act({
    id: `astro-${c.id}`, skill: 'astrology', name: c.name, level: c.level, interval: c.interval, xp: c.xp, inputs: [],
    outputs: [{ item: 'stardust', qty: 1 }], bonusPerLevels: 25, loot: loot(0.012, [['golden-stardust', 1, 1, 1]]), icon: `constellation.${['ember', 'brown', 'blue', 'grey', 'pink', 'green', 'purple', 'fox', 'amber', 'royal'][CONSTELLATIONS.indexOf(c)]}`,
  });
}

const PLANKS = [['normal', 1], ['oak', 10], ['teak', 30], ['mahogany', 50], ['yew', 65]] as const;
for (const [w, lvl] of PLANKS) {
  act({
    id: `con-plank-${w}`, skill: 'construction', name: item(`plank-${w}`).name, level: lvl, interval: 2500, xp: Math.round(6 + lvl * 1.2),
    inputs: [{ item: `log-${w}`, qty: 1 }], outputs: [{ item: `plank-${w}`, qty: 1 }], icon: `plank.wood-${w}`, group: 'Materials',
  });
}
act({ id: 'con-block', skill: 'construction', name: 'Stone Block', level: 5, interval: 3000, xp: 12, inputs: [{ item: 'ore-limestone', qty: 2 }], outputs: [{ item: 'stone-block', qty: 1 }], icon: 'block.ore-limestone', group: 'Materials' });
act({ id: 'con-nails', skill: 'construction', name: 'Iron Nails', level: 12, interval: 2500, xp: 14, inputs: [{ item: 'bar-iron', qty: 1 }], outputs: [{ item: 'nails', qty: 15 }], icon: 'nails.metal-iron', group: 'Materials' });

export { ACTIONS };
export const ACTION = new Map(ACTIONS.map((a) => [a.id, a]));
export const ACTIONS_BY_SKILL: Record<string, SkillAction[]> = {};
for (const a of ACTIONS) (ACTIONS_BY_SKILL[a.skill] ??= []).push(a);

// --- Skillcapes ------------------------------------------------------------------

for (const s of SKILL_LIST) {
  const mods: Record<string, number> = s.kind === 'combat'
    ? { combatXP: 3, [`skillXP:${s.id}`]: 5 }
    : { [`skillXP:${s.id}`]: 5, [`interval:${s.id}`]: 5, [`preserve:${s.id}`]: 5 };
  registerItem({
    id: `skillcape-${s.id}`, name: `${s.name} Cape`, category: 'cape', sell: 0, icon: `skillcape.${s.pal}`, desc: `For those who have reached 99 ${s.name}.`,
    equip: { slot: 'cape', defMelee: 10, defRanged: 10, defMagic: 10, req: { [s.id]: 99 }, mods },
  });
}
registerItem({
  id: 'max-cape', name: 'Cape of Everything', category: 'cape', sell: 0, icon: 'skillcape.royal', desc: 'Every skill at 99.',
  equip: { slot: 'cape', defMelee: 30, defRanged: 30, defMagic: 30, dr: 3, mods: { skillXP: 5, combatXP: 5, gpGain: 5, 'interval:all': 3 } },
});
