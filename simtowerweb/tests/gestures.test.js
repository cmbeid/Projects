// Pinch/zoom is the one gesture with no keyboard equivalent and no undo for
// getting it wrong: zoom out far enough and the tower leaves the screen with
// no way back but the fit button. Both modules here are DOM-free, so the
// direction and the limits can be pinned without a browser.
import { describe, expect, it } from "vitest";
import { pinchTarget, panWorldOffset, pinchMetrics, TAP_SLOP_PX } from "../src/ui/gestures.js";
import { ZOOM_MIN, ZOOM_MAX, WORLD_HEIGHT, maxUsefulZoom, zoomIn, zoomOut } from "../src/render/camera.js";

// zoom is view-size / canvas-size, so SMALLER is closer in.
const state = (zoom0 = 1, dist0 = 100) => ({
  zoom0,
  dist0,
  canvasW: 375,
  canvasH: 812,
  anchorWorld: { x: 0, y: 0 },
});
const mid = { x: 187, y: 400 };

describe("pinch direction", () => {
  it("zooms IN when the fingers spread apart", () => {
    // Matches every other touch app: content grows under diverging fingers.
    expect(pinchTarget(state(), 200, mid).zoom).toBe(0.5);
  });

  it("zooms OUT when the fingers come together", () => {
    expect(pinchTarget(state(), 50, mid).zoom).toBe(2);
  });

  it("is proportional to the distance ratio, not the delta", () => {
    // Doubling the span always halves the zoom, wherever it started.
    expect(pinchTarget(state(0.5), 200, mid).zoom).toBe(0.25);
    expect(pinchTarget(state(4), 200, mid).zoom).toBe(2);
  });

  it("holds still when the fingers do", () => {
    expect(pinchTarget(state(0.7), 100, mid).zoom).toBeCloseTo(0.7, 10);
  });
});

describe("pinch limits", () => {
  it("never divides by a collapsed span", () => {
    // Two fingers landing on the same pixel would otherwise be zoom0 * Infinity.
    expect(pinchTarget(state(), 0, mid).zoom).toBe(1);
    expect(pinchTarget({ ...state(), dist0: 0 }, 120, mid).zoom).toBe(1);
  });

  it("clamps to the caller's bounds rather than its own", () => {
    // input.js passes the same ceiling the buttons and keys use; the defaults
    // here are deliberately wider so the caller decides.
    expect(pinchTarget(state(1), 10_000, mid, 0.25, 4).zoom).toBe(0.25);
    expect(pinchTarget(state(1), 1, mid, 0.25, 4).zoom).toBe(4);
  });

  it("keeps the anchor world point under the pinch midpoint", () => {
    const s = { ...state(), anchorWorld: { x: 500, y: 300 } };
    const t = pinchTarget(s, 100, { x: s.canvasW / 2, y: s.canvasH / 2 });
    // Midpoint dead centre means the anchor is the POI itself.
    expect(t.poi.x).toBeCloseTo(500, 10);
    expect(t.poi.y).toBeCloseTo(300, 10);
  });
});

describe("maxUsefulZoom", () => {
  const game = (height) => ({ app: { window: { height } }, zoom: 1, poi: { x: 0, y: 0 } });

  it("stops where the whole world height fills the viewport", () => {
    expect(maxUsefulZoom(game(812))).toBeCloseTo(WORLD_HEIGHT / 812, 10);
    expect(maxUsefulZoom(game(768))).toBeCloseTo(WORLD_HEIGHT / 768, 10);
  });

  // The reason the ceiling exists at all: past this point clampPOI's lower
  // bound overtakes its upper one and the camera is pinned off the tower.
  it("is exactly where the POI clamp bounds meet, never past", () => {
    for (const h of [568, 768, 812, 1024]) {
      const z = maxUsefulZoom(game(h));
      const halfH = h * 0.5 * z;
      expect(-360 + halfH).toBeCloseTo(360 * 12 - halfH, 6);
    }
  });

  it("is far short of the old ZOOM_MAX", () => {
    expect(maxUsefulZoom(game(812))).toBeLessThan(ZOOM_MAX / 10);
  });

  it("survives a viewport that has not been measured yet", () => {
    expect(maxUsefulZoom({})).toBeGreaterThan(0);
    expect(maxUsefulZoom({ app: { window: { height: 0 } } })).toBeGreaterThan(0);
  });
});

describe("zoom buttons and keys", () => {
  const game = (zoom, height = 812) => ({
    app: { window: { height } },
    zoom,
    poi: { x: 0, y: 0 },
  });

  it("saturates at the useful ceiling instead of refusing to move", () => {
    const g = game(1);
    for (let i = 0; i < 20; i++) zoomOut(g);
    expect(g.zoom).toBeCloseTo(maxUsefulZoom(g), 10);
  });

  it("never overshoots the ceiling on the last step", () => {
    const g = game(maxUsefulZoom(game(812)) * 0.9);
    zoomOut(g);
    expect(g.zoom).toBeLessThanOrEqual(maxUsefulZoom(g));
  });

  it("still guards the close end", () => {
    const g = game(1);
    for (let i = 0; i < 20; i++) zoomIn(g);
    expect(g.zoom).toBeGreaterThanOrEqual(ZOOM_MIN);
  });
});

describe("pan and tap helpers", () => {
  // The POI is what the camera looks at, so it moves against the drag for the
  // tower to travel with it. An earlier version of this test asserted the
  // opposite signs and called it "tracks the finger"; it did not — one-finger
  // pan pushed the tower the wrong way, and disagreed with the two-finger
  // pinch pan, which pins its anchor and so always tracked correctly.
  it("moves the camera against the drag so content tracks the finger", () => {
    expect(panWorldOffset(10, 10, 2)).toEqual({ dx: -20, dy: 20 });
  });

  it("scales with zoom, so a drag covers the same screen distance at any zoom", () => {
    expect(panWorldOffset(10, 0, 1).dx).toBe(-10);
    expect(panWorldOffset(10, 0, 4).dx).toBe(-40);
  });

  it("is zero for a stationary finger", () => {
    expect(panWorldOffset(0, 0, 2)).toEqual({ dx: -0, dy: 0 });
  });

  it("measures a pinch span and midpoint", () => {
    const m = pinchMetrics({ x: 0, y: 0 }, { x: 6, y: 8 });
    expect(m.dist).toBe(10);
    expect(m.mid).toEqual({ x: 3, y: 4 });
  });

  it("keeps the tap slop small enough to build on", () => {
    expect(TAP_SLOP_PX).toBeGreaterThan(0);
    expect(TAP_SLOP_PX).toBeLessThan(44);
  });
});
