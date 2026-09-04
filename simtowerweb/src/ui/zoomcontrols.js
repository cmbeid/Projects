// Zoom controls (UI agent) — a compact touch cluster for the camera operations
// a phone otherwise cannot reach.
//
// Zoom is PageUp/PageDown on desktop; on touch the only zoom is a two-finger
// pinch, and there is no way at all to reset the framing once it drifts.
// Portrait needs both most — the tower is tall and the viewport is narrow.
// The cluster lives on the right edge, which is free on touch now that the
// canvas scrollbars are suppressed there (Renderer.pointerCoarse).
//
// Phone-tier only: ui.css leaves #zoomcontrols display:none everywhere else,
// where the keyboard already covers this.

import { ZOOM_MIN, ZOOM_MAX, zoomIn, zoomOut, clampPOI } from "../render/camera.js";
import { towerBounds } from "./format.js";

// Leave a little air around the tower rather than framing it edge to edge.
const FIT_MARGIN = 1.15;

export class ZoomControls {
  constructor(game, container) {
    this.game = game;

    this.el = document.createElement("div");
    this.el.id = "zoomcontrols";

    const mk = (label, title, onClick) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "osbtn";
      b.textContent = label;
      b.title = title;
      b.setAttribute("aria-label", title);
      b.addEventListener("click", onClick);
      this.el.appendChild(b);
      return b;
    };

    mk("+", "Zoom in", () => zoomIn(game, game.zoomStep || 2));
    mk("\u2212", "Zoom out", () => zoomOut(game, game.zoomStep || 2));
    mk("\u25a2", "Fit tower", () => this.fitTower());

    if (container) container.appendChild(this.el);
  }

  destroy() {
    this.el.remove();
  }

  // Frame the whole tower. `zoom` is view-size / canvas-size, so a larger value
  // is further out; pick whichever axis needs more room.
  fitTower() {
    const g = this.game;
    const b = towerBounds(g.items);
    const win = g.app?.window || { width: 1280, height: 768 };
    // World pixels: 8 per tile across, 36 per floor up.
    const worldW = Math.max(1, (b.maxX - b.minX) * 8);
    const worldH = Math.max(1, (b.maxY - b.minY) * 36);
    const zoom = Math.max(worldW / win.width, worldH / win.height) * FIT_MARGIN;
    g.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));
    g.centerViewportOnTile((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2);
    clampPOI(g);
    return g.zoom;
  }
}
