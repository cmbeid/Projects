import { describe, expect, it } from 'vitest';

import { Framebuffer } from '../src/render/framebuffer.js';
import { Camera, SCALES } from '../src/render/camera.js';
import { buildFallbackAtlas, INK } from '../src/assets/fallback.js';
import { drawScene } from '../src/render/scene.js';
import {
  FLOOR_HEIGHT,
  GROUND_LEVEL,
  LOT_SEGMENTS,
  SEGMENT_WIDTH,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  levelTop,
} from '../src/world/grid.js';
import { DEMO_LEFT, Tower, demoTower } from '../src/world/tower.js';
import type { IndexedImage } from '../src/assets/dib.js';

function solid(width: number, height: number, ink: number): IndexedImage {
  return { width, height, pixels: new Uint8Array(width * height).fill(ink) };
}

describe('the framebuffer', () => {
  it('blits inside its own bounds and clips the rest', () => {
    const buffer = new Framebuffer(4, 4);
    buffer.clear(1);
    // Mostly off the right and bottom edges; only the top-left pixel lands.
    buffer.blit(solid(3, 3, 9), 3, 3);
    expect(buffer.pixels[15]).toBe(9);
    expect(buffer.pixels[14]).toBe(1);
    // Entirely off the canvas is a no-op rather than a crash.
    buffer.blit(solid(3, 3, 7), -10, -10);
    expect(buffer.pixels.includes(7)).toBe(false);
  });

  it('honours a transparent index', () => {
    const buffer = new Framebuffer(2, 1);
    buffer.clear(4);
    const sprite: IndexedImage = { width: 2, height: 1, pixels: Uint8Array.from([0, 9]) };
    buffer.blit(sprite, 0, 0, 0);
    expect([...buffer.pixels]).toEqual([4, 9]);
  });

  it('resolves indices through the palette', () => {
    const buffer = new Framebuffer(2, 1);
    buffer.pixels.set([1, 2]);
    const palette = new Uint8Array(256 * 4);
    palette.set([10, 20, 30, 255], 1 * 4);
    palette.set([40, 50, 60, 255], 2 * 4);

    const out = new Uint8ClampedArray(2 * 4);
    buffer.resolve(palette, out);
    expect([...out]).toEqual([10, 20, 30, 255, 40, 50, 60, 255]);
  });

  it('tiles without leaving gaps', () => {
    const buffer = new Framebuffer(10, 4);
    buffer.clear(0);
    buffer.tile(solid(3, 2, 6), 0, 0, 10, 4);
    expect(buffer.pixels.every((value) => value === 6)).toBe(true);
  });
});

describe('tiling', () => {
  it('stays inside the rectangle it was given', () => {
    const buffer = new Framebuffer(8, 4);
    buffer.clear(1);
    const stamp: IndexedImage = { width: 5, height: 3, pixels: new Uint8Array(15).fill(7) };

    // A 5-wide image into a 3-wide rectangle: repeated blitting overflowed to
    // column 5, which is how a 32px lift painted over its neighbours.
    buffer.tile(stamp, 1, 1, 3, 2);

    expect([...buffer.pixels.subarray(0, 8)]).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
    expect([...buffer.pixels.subarray(8, 16)]).toEqual([1, 7, 7, 7, 1, 1, 1, 1]);
    expect([...buffer.pixels.subarray(16, 24)]).toEqual([1, 7, 7, 7, 1, 1, 1, 1]);
    expect([...buffer.pixels.subarray(24, 32)]).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
  });

  it('keeps the source aligned when the rectangle starts off-screen', () => {
    const buffer = new Framebuffer(4, 1);
    buffer.clear(0);
    const ramp: IndexedImage = { width: 4, height: 1, pixels: new Uint8Array([1, 2, 3, 4]) };

    // Starting two columns left of the screen, column 0 shows the third pixel.
    buffer.tile(ramp, -2, 0, 8, 1);
    expect([...buffer.pixels]).toEqual([3, 4, 1, 2]);
  });
});

