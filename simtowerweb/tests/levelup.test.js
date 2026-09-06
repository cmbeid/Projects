// LevelUp is DOM-free game logic, so the advancement table and the rating
// dialog's checklist can both be pinned without a browser.
import { describe, expect, it } from "vitest";
import { LevelUp } from "../src/game/systems/levelup.js";

const counts = (over = {}) => ({
  securityOffices: 0,
  medicalCenters: 0,
  metroStations: 0,
  ...over,
});

describe("LevelUp.requirementChecklist", () => {
  it("lists only the conditions the level actually gates on", () => {
    // 2 stars is population-only; no facility rows should appear.
    const req = LevelUp.advancementRequirements(0);
    const rows = LevelUp.requirementChecklist(req, 120, counts(), 0);
    expect(rows.map((r) => r.label)).toEqual(["Population"]);
    expect(rows[0]).toMatchObject({ have: 120, need: 300, met: false });
  });

  it("marks a facility met as soon as one exists", () => {
    const req = LevelUp.advancementRequirements(1); // 1000 pop + Security
    const without = LevelUp.requirementChecklist(req, 1000, counts(), 0);
    const with_ = LevelUp.requirementChecklist(req, 1000, counts({ securityOffices: 1 }), 0);
    expect(without.find((r) => r.label === "Security Office").met).toBe(false);
    expect(with_.find((r) => r.label === "Security Office").met).toBe(true);
  });

  it("agrees with meetsRequirements on every level", () => {
    // The checklist is a breakdown of the same predicate; if every row is met
    // the predicate must pass, and vice versa. Guards against the two drifting.
    const cases = [
      [0, 0, counts(), 0],
      [0, 300, counts(), 0],
      [1, 1000, counts(), 0],
      [1, 1000, counts({ securityOffices: 1 }), 0],
      [2, 5000, counts({ securityOffices: 1, medicalCenters: 1 }), 0],
      [2, 5000, counts({ securityOffices: 1, medicalCenters: 1 }), 1],
      [3, 10000, counts({ securityOffices: 1, medicalCenters: 1 }), 1],
      [3, 10000, counts({ securityOffices: 1, medicalCenters: 1, metroStations: 1 }), 1],
    ];
    for (const [rating, pop, c, vip] of cases) {
      const req = LevelUp.advancementRequirements(rating);
      const rows = LevelUp.requirementChecklist(req, pop, c, vip);
      expect(rows.every((r) => r.met)).toBe(LevelUp.meetsRequirements(req, pop, c, vip));
    }
  });

  it("returns nothing past the top of the table", () => {
    expect(LevelUp.advancementRequirements(5)).toBeNull();
    expect(LevelUp.requirementChecklist(null, 99999, counts(), 9)).toEqual([]);
  });
});
