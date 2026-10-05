import type { RegaliaBase, Slot, StatKey } from './types';

/**
 * The Founder's regalia, one row per base, made at the Drafting Hall. A new
 * piece also rolls up to two random affixes — see `AFFIXES` — so two Iron
 * Chains are not always equal.
 *
 * The chain of office is the biggest lever on tap damage: the way through a
 * heavy ruin is to go back to the drafting table.
 */
export const REGALIA: readonly RegaliaBase[] = [
  // Chains of office: the work you can do with your own hands.
  { id: 'rope-chain', name: 'Rope Chain', slot: 'chain', tier: 1, tint: 'planks', stats: { dmgPct: 60 } },
  { id: 'brick-chain', name: 'Mason’s Chain', slot: 'chain', tier: 2, tint: 'bricks', stats: { dmgPct: 150, critChance: 2 } },
  { id: 'iron-chain', name: 'Iron Chain', slot: 'chain', tier: 3, tint: 'ironwork', stats: { dmgPct: 350, critChance: 3 } },
  { id: 'copper-chain', name: 'Copper Chain', slot: 'chain', tier: 4, tint: 'copperwork', stats: { dmgPct: 900, critChance: 4 } },
  { id: 'gilt-chain', name: 'Gilt Chain', slot: 'chain', tier: 5, tint: 'gilt-mirror', stats: { dmgPct: 2400, critMult: 0.5 } },
  { id: 'steel-chain', name: 'Steel Chain', slot: 'chain', tier: 6, tint: 'steel', stats: { dmgPct: 7000, critMult: 0.8 } },
  { id: 'marble-chain', name: 'Marble Chain', slot: 'chain', tier: 7, tint: 'marble-block', stats: { dmgPct: 22000, critMult: 1.2 } },

  // Lanterns: light for the Spire's fog, and luck for relics.
  { id: 'tin-lantern', name: 'Tin Lantern', slot: 'lantern', tier: 1, tint: 'ironwork', stats: { light: 1, luck: 3 } },
  { id: 'harbour-lantern', name: 'Harbour Lantern', slot: 'lantern', tier: 3, tint: 'copperwork', stats: { light: 2, luck: 6, xpPct: 10 } },
  { id: 'guild-lantern', name: 'Guild Lantern', slot: 'lantern', tier: 5, tint: 'silkwork', stats: { light: 3, luck: 12, xpPct: 15 } },
  { id: 'furnace-lantern', name: 'Furnace Lantern', slot: 'lantern', tier: 6, tint: 'panes', stats: { light: 4, luck: 20, xpPct: 20 } },
  { id: 'lumen-lantern', name: 'Lumen Lantern', slot: 'lantern', tier: 7, tint: 'lumen', stats: { light: 5, luck: 35, xpPct: 30 } },

  // Coats: resolve, and the crews' confidence in you.
  { id: 'work-coat', name: 'Work Coat', slot: 'coat', tier: 1, tint: 'canvas', stats: { resolve: 20 } },
  { id: 'oilskin', name: 'Oilskin', slot: 'coat', tier: 3, tint: 'canvas', stats: { resolve: 40, crewPct: 10 } },
  { id: 'reeve-coat', name: 'Reeve’s Coat', slot: 'coat', tier: 4, tint: 'copperwork', stats: { resolve: 60, crewPct: 25 } },
  { id: 'silk-robe', name: 'Silk Robe', slot: 'coat', tier: 5, tint: 'silkwork', stats: { resolve: 90, crewPct: 50 } },
  { id: 'sealed-coat', name: 'Sealed Coat', slot: 'coat', tier: 6, tint: 'steel', stats: { smogRes: 1, resolve: 120, crewPct: 80 } },
  { id: 'white-mantle', name: 'White Mantle', slot: 'coat', tier: 7, tint: 'marble-block', stats: { smogRes: 1, resolve: 160, crewPct: 150 } },

  // Seals: the town's trust, which is to say its money.
  { id: 'clay-seal', name: 'Clay Seal', slot: 'seal', tier: 1, tint: 'clay', stats: { luck: 5, taxPct: 10 } },
  { id: 'pearl-seal', name: 'Pearl Seal', slot: 'seal', tier: 3, tint: 'pearl', stats: { luck: 10, salvagePct: 15 } },
  { id: 'guild-seal-r', name: 'Guildmaster’s Seal', slot: 'seal', tier: 5, tint: 'guild-seal', stats: { critChance: 6, taxPct: 40, luck: 15 } },
  { id: 'watch-seal', name: 'Clockwork Seal', slot: 'seal', tier: 6, tint: 'pocket-watch', stats: { dmgPct: 100, critMult: 1.5 } },
  { id: 'moon-seal', name: 'Moonpearl Seal', slot: 'seal', tier: 7, tint: 'moonpearl', stats: { luck: 40, salvagePct: 50, xpPct: 50 } },

  // Sidegrades: same tier as the main line, different strengths.
  { id: 'sledge', name: 'Sledge Chain', slot: 'chain', tier: 4, tint: 'wire', stats: { dmgPct: 650, critChance: 8, critMult: 0.6 } },
  { id: 'counting-seal', name: 'Counting-House Seal', slot: 'seal', tier: 4, tint: 'ships-bell', stats: { taxPct: 60, luck: 6 } },
  { id: 'brass-chain', name: 'Brass Chain', slot: 'chain', tier: 6, tint: 'brass', stats: { dmgPct: 5200, critChance: 10, critMult: 1.4 } },
  { id: 'ledger-seal', name: 'Ledger Seal', slot: 'seal', tier: 6, tint: 'ledger', stats: { crewPct: 150, taxPct: 80 } },
  { id: 'glass-lantern', name: 'Sea-Glass Lantern', slot: 'lantern', tier: 7, tint: 'sea-glass', stats: { light: 5, salvagePct: 60, luck: 20 } },
  { id: 'star-coat', name: 'Starstone Coat', slot: 'coat', tier: 7, tint: 'starstone', stats: { smogRes: 1, resolve: 200, crewPct: 220 } },
  { id: 'choir-seal', name: 'Choir Seal', slot: 'seal', tier: 7, tint: 'choir-shard', stats: { crewPct: 300, taxPct: 120 } },

  // The Founders' set: what the first city's founders wore, found at the very top.
  { id: 'founders-chain', name: 'Founders’ Chain', slot: 'chain', tier: 8, tint: 'spire-key', stats: { dmgPct: 70000, critChance: 10, critMult: 2 } },
  { id: 'founders-lantern', name: 'Founders’ Lantern', slot: 'lantern', tier: 8, tint: 'lumen', stats: { light: 6, luck: 60, xpPct: 60, salvagePct: 80 } },
  { id: 'founders-coat', name: 'Founders’ Mantle', slot: 'coat', tier: 8, tint: 'starstone', stats: { smogRes: 1, resolve: 260, crewPct: 450 } },
  { id: 'founders-seal', name: 'Founders’ Seal', slot: 'seal', tier: 8, tint: 'moonpearl', stats: { dmgPct: 300, taxPct: 200, salvagePct: 100 } },
];