describe('the camera', () => {
  it('stays over the world', () => {
    const camera = new Camera();
    camera.resize(390, 800);
    camera.panBy(-10_000, -10_000);
    expect(camera.x).toBe(0);
    expect(camera.y).toBe(0);

    camera.panBy(100_000, 100_000);
    expect(camera.x).toBe(WORLD_WIDTH - camera.viewWidth);
    expect(camera.y).toBe(WORLD_HEIGHT - camera.viewHeight);
  });

  it('lands on whole world pixels, so the grid does not shimmer', () => {
    const camera = new Camera();
    camera.resize(390, 800);
    camera.panBy(3.7, 9.2);
    expect(Number.isInteger(camera.x)).toBe(true);
    expect(Number.isInteger(camera.y)).toBe(true);
  });

  it('only ever uses whole scales', () => {
    const camera = new Camera();
    camera.resize(390, 800);
    for (let i = 0; i < 6; i += 1) camera.zoomTo(camera.steppedScale(1), 390, 800);
    expect(camera.scale).toBe(SCALES[SCALES.length - 1]);
    for (let i = 0; i < 6; i += 1) camera.zoomTo(camera.steppedScale(-1), 390, 800);
    expect(camera.scale).toBe(SCALES[0]);
  });

  it('keeps the zoom anchor roughly under the finger', () => {
    const camera = new Camera();
    camera.resize(390, 800);
    camera.centreOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    const before = camera.toWorld(195, 400);
    camera.zoomTo(3, 390, 800, 0.5, 0.5);
    const after = camera.toWorld(195, 400);
    expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
  });

  it('centres rather than pinning when the world is narrower than the view', () => {
    const camera = new Camera();
    // One art pixel per CSS pixel across a viewport wider than the whole lot.
    camera.scale = 1;
    camera.resize(WORLD_WIDTH + 200, 400);
    expect(camera.x).toBe(Math.round((WORLD_WIDTH - camera.viewWidth) / 2));
  });
});

describe('drawing a tower', () => {
  it('puts sky above the roof and building below it', () => {
    const atlas = buildFallbackAtlas();
    const tower = demoTower();
    const camera = new Camera();
    camera.resize(390, 780);
    camera.centreOn(SEGMENT_WIDTH * (DEMO_LEFT + 12), levelTop(GROUND_LEVEL) + FLOOR_HEIGHT / 2);

    const buffer = new Framebuffer(camera.viewWidth, camera.viewHeight);
    drawScene(buffer, atlas, tower, camera, { hour: 12, elapsed: 0 });

    const ink = new Set(buffer.pixels);
    const SKY = [INK.sky0, INK.sky1, INK.sky2, INK.sky3, INK.sky4, INK.sky5];
    // The three things that have to be on screen at the lobby: sky, the marble
    // floor, and the ground the tower stands on.
    expect(SKY.some((band) => ink.has(band))).toBe(true);
    expect(ink.has(INK.marble)).toBe(true);
    expect(ink.has(INK.ground)).toBe(true);
  });

  it('draws nothing but sky far above the tower', () => {
    const atlas = buildFallbackAtlas();
    const camera = new Camera();
    camera.resize(390, 780);
    camera.centreOn(SEGMENT_WIDTH * 12, levelTop(105));

    const buffer = new Framebuffer(camera.viewWidth, camera.viewHeight);
    drawScene(buffer, atlas, demoTower(), camera, { hour: 12, elapsed: 0 });

    const SKY = new Set<number>([INK.sky0, INK.sky1, INK.sky2, INK.sky3, INK.sky4, INK.sky5]);
    for (const value of buffer.pixels) expect(SKY.has(value)).toBe(true);
  });

  it('darkens the sky with altitude', () => {
    const atlas = buildFallbackAtlas();
    // The ring runs midnight, through noon in the middle, back to midnight.
    const noon = atlas.skyPalettes[Math.floor(atlas.skyPalettes.length / 2)];
    if (!noon) throw new Error('no day table');
    // Blue channel falls monotonically from the horizon band to the top one.
    const bands = [INK.sky0, INK.sky1, INK.sky2, INK.sky3, INK.sky4, INK.sky5];
    for (let i = 1; i < bands.length; i += 1) {
      const lower = bands[i - 1];
      const upper = bands[i];
      if (lower === undefined || upper === undefined) throw new Error('missing band');
      expect(noon[upper * 4 + 2]).toBeLessThan(noon[lower * 4 + 2] ?? 0);
    }
  });

  it('paints a horizon rather than striping the sky every floor', () => {
    const atlas = buildFallbackAtlas();
    const camera = new Camera();
    camera.resize(390, 780);
    // High above the tower, where the view is nothing but sky.
    camera.centreOn(SEGMENT_WIDTH * 12, levelTop(102));

    const buffer = new Framebuffer(camera.viewWidth, camera.viewHeight);
    drawScene(buffer, atlas, demoTower(), camera, { hour: 12, elapsed: 0 });

    // Every row is a single colour, and adjacent rows change at most a handful
    // of times over the whole screen — a tiled sky would change every 36 rows.
    let changes = 0;
    for (let y = 1; y < buffer.height; y += 1) {
      const above = buffer.pixels[(y - 1) * buffer.width];
      const here = buffer.pixels[y * buffer.width];
      if (above !== here) changes += 1;
    }
    expect(changes).toBeLessThanOrEqual(2);
  });

  it('has an evening palette that differs from noon', () => {
    const atlas = buildFallbackAtlas();
    // Index 0 is midnight: the clock walks the ring as hour/24, so the table it
    // lands on at 00:00 has to be the dark one.
    const midnight = atlas.skyPalettes[0];
    const noon = atlas.skyPalettes[Math.floor(atlas.skyPalettes.length / 2)];
    if (!noon || !midnight) throw new Error('no day/night tables');
    expect(midnight[INK.sky3 * 4 + 2]).toBeLessThan(noon[INK.sky3 * 4 + 2] ?? 0);
    // Windows go the other way: they light up as everything else darkens.
    expect(midnight[INK.windowLit * 4 + 0]).toBeGreaterThan(200);
  });
});

