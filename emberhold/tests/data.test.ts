import { describe, expect, it } from 'vitest';
import atlas from '../src/sprites/atlas.json';
import { AREAS, MONSTERS, SPELLS } from '../src/data/combat';
import { ITEMS } from '../src/data/items';
import { GUILDS, PETS, QUESTS } from '../src/data/meta';
import { ACTIONS, SKILL_LIST } from '../src/data/skills';
import { validateData } from '../src/data/validate';
import { allIcons, buildSprites, TEMPLATE_NAMES } from '../src/sprites/defs';
import { spritesHash } from '../src/sprites/hash';

describe('content', () => {
  it('is consistent (npm run validate)', () => {
    expect(validateData(new Set(TEMPLATE_NAMES))).toEqual([]);
  });

  it('has the breadth promised', () => {
    expect(SKILL_LIST.length).toBe(30);
    expect(MONSTERS.length).toBeGreaterThanOrEqual(60);
    expect(AREAS.filter((a) => a.kind === 'dungeon').length).toBeGreaterThanOrEqual(7);
    expect(ITEMS.length).toBeGreaterThan(500);
    expect(ACTIONS.length).toBeGreaterThan(400);
    expect(SPELLS.length).toBeGreaterThanOrEqual(20);
    expect(QUESTS.length).toBeGreaterThanOrEqual(15);
    expect(PETS.length).toBeGreaterThanOrEqual(30);
    expect(GUILDS.length).toBe(23);
  });

  it('gives every guild a full task list', () => {
    for (const g of GUILDS) expect(g.tasks.length, g.id).toBeGreaterThanOrEqual(7);
  });

  it('every damage type has a monster weak to it', () => {
    for (const t of ['stab', 'slash', 'crush', 'pierce', 'fire', 'water', 'earth', 'air', 'void']) {
      expect(MONSTERS.some((m) => (m.resist as Record<string, number>)[t]! < 0), t).toBe(true);
    }
  });
});

describe('sprites', () => {
  it('the committed atlas matches the definitions (run `npm run bake`)', () => {
    expect(atlas.hash).toBe(spritesHash(buildSprites()));
  });

  it('has a frame for every icon the game uses', () => {
    const frames = new Set(Object.keys(atlas.frames));
    expect(allIcons().filter((i) => !frames.has(i))).toEqual([]);
  });
});
