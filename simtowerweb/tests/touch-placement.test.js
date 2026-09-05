// Touch placement is tap-to-park, drag-to-move, tap-the-ghost-to-build. The
// hit test is what separates "confirm this" from "move it over there", and
// getting it wrong is expensive in both directions: too tight and the ghost
// can never be confirmed on a phone, too loose and a tap meant to reposition
// builds instead — with no undo anywhere in the codebase.
import { describe, expect, it } from "vitest";
import { Game } from "../src/game/game.js";

const over = Game.prototype.pointerOverGhost;

// A 2x1 item parked with its bottom-left corner at tile (10, 3).
// World px: 8 across a tile, 36 up a floor.
const ctx = (sizeX = 2, sizeY = 1, heightOverride = null) => ({
  toolPrototype: { size: { x: sizeX, y: sizeY } },
  _toolHeightOverride: heightOverride,
});
const at = { x: 10, y: 3 };
const world = (tileX, floorY) => ({ x: tileX * 8, y: floorY * 36 });

describe("ghost hit test", () => {
  it("hits the middle of the footprint", () => {
    expect(over.call(ctx(), at, world(11, 3.5))).toBe(true);
  });

  it("misses well outside it", () => {
    expect(over.call(ctx(), at, world(30, 3.5))).toBe(false);
    expect(over.call(ctx(), at, world(11, 20))).toBe(false);
    expect(over.call(ctx(), at, world(11, -5))).toBe(false);
  });

  // Padded by half a tile across and half a floor up, because on a phone the
  // finger lands near the box far more often than exactly on it.
  it("forgives a near miss", () => {
    expect(over.call(ctx(), at, { x: 10 * 8 - 3, y: 3.5 * 36 })).toBe(true);
    expect(over.call(ctx(), at, { x: 12 * 8 + 3, y: 3.5 * 36 })).toBe(true);
    expect(over.call(ctx(), at, { x: 11 * 8, y: 3 * 36 - 17 })).toBe(true);
    expect(over.call(ctx(), at, { x: 11 * 8, y: 4 * 36 + 17 })).toBe(true);
  });

  it("does not forgive a far miss", () => {
    expect(over.call(ctx(), at, { x: 10 * 8 - 40, y: 3.5 * 36 })).toBe(false);
    expect(over.call(ctx(), at, { x: 11 * 8, y: 3 * 36 - 80 })).toBe(false);
  });

  it("uses the height override, so a 3-floor lobby is grabbable up its whole side", () => {
    const tall = ctx(2, 1, 3);
    // Two floors above the base: inside a 3-floor lobby, outside a 1-floor item.
    expect(over.call(tall, at, world(11, 5.5))).toBe(true);
    expect(over.call(ctx(), at, world(11, 5.5))).toBe(false);
  });

  it("is false when there is nothing parked or nothing armed", () => {
    expect(over.call(ctx(), null, world(11, 3.5))).toBe(false);
    expect(over.call({ toolPrototype: null }, at, world(11, 3.5))).toBe(false);
  });
});

describe("clearGhost", () => {
  it("drops both the parked state and any grab in progress", () => {
    const g = { ghostArmed: true, ghostGrab: { dx: 2, dy: -1 } };
    Game.prototype.clearGhost.call(g);
    expect(g.ghostArmed).toBe(false);
    expect(g.ghostGrab).toBe(null);
  });
});