describe('short facades', () => {
  it('carries a room facade down to fill its floor', () => {
    const buffer = new Framebuffer(8, 36);
    buffer.clear(99); // stand-in for sky
    // A 24-tall facade, like the real game's, drawn at the top of the floor.
    buffer.blit(solid(8, 24, 7), 0, 0);
    expect(buffer.pixels[24 * 8]).toBe(99); // sky still showing beneath

    buffer.repeatRow(0, 23, 8, 36 - 24);
    for (let y = 0; y < 36; y += 1) expect(buffer.pixels[y * 8]).toBe(7);
  });

  it('leaves rows outside the run alone', () => {
    const buffer = new Framebuffer(4, 4);
    buffer.clear(1);
    buffer.pixels.set([5, 5, 5, 5], 1 * 4);
    buffer.repeatRow(0, 1, 4, 1);
    expect([...buffer.pixels.subarray(2 * 4, 3 * 4)]).toEqual([5, 5, 5, 5]);
    // One row asked for, one row written — the last row is untouched.
    expect([...buffer.pixels.subarray(3 * 4, 4 * 4)]).toEqual([1, 1, 1, 1]);
  });
});

describe('every pixel gets painted', () => {
  // The see-through index is never a colour anyone should see. If it survives
  // to the framebuffer, something left a hole and the palette resolved it to
  // the magenta that marks one.
  const phases = [0, 1, 3, 5, 7];

  it.each(phases)('leaves no hole at camera phase %i', (phase) => {
    const atlas = buildFallbackAtlas();
    const camera = new Camera();
    camera.scale = 1;
    camera.resize(390, 844);
    // Off a segment boundary by `phase`, which is what the ground tiling has to
    // cope with: shifted to stay put as you pan, and still reaching both edges.
    camera.centreOn((LOT_SEGMENTS / 2) * SEGMENT_WIDTH + phase, levelTop(GROUND_LEVEL + 6));

    const buffer = new Framebuffer(camera.viewWidth, camera.viewHeight);
    drawScene(buffer, atlas, demoTower(), camera, { hour: 13, elapsed: 0 });

    expect([...buffer.pixels].filter((ink) => ink === INK.transparent)).toHaveLength(0);
  });

  it('leaves no hole underground, where there is no sky to fall back on', () => {
    const atlas = buildFallbackAtlas();
    const camera = new Camera();
    camera.scale = 1;
    camera.resize(390, 844);
    camera.centreOn(SEGMENT_WIDTH * 3, levelTop(GROUND_LEVEL - 5));

    const buffer = new Framebuffer(camera.viewWidth, camera.viewHeight);
    drawScene(buffer, atlas, demoTower(), camera, { hour: 13, elapsed: 0 });

    expect([...buffer.pixels].filter((ink) => ink === INK.transparent)).toHaveLength(0);
  });
});

