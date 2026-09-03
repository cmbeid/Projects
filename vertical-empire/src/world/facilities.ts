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

export interface Facility {
  id: FacilityId;
  label: string;
  /** Key into the atlas. */
  sprite: string;
  /** Width in segments. */
  width: number;
  cost: number;
  /** Lobbies only make sense at ground level and every fifteenth floor above. */
  placement: 'anywhere' | 'lobby-levels';
  /** Transport runs between floors rather than sitting on one. */
  transport: boolean;
}

export const FACILITIES: readonly Facility[] = [
  { id: 'lobby', label: 'Lobby', sprite: 'lobby', width: 1, cost: 5_000, placement: 'lobby-levels', transport: false },
  { id: 'office', label: 'Office', sprite: 'office', width: 9, cost: 40_000, placement: 'anywhere', transport: false },
  { id: 'condo', label: 'Condo', sprite: 'condo', width: 16, cost: 200_000, placement: 'anywhere', transport: false },
  { id: 'hotel', label: 'Hotel', sprite: 'hotel', width: 4, cost: 20_000, placement: 'anywhere', transport: false },
  { id: 'elevator', label: 'Elevator', sprite: 'elevator', width: 4, cost: 100_000, placement: 'anywhere', transport: true },
  { id: 'stairs', label: 'Stairs', sprite: 'stairs', width: 4, cost: 5_000, placement: 'anywhere', transport: true },
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