export const REGALIA_BASE: ReadonlyMap<string, RegaliaBase> = new Map(REGALIA.map((g) => [g.id, g]));

/** Which affixes each slot can roll, and how big one gets at a given tier. */
export const AFFIXES: Record<Slot, readonly StatKey[]> = {
  chain: ['dmgPct', 'critChance', 'critMult'],
  lantern: ['luck', 'xpPct', 'salvagePct'],
  coat: ['resolve', 'crewPct', 'xpPct'],
  seal: ['luck', 'taxPct', 'salvagePct', 'crewPct'],
};

/** The top of an affix's roll at `tier`; a roll lands between half and all of it. */
export function affixMax(stat: StatKey, tier: number): number {
  switch (stat) {
    case 'dmgPct': return 15 * tier ** 1.8;
    case 'critChance': return 1 + tier * 0.6;
    case 'critMult': return 0.12 * tier;
    case 'luck': return 2.5 * tier;
    case 'xpPct': return 6 * tier;
    case 'salvagePct': return 5 * tier;
    case 'crewPct': return 10 * tier ** 1.5;
    case 'taxPct': return 8 * tier ** 1.4;
    case 'resolve': return 10 * tier;
    case 'light':
    case 'smogRes':
      return 0;
  }
}

export const STAT_LABEL: Record<StatKey, string> = {
  dmgPct: 'Tap power',
  critChance: 'Crit chance',
  critMult: 'Crit power',
  luck: 'Luck',
  light: 'Light',
  smogRes: 'Smog-sealed',
  resolve: 'Resolve',
  crewPct: 'Crew output',
  xpPct: 'XP',
  salvagePct: 'Salvage',
  taxPct: 'Taxes',
};

export function formatStat(stat: StatKey, value: number): string {
  switch (stat) {
    case 'dmgPct':
    case 'crewPct':
    case 'xpPct':
    case 'salvagePct':
    case 'taxPct':
      return `+${Math.round(value)}%`;
    case 'critChance':
      return `+${value.toFixed(1)}%`;
    case 'critMult':
      return `+${Math.round(value * 100)}%`;
    case 'smogRes':
      return 'yes';
    default:
      return `+${Math.round(value)}`;
  }
}
