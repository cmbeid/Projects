import type { BiomeId } from './types';

/**
 * Story flags. A mission reward can set one, and from then on something in
 * the world is different. Each flag here is read by at least one system;
 * `validate.ts` checks every mission's flag is listed.
 *
 * Readers:
 * - biome names and blurbs: `BIOME_TEXT` below, via `biomeText`
 * - the scene: `other-miner`, `lamp-ahead`, `found-lamp`, `synced`, `woken`
 * - the music: `synced`, `lullaby`, `woken`
 * - the Descent panel: `dreamt`
 */
export const FLAGS = [
  'remembered',
  'other-miner',
  'lamp-ahead',
  'synced',
  'no-surface',
  'dreamt',
  'found-lamp',
  'lullaby',
  'woken',
] as const;

export type Flag = (typeof FLAGS)[number];

/** Biome text that changes once the player knows more. Later entries win. */
export const BIOME_TEXT: readonly { flag: Flag; biome: BiomeId; name?: string; blurb?: string }[] = [
  {
    flag: 'remembered',
    biome: 'topsoil',
    blurb: 'Old timber props, every one carved with your initials. Somebody worked this shaft before you. You did.',
  },
  {
    flag: 'no-surface',
    biome: 'topsoil',
    name: 'The Top',
    blurb: 'Above the last prop the rock just carries on. There is no way out up there. There never was.',
  },
  {
    flag: 'woken',
    biome: 'waking',
    name: 'The Waking',
    blurb: 'Pale stone, and a light that is not yours. It watches you work now, and it does not seem to mind.',
  },
];

export interface BargainDef {
  id: string;
  name: string;
  /** What you get. */
  boon: string;
  /** What it costs. */
  cost: string;
}

/**
 * Bargains: permanent, and there is no taking one back. Each pairs a real
 * advantage with a real price, so which to take depends on how you play.
 */
export const BARGAINS: readonly BargainDef[] = [
  { id: 'hunger', name: 'Hunger', boon: 'Your machines work three times as hard.', cost: 'Your own swings hit 40% softer.' },
  { id: 'sight', name: 'Second Sight', boon: '+60 luck.', cost: 'Your lamp burns one step dimmer.' },
  { id: 'quiet', name: 'The Long Quiet', boon: '+12 hours of offline time.', cost: 'Stamina recovers at half speed.' },
  { id: 'greed', name: 'Greed', boon: 'Everything sells for ×2.5.', cost: 'Machines clear one block a second fewer.' },
  { id: 'memory', name: 'Memory', boon: 'Echoes from every Descent ×1.5.', cost: 'Your Buried Purse is forgotten.' },
  { id: 'name', name: 'Your Name', boon: 'Your swings hit three times as hard.', cost: 'Something else knows your name now.' },
];
