// DOM input wiring (UI agent) — port of Game::handleEvent's input branches
// (Game.cpp:150-248 + the viewport-scrollbar drags at Game.cpp:728-789).
//
// All pointers flow through the Pointer Events API (ISSUE-040): mouse behaves
// exactly as the old mousedown/mousemove/mouseup path did, while touch and
// pen get a gesture layer:
//   - Tap = the desktop click path (item tools build on release per ISSUE-039,
//     instant tools build on press), so taps match desktop clicks 1:1.
//   - One-finger drag pans the camera when nothing actionable was hit
//     (handlePointerDown returned false); with an interactive tool armed the
//     drag feeds that tool instead (batch placement, elevator motor resize).
//   - Two-finger pinch zooms around its midpoint.
//   - pointercancel abandons any pending interaction without committing.
//   - A long-press before dragging a batch-placeable item arms grid mode
//     for that drag (game.gridDragArmed) — the touch equivalent of holding
//     Shift, since there's no keyboard to hold it on. See game.js
//     updateBatchDrag() and toolbox.js's matching long-press height picker
//     for the Lobby tool (game.lobbyHeight).
// Wheel still pans (±40·zoom; Shift → horizontal), keys keep their old
// behavior. game.keys tracks physical Shift/Ctrl via ./modifiers.js.

import { wheelPan, arrowPan, zoomIn, zoomOut, clampPOI, maxUsefulZoom, ZOOM_MIN } from "../render/camera.js";
import { ensureModifierKeys, resolveModifierKeys, setPhysicalModifier } from "./modifiers.js";
import { panWorldOffset, pinchMetrics, pinchTarget, TAP_SLOP_PX } from "./gestures.js";

