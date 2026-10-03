import type { GearBase, Slot, StatKey } from './types';

/**
 * Crafted equipment, one row per base. A crafted piece also rolls up to two
 * random affixes — see `AFFIXES` — so two Iron Picks are not always equal.
 *
 * `dmgPct` multiplies tap damage by (1 + dmgPct / 100). The pick is the
 * single biggest lever on tap damage, which is the point: the way through
 * hard rock is to go back to the anvil.
 */
export const GEAR: readonly GearBase[] = [
  { id: 'copper-pick', name: 'Copper Pick', slot: 'pick', tier: 1, tint: 'copper-bar', stats: { dmgPct: 60 } },
  { id: 'bronze-pick', name: 'Bronze Pick', slot: 'pick', tier: 2, tint: 'bronze-bar', stats: { dmgPct: 150, critChance: 2 } },
  { id: 'iron-pick', name: 'Iron Pick', slot: 'pick', tier: 3, tint: 'iron-bar', stats: { dmgPct: 350, critChance: 3 } },
  { id: 'cobalt-pick', name: 'Cobalt Pick', slot: 'pick', tier: 4, tint: 'cobalt-bar', stats: { dmgPct: 900, critChance: 4 } },
  { id: 'crystal-pick', name: 'Crystal Pick', slot: 'pick', tier: 5, tint: 'crystalite', stats: { dmgPct: 2400, critMult: 0.5 } },
  { id: 'titanium-pick', name: 'Titanium Pick', slot: 'pick', tier: 6, tint: 'titanium-bar', stats: { dmgPct: 7000, critMult: 0.8 } },
  { id: 'starmetal-pick', name: 'Starmetal Pick', slot: 'pick', tier: 7, tint: 'starmetal-bar', stats: { dmgPct: 22000, critMult: 1.2 } },

  { id: 'miners-lamp', name: "Miner's Lamp", slot: 'lantern', tier: 1, tint: 'bronze-bar', stats: { light: 1, luck: 3 } },
  { id: 'silver-lantern', name: 'Silver Lantern', slot: 'lantern', tier: 3, tint: 'silver-bar', stats: { light: 2, luck: 6, xpPct: 10 } },
  { id: 'crystal-lantern', name: 'Crystal Lantern', slot: 'lantern', tier: 5, tint: 'gold-bar', stats: { light: 3, luck: 12, xpPct: 15 } },
  { id: 'ember-lantern', name: 'Ember Lantern', slot: 'lantern', tier: 6, tint: 'titanium-bar', stats: { light: 4, luck: 20, xpPct: 20 } },
  { id: 'pale-lantern', name: 'Pale Lantern', slot: 'lantern', tier: 7, tint: 'voidsteel-bar', stats: { light: 5, luck: 35, xpPct: 30 } },

  { id: 'work-jacket', name: 'Work Jacket', slot: 'armor', tier: 1, tint: 'copper-bar', stats: { stamina: 20 } },
  { id: 'iron-mail', name: 'Iron Mail', slot: 'armor', tier: 3, tint: 'iron-bar', stats: { stamina: 40, autoPct: 10 } },
  { id: 'spore-cloak', name: 'Spore Cloak', slot: 'armor', tier: 4, tint: 'mycelite', stats: { stamina: 60, autoPct: 25 } },
  { id: 'crystal-plate', name: 'Crystal Plate', slot: 'armor', tier: 5, tint: 'platinum-bar', stats: { stamina: 90, autoPct: 50 } },
  { id: 'ember-mail', name: 'Ember Mail', slot: 'armor', tier: 6, tint: 'obsidian-plate', stats: { heatRes: 1, stamina: 120, autoPct: 80 } },
  { id: 'hollow-shroud', name: 'Hollow Shroud', slot: 'armor', tier: 7, tint: 'voidsteel-bar', stats: { heatRes: 1, stamina: 160, autoPct: 150 } },

  { id: 'amber-charm', name: 'Amber Charm', slot: 'charm', tier: 1, tint: 'amber', stats: { luck: 5, xpPct: 10 } },
  { id: 'jade-charm', name: 'Jade Charm', slot: 'charm', tier: 3, tint: 'jade', stats: { luck: 10, orePct: 15 } },
  { id: 'amethyst-charm', name: 'Amethyst Charm', slot: 'charm', tier: 5, tint: 'amethyst', stats: { critChance: 6, critMult: 1, luck: 15 } },
  { id: 'ruby-charm', name: 'Ruby Charm', slot: 'charm', tier: 6, tint: 'ruby', stats: { dmgPct: 100, critMult: 1.5 } },
  { id: 'dream-charm', name: 'Dreamstone Charm', slot: 'charm', tier: 7, tint: 'dreamstone', stats: { luck: 40, orePct: 50, xpPct: 50 } },
];

export const GEAR_BASE: ReadonlyMap<string, GearBase> = new Map(GEAR.map((g) => [g.id, g]));

/** Which affixes each slot can roll, and how big one gets at a given tier. */
export const AFFIXES: Record<Slot, readonly StatKey[]> = {
  pick: ['dmgPct', 'critChance', 'critMult'],
  lantern: ['luck', 'xpPct', 'orePct'],
  armor: ['stamina', 'autoPct', 'xpPct'],
  charm: ['luck', 'critChance', 'orePct', 'autoPct'],
};

/** The top of an affix's roll at `tier`; a roll lands between half and all of it. */
export function affixMax(stat: StatKey, tier: number): number {
  switch (stat) {
    case 'dmgPct': return 15 * tier ** 1.8;
    case 'critChance': return 1 + tier * 0.6;
    case 'critMult': return 0.12 * tier;
    case 'luck': return 2.5 * tier;
    case 'xpPct': return 6 * tier;
    case 'orePct': return 5 * tier;
    case 'autoPct': return 10 * tier ** 1.5;
    case 'stamina': return 10 * tier;
    case 'light':
    case 'heatRes':
      return 0;
  }
}

export const STAT_LABEL: Record<StatKey, string> = {
  dmgPct: 'Tap damage',
  critChance: 'Crit chance',
  critMult: 'Crit damage',
  luck: 'Luck',
  light: 'Light',
  heatRes: 'Heat-proof',
  stamina: 'Stamina',
  autoPct: 'Machine output',
  xpPct: 'XP',
  orePct: 'Ore yield',
};

export function formatStat(stat: StatKey, value: number): string {
  switch (stat) {
    case 'dmgPct':
    case 'autoPct':
    case 'xpPct':
    case 'orePct':
      return `+${Math.round(value)}%`;
    case 'critChance':
      return `+${value.toFixed(1)}%`;
    case 'critMult':
      return `+${Math.round(value * 100)}%`;
    case 'heatRes':
      return 'yes';
    default:
      return `+${Math.round(value)}`;
  }
}
