// Parking Ramp item (ISSUE-032) — EXE-only mechanic, no C++ counterpart
// (source/Item/Parking.cpp implements only the parking space).
//
// A vertical car connector that must be rooted at the ground floor (y === 0)
// and stacks one floor per segment. Parking Spaces only satisfy demand when
// they sit next to a ground-connected ramp segment ("Not connected to Ramp").
//
// Authentic build messages (SIMTOWER.EXE Pascal strings):
//   "Parking Ramps must connect to the 1st floor"  (0xbbb9b)
//   "Parking Ramps must be connected vertically"   (0xbbbc7)
//   "Parking Ramps must be placed on this level"   (0xbbc1a)

import { Item } from "./item.js";
import { Sprite } from "../sprite.js";

// One 8px tile of the 384px driveway strip per floor segment.
const K_SEGMENT_SRC_W = 8;
const K_FLOOR_PX = 24;

export class ParkingRamp extends Item {
  constructor(game, prototype) {
    super(game, prototype);
    this.sprite = new Sprite();
  }

  init() {
    this.sprite.setTexture("simtower/parking/ramp");
    // One driveway slice per floor so stacked segments read as a continuous
    // sloping road through the 384px source strip.
    this.sprite.setTextureRect({
      x: rampSliceX(this.position.y),
      y: 0,
      w: K_SEGMENT_SRC_W,
      h: K_FLOOR_PX,
    });
    this.sprite.setOrigin(0, K_FLOOR_PX);
    this.sprite.setPosition(this.position.x * 8, -this.position.y * 36);
    this.addSprite(this.sprite);
  }

  dailyMaintenanceCost() {
    return 50;
  }
}

// Find the ramp segment occupying tile (x, floor), if any.
export function findRampAt(game, x, floor) {
  const ramps = game.itemsByType.get("parkingramp");
  if (!ramps) return null;
  for (const r of ramps) {
    if (r.position.x === x && r.position.y === floor) return r;
  }
  return null;
}

// True when a chain of same-x ramp segments leads from this segment down to
// the ground floor (y === 0). Computed dynamically, so bulldozing a middle
// segment instantly orphans everything above it.
export function rampConnectedToGround(game, ramp) {
  let y = ramp.position.y;
  const x = ramp.position.x;
  while (y > 0) {
    y--;
    if (!findRampAt(game, x, y)) return false;
  }
  return true;
}

// True when some ground-connected ramp segment on `floor` touches the
// [xMin, xMax) tile range (cars pull off the ramp onto the adjacent floor).
export function parkingRampServed(game, floor, xMin, xMax) {
  const ramps = game.itemsByType.get("parkingramp");
  if (!ramps) return false;
  for (const r of ramps) {
    if (r.position.y !== floor) continue;
    if (!rampConnectedToGround(game, r)) continue;
    const rMin = r.position.x;
    const rMax = r.position.x + r.size.x;
    // Half-open ranges touch when neither gap nor overlap separates them.
    if (rMin <= xMax && xMin <= rMax) return true;
  }
  return false;
}

// Render helper: pick the driveway slice matching the segment's stack depth so
// consecutive floors show continuous sloping art.
export function rampSliceX(floorY) {
  // Cycle through the 48 available tiles of the strip.
  return (((floorY % 48) + 48) % 48) * K_SEGMENT_SRC_W;
}
