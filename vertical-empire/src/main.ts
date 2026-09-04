/**
 * Vertical Empire — a look-and-feel spike.
 *
 * The question this answers is narrow: does a SimTower-shaped tower read on a
 * phone held upright? So there is no simulation here, no economy and no time
 * pressure — a hand-built tower, the original's measurements, its day/night
 * palette cycle, and enough building to feel the ergonomics of placing a room
 * with a thumb.
 */

import './styles/base.css';

import { buildFallbackAtlas, INK } from './assets/fallback.js';
import { buildOriginalAtlas } from './assets/original.js';
import { fingerprint, forgetAtlas, loadAtlas, saveAtlas } from './assets/store.js';
import { clonePalette, darkestIndex, mixPalettes, rotateCycles, type Palette } from './assets/palette.js';
import { lookup, type Atlas } from './assets/atlas.js';
import { Camera } from './render/camera.js';
import { Framebuffer } from './render/framebuffer.js';
import { drawScene } from './render/scene.js';
import { makeIcon, paintIcon } from './render/icon.js';
import { facility } from './world/facilities.js';
import {
  FLOOR_HEIGHT,
  GROUND_LEVEL,
  LOT_SEGMENTS,
  SEGMENT_WIDTH,
  floorLabel,
  levelAtWorldY,
  levelTop,
  segmentAtWorldX,
} from './world/grid.js';
import { demoTower } from './world/tower.js';
import { buildShell, type Tool } from './ui/shell.js';
import { createBank } from './audio/bank.js';
import { CINEMA_REEL, EVENT_SOUNDS, FACILITY_SOUNDS } from './assets/slice.js';
import { pickAmbient } from './audio/ambience.js';
import { carStop } from './world/lift.js';
import { attachGestures } from './ui/input.js';

/** One in-game day per this many real milliseconds. Fast enough to see. */
const DAY_MS = 90_000;
/** How often the cycling palette indices advance. */
const CYCLE_MS = 220;

const root = document.getElementById('app');
if (!root) throw new Error('No #app to mount into.');

const shell = buildShell(root);
// Re-bound after the guard: the draw functions below are hoisted declarations,
// so a narrowing on the original binding would not reach inside them.
const maybeContext = shell.canvas.getContext('2d', { alpha: false });
if (!maybeContext) throw new Error('This browser has no 2D canvas.');
const context = maybeContext;
// The whole point is visible pixels; never let the browser smooth them.
context.imageSmoothingEnabled = false;

const tower = demoTower();
const camera = new Camera();
let atlas: Atlas = buildFallbackAtlas();
let tool: Tool = { kind: 'look' };

let framebuffer = new Framebuffer(1, 1);
let image: ImageData | undefined;
/** The palette actually drawn with: a day/night mix, with cycles rotated in. */
let workingPalette: Palette = clonePalette(atlas.palette);
let cycleStep = 0;
let lastCycle = 0;
let statusUntil = 0;

function resize(): void {
  const width = shell.canvas.clientWidth;
  const height = shell.canvas.clientHeight;
  if (width === 0 || height === 0) return;

  camera.resize(width, height);
  // The backing store is one canvas pixel per art pixel; CSS stretches it up by
  // an integer factor, so `image-rendering: pixelated` gives hard edges.
  shell.canvas.width = camera.viewWidth;
  shell.canvas.height = camera.viewHeight;
  context.imageSmoothingEnabled = false;

  framebuffer = new Framebuffer(camera.viewWidth, camera.viewHeight);
  image = context.createImageData(camera.viewWidth, camera.viewHeight);
}

/**
 * `?hour=21` pins the clock, so a screenshot of dusk does not mean waiting for
 * dusk. Only ever read here, and only from the URL.
 */
const FORCED_HOUR = (() => {
  const raw = new URLSearchParams(window.location.search).get('hour');
  if (raw === null) return undefined;
  const hour = Number(raw);
  return Number.isFinite(hour) ? ((hour % 24) + 24) % 24 : undefined;
})();

/** Fractional hour, so the crossfade between sky tables is continuous. */
function hourAt(elapsed: number): number {
  return FORCED_HOUR ?? ((elapsed % DAY_MS) / DAY_MS) * 24;
}