export function wireInput(game, renderer, { onToggleMap, onToggleFinance, onToggleFind, onToggleSave, onToggleOptions, closeTopDialog, onSave } = {}) {
  const canvas = renderer.canvas;

  // ---- modifier state -------------------------------------------------------

  ensureModifierKeys(game.keys);
  const syncKeys = (e) => {
    setPhysicalModifier(game.keys, "shift", !!e.shiftKey);
    setPhysicalModifier(game.keys, "ctrl", !!(e.ctrlKey || e.metaKey));
  };

  const preventDefault = (e) => {
    if (e.cancelable) e.preventDefault();
  };

  // ---- shared pointer plumbing ----------------------------------------------

  const relative = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  let scrollbarDrag = null; // "vertical" | "horizontal"

  const isCanvasTarget = (e) => e.target === canvas;

  // Press on the canvas: shared by every pointer type. Returns true when the
  // game consumed the press (a tool acted / a batch preview armed).
  // deferCommit holds back anything irreversible until pointerup — see the
  // touch branch of onPointerDown.
  const canvasPress = (e, deferCommit = false) => {
    syncKeys(e);
    if (e.button !== undefined && e.button !== 0) return false;
    const { x, y } = relative(e);
    // viewport scrollbar drags take priority (Game.cpp:728+)
    const region = renderer.scrollbarAt(x, y);
    if (region) {
      scrollbarDrag = region;
      renderer.scrollTo(game, region, x, y);
      return true;
    }
    const worldPos = renderer.screenToWorld(x, y);
    return game.handlePointerDown({ worldPos, overUI: false, deferCommit }) === true;
  };

  // ---- gesture state ---------------------------------------------------------

  const touches = new Map(); // pointerId -> canvas-relative {x, y}
  let primaryId = null; // driving single-finger gesture
  let mode = null; // null | "pan" | "tool" | "pinch"
  let downPt = null; // primary press origin (canvas CSS px)
  let lastPt = null; // last event position while panning
  let panned = false; // slop crossed → not a tap anymore
  let pinch = null; // { zoom0, poi0, dist0, canvasW, canvasH, anchorWorld }

  // ISSUE-040: long-press (no Shift key on touch) arms grid mode for a batch
  // drag — press-and-hold still, then drag, instead of holding Shift while
  // dragging. Mirrors the toolbox's existing 300ms press-and-hold feel.
  const GRID_HOLD_MS = 300;
  let gridHoldTimer = null;
  const clearGridHoldTimer = () => {
    if (gridHoldTimer) {
      clearTimeout(gridHoldTimer);
      gridHoldTimer = null;
    }
  };

  const enterPinch = () => {
    clearGridHoldTimer();
    const pts = [...touches.values()];
    const m = pinchMetrics(pts[0], pts[1]);
    pinch = {
      zoom0: game.zoom,
      poi0: { x: game.poi.x, y: game.poi.y },
      dist0: m.dist,
      canvasW: canvas.clientWidth || renderer.windowW || 1280,
      canvasH: canvas.clientHeight || renderer.windowH || 768,
      anchorWorld: renderer.screenToWorld(m.mid.x, m.mid.y),
    };
    // A batch preview, or a press the first finger deferred, must never
    // survive a second finger landing.
    game.cancelBatchDrag?.();
    game.cancelPendingPress?.();
    // The ghost stays parked across a pinch — only the drag is abandoned.
    if (game) game.ghostGrab = null;
    scrollbarDrag = null;
    mode = "pinch";
  };

  const updatePinch = () => {
    const pts = [...touches.values()];
    if (pts.length < 2 || !pinch) return;
    const m = pinchMetrics(pts[0], pts[1]);
    // Same ceiling the keyboard and the on-screen buttons use — pinchTarget's
    // own defaults are ZOOM_MIN/ZOOM_MAX, which let a pinch sail past the point
    // where the tower is still on screen.
    const t = pinchTarget(pinch, m.dist, m.mid, ZOOM_MIN, maxUsefulZoom(game));
    game.zoom = t.zoom;
    game.poi.x = t.poi.x;
    game.poi.y = t.poi.y;
    clampPOI(game);
  };

  // After a pinch ends (or one finger lifts), the remaining finger drives
  // plain panning — never a tap.
  const resumePanWithRemainingTouch = () => {
    pinch = null;
    const rest = [...touches.entries()][0];
    mode = "pan";
    if (!rest) return;
    primaryId = rest[0];
    downPt = { ...rest[1] };
    lastPt = { ...rest[1] };
    panned = true;
  };

  const clearGesture = () => {
    mode = null;
    primaryId = null;
    downPt = null;
    lastPt = null;
    panned = false;
  };

  // ---- handlers --------------------------------------------------------------

  const onPointerMove = (e) => {
    if (mode === "pinch") {
      const t = touches.get(e.pointerId);
      if (t) {
        Object.assign(t, relative(e));
        updatePinch();
        preventDefault(e);
      }
      return;
    }

    if (primaryId !== null && e.pointerId === primaryId && touches.has(e.pointerId)) {
      Object.assign(touches.get(e.pointerId), relative(e));
      const pos = relative(e);

      if (scrollbarDrag) {
        renderer.scrollTo(game, scrollbarDrag, pos.x, pos.y);
        preventDefault(e);
        return;
      }
      if (mode === "tool") {
        // Past the slop this is a drag, so the release repositions the ghost
        // instead of confirming it. Cancelling here rather than on release
        // keeps a long slow drag from committing just because it ended
        // somewhere near where it began.
        if (!panned && downPt && Math.hypot(pos.x - downPt.x, pos.y - downPt.y) > TAP_SLOP_PX) {
          panned = true;
          if (game.pendingPress?.kind === "ghostCommit") game.cancelPendingPress();
        }
        const worldPos = renderer.screenToWorld(pos.x, pos.y);
        game.handlePointerMove({ worldPos, overUI: false });
        preventDefault(e);
        return;
      }
      if (mode === "pan") {
        if (!lastPt) lastPt = { ...downPt };
        if (!panned && Math.hypot(pos.x - downPt.x, pos.y - downPt.y) > TAP_SLOP_PX) panned = true;
        if (panned) {
          const d = panWorldOffset(pos.x - lastPt.x, pos.y - lastPt.y, game.zoom);
          game.poi.x += d.dx;
          game.poi.y += d.dy;
          clampPOI(game);
        }
        lastPt = pos;
        preventDefault(e);
        return;
      }
    }

    // Hover path: mouse pointers (and uncaptured strays) over panels/canvas.
    if (e.pointerType === "mouse") game.touchInput = false;
    syncKeys(e);
    if (!isCanvasTarget(e)) {
      // over UI panels — TGUI consumes these; ISSUE-039 cancels a pending drag
      game.cancelBatchDrag?.();
      return;
    }
    const { x, y } = relative(e);
    if (scrollbarDrag) {
      renderer.scrollTo(game, scrollbarDrag, x, y);
      return;
    }
    const worldPos = renderer.screenToWorld(x, y);
    game.handlePointerMove({ worldPos, overUI: false });
  };

  const isTouchLike = (e) => e.pointerType !== "mouse";

  const onPointerDown = (e) => {
    if (e.target !== canvas) return;

    if (isTouchLike(e)) {
      // Drives the item-ghost lift in Game.placementLift(). Set from the
      // pointer that is actually being used rather than a media query, so a
      // hybrid laptop switches behaviour per gesture instead of per device.
      game.touchInput = true;
      const pos = relative(e);
      touches.set(e.pointerId, pos);
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (_) {}
      if (touches.size === 2) {
        enterPinch();
      } else if (touches.size === 1) {
        primaryId = e.pointerId;
        // Copied, not aliased. `pos` is the very object held in `touches`, and
        // onPointerMove mutates that in place — so sharing it made downPt track
        // the finger and every slop test below measure zero.
        downPt = { ...pos };
        lastPt = null;
        panned = false;
        // deferCommit: the first finger of a pinch is indistinguishable from
        // a tap until the second one lands, so a press that would build or
        // demolish is held until pointerup rather than fired here. Panning,
        // batch previews and the elevator drag still start immediately —
        // they are either reversible or cancelled by enterPinch.
        const acted = canvasPress(e, true);
        mode = acted ? "tool" : "pan";
        preventDefault(e); // block scroll / double-tap-zoom on the canvas

        game.gridDragArmed = false;
        clearGridHoldTimer();
        if (mode === "tool" && game.batchDrag) {
          const heldId = e.pointerId;
          gridHoldTimer = setTimeout(() => {
            gridHoldTimer = null;
            // Bail if the gesture moved on (released, cancelled, pinch
            // took over) or already dragged past the tap slop — a long
            // press only counts while the finger has stayed put.
            if (primaryId !== heldId || mode !== "tool" || !game.batchDrag) return;
            const cur = touches.get(heldId);
            if (cur && Math.hypot(cur.x - downPt.x, cur.y - downPt.y) > TAP_SLOP_PX) return;
            game.gridDragArmed = true;
            game.updateBatchDrag?.();
            navigator.vibrate?.(15); // touch confirmation for the arm moment
          }, GRID_HOLD_MS);
        }
      }
      return;
    }

    // Mouse: identical to the legacy behavior (press may act immediately).
    game.touchInput = false;
    if (canvasPress(e)) {
      primaryId = e.pointerId;
      mode = "tool";
      panned = false;
      downPt = relative(e);
    }
  };

  const finishPrimary = (cancelled) => {
    clearGridHoldTimer();
    if (cancelled) {
      // Escape-like semantics: never commit on cancellation.
      if (game.batchDrag) game.cancelBatchDrag();
      game.cancelPendingPress?.();
      scrollbarDrag = null;
      game.handlePointerUp();
    } else {
      scrollbarDrag = null;
      game.handlePointerUp();
    }
  };

  const onPointerUp = (e) => {
    if (mode === "pinch") {
      touches.delete(e.pointerId);
      clampPOI(game);
      if (touches.size >= 2) updatePinch();
      else if (touches.size === 1) resumePanWithRemainingTouch();
      else clearGesture();
      return;
    }

    const wasPrimary = e.pointerId === primaryId;
    touches.delete(e.pointerId);
    if (!wasPrimary) return;

    finishPrimary(false);
    if (touches.size > 0) resumePanWithRemainingTouch();
    else clearGesture();
  };

  const onPointerCancel = (e) => {
    if (mode === "pinch") {
      touches.delete(e.pointerId);
      if (pinch) {
        // Abandoned mid-pinch: restore the pre-gesture framing exactly.
        game.zoom = pinch.zoom0;
        game.poi.x = pinch.poi0.x;
        game.poi.y = pinch.poi0.y;
        clampPOI(game);
        pinch = null;
      }
      if (touches.size >= 2) updatePinch();
      else if (touches.size === 1) resumePanWithRemainingTouch();
      else clearGesture();
      return;
    }

    const wasPrimary = e.pointerId === primaryId;
    touches.delete(e.pointerId);
    if (!wasPrimary) return;

    finishPrimary(true);
    if (touches.size > 0) resumePanWithRemainingTouch();
    else clearGesture();
  };

  const onWheel = (e) => {
    if (e.target !== canvas) return;
    e.preventDefault();
    // SFML wheel delta is +1 per notch up; browsers give +deltaY per notch
    // down — flip the sign. Shift (or a horizontal wheel) pans x.
    wheelPan(game, -Math.sign(e.deltaY), {
      shift: game.keys.shift || e.shiftKey,
      horizontal: Math.abs(e.deltaX) > Math.abs(e.deltaY),
    });
  };

  // ---- keyboard ------------------------------------------------------------

  const isTypingTarget = (e) => {
    const t = e.target;
    return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
  };

  const onKeyDown = (e) => {
    syncKeys(e);
    game.updateToolPosition?.();
    if (isTypingTarget(e)) return;

    switch (e.key) {
      case "Escape":
        // ISSUE-039: an active item-tool drag cancels before dialogs close.
        if (game.batchDrag) {
          game.cancelBatchDrag();
          e.preventDefault();
          return;
        }
        if (closeTopDialog()) e.preventDefault();
        return;
      case "ArrowLeft":
        arrowPan(game, -20, 0);
        e.preventDefault();
        return;
      case "ArrowRight":
        arrowPan(game, 20, 0);
        e.preventDefault();
        return;
      case "ArrowUp":
        arrowPan(game, 0, 20);
        e.preventDefault();
        return;
      case "ArrowDown":
        arrowPan(game, 0, -20);
        e.preventDefault();
        return;
      case "PageUp":
        zoomIn(game, game.zoomStep || 2);
        e.preventDefault();
        return;
      case "PageDown":
        zoomOut(game, game.zoomStep || 2);
        e.preventDefault();
        return;
      case "o":
      case "O":
        if (e.ctrlKey || e.metaKey) {
          onToggleOptions?.();
          e.preventDefault();
          return;
        }
        game.cycleStatusMode();
        return;
      case "m":
      case "M":
        onToggleMap?.();
        return;
      case "f":
      case "F":
        if (e.ctrlKey || e.metaKey) {
          onToggleFind?.();
          e.preventDefault();
          return;
        }
        if (e.altKey || e.shiftKey) return;
        onToggleFinance?.();
        return;
      case "0":
      case "1":
      case "2":
      case "3":
        if (e.ctrlKey || e.metaKey || e.altKey) return; // ctrl+digit = tab switch
        game.setSpeedMode(Number(e.key));
        e.preventDefault();
        return;
      case "F2":
        onSave?.();
        e.preventDefault();
        return;
      case "s":
      case "S":
        if (e.ctrlKey || e.metaKey) {
          onToggleSave?.();
          e.preventDefault();
          return;
        }
        return;
      case "F3":
        game.setRating(1); // debug (Game.cpp:208)
        e.preventDefault();
        return;
      default:
        return;
    }
  };

  const onKeyUp = (e) => {
    syncKeys(e);
    game.updateToolPosition?.();
  };
  const onBlur = () => {
    // Physical key state is unknowable after losing focus.
    game.keys.physCtrl = false;
    game.keys.physShift = false;
    resolveModifierKeys(game.keys);
    scrollbarDrag = null;
    touches.clear();
    pinch = null;
    clearGesture();
    clearGridHoldTimer();
    game.cancelBatchDrag?.(); // never commit a drag lost to focus (ISSUE-039)
    game.cancelPendingPress?.();
    game.handlePointerUp();
  };

  window.addEventListener("pointermove", onPointerMove, { passive: false });
  canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  return {
    detach() {
      clearGridHoldTimer();
      window.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    },
  };
}
