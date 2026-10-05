import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../src/data/buildings';
import { DISTRICTS, GRID_H, districtAt, rowOfWard, wardOfRow } from '../src/data/districts';
import { STORY } from '../src/data/missions';
import { validateData } from '../src/data/validate';

describe('content', () => {
  it('is consistent', () => {
    expect(validateData()).toEqual([]);
  });

  it('gives every ward of every district a row, and the last district runs on past its grid', () => {
    for (let d = 0; d < DISTRICTS.length; d++) {
      for (let y = 0; y < GRID_H; y++) {
        const ward = wardOfRow(d, y);
        expect(districtAt(ward)).toBe(DISTRICTS[d]);
        expect(rowOfWard(ward)).toBe(y);
      }
    }
    expect(districtAt(40).id).toBe('spire');
    expect(districtAt(41).id).toBe('undercroft');
    expect(districtAt(90).id).toBe('shore');
    expect(rowOfWard(90)).toBe(-1);
  });

  it('has a story with a choice at the top of the Spire, and buildings for every district', () => {
    expect(STORY.find((m) => m.id === 'summit')?.choice?.options.length).toBe(2);
    expect(STORY.at(-1)?.id).toBe('hearthrise');
    expect(DISTRICTS.length).toBe(8);
    expect(BUILDINGS.length).toBeGreaterThanOrEqual(56);
  });
});
