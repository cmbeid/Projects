/**
 * A week on the farm, played by a simple bot through the same commands the
 * UI uses: buy Oran seeds, till and plant a patch, water it every morning,
 * harvest what's ripe and ship it. It has to come out ahead.
 */
import { describe, expect, it } from 'vitest';
import { seedId } from '../src/data/items';
import { buy, ship } from '../src/game/economy';
import { isRipe } from '../src/game/farm';
import { plotKey } from '../src/game/model';
import { select, sleep, tapTile, type World } from '../src/game/world';
import { run } from './helpers';
import { createWorld } from '../src/game/world';

const PATCH = [5, 6, 7, 8, 9].flatMap((x) => [13, 14, 15].map((y) => ({ x, y })));

/** Tap a tile and wait for the walk and the action to finish. */
function go(w: World, x: number, y: number): void {
  tapTile(w, x, y);
  let guard = 0;
  while ((w.player.path.length || w.player.pending) && guard < 2000) {
    run(w, 1 / 30, 1 / 30);
    guard += 1;
  }
}

describe('a week of farming', () => {
  for (const starter of [1, 4, 7]) {
    it(`makes money with starter #${starter}`, () => {
      const w = createWorld(42, starter);
      const start = w.player.gold;
      for (let day = 0; day < 7; day += 1) {
        for (const p of PATCH) {
          const plot = w.plots[plotKey(p.x, p.y)];
          if (plot?.crop && isRipe(plot.crop)) go(w, p.x, p.y);
        }
        for (const id of ['oran', 'cheri']) if (w.inventory[id]) ship(w, id, w.inventory[id]!);
        if ((w.inventory[seedId('oran')] ?? 0) < PATCH.length) buy(w, seedId('oran'), 5);
        for (const p of PATCH) {
          if (!w.plots[plotKey(p.x, p.y)]) {
            select(w, 'hoe');
            go(w, p.x, p.y);
          }
          const plot = w.plots[plotKey(p.x, p.y)];
          if (plot && !plot.crop && w.inventory[seedId('oran')]) {
            select(w, seedId('oran'));
            go(w, p.x, p.y);
          }
        }
        if (w.player.water < PATCH.length) {
          select(w, 'can');
          go(w, 17, 5);
        }
        for (const p of PATCH) {
          const plot = w.plots[plotKey(p.x, p.y)];
          if (plot?.crop && !plot.watered) {
            select(w, 'can');
            go(w, p.x, p.y);
          }
        }
        sleep(w);
      }
      expect(w.stats.harvested).toBeGreaterThan(15);
      expect(w.player.gold).toBeGreaterThan(start);
    });
  }
});
