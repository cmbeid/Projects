/**
 * Every balance number in one place. `npm run playtest` prints the bot's
 * curve; `tests/bot.test.ts` fails if a change here breaks it.
 */
import type { ResId } from './types';

/** Each unit of a building line already standing makes the next one dearer by this much. */
export const COST_GROWTH = 1.15;
/**
 * How much dearer everything physical gets, era by era: buildings, wonders,
 * storage, festivals. The steps shrink later on because the late eras'
 * output grows more slowly (land runs out before people do).
 */
export const ERA_SCALE = [1, 7, 45, 280, 1600, 8000, 36_000, 150_000] as const;
/** Tier-0 base price, before the line's own shape. */
export const BUILD_BASE = 12;

/** Per tier (= era): how much a worker in that building's slot produces. */
export const TIER_PROD = [1, 2.7, 7.3, 20, 55, 160, 480, 1450] as const;
/** Per tier: workplace slots. */
export const TIER_SLOTS = [2, 3, 4, 5, 6, 8, 10, 12] as const;
/** Per tier: citizens a home houses. */
export const TIER_HOUSING = [2, 4, 7, 11, 16, 26, 42, 68] as const;
/** Per tier: storage a storehouse adds to every capped resource. */
export const TIER_CAP = ERA_SCALE.map((k) => 150 * k);
/** Per tier: stability a shrine adds. */
export const TIER_STABILITY = [5, 6, 7, 8, 9, 10, 11, 12] as const;
/** Per tier: power a plant supplies (tiers from the Industrial Age on). */
export const TIER_POWER = [0, 0, 0, 0, 0, 12, 30, 80] as const;

/** Modernizing an old unit costs this share of the current tier's price. */
export const MODERNIZE_SHARE = 0.6;

/** What every resource can hold before anyone builds a storehouse. */
export const BASE_CAP = 80;
/** Cap for each era reached, before any storehouse, so an old granary is never the only thing between you and a price. */
export const ERA_BASE_CAP = ERA_SCALE.map((k) => 40 * k);

/** What each citizen eats a second. */
export const EAT = 0.25;
/** Births a second: a base, plus a share of the housing. */
export const GROWTH_BASE = 0.25;
export const GROWTH_PER_HOUSING = 0.006;
/** Housing with no homes at all: the people around the fire. */
export const BASE_HOUSING = 5;
/** When the stores run dry, this share of the shortfall in citizens leaves each second. */
export const STARVE_RATE = 0.08;

/** Land the skyline starts with, and what each era advance adds. */
export const BASE_PLOTS = 12;
export const ERA_PLOTS = 4;

/** Stability: where it sits with no help, and what crowds cost. */
export const STABILITY_BASE = 70;
export const STABILITY_PER_ARTIST = 0.3;
export const STABILITY_SIZE = 2.5;
export const STABILITY_CROWDED = 10;
/** Output is ×(0.5 + stability/200), with stability counted up to this. */
export const STABILITY_CAP = 150;
/** At or above this, festivals run twice as long. */
export const GOLDEN_STABILITY = 120;

/** Tech prices: base × step^era × (1 + spread × position in the era). */
export const TECH_SCALE = [40, 600, 5000, 50_000, 450_000, 2_600_000, 16_000_000, 50_000_000] as const;
export const TECH_SPREAD = 0.35;

/** Festivals: ×boost to all output, for secs, at a culture price that rises with each one this era. */
export const FESTIVAL_BOOST = 0.5;
export const FESTIVAL_SECS = 60;
export const FESTIVAL_BASE = 40;
export const FESTIVAL_GROWTH = 1.3;

/** Chronicle events: seconds between them, and how long one waits for an answer. */
export const EVENT_GAP: readonly [number, number] = [150, 300];
export const EVENT_WAIT = 90;
/** The history book keeps this many entries. */
export const LOG_LIMIT = 250;

/** Time away that counts, in hours, before any bonus. */
export const OFFLINE_HOURS = 8;

/** Nominal seconds an era's calendar takes to run its course. */
export const ERA_SECONDS = [1200, 1800, 2400, 3000, 3600, 4200, 4800, 5400] as const;

/** Resources each era's buildings are priced in, most first. */
export const ERA_MATS: readonly (readonly ResId[])[] = [
  ['wood', 'stone'],
  ['wood', 'stone', 'metal'],
  ['stone', 'metal', 'gold'],
  ['wood', 'stone', 'gold'],
  ['stone', 'metal', 'gold'],
  ['metal', 'coal', 'gold'],
  ['steel', 'oil', 'gold'],
  ['steel', 'data', 'alloy'],
];

/** Heritage at launch: base + √peak population + per wonder + per tech, then the bonus. */
export const HERITAGE_BASE = 10;
export const HERITAGE_PER_WONDER = 3;
export const HERITAGE_PER_TECH = 0.5;
