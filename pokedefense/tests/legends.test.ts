import { describe, expect, it } from 'vitest';
import { NO_TRAINER } from '../src/data/items';
import { COLS, mapDef, ROWS } from '../src/data/maps';
import { line, lineForDex } from '../src/data/towers';
import { canPlace, hitAs, judgmentType, newGame, placeTower, type Tower } from '../src/game/game';
import { NO_EFFECTS } from '../src/game/stats';
import { freshProgress, lineUnlocked } from '../src/state/save';

const battle = (mapId: string, team: string[]) =>
  newGame({ map: mapDef(mapId), difficulty: 'normal', team, items: {}, balls: {}, held: {}, trainer: NO_TRAINER, seed: 3 });

function place(g: ReturnType<typeof battle>, lineId: string): Tower {
  g.money = 1e6;
  for (let y = 0; y < ROWS; y += 1) for (let x = 0; x < COLS; x += 1) if (!canPlace(g, lineId, x, y)) return placeTower(g, lineId, x, y) as Tower;
  throw new Error('nowhere to place');
}

describe('legendary towers', () => {
  it('joins your roster once caught — a Mewtwo caught before now included', () => {
    const p = freshProgress();
    expect(lineUnlocked(p, line('mewtwo'))).toBe(false);
    p.caught.push(150);
    expect(lineForDex(150)?.id).toBe('mewtwo');
    expect(lineUnlocked(p, line('mewtwo'))).toBe(true);
  });

  it('brings its weather: Kyogre rain, Groudon sun, Rayquaza clears it', () => {
    const g = battle('viridian-forest', ['kyogre', 'groudon', 'rayquaza']);
    expect(g.weather).toBeUndefined();
    place(g, 'kyogre');
    expect(g.weather).toBe('rain');
    place(g, 'groudon');
    expect(g.weather).toBe('sun');
    place(g, 'rayquaza');
    expect(g.weather).toBeUndefined();
  });

  it('lets Zygarde’s Thousand Arrows hit flyers', () => {
    expect(hitAs({ ...NO_EFFECTS }, 'ground', ['flying']).against).toEqual(['flying']);
    const grounded = hitAs({ ...NO_EFFECTS, smackDown: 1 }, 'ground', ['bug', 'flying']);
    expect(grounded.against).toEqual(['bug']);
    expect(hitAs({ ...NO_EFFECTS, smackDown: 1 }, 'ground', ['flying']).against).toEqual(['normal']);
  });

  it('turns Arceus’s Judgment into whatever its target fears most', () => {
    expect(judgmentType('normal', ['ghost'])).toBe('ghost');
    expect(judgmentType('normal', ['dragon', 'flying'])).toBe('ice');
    expect(hitAs({ ...NO_EFFECTS, judgment: 1 }, 'normal', ['water']).type).toBe('electric');
  });
});
