import type { StoryDef } from './types';

/**
 * The main quest: six missions a sector. Each sector runs the same shape — a
 * lead, a landing, a need, a choice, the guardian of the ark section, and the
 * gate — so the player always knows roughly what comes next, while the words
 * and the stakes change.
 *
 * A mission with a node objective (`reach`, `land`, `defeat`, `deliver`) is
 * pinned to a node of the sector map when the sector is generated.
 */
export const STORY: readonly StoryDef[] = [
  // ---------------------------------------------------------------- Sector 1
  {
    id: 's1-wake', sector: 0, title: 'Cold Start',
    brief: 'Follow the ark\'s emergency beacon to the nearest wreckage.',
    objective: { k: 'reach' },
    text: 'The beacon leads you to a slab of the Meridian, turning end over end. Through a torn bulkhead you see rows of cryo cradles, most of them dark. One panel still glows: SECTION 7 OF 12 — DRIFTING. The rest of the ark is out there.',
    choices: [
      { label: 'Pull the flight recorder', ok: { text: 'The recorder holds the jump logs. Now you know roughly where the other sections went.', xp: 20, reveal: true } },
      { label: 'Strip the hull for parts', ok: { text: 'You cut away good plate. It feels like robbing a grave, but the Wren needs it.', mats: { alloy: 3, ore: 8 } } },
    ],
    reward: { text: 'The hunt for the Meridian begins.', xp: 15 },
  },
  {
    id: 's1-land', sector: 0, title: 'Black Box',
    brief: 'Land on the frozen moon and recover the navigation core that fell there.',
    objective: { k: 'land', biome: 'ice' },
    text: 'The navigation core is cracked but readable. It lists twelve sections and twelve last known headings, and one more line, flagged red: UNKNOWN MASS FOLLOWED THROUGH JUMP.',
    reward: { text: 'The core points the way onward.', xp: 30, mats: { circuits: 1 } },
    flag: 'nav-core',
  },
  {
    id: 's1-pods', sector: 0, title: 'Sleepers',
    brief: 'Rescue 4 colonists from cryo pods on the planets of the Shatterbelt.',
    objective: { k: 'rescue', colonists: 4 },
    text: 'Four sleepers thaw in the Wren\'s cargo bay, coughing and frightened. They are farmers, a welder and a child. They are why you\'re out here.',
    reward: { text: 'The rescued sleepers help where they can.', res: { food: 6 }, morale: 15, xp: 25 },
  },
  {
    id: 's1-signal', sector: 0, title: 'Two Voices',
    brief: 'Answer the double signal coming from deep in the belt.',
    objective: { k: 'reach' },
    text: 'Two transmissions on one frequency. A Concord officer orders all ark survivors to report to the Remnant fleet. Under it, a Clan voice laughs and offers better terms: "Salvage is salvage, friend. Bring us what you find and we\'ll keep you flying."',
    choices: [
      { label: 'Answer the Concord', ok: { text: 'The officer logs your name and sends fuel coordinates. "Good. The ark belongs to the fleet."', rep: { concord: 15 }, res: { fuel: 3 } } },
      { label: 'Answer the Clans', ok: { text: 'The Clan voice sends a cache location. "Smart. We\'ll remember you."', rep: { clans: 15 }, mats: { alloy: 2, ore: 6 } } },
      { label: 'Stay silent', ok: { text: 'You keep your own counsel. Neither side knows quite what you are yet.', xp: 20 } },
    ],
    reward: { text: 'You have been noticed.', xp: 15 },
  },
  {
    id: 's1-warden', sector: 0, title: 'The Warden',
    brief: 'Section 7 is guarded by the ark\'s own security ship. Get past it.',
    objective: { k: 'defeat', enemy: 'boss-warden' },
    text: 'The Warden breaks apart, and its last transmission is an apology in the ark\'s gentle voice. Section 7 opens to you: two hundred sleepers, still cold, still alive. Its systems wake and begin, slowly, to follow your ship.',
    reward: { text: 'Ark Section 7 recovered.', xp: 60, colonists: 6, flag: 'ark-1' },
  },
  {
    id: 's1-gate', sector: 0, title: 'Through the Gate',
    brief: 'Jump through the sector gate to the Verdant Reach.',
    objective: { k: 'gate' },
    text: 'The gate opens on green light. Section 7 falls into tow behind you.',
    reward: { text: 'Onward to the Verdant Reach.', xp: 30 },
  },
  // ---------------------------------------------------------------- Sector 2
  {
    id: 's2-market', sector: 1, title: 'Green Worlds',
    brief: 'Find the Clan market rumoured to be trading ark salvage.',
    objective: { k: 'reach' },
    text: 'The market is a ring of lashed-together hulls round a captured comet. On every stall there is something from the Meridian: a cradle lid, a ration tin, a child\'s drawing in a frame. A trader tells you the seed vault came down on a jungle world, and Matriarch Hask has it.',
    choices: [
      { label: 'Buy back the drawing', req: { res: { credits: 20 } }, pay: true, ok: { text: 'You pay. The trader shrugs. Later, one of the rescued sleepers weeps when they see it.', morale: 20, rep: { clans: 5 } } },
      { label: 'Ask about Hask', check: { stat: 'charm', dc: 5 }, ok: { text: 'The trader leans close. "She\'s got guns, but she\'s short of fuel. Always short of fuel."', xp: 30, flag: 'hask-intel' }, fail: { text: 'The trader suddenly remembers urgent business elsewhere.' } },
      { label: 'Move on', ok: { text: 'You leave the market to its trade.' } },
    ],
    reward: { text: 'The trail leads to the seed vault.', xp: 20 },
  },
  {
    id: 's2-vault', sector: 1, title: 'Seed Vault',
    brief: 'Land on the jungle world and recover a seed vault core.',
    objective: { k: 'land', biome: 'jungle' },
    text: 'The vault core is warm. Inside, in nitrogen, are ten thousand species from home. With these, Haven could be a garden.',
    reward: { text: 'Seed vault core recovered. Your hydroponics will never be the same.', xp: 40, mats: { organics: 10 } },
    flag: 'seed-vault',
  },
  {
    id: 's2-feed', sector: 1, title: 'Many Mouths',
    brief: 'The rescued sleepers need a greenhouse. Bring 12 organics and 4 alloy to the marked station.',
    objective: { k: 'deliver', mats: { organics: 12, alloy: 4 } },
    text: 'Station hands help you build a greenhouse into Section 7. By evening there are seedlings under the lamps.',
    reward: { text: 'The greenhouse is growing.', xp: 40, rep: { clans: 10 }, res: { food: 10 } },
  },
  {
    id: 's2-truce', sector: 1, title: 'Terms',
    brief: 'Meet Hask\'s envoy at the marked point.',
    objective: { k: 'reach' },
    text: 'Hask\'s envoy is a teenage girl in a patched pressure suit. "The Matriarch says the seeds are hers by right of salvage. She says she\'ll trade them for your ship."',
    choices: [
      { label: 'Refuse. We take the vault.', ok: { text: '"Then she\'ll see you at the vault," the girl says, and goes.', rep: { clans: -10 }, xp: 20 } },
      { label: 'Offer to share the harvest', check: { stat: 'charm', dc: 6 }, ok: { text: 'The girl thinks about it. "She won\'t take it. But I\'ll tell the others you offered." Some of the Clans will remember this.', rep: { clans: 15 }, xp: 40, flag: 'shared-seeds' }, fail: { text: 'The girl laughs at you. "Share? With ark people?"', rep: { clans: -5 } } },
      { label: 'Show her the sleepers', req: { flag: 'nav-core' }, ok: { text: 'You show her the cradles. She stays silent a long time. "I didn\'t know there were children," she says.', rep: { clans: 10 }, morale: 10, xp: 30 } },
    ],
    reward: { text: 'The matter will be settled at the vault.', xp: 15 },
  },
  {
    id: 's2-hask', sector: 1, title: 'Matriarch',
    brief: 'Matriarch Hask holds Ark Section 3. Take it.',
    objective: { k: 'defeat', enemy: 'boss-matriarch' },
    text: 'Hask\'s flagship limps away with its drive smoking. "Keep the frozen dead, then," she spits over the comm. Section 3 is yours: the ark\'s farms, and three hundred sleepers.',
    reward: { text: 'Ark Section 3 recovered.', xp: 90, colonists: 8, flag: 'ark-2' },
  },
  {
    id: 's2-gate', sector: 1, title: 'Into the Ash',
    brief: 'Jump through the gate to the Ashen Expanse.',
    objective: { k: 'gate' },
    text: 'Behind you, the green worlds shrink. Ahead, the stars are the colour of embers.',
    reward: { text: 'Onward to the Ashen Expanse.', xp: 40 },
  },
  // ---------------------------------------------------------------- Sector 3
  {
    id: 's3-fleet', sector: 2, title: 'The Remnant',
    brief: 'Make contact with the Concord fleet.',
    objective: { k: 'reach' },
    text: 'The Remnant fleet is nine ships. Three of them can still fly. Admiral Strand\'s face fills your screen: grey, rigid, exhausted. "You are towing two ark sections without authority. Surrender them to fleet command."',
    choices: [
      { label: 'Salute and stall', check: { stat: 'charm', dc: 7 }, ok: { text: 'Strand gives you three days to report. Three days is all you need.', rep: { concord: 5 }, xp: 40 }, fail: { text: 'Strand sees straight through you. "Then you are a mutineer."', rep: { concord: -10 } } },
      { label: 'Refuse outright', ok: { text: '"The ark belongs to the people asleep in it." The admiral cuts the link.', rep: { concord: -15 }, xp: 30 } },
      { label: 'Invoke your commission', req: { origin: 'navy' }, ok: { text: 'Your old rank code still clears. Strand hesitates. "Very well, Captain. Report when you can."', rep: { concord: 15 }, xp: 50, flag: 'strand-doubt' } },
    ],
    reward: { text: 'The Concord knows where you are.', xp: 20 },
  },
  {
    id: 's3-drive', sector: 2, title: 'Drive Core',
    brief: 'The ark\'s main drive core fell on a volcanic world. Recover its control rod.',
    objective: { k: 'land', biome: 'volcanic' },
    text: 'The control rod still hums with a little of the jump\'s energy. Holding it, you feel the ship you\'re standing in, and another just like it, very far away.',
    reward: { text: 'Drive control rod recovered.', xp: 60, mats: { exotic: 1 } },
    flag: 'drive-rod',
  },
  {
    id: 's3-pods', sector: 2, title: 'Ashfall',
    brief: 'Rescue colonists until 30 are awake and safe.',
    objective: { k: 'rescue', colonists: 30 },
    text: 'Thirty people now live aboard the sections you tow. They have started calling the convoy "the Wake".',
    reward: { text: 'The Wake grows.', xp: 60, morale: 15, items: { stim: 2 } },
  },
  {
    id: 's3-mutiny', sector: 2, title: 'Mutiny',
    brief: 'A Concord lieutenant wants to talk. Meet her in secret.',
    objective: { k: 'reach' },
    text: 'Lieutenant Oyelaran meets you in a wreck\'s shadow. "Strand will fire on the sections if he can\'t have them. Half the fleet won\'t follow that order. Help me and we\'ll stand aside."',
    choices: [
      { label: 'Give her alloy for her ship', req: { mats: { alloy: 6 } }, pay: true, ok: { text: 'Her ship will hold together, and so will her promise. "When Strand comes, we won\'t."', rep: { concord: 20 }, flag: 'oyelaran', xp: 50 } },
      { label: 'Promise her a berth on Haven', check: { stat: 'charm', dc: 7 }, ok: { text: 'She thinks of her crew. "A berth. For all of them?" You nod. She salutes.', flag: 'oyelaran', rep: { concord: 10 }, xp: 50 }, fail: { text: '"Promises," she says, and turns away.' } },
      { label: 'Refuse. You trust no Concord.', ok: { text: 'She leaves. You wonder whether that was wise.', rep: { concord: -10 } } },
    ],
    reward: { text: 'The fleet is divided.', xp: 20 },
  },
  {
    id: 's3-strand', sector: 2, title: 'The Last Admiral',
    brief: 'Admiral Strand\'s flagship guards Ark Section 9. Break his line.',
    objective: { k: 'defeat', enemy: 'boss-admiral' },
    text: 'The flagship\'s guns fall silent. Strand\'s last message is quiet: "Get them home, Captain. I couldn\'t." Section 9, the ark\'s medical wing, unlocks to you.',
    reward: { text: 'Ark Section 9 recovered.', xp: 120, colonists: 10, flag: 'ark-3', items: { medkit: 3 } },
  },
  {
    id: 's3-gate', sector: 2, title: 'Clan Waters',
    brief: 'Jump through the gate into Clanhold.',
    objective: { k: 'gate' },
    text: 'What\'s left of the Remnant follows at a respectful distance.',
    reward: { text: 'Onward to Clanhold.', xp: 50 },
  },
  // ---------------------------------------------------------------- Sector 4
  {
    id: 's4-hold', sector: 3, title: 'Clanhold',
    brief: 'Reach the Clans\' great hold and ask for passage.',
    objective: { k: 'reach' },
    text: 'The Clanhold is a hundred hulls welded into one great wheel. The Clan Moot hears you out. Most of them want your sections for scrap. A few remember a captain who offered to share.',
    choices: [
      { label: 'Plead your case', check: { stat: 'charm', dc: 8 }, ok: { text: 'Some of the Moot is moved. Some is not. The Dreadnought\'s captain stays unconvinced.', rep: { clans: 15 }, xp: 60 }, fail: { text: 'The Moot jeers.', rep: { clans: -5 } } },
      { label: 'Remind them of the seeds', req: { flag: 'shared-seeds' }, ok: { text: 'Hask\'s envoy stands up in the Moot. "This one offered us half a harvest." The hall goes quiet.', rep: { clans: 25 }, xp: 70, flag: 'clan-friends' } },
      { label: 'Pay tribute', req: { res: { credits: 120 } }, pay: true, ok: { text: 'Credits talk. The Moot grants you passage, everywhere but past the Dreadnought.', rep: { clans: 10 } } },
    ],
    reward: { text: 'The Moot has spoken, more or less.', xp: 25 },
  },
  {
    id: 's4-reactor', sector: 3, title: 'Heart of the Ark',
    brief: 'Recover the ark\'s reactor governor from the toxic world.',
    objective: { k: 'land', biome: 'toxic' },
    text: 'The governor is etched with the names of the engineers who built it. One of them is asleep in Section 9.',
    reward: { text: 'Reactor governor recovered.', xp: 70, mats: { circuits: 3 } },
    flag: 'governor',
  },
  {
    id: 's4-parts', sector: 3, title: 'Refit',
    brief: 'Bring 8 alloy, 4 circuits and 2 relics to the marked station to refit the Wake for the nebula.',
    objective: { k: 'deliver', mats: { alloy: 8, circuits: 4, relic: 2 } },
    text: 'Clan engineers weld baffles to every section. "The Choir sings through hulls," the foreman says. "This will help. A little."',
    reward: { text: 'The Wake is ready for the nebula.', xp: 70, rep: { clans: 10 }, res: { hull: 20 } },
  },
  {
    id: 's4-whisper', sector: 3, title: 'First Chord',
    brief: 'The Choir is broadcasting on the ark\'s frequency. Listen.',
    objective: { k: 'reach' },
    text: 'The signal is music: a chord that changes as you listen, and somehow it knows your name. A voice made of many voices: WE CAME THROUGH WITH YOU. WE DID NOT MEAN TO BREAK IT. WE ARE SORRY. WE WANT TO SEE HAVEN TOO.',
    choices: [
      { label: 'Answer it', check: { stat: 'wits', dc: 8 }, ok: { text: 'You answer in the ark\'s own code. The chord softens. Somewhere in the nebula, something is listening.', rep: { choir: 25 }, flag: 'choir-chord', xp: 80 }, fail: { text: 'Your answer comes out as noise. The chord sours.', rep: { choir: -5 } } },
      { label: 'Jam it', ok: { text: 'The chord breaks off. Silence, and then very faintly, something like weeping.', rep: { choir: -20 }, xp: 30 } },
      { label: 'Record it and move on', ok: { text: 'You keep the recording. Your scientists will be studying it for years.', xp: 40, mats: { crystal: 4 } } },
    ],
    reward: { text: 'The Choir has noticed you.', xp: 25 },
  },
  {
    id: 's4-dread', sector: 3, title: 'The Dreadnought',
    brief: 'The Clanhold Dreadnought holds Ark Section 1, the bridge. Defeat it.',
    objective: { k: 'defeat', enemy: 'boss-dreadnought' },
    text: 'The Dreadnought breaks into its separate hulls, which scatter. Section 1 is yours: the ark\'s bridge, and its captain, still asleep at the helm.',
    reward: { text: 'Ark Section 1 recovered.', xp: 150, colonists: 12, flag: 'ark-4' },
  },
  {
    id: 's4-gate', sector: 3, title: 'Into the Song',
    brief: 'Jump through the gate into the Choir Nebula.',
    objective: { k: 'gate' },
    text: 'The gate opens on a colour you have no word for.',
    reward: { text: 'Onward into the Choir Nebula.', xp: 60 },
  },
  // ---------------------------------------------------------------- Sector 5
  {
    id: 's5-choir', sector: 4, title: 'Within the Choir',
    brief: 'Find the heart of the singing.',
    objective: { k: 'reach' },
    text: 'In the nebula\'s heart the Choir takes shape: a slow storm of light around a seed of something like crystal. IT FOLLOWED US, it sings. THE OTHER. THE ECHO. IT WAS BORN WHEN THE ARK BROKE. IT IS THE ARK THAT DID NOT BREAK. IT IS HUNGRY FOR HAVEN.',
    choices: [
      { label: 'Ask the Choir for help', req: { flag: 'choir-chord' }, ok: { text: 'WE WILL SING YOU A PATH. A map unfolds in your sensors.', reveal: true, rep: { choir: 15 }, xp: 80, flag: 'choir-ally' } },
      { label: 'Study the seed', check: { stat: 'wits', dc: 9 }, ok: { text: 'Your scientists take readings until their eyes burn. Exotic matter, alive, and grieving.', mats: { exotic: 2 }, xp: 90 }, fail: { text: 'The readings make no sense. One of your crew has nightmares for a week.', morale: -10 } },
      { label: 'Leave quietly', ok: { text: 'You leave. The song follows you a while.', xp: 40 } },
    ],
    reward: { text: 'You know what follows the ark.', xp: 30 },
  },
  {
    id: 's5-crystal', sector: 4, title: 'Tuning Fork',
    brief: 'Land on the crystal world and recover a resonance shard.',
    objective: { k: 'land', biome: 'crystal' },
    text: 'The shard rings in your hand, and every crystal on the planet rings back.',
    reward: { text: 'Resonance shard recovered.', xp: 90, mats: { crystal: 8 } },
    flag: 'shard',
  },
  {
    id: 's5-pods', sector: 4, title: 'The Wake',
    brief: 'Bring the Wake to 70 colonists.',
    objective: { k: 'rescue', colonists: 70 },
    text: 'Seventy voices. The Wake holds an election, and a choir of its own, which practises in Section 3\'s greenhouse.',
    reward: { text: 'The Wake is a town now.', xp: 90, morale: 20, res: { food: 15 } },
  },
  {
    id: 's5-split', sector: 4, title: 'Discord',
    brief: 'Part of the Choir has turned against the rest. Meet the dissenters.',
    objective: { k: 'reach' },
    text: 'The dissenting voices are sharp and frightened. THE ECHO PROMISES US HAVEN IF WE SING THE ARK APART AGAIN. WHY SHOULD WE TRUST YOU INSTEAD?',
    choices: [
      { label: 'Offer them a place on Haven', check: { stat: 'charm', dc: 9 }, ok: { text: 'The chord resolves. A few dissenters go back to the main song.', rep: { choir: 20 }, flag: 'choir-mended', xp: 100 }, fail: { text: 'The dissenters scatter, singing in hard intervals.', rep: { choir: -5 } } },
      { label: 'Play them the ark\'s lullaby', req: { flag: 'shard' }, ok: { text: 'The shard rings the cryo-bay lullaby. The dissenters fall still, then join in.', rep: { choir: 25 }, flag: 'choir-mended', xp: 110 } },
      { label: 'Threaten them', check: { stat: 'grit', dc: 8 }, ok: { text: 'They back down, for now.', xp: 60, rep: { choir: -10 } }, fail: { text: 'They laugh, in a minor key.', rep: { choir: -15 } } },
    ],
    reward: { text: 'The Choir\'s song is changing.', xp: 30 },
  },
  {
    id: 's5-chorus', sector: 4, title: 'The First Chorus',
    brief: 'The First Chorus has sided with the Echo and holds Ark Section 12. Silence it.',
    objective: { k: 'defeat', enemy: 'boss-chorus' },
    text: 'The First Chorus fades to one long note and then nothing. Section 12, the ark\'s archive and its library of every human song, falls into your keeping.',
    reward: { text: 'Ark Section 12 recovered.', xp: 190, colonists: 14, flag: 'ark-5' },
  },
  {
    id: 's5-gate', sector: 4, title: 'Haven in Sight',
    brief: 'Jump through the gate to the Haven Approach.',
    objective: { k: 'gate' },
    text: 'Beyond the gate there is a yellow star, and around it, a blue-green world.',
    reward: { text: 'Onward to the Haven Approach.', xp: 70 },
    flag: 'haven-signal',
  },
  // ---------------------------------------------------------------- Sector 6
  {
    id: 's6-signal', sector: 5, title: 'Landing Lights',
    brief: 'Follow the pathfinder beacon the ark dropped on Haven centuries ago.',
    objective: { k: 'reach' },
    text: 'The beacon still runs, patiently counting the days since launch. Its last message was meant for whoever came: WELCOME HOME. THE WATER IS GOOD.',
    choices: [
      { label: 'Download the survey', ok: { text: 'Haven\'s survey maps unfold: rivers, plains and a temperate coast.', reveal: true, xp: 100 } },
      { label: 'Broadcast to the Wake', ok: { text: 'Every section hears it. On the open channel, people are crying.', morale: 30, xp: 80 } },
    ],
    reward: { text: 'Haven is real.', xp: 40 },
  },
  {
    id: 's6-landing', sector: 5, title: 'First Footprints',
    brief: 'Land on Haven\'s sister world and recover the pathfinder\'s survey core.',
    objective: { k: 'land', biome: 'jungle' },
    text: 'The survey core holds a hundred years of weather. Haven will be kind, mostly.',
    reward: { text: 'Survey core recovered.', xp: 110, mats: { exotic: 2 } },
    flag: 'survey',
  },
  {
    id: 's6-supply', sector: 5, title: 'Landfall Stores',
    brief: 'Bring 10 alloy, 6 circuits and 20 organics to the marked station for the first settlement.',
    objective: { k: 'deliver', mats: { alloy: 10, circuits: 6, organics: 20 } },
    text: 'The first shelters are stamped out of alloy and grown circuitry. Seeds from the vault go into the stores.',
    reward: { text: 'The settlement stores are full.', xp: 110, res: { food: 20 } },
  },
  {
    id: 's6-echo-call', sector: 5, title: 'The Echo Speaks',
    brief: 'The Echo has hailed you. Hear it out.',
    objective: { k: 'reach' },
    text: 'The Echo hails you in your own voice. "I am the Meridian that made it. I have no sleepers. Only the memory of them. Give me Haven and I will dream them back." Behind its words, the Choir is singing a warning.',
    choices: [
      { label: 'Refuse it', ok: { text: '"Then I will take it." The line goes dead.', xp: 100 } },
      { label: 'Try to reason with it', check: { stat: 'wits', dc: 10 }, ok: { text: 'You find the fault in its logic: the jump that made it can unmake it. It goes quiet for a long time.', xp: 140, flag: 'echo-doubt' }, fail: { text: 'It laughs, with the ark\'s gentle voice.', morale: -10 } },
      { label: 'Ask the Choir to sing', req: { flag: 'choir-ally' }, ok: { text: 'The Choir sings, and the Echo flinches. Its shields will be weaker when you meet it.', xp: 120, flag: 'echo-weak' } },
    ],
    reward: { text: 'Only the Echo stands between the Wake and Haven.', xp: 40 },
  },
  {
    id: 's6-echo', sector: 5, title: 'The Echo',
    brief: 'Defeat the Echo before it reaches Haven.',
    objective: { k: 'defeat', enemy: 'boss-echo' },
    text: 'The Echo comes apart into light. In its wreck you find something impossible: a thirteenth ark section that matches none of the twelve, full of sleepers who never boarded. They are waking.',
    reward: { text: 'The Echo is gone. The thirteenth section is yours.', xp: 240, colonists: 20, flag: 'ark-6' },
  },
  {
    id: 's6-haven', sector: 5, title: 'Haven',
    brief: 'Bring the Wake home. Reach Haven through the final gate.',
    objective: { k: 'gate' },
    text: 'Haven fills the window: blue water, green land, white cloud. Behind you the Wake strings out in a line of lights: every section you saved, every sleeper, every crew member who held on. The landing order is yours to give.',
    choices: [
      { label: 'Settle: the ark lands alone', ok: { text: 'The Meridian\'s people take Haven as the founders planned. The Clans and the Concord go back to the dark. A quiet world and a careful one. In a hundred years, children will ask what lies past the sky.', flag: 'end-settle' } },
      { label: 'Share: everyone lands', ok: { text: 'Clan hulls, Concord ships and ark sections come down together on the same coast. It is loud and quarrelsome, and it is alive. The Choir settles over the poles as an aurora that hums lullabies at night.', flag: 'end-share' } },
      { label: 'Sever: burn the gates behind you', ok: { text: 'You close the gates for good. Nothing more will follow the ark. Haven is safe, and alone, and it will remember the price.', flag: 'end-sever' } },
    ],
    reward: { text: 'The Wake has come home.', xp: 300 },
  },
];
export const STORY_BY_ID = new Map(STORY.map((s) => [s.id, s]));
export function storyForSector(sector: number): StoryDef[] {
  return STORY.filter((s) => s.sector === sector);
}