function paletteFor(hour: number): Palette {
  const tables = atlas.skyPalettes.length > 0 ? atlas.skyPalettes : [atlas.palette];
  if (tables.length === 1) return clonePalette(tables[0] ?? atlas.palette);

  // Position along the ring of tables, wrapping from the last back to the first
  // so midnight joins up with the following morning.
  const position = (hour / 24) * tables.length;
  const index = Math.floor(position);
  const from = tables[index % tables.length] ?? atlas.palette;
  const to = tables[(index + 1) % tables.length] ?? atlas.palette;
  return mixPalettes(from, to, position - index);
}

function clockText(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.floor((hour - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function frame(now: number): void {
  if (shell.canvas.width !== camera.viewWidth || shell.canvas.height !== camera.viewHeight) resize();

  const hour = hourAt(now);
  if (now - lastCycle > CYCLE_MS) {
    cycleStep += 1;
    lastCycle = now;
  }

  workingPalette = paletteFor(hour);
  rotateCycles(workingPalette, cycleStep);

  drawScene(framebuffer, atlas, tower, camera, { hour, elapsed: now });

  if (image) {
    framebuffer.resolve(workingPalette, image.data);
    context.putImageData(image, 0, 0);
  }

  shell.setClock(`${clockText(hour)} · ${camera.scale}×`);
  paintRating(hour);
  listen(now);
  breathe(now, hour);
  if (statusUntil !== 0 && now > statusUntil) {
    shell.setStatus('');
    statusUntil = 0;
  }

  requestAnimationFrame(frame);
}

/**
 * What the tower has done since the last frame, in sound.
 *
 * Kept out of `paintRating` and out of the scene on purpose. Drawing is a
 * function of the current moment and can be repeated harmlessly; a sound is an
 * event and must fire exactly once, so it needs its own memory of what was true
 * last frame. Folding the two together is how a chime ends up playing sixty
 * times a second.
 */
let heardStars = -1;
/** The floor each lift bank was last seen stopped at, by placement index. */
const heardFloors = new Map<number, number>();

function listen(now: number): void {
  const stars = tower.stars;
  // Not on the first frame: -1 is "we have not looked yet", and a tower that
  // opens with one star should not congratulate you for it.
  if (heardStars >= 0 && stars > heardStars) bank.play(EVENT_SOUNDS.star);
  heardStars = stars;

  const left = camera.x / SEGMENT_WIDTH;
  const right = (camera.x + camera.viewWidth) / SEGMENT_WIDTH;

  tower.placements.forEach((placement, index) => {
    if (placement.id !== 'elevator') return;

    const floor = carStop(placement, index, now);
    const previous = heardFloors.get(index);
    if (floor !== undefined) heardFloors.set(index, floor);
    else heardFloors.delete(index);
    if (floor === undefined || floor === previous) return;

    // Only what you can see. A lot four screens wide could hold a dozen banks,
    // and hearing every one of them arrive is a rattle rather than a tower.
    const width = facility(placement.id).width;
    if (placement.segment > right || placement.segment + width < left) return;

    bank.playExclusive(EVENT_SOUNDS.lift, 'lift');
  });
}

/**
 * Roughly how long between ambient one-shots, in *real* milliseconds.
 *
 * Real, not game: a day is 90 seconds here, so an hour is 3.75 and anything
 * hung off the hour would ring the church bells sixteen times a minute. Jittered
 * by up to half again, because a bird exactly every fourteen seconds is a
 * metronome rather than a tower.
 */
const AMBIENT_MS = 14_000;

let nextAmbient = 0;

function breathe(now: number, hour: number): void {
  if (now < nextAmbient) return;
  // The first frame lands here with nextAmbient at 0, which would open the game
  // with a thunderclap. Schedule instead, and let the second turn play.
  const first = nextAmbient === 0;
  nextAmbient = now + AMBIENT_MS * (1 + Math.random() * 0.5);
  if (first || document.hidden) return;

  bank.playAmbient(pickAmbient(hour, { populated: tower.placements.length > 0 }, Math.random()));
}

// --- the rating badge -------------------------------------------------------

/** How many stars the badge has room for, lit or not. */
const RATING_STARS = 5;
const STAR_SCALE = 2;

let starIcons: HTMLCanvasElement[] = [];
/** What is currently painted, so the badge is not redrawn every frame. */
let paintedStars = -1;
let paintedHour = -1;

/**
 * Makes the badge's canvases once per atlas.
 *
 * They are then repainted in place rather than rebuilt: the palette moves all
 * day, and replacing five DOM nodes on every shift of the light would cost far
 * more than the tower does.
 */
function buildRating(): void {
  const lit = lookup(atlas, 'star');
  starIcons = lit ? Array.from({ length: RATING_STARS }, () => makeIcon()) : [];
  paintedStars = -1;
  paintedHour = -1;
  shell.setRating(starIcons, '');
}

function paintRating(hour: number): void {
  if (starIcons.length === 0) return;

  const stars = tower.stars;
  // The palette only moves between the eleven tables of the day, so repainting
  // once an hour keeps the stars in step with the light for no real cost.
  const band = Math.floor(hour);
  if (stars === paintedStars && band === paintedHour) return;
  paintedStars = stars;
  paintedHour = band;

  const lit = lookup(atlas, 'star');
  const dim = lookup(atlas, 'star-dim') ?? lit;
  if (!lit || !dim) return;

  for (const [index, canvas] of starIcons.entries()) {
    const art = index < stars ? lit : dim;
    paintIcon(canvas, art.image, workingPalette, STAR_SCALE, art.sprite.transparent);
  }
  shell.setRating(starIcons, `${stars} of ${RATING_STARS} stars — how high the tower reaches`);
}

function flash(text: string, tone: 'plain' | 'warn' = 'plain'): void {
  shell.setStatus(text, tone);
  statusUntil = performance.now() + 2200;
}

// --- building ---------------------------------------------------------------

const bank = createBank();
// Browsers refuse to start audio outside a gesture, so the context is built on
// the first touch anywhere rather than at load. Once is enough; after that the
// bank resumes itself.
for (const event of ['pointerdown', 'keydown'] as const) {
  window.addEventListener(event, () => bank.unlock(), { once: true, passive: true });
}
shell.onSoundToggle((muted) => {
  bank.muted = muted;
  flash(muted ? 'Sound off' : 'Sound on');
});

const gestures = attachGestures(shell.canvas, camera);

function cellAt(cssX: number, cssY: number): { segment: number; level: number } {
  const world = camera.toWorld(cssX, cssY);
  return { segment: segmentAtWorldX(world.x), level: levelAtWorldY(world.y) };
}

gestures.onTap((cssX, cssY) => {
  const { segment, level } = cellAt(cssX, cssY);

  if (tool.kind === 'bulldoze') {
    const removed = tower.removeAt(segment, level);
    if (removed) bank.play(EVENT_SOUNDS.bulldoze);
    flash(removed ? `Cleared ${facility(removed.id).label}` : 'Nothing there', removed ? 'plain' : 'warn');
    return;
  }
  if (tool.kind !== 'build') {
    const found = tower.at(segment, level);
    // Tapping a cinema plays a film. The original keeps fifteen snatches of one
    // and picks between them, and playing the same one every time would be a
    // worse imitation than playing none — so this picks too. Its own channel, so
    // a lift arriving does not cut the film off.
    if (found?.id === 'cinema') {
      bank.playExclusive(CINEMA_REEL[Math.floor(Math.random() * CINEMA_REEL.length)], 'reel');
    }
    flash(found ? `${facility(found.id).label} · floor ${floorLabel(level)}` : `Floor ${floorLabel(level)}`);
    return;
  }

  const kind = facility(tool.id);
  // Centre a wide facility on the finger, so what lands is where you aimed.
  const left = segment - Math.floor(kind.width / 2);
  // Transport runs from the ground up; everything else occupies one floor.
  const span = kind.transport ? Math.max(2, level - GROUND_LEVEL + 2) : 1;
  const base = kind.transport ? GROUND_LEVEL : level;

  const blocked = tower.blockedBy(tool.id, left, base, span);
  if (blocked) {
    // The game has a sound for exactly this, and it is the one label in the
    // whole set that named its own event: "cant place building item there".
    bank.play(EVENT_SOUNDS.blocked);
    flash(blocked === 'occupied' ? 'Something is already there' : 'Outside the lot', 'warn');
    return;
  }
  tower.place(tool.id, left, base, span);
  // Its own sound where one has been identified — four from the slot table's
  // arithmetic, two more from listening — and the shared build sound otherwise.
  // A copy of the game missing either resource simply makes no noise.
  bank.play(FACILITY_SOUNDS[tool.id] ?? EVENT_SOUNDS.place);
  flash(`${kind.label} · floor ${floorLabel(level)}`);
});

gestures.onLongPress((cssX, cssY) => {
  const { segment, level } = cellAt(cssX, cssY);
  const removed = tower.removeAt(segment, level);
  if (!removed) return;
  bank.play(EVENT_SOUNDS.bulldoze);
  flash(`Cleared ${facility(removed.id).label}`);
});

shell.onToolChange((next) => {
  tool = next;
});

// --- art --------------------------------------------------------------------

function adopt(next: Atlas): void {
  atlas = next;
  shell.setArtSource(next.source);
  bank.load(next.sounds);
  // The control appears only when there is something for it to silence: the
  // placeholder art has no audio, and a browser without Web Audio never will.
  shell.setSound(next.sounds.size > 0 && bank.available ? bank.muted : undefined);
  buildRating();
}

shell.onArtFile(async (file) => {
  flash('Reading…');
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { atlas: built, problems } = buildOriginalAtlas(bytes);

    if (built.sprites.size === 0) {
      flash('No SimTower art found in that file', 'warn');
      return;
    }
    adopt(built);
    await saveAtlas(fingerprint(bytes), built.palette, built.sprites, built.sounds);

    flash(
      problems.length === 0
        ? 'Using your SimTower art'
        : `Using your art · ${problems.length} sprite${problems.length === 1 ? '' : 's'} not found`,
      problems.length === 0 ? 'plain' : 'warn',
    );
    if (problems.length > 0) {
      // Worth the console noise: this is exactly what a mis-mapped resource ID
      // looks like, and it is the fastest way to correct `slice.ts`.
      console.warn('Sprites that did not extract:', problems);
    }
  } catch (error) {
    flash((error as Error).message, 'warn');
  }
});

shell.onForgetArt(() => {
  void forgetAtlas();
  adopt(buildFallbackAtlas());
  flash('Back to placeholder art');
});

// A previously supplied copy is restored before the first frame, so the tower
// does not visibly change art a moment after it appears.
void (async () => {
  const cached = await loadAtlas();
  if (!cached || cached.sprites.size === 0) return;
  adopt({
    source: 'original',
    palette: cached.palette,
    skyPalettes: [cached.palette],
    shaftInk: darkestIndex(cached.palette),
    sprites: cached.sprites,
    sounds: cached.sounds,
  });
})();

// --- boot -------------------------------------------------------------------

window.addEventListener('resize', resize);

// One art pixel per CSS pixel on a phone. Two looked right on a desktop and
// wrong in the hand: at 2x a 390px screen shows 24 segments, which is barely
// two offices, and the tower stops reading as a tower. At 1x you get 48 and
// about twenty floors — close to what the original showed on a 640x480 screen.
camera.scale = window.innerWidth < 560 ? 1 : 2;
resize();
// Open just above the lobby rather than on it. Centred on the ground floor,
// half the screen is empty basement; a few floors up puts the lobby near the
// bottom edge with the tower filling the rest, which is how the original framed
// itself too.
camera.centreOn((LOT_SEGMENTS / 2) * SEGMENT_WIDTH, levelTop(GROUND_LEVEL + 6) + FLOOR_HEIGHT / 2);
gestures.onChange(() => {
  /* the loop redraws every frame; nothing to do but keep the camera honest */
});

// The fallback atlas has never been through `adopt`, so its badge is built here.
buildRating();

framebuffer.clear(INK.sky3);
requestAnimationFrame(frame);
