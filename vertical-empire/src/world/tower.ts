/**
 * What has been built, and where. No simulation — this spike is about how a
 * tower *looks*, so a placement is a rectangle and a state, nothing more.
 */

import { facility, type FacilityId } from './facilities.js';
import { LOT_SEGMENTS, isInsideLot, isValidLevel, levelToFloor } from './grid.js';

export interface Placement {
  id: FacilityId;
  /** Leftmost segment. */
  segment: number;
  /** Lowest level occupied. */
  level: number;
  /** Levels spanned; more than one only for transport. */
  span: number;
  /** Which frame of the sprite sheet to draw — occupancy, lit/dark, and so on. */
  state: number;
}

export type Blocked = 'off-lot' | 'off-tower' | 'occupied';

export class Tower {
  readonly placements: Placement[] = [];

  /** segment+level -> index into `placements`. Rebuilt on every removal. */
  private occupancy = new Map<number, number>();

  private static cell(segment: number, level: number): number {
    return level * LOT_SEGMENTS + segment;
  }

  at(segment: number, level: number): Placement | undefined {
    const index = this.occupancy.get(Tower.cell(segment, level));
    return index === undefined ? undefined : this.placements[index];
  }

  /** Why a placement would not fit, or `null` if it would. */
  blockedBy(id: FacilityId, segment: number, level: number, span = 1): Blocked | null {
    const { width } = facility(id);
    if (!isInsideLot(segment, width)) return 'off-lot';
    if (!isValidLevel(level) || !isValidLevel(level + span - 1)) return 'off-tower';

    for (let l = level; l < level + span; l += 1) {
      for (let s = segment; s < segment + width; s += 1) {
        if (this.occupancy.has(Tower.cell(s, l))) return 'occupied';
      }
    }
    return null;
  }

  /** Places if it fits. Returns the placement, or null if something was in the way. */
  place(id: FacilityId, segment: number, level: number, span = 1, state = 0): Placement | null {
    if (this.blockedBy(id, segment, level, span) !== null) return null;

    const placement: Placement = { id, segment, level, span, state };
    const index = this.placements.push(placement) - 1;
    this.mark(placement, index);
    return placement;
  }

  /** Removes whatever covers this cell. Returns what went, if anything. */
  removeAt(segment: number, level: number): Placement | undefined {
    const index = this.occupancy.get(Tower.cell(segment, level));
    if (index === undefined) return undefined;

    const [removed] = this.placements.splice(index, 1);
    // Indices after the hole all shifted, so the map is rebuilt rather than patched.
    this.reindex();
    return removed;
  }

  /**
   * A five-star rating, standing in for one the spike does not simulate.
   *
   * SimTower's stars come from population and how well the tower serves it.
   * Nothing here simulates population — there is no simulation at all — so
   * rather than invent a score, this counts something the tower really does
   * have: how high it reaches. The badge is honest about being a measure of
   * the building rather than of how it is doing.
   */
  get stars(): number {
    const floors = levelToFloor(this.topLevel);
    if (floors < 1) return 0;
    // Roughly the original's own pacing, where each star is a step change in
    // what the tower has to be rather than a steady climb.
    const steps = [1, 10, 25, 50, 75];
    return steps.filter((needed) => floors >= needed).length;
  }

  /** Highest level with anything on it, or -1 for an empty lot. */
  get topLevel(): number {
    let top = -1;
    for (const placement of this.placements) {
      const highest = placement.level + placement.span - 1;
      if (highest > top) top = highest;
    }
    return top;
  }

  private mark(placement: Placement, index: number): void {
    const { width } = facility(placement.id);
    for (let l = placement.level; l < placement.level + placement.span; l += 1) {
      for (let s = placement.segment; s < placement.segment + width; s += 1) {
        this.occupancy.set(Tower.cell(s, l), index);
      }
    }
  }

  private reindex(): void {
    this.occupancy = new Map();
    this.placements.forEach((placement, index) => this.mark(placement, index));
  }
}

/**
 * A tower worth looking at on first load: a lobby, a spine of lifts, and enough
 * floors of tenants that the palette has something to act on. Hand-placed, not
 * simulated — the point is a screenshot that answers "does this read as
 * SimTower", and an empty lot answers nothing.
 */
/** How much of the block the demo tower occupies, leaving the rest as street. */
const FRONTAGE = 70;

/**
 * Where its left edge sits, so it stands mid-block with street either side.
 *
 * Derived rather than written down: the lot has changed width once already and
 * a tower pinned to segment zero ends up hard against the edge of a wider one.
 */
export const DEMO_LEFT = Math.floor((LOT_SEGMENTS - FRONTAGE) / 2);

export function demoTower(): Tower {
  const tower = new Tower();
  const ground = 9; // level index of floor 1
  const at = (segment: number): number => DEMO_LEFT + segment;

  // Transport goes down first. Lifts run *through* the lobby floor rather than
  // sitting beside it, so they have to claim their segments before the lobby
  // fills in around them.
  tower.place('elevator', at(20), ground, 16);
  tower.place('elevator', at(46), ground, 11);
  tower.place('stairs', at(44), ground, 3);

  // The lobby spans the tower's own frontage, not the whole block. SimTower
  // stands its tower in a town, and a lobby stretched across every segment
  // paves over the streetscape either side of it.
  for (let segment = 0; segment < FRONTAGE; segment += 1) {
    tower.place('lobby', at(segment), ground);
  }

  // Offices low, hotel in the middle, condos with the view. Wings either side
  // of the lift spine, the way a real floorplate works out — and dense enough
  // that the tower has a silhouette rather than being a scatter of rooms.
  const wings: [number, number][] = [
    [at(2), at(18)],
    [at(25), at(43)],
    [at(50), at(68)],
  ];

  for (let level = ground + 1; level <= ground + 6; level += 1) {
    for (const [from, to] of wings) {
      for (let segment = from; segment + 9 <= to; segment += 9) {
        tower.place('office', segment, level, 1, (level + segment) % 4);
      }
    }
  }
  for (let level = ground + 7; level <= ground + 12; level += 1) {
    for (const [from, to] of wings) {
      for (let segment = from; segment + 4 <= to; segment += 4) {
        tower.place('hotel', segment, level, 1, (level + segment) % 3);
      }
    }
  }
  for (let level = ground + 13; level <= ground + 17; level += 1) {
    for (const [from, to] of wings) {
      for (let segment = from; segment + 16 <= to; segment += 16) {
        tower.place('condo', segment, level, 1, (level + segment) % 2);
      }
    }
  }

  return tower;
}
