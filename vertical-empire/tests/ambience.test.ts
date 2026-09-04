import { describe, expect, it } from 'vitest';

import { AMBIENCE } from '../src/assets/slice.js';
import { ambientPool, pickAmbient } from '../src/audio/ambience.js';

const BUSY = { populated: true };
const EMPTY = { populated: false };

/** Every answer the function gives for one hour, at a fine enough grain. */
function everything(hour: number, world: { populated: boolean }): Set<number> {
  const seen = new Set<number>();
  for (let roll = 0; roll < 1; roll += 0.001) {
    const id = pickAmbient(hour, world, roll);
    if (id !== undefined) seen.add(id);
  }
  return seen;
}

describe('the ambient layer', () => {
  it('follows the clock the way the palette does', () => {
    // The bands are the point: dawn should sound like dawn without anything
    // telling it what time it is beyond the hour the sky already uses.
    expect(ambientPool(6)).toBe(AMBIENCE.dawn);
    expect(ambientPool(13)).toBe(AMBIENCE.day);
    expect(ambientPool(19)).toBe(AMBIENCE.dusk);
    expect(ambientPool(23)).toBe(AMBIENCE.night);
    expect(ambientPool(2)).toBe(AMBIENCE.night);
  });

  it('plays crickets at night and birds at dawn, and never the other way round', () => {
    const night = everything(23, BUSY);
    expect(night).toContain(AMBIENCE.night[0]);
    for (const bird of AMBIENCE.dawn) expect(night).not.toContain(bird);

    const dawn = everything(6, BUSY);
    for (const bird of AMBIENCE.dawn) expect(dawn).toContain(bird);
    expect(dawn).not.toContain(AMBIENCE.night[0]);
  });

  it('keeps the crowd out of an empty lot', () => {
    // A crowd over bare ground is worse than silence: it is the one pool that
    // claims something about the tower rather than about the weather.
    for (const noise of AMBIENCE.crowd) {
      expect(everything(13, BUSY)).toContain(noise);
      expect(everything(13, EMPTY)).not.toContain(noise);
    }
    // And it is not simply lost — an empty lot hands the share back.
    expect(everything(13, EMPTY).size).toBeGreaterThan(0);
  });

  it('keeps the crowd indoors after dark, however busy the tower is', () => {
    for (const noise of AMBIENCE.crowd) {
      expect(everything(23, BUSY)).not.toContain(noise);
    }
  });

  it('gives weather a slice of every hour, and only a slice', () => {
    const thunder = AMBIENCE.weather[0];
    for (const hour of [3, 6, 13, 19]) {
      expect(everything(hour, BUSY), `hour ${hour}`).toContain(thunder);
    }
    // Rare enough to be weather rather than a climate: well under a tenth of
    // the rolls at the hour with the most competition for them.
    let storms = 0;
    for (let roll = 0; roll < 1; roll += 0.001) {
      if (pickAmbient(13, BUSY, roll) === thunder) storms += 1;
    }
    expect(storms / 1000).toBeLessThan(0.1);
  });

  it('says nothing for a roll outside the range it was promised', () => {
    // Cheap insurance: the caller draws the roll, and a caller that passes a
    // count or a millisecond timestamp should get silence, not the last clip in
    // whichever pool happened to be first.
    expect(pickAmbient(13, BUSY, 1)).toBeUndefined();
    expect(pickAmbient(13, BUSY, -0.5)).toBeUndefined();
    expect(pickAmbient(13, BUSY, Number.NaN)).toBeUndefined();
  });
});
