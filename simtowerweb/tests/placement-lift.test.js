// A fingertip is opaque and about 50px wide, so on touch an item ghost is
// drawn above the contact point instead of under it. The offset is what makes
// drag-to-position usable on a phone, and getting it wrong is quiet: the ghost
// either still hides under the finger or floats off the top of the screen.
//
// placementLift only reads touchPlacement, zoom, poi.y, app.window.height and
// mouseWorld.y, so it is exercised through the prototype against a plain
// object rather than by standing up a whole Game.
import { describe, expect, it } from "vitest";
import { Game } from "../src/game/game.js";

const lift = Game.prototype.placementLift;

// A pointer `below` screen px beneath the top edge of the viewport.
const at = (below, { zoom = 1, height = 812, touch = true } = {}) => {
  const poiY = 1000;
  const viewTop = poiY + height * 0.5 * zoom;
  return {
    touchPlacement: touch,
    zoom,
    poi: { y: poiY },
    app: { window: { height } },
    mouseWorld: { y: viewTop - below * zoom },
  };
};

describe("touch placement lift", () => {
  it("is zero for a mouse", () => {
    expect(lift.call(at(400, { touch: false }))).toBe(0);
  });

  it("clears a fingertip when there is room", () => {
    // 56 screen px, expressed in world px at this zoom.
    expect(lift.call(at(400, { zoom: 1 }))).toBe(56);
  });

  // The whole point of scaling by zoom: the gap has to look the same on screen
  // whether a floor is 9px tall or 288px tall.
  it("is a constant distance on screen at every zoom", () => {
    for (const zoom of [0.125, 0.25, 0.5, 1, 2, 4]) {
      expect(lift.call(at(400, { zoom })) / zoom).toBeCloseTo(56, 6);
    }
  });

  it("gives the offset back rather than pushing the ghost off the top", () => {
    // Hard against the top edge there is nowhere to lift to.
    expect(lift.call(at(0))).toBe(0);
    // ...and it ramps in as the finger comes down the screen.
    expect(lift.call(at(8))).toBe(0);
    expect(lift.call(at(32))).toBe(24);
    expect(lift.call(at(64))).toBe(56);
  });

  it("never returns a negative lift", () => {
    // Finger above the visible area entirely (a stray captured pointer).
    for (const below of [-200, -50, -1, 0]) {
      expect(lift.call(at(below))).toBeGreaterThanOrEqual(0);
    }
  });

  it("never lifts further than the fingertip offset", () => {
    for (const below of [100, 500, 5000]) {
      for (const zoom of [0.25, 1, 4]) {
        expect(lift.call(at(below, { zoom }))).toBeLessThanOrEqual(56 * zoom + 1e-9);
      }
    }
  });

  it("survives a viewport that has not been measured yet", () => {
    const g = at(400);
    g.app = {};
    expect(Number.isFinite(lift.call(g))).toBe(true);
    g.zoom = 0;
    expect(Number.isFinite(lift.call(g))).toBe(true);
  });
});
