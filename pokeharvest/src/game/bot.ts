/**
 * A simple farmer that plays through the same commands the UI uses: each
 * morning it picks ripe berries, ships them, buys seeds for the best crop in
 * season, tills and plants a patch, fills the can and waters. Used by the
 * tests and `npm run playtest` to check a whole year holds together.
 */
import { CROPS, inSeason } from '../data/crops';
import { seedId } from '../data/items';
import { buy, ship } from './economy';
import { isRipe } from './farm';
import { plotKey, type World } from './model';
import { seasonOf } from './time';
import { select, sleep, tapTile, tick } from './world';

export const PATCH = [5, 6, 7, 8, 9].flatMap((x) => [13, 14, 15].map((y) => ({ x, y })));

/** Tap a tile and wait for the walk and the action to finish. */
export function go(w: World, x: number, y: number): void {
  tapTile(w, x, y);
  for (let guard = 0; (w.player.path.length || w.player.pending) && guard < 2000; guard += 1) tick(w, 1 / 30);
}

/** The in-season crop that earns most per day that you can afford a patch of. */
export function bestCrop(w: World): string {
  const season = seasonOf(w.day);
  const options = CROPS.filter((c) => inSeason(c.id, season));
  options.sort((a, b) => (b.sellPrice - b.seedPrice) / b.days - (a.sellPrice - a.seedPrice) / a.days);
  return (options.find((c) => c.seedPrice * PATCH.length <= w.player.gold) ?? options[options.length - 1]!).id;
}

/** One day's work, then bed. */
export function botDay(w: World): void {
  for (const p of PATCH) {
    const plot = w.plots[plotKey(p.x, p.y)];
    if (plot?.crop && isRipe(plot.crop)) go(w, p.x, p.y);
  }
  for (const c of CROPS) if (w.inventory[c.id]) ship(w, c.id, w.inventory[c.id]!);
  const id = bestCrop(w);
  const seeds = seedId(id);
  const empty = PATCH.filter((p) => !w.plots[plotKey(p.x, p.y)]?.crop).length;
  const need = empty - (w.inventory[seeds] ?? 0);
  if (need > 0) buy(w, seeds, Math.min(need, Math.floor(w.player.gold / CROPS.find((c) => c.id === id)!.seedPrice)));
  for (const p of PATCH) {
    if (!w.plots[plotKey(p.x, p.y)]) {
      select(w, 'hoe');
      go(w, p.x, p.y);
    }
    const plot = w.plots[plotKey(p.x, p.y)];
    if (plot && !plot.crop && w.inventory[seeds]) {
      select(w, seeds);
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
