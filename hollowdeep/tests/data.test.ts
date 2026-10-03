import { describe, expect, it } from 'vitest';
import { validateData } from '../src/data/validate';
import { BIOMES } from '../src/data/biomes';
import { GEAR } from '../src/data/gear';
import { MATERIALS } from '../src/data/materials';
import { STORY } from '../src/data/missions';
import { CRAFT, REFINE } from '../src/data/recipes';

describe('content', () => {
  it('is internally consistent', () => {
    expect(validateData()).toEqual([]);
  });

  it('has the promised breadth', () => {
    expect(BIOMES).toHaveLength(7);
    expect(MATERIALS.filter((m) => m.kind === 'ore' || m.kind === 'gem').length).toBeGreaterThanOrEqual(25);
    expect(CRAFT.length + REFINE.length).toBeGreaterThanOrEqual(40);
    expect(STORY.length).toBeGreaterThanOrEqual(75);
    expect(GEAR.length).toBeGreaterThan(20);
  });
});
