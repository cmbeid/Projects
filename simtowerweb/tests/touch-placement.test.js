// Touch placement is tap-to-park, drag-to-move, tap-the-ghost-to-build. The
// hit test is what separates "confirm this" from "move it over there", and
// getting it wrong is expensive in both directions: too tight and the ghost
// can never be confirmed on a phone, too loose and a tap meant to reposition
// builds instead — with no undo anywhere in the codebase.
import { describe, expect, it } from "vitest";
import { Game, ICON } from "../src/game/game.js";

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

// Laying a row of hotel rooms used to be tap-park + tap-place for every unit.
// A successful touch build now steps the ghost one footprint along and leaves
// it armed, so each further tap places the next one.
describe("ghost auto-advance", () => {
  const ctx = (proto, built) => ({
    pendingPress: { kind: "ghostCommit" },
    toolPosition: { x: 20, y: 2 },
    toolPrototype: proto,
    _toolHeightOverride: 7,
    ghostArmed: true,
    ghostGrab: { dx: 0, dy: 0 },
    batchDrag: null,
    draggingElevator: null,
    clickConstruct: () => built,
    _isBatchDraggable: Game.prototype._isBatchDraggable,
    clearGhost: Game.prototype.clearGhost,
  });
  const room = { id: "hotel_single", icon: ICON.HOTEL, size: { x: 4, y: 1 } };

  it("steps one footprint along and stays armed after a build", () => {
    const c = ctx(room, true);
    Game.prototype.handlePointerUp.call(c);
    expect(c.ghostArmed).toBe(true);
    expect(c.toolPosition).toEqual({ x: 24, y: 2 });
    // ghostAt is what makes the step survive: Game.advance() runs
    // updateToolPosition() every frame, and without a parked position to pin
    // to it drags the ghost straight back under the last finger position.
    expect(c.ghostAt).toEqual({ x: 24, y: 2 });
    // The lobby/spiral-stair height preview must not leak onto the next unit.
    expect(c._toolHeightOverride).toBeNull();
    expect(c.ghostGrab).toBeNull();
  });

  it("disarms when the build was refused, so a tap cannot re-fire", () => {
    const c = ctx(room, false);
    Game.prototype.handlePointerUp.call(c);
    expect(c.ghostArmed).toBe(false);
    expect(c.toolPosition).toEqual({ x: 20, y: 2 });
  });

  it("never chains the tools the mouse cannot batch-drag", () => {
    // Same exclusion list as the mouse gesture: elevators, ramps, and the
    // lobby / floor / metro / stairs icons are placed deliberately, one at a
    // time, and must not lay a row from a stray second tap.
    for (const proto of [
      { id: "elevator-standard", icon: ICON.ELEVATOR, size: { x: 4, y: 1 } },
      { id: "parkingramp", icon: ICON.PARKING, size: { x: 4, y: 1 } },
      { id: "lobby", icon: ICON.LOBBY, size: { x: 4, y: 1 } },
      { id: "floor", icon: ICON.FLOOR, size: { x: 8, y: 1 } },
      { id: "stairs", icon: ICON.STAIRS, size: { x: 4, y: 2 } },
      { id: "metro", icon: ICON.METRO, size: { x: 8, y: 1 } },
    ]) {
      const c = ctx(proto, true);
      Game.prototype.handlePointerUp.call(c);
      expect(c.ghostArmed, proto.id).toBe(false);
    }
  });
});

// The step only survives because updateToolPosition() pins a parked ghost to
// ghostAt. Game.advance() calls it every frame, so anything that recomputed
// the position from the pointer would undo the step before the next tap - the
// gesture appeared to work only in a test where the render loop was stopped.
describe("parked ghost survives the per-frame update", () => {
  const base = () => ({
    mouseWorld: { x: 160, y: 90 },          // finger left behind at tile ~18
    selectedTool: "item-hotel_single",
    itemFactory: { prototypesById: { hotel_single: { id: "hotel_single", icon: ICON.HOTEL, size: { x: 4, y: 1 } } } },
    toolPrototype: null,
    toolPosition: { x: 0, y: 0 },
    keys: {},
    itemsByType: new Map(),
    ui: { updateTooltip() {} },
  });

  it("keeps a parked ghost where it was left", () => {
    const c = { ...base(), ghostArmed: true, ghostGrab: null, ghostAt: { x: 24, y: 2 } };
    Game.prototype.updateToolPosition.call(c);
    expect(c.toolPosition).toEqual({ x: 24, y: 2 });
  });

  it("follows the pointer when there is no parked ghost", () => {
    const c = { ...base(), ghostArmed: false, ghostGrab: null, ghostAt: null };
    Game.prototype.updateToolPosition.call(c);
    expect(c.toolPosition).toEqual({ x: 18, y: 2 });
  });

  it("tracks the drag, and remembers where the drag left it", () => {
    const c = { ...base(), ghostArmed: true, ghostGrab: { dx: 2, dy: 1 }, ghostAt: { x: 24, y: 2 } };
    Game.prototype.updateToolPosition.call(c);
    expect(c.toolPosition).toEqual({ x: 20, y: 3 });
    expect(c.ghostAt).toEqual({ x: 20, y: 3 });
  });
});

