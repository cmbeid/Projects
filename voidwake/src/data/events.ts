import type { EventDef } from './types';

/**
 * Random encounters. Arriving at a derelict, asteroid field, nebula, anomaly,
 * distress call or patrol draws one of these, weighted, from those that fit
 * the node and the sector. Checks go to the best crew member for the stat;
 * the panel shows the odds before you commit.
 */
export const EVENTS: readonly EventDef[] = [
  // ------------------------------------------------------------ Derelicts
  {
    id: 'dr-freighter', title: 'Dead Freighter', kinds: ['derelict'],
    text: 'A cargo hauler drifts dark, cargo doors open to space. Its manifest beacon still blinks: ORE, FOOD, MEDICAL.',
    choices: [
      { label: 'Board and search', check: { stat: 'grit', dc: 5 }, ok: { text: 'You come back with full arms.', mats: { ore: 8, organics: 4 }, res: { food: 4 }, xp: 15 }, fail: { text: 'A bulkhead gives way. Your crewmate gets out, bruised.', hpOne: -12, mats: { ore: 4 } } },
      { label: 'Scan first', check: { stat: 'wits', dc: 6 }, ok: { text: 'The scan finds a sealed medical locker.', items: { medkit: 2 }, res: { food: 3 }, xp: 15 }, fail: { text: 'Nothing on the scan. You leave it be.' } },
      { label: 'Leave it', ok: { text: 'Some graves are best left alone.' } },
    ],
  },
  {
    id: 'dr-cryo', title: 'Stray Cradle', kinds: ['derelict', 'distress'],
    text: 'A single ark cryo cradle tumbles through the void, its status light flickering amber.',
    choices: [
      { label: 'Bring it aboard', ok: { text: 'The sleeper inside wakes, confused but alive.', colonists: 1, xp: 15, morale: 5 } },
      { label: 'Wake them as crew', check: { stat: 'wits', dc: 5 }, ok: { text: 'They thaw cleanly and want to help.', recruit: 'any', xp: 10 }, fail: { text: 'The thaw goes badly. They\'ll live, but they\'ll need the Wake\'s doctors.', colonists: 1 } },
    ],
  },
  {
    id: 'dr-booby', title: 'Too Quiet', kinds: ['derelict'], minSector: 1,
    text: 'An intact Clan cutter, its airlock open as if in welcome. Its reactor is still warm.',
    choices: [
      { label: 'Board carefully', check: { stat: 'wits', dc: 7 }, ok: { text: 'You find the tripwire and the stash behind it.', mats: { alloy: 4, circuits: 1 }, res: { credits: 40 }, xp: 25 }, fail: { text: 'The tripwire finds you first.', hpOne: -20, res: { hull: -5 } } },
      { label: 'Shoot the reactor and scoop the debris', ok: { text: 'The cutter goes up. You net what\'s left.', mats: { ore: 6, alloy: 1 }, rep: { clans: -5 } } },
      { label: 'Leave it', ok: { text: 'You keep your distance.' } },
    ],
  },
  {
    id: 'dr-ark-locker', title: 'Ark Locker', kinds: ['derelict'],
    text: 'A torn-off piece of the Meridian, with an equipment locker welded shut.',
    choices: [
      { label: 'Cut it open', check: { stat: 'grit', dc: 6 }, ok: { text: 'Inside, sealed kit in perfect condition.', gear: true, xp: 20 }, fail: { text: 'The cutter slips and the locker\'s contents are slag.', mats: { relic: 1 } } },
      { label: 'Override the lock', check: { stat: 'wits', dc: 6, cls: 'engineer' }, ok: { text: 'The lock clicks open.', gear: true, mats: { circuits: 1 }, xp: 25 }, fail: { text: 'The lock seizes for good.' } },
    ],
  },
  {
    id: 'dr-ghost', title: 'Ghost Signal', kinds: ['derelict', 'anomaly'],
    text: 'A dead patrol craft is still broadcasting a log on loop. The pilot\'s voice: "...don\'t look at the light, don\'t look at..."',
    choices: [
      { label: 'Download the logs', check: { stat: 'wits', dc: 6 }, ok: { text: 'Coordinates of three nearby caches.', reveal: true, xp: 25 }, fail: { text: 'Corrupted. One crew member can\'t stop humming the static.', morale: -8 } },
      { label: 'Salvage the hull', ok: { text: 'Good plate. Nobody talks much on the way back.', mats: { alloy: 2, ore: 5 }, morale: -4 } },
    ],
  },
  {
    id: 'dr-hydro', title: 'Overgrown Hulk', kinds: ['derelict'],
    text: 'A colony barge is overgrown with its own garden. The plants are thriving in the dark.',
    choices: [
      { label: 'Harvest', ok: { text: 'You strip what you can carry.', mats: { organics: 10 }, res: { food: 6 } } },
      { label: 'Take cuttings for hydroponics', check: { stat: 'wits', dc: 6, cls: 'scientist' }, ok: { text: 'The cuttings take. Your hydroponics bay blooms.', res: { food: 12 }, mats: { organics: 4 }, xp: 25 }, fail: { text: 'The cuttings wilt on the way back.', mats: { organics: 4 } } },
    ],
  },
  {
    id: 'dr-armory', title: 'Concord Armoury Barge', kinds: ['derelict'], minSector: 2,
    text: 'A Concord supply barge, scuttled but not well. The Remnant would want this back.',
    choices: [
      { label: 'Take what you can', ok: { text: 'Military-grade kit, now yours.', gear: true, mats: { alloy: 3 }, rep: { concord: -10 } } },
      { label: 'Report it to the Concord', ok: { text: 'The Remnant thanks you and sends a finder\'s fee.', res: { credits: 70 }, rep: { concord: 15 } } },
    ],
  },
  {
    id: 'dr-survivor', title: 'Lone Survivor', kinds: ['derelict', 'distress'],
    text: 'Life signs on a wrecked scout. A woman in a cracked suit waves at your cameras.',
    choices: [
      { label: 'Rescue her', ok: { text: 'She\'s a drifter with nowhere to go. She signs on.', recruit: 'any', xp: 15 } },
      { label: 'Rescue her, then question her', check: { stat: 'charm', dc: 6 }, ok: { text: 'She tells you where her crew stashed their haul.', recruit: 'any', res: { credits: 40 } }, fail: { text: 'She clams up and leaves at the next station.' } },
    ],
  },
  {
    id: 'dr-reactor', title: 'Leaking Reactor', kinds: ['derelict'],
    text: 'A wreck with a reactor still running hot. There\'s energy to be had, and radiation.',
    choices: [
      { label: 'Siphon power', check: { stat: 'grit', dc: 6 }, ok: { text: 'Your batteries fill.', res: { energy: 20 }, xp: 15 }, fail: { text: 'Radiation burns. The batteries fill anyway.', res: { energy: 12 }, hpOne: -15 } },
      { label: 'Pull the core', check: { stat: 'wits', dc: 8, cls: 'engineer' }, ok: { text: 'A cored reactor, safely shielded. Worth a fortune in crystal.', mats: { crystal: 6, exotic: 1 }, xp: 30 }, fail: { text: 'You abort before it melts. Nobody is hurt.' } },
    ],
  },
  {
    id: 'dr-library', title: 'Data Vault', kinds: ['derelict'], minSector: 1,
    text: 'An ark data vault, intact. Its contents could teach you a lot.',
    choices: [
      { label: 'Study it', ok: { text: 'Your crew learn from the old archives.', xp: 50 } },
      { label: 'Sell the storage crystal', ok: { text: 'Storage crystal is worth something to anyone.', mats: { crystal: 5, relic: 1 } } },
    ],
  },
  {
    id: 'dr-mimic', title: 'Wreck That Moves', kinds: ['derelict'], minSector: 2,
    text: 'The wreck you are approaching has changed shape since your last scan.',
    choices: [
      { label: 'Open fire', ok: { text: 'It was a Reaver, playing dead.', combat: 'reaver' } },
      { label: 'Back away slowly', check: { stat: 'reflex', dc: 7 }, ok: { text: 'You slip away before it wakes.', xp: 20 }, fail: { text: 'It wakes.', combat: 'reaver' } },
    ],
  },
  // ------------------------------------------------------------ Asteroids
  {
    id: 'as-mine', title: 'Rich Field', kinds: ['asteroids'],
    text: 'Fat, slow rocks streaked with metal. Good mining, if you can hold position.',
    choices: [
      { label: 'Mine carefully', ok: { text: 'Steady work, steady haul.', mats: { ore: 10, ice: 3 }, days: 1 } },
      { label: 'Mine hard and fast', check: { stat: 'reflex', dc: 6, cls: 'pilot' }, ok: { text: 'A great haul, and not a scratch on the hull.', mats: { ore: 16, ice: 5, crystal: 2 }, xp: 15 }, fail: { text: 'A rock clips the hull.', mats: { ore: 9 }, res: { hull: -6 } } },
    ],
  },
  {
    id: 'as-ice', title: 'Comet Tail', kinds: ['asteroids', 'nebula'],
    text: 'A comet sheds glittering ice as it passes.',
    choices: [
      { label: 'Scoop ice', ok: { text: 'Your tanks fill with good clean ice.', mats: { ice: 12 } } },
      { label: 'Ride the tail', check: { stat: 'reflex', dc: 6 }, ok: { text: 'You ride the tail, scooping and skimming. Fuel and ice.', mats: { ice: 10 }, res: { fuel: 2 }, xp: 15 }, fail: { text: 'You get shaken around, but you still come out with ice.', mats: { ice: 6 }, res: { hull: -4 } } },
    ],
  },
  {
    id: 'as-storm', title: 'Rockstorm', kinds: ['asteroids'],
    text: 'Two fields are colliding. The space around you is full of grinding stone.',
    choices: [
      { label: 'Thread through', check: { stat: 'reflex', dc: 7, cls: 'pilot' }, ok: { text: 'Perfect flying. Crystal shards everywhere.', mats: { crystal: 4, ore: 4 }, xp: 25 }, fail: { text: 'Bang. Bang. Bang.', res: { hull: -10 } } },
      { label: 'Shield up and wait it out', ok: { text: 'You burn energy and a day waiting.', res: { energy: -8 }, days: 1 } },
    ],
  },
  {
    id: 'as-claim', title: 'Claim Jumper', kinds: ['asteroids'],
    text: 'A Clan miner hails you. "This rock is claimed. Go dig somewhere else, or pay."',
    choices: [
      { label: 'Pay 20 credits for a share', req: { res: { credits: 20 } }, pay: true, ok: { text: 'He lets you work the rich side.', mats: { ore: 12, crystal: 2 }, rep: { clans: 5 } } },
      { label: 'Talk him round', check: { stat: 'charm', dc: 6 }, ok: { text: 'He laughs and shares the claim.', mats: { ore: 10 }, rep: { clans: 5 }, xp: 15 }, fail: { text: 'He calls his friends.', combat: 'raider' } },
      { label: 'Leave', ok: { text: 'Not worth the trouble.' } },
    ],
  },
  {
    id: 'as-geode', title: 'Hollow Rock', kinds: ['asteroids'], minSector: 1,
    text: 'One asteroid rings hollow on sonar. A geode the size of a house.',
    choices: [
      { label: 'Crack it', check: { stat: 'grit', dc: 6 }, ok: { text: 'Crystal, floor to ceiling.', mats: { crystal: 8 }, xp: 15 }, fail: { text: 'The shell shatters and most of it scatters.', mats: { crystal: 3 } } },
      { label: 'Scan the interior', check: { stat: 'wits', dc: 7 }, ok: { text: 'There\'s something inside that is not a crystal: a seed of exotic matter.', mats: { crystal: 4, exotic: 1 }, xp: 25 }, fail: { text: 'Just crystal, nothing more.', mats: { crystal: 4 } } },
    ],
  },
  {
    id: 'as-hermit', title: 'Rock Hermit', kinds: ['asteroids'],
    text: 'Someone has hollowed out an asteroid and lives in it. He waves you in for tea.',
    choices: [
      { label: 'Visit', ok: { text: 'He trades you food for stories of the ark.', res: { food: 6 }, morale: 8 } },
      { label: 'Trade ore for his ice', req: { mats: { ore: 6 } }, pay: true, ok: { text: 'He likes ore.', mats: { ice: 10 }, res: { fuel: 1 } } },
    ],
  },
  {
    id: 'as-ambush', title: 'Rocks with Teeth', kinds: ['asteroids'],
    text: 'Engine signatures light up among the rocks. Scavengers have set an ambush.',
    choices: [
      { label: 'Fight', ok: { text: 'They come at you.', combat: '@sector' } },
      { label: 'Hide in the rocks', check: { stat: 'reflex', dc: 6 }, ok: { text: 'You go dark and they pass you by.', xp: 15 }, fail: { text: 'They spot you.', combat: '@sector' } },
    ],
  },
  // ------------------------------------------------------------ Nebulae
  {
    id: 'ne-blind', title: 'Blind Running', kinds: ['nebula'],
    text: 'The nebula\'s static fills your sensors. You\'re flying by instinct.',
    choices: [
      { label: 'Push through', check: { stat: 'reflex', dc: 6, cls: 'pilot' }, ok: { text: 'You come out the far side clean.', xp: 20 }, fail: { text: 'You scrape something unseen.', res: { hull: -6, fuel: -1 } } },
      { label: 'Drift and wait', ok: { text: 'It costs a day, but it\'s safe.', days: 1, res: { energy: -4 } } },
    ],
  },
  {
    id: 'ne-gas', title: 'Fuel Gas', kinds: ['nebula'],
    text: 'This nebula is dense with burnable hydrogen.',
    choices: [
      { label: 'Skim the gas', ok: { text: 'The fuel tanks fill slowly.', res: { fuel: 3 }, days: 1 } },
      { label: 'Skim deep', check: { stat: 'grit', dc: 6 }, ok: { text: 'Deep skim, full tanks.', res: { fuel: 6 }, xp: 15 }, fail: { text: 'The pressure crushes a vent.', res: { fuel: 2, hull: -8 } } },
    ],
  },
  {
    id: 'ne-whales', title: 'Void Whales', kinds: ['nebula', 'anomaly'], minSector: 1,
    text: 'Vast shapes swim through the gas, glowing softly. They seem curious about the Wren.',
    choices: [
      { label: 'Watch them', ok: { text: 'The crew crowd the viewports. Nobody speaks.', morale: 20, xp: 10 } },
      { label: 'Study them', check: { stat: 'wits', dc: 7, cls: 'scientist' }, ok: { text: 'They shed crystal scales as they swim.', mats: { crystal: 5 }, xp: 30 }, fail: { text: 'They swim away from your scanning beams.', morale: 5 } },
    ],
  },
  {
    id: 'ne-lurker', title: 'Something in the Fog', kinds: ['nebula'],
    text: 'A contact pings, vanishes and pings again, closer each time.',
    choices: [
      { label: 'Turn and fight', ok: { text: 'It was waiting for you.', combat: '@sector' } },
      { label: 'Run silent', check: { stat: 'wits', dc: 7 }, ok: { text: 'It loses you in the static.', xp: 20 }, fail: { text: 'It finds you.', combat: '@sector' } },
    ],
  },
  {
    id: 'ne-static', title: 'Static Storm', kinds: ['nebula'],
    text: 'Charged gas crackles across your hull, playing havoc with your systems.',
    choices: [
      { label: 'Ground the hull', check: { stat: 'wits', dc: 6, cls: 'engineer' }, ok: { text: 'You bleed the charge into your batteries.', res: { energy: 15 }, xp: 20 }, fail: { text: 'The surge blows a bank of circuits.', res: { energy: -10 } } },
      { label: 'Ride it out', ok: { text: 'You lose some charge and some nerve.', res: { energy: -6 }, morale: -4 } },
    ],
  },
  {
    id: 'ne-garden', title: 'Nebula Bloom', kinds: ['nebula'], minSector: 2,
    text: 'Microbial life drifts in clouds here, thick enough to harvest.',
    choices: [
      { label: 'Net it', ok: { text: 'Organics by the tonne.', mats: { organics: 12 } } },
      { label: 'Culture it for food', check: { stat: 'wits', dc: 7 }, ok: { text: 'It tastes awful and it\'s nutritious.', res: { food: 14 }, xp: 20 }, fail: { text: 'It spoils. Some of it, anyway.', res: { food: 4 } } },
    ],
  },
  // ------------------------------------------------------------ Anomalies
  {
    id: 'an-mirror', title: 'Mirror Ship', kinds: ['anomaly'],
    text: 'A ship identical to the Wren sits motionless. Its hull number is yours. Its cockpit is empty.',
    choices: [
      { label: 'Board it', check: { stat: 'grit', dc: 7 }, ok: { text: 'Inside, supplies stowed exactly where you\'d stow them. You take them.', res: { fuel: 3, food: 6 }, xp: 25 }, fail: { text: 'The mirror ship folds away into nothing while you\'re aboard. You get back, shaken.', hpOne: -10, morale: -10 } },
      { label: 'Fly away fast', ok: { text: 'Nobody argues.', morale: -3 } },
    ],
  },
  {
    id: 'an-time', title: 'Slow Field', kinds: ['anomaly'],
    text: 'Time is wrong here. Your clocks disagree with each other.',
    choices: [
      { label: 'Cross the field', check: { stat: 'wits', dc: 7 }, ok: { text: 'You come out a day earlier than you went in. Somehow, the crew feel rested.', hpAll: 10, xp: 25 }, fail: { text: 'You lose three days in an hour.', days: 3 } },
      { label: 'Go around', ok: { text: 'The long way round costs fuel.', res: { fuel: -1 } } },
    ],
  },
  {
    id: 'an-voice', title: 'The Voice', kinds: ['anomaly'], minSector: 2,
    text: 'A voice in the comm static, speaking a crew member\'s name. Their mother\'s voice.',
    choices: [
      { label: 'Let them answer', check: { stat: 'grit', dc: 7 }, ok: { text: 'They say goodbye. They\'re steadier afterwards.', morale: 15, xp: 30 }, fail: { text: 'They don\'t sleep for days.', morale: -15 } },
      { label: 'Cut the comms', ok: { text: 'Silence. It\'s better this way.', morale: -3 } },
    ],
  },
  {
    id: 'an-relic', title: 'Ancient Beacon', kinds: ['anomaly'], minSector: 1,
    text: 'A spire of black stone, older than any species you know, pulses with light.',
    choices: [
      { label: 'Touch it', check: { stat: 'wits', dc: 8 }, ok: { text: 'Knowledge floods your sensors: a map, a key, a gift.', mats: { relic: 3, exotic: 1 }, reveal: true, xp: 40 }, fail: { text: 'The light hurts.', hpOne: -15, mats: { relic: 1 } } },
      { label: 'Take samples', ok: { text: 'Chips of black stone.', mats: { relic: 2 } } },
    ],
  },
  {
    id: 'an-rift', title: 'Rift', kinds: ['anomaly'],
    text: 'A wound in space, leaking light. Fragments of other places tumble out.',
    choices: [
      { label: 'Fish for debris', check: { stat: 'reflex', dc: 7 }, ok: { text: 'A haul from somewhere else entirely.', mats: { exotic: 1, crystal: 3, alloy: 2 }, xp: 30 }, fail: { text: 'Something tumbles out and hits you.', res: { hull: -10 } } },
      { label: 'Study it from range', check: { stat: 'wits', dc: 6, cls: 'scientist' }, ok: { text: 'Fascinating data.', xp: 45 }, fail: { text: 'Inconclusive.', xp: 10 } },
    ],
  },
  {
    id: 'an-choir', title: 'A Song', kinds: ['anomaly', 'nebula'], minSector: 3,
    text: 'A slow chord rises through the hull, not quite in tune with itself.',
    choices: [
      { label: 'Hum back', check: { stat: 'charm', dc: 8 }, ok: { text: 'The chord resolves. A gift of crystal drifts toward you.', rep: { choir: 10 }, mats: { crystal: 6 }, xp: 30 }, fail: { text: 'The chord sours and the crew get headaches.', morale: -8 } },
      { label: 'Record it', ok: { text: 'The recording is beautiful. The crew play it at night.', morale: 10 } },
    ],
  },
  {
    id: 'an-star', title: 'Dying Star', kinds: ['anomaly', 'system'],
    text: 'This star is in its last century. Its flares are spectacular, and dangerous.',
    choices: [
      { label: 'Charge from the flares', check: { stat: 'reflex', dc: 7, cls: 'pilot' }, ok: { text: 'Energy floods your batteries.', res: { energy: 30 }, xp: 25 }, fail: { text: 'A flare scorches the hull.', res: { hull: -12, energy: 10 } } },
      { label: 'Admire it from a distance', ok: { text: 'The crew watch it burn.', morale: 8 } },
    ],
  },
  // ------------------------------------------------------------ Distress
  {
    id: 'di-family', title: 'Mayday', kinds: ['distress'],
    text: 'A family on a broken-down shuttle, life support failing. Two adults, three children.',
    choices: [
      { label: 'Give them supplies', req: { res: { food: 4, energy: 6 } }, pay: true, ok: { text: 'They thank you in tears. Later, the Clans hear what you did.', rep: { clans: 10 }, morale: 15, xp: 20 } },
      { label: 'Take them aboard', ok: { text: 'They join the Wake. Five more mouths, five more hands.', colonists: 5, res: { food: -3 }, morale: 10 } },
      { label: 'Leave them', ok: { text: 'You can\'t save everyone. The crew are very quiet.', morale: -15 } },
    ],
  },
  {
    id: 'di-trap', title: 'Bait', kinds: ['distress'], minSector: 1,
    text: 'A crying voice begs for help. The signal is a little too clean.',
    choices: [
      { label: 'Go in anyway', ok: { text: 'It\'s an ambush.', combat: '@sector' } },
      { label: 'Check the signal', check: { stat: 'wits', dc: 6 }, ok: { text: 'A recording. You track the raiders\' stash instead.', res: { credits: 50 }, mats: { alloy: 2 }, xp: 25 }, fail: { text: 'You can\'t tell. You leave, uneasy.' } },
    ],
  },
  {
    id: 'di-medic', title: 'Plague Ship', kinds: ['distress'],
    text: 'A Concord medical ship. Half the crew are sick with something nobody can identify.',
    choices: [
      { label: 'Help them', check: { stat: 'wits', dc: 7, cls: 'medic' }, ok: { text: 'You find the cure: a bad batch of rations. They are grateful.', rep: { concord: 15 }, res: { credits: 60 }, items: { medkit: 2 }, xp: 35 }, fail: { text: 'You help where you can, and catch some of it.', hpAll: -8, rep: { concord: 5 } } },
      { label: 'Send them medkits', req: { items: { medkit: 1 } }, pay: true, ok: { text: 'It\'s not much, but it helps.', rep: { concord: 10 } } },
      { label: 'Keep your distance', ok: { text: 'You can\'t risk the crew.' } },
    ],
  },
  {
    id: 'di-pods', title: 'Pod Cluster', kinds: ['distress'],
    text: 'A cluster of ark escape pods, beacons beeping in unison.',
    choices: [
      { label: 'Recover them all', ok: { text: 'Three sleepers, all alive.', colonists: 3, xp: 20, days: 1 } },
      { label: 'Recover quickly', check: { stat: 'reflex', dc: 6 }, ok: { text: 'You snag them all in one pass.', colonists: 3, xp: 20 }, fail: { text: 'You lose one pod to the dark.', colonists: 2 } },
    ],
  },
  {
    id: 'di-stranded', title: 'Out of Gas', kinds: ['distress'],
    text: 'A Clan trader, out of fuel, offers to pay well for a little help.',
    choices: [
      { label: 'Give 2 fuel', req: { res: { fuel: 2 } }, pay: true, ok: { text: 'He pays double and spreads the word.', res: { credits: 60 }, rep: { clans: 10 } } },
      { label: 'Tow him to safety', ok: { text: 'It costs you a day. He gives you a crate of ration bars.', days: 1, res: { food: 8 }, rep: { clans: 5 } } },
      { label: 'Rob him', check: { stat: 'grit', dc: 5 }, ok: { text: 'You take his cargo.', mats: { alloy: 3, organics: 6 }, rep: { clans: -15 }, morale: -5 }, fail: { text: 'He fights back.', combat: 'raider', rep: { clans: -10 } } },
    ],
  },
  {
    id: 'di-deserter', title: 'Deserter', kinds: ['distress'], minSector: 2,
    text: 'A Concord pilot in a stolen fighter begs asylum. Strand\'s fleet wants her back.',
    choices: [
      { label: 'Take her in', ok: { text: 'She\'s an excellent pilot.', recruit: 'pilot', rep: { concord: -10 } } },
      { label: 'Turn her over', ok: { text: 'The Concord pays a bounty. She looks at you as they take her.', res: { credits: 80 }, rep: { concord: 15 }, morale: -10 } },
    ],
  },
  {
    id: 'di-miners', title: 'Cave-in', kinds: ['distress', 'system'],
    text: 'Miners are trapped on a moon after a cave-in. Their air is running out.',
    choices: [
      { label: 'Dig them out', check: { stat: 'grit', dc: 6 }, ok: { text: 'Every miner comes out alive. They insist on paying.', res: { credits: 50 }, mats: { ore: 8 }, xp: 25 }, fail: { text: 'You get most of them out.', mats: { ore: 4 }, hpOne: -10 } },
      { label: 'Send down air', req: { items: { o2can: 1 } }, pay: true, ok: { text: 'They hold out until help arrives.', res: { credits: 30 } } },
    ],
  },
  // ------------------------------------------------------------ Systems (arrival flavour)
  {
    id: 'sy-trader', title: 'Wandering Trader', kinds: ['system', 'entry'], weight: 0.6,
    text: 'A trader in a patched-up barge hails you. "Fuel for food, food for fuel. Fair rates."',
    choices: [
      { label: 'Trade 5 food for 2 fuel', req: { res: { food: 5 } }, pay: true, ok: { text: 'Done.', res: { fuel: 2 } } },
      { label: 'Trade 2 fuel for 6 food', req: { res: { fuel: 2 } }, pay: true, ok: { text: 'Done.', res: { food: 6 } } },
      { label: 'Trade 30 credits for a medkit', req: { res: { credits: 30 } }, pay: true, ok: { text: 'Done.', items: { medkit: 1 } } },
      { label: 'No thanks', ok: { text: 'He waves and drifts off.' } },
    ],
  },
  {
    id: 'sy-flare', title: 'Solar Flare', kinds: ['system'], weight: 0.6,
    text: 'The star erupts as you arrive.',
    choices: [
      { label: 'Hide behind a planet', check: { stat: 'reflex', dc: 6, cls: 'pilot' }, ok: { text: 'You swing behind a moon just in time.', xp: 15 }, fail: { text: 'The flare scours your hull.', res: { hull: -8 } } },
      { label: 'Raise shields', ok: { text: 'You burn energy to keep the radiation out.', res: { energy: -10 } } },
    ],
  },
  {
    id: 'sy-moon', title: 'Shepherd Moon', kinds: ['system'], weight: 0.5,
    text: 'A tiny moon in the rings is made almost entirely of ice.',
    choices: [
      { label: 'Harvest it', ok: { text: 'You fill the tanks.', mats: { ice: 10 } } },
    ],
  },
  {
    id: 'sy-sick', title: 'Space Fever', kinds: ['system', 'entry', 'station'], weight: 0.4,
    text: 'A crew member wakes up burning with fever.',
    choices: [
      { label: 'Use a medkit', req: { items: { medkit: 1 } }, pay: true, ok: { text: 'The fever breaks within the hour.' } },
      { label: 'Treat them', check: { stat: 'wits', dc: 6, cls: 'medic' }, ok: { text: 'Rest and fluids. They\'ll be fine.', xp: 15 }, fail: { text: 'It spreads before it breaks.', hpAll: -10 } },
      { label: 'Let it run its course', ok: { text: 'It hits them hard.', hpOne: -25 } },
    ],
  },
  {
    id: 'sy-quarrel', title: 'Quarrel', kinds: ['system', 'entry', 'nebula'], weight: 0.4,
    text: 'Two crew members are at each other\'s throats over the last coffee.',
    choices: [
      { label: 'Mediate', check: { stat: 'charm', dc: 6 }, ok: { text: 'They end up laughing about it.', morale: 10, xp: 15 }, fail: { text: 'Now they\'re both angry at you.', morale: -10 } },
      { label: 'Break out the good rations', req: { res: { food: 3 } }, pay: true, ok: { text: 'Full bellies, calm heads.', morale: 12 } },
    ],
  },
  {
    id: 'sy-birthday', title: 'Ship\'s Birthday', kinds: ['system', 'entry'], weight: 0.25, unique: true,
    text: 'Someone remembers it\'s been a year since the Wren\'s last refit. They want a party.',
    choices: [
      { label: 'Throw the party', req: { res: { food: 4 } }, pay: true, ok: { text: 'Music, bad singing, worse cake. Everyone\'s spirits lift.', morale: 25 } },
      { label: 'No time', ok: { text: 'Grumbles.', morale: -5 } },
    ],
  },
  {
    id: 'sy-ruins', title: 'Orbital Ruins', kinds: ['system'], weight: 0.5, minSector: 1,
    text: 'A ring of ancient stations orbits this star, long dead.',
    choices: [
      { label: 'Explore', check: { stat: 'wits', dc: 7 }, ok: { text: 'Relics and an old map.', mats: { relic: 2 }, reveal: true, xp: 25 }, fail: { text: 'Nothing but dust.', xp: 5 } },
      { label: 'Salvage', ok: { text: 'Old, strange alloy.', mats: { alloy: 3 } } },
    ],
  },
  // ------------------------------------------------------------ Patrols
  {
    id: 'pa-clans', title: 'Clan Patrol', kinds: ['patrol'], faction: 'clans',
    text: 'A pair of painted Clan raiders swing in. "Toll\'s due, ark-friend."',
    choices: [
      { label: 'Pay the toll (25 credits)', req: { res: { credits: 25 } }, pay: true, ok: { text: 'They wave you through.', rep: { clans: 5 } } },
      { label: 'Greet them as friends', req: { rep: { clans: 30 } }, ok: { text: '"Oh, it\'s you! Pass, friend." They toss over some spare ore.', mats: { ore: 6 } } },
      { label: 'Bluff', check: { stat: 'charm', dc: 6 }, ok: { text: '"Fine, fine. Go." They lose interest.', xp: 15 }, fail: { text: 'They don\'t buy it.', combat: 'raider' } },
      { label: 'Fight', ok: { text: 'Guns hot.', combat: 'raider', rep: { clans: -5 } } },
    ],
  },
  {
    id: 'pa-concord', title: 'Concord Checkpoint', kinds: ['patrol'], faction: 'concord',
    text: 'A Concord interceptor orders you to hold for inspection.',
    choices: [
      { label: 'Submit to inspection', ok: { text: 'They confiscate some "ark property" and let you go.', mats: { relic: -2, alloy: -1 }, rep: { concord: 5 } } },
      { label: 'Show your papers', req: { rep: { concord: 25 } }, ok: { text: 'They salute and share a fuel ration.', res: { fuel: 2 } } },
      { label: 'Talk your way past', check: { stat: 'charm', dc: 7 }, ok: { text: 'The officer is tired and lets you go.', xp: 15 }, fail: { text: '"Prepare to be boarded."', combat: 'interceptor' } },
      { label: 'Run for it', check: { stat: 'reflex', dc: 7 }, ok: { text: 'You outrun them.', rep: { concord: -5 }, xp: 15 }, fail: { text: 'They catch you.', combat: 'interceptor', rep: { concord: -5 } } },
    ],
  },
  {
    id: 'pa-choir', title: 'Choir Sentinel', kinds: ['patrol'], faction: 'choir',
    text: 'A Choir drone hangs in your path, singing a single questioning note.',
    choices: [
      { label: 'Sing the answer', req: { flag: 'choir-chord' }, ok: { text: 'The drone hums happily and lets you pass. It leaves a crystal behind.', mats: { crystal: 3 }, rep: { choir: 5 } } },
      { label: 'Wait patiently', check: { stat: 'wits', dc: 7 }, ok: { text: 'It studies you, then moves on.', xp: 20 }, fail: { text: 'Its note turns sharp.', combat: 'drone' } },
      { label: 'Attack', ok: { text: 'It screams.', combat: 'drone', rep: { choir: -10 } } },
    ],
  },
  {
    id: 'pa-pirates', title: 'Pirates', kinds: ['patrol'], faction: 'none',
    text: 'An unmarked ship powers up its weapons. "Cargo or your life."',
    choices: [
      { label: 'Hand over supplies', req: { res: { food: 4, fuel: 1 } }, pay: true, ok: { text: 'They take it and go.' } },
      { label: 'Fight', ok: { text: 'Not today.', combat: '@sector' } },
      { label: 'Intimidate', check: { stat: 'grit', dc: 7 }, ok: { text: 'They think better of it.', xp: 20 }, fail: { text: 'They laugh, and attack.', combat: '@sector' } },
    ],
  },
  {
    id: 'pa-reaver', title: 'Reaver', kinds: ['patrol', 'nebula'], minSector: 3, weight: 0.6,
    text: 'A black ship, no markings, coming straight for you.',
    choices: [
      { label: 'Fight', ok: { text: 'There\'s no talking to Reavers.', combat: 'reaver' } },
      { label: 'Burn hard away', check: { stat: 'reflex', dc: 8, cls: 'pilot' }, ok: { text: 'You leave it behind.', res: { fuel: -1 }, xp: 25 }, fail: { text: 'It\'s faster than you.', combat: 'reaver', res: { fuel: -1 } } },
    ],
  },
  // ------------------------------------------------------------ Stations (rare arrival beats)
  {
    id: 'st-thief', title: 'Pickpocket', kinds: ['station'], weight: 0.3,
    text: 'You catch a kid with their hand in a crew member\'s pocket.',
    choices: [
      { label: 'Let them go with a meal', req: { res: { food: 1 } }, pay: true, ok: { text: 'The kid comes back later with a tip about a cache.', reveal: true, morale: 5 } },
      { label: 'Hand them to security', ok: { text: 'Security pays a small reward.', res: { credits: 10 }, morale: -3 } },
    ],
  },
  {
    id: 'st-gambler', title: 'Card Game', kinds: ['station'], weight: 0.3,
    text: 'A card game in the dock bar. The pot is large and the players are drunk.',
    choices: [
      { label: 'Play (20 credits)', req: { res: { credits: 20 } }, pay: true, check: { stat: 'wits', dc: 6 }, ok: { text: 'You clean up.', res: { credits: 70 }, xp: 10 }, fail: { text: 'You lose it all.' } },
      { label: 'Watch', ok: { text: 'Entertaining. The crew relax.', morale: 5 } },
    ],
  },
  // ------------------------------------------------------------ Entry (first jump into a sector)
  {
    id: 'en-welcome', title: 'New Sector', kinds: ['entry'], weight: 0.3,
    text: 'The jump settles. Unfamiliar stars. Your crew press against the viewports.',
    choices: [
      { label: 'Run a full sensor sweep', ok: { text: 'You chart the nearby jumps.', reveal: true, res: { energy: -5 } } },
      { label: 'Give the crew a moment', ok: { text: 'A moment of wonder.', morale: 10 } },
    ],
  },
];
export const EVENT = new Map(EVENTS.map((e) => [e.id, e]));
