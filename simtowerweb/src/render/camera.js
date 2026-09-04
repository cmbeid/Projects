// Camera helpers (RENDER agent) — called by the UI layer's input handling.
// Port of the POI/zoom input logic from Game::handleEvent
// (Game.cpp:159-165 wheel, arrows ±20 px) and the zoom keys, plus the POI
// clamp from Game::advance (Game.cpp:924-925):
//   poi.y ∈ [−360 + halfView.y, 360*12 − halfView.y], poi.x unclamped.
// zoom guards: C++ has NO clamp (Port note 13); JS guards 1/64 .. 64 so
// PageUp can never drive zoom to 0.

export const ZOOM_MIN = 1 / 64;
export const ZOOM_MAX = 64;

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

// PageDown: zoom out (double). Guarded at ZOOM_MAX.
export function zoomOut(game, factor = 2) {
  const z = game.zoom * factor;
  if (z <= ZOOM_MAX) game.zoom = z;
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