describe('placements that span floors', () => {
  it('draws a non-transport run once over its whole span', () => {
    const atlas = buildFallbackAtlas();
    // A facade with a distinctive top row, so a second stamp is detectable.
    const CAP = 222;
    const BODY = 111;
    const pixels = new Uint8Array(72 * 24).fill(BODY);
    pixels.fill(CAP, 0, 72);
    atlas.sprites.set('office', { key: 'office', frames: [{ width: 72, height: 24, pixels }] });

    const tower = new Tower();
    tower.place('office', 4, GROUND_LEVEL, 2);

    const camera = new Camera();
    camera.resize(390, 780);
    camera.centreOn(SEGMENT_WIDTH * 8, levelTop(GROUND_LEVEL));

    const buffer = new Framebuffer(camera.viewWidth, camera.viewHeight);
    drawScene(buffer, atlas, tower, camera, { hour: 12, elapsed: 0 });

    const x = Math.round(4 * SEGMENT_WIDTH - camera.x) + 4;
    const at = (level: number) => buffer.pixels[Math.round(levelTop(level) - camera.y) * buffer.width + x] ?? 0;

    // Top of the span carries the cap; the floor below is the body carried
    // down, not a second copy of the picture.
    expect(at(GROUND_LEVEL + 1)).toBe(CAP);
    expect(at(GROUND_LEVEL)).toBe(BODY);
  });

  it('still repeats transport, one flight per floor', () => {
    const atlas = buildFallbackAtlas();
    const CAP = 222;
    const pixels = new Uint8Array(64 * 24).fill(111);
    pixels.fill(CAP, 0, 64);
    atlas.sprites.set('stairs', { key: 'stairs', frames: [{ width: 64, height: 24, pixels }] });

    const tower = new Tower();
    tower.place('stairs', 4, GROUND_LEVEL, 2);

    const camera = new Camera();
    camera.resize(390, 780);
    camera.centreOn(SEGMENT_WIDTH * 8, levelTop(GROUND_LEVEL));

    const buffer = new Framebuffer(camera.viewWidth, camera.viewHeight);
    drawScene(buffer, atlas, tower, camera, { hour: 12, elapsed: 0 });

    const x = Math.round(4 * SEGMENT_WIDTH - camera.x) + 4;
    const at = (level: number) => buffer.pixels[Math.round(levelTop(level) - camera.y) * buffer.width + x] ?? 0;

    // Both floors get their own flight, so both start with the cap row.
    expect(at(GROUND_LEVEL + 1)).toBe(CAP);
    expect(at(GROUND_LEVEL)).toBe(CAP);
  });
});

