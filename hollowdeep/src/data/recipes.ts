import type { ConsumableId, CraftRecipe, FixtureId, RefineRecipe } from './types';

/** Ore into bars. These run on a timer in the refinery, offline included. */
export const REFINE: readonly RefineRecipe[] = [
  { id: 'r-copper', output: 'copper-bar', inputs: [{ id: 'copper', n: 8 }], seconds: 3, requires: { depth: 1 } },
  { id: 'r-bronze', output: 'bronze-bar', inputs: [{ id: 'copper', n: 5 }, { id: 'tin', n: 3 }], seconds: 4, requires: { depth: 1 } },
  { id: 'r-iron', output: 'iron-bar', inputs: [{ id: 'iron', n: 6 }, { id: 'coal', n: 4 }], seconds: 5, requires: { depth: 5 } },
  { id: 'r-silver', output: 'silver-bar', inputs: [{ id: 'silver', n: 8 }], seconds: 6, requires: { depth: 21 } },
  { id: 'r-cobalt', output: 'cobalt-bar', inputs: [{ id: 'cobalt', n: 6 }, { id: 'mycelite', n: 4 }], seconds: 8, requires: { depth: 21 } },
  { id: 'r-gold', output: 'gold-bar', inputs: [{ id: 'gold', n: 8 }], seconds: 9, requires: { depth: 51 } },
  { id: 'r-platinum', output: 'platinum-bar', inputs: [{ id: 'platinum', n: 6 }, { id: 'crystalite', n: 4 }], seconds: 11, requires: { depth: 51 } },
  { id: 'r-obsidian', output: 'obsidian-plate', inputs: [{ id: 'obsidian', n: 10 }], seconds: 12, requires: { depth: 91 } },
  { id: 'r-titanium', output: 'titanium-bar', inputs: [{ id: 'titanium', n: 6 }, { id: 'cinnabar', n: 4 }], seconds: 14, requires: { depth: 91 } },
  { id: 'r-starmetal', output: 'starmetal-bar', inputs: [{ id: 'starmetal', n: 6 }, { id: 'glyphstone', n: 4 }], seconds: 16, requires: { depth: 141 } },
  { id: 'r-voidsteel', output: 'voidsteel-bar', inputs: [{ id: 'voidglass', n: 6 }, { id: 'whisperite', n: 2 }], seconds: 18, requires: { depth: 141 } },
];

const gear = (id: string, base: string, coins: number, depth: number, ...inputs: [string, number][]): CraftRecipe => ({
  id,
  output: { kind: 'gear', base },
  inputs: inputs.map(([i, n]) => ({ id: i, n })),
  coins,
  requires: { depth },
});

const consumable = (id: string, item: ConsumableId, n: number, coins: number, depth: number, ...inputs: [string, number][]): CraftRecipe => ({
  id,
  output: { kind: 'consumable', id: item, n },
  inputs: inputs.map(([i, k]) => ({ id: i, n: k })),
  coins,
  requires: { depth },
});

const fixture = (id: string, item: FixtureId, coins: number, depth: number, ...inputs: [string, number][]): CraftRecipe => ({
  id,
  output: { kind: 'fixture', id: item },
  inputs: inputs.map(([i, n]) => ({ id: i, n })),
  coins,
  requires: { depth },
});

