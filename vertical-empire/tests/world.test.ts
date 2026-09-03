import { describe, expect, it } from 'vitest';

import {
  FLOOR_HEIGHT,
  GROUND_LEVEL,
  LEVEL_COUNT,
  LOT_SEGMENTS,
  SEGMENT_WIDTH,
  WORLD_HEIGHT,
  floorLabel,
  floorToLevel,
  levelAtWorldY,
  levelToFloor,
  levelTop,
  segmentAtWorldX,
} from '../src/world/grid.js';
import { DEMO_LEFT, Tower, demoTower } from '../src/world/tower.js';
import { facility } from '../src/world/facilities.js';
import { TOLERANCE, carAtFloor, carLevel } from '../src/world/lift.js';

describe('the grid', () => {
  it('keeps SimTower’s measurements', () => {
    expect(SEGMENT_WIDTH).toBe(8);
    expect(FLOOR_HEIGHT).toBe(36);
    expect(LEVEL_COUNT).toBe(109); // nine basements and a hundred storeys
  });

  it('numbers floors the way a building does, skipping zero', () => {
    expect(levelToFloor(GROUND_LEVEL)).toBe(1);
    expect(levelToFloor(GROUND_LEVEL - 1)).toBe(-1);
    expect(floorLabel(GROUND_LEVEL - 1)).toBe('B1');
    expect(floorLabel(GROUND_LEVEL)).toBe('1');
  });

  it('round-trips floors and levels', () => {
    for (const floor of [-9, -1, 1, 2, 50, 100]) {
      expect(levelToFloor(floorToLevel(floor))).toBe(floor);
    }
  });

  it('maps world pixels back to the cell they fall in', () => {
    const level = 40;
    expect(levelAtWorldY(levelTop(level))).toBe(level);
    expect(levelAtWorldY(levelTop(level) + FLOOR_HEIGHT - 1)).toBe(level);
    // One pixel further down is the next floor, not a rounding artefact.
    expect(levelAtWorldY(levelTop(level) + FLOOR_HEIGHT)).toBe(level - 1);
    expect(segmentAtWorldX(SEGMENT_WIDTH * 7 + 3)).toBe(7);
  });

  it('stacks levels bottom-up, deepest basement last', () => {
    expect(levelTop(LEVEL_COUNT - 1)).toBe(0);
    expect(levelTop(0)).toBe(WORLD_HEIGHT - FLOOR_HEIGHT);
  });
});

describe('placing things', () => {
  it('refuses to overlap', () => {
    const tower = new Tower();
    expect(tower.place('office', 10, 20)).not.toBeNull();
    expect(tower.blockedBy('office', 12, 20)).toBe('occupied');
    expect(tower.place('office', 12, 20)).toBeNull();
    // Clear of it by one segment, so it fits.
    expect(tower.place('office', 10 + facility('office').width, 20)).not.toBeNull();
  });

  it('refuses to hang off the lot or the tower', () => {
    const tower = new Tower();
    expect(tower.blockedBy('condo', LOT_SEGMENTS - 2, 20)).toBe('off-lot');
    expect(tower.blockedBy('office', 0, -1)).toBe('off-tower');
    expect(tower.blockedBy('office', 0, LEVEL_COUNT)).toBe('off-tower');
    // Flush with the right edge is inside, not off.
    expect(tower.blockedBy('condo', LOT_SEGMENTS - facility('condo').width, 20)).toBeNull();
  });

  it('claims every level a shaft passes through', () => {
    const tower = new Tower();
    tower.place('elevator', 30, 9, 10);
    expect(tower.at(30, 9)?.id).toBe('elevator');
    expect(tower.at(33, 18)?.id).toBe('elevator');
    expect(tower.at(33, 19)).toBeUndefined();
    expect(tower.blockedBy('office', 26, 14)).toBe('occupied');
  });

  it('frees the whole footprint when something is cleared', () => {
    const tower = new Tower();
    tower.place('office', 4, 30);
    tower.place('elevator', 40, 9, 5);

    // Remove the first, and the second must still be findable — the occupancy
    // index is rebuilt around the hole rather than left pointing at the wrong row.
    expect(tower.removeAt(6, 30)?.id).toBe('office');
    expect(tower.at(4, 30)).toBeUndefined();
    expect(tower.at(41, 12)?.id).toBe('elevator');
    expect(tower.blockedBy('office', 4, 30)).toBeNull();
  });

  it('reports nothing to clear on an empty cell', () => {
    expect(new Tower().removeAt(3, 3)).toBeUndefined();
  });
});

