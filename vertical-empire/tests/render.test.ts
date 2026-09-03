import { describe, expect, it } from 'vitest';

import { Framebuffer } from '../src/render/framebuffer.js';
import { Camera, SCALES } from '../src/render/camera.js';
import { buildFallbackAtlas, INK } from '../src/assets/fallback.js';
import { drawScene } from '../src/render/scene.js';
import { FLOOR_HEIGHT, GROUND_LEVEL, SEGMENT_WIDTH, WORLD_HEIGHT, WORLD_WIDTH, levelTop } from '../src/world/grid.js';
import { demoTower } from '../src/world/tower.js';
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
    camera.centreOn(SEGMENT_WIDTH * 12, levelTop(GROUND_LEVEL) + FLOOR_HEIGHT / 2);

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
