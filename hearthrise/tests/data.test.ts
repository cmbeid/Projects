import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../src/data/buildings';
import { DISTRICTS, GRID_H, districtAt, rowOfWard, wardOfRow } from '../src/data/districts';
import { STORY } from '../src/data/missions';
import { validateData } from '../src/data/validate';

describe('content', () => {
  it('is consistent', () => {
    expect(validateData()).toEqual([]);
  });

  it('gives every ward of every district a row, and the Spire runs on past its grid', () => {
    for (let d = 0; d < DISTRICTS.length; d++) {
      for (let y = 0; y < GRID_H; y++) {
        const ward = wardOfRow(d, y);
        expect(districtAt(ward)).toBe(DISTRICTS[d]);
        expect(rowOfWard(ward)).toBe(y);
      }
    }
    expect(districtAt(60).id).toBe('spire');
    expect(rowOfWard(60)).toBe(-1);
  });

  it('has a story that ends with a choice, and buildings for every district', () => {
    expect(STORY.at(-1)?.choice?.options.length).toBe(2);
    expect(BUILDINGS.length).toBeGreaterThanOrEqual(30);
  });
});
