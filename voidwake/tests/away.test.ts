import { describe, expect, it } from 'vitest';
import { BIOME_IDS } from '../src/data/biomes';
import { awayBotInput, newMemo } from '../src/game/away/ai';
import { AWAY_H, AWAY_W, generateMap, tileAt } from '../src/game/away/gen';
import { createAway, endAway } from '../src/game/away/mission';
import { liftOff, NO_INPUT, stepAway } from '../src/game/away/sim';
import { node } from '../src/game/galaxy';
import type { GameState } from '../src/state/types';
import { started } from './helpers';

function atSystem(seed = 7): GameState {
  const s = started(seed);
  const sys = s.sector.nodes.find((n) => n.kind === 'system')!;
  s.at = sys.id;
  return s;
}

describe('away missions', () => {
  it('every biome makes a map whose floor is all reachable from the lander', () => {
    for (const biome of BIOME_IDS) {
      for (const seed of [1, 2, 3]) {
        const { tiles, lander } = generateMap(seed, biome, 2);
        const a = { tiles, w: AWAY_W, h: AWAY_H };
        expect(tileAt(a, lander.x, lander.y)).not.toBe('#');
        const seen = new Set<number>();
        const q = [Math.floor(lander.y) * AWAY_W + Math.floor(lander.x)];
        while (q.length) {
          const k = q.pop()!;
          if (seen.has(k)) continue;
          seen.add(k);
          const x = k % AWAY_W;
          const y = Math.floor(k / AWAY_W);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (tileAt(a, x + dx!, y + dy!) !== '#') q.push((y + dy!) * AWAY_W + x + dx!);
        }
        const floor = [...tiles].filter((t) => t !== '#').length;
        expect(seen.size).toBe(floor);
        expect(floor).toBeGreaterThan(AWAY_W * AWAY_H * 0.2);
      }
    }
  });

  it('a landing walks out, gathers, comes home and banks the haul', () => {
    const s = atSystem();
    const crew = s.crew.find((c) => c.cls !== 'medic')!;
    expect(createAway(s, 0, crew.id)).toBe(true);
    const a = s.away!;
    const memo = newMemo();
    let steps = 0;
    while (a.status === 'play' && steps++ < 60 * 300) {
      const inp = awayBotInput(a, memo);
      if (inp.leave) {
        liftOff(a);
        break;
      }
      stepAway(a, inp);
    }
    expect(a.status).toBe('done');
    const got = Object.values(a.haul).reduce((x, y) => x + (y ?? 0), 0);
    expect(got).toBeGreaterThan(0);
    const before = Object.values(s.mats).reduce((x, y) => x + y, 0);
    endAway(s);
    expect(Object.values(s.mats).reduce((x, y) => x + y, 0)).toBe(before + got);
    expect(node(s).planets[0]!.landings).toBe(1);
    expect(s.screen === 'map' || s.screen === 'event').toBe(true);
  });

  it('running out of air brings the explorer down and loses the haul', () => {
    const s = atSystem();
    createAway(s, 0, s.crew[0]!.id);
    const a = s.away!;
    a.haul = { ore: 5 };
    a.o2 = 0;
    for (let i = 0; i < 60 * 120 && a.status === 'play'; i++) stepAway(a, NO_INPUT);
    expect(a.status).toBe('down');
    const ore = s.mats.ore;
    endAway(s);
    expect(s.mats.ore).toBe(ore);
    expect(s.crew[0]!.hp).toBe(1);
  });

  it('can only lift off from the lander', () => {
    const s = atSystem();
    createAway(s, 0, s.crew[0]!.id);
    const a = s.away!;
    expect(liftOff(a)).toBe(true);
    const s2 = atSystem();
    createAway(s2, 0, s2.crew[0]!.id);
    s2.away!.x = 3;
    s2.away!.y = 3;
    expect(liftOff(s2.away!)).toBe(false);
  });
});
