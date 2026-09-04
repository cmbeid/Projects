// Canvas-2D renderer (RENDER agent). Port of the draw half of
// Game::advance (Game.cpp:924-1140) plus Game::drawViewportScrollbars
// (Game.cpp:789-828).
//
// Browser-only at runtime, but import-safe in bun: all DOM/canvas access is
// feature-detected (constructor accepts a null canvas; frame() no-ops).
// buildFrame() is a pure draw-list builder (no canvas) so draw order, culling
// and overlay logic are testable headless.
//
// View math mirrors SFML: the view is a world-render-space rect
// {x, y (top), w, h}; zoom = view size / canvas size. World y is UP, render
// y is DOWN — view.y = round(-poi.y - halfH) and every item rect is negated
// (the [TRICKY] comment at Game.cpp:937).

import { DrawList } from "./drawlist.js";
import { STATUS_MODE, ICON } from "../game/game.js";

export const SCROLLBAR = { size: 16, topOffset: 23, thumbW: 128, thumbH: 96 };

// ---- pure helpers ---------------------------------------------------------

// Port of Game.cpp:924-933 (halfsize, rounded view position, y negation).
export function computeView(poi, zoom, winW, winH) {
  const halfW = winW * 0.5 * zoom;
  const halfH = winH * 0.5 * zoom;
  return {
    x: Math.round(poi.x - halfW),
    y: Math.round(-poi.y - halfH), // render-space top edge
    w: halfW * 2,
    h: halfH * 2,
  };
}

// Port of sf::RenderTarget::mapPixelToCoords for a full-canvas viewport,
// plus the `mp.y = -mp.y` world flip (Game.cpp:936-937). px/py are CSS px.
export function screenToWorld(px, py, view, canvasW, canvasH) {
  return {
    x: view.x + (px / canvasW) * view.w,
    y: -(view.y + (py / canvasH) * view.h),
  };
}

// View culling test — port of the Game.cpp:981-984 condition with the
// render-space y negation applied. r is the item rect in render space.
export function rectVisible(view, x, y, w, h) {
  return x + w >= view.x && x <= view.x + view.w && y + h >= view.y && y <= view.y + view.h;
}

function itemRenderRect(item) {
  const p = item.getPositionPixels(); // world-up px
  const s = item.getSizePixels();
  if (item.isElevator && item.isElevator()) {
    // Elevators extend 36px (1 floor) above for top motor and 36px below for bottom pit
    return { x: p.x, y: -(p.y + s.y + 36), w: s.x, h: s.y + 72 };
  }
  return { x: p.x, y: -(p.y + s.y), w: s.x, h: s.y }; // render space (y down)
}

function cssColor(c) {
  return "rgba(" + c.r + "," + c.g + "," + c.b + "," + (c.a / 255).toFixed(5) + ")";
}

function clamp01(v) {
  return Math.max(0.0, Math.min(1.0, v));
}

// Status overlay tints — Game.cpp:1007-1058 exact values.
const TENANT_IDS = new Set([
  "office", "condo", "yoot_condo",
  "hotel_single", "hotel_double", "hotel_suite", "hotel",
  "fastfood", "restaurant", "cinema", "partyhall",
]);
const HOTEL_IDS = new Set(["hotel_single", "hotel_double", "hotel_suite", "hotel"]);

function statusTint(game, item) {
  const id = item.prototype.id;
  if (game.statusMode === STATUS_MODE.EVAL) {
    const e = item.evaluation;
    if (e >= 70) return { r: 0, g: 96, b: 255, a: 110 }; // blue = high
    if (e >= 40) return { r: 255, g: 200, b: 0, a: 110 }; // yellow = medium
    return { r: 255, g: 0, b: 0, a: 110 }; // red = low
  }
  if (game.statusMode === STATUS_MODE.HOTEL) {
    if (!HOTEL_IDS.has(id)) return null;
    // roomState: 0 clean / 1 occupied / 2 dirty (save-format encoding)
    if (item.roomState === 2) return { r: 255, g: 0, b: 0, a: 140 };
    if (item.roomState === 1) return { r: 255, g: 200, b: 0, a: 90 };
    return { r: 0, g: 200, b: 0, a: 90 };
  }
  if (game.statusMode === STATUS_MODE.PRIC) {
    if ((id === "condo" || id === "yoot_condo" || id === "office") && !item.isOccupied()) {
      return { r: 255, g: 200, b: 0, a: 110 }; // yellow = For Sale/Rent
    }
    return null;
  }
  return null;
}

