import type { DistrictId } from './types';

/**
 * Story flags. A mission reward can set one, and from then on something in
 * the world is different. Each flag here is read by at least one system;
 * `validate.ts` checks every mission's flag is listed.
 *
 * Readers:
 * - district names and blurbs: `DISTRICT_TEXT` below, via `districtText`
 * - the scene: `heard` (the Spire glows at night), `rang` (the sea draws back)
 * - the music: `heard`, `rang`, `hushed`, `above`, `treaty`
 */
export const FLAGS = ['heard', 'remembered', 'rang', 'hushed', 'below', 'above', 'treaty'] as const;

export type Flag = (typeof FLAGS)[number];

/** District text that changes once the player knows more. Later entries win. */
export const DISTRICT_TEXT: readonly { flag: Flag; district: DistrictId; name?: string; blurb?: string }[] = [
  {
    flag: 'heard',
    district: 'spire',
    blurb: 'White stone and still water, and a tower that goes on above the clouds. A fog lies on everything. The hum comes from somewhere under it.',
  },
  {
    flag: 'remembered',
    district: 'landing',
    blurb: 'A shingle beach and a broken jetty. You have landed here before. There is a tin box under the jetty with your handwriting in it.',
  },
  {
    flag: 'rang',
    district: 'spire',
    name: 'The Singing Spire',
    blurb: 'The fog has lifted. The tower sings, low and warm, and the sea keeps well back from the causeway, as if it has been told.',
  },
  {
    flag: 'hushed',
    district: 'spire',
    blurb: 'White stone, still water, a locked door at the top. The hum is the note everyone knows. The key is on your chain.',
  },
  {
    flag: 'below',
    district: 'undercroft',
    blurb: 'Old Vessel, dry under the bay, with the sea standing round it like green glass. Something warm lies at its heart. The sea still seeps into every breach.',
  },
  {
    flag: 'above',
    district: 'spire',
    blurb: 'White stone, warm to the touch: the chimney of the hearth under the city. You know what it is now.',
  },
  {
    flag: 'treaty',
    district: 'shore',
    name: 'The Near Shore',
    blurb: 'The fishing town across the bay, older than Vessel. Since the treaty they call it the near shore, and they mean it kindly.',
  },
];
