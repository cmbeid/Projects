/**
 * The people of PokéHarvest: trainers out on the routes, townsfolk in
 * Cobblevale, and the story's cast. Everyone is drawn in code from a palette
 * (see `render/person.ts`).
 */
import type { Dir } from '../game/model';
import type { MapId } from './maps';

export interface Palette {
  hat: string;
  hair: string;
  skin: string;
  shirt: string;
  pants: string;
}

export const PALETTES = {
  bug: { hat: '#58a840', hair: '#4a2f1f', skin: '#f2c79a', shirt: '#f2d23c', pants: '#3a6a3a' },
  lass: { hat: '#f28bb5', hair: '#a0502a', skin: '#f6d2b0', shirt: '#f4f4f8', pants: '#3a78d0' },
  youngster: { hat: '#e8a13a', hair: '#3a2414', skin: '#f2c79a', shirt: '#e0402c', pants: '#34405a' },
  camper: { hat: '#3a8a3a', hair: '#3a2414', skin: '#d8a070', shirt: '#7a5a2a', pants: '#3a5a3a' },
  picnicker: { hat: '#e8c45a', hair: '#6a3a1a', skin: '#f6d2b0', shirt: '#58b85a', pants: '#3a78d0' },
  aroma: { hat: '#c04a8a', hair: '#e8c45a', skin: '#f6d2b0', shirt: '#f28bb5', pants: '#a060d0' },
  hiker: { hat: '#6e4424', hair: '#3a2414', skin: '#d8a070', shirt: '#a0673a', pants: '#5a4a3a' },
  blackbelt: { hat: '#2a2a30', hair: '#2a2a30', skin: '#d8a070', shirt: '#f4f4f8', pants: '#f4f4f8' },
  maniac: { hat: '#5a3a8a', hair: '#2a2a30', skin: '#f2c79a', shirt: '#5a3a8a', pants: '#2a2a30' },
  ace: { hat: '#2a5a9e', hair: '#e04030', skin: '#f6d2b0', shirt: '#2a5a9e', pants: '#2a2a30' },
  mayor: { hat: '#5a4a6a', hair: '#c8c8d0', skin: '#f2c79a', shirt: '#4a3a5a', pants: '#2a2a30' },
  nurse: { hat: '#f4f4f8', hair: '#f28bb5', skin: '#f6d2b0', shirt: '#f4f4f8', pants: '#f28bb5' },
  kai: { hat: '#2a2a30', hair: '#e8e8f0', skin: '#f2c79a', shirt: '#7a3ac8', pants: '#34405a' },
  folkA: { hat: '#a0673a', hair: '#6a3a1a', skin: '#f2c79a', shirt: '#58a8d8', pants: '#5a4a3a' },
  folkB: { hat: '#c8c8d0', hair: '#c8c8d0', skin: '#e8b890', shirt: '#c86a3a', pants: '#4a4a55' },
  folkC: { hat: '#f2d23c', hair: '#3a2414', skin: '#c89060', shirt: '#7ac85a', pants: '#3a5a8a' },
} satisfies Record<string, Palette>;
export type PaletteId = keyof typeof PALETTES;

export interface Trainer {
  id: string;
  map: MapId;
  name: string;
  cls: string;
  palette: PaletteId;
  x: number;
  y: number;
  facing: Dir;
  /** Tiles it can see along its facing. */
  sight: number;
  /** A second spot it walks to and back from, looking about. */
  patrol?: { x: number; y: number };
  team: readonly [dex: number, level: number][];
  reward: number;
  intro: string;
  outro: string;
}

