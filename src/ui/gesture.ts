export interface Point {
  x: number;
  y: number;
}

export interface GestureHandlers {
  /** Pressed and released without moving much. */
  onTap?: () => void;
  /** Held still past the long-press delay. Cancels the tap and any drag. */
  onLongPress?: () => void;
  onDragStart?: (point: Point) => void;
  onDragMove?: (point: Point, delta: Point) => void;
  onDragEnd?: (point: Point) => void;
}

/** Movement, in CSS pixels, that turns a press into a drag. */
const DRAG_THRESHOLD = 7;
const LONG_PRESS_MS = 450;

/**
 * One pointer-events gesture recogniser for taps, long-presses and drags.
 *
 * Pointer events rather than separate touch and mouse paths: a phone, a mouse
 * and a stylus all arrive here identically, so there is one set of behaviour
 * to reason about instead of three that drift apart.
 */
export function attachGesture(element: HTMLElement, handlers: GestureHandlers): () => void {
  let pointerId: number | null = null;
  let start: Point = { x: 0, y: 0 };
  let last: Point = { x: 0, y: 0 };
  let dragging = false;
  let longPressed = false;
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;

  const clearLongPress = () => {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  const onPointerDown = (event: PointerEvent) => {
    // Ignore secondary buttons and any second finger mid-gesture.
    if (pointerId !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;

    pointerId = event.pointerId;
    start = { x: event.clientX, y: event.clientY };
    last = start;
    dragging = false;
    longPressed = false;

    element.setPointerCapture(event.pointerId);

    if (handlers.onLongPress) {
      longPressTimer = setTimeout(() => {
        longPressTimer = null;
        if (dragging) return;
        longPressed = true;
        handlers.onLongPress?.();
      }, LONG_PRESS_MS);
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== pointerId || longPressed) return;

    const point = { x: event.clientX, y: event.clientY };

    if (!dragging) {
      const travelled = Math.hypot(point.x - start.x, point.y - start.y);
      if (travelled < DRAG_THRESHOLD) return;
      dragging = true;
      clearLongPress();
      handlers.onDragStart?.(start);
    }

    handlers.onDragMove?.(point, { x: point.x - last.x, y: point.y - last.y });
    last = point;
  };

  const finish = (event: PointerEvent, cancelled: boolean) => {
    if (event.pointerId !== pointerId) return;

    clearLongPress();
    if (element.hasPointerCapture(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }
    pointerId = null;

    if (dragging) {
      handlers.onDragEnd?.({ x: event.clientX, y: event.clientY });
    } else if (!longPressed && !cancelled) {
      handlers.onTap?.();
    }

    dragging = false;
    longPressed = false;
  };

  const onPointerUp = (event: PointerEvent) => finish(event, false);
  const onPointerCancel = (event: PointerEvent) => finish(event, true);

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerup', onPointerUp);
  element.addEventListener('pointercancel', onPointerCancel);
  // Long-press on touch pops up the system menu unless suppressed.
  element.addEventListener('contextmenu', preventDefault);

  return () => {
    clearLongPress();
    element.removeEventListener('pointerdown', onPointerDown);
    element.removeEventListener('pointermove', onPointerMove);
    element.removeEventListener('pointerup', onPointerUp);
    element.removeEventListener('pointercancel', onPointerCancel);
    element.removeEventListener('contextmenu', preventDefault);
  };
}

function preventDefault(event: Event): void {
  event.preventDefault();
}