/** Everything made at the workbench: gear, consumables and one-off fixtures. */
export const CRAFT: readonly CraftRecipe[] = [
  // Picks
  gear('c-copper-pick', 'copper-pick', 40, 1, ['copper-bar', 4]),
  gear('c-bronze-pick', 'bronze-pick', 300, 4, ['bronze-bar', 8], ['quartz', 2]),
  gear('c-iron-pick', 'iron-pick', 2500, 10, ['iron-bar', 12], ['loam-heart', 1]),
  gear('c-cobalt-pick', 'cobalt-pick', 60_000, 24, ['cobalt-bar', 12], ['jade', 2], ['spore-heart', 1]),
  gear('c-crystal-pick', 'crystal-pick', 4e6, 55, ['platinum-bar', 12], ['amethyst', 3], ['prism-heart', 1]),
  gear('c-titanium-pick', 'titanium-pick', 3e8, 95, ['titanium-bar', 12], ['ruby', 2], ['ember-heart', 1]),
  gear('c-starmetal-pick', 'starmetal-pick', 4e10, 145, ['starmetal-bar', 12], ['pale-pearl', 2], ['hollow-heart', 1]),

  // Lanterns
  gear('c-miners-lamp', 'miners-lamp', 150, 3, ['bronze-bar', 3], ['quartz', 1]),
  gear('c-silver-lantern', 'silver-lantern', 20_000, 22, ['silver-bar', 6], ['moonstone', 1]),
  gear('c-crystal-lantern', 'crystal-lantern', 2e6, 53, ['gold-bar', 8], ['sapphire', 2]),
  gear('c-ember-lantern', 'ember-lantern', 1.5e8, 93, ['titanium-bar', 8], ['sunstone', 2]),
  gear('c-pale-lantern', 'pale-lantern', 2e10, 143, ['voidsteel-bar', 8], ['pale-pearl', 2]),

  // Armour
  gear('c-work-jacket', 'work-jacket', 60, 2, ['copper-bar', 3]),
  gear('c-iron-mail', 'iron-mail', 3000, 12, ['iron-bar', 10]),
  gear('c-spore-cloak', 'spore-cloak', 80_000, 26, ['silver-bar', 8], ['mycelite', 60], ['spore-heart', 1]),
  gear('c-crystal-plate', 'crystal-plate', 5e6, 57, ['platinum-bar', 10], ['crystalite', 80]),
  gear('c-ember-mail', 'ember-mail', 2e8, 91, ['obsidian-plate', 10], ['titanium', 30], ['ember-heart', 1]),
  gear('c-hollow-shroud', 'hollow-shroud', 3e10, 147, ['voidsteel-bar', 10], ['hollow-heart', 1]),

  // Charms
  gear('c-amber-charm', 'amber-charm', 200, 4, ['amber', 3], ['copper-bar', 2]),
  gear('c-jade-charm', 'jade-charm', 40_000, 23, ['jade', 3], ['silver-bar', 3]),
  gear('c-amethyst-charm', 'amethyst-charm', 3e6, 56, ['amethyst', 3], ['gold-bar', 4]),
  gear('c-ruby-charm', 'ruby-charm', 2.5e8, 94, ['ruby', 3], ['titanium-bar', 4]),
  gear('c-dream-charm', 'dream-charm', 3e10, 146, ['dreamstone', 3], ['starmetal-bar', 4]),

  // Consumables
  consumable('c-dynamite', 'dynamite', 3, 50, 2, ['coal', 30], ['copper', 5]),
  consumable('c-tonic', 'tonic', 2, 80, 3, ['amber', 1], ['coal', 15]),
  consumable('c-luckbrew', 'luckbrew', 1, 400, 6, ['quartz', 3], ['tin', 20]),
  consumable('c-sagebrew', 'sagebrew', 1, 15_000, 22, ['jade', 1], ['mycelite', 30]),

  // Fixtures
  fixture('c-furnace2', 'furnace2', 1500, 8, ['bronze-bar', 6], ['iron-bar', 6]),
  fixture('c-chute', 'chute', 4000, 14, ['iron-bar', 15], ['loam-heart', 1]),
  fixture('c-filters', 'filters', 30_000, 21, ['silver-bar', 10], ['mycelite', 20]),
  fixture('c-workshop', 'workshop', 120_000, 28, ['cobalt-bar', 10], ['spore-heart', 2]),
  fixture('c-furnace3', 'furnace3', 300_000, 32, ['cobalt-bar', 8], ['silver-bar', 12]),
  fixture('c-lens', 'lens', 8e6, 58, ['gold-bar', 10], ['amethyst', 3], ['prism-heart', 1]),
  fixture('c-coolant', 'coolant', 1e8, 91, ['titanium-bar', 10], ['sapphire', 4]),
];

export const REFINE_BY_ID: ReadonlyMap<string, RefineRecipe> = new Map(REFINE.map((r) => [r.id, r]));
export const CRAFT_BY_ID: ReadonlyMap<string, CraftRecipe> = new Map(CRAFT.map((r) => [r.id, r]));

export interface ConsumableDef {
  id: ConsumableId;
  name: string;
  text: string;
}

export const CONSUMABLES: readonly ConsumableDef[] = [
  { id: 'dynamite', name: 'Dynamite', text: 'Deals 60× your tap damage to the rock face in one go.' },
  { id: 'tonic', name: 'Stamina Tonic', text: 'Refills your stamina.' },
  { id: 'luckbrew', name: 'Lucky Brew', text: '+40 luck for 3 minutes.' },
  { id: 'sagebrew', name: 'Sage Brew', text: 'Double XP for 5 minutes.' },
];

export interface FixtureDef {
  id: FixtureId;
  name: string;
  text: string;
}

export const FIXTURES: readonly FixtureDef[] = [
  { id: 'furnace2', name: 'Second Furnace', text: 'The refinery smelts two batches at once.' },
  { id: 'chute', name: 'Ore Chute', text: 'Common ore sells itself the moment it is mined. Gems, bars and hearts are kept.' },
  { id: 'filters', name: 'Spore Filters', text: 'Your machines breathe freely in the Fungal Caverns.' },
  { id: 'workshop', name: 'Drone Workshop', text: 'Every drone works twice as hard.' },
  { id: 'furnace3', name: 'Third Furnace', text: 'A third refinery slot.' },
  { id: 'lens', name: 'Echo Lens', text: '+15% Echoes from every Descent.' },
  { id: 'coolant', name: 'Coolant Lines', text: 'Your machines run at full speed in the Magma Veins.' },
];
