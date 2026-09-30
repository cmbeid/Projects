import { describe, expect, it } from 'vitest';
import { FARM, MAP_W } from '../src/data/maps';
import { passable } from '../src/game/helpers';
import { pathBeside, pathTo } from '../src/game/path';

describe('path', () => {
  it('has a rectangular map', () => {
    for (const row of FARM) expect(row.length).toBe(MAP_W);
  });

  it('walks around the farmhouse', () => {
    const path = pathTo({ x: 1, y: 1 }, { x: 4, y: 5 }, passable);
    expect(path).not.toBeNull();
    for (const p of path!) expect(passable(p)).toBe(true);
    expect(path!.at(-1)).toEqual({ x: 4, y: 5 });
  });

  it('stops beside things that cannot be stood on', () => {
    const path = pathBeside({ x: 12, y: 20 }, { x: 13, y: 29 }, passable);
    const end = path!.at(-1)!;
    expect(Math.abs(end.x - 13) + Math.abs(end.y - 29)).toBe(1);
  });

  it('returns null when there is no way', () => {
    expect(pathTo({ x: 4, y: 5 }, { x: 0, y: 0 }, passable)).toBeNull();
  });
});