// A drag that repositions the ghost ends without a commit, so it used to leave
// ghostGrab set. updateToolPosition() then folded that stale offset into the
// "raw cell under the finger" that the *next* press measures its own offset
// against, and the confirming tap slid the ghost sideways by exactly the
// previous drag's offset before building there.
describe("the grab offset does not outlive its gesture", () => {
  const ctx = (over = {}) => ({
    pendingPress: null,
    ghostGrab: { dx: -2, dy: 0 },
    ghostArmed: true,
    ghostAt: { x: 211, y: 3 },
    toolPosition: { x: 211, y: 3 },
    toolPrototype: null,
    batchDrag: null,
    draggingElevator: null,
    clearGhost: Game.prototype.clearGhost,
    _isBatchDraggable: Game.prototype._isBatchDraggable,
    clickConstruct: () => true,
    ...over,
  });

  it("clears it when the gesture ended without a pending press", () => {
    const c = ctx();
    Game.prototype.handlePointerUp.call(c);
    expect(c.ghostGrab).toBeNull();
    // The ghost itself stays put — a repositioning drag must not disarm it.
    expect(c.ghostArmed).toBe(true);
    expect(c.toolPosition).toEqual({ x: 211, y: 3 });
  });

  it("clears it after a commit too", () => {
    const c = ctx({
      pendingPress: { kind: "ghostCommit" },
      toolPrototype: { id: "hotel_single", icon: ICON.HOTEL, size: { x: 4, y: 1 } },
    });
    Game.prototype.handlePointerUp.call(c);
    expect(c.ghostGrab).toBeNull();
  });

  it("clears it after a bulldoze", () => {
    const c = ctx({
      pendingPress: { kind: "bulldoze" },
      bulldozeUnderCursor: () => true,
    });
    Game.prototype.handlePointerUp.call(c);
    expect(c.ghostGrab).toBeNull();
  });
});

// itemBelowCursor is a by-product of rendering, so it describes the *previous*
// frame's pointer. A mouse hovers before it clicks; a finger just arrives, so
// the first press on an elevator motor (or a bulldoze target) was tested
// against whatever the last frame happened to have under the cursor.
describe("pickItemAt", () => {
  const item = (id, layer, rect) => ({
    prototype: { id },
    layer,
    containsPoint: (p) =>
      p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h,
  });
  const floor = item("floor", 0, { x: 0, y: 0, w: 400, h: 36 });
  const office = item("office", 0, { x: 80, y: 0, w: 72, h: 24 });
  const shaft = item("elevator-standard", 1, { x: 80, y: 0, w: 32, h: 36 });

  const ctx = (items) => ({
    items,
    itemsByType: new Map([["floor", [floor]]]),
  });

  it("returns the topmost item, matching the renderer's draw order", () => {
    // Layer 1 draws last, so the shaft wins over the office it overlaps.
    const c = ctx([floor, office, shaft]);
    expect(Game.prototype.pickItemAt.call(c, { x: 96, y: 12 }).prototype.id).toBe(
      "elevator-standard",
    );
  });

  it("falls back through the layers when nothing above matches", () => {
    const c = ctx([floor, office, shaft]);
    expect(Game.prototype.pickItemAt.call(c, { x: 200, y: 12 }).prototype.id).toBe("floor");
  });

  it("returns null off every item", () => {
    const c = ctx([floor, office, shaft]);
    expect(Game.prototype.pickItemAt.call(c, { x: 900, y: 900 })).toBeNull();
  });

  it("does not need a floor bucket", () => {
    const c = { items: [shaft], itemsByType: new Map() };
    expect(Game.prototype.pickItemAt.call(c, { x: 96, y: 12 }).prototype.id).toBe(
      "elevator-standard",
    );
  });
});

// On touch no tool claims the press any more: a drag is a pan, and only a tap
// runs the tool. Claiming it meant that with the palette armed - which on a
// phone it nearly always is - one-finger panning was impossible without first
// switching to the hand tool, so the lobby and basements were unreachable.
describe("a pan drops the deferred tool action", () => {
  const ctx = (pending) => ({
    pendingPress: pending,
    ghostGrab: null,
    ghostArmed: false,
    ghostAt: null,
    toolPosition: { x: 0, y: 0 },
    toolPrototype: null,
    batchDrag: null,
    draggingElevator: null,
    clearGhost: Game.prototype.clearGhost,
    _isBatchDraggable: Game.prototype._isBatchDraggable,
    inspectTarget: Game.prototype.inspectTarget,
    clickConstruct: () => {
      throw new Error("must not build on a pan");
    },
    bulldozeUnderCursor: () => {
      throw new Error("must not demolish on a pan");
    },
  });

  it("does not build, demolish or park when the gesture panned", () => {
    for (const pending of [
      { kind: "ghostCommit" },
      { kind: "bulldoze" },
      { kind: "park", at: { x: 9, y: 9 } },
    ]) {
      const c = ctx(pending);
      expect(() => Game.prototype.handlePointerUp.call(c, { panned: true })).not.toThrow();
      expect(c.pendingPress).toBeNull();
      expect(c.ghostArmed).toBe(false);
    }
  });

  it("parks on a tap, at the cell the press was on", () => {
    const c = ctx({ kind: "park", at: { x: 12, y: 4 } });
    Game.prototype.handlePointerUp.call(c, { panned: false });
    expect(c.ghostArmed).toBe(true);
    expect(c.ghostAt).toEqual({ x: 12, y: 4 });
    expect(c.toolPosition).toEqual({ x: 12, y: 4 });
  });

  it("defaults to treating the gesture as a tap", () => {
    const c = ctx({ kind: "park", at: { x: 3, y: 1 } });
    Game.prototype.handlePointerUp.call(c);
    expect(c.ghostArmed).toBe(true);
  });
});
