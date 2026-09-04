// Camera helpers (RENDER agent) — called by the UI layer's input handling.
// Port of the POI/zoom input logic from Game::handleEvent
// (Game.cpp:159-165 wheel, arrows ±20 px) and the zoom keys, plus the POI
// clamp from Game::advance (Game.cpp:924-925):
//   poi.y ∈ [−360 + halfView.y, 360*12 − halfView.y], poi.x unclamped.
// zoom guards: C++ has NO clamp (Port note 13); JS guards 1/64 .. 64 so
// PageUp can never drive zoom to 0.

export const ZOOM_MIN = 1 / 64;
export const ZOOM_MAX = 64;

// The world the camera can ever show: floor -1 up to the 12-floor-per-unit
// ceiling the POI clamp uses. Everything above and below this is void.
export const WORLD_BOTTOM = -360;
export const WORLD_TOP = 360 * 12;
export const WORLD_HEIGHT = WORLD_TOP - WORLD_BOTTOM; // 4680 world px

// Furthest-out zoom that still shows something. Past the point where the whole
// world height fits the viewport there is nothing further to reveal, and the
// POI clamp below actively breaks: halfH grows past half the world, so its
// lower bound overtakes its upper one, Math.max wins, and the camera is pinned
// somewhere the tower is not. ZOOM_MAX (64) is ~11x beyond that on a phone,
// which is what made pinching out able to lose the tower entirely.
export function maxUsefulZoom(game) {
  const h = game?.app?.window?.height || 768;
  if (!(h > 0)) return ZOOM_MAX;
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, WORLD_HEIGHT / h));
}

export function clampPOI(game) {
  const halfH = game.app.window.height * 0.5 * game.zoom;
  game.poi.y = Math.max(Math.min(game.poi.y, 360 * 12 - halfH), -360 + halfH);
  return game.poi;
}

// Mouse wheel: horizontal wheel (or shift) pans x, else y (Game.cpp:159-165).
export function wheelPan(game, delta, { shift = false, horizontal = false } = {}) {
  if (horizontal || shift) {
    game.poi.x -= delta * 40 * game.zoom;
  } else {
    game.poi.y += delta * 40 * game.zoom;
  }
  return clampPOI(game);
}

// Arrow keys pan ±20 px per press (Application/Game key handling).
export function arrowPan(game, dx, dy) {
  game.poi.x += dx;
  game.poi.y += dy;
  return clampPOI(game);
}

// PageUp: zoom in (halve). Guarded at ZOOM_MIN.
export function zoomIn(game, factor = 2) {
  const z = game.zoom / factor;
  if (z >= ZOOM_MIN) game.zoom = z;
  clampPOI(game);
  return game.zoom;
}

// PageDown: zoom out (double). Guarded at the furthest useful zoom rather than
// ZOOM_MAX, and clamped rather than refused so a press near the limit still
// takes you to it instead of doing nothing.
export function zoomOut(game, factor = 2) {
  game.zoom = Math.min(game.zoom * factor, maxUsefulZoom(game));
  clampPOI(game);
  return game.zoom;
}

// Scrollbar fractions (t ∈ [0,1]) — Game.cpp:746-755 / 830-836.
export function scrollFractions(game) {
  return {
    h: Math.max(0, Math.min(1, (game.poi.x + 512) / 1024)),
    v: Math.max(0, Math.min(1, (360 * 12 - game.poi.y) / (360 * 13))),
  };
}

export function setScrollFractions(game, h, v) {
  h = Math.max(0, Math.min(1, h));
  v = Math.max(0, Math.min(1, v));
  game.poi.x = -512 + h * 1024;
  game.poi.y = 360 * 12 - v * (360 * 13);
  return game.poi;
}
