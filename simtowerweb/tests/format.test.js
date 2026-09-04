// format.js is the one UI module that is deliberately DOM-free, so it is the
// one that can be covered without a browser. These tests pin the behaviours
// other code reads as contracts: the toolbox header, the phone toast, the
// minimap and the "fit tower" zoom control all depend on what is asserted here.
import { describe, expect, it } from "vitest";
import {
  MESSAGE_DURATION,
  MessageQueue,
  formatClock,
  formatCommaMoney,
  formatCompactMoney,
  formatDate,
  formatSignedCompactMoney,
  speedLabel,
  toolLabel,
  toolTooltip,
  towerBounds,
} from "../src/ui/format.js";

describe("money", () => {
  it("groups thousands and keeps the sign outside the $", () => {
    expect(formatCommaMoney(0)).toBe("$0");
    expect(formatCommaMoney(1000)).toBe("$1,000");
    expect(formatCommaMoney(40000)).toBe("$40,000");
    expect(formatCommaMoney(2000000)).toBe("$2,000,000");
    expect(formatCommaMoney(-1500)).toBe("-$1,500");
  });

  it("truncates rather than rounds in the compact form", () => {
    expect(formatCompactMoney(999)).toBe("$999");
    expect(formatCompactMoney(1999)).toBe("$1k");
    expect(formatCompactMoney(1999999)).toBe("$1M");
    expect(formatSignedCompactMoney(-2500)).toBe("-$2k");
    expect(formatSignedCompactMoney(2500)).toBe("+$2k");
  });
});

describe("clock", () => {
  it("pads to HH:MM", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(9.5)).toBe("09:30");
  });

  it("rolls a rounded 59.6th minute into the next hour", () => {
    // 11:59:36 rounds to 60 minutes, which must become 12:00, not 11:60.
    expect(formatClock(11 + 59.6 / 60)).toBe("12:00");
  });

  it("clamps at the end of the day", () => {
    expect(formatClock(24)).toBe("24:00");
  });
});

describe("date", () => {
  it("marks day 2 as the holiday", () => {
    expect(formatDate({ day: 2, quarter: 3, year: 1 })).toEqual({
      text: "Hol Q3 Y1",
      weekend: true,
    });
    expect(formatDate({ day: 0, quarter: 1, year: 2 }).weekend).toBe(false);
  });
});

describe("tool labels", () => {
  it("names the armed item and its price", () => {
    const g = { toolPrototype: { name: "Office", price: 40000 }, speedMode: 1 };
    expect(toolLabel(g)).toBe("Construct Office $40,000");
    expect(toolTooltip(g)).toBe("Construct Office $40,000  |  Speed 1x");
  });

  it("names the non-item tools", () => {
    expect(toolLabel({ selectedTool: "bulldozer" })).toBe("Bulldoze");
    expect(toolLabel({ selectedTool: "inspector" })).toBe("Inspect");
  });

  // The phone drawer header falls back to "TOOLS" on an empty label, so an
  // unknown tool has to come back empty rather than as a stray string.
  it("is empty for an unrecognised tool", () => {
    expect(toolLabel({ selectedTool: "nonesuch" })).toBe("");
    expect(toolTooltip({ selectedTool: "nonesuch", speedMode: 0 })).toBe("Paused");
  });

  it("labels every speed mode", () => {
    expect([0, 1, 2, 3].map(speedLabel)).toEqual(["Paused", "Speed 1x", "Speed 2x", "Speed 4x"]);
  });
});

describe("MessageQueue", () => {
  const q = () => new MessageQueue();

  it("shows the first message immediately", () => {
    expect(q().show("hello")).toBe("hello");
  });

  it("queues behind a live message and releases it on expiry", () => {
    const m = q();
    m.show("first");
    m.show("second");
    expect(m.current).toBe("first");
    expect(m.advance(MESSAGE_DURATION)).toBe("second");
    expect(m.advance(MESSAGE_DURATION)).toBe("");
  });

  // Bounded so a burst of events (a fire spawning many messages) cannot pin
  // the toast for minutes; the oldest pending is dropped, not the newest.
  it("keeps only the three newest pending messages", () => {
    const m = q();
    m.show("live");
    for (const s of ["a", "b", "c", "d"]) m.show(s);
    expect(m.pending).toEqual(["b", "c", "d"]);
  });

  it("clears everything", () => {
    const m = q();
    m.show("live");
    m.show("queued");
    m.clear();
    expect(m.current).toBe("");
    expect(m.pending).toHaveLength(0);
  });
});

describe("towerBounds", () => {
  const at = (x, y, w = 1, h = 1) => ({ position: { x, y }, size: { x: w, y: h } });

  it("spans every item", () => {
    expect(towerBounds([at(10, 0, 4, 1), at(2, 3)])).toEqual({
      minX: 2,
      minY: -1,
      maxX: 14,
      maxY: 6,
    });
  });

  // Both the minimap and "fit tower" divide by the span, so an empty tower has
  // to come back with a usable box rather than +/-Infinity or a zero height.
  it("returns the minimum viewport for an empty tower", () => {
    expect(towerBounds([])).toEqual({ minX: 0, minY: -1, maxX: 0, maxY: 6 });
  });

  it("keeps the floor but grows past it", () => {
    const b = towerBounds([at(0, -5), at(0, 20)]);
    expect(b.minY).toBe(-5);
    expect(b.maxY).toBe(21);
  });
});
