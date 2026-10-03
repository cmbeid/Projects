import type { Goal, Mission, Reward } from './types';

const m = (id: string, title: string, text: string, goal: Goal, reward: Reward): Mission => ({ id, title, text, goal, reward });

/**
 * The story: one chain, one mission at a time, top of the shaft to the
 * bottom of the Hollow. The early ones double as the tutorial — most features
 * are switched on by the mission that introduces them.
 */
export const STORY: readonly Mission[] = [
  // --- Topsoil ---------------------------------------------------------------
  m('first-light', 'First Light', 'Lamp lit. Pick in hand. Tap the rock face.', { kind: 'breaks', n: 5 }, { coins: 15, unlock: ['upgrades'] }),
  m('sharpen-up', 'Sharpen Up', 'This pick is blunter than my uncle. Sharpen it.', { kind: 'upgrade', id: 'sharpen', n: 3 }, { coins: 30 }),
  m('down', 'Down We Go', 'Every ten blocks the rock gives up a seam. Break it, and the shaft goes deeper.', { kind: 'depth', n: 3 }, { coins: 60, unlock: ['drones'] }),
  m('help', 'A Little Help', 'Found a crate of old drones. They still hum.', { kind: 'own', id: 'drone', n: 2 }, { xp: 30, unlock: ['miner'] }),
  m('know', 'Know Thyself', 'Put your points somewhere. Strength hits harder; luck finds gems.', { kind: 'stats', n: 3 }, { coins: 80 }),
  m('copper', 'Copper Vein', 'Copper, and plenty of it. Somebody built a furnace down here.', { kind: 'mine', ore: 'copper', n: 30 }, { coins: 100, unlock: ['refinery'] }),
  m('smelt', 'Smelt', 'Eight ore to a bar. The furnace remembers how.', { kind: 'refine', n: 4 }, { coins: 100, unlock: ['workbench'] }),
  m('tools', 'Tools of the Trade', 'A copper pick. Better than this thing.', { kind: 'craft', n: 1, recipe: 'c-copper-pick' }, { xp: 80, unlock: ['power'] }),
  m('strike', 'Strike True', 'Gather yourself, and swing like you mean it.', { kind: 'skill', n: 3, skill: 'power' }, { coins: 250 }),
  m('hive', 'Hive', 'The drones like company.', { kind: 'own', id: 'drone', n: 10 }, { coins: 400 }),
  m('glitter', 'Glitter', 'Something catches the lamplight.', { kind: 'gems', n: 3 }, { coins: 500, consumables: [{ id: 'luckbrew', n: 1 }] }),
  m('deeper', 'Deeper Still', 'The props stop at depth ten. Nobody went past.', { kind: 'depth', n: 10 }, { coins: 1500, unlock: ['rig'] }),
  m('machinery', 'Heavy Machinery', 'Someone left a drill rig. Rusted, but it turns.', { kind: 'own', id: 'rig', n: 1 }, { xp: 300 }),
  m('iron', 'Iron Will', 'Iron, finally. Coal to burn it with.', { kind: 'mine', ore: 'iron', n: 60 }, { coins: 3000, unlock: ['passives'] }),
  m('bronze', 'Bronze Age', 'Copper and tin, five and three.', { kind: 'craft', n: 1, recipe: 'c-bronze-pick' }, { coins: 4000 }),
  m('seam', 'The Seam Below', 'The rock is getting warm. Soft, almost.', { kind: 'depth', n: 20 }, { coins: 20_000, consumables: [{ id: 'dynamite', n: 5 }] }),

  // --- Fungal ------------------------------------------------------------------
  m('spores', 'Spores', 'The drones are coughing. That should not be possible.', { kind: 'depth', n: 21 }, { coins: 30_000 }),
  m('clean-air', 'Clean Air', 'Silver mesh and mycelite: filters for the machines.', { kind: 'fixture', id: 'filters' }, { xp: 4000 }),
  m('silver', 'Silver Lining', 'Silver runs here like roots.', { kind: 'mine', ore: 'silver', n: 150 }, { coins: 60_000 }),
  m('dowsing', 'Dowsing', 'I can feel where the gems are, if I hold still.', { kind: 'level', n: 18 }, { unlock: ['dowse'], coins: 50_000 }),
  m('rod', 'Divining Rod', 'Try it.', { kind: 'skill', n: 2, skill: 'dowse' }, { coins: 80_000, unlock: ['contracts'] }),
  m('mycelium', 'Mycelium', 'It grows back where I mined it.', { kind: 'mine', ore: 'mycelite', n: 200 }, { coins: 120_000 }),
  m('cobalt', 'Cobalt Blue', 'A pick that does not bend.', { kind: 'craft', n: 1, recipe: 'c-cobalt-pick' }, { xp: 20_000 }),
  m('gloom', 'Into the Gloom', 'At depth thirty I heard it. A long, slow breath. Below.', { kind: 'depth', n: 30 }, { coins: 400_000, unlock: ['descent'] }),
  m('frenzy', 'Frenzy', 'Some days I swing until my arms go numb.', { kind: 'depth', n: 36 }, { unlock: ['frenzy'], coins: 600_000 }),
  m('excavation', 'Excavation', 'More rigs. A whole line of them.', { kind: 'own', id: 'rig', n: 15 }, { unlock: ['excavator'], coins: 1e6 }),
  m('light-seam', 'Seam of Light', 'The rock below is glowing.', { kind: 'depth', n: 50 }, { coins: 5e6 }),

  // --- Crystal -----------------------------------------------------------------
  m('prisms', 'Prisms', 'It sings when I strike it.', { kind: 'depth', n: 51 }, { coins: 1e7 }),
  m('shatter', 'Shatter', 'A clean crit breaks the crystal into twice the ore.', { kind: 'breaks', n: 400 }, { coins: 2e7 }),
  m('gold', 'Gold Fever', 'Gold. I laughed out loud, and something laughed back.', { kind: 'mine', ore: 'gold', n: 500 }, { coins: 4e7 }),
  m('lightbearer', 'Lightbearer', 'A lantern of crystal and gold, for what is below.', { kind: 'craft', n: 1, recipe: 'c-crystal-lantern' }, { xp: 2e6 }),
  m('echoes', 'Echoes', 'Collapse the shaft. Start again, and remember.', { kind: 'descend', n: 1 }, { coins: 1e5, consumables: [{ id: 'sagebrew', n: 2 }] }),
  m('furnace-heart', 'Furnace Heart', 'The walls are hot to the touch.', { kind: 'depth', n: 90 }, { coins: 1e10 }),

  // --- Magma ---------------------------------------------------------------------
  m('heat', 'Heat', 'My arms are slow. The machines are slower.', { kind: 'depth', n: 91 }, { coins: 2e10 }),
  m('coolant', 'Coolant', 'Titanium lines, sapphire valves.', { kind: 'fixture', id: 'coolant' }, { xp: 1e8 }),
  m('fireproof', 'Fireproof', 'Obsidian mail. Heavy, and cool on the inside.', { kind: 'craft', n: 1, recipe: 'c-ember-mail' }, { coins: 5e10 }),
  m('obsidian', 'Obsidian Mind', 'Black glass. My reflection is a beat behind.', { kind: 'mine', ore: 'obsidian', n: 2000 }, { coins: 1e11 }),
  m('edge', 'Edge of the Hollow', 'Past the magma there is nothing. Just dark.', { kind: 'depth', n: 140 }, { coins: 1e13 }),

  // --- The Hollow ----------------------------------------------------------------
  m('hollow', 'The Hollow', 'No strata here. Only the dark, and the breathing, closer now.', { kind: 'depth', n: 141 }, { coins: 2e13 }),
  m('glyphs', 'Glyphs', 'Writing, in the stone. Not carved; grown.', { kind: 'mine', ore: 'glyphstone', n: 1000 }, { coins: 5e13 }),
  m('starmetal', 'Starmetal', 'Metal that fell, a long time ago, from somewhere far.', { kind: 'craft', n: 1, recipe: 'c-starmetal-pick' }, { xp: 1e12 }),
  m('below', 'What Breathes Below', 'Depth two hundred. It is not hostile. It is only very old, and it was dreaming, and it has noticed you.', { kind: 'depth', n: 200 }, { coins: 1e16 }),
];

export const STORY_BY_ID: ReadonlyMap<string, Mission> = new Map(STORY.map((s) => [s.id, s]));

/** The kinds of goal a daily contract can draw from. */
export const CONTRACT_KINDS = ['breaks', 'mine', 'gems', 'earn', 'refine', 'craft', 'skill'] as const;
