import type { Goal, Mission, Reward } from './types';

const m = (id: string, title: string, text: string, goal: Goal, reward: Reward, extra: Partial<Mission> = {}): Mission => ({
  id,
  title,
  text,
  goal,
  reward,
  ...extra,
});

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
  m('letter', 'A Letter', 'Pinned under a stone at depth ninety-one, a letter in handwriting I know. It says only: go back up and look at the props.', { kind: 'visit', depth: 1 }, { coins: 3e10, flag: 'remembered' }, {
    scene: [
      'The props at the top of the shaft are older than I thought. The wood has gone grey, and hard as bone.',
      'Every one of them is carved with the same two initials. Some are fresh. Some are worn almost smooth.',
      'They are mine. I carved the newest one this morning, I think. I do not remember doing it.',
    ],
  }),
  m('coolant', 'Coolant', 'Titanium lines, sapphire valves.', { kind: 'fixture', id: 'coolant' }, { xp: 1e8 }),
  m('cinnabar', 'Red Earth', 'Cinnabar. Quicksilver in the stone. The old miners went mad from it. Maybe that is all this is.', { kind: 'mine', ore: 'cinnabar', n: 1500 }, { coins: 4e10 }),
  m('tally', 'The Tally', 'Each time the shaft comes down, I keep a little more. I have started counting.', { kind: 'echoes', n: 150 }, { xp: 5e8 }, {
    scene: [
      'I scratch a mark on the lamp for every Descent.',
      'Tonight I counted them. There are more marks on it than I have made.',
    ],
  }),
  m('fireproof', 'Fireproof', 'Obsidian mail. Heavy, and cool on the inside.', { kind: 'craft', n: 1, recipe: 'c-ember-mail' }, { coins: 5e10 }),
  m('obsidian', 'Obsidian Mind', 'Black glass. My reflection is a beat behind.', { kind: 'mine', ore: 'obsidian', n: 2000 }, { coins: 1e11 }),
  m('rhythm', 'In Rhythm', 'Keep the seam buried and just dig a while. Listen.', { kind: 'farm', n: 300 }, { coins: 2e11, flag: 'other-miner' }, {
    scene: [
      'Somewhere on the other side of the rock, someone else is digging.',
      'Their pick falls when mine falls. When I stop, they stop.',
      'I said hello. The rock said hello back, a beat late, in my voice.',
    ],
  }),
  m('edge', 'Edge of the Hollow', 'Past the magma there is nothing. Just dark.', { kind: 'depth', n: 140 }, { coins: 1e13 }),

  // --- The Hollow ----------------------------------------------------------------
  m('hollow', 'The Hollow', 'No strata here. Only the dark, and the breathing, closer now.', { kind: 'depth', n: 141 }, { coins: 2e13 }),
  m('lamp-ahead', 'A Lamp Ahead', 'There is a light down there in the dark, a long way below me. A miner\'s lamp.', { kind: 'depth', n: 150 }, { coins: 5e13, flag: 'lamp-ahead' }, {
    scene: [
      'It moves when I move. It rests when I rest.',
      'I raised my lamp and swung it, slowly, side to side.',
      'Far below, the other lamp swung back.',
    ],
  }),
  m('glyphs', 'Glyphs', 'Writing, in the stone. Not carved; grown.', { kind: 'mine', ore: 'glyphstone', n: 1000 }, { coins: 5e13 }),
  m('handwriting', 'Handwriting', 'The glyphs are not a language. They are instructions for a lantern.', { kind: 'craft', n: 1, recipe: 'c-pale-lantern' }, { xp: 3e12 }, {
    scene: [
      'I built the lantern exactly as the glyphs said.',
      'Only afterwards did I recognise the hand that grew them into the stone. The loops of the letters. The way the sevens are crossed.',
      'Mine. Always mine.',
    ],
  }),
  m('whispers', 'Whispers', 'Whisperite hums when it comes out of the rock. Tonight it is humming a tune I almost know.', { kind: 'mine', ore: 'whisperite', n: 400 }, { coins: 8e13 }),
  m('starmetal', 'Starmetal', 'Metal that fell, a long time ago, from somewhere far.', { kind: 'craft', n: 1, recipe: 'c-starmetal-pick' }, { xp: 1e12 }),
  m('offer', 'The Offer', 'Something is speaking. Not with a voice. With the weight of the rock.', { kind: 'depth', n: 170 }, { coins: 1e14, unlock: ['bargains'] }, {
    scene: [
      'It does not use words. It uses wanting.',
      'It will give me things, it says, if I give it things. Small things. Things I will not miss.',
      'I do not trust it. I do not think I have to.',
    ],
  }),
  m('fair-trade', 'Fair Trade', 'Strike a bargain. Read it carefully first.', { kind: 'bargain', n: 1 }, { coins: 2e14 }),
  m('shroud', 'Shroud', 'Something to keep the cold of the dark off. It is not cold, exactly. It is attention.', { kind: 'craft', n: 1, recipe: 'c-hollow-shroud' }, { xp: 5e12 }),
  m('count', 'Count', 'Keep the seam shut and stand still, and count its breaths. Then count yours.', { kind: 'farm', n: 600 }, { xp: 1e13, flag: 'synced' }, {
    scene: [
      'Fourteen breaths a minute. Fourteen.',
      'Its heart: fifty-one beats. Mine: fifty-one.',
      'I held my breath to see what would happen. Far below, for a moment, everything went quiet.',
    ],
  }),
  m('almost', 'Almost', 'The breathing fills the shaft now. It is not loud. It is close.', { kind: 'depth', n: 190 }, { coins: 3e15 }),
  m('below', 'What Breathes Below', 'Depth two hundred. It is not hostile. It is only very old, and it was dreaming, and it has noticed you.', { kind: 'depth', n: 200 }, { coins: 1e16 }, {
    scene: [
      'At depth two hundred the rock opens onto nothing, and the nothing is warm.',
      'It is enormous. It is asleep. It is dreaming.',
      'And it has turned, very slightly, toward me.',
    ],
  }),

  // --- The Roots -----------------------------------------------------------------
  m('roots', 'The Roots', 'Below the dark there is something like rock, but softer, and it pulses.', { kind: 'depth', n: 201 }, { coins: 3e16 }),
  m('stillness', 'Stillness', 'Every wound I make in it closes. A slow smoke might keep it still.', { kind: 'fixture', id: 'censer' }, { xp: 1e15 }),
  m('veinwork', 'Veinwork', 'It bleeds ore. I try not to think about that.', { kind: 'mine', ore: 'veinroot', n: 2000 }, { coins: 5e16 }),
  m('surface', 'The Surface', 'I want to see the sky. Just once. All the way up, then.', { kind: 'visit', depth: 1 }, { xp: 2e15, flag: 'no-surface' }, {
    scene: [
      'I climbed past the top prop, past the first seam I ever broke, up to where the shaft began.',
      'It did not begin. Above the last prop the rock simply carries on, up and up, the same as it goes down.',
      'I tried to remember the sky. I remember the word. I do not remember the colour.',
      'There was never a surface. There was only ever down.',
    ],
  }),
  m('smaller-things', 'Smaller Things', 'It is asking for more. It always will.', { kind: 'bargain', n: 2 }, { coins: 8e16 }),
  m('bone-deep', 'Bone-Deep', 'Marrowstone, pale and porous. It is lighter than it should be.', { kind: 'mine', ore: 'marrow', n: 2000 }, { coins: 1e17 }),
  m('rootbound', 'Rootbound', 'A pick grown from its own heartwood. It is warm in my hand.', { kind: 'craft', n: 1, recipe: 'c-rootbound-pick' }, { xp: 5e15 }),
  m('many-times', 'Many Times', 'The shaft has come down on me again and again, and I always wake at the top.', { kind: 'descend', n: 5 }, { coins: 1e15, flag: 'dreamt' }, {
    scene: [
      'Every Descent, I thought I was starting over.',
      'I was not. Each time the shaft collapses, it is the Dreamer turning over in its sleep.',
      'And each time it settles, it dreams me again: at the top, with a lamp and a pick, a little different. A little more like I remember.',
    ],
  }),
  m('heartlight', 'Heartlight', 'A lantern that beats. It keeps time with something.', { kind: 'craft', n: 1, recipe: 'c-rootbound-lantern' }, { xp: 8e15 }),
  m('pulse', 'Pulse', 'The deeper I go, the faster its heart.', { kind: 'depth', n: 230 }, { coins: 3e17 }),
  m('blood-tears', 'Blood and Tears', 'The gems here are wet when they come out of the rock.', { kind: 'gems', n: 60 }, { coins: 4e17 }),
  m('lull', 'A Lull', 'It is quieter if I do not push. I have started to like the quiet.', { kind: 'farm', n: 1000 }, { consumables: [{ id: 'sagebrew', n: 3 }] }),
  m('last-root', 'The Last Root', 'The red gives way to something pale.', { kind: 'depth', n: 260 }, { coins: 2e18 }),

  // --- The Waking ----------------------------------------------------------------
  m('waking', 'The Waking', 'Pale stone, a pale light, and something opening.', { kind: 'depth', n: 261 }, { coins: 5e18 }, {
    scene: [
      'The light down here is not from my lamp.',
      'It comes and goes, slowly, like an eye opening and closing.',
      'When it is open my arms go heavy, and I think it is looking for me.',
    ],
  }),
  m('unseen', 'Unseen', 'A veil woven from lucid thread, so that it looks straight through me.', { kind: 'fixture', id: 'veil' }, { xp: 1e17 }),
  m('price', 'Everything Has a Price', 'It has stopped asking politely.', { kind: 'bargain', n: 3 }, { coins: 1e19 }),
  m('wakestone', 'Wakestone', 'Gold-bright, and it hums the same tune the whisperite did. Louder.', { kind: 'mine', ore: 'wakestone', n: 500 }, { coins: 2e19 }),
  m('eyelid', 'Eyelid', 'The rock curves here, like the inside of something.', { kind: 'depth', n: 280 }, { coins: 4e19 }),
  m('watched', 'Watched', 'Dig while it watches. Show it you are not afraid.', { kind: 'farm', n: 1500 }, { xp: 5e17 }),
  m('morning', 'First Light Again', 'A lantern the colour of a morning I cannot remember.', { kind: 'craft', n: 1, recipe: 'c-waking-lantern' }, { xp: 8e17 }),
  m('morning-pick', 'Morning Pick', 'The last pick I will ever make. I am sure of it.', { kind: 'craft', n: 1, recipe: 'c-waking-pick' }, { coins: 1e20 }),
  m('lashes', 'Lashes', 'Long pale seams, all running the same way. Toward the light.', { kind: 'depth', n: 290 }, { coins: 2e20 }),
  m('the-lamp', 'The Lamp', 'The lamp ahead has stopped moving. I am nearly there.', { kind: 'depth', n: 300 }, { coins: 5e20, flag: 'found-lamp' }, {
    scene: [
      'It is sitting on a ledge, still lit. My lamp. The one from the first morning.',
      'Beside it lie my old pick and a letter, in my handwriting, from the first time.',
      '"Do not wake it," it says. "Or do. I never could decide. Maybe you can."',
    ],
  }),
  m('choice', 'The Choice', 'It is surfacing, the way you surface from a dream. I could sing it back down. Or I could let it open its eyes.', { kind: 'depth', n: 310 }, { coins: 1e21 }, {
    choice: {
      prompt: 'What do you do?',
      options: [
        {
          label: 'Sing it back to sleep',
          flag: 'lullaby',
          scene: [
            'I sat down beside my old lamp and sang the only song I know: the one with no words that the music down here has been humming all along.',
            'The breathing slowed. The light dimmed. The pale stone went soft and grey again.',
            'It will dream on, and in its dream, so will I. I find I do not mind.',
          ],
        },
        {
          label: 'Let it wake',
          flag: 'woken',
          scene: [
            'I put my pick down and waited.',
            'The eye opened all the way. It was not cruel. It was only very, very old, and it looked at me the way you look at someone you dreamed about and never expected to meet.',
            'Nothing ended. But everything is a little brighter now, and when I mine I can feel it watching. Fondly, I think.',
          ],
        },
      ],
    },
  }),
  m('after', 'After', 'The shaft goes on. It always will.', { kind: 'depth', n: 320 }, { coins: 1e22 }, {
    scene: ['I have a lamp and a pick and all the dark I could want.'],
    sceneIf: [
      {
        flag: 'lullaby',
        scene: [
          'Below me the Dreamer sleeps. Above me there is no sky. I have a lamp, and a pick, and all the dark I could want.',
          'It is enough. It was always enough.',
        ],
      },
      {
        flag: 'woken',
        scene: [
          'It talks to me now, in the weight of the rock. It shows me where the ore runs. Sometimes, I am fairly sure, it laughs.',
          'Neither of us knows what happens next. That seems right.',
        ],
      },
    ],
  }),
];

/**
 * The story as it shipped first, in order. Version 1 saves stored their place
 * as an index into this list; the loader maps it through here to a mission
 * id, so new missions never move a player's place.
 */
export const STORY_V1_ORDER: readonly string[] = [
  'first-light', 'sharpen-up', 'down', 'help', 'know', 'copper', 'smelt', 'tools', 'strike', 'hive', 'glitter',
  'deeper', 'machinery', 'iron', 'bronze', 'seam', 'spores', 'clean-air', 'silver', 'dowsing', 'rod', 'mycelium',
  'cobalt', 'gloom', 'frenzy', 'excavation', 'light-seam', 'prisms', 'shatter', 'gold', 'lightbearer', 'echoes',
  'furnace-heart', 'heat', 'coolant', 'fireproof', 'obsidian', 'edge', 'hollow', 'glyphs', 'starmetal', 'below',
];

export const STORY_BY_ID: ReadonlyMap<string, Mission> = new Map(STORY.map((s) => [s.id, s]));

/** The kinds of goal a daily contract can draw from. */
export const CONTRACT_KINDS = ['breaks', 'mine', 'gems', 'earn', 'refine', 'craft', 'skill'] as const;
