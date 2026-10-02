/**
 * The story, "Revive Cobblevale": five chapters, each a handful of goals.
 * Finishing one opens the way to the next part of the world. Dialogue is
 * grouped into beats, played when a chapter starts or ends, or on a first
 * visit.
 */
import type { MapId } from './maps';
import type { PaletteId } from './people';

export type Objective =
  | { kind: 'ship'; count: number }
  | { kind: 'befriend'; count: number }
  | { kind: 'visit'; map: MapId }
  | { kind: 'deliver'; item: string; count: number }
  | { kind: 'deliverKind'; itemKind: 'crop' | 'artisan'; count: number }
  | { kind: 'trainers'; map: MapId; count: number }
  | { kind: 'apricorns'; count: number }
  | { kind: 'place'; machine: string }
  | { kind: 'smelt'; bar: string }
  | { kind: 'toolTier'; tier: number }
  | { kind: 'reputation'; level: number }
  | { kind: 'beatKai' };

export interface Chapter {
  title: string;
  summary: string;
  objectives: readonly Objective[];
  /** Beats played as it starts and as it ends. */
  start: string;
  end: string;
  /** What finishing it does: a flag for the world, and gifts. */
  flag: string;
  gold?: number;
  items?: Record<string, number>;
}

export const CHAPTERS: readonly Chapter[] = [
  {
    title: 'A Fresh Start',
    summary: "Get the old farm going again. The Mayor will send someone to clear the road to town once you've shown you're staying.",
    objectives: [{ kind: 'ship', count: 10 }, { kind: 'befriend', count: 2 }],
    start: 'intro', end: 'ch1-done', flag: 'road-open', gold: 500,
  },
  {
    title: 'Cobblevale',
    summary: 'The town has seen better days, and its Pokémon Center is boarded up. The Mayor needs wood and berries to fix it.',
    objectives: [{ kind: 'visit', map: 'town' }, { kind: 'deliver', item: 'wood', count: 20 }, { kind: 'deliverKind', itemKind: 'crop', count: 10 }],
    start: 'ch2-start', end: 'ch2-done', flag: 'center-open', items: { workbench: 1, 'exp-share': 1 },
  },
  {
    title: 'Whisperwood',
    summary: 'Prove yourself to the trainers of the forest, and learn the old craft of Apricorn balls.',
    objectives: [{ kind: 'trainers', map: 'route2', count: 3 }, { kind: 'apricorns', count: 5 }, { kind: 'place', machine: 'apricorn-workshop' }],
    start: 'ch3-start', end: 'ch3-done', flag: 'pass-open', items: { 'hard-stone': 8 },
  },
  {
    title: 'Under the Mountain',
    summary: 'Mine Granite Pass, smelt iron, and become someone the whole town trusts.',
    objectives: [{ kind: 'smelt', bar: 'iron-bar' }, { kind: 'toolTier', tier: 2 }, { kind: 'reputation', level: 3 }],
    start: 'ch4-start', end: 'ch4-done', flag: 'festival', items: { 'rare-candy': 3 },
  },
  {
    title: 'The Harvest Festival',
    summary: 'Bring your finest goods to the festival, then face Kai in front of the whole town.',
    objectives: [{ kind: 'deliverKind', itemKind: 'artisan', count: 3 }, { kind: 'beatKai' }],
    start: 'ch5-start', end: 'ending', flag: 'story-done', gold: 10000, items: { nugget: 3 },
  },
];

export interface Line {
  speaker: 'mayor' | 'kai' | 'nurse' | 'narrator';
  text: string;
}

export const SPEAKERS: Record<Line['speaker'], { name: string; palette: PaletteId | null }> = {
  mayor: { name: 'Mayor Briar', palette: 'mayor' },
  kai: { name: 'Kai', palette: 'kai' },
  nurse: { name: 'Nurse Hana', palette: 'nurse' },
  narrator: { name: '', palette: null },
};

export const BEATS: Record<string, readonly Line[]> = {
  intro: [
    { speaker: 'narrator', text: 'A letter is pinned to the farmhouse door.' },
    { speaker: 'mayor', text: "Welcome to the old farm! It's been empty for years, and Cobblevale hasn't been the same since." },
    { speaker: 'mayor', text: 'Ship some berries and make a Pokémon friend or two, and I\'ll know you mean to stay. Then I\'ll have the fallen tree on the road to town cleared.' },
  ],
  'ch1-done': [
    { speaker: 'mayor', text: "Ten berries shipped, and new friends on the farm! You're staying, then. Wonderful!" },
    { speaker: 'mayor', text: "The road south through Route 1 is clear. Come and see Cobblevale. I'm in the Hall with the blue roof." },
    { speaker: 'kai', text: "So you're the new farmer. I'm Kai, from the next valley. Don't get too comfortable. I'll be watching." },
  ],
  'ch2-start': [
    { speaker: 'mayor', text: 'This is Cobblevale. Quiet, isn\'t it? Too quiet. Most folk moved away when the farms closed.' },
    { speaker: 'mayor', text: 'The Pokémon Center has been boarded up for years. Bring me 20 Wood and 10 berries and we\'ll open it again. The workshop sells wood, and Whisperwood to the east has fallen logs.' },
  ],
  'ch2-done': [
    { speaker: 'nurse', text: 'The Pokémon Center is open again! Bring your Pokémon to me any time, and I\'ll make them good as new.' },
    { speaker: 'mayor', text: "Take this Workbench as thanks. Put it on your farm and you can build machines and stations." },
    { speaker: 'mayor', text: "And this Exp. Share. Your Pokémon who sit out a battle will still learn from watching." },
  ],
  'ch3-start': [
    { speaker: 'mayor', text: 'The trainers of Whisperwood respect strength. Win a few battles, and learn to make Apricorn balls like the old farmers did.' },
    { speaker: 'kai', text: 'Apricorn Workshops! My grandmother had one. Bet yours won\'t be as good.' },
  ],
  'ch3-done': [
    { speaker: 'mayor', text: 'Word travels fast. The forest folk say you\'re the real deal. I\'ve had the rockslide at Granite Pass cleared for you.' },
  ],
  'ch4-start': [
    { speaker: 'mayor', text: 'Granite Pass is full of ore. Build a Furnace on your farm and smelt it into bars. A Fire Pokémon will save you a lot of wood!' },
  ],
  'ch4-done': [
    { speaker: 'mayor', text: 'Iron tools, a full barn, and the whole town singing your praises. It\'s time we brought back the Harvest Festival!' },
    { speaker: 'kai', text: "A festival? Then there'll be a battle. You and me, in front of everyone." },
  ],
  'ch5-start': [
    { speaker: 'mayor', text: 'Bring three of your finest goods to the Hall: juice, jam, cheese or cloth. Then Kai is waiting for you.' },
  ],
  ending: [
    { speaker: 'kai', text: 'That was... a real battle. You earned it.' },
    { speaker: 'mayor', text: 'Look at Cobblevale! The Center\'s open, the shops are busy, and the festival\'s back. You did this.' },
    { speaker: 'narrator', text: 'Cobblevale is thriving again. Your farm, and your Pokémon, will keep it that way.' },
    { speaker: 'kai', text: "Same time next week? I'll be at the Hall." },
  ],
};
