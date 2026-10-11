/**
 * Balance numbers in one place, for tuning against `npm run playtest`.
 */
export const BAL = {
  start: { fuel: 8, food: 14, energy: 30, hull: 40, credits: 40 },
  /** Fuel per jump before engine and skill discounts. */
  jumpFuel: 1,
  /** Food each crew member eats per day. */
  eat: 1,
  /** Energy life support draws per crew member per day. */
  lifePerCrew: 1,
  starveHp: 8,
  starveMorale: 12,
  darkHp: 10,
  healPerDay: 3,
  /** Morale drifts toward this each day. */
  moraleRest: 60,
  /** XP needed for level n → n+1. */
  xpFor: (level: number): number => Math.round(40 * level ** 1.45),
  maxLevel: 15,
  /** Away missions. */
  away: {
    o2: 110,
    hp: 60,
    shield: 40,
    carry: 22,
    speed: 3.6,
    dmg: 9,
    fireCd: 0.5,
    range: 5,
    gatherCd: 0.3,
    gatherPer: 1,
    /** Bonus gather yield per sector, so late planets pay more. */
    sectorYield: 0.15,
  },
  /** Credits per hull point at a station. */
  repairCost: 2,
  /** Sell price as a share of buy price. */
  sellShare: 0.45,
  /** Enemy stats grow this much per sector beyond their first. */
  enemyScale: 0.18,
  /** Flat multipliers on every enemy, for tuning fights as a whole. */
  enemyDmg: 1.5,
  enemyHull: 1.25,
  stationRestockDays: 6,
  planetLandings: 2,
} as const;