// ---- renderer -------------------------------------------------------------

export class Renderer {
  // canvas: HTMLCanvasElement (browser) or null (headless tests).
  // bitmaps: BitmapRegistry (optional; image ops are skipped without it).
  constructor(canvas, { bitmaps = null } = {}) {
    this.canvas = canvas || null;
    this.ctx = null;
    if (this.canvas && typeof this.canvas.getContext === "function") {
      this.ctx = this.canvas.getContext("2d");
    }
    this.bitmaps = bitmaps;
    this.draw = new DrawList();
    this.view = { x: 0, y: 0, w: 1, h: 1 };
    this.cssW = 0;
    this.cssH = 0;
    this.dpr = 1;
    this._tintCache = new Map();
    this._imgIds = new WeakMap();
    this._nextImgId = 1;
    this._canOffscreen =
      typeof document !== "undefined" && typeof document.createElement === "function";
    this.windowW = 0; // last window size used by frame (scrollbar hit tests)
    this.windowH = 0;

    // Touch already has one-finger pan and pinch-zoom, so the 16px scrollbar
    // tracks are pure loss there: on a portrait phone the right-hand track sits
    // exactly where a thumb swipes, and the bottom one is buried under the
    // toolbox drawer. Suppressing scrollbarAt() also removes them from the
    // input path (input.js hit-tests through it), so no drag can start on one.
    this.pointerCoarse = false;
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      const mq = window.matchMedia("(pointer: coarse)");
      this.pointerCoarse = mq.matches;
      this._onPointerCoarseChange = (e) => {
        this.pointerCoarse = e.matches;
      };
      mq.addEventListener?.("change", this._onPointerCoarseChange);
      this._pointerCoarseMq = mq;
    }
  }

  // ---- frame --------------------------------------------------------------

  frame(game, _dt = 0) {
    if (!this.ctx) return;
    this.resize(game);
    this.buildFrame(game);
    this.rasterize(game);
    this.drawScrollbars(game);
  }

  // Pure draw-list builder — the exact draw order of Game.cpp:946-1126.
  buildFrame(game) {
    const draw = this.draw;
    draw.reset();
    if (!game.app.window) game.app.window = { width: 1280, height: 768 };
    this.view = computeView(game.poi, game.zoom, game.app.window.width, game.app.window.height);
    this.windowW = game.app.window.width;
    this.windowH = game.app.window.height;
    const view = this.view;

    // Expose render-space view bounds for background renderers (sky/decorations
    // read draw.view via viewBounds() to cull their strips).
    draw.view = {
      min: { x: view.x, y: view.y },
      max: { x: view.x + view.w, y: view.y + view.h },
    };

    // 4) sky + decorations (steps 19 in core-sim §3.2)
    game.sky.render(draw);
    game.decorations.render(draw);

    // 5) floor items first, then layer 0 and layer 1 — view-culled;
    //    track itemBelowCursor via containsPoint(mouseWorld).
    const previousItemBelowCursor = game.itemBelowCursor;
    game.itemBelowCursor = null;
    const mp = game.mouseWorld;

    const drawItem = (item) => {
      const r = itemRenderRect(item);
      if (!rectVisible(view, r.x, r.y, r.w, r.h)) return;
      item.render(draw);
      if (item.containsPoint(mp)) game.itemBelowCursor = item;
    };

    for (const item of game.itemsByType.get("floor") || []) drawItem(item);
    for (let layer = 0; layer < 2; layer++) {
      for (const item of game.items) {
        if (item.layer !== layer) continue;
        drawItem(item);
      }
    }

    // 6) status-mode overlay quads over tenants (Game.cpp:1000-1058)
    if (game.statusMode !== STATUS_MODE.NORMAL) {
      for (const item of game.items) {
        if (item.underConstruction) continue;
        if (!TENANT_IDS.has(item.prototype.id)) continue;
        const tint = statusTint(game, item);
        if (!tint) continue;
        const r = itemRenderRect(item);
        if (!rectVisible(view, r.x, r.y, r.w, r.h)) continue;
        draw.rect(r.x, r.y, r.w, r.h, { fill: tint });
        game.drawnSprites++;
      }
    }

    // 6b) Continuous corridor walking pedestrians & weather props
    if (game.people) {
      for (const p of game.people) {
        if (!p.isWalking) continue;
        const wx = p.walkX;
        const wy = -(p.walkFloor * 36);
        if (!rectVisible(view, wx - 8, wy - 24, 16, 24)) continue;

        const frame = Math.trunc(game.time.absolute * 150.0 + p.animOffset * 6) % 6;
        const color = game.lighting ? game.lighting.compose({ r: 255, g: 255, b: 255, a: 255 }) : null;

        draw.image("simtower/people", { x: frame * 16, y: 0, w: 16, h: 24 }, wx, wy, {
          origin: { x: 8, y: 24 },
          tint: color,
        });
        game.drawnSprites++;

        // Rainy weather: render colorful umbrella when outdoors
        if (game.sky?.rainyDay && p.walkFloor === 0) {
          draw.rect(wx - 6, wy - 28, 12, 3, {
            fill: { r: 220, g: 60, b: 60, a: 240 },
          });
          draw.rect(wx - 1, wy - 25, 2, 4, {
            fill: { r: 50, g: 50, b: 50, a: 255 },
          });
          game.drawnSprites += 2;
        }
      }
    }

    // 7) emergency events on top of everything
    game.eventSystem.render(draw);

    // 8) highlight item below cursor (white 128 alpha) + name on change
    if (!game.toolPrototype && game.itemBelowCursor) {
      const item = game.itemBelowCursor;
      const r = itemRenderRect(item);
      draw.rect(r.x, r.y, r.w, r.h, { fill: { r: 255, g: 255, b: 255, a: 128 } });
      game.drawnSprites++;
      if (previousItemBelowCursor !== item) {
        game.ui.showMessage(item.prototype.name);
      }
    }

    // 9) tool placement preview (white 48-alpha fill + 1px outline; lobby
    //    height comes from game._toolHeightOverride set by updateToolPosition).
    //    ISSUE-039: while an item-tool drag is active, every queued batch cell
    //    gets its own ghost — white = buildable & affordable, red = conflict
    //    (occupied footprint / gate) or total cost beyond funds.
    if (game.batchDrag && game.toolPrototype && game.batchDrag.cells.length > 0) {
      const proto = game.toolPrototype;
      for (const c of game.batchDrag.cells) {
        const bad = !c.valid || !game.batchDrag.affordableTotal;
        draw.rect(
          c.x * 8,
          -(c.y + proto.size.y) * 36,
          proto.size.x * 8,
          proto.size.y * 36,
          {
            fill: bad ? { r: 255, g: 0, b: 0, a: 48 } : { r: 255, g: 255, b: 255, a: 48 },
            outline: bad ? { r: 255, g: 0, b: 0, a: 255 } : { r: 255, g: 255, b: 255, a: 255 },
            outlineWidth: 1,
          },
        );
        game.drawnSprites++;
      }
    } else if (game.toolPrototype) {
      let height = game.toolPrototype.size.y;
      if (game.toolPrototype.icon === ICON.LOBBY || game.toolPrototype.icon === ICON.STAIRS) {
        height = game._toolHeightOverride || height;
      }
      draw.rect(
        game.toolPosition.x * 8,
        -(game.toolPosition.y + height) * 36,
        game.toolPrototype.size.x * 8,
        height * 36,
        {
          fill: { r: 255, g: 255, b: 255, a: 48 },
          outline: { r: 255, g: 255, b: 255, a: 255 },
          outlineWidth: 1,
        },
      );
      game.drawnSprites++;
    }

    // 9b) (removed: bulldozer now single-click demolishes itemBelowCursor)

    // 10) inspector route overlay — green GL line strip
    //     (x = item.x*8+4, vertical segments y = -floor*36-5)
    const route = game.visualizeRoute;
    if (route && !route.empty() && route.nodes.length > 0) {
      const pts = [];
      let prevFloor = route.nodes[0].item.position.y;
      for (const n of route.nodes) {
        if (n.item !== game.mainLobby) {
          const px = n.item.position.x * 8 + 4;
          pts.push({ x: px, y: -prevFloor * 36 - 5 });
          pts.push({ x: px, y: -n.toFloor * 36 - 5 });
        }
        prevFloor = n.toFloor;
      }
      if (pts.length > 1) {
        draw.polyline(pts, { color: { r: 0, g: 255, b: 0, a: 255 }, width: 1 });
      }
    }

    return draw;
  }

  // ---- rasterization ------------------------------------------------------

  // Size the backing store to devicePixelRatio and keep game.app.window in
  // sync with the CSS size (SFML parity: window size drives the camera).
  resize(game) {
    if (typeof window !== "undefined" && window.devicePixelRatio) {
      this.dpr = window.devicePixelRatio;
    } else {
      this.dpr = 1;
    }
    let cssW = this.canvas ? this.canvas.clientWidth : 0;
    let cssH = this.canvas ? this.canvas.clientHeight : 0;
    if ((!cssW || !cssH) && game && game.app && game.app.window) {
      cssW = game.app.window.width;
      cssH = game.app.window.height;
    }
    this.cssW = cssW;
    this.cssH = cssH;
    if (cssW && cssH && game) {
      if (!game.app.window) game.app.window = { width: cssW, height: cssH };
      game.app.window.width = cssW;
      game.app.window.height = cssH;
      const pw = Math.round(cssW * this.dpr);
      const ph = Math.round(cssH * this.dpr);
      if (this.canvas.width !== pw) this.canvas.width = pw;
      if (this.canvas.height !== ph) this.canvas.height = ph;
    }
  }

  // Map the accumulated ops through the camera transform onto the canvas.
  rasterize(game) {
    const ctx = this.ctx;
    const view = this.view;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const sx = cw / view.w;
    const sy = ch / view.h;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000"; // glClear(black) parity
    ctx.fillRect(0, 0, cw, ch);
    ctx.setTransform(sx, 0, 0, sy, -view.x * sx, -view.y * sy);
    ctx.imageSmoothingEnabled = false;

    for (const op of this.draw.ops) {
      if (op.op === "sprite") this._rasterSprite(op);
      else if (op.op === "image") this._rasterImage(op);
      else if (op.op === "rect") this._rasterRect(op, view);
      else if (op.op === "polyline") this._rasterPolyline(op, view, sx);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  _rasterSprite(op) {
    const s = op.sprite;
    this._drawBitmap(
      s.texture,
      s.textureRect,
      s.position.x,
      s.position.y,
      { origin: s.origin, tint: op.color || s.color, flipX: s.flipX },
    );
  }

  _rasterImage(op) {
    this._drawBitmap(op.key, op.srcRect, op.x, op.y, op.opts);
  }

  _drawBitmap(key, srcRect, x, y, opts = {}) {
    const ctx = this.ctx;
    const img = this.bitmaps ? this.bitmaps.image(key) : null;
    if (!img) return;
    const rect = srcRect || { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
    const ox = opts.origin ? opts.origin.x : 0;
    const oy = opts.origin ? opts.origin.y : 0;
    const x0 = x - ox;
    const y0 = y - oy;
    if (!rectVisible(this.view, x0, y0, rect.w, rect.h)) return;

    const color = opts.tint || { r: 255, g: 255, b: 255, a: 255 };
    const alpha = color.a !== undefined ? color.a / 255 : 1;
    if (alpha < 1) ctx.globalAlpha = alpha;

    let source = img;
    let sourceX = rect.x;
    let sourceY = rect.y;
    if (color.r !== 255 || color.g !== 255 || color.b !== 255) {
      source = this._tinted(img, rect, color);
      sourceX = 0;
      sourceY = 0;
    }

    if (opts.flipX) {
      ctx.save();
      ctx.translate(x0 + rect.w, y0);
      ctx.scale(-1, 1);
      ctx.drawImage(source, sourceX, sourceY, rect.w, rect.h, 0, 0, rect.w, rect.h);
      ctx.restore();
    } else {
      ctx.drawImage(source, sourceX, sourceY, rect.w, rect.h, x0, y0, rect.w, rect.h);
    }
    if (alpha < 1) ctx.globalAlpha = 1;
  }

  // Multiply-tint a bitmap region on a scratch offscreen canvas, cached by
  // image+rect+rgb (lighting transitions quantize to uint8 so the cache holds;
  // it is flushed when it grows past the cap).
  _tinted(img, rect, color) {
    if (!this._canOffscreen) return img;
    let id = this._imgIds.get(img);
    if (id === undefined) {
      id = this._nextImgId++;
      this._imgIds.set(img, id);
    }
    const ck =
      id + "|" + rect.x + "," + rect.y + "," + rect.w + "," + rect.h +
      "|" + color.r + "," + color.g + "," + color.b;
    let cached = this._tintCache.get(ck);
    if (cached) return cached;
    if (this._tintCache.size > 1024) this._tintCache.clear();

    const c = document.createElement("canvas");
    c.width = rect.w;
    c.height = rect.h;
    const cx = c.getContext("2d");
    cx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
    cx.globalCompositeOperation = "multiply";
    cx.fillStyle = "rgb(" + color.r + "," + color.g + "," + color.b + ")";
    cx.fillRect(0, 0, rect.w, rect.h);
    cx.globalCompositeOperation = "destination-in"; // restore alpha mask
    cx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);

    this._tintCache.set(ck, c);
    return c;
  }

  _rasterRect(op, view) {
    const ctx = this.ctx;
    const { x, y, w, h } = op;
    if (!rectVisible(view, x, y, w, h)) return;
    const o = op.opts || {};
    if (o.fill) {
      ctx.fillStyle = cssColor(o.fill);
      ctx.fillRect(x, y, w, h);
    }
    if (o.outline) {
      ctx.strokeStyle = cssColor(o.outline);
      ctx.lineWidth = o.outlineWidth !== undefined ? o.outlineWidth : 1;
      ctx.strokeRect(x, y, w, h);
    }
  }

  _rasterPolyline(op, view, sx) {
    const ctx = this.ctx;
    const pts = op.points;
    if (!pts || pts.length < 2) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    if (!rectVisible(view, minX, minY, maxX - minX, maxY - minY)) return;
    const o = op.opts || {};
    const color = o.color || { r: 0, g: 255, b: 0, a: 255 };
    ctx.strokeStyle = cssColor(color);
    // GL line width is in screen pixels; convert from world units.
    ctx.lineWidth = (o.width !== undefined ? o.width : 1) / sx;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }

  // ---- scrollbars (Game.cpp:789-828, screen space) -------------------------

  drawScrollbars(game) {
    if (this.pointerCoarse) return;
    const ctx = this.ctx;
    const w = this.windowW;
    const h = this.windowH;
    if (!w || !h) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.lineWidth = 1;

    const S = SCROLLBAR.size;
    const TOP = SCROLLBAR.topOffset;
    const rightX = w - S;
    const bottomY = h - S;
    const track = "rgb(198,198,198)";
    const thumb = "rgb(145,145,145)";
    const outline = "rgb(32,32,32)";

    const box = (x, y, bw, bh, fill) => {
      ctx.fillStyle = fill;
      ctx.strokeStyle = outline;
      ctx.fillRect(x, y, bw, bh);
      ctx.strokeRect(x, y, bw, bh);
    };

    // vertical track + thumb
    box(rightX, TOP, S, bottomY - TOP, track);
    const vt = clamp01((360 * 12 - game.poi.y) / (360 * 13));
    box(
      rightX + 1,
      TOP + vt * Math.max(1, bottomY - TOP - SCROLLBAR.thumbH),
      S - 2,
      SCROLLBAR.thumbH,
      thumb,
    );

    // horizontal track + thumb
    box(0, bottomY, rightX, S, track);
    const ht = clamp01((game.poi.x + 512) / 1024);
    box(ht * Math.max(1, rightX - SCROLLBAR.thumbW), bottomY + 1, SCROLLBAR.thumbW, S - 2, thumb);
  }

  // Which scrollbar (if any) covers CSS pixel (px, py)? For UI input wiring.
  scrollbarAt(px, py) {
    if (this.pointerCoarse) return null;
    const w = this.windowW;
    const h = this.windowH;
    if (!w || !h) return null;
    const S = SCROLLBAR.size;
    const rightX = w - S;
    const bottomY = h - S;
    if (px >= rightX && py >= SCROLLBAR.topOffset && py < bottomY) return "vertical";
    if (py >= bottomY && py < h && px < rightX) return "horizontal";
    return null;
  }

  // Drag-to-scroll — port of setVerticalFromMouse / setHorizontalFromMouse
  // (Game.cpp:748-756). region: "vertical" | "horizontal".
  scrollTo(game, region, px, py) {
    const w = this.windowW;
    const h = this.windowH;
    if (!w || !h) return;
    if (region === "vertical") {
      const usable = Math.max(1, h - SCROLLBAR.topOffset - SCROLLBAR.size);
      const t = clamp01((py - SCROLLBAR.topOffset) / usable);
      game.poi.y = 360 * 12 - t * (360 * 13);
    } else if (region === "horizontal") {
      const usable = Math.max(1, w - SCROLLBAR.size);
      const t = clamp01(px / usable);
      game.poi.x = -512 + t * 1024;
    }
  }

  // ---- input helper --------------------------------------------------------

  // CSS pixel -> world-up px (mirror of mapPixelToCoords + y flip).
  screenToWorld(px, py) {
    const w = this.cssW || this.windowW || 1;
    const h = this.cssH || this.windowH || 1;
    return screenToWorld(px, py, this.view, w, h);
  }

  // ---- PNG export ---------------------------------------------------------
  // Renders the current view at `scale`× resolution onto an offscreen canvas
  // (2×–4× gives crisp screenshots) and returns it. Returns null when headless
  // (no DOM canvas / no 2D context). The caller downloads via canvas.toBlob.
  capturePNG(game, scale = 3) {
    if (!this.canvas || !this.ctx) return null;
    if (typeof document === "undefined" || typeof document.createElement !== "function") return null;

    this.buildFrame(game);
    const view = this.view;
    const w = Math.max(1, Math.round(view.w * scale));
    const h = Math.max(1, Math.round(view.h * scale));
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const offCtx = off.getContext("2d");
    if (!offCtx) return null;

    const prevCanvas = this.canvas;
    const prevCtx = this.ctx;
    this.canvas = off;
    this.ctx = offCtx;
    try {
      this.rasterize(game);
    } finally {
      this.canvas = prevCanvas;
      this.ctx = prevCtx;
    }
    return off;
  }
}
