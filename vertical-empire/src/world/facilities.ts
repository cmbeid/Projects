/**
 * What can be built, and how wide it is.
 *
 * The widths are the original's, in segments, and several of them fall out of
 * the sprite sizes the extractor reports: an elevator car is 32px, which is
 * four segments, and a condo bitmap is 128px, which is sixteen. Where the
 * original art is loaded these numbers are checked against it; where the
 * fallback art is used they *are* the sizes it is drawn at.
 */

export type FacilityId = 'lobby' | 'office' | 'condo' | 'hotel' | 'elevator' | 'stairs';

/**
 * Which drawer of the build bar a facility lives in.
 *
 * A flat row of buttons was fine for six. The original's art covers roughly
 * fifteen, which on a 390px screen is a scroll long enough that you stop
 * knowing what is in it — so they are grouped, and the bar shows one group at
 * a time.
 */
export type FacilityCategory = 'move' | 'live' | 'work' | 'play';

export const CATEGORIES: readonly { id: FacilityCategory; label: string }[] = [
  { id: 'move', label: 'Move' },
  { id: 'live', label: 'Live' },
  { id: 'work', label: 'Work' },
  { id: 'play', label: 'Play' },
];

export interface Facility {
  id: FacilityId;
  label: string;
  category: FacilityCategory;
  /** Key into the atlas. */
  sprite: string;
  /** Width in segments. */
  width: number;
  cost: number;
  /** Lobbies only make sense at ground level and every fifteenth floor above. */
  placement: 'anywhere' | 'lobby-levels';
  /** Transport runs between floors rather than sitting on one. */
  transport: boolean;
  /**
   * Drawn one segment at a time from a run of cells, stepping through the sheet
   * by position rather than by state. The lobby is a continuous frontage, not
   * the same tile repeated.
   */
  tiled?: boolean;
}

export const FACILITIES: readonly Facility[] = [
  { id: 'lobby', label: 'Lobby', category: 'move', sprite: 'lobby', width: 1, cost: 5_000, placement: 'lobby-levels', transport: false, tiled: true },
  { id: 'elevator', label: 'Elevator', category: 'move', sprite: 'elevator', width: 4, cost: 100_000, placement: 'anywhere', transport: true },
  // Eight segments, from the 448px sheet dividing into seven states.
  { id: 'stairs', label: 'Stairs', category: 'move', sprite: 'stairs', width: 8, cost: 5_000, placement: 'anywhere', transport: true },
  { id: 'condo', label: 'Condo', category: 'live', sprite: 'condo', width: 16, cost: 200_000, placement: 'anywhere', transport: false },
  { id: 'hotel', label: 'Hotel', category: 'live', sprite: 'hotel', width: 4, cost: 20_000, placement: 'anywhere', transport: false },
  { id: 'office', label: 'Office', category: 'work', sprite: 'office', width: 9, cost: 40_000, placement: 'anywhere', transport: false },
];

const BY_ID = new Map(FACILITIES.map((facility) => [facility.id, facility]));

export function facility(id: FacilityId): Facility {
  const found = BY_ID.get(id);
  // Every id in the union is in the table, so this is a programming error only.
  if (!found) throw new Error(`Unknown facility ${id}`);
  return found;
}

/** Sky lobbies land every fifteen floors, which is what breaks a tall tower into bands. */
export const SKY_LOBBY_INTERVAL = 15;
