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
 * The story: one chain, one mission at a time, from the beach to the top of
 * the Spire. The early ones double as the tutorial — most features are
 * switched on by the mission that introduces them.
 */
export const STORY: readonly Mission[] = [
  // --- The Landing -------------------------------------------------------------
  m('first-light', 'Landfall', 'The boat is on the shingle. The old city is rubble and gulls. Start clearing: tap the ruins.', { kind: 'clears', n: 5 }, { coins: 15, unlock: ['upgrades'] }, {
    scene: [
      'The fishermen would not come closer than the bar. They put me over the side with a crate, a hammer and a lantern, and rowed off without looking back.',
      'Somebody built a city here once. Quays, roofs, a great white tower out in the bay. Then the sea came in and they all left, and nobody remembers why.',
      'I mean to find out. And I mean to build it again.',
    ],
  }),
  m('tools', 'Better Tools', 'This hammer is older than I am. Buy a better one.', { kind: 'upgrade', id: 'tools', n: 3 }, { coins: 30, unlock: ['build'] }),
  m('roof', 'A Roof', 'The first cleared ground is dry. Put a tent on it: open Build, pick the Tent, tap the ground.', { kind: 'build', id: 'tent', n: 2 }, { coins: 40, unlock: ['crews'] }),
  m('hands', 'Many Hands', 'People are coming in by boat now, one or two a day. Give them barrows.', { kind: 'build', id: 'gang', n: 2 }, { xp: 30, unlock: ['founder'] }),
  m('know', 'Know Yourself', 'Put your points somewhere. Craft hits harder; Vision sees the weak spot.', { kind: 'stats', n: 3 }, { coins: 80 }),
  m('further', 'Further In', 'Twelve ruins, then a landmark. Bring the landmark down and the next ward opens.', { kind: 'ward', n: 3 }, { coins: 100 }),
  m('trade', 'Trade', 'A woman from the boats wants to sell fish. Give her a stall near the tents.', { kind: 'build', id: 'stall', n: 1 }, { coins: 120 }),
  m('drift', 'Driftwood', 'Enough wood on this beach to build a ship. Or a workshop.', { kind: 'salvage', id: 'driftwood', n: 40 }, { coins: 150, unlock: ['workshops'] }),
  m('planks', 'Planks', 'Eight driftwood to a plank. The workshop knows how.', { kind: 'refine', n: 4 }, { coins: 150, unlock: ['drafting'] }),
  m('chain', 'Chain of Office', 'They have started calling me the Founder. I should look the part.', { kind: 'craft', n: 1, recipe: 'c-rope-chain' }, { xp: 80, unlock: ['rush'] }),
  m('rush', 'All Hands', 'When a wall will not come down, everyone pushes at once.', { kind: 'edict', n: 3, edict: 'rush' }, { coins: 250 }),
  m('neighbours', 'Good Neighbours', 'Nobody wants to sleep next to a workshop. Put gardens beside the tents instead.', { kind: 'happy', n: 110 }, { coins: 400 }),
  m('glint', 'Glint', 'Things the old city dropped: coins, keys, a child’s whistle.', { kind: 'relics', n: 3 }, { coins: 500, consumables: [{ id: 'ink', n: 1 }] }),
  m('headcount', 'Headcount', 'Thirty souls. A village, nearly.', { kind: 'pop', n: 30 }, { coins: 1200 }),
  m('cranes', 'Heavy Lifting', 'There is an old harbour crane half sunk off the point. It still turns.', { kind: 'build', id: 'crane', n: 1 }, { xp: 300 }),
  m('scrap', 'Scrap', 'Iron under everything. Hinges, nails, a bedstead.', { kind: 'salvage', id: 'scrap', n: 80 }, { coins: 3000, unlock: ['passives'] }),
  m('mason', 'Mason’s Chain', 'Brick and an old coin. Heavier, and it suits me.', { kind: 'craft', n: 1, recipe: 'c-brick-chain' }, { coins: 4000 }),
  m('harbour-gate', 'The Harbour Gate', 'The Landing ends at an arch with the sea behind it. I can hear water moving on the other side.', { kind: 'ward', n: 9 }, { coins: 20_000, consumables: [{ id: 'charge', n: 5 }] }, {
    scene: [
      'The arch came down at dusk, and behind it was the old harbour: quays and boathouses and a whole street of shops with the water lapping at the sills.',
      'Every door had a mark chalked on it, the same mark, at the height of a hand. A circle with a line through it.',
      'Out in the bay the white tower caught the last of the light. I had not noticed before how tall it is. It goes up into the cloud and does not come out of the other side.',
    ],
  }),

  // --- Old Harbour -------------------------------------------------------------
  m('high-water', 'High Water', 'The tide comes into the Harbour twice an hour. It stops everything it touches.', { kind: 'ward', n: 10 }, { coins: 30_000 }),
  m('seawall', 'Sea Wall', 'Brick and cobble and a Harbour Lamp set in the top.', { kind: 'fixture', id: 'seawall' }, { xp: 4000 }),
  m('wire', 'Copper Wire', 'The old city ran wire everywhere. To what?', { kind: 'salvage', id: 'wire', n: 150 }, { coins: 60_000 }),
  m('surveying', 'Surveying', 'If I stand still and listen, I can tell where the old cellars are.', { kind: 'level', n: 18 }, { unlock: ['survey'], coins: 50_000 }),
  m('survey', 'Plumb Line', 'Try it.', { kind: 'edict', n: 2, edict: 'survey' }, { coins: 80_000, unlock: ['petitions'] }),
  m('village', 'A Village', 'Two hundred people. They have started arguing about the name.', { kind: 'pop', n: 200 }, { coins: 120_000 }),
  m('copper', 'Copper Chain', 'Copperwork and a pearl. The council insists.', { kind: 'craft', n: 1, recipe: 'c-copper-chain' }, { xp: 20_000 }),
  m('hum', 'The Hum', 'At night, with the wind off the bay, you can hear it. A note, very low, from the tower.', { kind: 'ward', n: 13 }, { coins: 400_000, unlock: ['tide'], flag: 'heard' }, {
    scene: [
      'Old Marrit, who mends the nets, says her grandmother told her about the city. It was called Vessel. It was very rich, and very proud, and one spring the whole city stood on the quays and watched the sea come in. Nobody ran.',
      'When I asked why, Marrit said: because they let it.',
      'I can hear the tower from my tent now. It is not loud. It is the kind of sound you only notice when it stops, and it never stops.',
      'If the sea came in once, it can come in again. If it does, I think I would let it. I think I would start over. The city would remember a little more each time.',
    ],
  }),
  m('festival', 'Festival', 'The first year. Bunting, a fiddle, too much cider.', { kind: 'ward', n: 15 }, { unlock: ['festival'], coins: 600_000 }),
  m('dredging', 'Dredging', 'The Market Ward is still under a yard of silt. We need dredgers. A lot of them.', { kind: 'build', id: 'dredger', n: 5 }, { coins: 1e6 }),
  m('market-gate', 'The Market Gate', 'Arcades, and gilt under the mud.', { kind: 'ward', n: 17 }, { coins: 5e6 }, {
    scene: [
      'The Market Ward was the heart of Vessel. You can tell: everything here was built to be looked at. Even the drains have faces.',
      'In the counting house we found the city’s books, every page dry. The last entry is in a firm hand. Paid in full, it says, and a date, and below it the circle with the line through it.',
    ],
  }),

  // --- Market Ward ---------------------------------------------------------------
  m('crowds', 'Crowds', 'Everyone wants to be in the Market. Nobody wants to get out of the way.', { kind: 'fixture', id: 'charter' }, { coins: 1e7 }),
  m('silk', 'Silk Road', 'Bolts of silk in a cellar, still bright.', { kind: 'salvage', id: 'silk', n: 300 }, { coins: 2e7 }),
  m('lantern', 'Lightbearer', 'The fog on the bay is thicker every evening. I want a light I can trust.', { kind: 'craft', n: 1, recipe: 'c-guild-lantern' }, { xp: 2e6 }),
  m('the-tide', 'The Tide', 'Let the sea take it back. Start again from the beach, and remember.', { kind: 'tide', n: 1 }, { coins: 1e5, consumables: [{ id: 'almanac', n: 2 }] }, {
    scene: [
      'We stood on the quays, all of us, and watched it come in. Nobody ran.',
      'In the morning the city was rubble and gulls. My tent was where I left it the first night, and the fishermen were rowing away without looking back.',
      'But I knew where the cellars were. I knew which walls would fall. And when the first boat came in, the woman who sells fish waved to me as if she knew me.',
    ],
  }),
  m('letter', 'A Letter', 'Under the landmark at ward seventeen, a letter in a hand I know. It says only: look under the jetty.', { kind: 'visit', ward: 1 }, { coins: 3e8, flag: 'remembered' }, {
    scene: [
      'Under the jetty, wedged between two stones above the tideline, a tin box. In the box, a book.',
      'It is a founder’s journal. It begins with a boat on the shingle, and a crate, and a hammer and a lantern. The handwriting is mine.',
      'The last page says: it is asleep under the Spire, and as long as it sleeps the sea is kind. Every time we build too high, it begins to wake. Every time, we let the sea come in. Next time, try something else.',
    ],
  }),
  m('foundry-gate', 'The Foundry Gate', 'Chimneys. The air tastes of pennies.', { kind: 'ward', n: 25 }, { coins: 1e10 }),

  // --- Foundry Quarter ---------------------------------------------------------
  m('smog', 'Smog', 'The old smog never cleared. My crews are coughing.', { kind: 'fixture', id: 'scrubbers' }, { coins: 3e10 }),
  m('coat', 'Sealed Coat', 'Oilcloth and steel and a Foundry Heart sewn in the lining.', { kind: 'craft', n: 1, recipe: 'c-sealed-coat' }, { xp: 4e8 }),
  m('steel', 'Girders', 'Steel enough to build up instead of out.', { kind: 'refine', n: 30, good: 'steel' }, { coins: 1e11 }),
  m('memory', 'Long Memory', 'Every time the sea comes in, the city remembers a little more.', { kind: 'memories', n: 60 }, { coins: 2e11 }),
  m('spire-gate', 'The Spire Gate', 'The causeway to the tower is above water for the first time in living memory.', { kind: 'ward', n: 33 }, { coins: 1e12 }, {
    scene: [
      'We walked out along the causeway at low tide, the whole council, in our chains and coats. Halfway there the fog closed in so thick I could not see my own hand.',
      'And then the hum stopped.',
      'Just for a moment. As if something very large had held its breath to listen to us coming.',
    ],
  }),

  // --- The Drowned Spire -------------------------------------------------------
  m('fog', 'Fog', 'Nobody can work in this. Beacons, a line of them, all the way up the causeway.', { kind: 'fixture', id: 'beacons' }, { coins: 3e12 }),
  m('arcology', 'Upward', 'There is no more ground. There is only up.', { kind: 'build', id: 'arcology', n: 1 }, { coins: 1e13 }),
  m('choir', 'Choir', 'The shards sing when two of them touch.', { kind: 'relics', n: 400 }, { xp: 1e10 }),
  m('summit', 'The Top of the Spire', 'The last door. It has the circle on it, and the line through it, and a keyhole.', { kind: 'ward', n: 40 }, { coins: 1e14 }, {
    choice: {
      prompt: 'Behind the door, in the dark, something enormous breathes. It is asleep. It is waking. What do you do?',
      options: [
        {
          label: 'Ring the bell. Let it wake.',
          flag: 'rang',
          scene: [
            'The bell at the top of the Spire had not been rung since the city was called Vessel. I rang it.',
            'The sea drew back from the bay all at once, the way a breath goes in. Out on the mudflats the fishermen stood up in their boats.',
            'And the thing under the tower opened its eyes, and looked at the city we had built, and — I swear this — it was glad. It had been waiting a very long time for someone to stop running from it.',
            'The hum is louder now, and warmer. The children say it is singing. I think they are right.',
          ],
        },
        {
          label: 'Lock the door. Let it sleep.',
          flag: 'hushed',
          scene: [
            'I turned the key and sat down with my back to the door, and after a while the breathing slowed, and the hum sank back to the note we all know.',
            'The founders of Vessel did the same, I think, and the founders before them. And every so often the sea comes in, and we start again on the beach, and we remember a little more.',
            'There are worse ways to keep a promise. I put the key on my chain. It is heavier than it looks.',
          ],
        },
      ],
    },
  }),
];

export const STORY_BY_ID: ReadonlyMap<string, Mission> = new Map(STORY.map((x) => [x.id, x]));
