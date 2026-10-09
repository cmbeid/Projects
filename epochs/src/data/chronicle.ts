import type { EventDef } from './types';

/**
 * The Chronicle: things that happen to the city, and what it did about them.
 * Every event is a choice between two answers; the history book keeps both
 * the question and the answer. Amounts are measured in seconds of the city's
 * own output, so the same event is the same size in any era.
 */

export const EVENTS: readonly EventDef[] = [
  // --- Any time ------------------------------------------------------------------
  {
    id: 'good-harvest',
    eras: [0, 7],
    title: 'A Bumper Harvest',
    text: 'The granaries are full to the rafters and there is still grain in the fields.',
    choices: [
      { label: 'Store it all', outcomes: [{ k: 'gain', r: 'food', secs: 120 }], log: 'stored a bumper harvest' },
      { label: 'Hold a harvest feast', outcomes: [{ k: 'gain', r: 'culture', secs: 90 }, { k: 'mod', label: 'Harvest feast', target: 'stability', x: 10, secs: 300 }], log: 'feasted on a bumper harvest' },
    ],
    fallback: 0,
  },
  {
    id: 'blight',
    eras: [0, 7],
    title: 'Blight',
    text: 'A grey mould is spreading through the fields.',
    choices: [
      { label: 'Burn the fields', outcomes: [{ k: 'lose', r: 'food', pct: 0.3 }], log: 'burned the blighted fields' },
      { label: 'Pray it passes', outcomes: [{ k: 'mod', label: 'Blight', target: 'farmer', x: -0.4, secs: 240 }], log: 'let the blight run its course' },
    ],
    fallback: 1,
  },
  {
    id: 'wanderers',
    eras: [0, 7],
    title: 'Wanderers at the Gate',
    text: 'A band of travellers asks to settle. They are hungry, and they are many.',
    choices: [
      { label: 'Take them in', pay: [{ r: 'food', secs: 60 }], outcomes: [{ k: 'pop', pct: 0.12 }], log: 'took in wanderers at the gate' },
      { label: 'Send them on', outcomes: [{ k: 'mod', label: 'Closed gates', target: 'stability', x: -5, secs: 300 }], log: 'turned wanderers away' },
    ],
    fallback: 1,
  },
  {
    id: 'genius',
    eras: [0, 7],
    title: 'A Strange Child',
    text: 'A child in the poor quarter has been scratching sums nobody taught her into the dirt.',
    choices: [
      { label: 'Give her a teacher', pay: [{ r: 'food', secs: 30 }], outcomes: [{ k: 'insight', secs: 150 }], log: 'found a teacher for a gifted child' },
      { label: 'Leave her be', outcomes: [{ k: 'gain', r: 'culture', secs: 40 }], log: 'left a gifted child to her games' },
    ],
    fallback: 1,
  },
  {
    id: 'fire',
    eras: [0, 6],
    title: 'Fire!',
    text: 'A fire has taken hold in the timber yards and the wind is getting up.',
    choices: [
      { label: 'Everyone to the buckets', outcomes: [{ k: 'mod', label: 'Fighting the fire', target: 'all', x: -0.5, secs: 60 }], log: 'put out a great fire by hand' },
      { label: 'Let it burn out', outcomes: [{ k: 'lose', r: 'wood', pct: 0.5 }, { k: 'lose', r: 'stone', pct: 0.2 }], log: 'let a great fire burn itself out' },
    ],
    fallback: 1,
  },
  {
    id: 'comet',
    eras: [0, 7],
    title: 'A Comet',
    text: 'A star with a tail hangs over the city for nine nights.',
    choices: [
      { label: 'An omen of plenty!', outcomes: [{ k: 'mod', label: 'Good omen', target: 'all', x: 0.2, secs: 180 }], log: 'took a comet as an omen of plenty' },
      { label: 'Watch it and write it down', outcomes: [{ k: 'insight', secs: 90 }], log: 'charted a comet' },
    ],
    fallback: 0,
  },
  {
    id: 'wet-summer',
    eras: [0, 7],
    title: 'A Wet Summer',
    text: 'It has rained for six weeks. The river is high and the roads are mud.',
    choices: [
      { label: 'Dig drains', pay: [{ r: 'stone', secs: 60 }], outcomes: [{ k: 'mod', label: 'Drained streets', target: 'growth', x: 0.3, secs: 300 }], log: 'dug drains through a wet summer' },
      { label: 'Wait for the sun', outcomes: [{ k: 'mod', label: 'Mud', target: 'all', x: -0.15, secs: 180 }], log: 'waited out a wet summer' },
    ],
    fallback: 1,
  },
  {
    id: 'twins',
    eras: [0, 7],
    title: 'A Year of Twins',
    text: 'Every other cradle in the city seems to hold two babies this year.',
    choices: [
      { label: 'Celebrate', pay: [{ r: 'culture', secs: 30 }], outcomes: [{ k: 'mod', label: 'Year of twins', target: 'growth', x: 1, secs: 240 }], log: 'celebrated a year of twins' },
      { label: 'Ration the bread', outcomes: [{ k: 'gain', r: 'food', secs: 60 }], log: 'rationed bread in a year of twins' },
    ],
    fallback: 0,
  },
  {
    id: 'festival-request',
    eras: [0, 7],
    title: 'The People Want a Holiday',
    text: 'The workers have downed tools and are asking for a day off.',
    choices: [
      { label: 'Grant it', outcomes: [{ k: 'mod', label: 'Holiday', target: 'all', x: -0.3, secs: 60 }, { k: 'mod', label: 'Rested', target: 'stability', x: 12, secs: 420 }], log: 'declared a holiday' },
      { label: 'Back to work', outcomes: [{ k: 'mod', label: 'Grumbling', target: 'stability', x: -10, secs: 300 }], log: 'refused a holiday' },
    ],
    fallback: 1,
  },
  // --- Stone Age --------------------------------------------------------------------
  {
    id: 'mammoth',
    eras: [0, 0],
    title: 'Mammoth Tracks',
    text: 'The hunters have found the tracks of a herd crossing the valley.',
    choices: [
      { label: 'Hunt them', outcomes: [{ k: 'gain', r: 'food', secs: 150 }, { k: 'pop', pct: -0.05 }], log: 'hunted mammoth' },
      { label: 'Let them pass', outcomes: [{ k: 'gain', r: 'culture', secs: 40 }], log: 'watched the mammoth go by' },
    ],
    fallback: 1,
  },
  {
    id: 'cave-paintings',
    eras: [0, 0],
    title: 'The Painted Cave',
    text: 'Children have found a cave whose walls are covered in running animals.',
    choices: [
      { label: 'Make it sacred', outcomes: [{ k: 'gain', r: 'culture', secs: 120 }], log: 'made the painted cave sacred' },
      { label: 'Use it as a store', outcomes: [{ k: 'gain', r: 'wood', secs: 60 }, { k: 'gain', r: 'stone', secs: 60 }], log: 'stored firewood in the painted cave' },
    ],
    fallback: 0,
  },
  {
    id: 'wolf-pups',
    eras: [0, 0],
    title: 'Wolf Pups',
    text: 'A she-wolf has been killed, and her pups are whining at the edge of the firelight.',
    choices: [
      { label: 'Raise them', pay: [{ r: 'food', secs: 30 }], outcomes: [{ k: 'mod', label: 'Hounds', target: 'forager', x: 0.5, secs: 900 }], log: 'raised wolf pups as hounds' },
      { label: 'Drive them off', outcomes: [], log: 'drove off a litter of wolf pups' },
    ],
    fallback: 1,
  },
  {
    id: 'obsidian',
    eras: [0, 0],
    title: 'The Obsidian Traders',
    text: 'Strangers from the mountains offer black glass that cuts better than flint.',
    choices: [
      { label: 'Trade food for it', pay: [{ r: 'food', secs: 60 }], outcomes: [{ k: 'mod', label: 'Obsidian blades', target: 'woodcutter', x: 0.5, secs: 600 }], log: 'traded with the obsidian people' },
      { label: 'Send them home', outcomes: [], log: 'sent the obsidian traders home' },
    ],
    fallback: 1,
  },
  // --- Bronze Age -------------------------------------------------------------------
  {
    id: 'flood',
    eras: [1, 2],
    title: 'The Great Flood',
    text: 'The river has burst its banks and the low fields are a lake.',
    choices: [
      { label: 'Raise the dykes', pay: [{ r: 'stone', secs: 90 }], outcomes: [{ k: 'mod', label: 'Silt-rich fields', target: 'farmer', x: 0.4, secs: 600 }], log: 'raised the dykes against the flood' },
      { label: 'Move to higher ground', outcomes: [{ k: 'lose', r: 'food', pct: 0.4 }], log: 'fled the flood to higher ground' },
    ],
    fallback: 1,
  },
  {
    id: 'tin-road',
    eras: [1, 1],
    title: 'The Tin Road',
    text: 'Caravans have found a road to the tin mines over the mountains.',
    choices: [
      { label: 'Fund the caravans', pay: [{ r: 'gold', secs: 60 }], outcomes: [{ k: 'mod', label: 'Tin caravans', target: 'miner', x: 0.6, secs: 600 }], log: 'funded the tin caravans' },
      { label: 'Tax them instead', outcomes: [{ k: 'gain', r: 'gold', secs: 90 }], log: 'taxed the tin caravans' },
    ],
    fallback: 1,
  },
  {
    id: 'scribe-school',
    eras: [1, 1],
    title: 'The Tablet House',
    text: 'The scribes want to open a school, and they want the temple to pay for it.',
    choices: [
      { label: 'Pay for it', pay: [{ r: 'gold', secs: 60 }], outcomes: [{ k: 'mod', label: 'Tablet house', target: 'scholar', x: 0.5, secs: 600 }], log: 'founded a school for scribes' },
      { label: 'Let them pay', outcomes: [{ k: 'gain', r: 'knowledge', secs: 30 }], log: 'let the scribes find their own money' },
    ],
    fallback: 1,
  },
  {
    id: 'divine-king',
    eras: [1, 1],
    title: 'A God-King',
    text: 'The high priest proposes that the ruler be declared divine.',
    choices: [
      { label: 'So be it', outcomes: [{ k: 'mod', label: 'God-king', target: 'stability', x: 15, secs: 900 }, { k: 'lose', r: 'gold', pct: 0.2 }], log: 'declared its ruler a god' },
      { label: 'A ruler is a ruler', outcomes: [{ k: 'gain', r: 'knowledge', secs: 60 }], log: 'kept its ruler mortal' },
    ],
    fallback: 0,
  },
  {
    id: 'sea-peoples',
    eras: [1, 2],
    title: 'Sails on the Horizon',
    text: 'Raiders from the sea are burning villages up the coast.',
    choices: [
      { label: 'Pay them off', pay: [{ r: 'gold', secs: 120 }], outcomes: [], log: 'paid off the raiders from the sea' },
      { label: 'Man the walls', outcomes: [{ k: 'mod', label: 'Under siege', target: 'all', x: -0.25, secs: 180 }, { k: 'mod', label: 'Victory', target: 'stability', x: 10, secs: 600 }], log: 'fought off the raiders from the sea' },
    ],
    fallback: 1,
  },
  // --- Classical --------------------------------------------------------------------
  {
    id: 'olympics',
    eras: [2, 2],
    title: 'The Games',
    text: 'Cities all along the coast are sending athletes to compete.',
    choices: [
      { label: 'Host them', pay: [{ r: 'gold', secs: 90 }], outcomes: [{ k: 'gain', r: 'culture', secs: 200 }], log: 'hosted the Games' },
      { label: 'Send a team', outcomes: [{ k: 'gain', r: 'culture', secs: 50 }], log: 'sent a team to the Games' },
    ],
    fallback: 1,
  },
  {
    id: 'hemlock',
    eras: [2, 2],
    title: 'The Gadfly',
    text: 'An old philosopher has been asking the young awkward questions. The council wants him silenced.',
    choices: [
      { label: 'Let him talk', outcomes: [{ k: 'insight', secs: 120 }, { k: 'mod', label: 'Awkward questions', target: 'stability', x: -8, secs: 300 }], log: 'let the gadfly keep talking' },
      { label: 'Silence him', outcomes: [{ k: 'mod', label: 'Order', target: 'stability', x: 8, secs: 300 }], log: 'silenced the gadfly' },
    ],
    fallback: 1,
  },
  {
    id: 'plague-athens',
    eras: [2, 3],
    title: 'Plague',
    text: 'A sickness came in on a grain ship and is spreading through the poor quarters.',
    choices: [
      { label: 'Close the port', outcomes: [{ k: 'mod', label: 'Quarantine', target: 'merchant', x: -0.8, secs: 300 }], log: 'closed the port against plague' },
      { label: 'Keep trading', outcomes: [{ k: 'pop', pct: -0.12 }], log: 'kept trading through a plague' },
    ],
    fallback: 1,
  },
  {
    id: 'senate',
    eras: [2, 2],
    title: 'Bread and Circuses',
    text: 'The mob is restless. A senator suggests free bread and a show.',
    choices: [
      { label: 'Bread and circuses', pay: [{ r: 'food', secs: 60 }, { r: 'gold', secs: 40 }], outcomes: [{ k: 'mod', label: 'Circuses', target: 'stability', x: 20, secs: 600 }], log: 'gave the mob bread and circuses' },
      { label: 'Let them work', outcomes: [{ k: 'mod', label: 'A restless mob', target: 'stability', x: -6, secs: 300 }], log: 'gave the mob nothing' },
    ],
    fallback: 1,
  },
  {
    id: 'shipwreck',
    eras: [2, 4],
    title: 'A Wreck in the Bay',
    text: 'A great merchant ship has gone down in the harbour mouth with its cargo.',
    choices: [
      { label: 'Send divers', pay: [{ r: 'food', secs: 30 }], outcomes: [{ k: 'gain', r: 'gold', secs: 150 }], log: 'salvaged a wreck in the bay' },
      { label: 'Leave it to the fish', outcomes: [{ k: 'gain', r: 'culture', secs: 30 }], log: 'left a wreck to the fish' },
    ],
    fallback: 1,
  },
  // --- Medieval ---------------------------------------------------------------------
  {
    id: 'black-death',
    eras: [3, 3],
    title: 'The Great Mortality',
    text: 'Rats, fleas and a black swelling under the arm. One in three may die.',
    choices: [
      { label: 'Seal the gates', outcomes: [{ k: 'pop', pct: -0.08 }, { k: 'mod', label: 'Sealed gates', target: 'all', x: -0.3, secs: 300 }], log: 'sealed its gates against the Great Mortality' },
      { label: 'Pray', outcomes: [{ k: 'pop', pct: -0.2 }, { k: 'gain', r: 'culture', secs: 100 }], log: 'prayed through the Great Mortality' },
    ],
    fallback: 1,
  },
  {
    id: 'pilgrims',
    eras: [3, 3],
    title: 'Pilgrims',
    text: 'Word of a relic in the city has spread, and pilgrims are coming from far away.',
    choices: [
      { label: 'Sell them badges', outcomes: [{ k: 'gain', r: 'gold', secs: 120 }], log: 'sold pilgrim badges' },
      { label: 'House them for free', pay: [{ r: 'food', secs: 60 }], outcomes: [{ k: 'gain', r: 'culture', secs: 150 }], log: 'housed pilgrims for free' },
    ],
    fallback: 0,
  },
  {
    id: 'guild-strike',
    eras: [3, 4],
    title: 'The Guilds Strike',
    text: 'The masters want a charter that only they may trade in the city.',
    choices: [
      { label: 'Grant the charter', outcomes: [{ k: 'mod', label: 'Guild charter', target: 'merchant', x: -0.3, secs: 900 }, { k: 'mod', label: 'Content guilds', target: 'stability', x: 10, secs: 900 }], log: 'granted the guilds their charter' },
      { label: 'Break the strike', outcomes: [{ k: 'mod', label: 'Strike', target: 'all', x: -0.3, secs: 120 }], log: 'broke a guild strike' },
    ],
    fallback: 0,
  },
  {
    id: 'heretic',
    eras: [3, 4],
    title: 'A Heretic',
    text: 'A friar is preaching that the stars do not go round the earth.',
    choices: [
      { label: 'Burn his books', outcomes: [{ k: 'mod', label: 'Orthodoxy', target: 'stability', x: 8, secs: 600 }], log: 'burned a heretic’s books' },
      { label: 'Read his books', outcomes: [{ k: 'insight', secs: 150 }, { k: 'mod', label: 'Doubt', target: 'stability', x: -6, secs: 300 }], log: 'read a heretic’s books' },
    ],
    fallback: 0,
  },
  {
    id: 'tournament',
    eras: [3, 3],
    title: 'A Tournament',
    text: 'A duke offers to hold his tournament on the meadow outside the walls.',
    choices: [
      { label: 'Welcome him', pay: [{ r: 'food', secs: 40 }], outcomes: [{ k: 'gain', r: 'gold', secs: 100 }, { k: 'gain', r: 'culture', secs: 60 }], log: 'welcomed a duke’s tournament' },
      { label: 'Keep the meadow', outcomes: [{ k: 'gain', r: 'food', secs: 60 }], log: 'kept its meadow for hay' },
    ],
    fallback: 1,
  },
  // --- Renaissance ------------------------------------------------------------------
  {
    id: 'patron',
    eras: [4, 4],
    title: 'A Young Painter',
    text: 'A young painter wants to cover the council chamber ceiling. It will take four years.',
    choices: [
      { label: 'Commission him', pay: [{ r: 'gold', secs: 90 }], outcomes: [{ k: 'gain', r: 'culture', secs: 240 }], log: 'commissioned a painted ceiling' },
      { label: 'Whitewash it', outcomes: [], log: 'whitewashed the council ceiling' },
    ],
    fallback: 1,
  },
  {
    id: 'new-world',
    eras: [4, 4],
    title: 'A New Coast',
    text: 'A captain has come home with maps of a coast nobody knew was there.',
    choices: [
      { label: 'Fund a colony', pay: [{ r: 'gold', secs: 120 }, { r: 'food', secs: 60 }], outcomes: [{ k: 'mod', label: 'Colonial trade', target: 'merchant', x: 0.8, secs: 900 }], log: 'founded a colony on a new coast' },
      { label: 'Publish the maps', outcomes: [{ k: 'insight', secs: 90 }], log: 'published the maps of a new coast' },
    ],
    fallback: 1,
  },
  {
    id: 'tulips',
    eras: [4, 5],
    title: 'Tulip Fever',
    text: 'A single bulb is selling for the price of a house. Everyone is buying.',
    choices: [
      { label: 'Buy in', pay: [{ r: 'gold', secs: 60 }], outcomes: [{ k: 'lose', r: 'gold', pct: 0.25 }], log: 'bought into tulip fever, and lost' },
      { label: 'Sell to the fools', outcomes: [{ k: 'gain', r: 'gold', secs: 120 }], log: 'sold bulbs at the top of tulip fever' },
    ],
    fallback: 0,
  },
  {
    id: 'printing-pamphlets',
    eras: [4, 5],
    title: 'Pamphlets',
    text: 'Anonymous pamphlets mocking the council are on every street corner.',
    choices: [
      { label: 'Ban the press', outcomes: [{ k: 'mod', label: 'Censorship', target: 'scholar', x: -0.3, secs: 600 }, { k: 'mod', label: 'Quiet streets', target: 'stability', x: 8, secs: 600 }], log: 'banned the pamphleteers' },
      { label: 'Laugh along', outcomes: [{ k: 'gain', r: 'culture', secs: 80 }], log: 'laughed at its own pamphlets' },
    ],
    fallback: 1,
  },
  // --- Industrial ------------------------------------------------------------------
  {
    id: 'smog',
    eras: [5, 5],
    title: 'The Great Stink',
    text: 'Smoke by day, the river by night. The council meets with handkerchiefs over their faces.',
    choices: [
      { label: 'Build sewers', pay: [{ r: 'metal', secs: 90 }, { r: 'gold', secs: 60 }], outcomes: [{ k: 'mod', label: 'Clean streets', target: 'growth', x: 0.5, secs: 900 }], log: 'built sewers after the Great Stink' },
      { label: 'Open the windows', outcomes: [{ k: 'mod', label: 'Stink', target: 'stability', x: -10, secs: 600 }], log: 'endured the Great Stink' },
    ],
    fallback: 1,
  },
  {
    id: 'luddites',
    eras: [5, 5],
    title: 'Machine Breakers',
    text: 'Weavers put out of work have smashed the new looms.',
    choices: [
      { label: 'Pay them off', pay: [{ r: 'gold', secs: 90 }], outcomes: [{ k: 'mod', label: 'Truce', target: 'stability', x: 10, secs: 600 }], log: 'paid off the machine breakers' },
      { label: 'Call the troops', outcomes: [{ k: 'mod', label: 'Resentment', target: 'stability', x: -12, secs: 600 }], log: 'put down the machine breakers' },
    ],
    fallback: 1,
  },
  {
    id: 'gold-rush',
    eras: [5, 6],
    title: 'Gold Rush',
    text: 'Gold in the hills! Half the city has gone with a pan and a mule.',
    choices: [
      { label: 'Join the rush', outcomes: [{ k: 'gain', r: 'gold', secs: 200 }, { k: 'mod', label: 'Gone prospecting', target: 'all', x: -0.3, secs: 180 }], log: 'joined the gold rush' },
      { label: 'Sell them shovels', outcomes: [{ k: 'gain', r: 'gold', secs: 90 }], log: 'sold shovels to the gold rush' },
    ],
    fallback: 1,
  },
  {
    id: 'world-fair',
    eras: [5, 6],
    title: 'An Inventor',
    text: 'An inventor wants funding for an engine that runs on lightning.',
    choices: [
      { label: 'Fund him', pay: [{ r: 'gold', secs: 90 }], outcomes: [{ k: 'insight', secs: 180 }], log: 'funded a lightning engine' },
      { label: 'Show him the door', outcomes: [], log: 'showed an inventor the door' },
    ],
    fallback: 1,
  },
  {
    id: 'pit-collapse',
    eras: [5, 5],
    title: 'Pit Collapse',
    text: 'The main seam has collapsed with a shift underground.',
    choices: [
      { label: 'Dig them out', outcomes: [{ k: 'mod', label: 'Rescue', target: 'miner', x: -1, secs: 120 }, { k: 'mod', label: 'Solidarity', target: 'stability', x: 10, secs: 600 }], log: 'dug out a buried shift' },
      { label: 'Seal the pit', outcomes: [{ k: 'pop', pct: -0.03 }, { k: 'mod', label: 'Grief', target: 'stability', x: -12, secs: 600 }], log: 'sealed a collapsed pit' },
    ],
    fallback: 0,
  },
  // --- Modern ----------------------------------------------------------------------
  {
    id: 'crash',
    eras: [6, 6],
    title: 'The Crash',
    text: 'Shares have halved in a day. There are queues outside every bank.',
    choices: [
      { label: 'Bail out the banks', pay: [{ r: 'gold', secs: 150 }], outcomes: [], log: 'bailed out the banks' },
      { label: 'Let them fail', outcomes: [{ k: 'mod', label: 'Depression', target: 'all', x: -0.25, secs: 600 }], log: 'let the banks fail' },
    ],
    fallback: 1,
  },
  {
    id: 'moon-landing',
    eras: [6, 7],
    title: 'One Small Step',
    text: 'The whole city is crowded round the screens to watch someone walk on the moon.',
    choices: [
      { label: 'Fund more of it', pay: [{ r: 'gold', secs: 90 }], outcomes: [{ k: 'insight', secs: 180 }], log: 'funded the space programme' },
      { label: 'Throw a party', outcomes: [{ k: 'mod', label: 'Moon party', target: 'stability', x: 15, secs: 600 }], log: 'partied all night after the moon landing' },
    ],
    fallback: 1,
  },
  {
    id: 'blackout',
    eras: [6, 7],
    title: 'Blackout',
    text: 'A heatwave has overloaded the grid and the whole city has gone dark.',
    choices: [
      { label: 'Ration the power', outcomes: [{ k: 'mod', label: 'Rolling blackouts', target: 'all', x: -0.2, secs: 300 }], log: 'rationed power through a blackout' },
      { label: 'Buy power in', pay: [{ r: 'gold', secs: 90 }], outcomes: [], log: 'bought power in through a blackout' },
    ],
    fallback: 0,
  },
  {
    id: 'startup',
    eras: [6, 7],
    title: 'Two Kids in a Garage',
    text: 'Two students want a loan to build a computer that fits on a desk.',
    choices: [
      { label: 'Lend it', pay: [{ r: 'gold', secs: 60 }], outcomes: [{ k: 'mod', label: 'Desk computers', target: 'coder', x: 0.8, secs: 900 }], log: 'lent two kids money for a computer' },
      { label: 'Laugh', outcomes: [], log: 'laughed at two kids in a garage' },
    ],
    fallback: 1,
  },
  {
    id: 'heatwave',
    eras: [6, 7],
    title: 'The Long Summer',
    text: 'The hottest summer anyone can remember. The reservoirs are low.',
    choices: [
      { label: 'Plant trees', pay: [{ r: 'gold', secs: 60 }], outcomes: [{ k: 'mod', label: 'Shade', target: 'stability', x: 10, secs: 900 }], log: 'planted a forest in a long summer' },
      { label: 'Hosepipe ban', outcomes: [{ k: 'mod', label: 'Drought', target: 'farmer', x: -0.4, secs: 300 }], log: 'banned hosepipes in a long summer' },
    ],
    fallback: 1,
  },
  // --- Space -----------------------------------------------------------------------
  {
    id: 'signal',
    eras: [7, 7],
    title: 'A Signal',
    text: 'The radio telescopes have picked up a repeating pattern from a nearby star.',
    choices: [
      { label: 'Answer it', outcomes: [{ k: 'insight', secs: 200 }, { k: 'mod', label: 'Unease', target: 'stability', x: -8, secs: 600 }], log: 'answered a signal from the stars' },
      { label: 'Keep listening', outcomes: [{ k: 'gain', r: 'data', secs: 120 }], log: 'listened to a signal from the stars' },
    ],
    fallback: 1,
  },
  {
    id: 'mind-vote',
    eras: [7, 7],
    title: 'The Minds Ask for a Vote',
    text: 'The city’s artificial minds have asked, politely, to be counted as citizens.',
    choices: [
      { label: 'Count them', outcomes: [{ k: 'mod', label: 'New citizens', target: 'all', x: 0.25, secs: 900 }, { k: 'mod', label: 'Argument', target: 'stability', x: -10, secs: 600 }], log: 'gave its artificial minds the vote' },
      { label: 'Not yet', outcomes: [{ k: 'mod', label: 'Disappointment', target: 'coder', x: -0.3, secs: 300 }], log: 'asked its artificial minds to wait' },
    ],
    fallback: 1,
  },
  {
    id: 'solar-flare',
    eras: [7, 7],
    title: 'Solar Flare',
    text: 'A storm on the sun is coming. The orbital yards have an hour’s warning.',
    choices: [
      { label: 'Shelter the yards', outcomes: [{ k: 'mod', label: 'Sheltering', target: 'fabricator', x: -0.8, secs: 180 }], log: 'sheltered the orbital yards from a flare' },
      { label: 'Ride it out', outcomes: [{ k: 'lose', r: 'alloy', pct: 0.3 }], log: 'rode out a solar flare' },
    ],
    fallback: 0,
  },
  {
    id: 'volunteers',
    eras: [7, 7],
    title: 'Volunteers',
    text: 'Ten thousand people have applied to crew the colony ship. There are berths for a hundred.',
    choices: [
      { label: 'Hold a lottery', outcomes: [{ k: 'mod', label: 'Hope', target: 'stability', x: 15, secs: 900 }], log: 'held a lottery for the colony berths' },
      { label: 'Choose the best', outcomes: [{ k: 'insight', secs: 120 }, { k: 'mod', label: 'Envy', target: 'stability', x: -6, secs: 300 }], log: 'chose its best for the colony berths' },
    ],
    fallback: 0,
  },
];

export const EVENT = new Map(EVENTS.map((e) => [e.id, e]));
