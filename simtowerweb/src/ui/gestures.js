// Touch gesture math (UI agent) — pure helpers behind the pointer-event
// gesture layer in input.js (ISSUE-040). Headless-safe: no DOM access.
//
// Screen px (y down) map to world px (y up) at a 1:zoom ratio — see
// renderer.computeView + screenToWorld.
//
// The POI is the point the camera looks at, so moving it moves the view and
// the world appears to travel the *other* way. Dragging the tower along under
// the finger therefore means moving the camera against the drag:
//   poi.x -= dxScreen * zoom ; poi.y += dyScreen * zoom
// Measured rather than derived: a +160,+120 px drag moves a fixed world point
// +160,+120 px across the screen, so the tower stays under the finger exactly.

// Drift tolerated (CSS px) before a tap becomes a drag/pan.
export const TAP_SLOP_PX = 12;

export function panWorldOffset(dxPx, dyPx, zoom) {
  return { dx: -dxPx * zoom, dy: dyPx * zoom };
}

export function pinchMetrics(a, b) {
  return {
    dist: Math.hypot(b.x - a.x, b.y - a.y),
    mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
  };
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

// Camera state that pins state.anchorWorld under curMid with zoom scaled by
// state.dist0/curDist and clamped. state: { zoom0, dist0, canvasW, canvasH,
// anchorWorld } (anchorWorld is renderer.screenToWorld of the pinch start
// midpoint); all positions are CSS px.
export function pinchTarget(state, curDist, curMid, minZoom = 1 / 64, maxZoom = 64) {
  // `zoom` is view-size / canvas-size, so it runs *backwards*: a smaller value
  // is closer in. Spreading the fingers therefore has to divide, not multiply
  // — the tower grows under fingers that move apart, as it does in every other
  // touch app. Multiplying (the original) made spreading push the tower away.
  const ratio = state.dist0 > 0 && curDist > 0 ? state.dist0 / curDist : 1;
  let zoom = state.zoom0 * ratio;
  if (!Number.isFinite(zoom)) zoom = state.zoom0;
  zoom = Math.max(minZoom, Math.min(maxZoom, zoom));

  const fx = clamp01(curMid.x / state.canvasW);
  const fy = clamp01(curMid.y / state.canvasH);
  return {
    zoom,
    // Inverse of screenToWorld at fixed zoom: view.x = poi.x - halfW etc.
    poi: {
      x: state.anchorWorld.x - (fx - 0.5) * zoom * state.canvasW,
      y: state.anchorWorld.y + (fy - 0.5) * zoom * state.canvasH,
    },
  };
}