describe('lift banks', () => {
  it('paints a continuous shaft and exactly one car', () => {
    const atlas = buildFallbackAtlas();
    const tower = new Tower();
    // A shaft spanning ten floors from the ground.
    tower.place('elevator', 4, GROUND_LEVEL, 10);

    const camera = new Camera();
    camera.resize(390, 780);
    camera.centreOn(SEGMENT_WIDTH * 6, levelTop(GROUND_LEVEL + 5));

    const buffer = new Framebuffer(camera.viewWidth, camera.viewHeight);
    drawScene(buffer, atlas, tower, camera, { hour: 12, elapsed: 0 });

    // Down the middle of the shaft, every row between the served floors is
    // shaft or car — never sky. A sprite stamped per floor used to leave the
    // car's own background showing through in bands.
    const x = Math.round(4 * SEGMENT_WIDTH + 16 - camera.x);
    const top = Math.round(levelTop(GROUND_LEVEL + 9) - camera.y);
    const bottom = Math.round(levelTop(GROUND_LEVEL) + FLOOR_HEIGHT - camera.y);
    const SKY = new Set<number>([INK.sky0, INK.sky1, INK.sky2, INK.sky3, INK.sky4, INK.sky5]);

    let skyInShaft = 0;
    for (let y = Math.max(0, top); y < Math.min(buffer.height, bottom); y += 1) {
      if (SKY.has(buffer.pixels[y * buffer.width + x] ?? 0)) skyInShaft += 1;
    }
    expect(skyInShaft).toBe(0);
  });

  it('tiles the original shaft art without smearing into the rooms beside it', () => {
    const atlas = buildFallbackAtlas();
    // A shaft interior wider than the four-segment lift, which is the case
    // that used to paint straight through whatever was next to it.
    const SHAFT_INK = 201;
    const wide: IndexedImage = {
      width: 128,
      height: 8,
      pixels: new Uint8Array(128 * 8).fill(SHAFT_INK),
    };
    atlas.sprites.set('shaft', { key: 'shaft', frames: [wide] });

    const tower = new Tower();
    tower.place('elevator', 4, GROUND_LEVEL, 8);

    const camera = new Camera();
    camera.resize(390, 780);
    camera.centreOn(SEGMENT_WIDTH * 10, levelTop(GROUND_LEVEL + 4));

    const buffer = new Framebuffer(camera.viewWidth, camera.viewHeight);
    drawScene(buffer, atlas, tower, camera, { hour: 12, elapsed: 0 });

    const y = Math.round(levelTop(GROUND_LEVEL + 6) - camera.y) + 4;
    const row = (column: number) => buffer.pixels[y * buffer.width + column] ?? 0;
    const left = Math.round(4 * SEGMENT_WIDTH - camera.x);
    const right = left + 4 * SEGMENT_WIDTH;

    // Inside the shaft: the art. Outside it, on both sides: not the art.
    expect(row(left + 2)).toBe(SHAFT_INK);
    expect(row(right - 2)).toBe(SHAFT_INK);
    expect(row(left - 2)).not.toBe(SHAFT_INK);
    expect(row(right + 2)).not.toBe(SHAFT_INK);
  });

  it('caps the shaft with a machine room past the floors it serves', () => {
    const atlas = buildFallbackAtlas();
    const tower = new Tower();
    tower.place('elevator', 4, GROUND_LEVEL, 6);

    const camera = new Camera();
    camera.resize(390, 780);
    camera.centreOn(SEGMENT_WIDTH * 6, levelTop(GROUND_LEVEL + 3));

    const buffer = new Framebuffer(camera.viewWidth, camera.viewHeight);
    drawScene(buffer, atlas, tower, camera, { hour: 12, elapsed: 0 });

    // Just above the topmost served floor there is housing, not sky.
    const x = Math.round(4 * SEGMENT_WIDTH + 16 - camera.x);
    const above = Math.round(levelTop(GROUND_LEVEL + 5) - camera.y) - 4;
    const SKY = new Set<number>([INK.sky0, INK.sky1, INK.sky2, INK.sky3, INK.sky4, INK.sky5]);
    expect(SKY.has(buffer.pixels[above * buffer.width + x] ?? 0)).toBe(false);
  });
});

describe('the town', () => {
  it('stands the tower in a street rather than on bare ground', () => {
    const atlas = buildFallbackAtlas();
    const camera = new Camera();
    camera.resize(390, 780);
    // Looking at the ground line beyond the tower's frontage, where the
    // street is what there is to see.
    camera.scale = 1;
    camera.resize(390, 780);
    camera.centreOn(SEGMENT_WIDTH * (DEMO_LEFT + 86), levelTop(GROUND_LEVEL));

    const buffer = new Framebuffer(camera.viewWidth, camera.viewHeight);
    drawScene(buffer, atlas, demoTower(), camera, { hour: 12, elapsed: 0 });

    const ink = new Set(buffer.pixels);
    expect(ink.has(INK.townWall)).toBe(true);
    expect(ink.has(INK.townWindow)).toBe(true);
  });

  it('keeps the town behind anything built', () => {
    const atlas = buildFallbackAtlas();
    const tower = new Tower();
    // An office right where the town would otherwise show.
    tower.place('office', 40, GROUND_LEVEL);

    const camera = new Camera();
    camera.resize(390, 780);
    camera.centreOn(SEGMENT_WIDTH * 44, levelTop(GROUND_LEVEL) + FLOOR_HEIGHT / 2);

    const buffer = new Framebuffer(camera.viewWidth, camera.viewHeight);
    drawScene(buffer, atlas, tower, camera, { hour: 12, elapsed: 0 });

    // Mid-office, the office floor wins over the town behind it.
    const x = Math.round(44 * SEGMENT_WIDTH - camera.x);
    const y = Math.round(levelTop(GROUND_LEVEL) + 10 - camera.y);
    expect(buffer.pixels[y * buffer.width + x]).not.toBe(INK.townWall);
  });
});