export const TRAINERS: readonly Trainer[] = [
  { id: 'joey', map: 'route1', name: 'Joey', cls: 'Youngster', palette: 'youngster', x: 6, y: 11, facing: 'right', sight: 4, patrol: { x: 6, y: 13 }, team: [[19, 4]], reward: 120, intro: 'My Rattata is in the top percentage of Rattata!', outro: "Aw, man. Back to training." },
  { id: 'ana', map: 'route1', name: 'Ana', cls: 'Lass', palette: 'lass', x: 16, y: 23, facing: 'left', sight: 4, team: [[16, 4], [10, 4]], reward: 150, intro: 'You farm AND battle? Show me!', outro: 'You really can do both.' },
  { id: 'wade', map: 'route2', name: 'Wade', cls: 'Bug Catcher', palette: 'bug', x: 9, y: 9, facing: 'right', sight: 4, patrol: { x: 9, y: 11 }, team: [[13, 9], [10, 9], [167, 10]], reward: 300, intro: 'The forest is full of bugs. Want to see mine?', outro: 'Squashed...' },
  { id: 'arnie', map: 'route2', name: 'Arnie', cls: 'Bug Catcher', palette: 'bug', x: 15, y: 16, facing: 'left', sight: 3, team: [[46, 11], [204, 11]], reward: 320, intro: 'Shh! You\'ll scare them. Oh, you want to battle?', outro: 'Now they\'re all scared.' },
  { id: 'gina', map: 'route2', name: 'Gina', cls: 'Picnicker', palette: 'picnicker', x: 7, y: 21, facing: 'right', sight: 4, team: [[187, 10], [273, 11]], reward: 340, intro: 'Perfect day for a picnic, and a battle!', outro: 'My sandwiches got squished.' },
  { id: 'todd', map: 'route2', name: 'Todd', cls: 'Camper', palette: 'camper', x: 17, y: 11, facing: 'down', sight: 4, team: [[58, 12], [285, 12]], reward: 360, intro: "I'm camping here till I beat someone!", outro: 'Guess I\'ll be camping a while longer.' },
  { id: 'rose', map: 'route2', name: 'Rose', cls: 'Aroma Lady', palette: 'aroma', x: 4, y: 26, facing: 'right', sight: 5, team: [[43, 12], [285, 13], [187, 13]], reward: 400, intro: 'Smell the flowers... then smell defeat!', outro: 'What a lovely battle.' },
  { id: 'russell', map: 'route3', name: 'Russell', cls: 'Hiker', palette: 'hiker', x: 6, y: 5, facing: 'right', sight: 4, team: [[74, 15], [95, 16]], reward: 500, intro: 'Hahaha! These mountains are my home!', outro: 'Hahaha! Well fought!' },
  { id: 'daniel', map: 'route3', name: 'Daniel', cls: 'Hiker', palette: 'hiker', x: 18, y: 11, facing: 'left', sight: 4, patrol: { x: 15, y: 11 }, team: [[74, 17], [304, 17], [75, 18]], reward: 560, intro: 'Mind the rocks, and mind my Pokémon!', outro: 'Rocked, I was.' },
  { id: 'ken', map: 'route3', name: 'Ken', cls: 'Black Belt', palette: 'blackbelt', x: 3, y: 15, facing: 'right', sight: 5, team: [[66, 18], [296, 19]], reward: 600, intro: 'Hyah! Train with me!', outro: 'Oss! A fine lesson.' },
  { id: 'ethan', map: 'route3', name: 'Ethan', cls: 'Pokémaniac', palette: 'maniac', x: 17, y: 19, facing: 'left', sight: 4, team: [[206, 19], [79, 19]], reward: 620, intro: 'Have you ever seen a Dunsparce? Now you have!', outro: "It's still the best Pokémon." },
  { id: 'mira', map: 'route3', name: 'Mira', cls: 'Ace Trainer', palette: 'ace', x: 11, y: 26, facing: 'up', sight: 4, team: [[42, 20], [302, 20], [246, 21]], reward: 900, intro: "So you're the farmer everyone's talking about.", outro: 'Cobblevale is lucky to have you.' },
];

export function trainer(id: string): Trainer {
  const t = TRAINERS.find((tr) => tr.id === id) ?? KAI;
  return t;
}

/** Kai, your rival: a farmer-trainer from the next valley over. Their lead depends on your starter. */
export const KAI: Trainer = {
  id: 'kai', map: 'town', name: 'Kai', cls: 'Rival', palette: 'kai', x: 0, y: 0, facing: 'down', sight: 0,
  team: [[17, 24], [180, 25]], reward: 3000,
  intro: "The whole town's watching. Let's give them a show!", outro: "You really did bring Cobblevale back. Same time next week?",
};

/** Kai picks the starter that beats yours. */
export function kaiTeam(starter: number, rematches: number): [number, number][] {
  const counter: Record<number, number> = { 1: 5, 4: 8, 7: 2 };
  const bump = Math.min(15, rematches * 3);
  return [...KAI.team.map(([d, l]): [number, number] => [d, l + bump]), [counter[starter] ?? 5, 26 + bump]];
}

export interface Townsfolk {
  id: string;
  map: MapId;
  name: string;
  palette: PaletteId;
  x: number;
  y: number;
  lines: readonly string[];
}

export const TOWNSFOLK: readonly Townsfolk[] = [
  { id: 'fern', map: 'town', name: 'Fern', palette: 'folkA', x: 8, y: 7, lines: ['Cobblevale used to be lively. Then the farms closed, one by one.', "It's good to see someone working the old farm again!"] },
  { id: 'otto', map: 'town', name: 'Old Otto', palette: 'folkB', x: 14, y: 20, lines: ['Granite Pass is full of ore, if you can get through the rockslide.', 'Back in my day, we smelted it with Fire Pokémon. No wood needed!'] },
  { id: 'pip', map: 'town', name: 'Pip', palette: 'folkC', x: 6, y: 25, lines: ['Apricorns grow in Whisperwood. You can make special balls from them!', 'Lure Balls are great for Water Pokémon. Try the pond!'] },
];

export const HOUSE_LINES: readonly string[] = [
  "Nobody answers. There's a note: 'Gone to the festival preparations!'",
  'A voice calls out: "Thanks for the berries you\'ve been shipping!"',
  'You hear a Pokémon snoring inside.',
];
