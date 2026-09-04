/**
 * Touch handling: drag to pan, pinch to zoom, tap to act.
 *
 * The distinction that matters on a phone is drag versus tap, and it is a
 * question of intent rather than geometry — a finger always moves a little. A
 * gesture becomes a pan once it travels past a threshold, and only a gesture
 * that never did counts as a tap.
 */

import type { Camera } from '../render/camera.js';

/** Pixels of travel before a touch is a drag rather than a tap. */
const DRAG_THRESHOLD = 8;

export interface Gestures {
  onTap: (handler: (cssX: number, cssY: number) => void) => void;
  onLongPress: (handler: (cssX: number, cssY: number) => void) => void;
  onChange: (handler: () => void) => void;
  dispose: () => void;
}

interface Pointer {
  x: number;
  y: number;
  startX: number;
  startY: number;
  dragged: boolean;
}

export function attachGestures(canvas: HTMLCanvasElement, camera: Camera): Gestures {
  const pointers = new Map<number, Pointer>();
  const tapHandlers: ((x: number, y: number) => void)[] = [];
  const longPressHandlers: ((x: number, y: number) => void)[] = [];
  const changeHandlers: (() => void)[] = [];
  let pinchDistance = 0;
  let longPressTimer: ReturnType<typeof setTimeout> | undefined;

  const changed = (): void => {
    for (const handler of changeHandlers) handler();
  };

  const local = (event: PointerEvent): { x: number; y: number } => {
    const bounds = canvas.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };

  const cancelLongPress = (): void => {
    if (longPressTimer !== undefined) clearTimeout(longPressTimer);
    longPressTimer = undefined;
  };

  const onDown = (event: PointerEvent): void => {
    const point = local(event);
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: point.x, y: point.y, startX: point.x, startY: point.y, dragged: false });

    if (pointers.size === 2) {
      cancelLongPress();
      pinchDistance = spread(pointers);
      return;
    }

    cancelLongPress();
    longPressTimer = setTimeout(() => {
      const pointer = pointers.get(event.pointerId);
      if (!pointer || pointer.dragged) return;
      pointer.dragged = true; // consumed: the lift-off must not also fire a tap
      for (const handler of longPressHandlers) handler(pointer.x, pointer.y);
    }, 450);
  };

  const onMove = (event: PointerEvent): void => {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    const point = local(event);
    const dx = point.x - pointer.x;
    const dy = point.y - pointer.y;
    pointer.x = point.x;
    pointer.y = point.y;

    if (Math.abs(point.x - pointer.startX) > DRAG_THRESHOLD || Math.abs(point.y - pointer.startY) > DRAG_THRESHOLD) {
      if (!pointer.dragged) cancelLongPress();
      pointer.dragged = true;
    }

    if (pointers.size === 2) {
      const distance = spread(pointers);
      // A pinch has to be decisive before it changes zoom, since integer steps
      // make every change a big one.
      if (pinchDistance > 0 && Math.abs(distance - pinchDistance) > 40) {
        const direction = distance > pinchDistance ? 1 : -1;
        const anchor = centre(pointers, canvas);
        camera.zoomTo(camera.steppedScale(direction), canvas.clientWidth, canvas.clientHeight, anchor.x, anchor.y);
        pinchDistance = distance;
        changed();
      }
      return;
    }

    if (pointer.dragged) {
      camera.panBy(-dx / camera.scale, -dy / camera.scale);
      changed();
    }
  };

  // A double tap zooms — faster than a pinch, and it works one-handed. The
  // first tap still acts, so tapping twice on the build tool places once and
  // then zooms, which is predictable even if it is not clever.
  let lastTap = 0;

  const onUp = (event: PointerEvent): void => {
    const pointer = pointers.get(event.pointerId);
    pointers.delete(event.pointerId);
    cancelLongPress();
    if (pointers.size < 2) pinchDistance = 0;
    if (!pointer || pointer.dragged) return;

    const now = performance.now();
    if (now - lastTap < 300) {
      lastTap = 0;
      const next = camera.scale === 3 ? 1 : camera.steppedScale(1);
      camera.zoomTo(
        next,
        canvas.clientWidth,
        canvas.clientHeight,
        pointer.x / Math.max(1, canvas.clientWidth),
        pointer.y / Math.max(1, canvas.clientHeight),
      );
      changed();
      return;
    }
    lastTap = now;

    for (const handler of tapHandlers) handler(pointer.x, pointer.y);
  };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  const onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const bounds = canvas.getBoundingClientRect();
    camera.zoomTo(
      camera.steppedScale(event.deltaY < 0 ? 1 : -1),
      canvas.clientWidth,
      canvas.clientHeight,
      (event.clientX - bounds.left) / canvas.clientWidth,
      (event.clientY - bounds.top) / canvas.clientHeight,
    );
    changed();
  };
  canvas.addEventListener('wheel', onWheel, { passive: false });

  return {
    onTap: (handler) => tapHandlers.push(handler),
    onLongPress: (handler) => longPressHandlers.push(handler),
    onChange: (handler) => changeHandlers.push(handler),
    dispose: () => {
      cancelLongPress();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
    },
  };
}

function spread(pointers: Map<number, Pointer>): number {
  const [a, b] = [...pointers.values()];
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function centre(pointers: Map<number, Pointer>, canvas: HTMLCanvasElement): { x: number; y: number } {
  const [a, b] = [...pointers.values()];
  if (!a || !b) return { x: 0.5, y: 0.5 };
  return {
    x: (a.x + b.x) / 2 / Math.max(1, canvas.clientWidth),
    y: (a.y + b.y) / 2 / Math.max(1, canvas.clientHeight),
  };
}