describe('the demo tower', () => {
  it('builds a lobby, lifts and tenants without any of them colliding', () => {
    const tower = demoTower();

    expect(tower.placements.length).toBeGreaterThan(50);
    expect(tower.placements.some((placement) => placement.id === 'elevator')).toBe(true);
    expect(tower.topLevel).toBeGreaterThan(GROUND_LEVEL + 10);

    // Nothing overlaps: every placement is still the one the index points at.
    for (const placement of tower.placements) {
      expect(tower.at(placement.segment, placement.level)).toBe(placement);
    }
  });

  it('lets the lifts through the lobby floor', () => {
    const tower = demoTower();
    // Positions are relative to where the tower stands, not to the lot, so
    // these keep holding when the block gets wider.
    expect(tower.at(DEMO_LEFT + 21, GROUND_LEVEL)?.id).toBe('elevator');
    expect(tower.at(DEMO_LEFT, GROUND_LEVEL)?.id).toBe('lobby');
  });

  it('stands mid-block, with street on both sides', () => {
    const tower = demoTower();
    expect(DEMO_LEFT).toBeGreaterThan(0);
    // Nothing built at either edge of the lot: that is where the town shows.
    expect(tower.at(0, GROUND_LEVEL)).toBeUndefined();
    expect(tower.at(LOT_SEGMENTS - 1, GROUND_LEVEL)).toBeUndefined();
  });
});

describe('the rating badge', () => {
  it('counts stars from how high the tower reaches', () => {
    const tower = new Tower();
    expect(tower.stars).toBe(0);

    tower.place('office', 0, GROUND_LEVEL);
    expect(tower.stars).toBe(1);

    // Floor 10 is the second step. Levels are 0-based and start below ground,
    // so the tenth floor is GROUND_LEVEL + 9.
    tower.place('office', 0, GROUND_LEVEL + 9);
    expect(tower.stars).toBe(2);

    tower.place('office', 0, GROUND_LEVEL + 74);
    expect(tower.stars).toBe(5);
  });

  it('does not count basements as height', () => {
    const tower = new Tower();
    tower.place('office', 0, GROUND_LEVEL - 1);
    // Something is built, but the tower does not reach floor 1.
    expect(tower.stars).toBe(0);
  });
});

describe('where a lift car is', () => {
  const bank = { level: GROUND_LEVEL, span: 10 };

  it('stays inside its own shaft, whatever the clock says', () => {
    // The car is a pure function of time, so this is exhaustive rather than a
    // sample: nothing accumulates, so a position that is right across one round
    // trip is right forever.
    for (let elapsed = 0; elapsed < 40_000; elapsed += 37) {
      const level = carLevel(bank, 0, elapsed);
      expect(level).toBeGreaterThanOrEqual(bank.level);
      expect(level).toBeLessThanOrEqual(bank.level + bank.span - 1);
    }
  });

  it('reaches both ends of its run', () => {
    let lowest = Infinity;
    let highest = -Infinity;
    for (let elapsed = 0; elapsed < 40_000; elapsed += 13) {
      const level = carLevel(bank, 0, elapsed);
      lowest = Math.min(lowest, level);
      highest = Math.max(highest, level);
    }
    // A car that never quite arrives anywhere would look broken and would
    // never chime.
    expect(lowest).toBeLessThan(bank.level + 0.05);
    expect(highest).toBeGreaterThan(bank.level + bank.span - 1.05);
  });

  it('puts two banks out of step with each other', () => {
    // Otherwise a row of lifts moves as one object, which reads as a lift-
    // shaped wallpaper rather than as traffic.
    const apart = Math.abs(carLevel(bank, 0, 5_000) - carLevel(bank, 1, 5_000));
    expect(apart).toBeGreaterThan(0.5);
  });

  it('parks a bank too short to travel', () => {
    expect(carLevel({ level: GROUND_LEVEL, span: 1 }, 0, 12_345)).toBe(GROUND_LEVEL);
    expect(carAtFloor({ level: GROUND_LEVEL, span: 1 }, 0, 12_345)).toBeUndefined();
  });

  it('reports a floor only when the car is actually at one', () => {
    let arrivals = 0;
    let previous: number | undefined;
    let between = 0;

    // Sampled at roughly a frame apart, which is how `main.ts` reads it.
    for (let elapsed = 0; elapsed < 30_000; elapsed += 16) {
      const floor = carAtFloor(bank, 0, elapsed);
      if (floor === undefined) between += 1;
      else if (floor !== previous) arrivals += 1;
      previous = floor;

      if (floor !== undefined) {
        // A reported floor is a real floor of this bank.
        expect(Number.isInteger(floor)).toBe(true);
        expect(floor).toBeGreaterThanOrEqual(bank.level);
        expect(floor).toBeLessThanOrEqual(bank.level + bank.span - 1);
      }
    }

    // The point of the tolerance: most of a trip is spent between floors, so
    // rounding the level would report an arrival on almost every frame.
    expect(between).toBeGreaterThan(0);
    // Two round trips over ten floors, arriving at each end and passing the
    // eight between: a couple of dozen arrivals, not thousands.
    expect(arrivals).toBeGreaterThan(10);
    expect(arrivals).toBeLessThan(120);
  });

  it('agrees with the position the scene draws', () => {
    // The reason this moved out of the renderer. Two copies of a triangle wave
    // agree today and drift the first time one is tuned, and a chime that plays
    // where the car visibly is not is worse than no chime.
    for (let elapsed = 0; elapsed < 20_000; elapsed += 97) {
      const floor = carAtFloor(bank, 0, elapsed);
      if (floor === undefined) continue;
      expect(Math.abs(carLevel(bank, 0, elapsed) - floor)).toBeLessThanOrEqual(TOLERANCE);
    }
  });
});
