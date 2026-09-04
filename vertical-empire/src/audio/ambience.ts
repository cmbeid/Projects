/**
 * What the tower sounds like when nothing is happening in it.
 *
 * Eight of the game's sounds are scenery — birds, crows, church bells, thunder,
 * crickets, a crowd. Nothing in the original's rules asks for them and nothing
 * here simulates the weather or the dawn chorus. They are chosen by the clock,
 * which the palette already follows, so the layer changes when the light does
 * and the two agree without either knowing about the other.
 *
 * The whole schedule is a pure function of the hour and a roll, and the roll is
 * passed in rather than taken from `Math.random` here. That is what makes it
 * testable at all: "crickets at 23:00, never a crowd in an empty lot" is an
 * assertion about this function, and a screenshot pinned with `?hour=` stays
 * reproducible.
 *
 * The *timing* deliberately lives in the caller, and must be in real seconds.
 * A day is 90 seconds, so a game hour is 3.75 — anything scheduled per hour
 * would ring the church bells sixteen times a minute.
 */

import { AMBIENCE } from '../assets/slice.js';

/** How much of every roll goes to weather, whatever the hour. */
const WEATHER_SHARE = 0.06;

/** And how much of a daylight roll goes to the crowd, when there is one. */
const CROWD_SHARE = 0.35;

/**
 * The pool for an hour of the day.
 *
 * Bands rather than a curve: the sounds are one-shots, and a bird that fades
 * gradually into a cricket is not a thing either clip can do.
 */
export function ambientPool(hour: number): readonly number[] {
  if (hour >= 5 && hour < 9) return AMBIENCE.dawn;
  if (hour >= 9 && hour < 18) return AMBIENCE.day;
  if (hour >= 18 && hour < 21) return AMBIENCE.dusk;
  return AMBIENCE.night;
}

/** Whether the hour is one a crowd could plausibly be out in. */
function daylight(hour: number): boolean {
  return hour >= 8 && hour < 20;
}

/**
 * Which sound to play next, or `undefined` for a beat of quiet.
 *
 * `roll` is a number in [0, 1). It picks the pool *and* the clip from it, so one
 * source of randomness covers the whole decision and a test can name a value
 * that produces a particular sound.
 */
export function pickAmbient(
  hour: number,
  world: { populated: boolean },
  roll: number,
): number | undefined {
  if (!(roll >= 0) || roll >= 1) return undefined;

  // Weather first, and rarely. It gets a slice of every hour because a storm at
  // four in the morning is as reasonable as one at noon.
  if (roll < WEATHER_SHARE) return pick(AMBIENCE.weather, roll / WEATHER_SHARE);
  let rest = (roll - WEATHER_SHARE) / (1 - WEATHER_SHARE);

  // The crowd is the one pool that would be a lie over bare ground, so an empty
  // lot hands its share back to the birds rather than falling silent.
  if (world.populated && daylight(hour) && rest < CROWD_SHARE) {
    return pick(AMBIENCE.crowd, rest / CROWD_SHARE);
  }
  if (world.populated && daylight(hour)) rest = (rest - CROWD_SHARE) / (1 - CROWD_SHARE);

  return pick(ambientPool(hour), rest);
}

function pick(pool: readonly number[], at: number): number | undefined {
  if (pool.length === 0) return undefined;
  const index = Math.min(pool.length - 1, Math.floor(at * pool.length));
  return pool[index];
}
