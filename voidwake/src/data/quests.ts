import type { QuestTpl } from './types';

/**
 * Station jobs. A station offers one at a time; `station.ts` fills in the
 * target node, the goods and the pay from the sector.
 */
export const QUESTS: readonly QuestTpl[] = [
  { id: 'q-ore-run', kind: 'deliver', title: 'Ore Run', text: 'The smelters are idle. Bring us ore.', minSector: 0 },
  { id: 'q-ice-run', kind: 'deliver', title: 'Water Shortage', text: 'Our recyclers are failing. We need ice.', minSector: 0 },
  { id: 'q-food-run', kind: 'deliver', title: 'Hungry Docks', text: 'The dock workers are on half rations. Organics, please.', minSector: 0 },
  { id: 'q-crystal', kind: 'deliver', title: 'Lens Grinder', text: 'A lens-maker will pay well for crystal.', minSector: 1 },
  { id: 'q-alloy', kind: 'deliver', title: 'Hull Breach', text: 'We need alloy to seal a breach in the outer ring.', minSector: 1 },
  { id: 'q-circuits', kind: 'deliver', title: 'Fried Boards', text: 'A power surge cooked our control boards. We need circuits.', minSector: 2 },
  { id: 'q-relic', kind: 'deliver', title: 'Collector', text: 'An eccentric collector wants ark relics. Any relics.', minSector: 1 },
  { id: 'q-bounty-pirate', kind: 'bounty', title: 'Pirate Bounty', text: 'Pirates have been hitting our freighters. Their ship was last seen at the marked point.', minSector: 0 },
  { id: 'q-bounty-raider', kind: 'bounty', title: 'Raider Nest', text: 'A raider has been taking tolls nearby. Make it stop.', minSector: 1 },
  { id: 'q-bounty-hulk', kind: 'bounty', title: 'Dead Ship Walking', text: 'A wreck hulk is preying on traffic. Put it down.', minSector: 2 },
  { id: 'q-survey-ice', kind: 'survey', title: 'Water Survey', text: 'Land on a world in the marked system and bring back what you find.', minSector: 0 },
  { id: 'q-survey-bio', kind: 'survey', title: 'Bio Samples', text: 'Our botanists want samples from the marked system.', minSector: 1 },
  { id: 'q-survey-deep', kind: 'survey', title: 'Deep Survey', text: 'Something strange showed up on long-range scans. Go down and look.', minSector: 2 },
  { id: 'q-rescue-pods', kind: 'rescue', title: 'Lost Pods', text: 'A pod cluster broke loose near the marked point. Find them.', minSector: 0 },
  { id: 'q-rescue-miners', kind: 'rescue', title: 'Overdue', text: 'A mining crew is overdue. Last ping at the marked point.', minSector: 1 },
  { id: 'q-courier-med', kind: 'courier', title: 'Medicine Run', text: 'Carry medical supplies to the station at the marked point.', minSector: 0 },
  { id: 'q-courier-mail', kind: 'courier', title: 'Mail Sack', text: 'Letters from home, or what passes for it. Deliver them to the marked station.', minSector: 0 },
  { id: 'q-courier-sealed', kind: 'courier', title: 'Sealed Crate', text: 'Don\'t ask what\'s in it. Just deliver it to the marked station.', minSector: 2 },
];
export const QUEST = new Map(QUESTS.map((q) => [q.id, q]));
